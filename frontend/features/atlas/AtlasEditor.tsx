'use client';
import { useLanguage } from '../../shared/i18n/LanguageProvider';

import { useEffect, useRef, useState } from 'react';
import { createShapeId, getSnapshot, loadSnapshot, Tldraw, toRichText, type Editor, type TLShape } from 'tldraw';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { atlasRequest } from './client';
import { edgeTypes, nodeTypes, type AtlasDocument, type AtlasEdge, type AtlasEdgeType, type AtlasNode, type AtlasNodeType } from './model';
import type { AtlasMap } from './maps';

const selectClass = 'h-10 w-full rounded-md border border-input bg-background px-3 text-sm';
const nodeColor = (type: AtlasNodeType) => type === 'innovation' || type === 'pattern' ? 'violet' : type === 'decision' ? 'orange' : type === 'data' ? 'green' : 'blue';
const shapeVisibility = (shape: TLShape) => shape.meta.atlasHidden ? 'hidden' as const : 'inherit' as const;
const canvasComponents = { StylePanel: null };
const isHidden = (node: AtlasNode, nodes: AtlasNode[]): boolean => {
  let parentId = node.parentId;
  const seen = new Set<string>();
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = nodes.find(item => item.id === parentId);
    if (parent?.collapsed) return true;
    parentId = parent?.parentId;
  }
  return false;
};

function drawRelation(editor: Editor, id: string, from: string, to: string, hidden = false) {
  const start = editor.getShape(createShapeId(from)), end = editor.getShape(createShapeId(to));
  if (!start || !end || start.type !== 'geo' || end.type !== 'geo') return;
  const a = { x: start.x + start.props.w / 2, y: start.y + start.props.h / 2 };
  const b = { x: end.x + end.props.w / 2, y: end.y + end.props.h / 2 };
  const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
  const arrowId = createShapeId(id);
  editor.createShape({ id: arrowId, type: 'arrow', x, y, props: { start: { x: a.x - x, y: a.y - y }, end: { x: b.x - x, y: b.y - y } }, meta: { atlasHidden: hidden } });
  editor.createBindings([{ fromId: arrowId, toId: start.id, type: 'arrow', props: { terminal: 'start', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false } },
    { fromId: arrowId, toId: end.id, type: 'arrow', props: { terminal: 'end', normalizedAnchor: { x: 0.5, y: 0.5 }, isExact: false, isPrecise: false } }]);
}

export default function AtlasEditor({ mapId }: { mapId: string }) {
  const { t, language } = useLanguage();

  const [map, setMap] = useState<AtlasMap | null>(null);
  const [document, setDocument] = useState<AtlasDocument | null>(null);
  const [editor, setEditor] = useState<Editor | null>(null);
  useEffect(() => { editor?.user.updateUserPreferences({ locale: language === 'en' ? 'en' : 'zh-cn' }); }, [editor, language]);
  const [nodes, setNodes] = useState<AtlasNode[]>([]);
  const [edges, setEdges] = useState<AtlasEdge[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [type, setType] = useState<AtlasNodeType>('feature');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [relation, setRelation] = useState<AtlasEdgeType>('related_to');
  const [parentId, setParentId] = useState('');
  const [search, setSearch] = useState('');
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const changeCount = useRef(0);
  const editingNode = useRef(false);
  const nodesRef = useRef(nodes), edgesRef = useRef(edges);
  nodesRef.current = nodes; edgesRef.current = edges;
  const selected = nodes.find(node => node.id === selectedId);
  const children = nodes.filter(node => node.parentId === selectedId);
  const matches = search.trim() ? nodes.filter(node => `${node.title} ${node.summary}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase())) : [];

  useEffect(() => {
    let active = true;
    Promise.all([atlasRequest<AtlasMap>(`/${encodeURIComponent(mapId)}`), atlasRequest<AtlasDocument>(`/${encodeURIComponent(mapId)}/document`)])
      .then(([nextMap, nextDocument]) => {
        if (!active) return;
        setMap(nextMap); setDocument(nextDocument); setNodes(nextDocument.nodes); setEdges(nextDocument.edges);
      }).catch(cause => { if (active) setError((cause as Error).message); });
    return () => { active = false; };
  }, [mapId]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  function markDirty() { changeCount.current++; setDirty(true); }

  function mounted(instance: Editor) {
    try {
      if (document?.canvas) {
        loadSnapshot(instance.store, { document: document.canvas as ReturnType<typeof getSnapshot>['document'] });
        const hidden = new Set(document.nodes.filter(node => isHidden(node, document.nodes)).map(node => node.id));
        for (const node of document.nodes) {
          const shape = instance.getShape(createShapeId(node.id));
          if (shape) instance.updateShape({ id: shape.id, type: shape.type, meta: { ...shape.meta, atlasHidden: hidden.has(node.id) } });
        }
        for (const edge of document.edges) {
          const shape = instance.getShape(createShapeId(edge.id));
          if (shape) instance.updateShape({ id: shape.id, type: shape.type, meta: { ...shape.meta, atlasHidden: hidden.has(edge.from) || hidden.has(edge.to) } });
        }
      }
      else if (document?.nodes.length) {
        instance.run(() => {
          for (const node of document.nodes) {
            const place = document.layout.find(item => item.nodeId === node.id);
            instance.createShape({ id: createShapeId(node.id), type: 'geo', x: place?.x ?? 80, y: place?.y ?? 80,
              props: { geo: 'rectangle', w: place?.width ?? 240, h: place?.height ?? 115, color: nodeColor(node.type), font: 'sans', fill: 'semi', dash: 'solid',
                richText: toRichText(`${node.title}\n${node.summary}`) },
              meta: { atlasHidden: isHidden(node, document.nodes) } });
          }
          const hidden = new Set(document.nodes.filter(node => isHidden(node, document.nodes)).map(node => node.id));
          for (const edge of document.edges) drawRelation(instance, edge.id, edge.from, edge.to, hidden.has(edge.from) || hidden.has(edge.to));
        });
        requestAnimationFrame(() => instance.zoomToFit());
      }
      setEditor(instance);
    } catch { setError(t("画布数据无法读取，请先保存原始数据后再继续。")); return; }
    const changes = instance.store.listen(entry => {
      const removed = new Set(Object.keys(entry.changes.removed));
      if (removed.size) {
        const deletedNodes = nodesRef.current.filter(node => removed.has(createShapeId(node.id)));
        const deletedIds = new Set(deletedNodes.map(node => node.id));
        let changed = true;
        while (changed) {
          changed = false;
          for (const node of nodesRef.current) if (node.parentId && deletedIds.has(node.parentId) && !deletedIds.has(node.id)) {
            deletedIds.add(node.id); changed = true;
          }
        }
        if (deletedIds.size) {
          setNodes(current => current.filter(node => !deletedIds.has(node.id)));
          instance.deleteShapes([...deletedIds].map(createShapeId).filter(id => !removed.has(id)));
        }
        const deletedEdges = edgesRef.current.filter(edge => removed.has(createShapeId(edge.id)) || deletedIds.has(edge.from) || deletedIds.has(edge.to));
        if (deletedEdges.length) {
          setEdges(current => current.filter(edge => !deletedEdges.some(item => item.id === edge.id)));
          instance.deleteShapes(deletedEdges.filter(edge => !removed.has(createShapeId(edge.id))).map(edge => createShapeId(edge.id)));
        }
      }
      markDirty();
    }, { source: 'user', scope: 'document' });
    const selection = instance.store.listen(() => {
      const id = [...instance.getSelectedShapeIds()].map(shapeId => shapeId.slice(6)).find(id => nodesRef.current.some(node => node.id === id));
      setSelectedId(id || '');
    }, { source: 'all', scope: 'session' });
    const protect = instance.sideEffects.registerBeforeChangeHandler('shape', (previous, next) => {
      if (previous.type === 'geo' && next.type === 'geo' && !editingNode.current &&
        nodesRef.current.some(node => createShapeId(node.id) === previous.id) &&
        (next.props.richText !== previous.props.richText || next.props.color !== previous.props.color || next.props.geo !== previous.props.geo)) {
        return { ...next, props: { ...next.props, richText: previous.props.richText, color: previous.props.color, geo: previous.props.geo } };
      }
      return next;
    });
    return () => { changes(); selection(); protect(); };
  }

  function syncVisibility(next: AtlasNode[]) {
    if (!editor) return;
    const hidden = new Set(next.filter(node => isHidden(node, next)).map(node => node.id));
    const positions = new Map<string, { x: number; y: number }>();
    let row = 0;
    function place(node: AtlasNode, depth: number): number {
      const children = next.filter(item => item.parentId === node.id && !hidden.has(item.id));
      const childRows = children.map(child => place(child, depth + 1));
      const y = childRows.length ? (childRows[0] + childRows[childRows.length - 1]) / 2 : row++ * 175 + 80;
      positions.set(node.id, { x: 80 + depth * 340, y });
      return y;
    }
    next.filter(node => !node.parentId && !hidden.has(node.id)).forEach(node => { place(node, 0); row++; });
    editor.run(() => {
      for (const node of next) {
        const shape = editor.getShape(createShapeId(node.id));
        if (shape) editor.updateShape({ id: shape.id, type: shape.type, ...positions.get(node.id), meta: { ...shape.meta, atlasHidden: hidden.has(node.id) } });
      }
      for (const edge of edges) {
        const shape = editor.getShape(createShapeId(edge.id));
        if (shape) editor.updateShape({ id: shape.id, type: shape.type, meta: { ...shape.meta, atlasHidden: hidden.has(edge.from) || hidden.has(edge.to) } });
      }
    });
  }

  function focusNode(id: string) {
    if (!editor) return;
    const node = nodes.find(item => item.id === id);
    if (!node) return;
    if (isHidden(node, nodes)) {
      const ancestors = ancestorsOf(node, nodes);
      const next = nodes.map(item => item.collapsed && ancestors.has(item.id) ? { ...item, collapsed: false } : item);
      setNodes(next); syncVisibility(next); markDirty();
    }
    const bounds = editor.getShapePageBounds(createShapeId(id));
    if (bounds) editor.zoomToBounds(bounds, { animation: { duration: 250 }, inset: 120, targetZoom: 1 });
    editor.select(createShapeId(id));
    setSelectedId(id);
  }

  function ancestorsOf(node: AtlasNode, all: AtlasNode[]) {
    const ids = new Set<string>();
    let parentId = node.parentId;
    while (parentId && !ids.has(parentId)) {
      ids.add(parentId);
      parentId = all.find(item => item.id === parentId)?.parentId;
    }
    return ids;
  }

  function addNode(event: React.FormEvent) {
    event.preventDefault();
    if (!editor || !title.trim() || (parentId && !nodes.some(node => node.id === parentId))) return;
    const id = crypto.randomUUID();
    const node: AtlasNode = { id, type, title: title.trim(), summary: summary.trim(), notes: '', ...(parentId ? { parentId } : {}) };
    const parentShape = parentId ? editor.getShape(createShapeId(parentId)) : null;
    const index = nodes.length;
    editor.createShape({ id: createShapeId(id), type: 'geo', x: parentShape ? parentShape.x + 330 : 100 + (index % 4) * 320, y: parentShape ? parentShape.y + nodes.filter(item => item.parentId === parentId).length * 130 : 100 + Math.floor(index / 4) * 190,
      props: { geo: 'rectangle', w: 240, h: 115, color: nodeColor(type), font: 'sans', fill: 'semi', dash: 'solid', richText: toRichText(`${node.title}\n${node.summary}`) } });
    if (parentId) {
      const edge: AtlasEdge = { id: crypto.randomUUID(), from: parentId, to: id, type: 'contains' };
      editor.run(() => drawRelation(editor, edge.id, edge.from, edge.to));
      setEdges(current => [...current, edge]);
      const parent = nodes.find(item => item.id === parentId)!;
      const ancestors = ancestorsOf(parent, nodes);
      ancestors.add(parentId);
      const next = [...nodes.map(item => item.collapsed && ancestors.has(item.id) ? { ...item, collapsed: false } : item), node];
      setNodes(next); syncVisibility(next);
    } else setNodes(current => [...current, node]);
    setTitle(''); setSummary(''); markDirty();
    editor.select(createShapeId(id));
  }

  function editNode(patch: Partial<AtlasNode>) {
    if (!editor || !selected) return;
    const next = { ...selected, ...patch };
    setNodes(current => current.map(node => node.id === selected.id ? next : node));
    editingNode.current = true;
    try { editor.updateShape({ id: createShapeId(selected.id), type: 'geo', props: {
      color: nodeColor(next.type), richText: toRichText(`${next.title}\n${next.summary}`),
    } }); } finally { editingNode.current = false; }
    markDirty();
  }

  function toggleSelected() {
    if (!selected || !children.length) return;
    const next = nodes.map(node => node.id === selected.id ? { ...node, collapsed: !node.collapsed } : node);
    setNodes(next); syncVisibility(next); markDirty();
    requestAnimationFrame(() => editor?.zoomToFit({ animation: { duration: 250 } }));
    if (!selected.collapsed) editor?.selectNone();
  }

  function deleteNode() {
    if (!editor || !selected) return;
    const descendants = new Set([selected.id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const node of nodes) if (node.parentId && descendants.has(node.parentId) && !descendants.has(node.id)) { descendants.add(node.id); changed = true; }
    }
    const related = edges.filter(edge => descendants.has(edge.from) || descendants.has(edge.to));
    editor.deleteShapes([...descendants].map(createShapeId).concat(related.map(edge => createShapeId(edge.id))));
    setNodes(current => current.filter(node => !descendants.has(node.id)));
    setEdges(current => current.filter(edge => !descendants.has(edge.from) && !descendants.has(edge.to)));
    if (descendants.has(parentId)) setParentId('');
    setSelectedId(''); markDirty();
  }

  function connect(event: React.FormEvent) {
    event.preventDefault();
    if (!editor || !from || !to || from === to) return;
    const id = crypto.randomUUID();
    editor.run(() => drawRelation(editor, id, from, to, isHidden(nodes.find(node => node.id === from)!, nodes) || isHidden(nodes.find(node => node.id === to)!, nodes)));
    setEdges(current => [...current, { id, from, to, type: relation }]);
    markDirty();
  }

  async function save() {
    if (!editor || !document || saving) return;
    setSaving(true); setError('');
    const before = changeCount.current;
    const kept = nodes.filter(node => editor.getShape(createShapeId(node.id)));
    if (kept.some(node => !node.title.trim())) { setError(t("节点标题不能为空。")); setSaving(false); return; }
    const ids = new Set(kept.map(node => node.id));
    const keptEdges = edges.filter(edge => ids.has(edge.from) && ids.has(edge.to) && editor.getShape(createShapeId(edge.id)));
    const layout = kept.flatMap(node => {
      const shape = editor.getShape(createShapeId(node.id));
      return shape?.type === 'geo' ? [{ nodeId: node.id, x: shape.x, y: shape.y, width: shape.props.w, height: shape.props.h }] : [];
    });
    try {
      const visibleShapes = [...editor.getCurrentPageShapeIds()].filter(id => !editor.isShapeHidden(id));
      let thumbnail: string | undefined;
      if (visibleShapes.length) {
        try {
          const preview = await editor.toImageDataUrl(visibleShapes, { format: 'png', scale: 0.35, pixelRatio: 1, padding: 16, background: true });
          if (preview.url.length <= 120_000) thumbnail = preview.url;
        } catch { /* A preview failure must not block document saving. */ }
      }
      const saved = await atlasRequest<AtlasDocument>(`/${encodeURIComponent(mapId)}/document`, 'PUT', {
        nodes: kept, edges: keptEdges, layout, canvas: getSnapshot(editor.store).document, revision: document.revision, thumbnail,
      });
      setDocument(saved);
      if (before === changeCount.current) setDirty(false);
    } catch (cause) { setError((cause as Error).message); }
    finally { setSaving(false); }
  }

  if (!map || !document) return <p role={error ? 'alert' : undefined} className="p-6 text-sm text-muted-foreground">{error || t("正在读取 Atlas…")}</p>;

  return <div className="flex h-[calc(100svh-7rem)] min-h-[540px] flex-col">
    <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><div><a href="/console/atlas" className="text-xs text-muted-foreground hover:underline">← Atlas Library</a><h2 role="heading" aria-level={1} className="text-lg font-semibold">{map.title}</h2></div><div className="flex items-center gap-3"><span className="text-xs text-muted-foreground">{saving ? t("保存中…") : dirty ? t("未保存") : t("已保存")}</span><Button size="sm" disabled={!dirty || saving} onClick={() => void save()}>{t("保存画布")}</Button></div></header>
    {error && <p role="alert" className="shrink-0 px-4 py-2 text-sm text-destructive">{t(error)}</p>}
    <div className="flex min-h-0 flex-1 flex-col md:flex-row"><div className="relative h-[380px] shrink-0 overflow-hidden md:h-full md:min-w-0 md:flex-1"><Tldraw onMount={mounted} getShapeVisibility={shapeVisibility} components={canvasComponents} /></div>
      <aside className="max-h-[40vh] w-full shrink-0 space-y-5 overflow-y-auto border-l p-4 text-sm md:max-h-none md:w-72">
        <section className="space-y-2"><h2 className="font-semibold">{t("搜索节点")}</h2><Input aria-label={t("搜索节点")} placeholder={t("标题或说明")} value={search} onChange={event => setSearch(event.target.value)} />{matches.slice(0, 12).map(node => <button key={node.id} type="button" className="block w-full rounded-md border px-3 py-2 text-left hover:bg-muted" onClick={() => focusNode(node.id)}><span className="block truncate font-medium">{node.title}</span><span className="block truncate text-xs text-muted-foreground">{node.summary || node.type}</span></button>)}{search && !matches.length && <p className="text-xs text-muted-foreground">{t("没有匹配节点。")}</p>}</section>
        <form className="space-y-2 border-t pt-4" onSubmit={addNode}><h2 className="font-semibold">{t("新建节点")}</h2><select className={selectClass} aria-label={t("节点类型")} value={type} onChange={event => setType(event.target.value as AtlasNodeType)}>{nodeTypes.map(value => <option key={value} value={value}>{value}</option>)}</select><Input aria-label={t("节点标题")} placeholder={t("标题")} value={title} maxLength={100} onChange={event => setTitle(event.target.value)} required /><Input aria-label={t("节点说明")} placeholder={t("一句话说明")} value={summary} maxLength={300} onChange={event => setSummary(event.target.value)} /><select className={selectClass} aria-label={t("父节点")} value={parentId} onChange={event => setParentId(event.target.value)}><option value="">{t("独立节点")}</option>{nodes.map(node => <option key={node.id} value={node.id}>{t("属于：")}{node.title}</option>)}</select><Button size="sm" disabled={!title.trim()}>{t("添加节点")}</Button></form>
        {selected && <section className="space-y-2 border-t pt-4"><h2 className="font-semibold">{t("编辑节点")}</h2><select className={selectClass} aria-label={t("编辑节点类型")} value={selected.type} onChange={event => editNode({ type: event.target.value as AtlasNodeType })}>{nodeTypes.map(value => <option key={value}>{value}</option>)}</select><Input aria-label={t("编辑节点标题")} value={selected.title} maxLength={100} onChange={event => editNode({ title: event.target.value })} /><Input aria-label={t("编辑节点说明")} value={selected.summary} maxLength={300} onChange={event => editNode({ summary: event.target.value })} /><textarea className="min-h-20 w-full rounded-md border border-input bg-background p-2 text-sm" aria-label={t("节点笔记")} placeholder={t("笔记")} maxLength={2000} value={selected.notes} onChange={event => editNode({ notes: event.target.value })} /><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={() => focusNode(selected.id)}>{t("聚焦")}</Button>{children.length > 0 && <Button variant="outline" size="sm" onClick={toggleSelected}>{selected.collapsed ? t("展开") : t("折叠")} {children.length} {t("个子节点")}</Button>}<Button variant="outline" size="sm" onClick={deleteNode}>{t("删除节点")}</Button></div></section>}
        <form className="space-y-2 border-t pt-4" onSubmit={connect}><h2 className="font-semibold">{t("连接节点")}</h2><select className={selectClass} aria-label={t("起点")} value={from} onChange={event => setFrom(event.target.value)}><option value="">{t("起点")}</option>{nodes.map(node => <option key={node.id} value={node.id}>{node.title}</option>)}</select><select className={selectClass} aria-label={t("终点")} value={to} onChange={event => setTo(event.target.value)}><option value="">{t("终点")}</option>{nodes.map(node => <option key={node.id} value={node.id}>{node.title}</option>)}</select><select className={selectClass} aria-label={t("关系")} value={relation} onChange={event => setRelation(event.target.value as AtlasEdgeType)}>{edgeTypes.map(value => <option key={value}>{value}</option>)}</select><Button size="sm" disabled={!from || !to || from === to}>{t("建立关系")}</Button></form>
        {edges.length > 0 && <section className="space-y-2 border-t pt-4"><h2 className="font-semibold">{t("关系")}</h2>{edges.map(edge => <div key={edge.id} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate">{nodes.find(node => node.id === edge.from)?.title} → {nodes.find(node => node.id === edge.to)?.title} · {edge.type}</span><button type="button" className="text-destructive" aria-label={t("删除关系")} onClick={() => editor?.deleteShape(createShapeId(edge.id))}>{t("删除")}</button></div>)}</section>}
      </aside></div>
  </div>;
}
