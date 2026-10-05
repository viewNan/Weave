import { getMap } from './maps.ts';
import { RecipeError } from '../recipes/domain.ts';
import { edgeTypes, nodeTypes, type AtlasDocument, type AtlasEdge, type AtlasLayout, type AtlasNode } from './model.ts';

type Database = NonNullable<CloudflareEnv['PUSH_SUBSCRIPTIONS_DB']>;
type Row = { nodes_json: string; edges_json: string; layout_json: string; canvas_json: string | null; revision: number };

const empty = (): AtlasDocument => ({ nodes: [], edges: [], layout: [], canvas: null, revision: 0 });

export function parseDocument(value: unknown): AtlasDocument {
  if (!value || typeof value !== 'object') throw new SyntaxError('Atlas 内容无效。');
  const data = value as Record<string, unknown>;
  const { nodes, edges, layout, canvas, revision } = data;
  if (!Array.isArray(nodes) || nodes.length > 500 || !Array.isArray(edges) || edges.length > 1000 ||
    !Array.isArray(layout) || layout.length > 500 || !Number.isSafeInteger(revision) || (revision as number) < 0 ||
    (canvas !== null && (typeof canvas !== 'object' || Array.isArray(canvas)))) throw new SyntaxError('Atlas 内容无效。');
  const ids = new Set<string>();
  for (const value of nodes) {
    const node = value as AtlasNode;
    if (!node || typeof node.id !== 'string' || !node.id || node.id.length > 64 || ids.has(node.id) ||
      !nodeTypes.includes(node.type) || typeof node.title !== 'string' || !node.title.trim() || node.title.length > 100 ||
      typeof node.summary !== 'string' || node.summary.length > 300 || typeof node.notes !== 'string' || node.notes.length > 2000 ||
      (node.parentId !== undefined && typeof node.parentId !== 'string') ||
      (node.collapsed !== undefined && typeof node.collapsed !== 'boolean')) throw new SyntaxError('Atlas 节点无效。');
    ids.add(node.id);
  }
  if (nodes.some((node: AtlasNode) => node.parentId && !ids.has(node.parentId))) throw new SyntaxError('Atlas 父节点无效。');
  for (const node of nodes as AtlasNode[]) {
    const seen = new Set([node.id]);
    let parentId = node.parentId;
    while (parentId) {
      if (seen.has(parentId)) throw new SyntaxError('Atlas 节点层级不能成环。');
      seen.add(parentId);
      parentId = (nodes as AtlasNode[]).find(item => item.id === parentId)?.parentId;
    }
  }
  const edgeIds = new Set<string>();
  for (const value of edges) {
    const edge = value as AtlasEdge;
    if (!edge || typeof edge.id !== 'string' || !edge.id || edge.id.length > 64 || edgeIds.has(edge.id) ||
      !ids.has(edge.from) || !ids.has(edge.to) || !edgeTypes.includes(edge.type) ||
      (edge.label !== undefined && (typeof edge.label !== 'string' || edge.label.length > 100))) throw new SyntaxError('Atlas 关系无效。');
    edgeIds.add(edge.id);
  }
  for (const value of layout) {
    const item = value as AtlasLayout;
    if (!item || !ids.has(item.nodeId) || ![item.x, item.y, item.width, item.height].every(Number.isFinite) ||
      Math.abs(item.x) > 1_000_000 || Math.abs(item.y) > 1_000_000 || item.width <= 0 || item.height <= 0 ||
      item.width > 2000 || item.height > 2000) throw new SyntaxError('Atlas 布局无效。');
  }
  if (JSON.stringify(canvas).length > 1_500_000) throw new SyntaxError('Atlas 画布过大。');
  return data as AtlasDocument;
}

export async function getDocument(db: Database, mapId: string): Promise<AtlasDocument> {
  if (!await getMap(db, mapId)) throw new RecipeError('Atlas 不存在。', 404);
  const row = await db.prepare('SELECT * FROM atlas_documents WHERE map_id=?').bind(mapId).first<Row>();
  return row ? {
    nodes: JSON.parse(row.nodes_json), edges: JSON.parse(row.edges_json), layout: JSON.parse(row.layout_json),
    canvas: row.canvas_json ? JSON.parse(row.canvas_json) : null, revision: row.revision,
  } : empty();
}

export async function saveDocument(db: Database, mapId: string, input: unknown): Promise<AtlasDocument> {
  const document = parseDocument(input);
  const thumbnail = (input as Record<string, unknown>).thumbnail;
  if (thumbnail !== undefined && (typeof thumbnail !== 'string' ||
    (thumbnail !== '' && (!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(thumbnail) || thumbnail.length > 120_000)))) {
    throw new SyntaxError('Atlas 缩略图无效。');
  }
  const current = await getDocument(db, mapId);
  if (current.revision !== document.revision) throw new RecipeError('Atlas 已在别处更新，请刷新后再编辑。', 409);
  const result = await db.prepare(`INSERT INTO atlas_documents (map_id,nodes_json,edges_json,layout_json,canvas_json,revision) VALUES (?,?,?,?,?,?)
    ON CONFLICT(map_id) DO UPDATE SET nodes_json=excluded.nodes_json,edges_json=excluded.edges_json,
      layout_json=excluded.layout_json,canvas_json=excluded.canvas_json,revision=excluded.revision
    WHERE atlas_documents.revision=excluded.revision-1`)
    .bind(mapId, JSON.stringify(document.nodes), JSON.stringify(document.edges), JSON.stringify(document.layout),
      document.canvas ? JSON.stringify(document.canvas) : '', String(document.revision + 1)).run() as { meta?: { changes?: number } };
  if (!result.meta?.changes) throw new RecipeError('Atlas 已在别处更新，请刷新后再编辑。', 409);
  if (typeof thumbnail === 'string') {
    await db.prepare('UPDATE atlas_maps SET updated_at=?, thumbnail=? WHERE id=?')
      .bind(new Date().toISOString(), thumbnail, mapId).run();
  } else {
    await db.prepare('UPDATE atlas_maps SET updated_at=? WHERE id=?')
      .bind(new Date().toISOString(), mapId).run();
  }
  return { ...document, revision: document.revision + 1 };
}
