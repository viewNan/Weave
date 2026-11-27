'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Check, ChevronDown, Circle, Download, Import, Pencil, Plus, RotateCcw, Settings2, Shuffle, Star, Trash2, Triangle, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Dialog } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { useLanguage } from '../../../shared/i18n/LanguageProvider';
import { fluentProgress, nextStudyDayDelay, orderedPracticeItems, questionCode, ratingLabels, ratings, refreshPracticeRound, startPracticeRound, statistics, type Attempt, type Dashboard, type PracticeGroup, type PracticeItem, type PracticeRound, type Rating, type Undo } from '../domain';
import { exportMarkdown, type PracticeExportSnapshot } from '../export';
import { importInstructions, parseImport, type ImportResult } from '../import-format';
import { PracticeBank, PracticeRoundView } from './PracticeViews';

type Filter = 'all' | Rating | 'unrated' | 'unpracticed' | 'starred';
type Preview = ImportResult & { added: number; skipped: number; changed: number; imported: boolean };
type Editor = { id?: string; groupId: string; prompt: string; outline: string; sortOrder: number; starred: boolean; archived: boolean; revision?: number };
type UndoState = Undo & { completedBefore: boolean };
const selectStyle = 'h-11 min-w-0 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const symbols = { fluent: Circle, shaky: Triangle, unknown: X };
const color = { fluent: 'text-emerald-700', shaky: 'text-amber-700', unknown: 'text-red-600' };
async function request<T>(url: string, body?: unknown): Promise<T> {
  const response = await fetch(url, { cache: 'no-store', ...(body === undefined ? {} : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }) });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || '操作失败，请重试。');
  return data;
}
const endpoint = '/api/internal/practice';

export default function PracticeWorkspace() {
  const { t, language } = useLanguage();
  const [data, setData] = useState<Dashboard | null>(null), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false), lock = useRef(false), selectedSet = useRef(''), loadVersion = useRef(0);
  const [filter, setFilter] = useState<Filter>('all'), [search, setSearch] = useState(''), [undo, setUndo] = useState<UndoState | null>(null);
  const [round, setRound] = useState<PracticeRound | null>(null), [categoryId, setCategoryId] = useState('');
  const [modal, setModal] = useState<'import' | 'manage' | 'export' | null>(null), [editor, setEditor] = useState<Editor | null>(null);
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current'), [exportText, setExportText] = useState(''), [exportLoading, setExportLoading] = useState(false);
  const [exportSummary, setExportSummary] = useState<{ sets: number; items: number; attempts: number } | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null), [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [outlineId, setOutlineId] = useState<string | null>(null);
  const [source, setSource] = useState(''), [preview, setPreview] = useState<Preview | null>(null);
  const [setName, setSetName] = useState(''), [groupName, setGroupName] = useState('');
  const workspaceRef = useRef<HTMLElement>(null);
  const load = useCallback(async (setId = selectedSet.current) => {
    const version = ++loadVersion.current;
    const next = await request<Dashboard>(`${endpoint}${setId ? `?setId=${encodeURIComponent(setId)}` : ''}`);
    if (version !== loadVersion.current) return;
    selectedSet.current = next.setId; setData(next);
    const groups = new Set(next.groups.filter(group => !group.archived).map(group => group.id));
    setRound(current => current && current.setId === next.setId ? refreshPracticeRound(current, next.items.filter(item => !item.archived && groups.has(item.group_id)), next.setId, next.day) : null);
    const url = new URL(window.location.href);
    if (next.setId) url.searchParams.set('setId', next.setId); else url.searchParams.delete('setId');
    window.history.replaceState(null, '', url);
    return next;
  }, []);
  useEffect(() => {
    selectedSet.current = new URL(window.location.href).searchParams.get('setId') || '';
    void load().catch(value => setError(value.message));
  }, [load]);
  useEffect(() => {
    if (!data) return;
    const refresh = () => { if (!lock.current && document.visibilityState === 'visible') void load().catch(value => setError(value.message)); };
    const timer = setTimeout(refresh, Math.max(100, nextStudyDayDelay()) + 100);
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { clearTimeout(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [data, load]);
  useEffect(() => {
    if (!undo) return;
    const timer = setTimeout(() => setUndo(null), 8000);
    return () => clearTimeout(timer);
  }, [undo]);
  const loadHistory = useCallback(async (id: string) => {
    const result = await request<{ attempts: Attempt[] }>(`${endpoint}?itemId=${encodeURIComponent(id)}`);
    setAttempts(result.attempts);
  }, []);
  useEffect(() => {
    let active = true; setAttempts(null);
    if (historyId) void request<{ attempts: Attempt[] }>(`${endpoint}?itemId=${encodeURIComponent(historyId)}`)
      .then(result => { if (active) setAttempts(result.attempts); })
      .catch(value => { if (active) setError(value.message); });
    return () => { active = false; };
  }, [historyId]);
  useEffect(() => {
    if (modal !== 'export') return;
    let active = true; setExportText(''); setExportSummary(null); setExportLoading(true); setError('');
    void request<PracticeExportSnapshot>(`${endpoint}?export=${exportScope}${exportScope === 'current' ? `&setId=${encodeURIComponent(data?.setId ?? '')}` : ''}`)
      .then(snapshot => { if (active) { setExportText(exportMarkdown(snapshot)); setExportSummary({ sets: snapshot.sets.length, items: snapshot.items.length, attempts: snapshot.attempts.length }); } })
      .catch(value => { if (active) setError(value.message); })
      .finally(() => { if (active) setExportLoading(false); });
    return () => { active = false; };
  }, [modal, exportScope, data?.setId]);

  async function mutate(body: Record<string, unknown>, options: { setId?: string; close?: boolean; undoing?: boolean } = {}) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await request<{ undo?: Undo; id?: string }>(endpoint, body);
      setUndo(options.undoing || !result.undo ? null : { ...result.undo, completedBefore: !!round?.completed.includes(result.undo.itemId) });
      const next = await load(options.setId ?? (body.action === 'set' ? result.id : undefined));
      if (options.undoing) setRound(current => {
        if (!current) return current;
        const completed = current.completed.filter(id => id !== body.itemId);
        if (body.completedBefore === true && typeof body.itemId === 'string') completed.push(body.itemId);
        return { ...current, completed };
      });
      if (historyId) await loadHistory(historyId);
      if (options.close) { setEditor(null); setModal(null); }
      setNotice('已保存。'); return next ?? false;
    } catch (value) {
      setError(value instanceof Error ? value.message : '操作失败，请重试。');
      await load().catch(() => {});
      if (historyId) await loadHistory(historyId).catch(() => {});
      return false;
    } finally { lock.current = false; setBusy(false); }
  }
  const activeGroups = data?.groups.filter(group => !group.archived) ?? [];
  const activeItems = data?.items.filter(item => !item.archived && activeGroups.some(group => group.id === item.group_id)) ?? [];
  const stats = statistics(activeItems);
  const selectedCategory = activeGroups.some(group => group.id === categoryId) ? categoryId : '';
  const contentItems = activeGroups.flatMap(group => activeItems.filter(item => item.group_id === group.id));
  const visible = orderedPracticeItems(contentItems, round).filter(item => (!selectedCategory || item.group_id === selectedCategory) && (!search || `${questionCode(item)}\n${item.prompt}\n${item.outline}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) &&
    (filter === 'all' || filter === 'starred' && !!item.starred || filter === 'unpracticed' && !item.today_count || filter === 'unrated' && !item.current_rating || item.current_rating === filter));
  const historyItem = data?.items.find(item => item.id === historyId);
  const outlineItem = data?.items.find(item => item.id === outlineId);
  const parsed = useMemo(() => parseImport(source), [source]);
  const dateTime = (value: string) => new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  async function record(item: PracticeItem, mode: 'check' | 'rate' | 'again', rating?: Rating) {
    const next = await mutate({ action: 'record', itemId: item.id, revision: item.revision, day: data?.day, id: crypto.randomUUID(), mode, rating });
    if (next && mode === 'rate') {
      setRound(current => current && !current.completed.includes(item.id) ? { ...current, completed: [...current.completed, item.id] } : current);
      const updated = next.items.find(value => value.id === item.id);
      if (updated) setNotice(t('已记录：流畅进度 {0} → {1}。', fluentProgress(item).score, fluentProgress(updated).score));
      if (round) requestAnimationFrame(() => workspaceRef.current?.closest('main')?.scrollTo({ top: 0 }));
    }
    return next;
  }
  function editItem(item?: PracticeItem, groupId = activeGroups[0]?.id ?? '') {
    setEditor(item ? { id: item.id, groupId: item.group_id, prompt: item.prompt, outline: item.outline, sortOrder: item.sort_order, starred: !!item.starred, archived: !!item.archived, revision: item.revision }
      : { groupId, prompt: '', outline: '', sortOrder: 0, starred: false, archived: false });
  }
  function itemBody(item: PracticeItem) { return { action: 'item', id: item.id, groupId: item.group_id, prompt: item.prompt, outline: item.outline, sortOrder: item.sort_order, revision: item.revision, starred: !!item.starred, archived: !!item.archived }; }
  function openHistory(id: string) { setHistoryId(id); }
  async function previewImport() {
    if (lock.current || !data) return;
    lock.current = true; setBusy(true); setError('');
    try { setPreview(await request<Preview>(endpoint, { action: 'import', setId: data.setId, source, preview: true })); }
    catch (value) { setError(value instanceof Error ? value.message : '操作失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }
  async function importContent() {
    if (lock.current || !data) return;
    lock.current = true; setBusy(true); setError(''); setUndo(null);
    try {
      const result = await request<Preview>(endpoint, { action: 'import', setId: data.setId, source });
      if (result.errors.length) { setPreview(result); return; }
      await load(); setModal(null); setSource(''); setPreview(null);
      setNotice(t('导入完成：新增 {0} 道，跳过 {1} 道。', result.added, result.skipped));
    } catch (value) { setError(value instanceof Error ? value.message : '操作失败，请重试。'); }
    finally { lock.current = false; setBusy(false); }
  }
  const dialog = (title: string, onClose: () => void, children: React.ReactNode) => <Dialog title={title} closeLabel={t('关闭')} onClose={() => { if (!busy) onClose(); }}>{error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{t(error)}</p>}{notice === '已复制。' && <p role="status" className="text-sm text-muted-foreground">{t(notice)}</p>}{children}</Dialog>;

  const actions = { busy, onRecord: record, onHistory: openHistory, onOutline: setOutlineId, onStar: (item: PracticeItem) => { void mutate({ ...itemBody(item), starred: !item.starred }); } };
  function startRound() {
    if (!data) return;
    setRound(startPracticeRound(activeItems, data.setId, data.day));
    setNotice('');
    requestAnimationFrame(() => workspaceRef.current?.closest('main')?.scrollTo({ top: 0 }));
  }
  function leaveRound() {
    setRound(null); setNotice('');
    requestAnimationFrame(() => workspaceRef.current?.closest('main')?.scrollTo({ top: 0 }));
  }
  function downloadExport() {
    const url = URL.createObjectURL(new Blob(['\uFEFF', exportText], { type: 'text/markdown;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = `weave-practice-${exportScope}-${new Date().toISOString().slice(0, 10)}.md`;
    document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section ref={workspaceRef} className="mx-auto w-full max-w-6xl space-y-4 p-4 pb-24 sm:p-6 sm:pb-24">
    <header className="flex items-center justify-between gap-3"><div className="min-w-0"><h1 className="m-0 text-xl font-semibold tracking-tight sm:text-2xl">{t(round ? '练习模式' : '练习清单')}</h1><p className="mt-1 hidden text-sm text-muted-foreground sm:block">{round ? data?.sets.find(set => set.id === data.setId)?.name : t('记录每次练习，看见掌握的变化。')}</p></div><div className="flex shrink-0 gap-2">
      {round ? <><Button variant="outline" className="h-11 px-3" disabled={busy} onClick={startRound}><Shuffle size={15}/>{t('换一轮')}</Button><Button variant="ghost" className="h-11 px-3" aria-label={t('返回题库')} title={t('返回题库')} disabled={busy} onClick={leaveRound}><ArrowLeft size={16}/><span className="hidden sm:inline">{t('返回题库')}</span></Button></> : <><Button variant="outline" className="h-11 px-3" disabled={busy || !data?.setId} onClick={() => { setModal('import'); setPreview(null); }}><Import size={15}/>{t('导入')}</Button><Button variant="outline" className="h-11 px-3" aria-label={t('导出')} title={t('导出')} disabled={busy || !data?.setId} onClick={() => { setNotice(''); setModal('export'); }}><Download size={15}/><span className="hidden sm:inline">{t('导出')}</span></Button><Button variant="ghost" className="h-11 px-3" disabled={busy || !data} onClick={() => { setSetName(''); setModal('manage'); }}><Settings2 size={15}/><span className="hidden sm:inline">{t('管理')}</span><span className="sr-only sm:hidden">{t('管理')}</span></Button></>}
    </div></header>
    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{t(error)}</div>}
    {notice && <p role="status" className="text-xs text-muted-foreground">{t(notice)}</p>}
    {!data ? <Card><CardContent className="space-y-3 p-5 !pt-5"><p>{t('加载中…')}</p>{error && <Button variant="outline" onClick={() => void load().then(() => setError('')).catch(value => setError(value.message))}>{t('重试')}</Button>}</CardContent></Card> : !data.sets.length ?
      <Card><CardContent className="space-y-4 p-6 !pt-6"><h2 className="font-semibold">{t('创建第一个练习集')}</h2><p className="text-sm text-muted-foreground">{t('分类、题目和回答要点都可以自由编辑。')}</p><form className="flex gap-2" onSubmit={async event => { event.preventDefault(); await mutate({ action: 'set', name: setName }); }}><Input className="min-w-0 flex-1" aria-label={t('练习集名称')} placeholder={t('练习集名称')} value={setName} maxLength={100} onChange={event => setSetName(event.target.value)} required/><Button disabled={busy}>{t('创建')}</Button></form></CardContent></Card> : round ?
      <PracticeRoundView key={round.order.join('|')} items={orderedPracticeItems(contentItems, round)} groups={activeGroups} round={round} onNewRound={startRound} {...actions}/> : <>
      <div className="flex gap-2"><select aria-label={t('练习集')} className={`${selectStyle} min-w-0 flex-1 sm:max-w-md`} value={data.setId} disabled={busy} onChange={event => { setUndo(null); setFilter('all'); setSearch(''); setCategoryId(''); void load(event.target.value).catch(value => setError(value.message)); }}>{data.sets.map(set => <option key={set.id} value={set.id}>{set.name}</option>)}</select><Button variant="outline" aria-label={t('新增题目')} className="h-11 px-3" disabled={busy || !activeGroups.length} onClick={() => editItem()}><Plus size={16}/><span className="hidden sm:inline">{t('新增题目')}</span></Button></div>
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-card px-4 py-3 text-sm"><div className="flex items-center gap-3"><span className="font-medium">{t('今日练习')} <span className="tabular-nums">{stats.practiced}/{stats.total}</span></span><span className="text-xs text-muted-foreground">{t('今日共 {0} 次', stats.attempts)}</span></div><span className="hidden text-xs text-muted-foreground sm:inline">{t('学习日 {0} · 日本时间 04:00 更新', data.day)}</span></div>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-[minmax(0,1fr)_10rem_8rem_auto]"><Input className="col-span-2 h-11 lg:col-span-1" aria-label={t('搜索编号、题目或要点')} placeholder={t('搜索编号、题目或要点')} value={search} onChange={event => setSearch(event.target.value)}/><select aria-label={t('筛选大分类')} className={selectStyle} value={selectedCategory} onChange={event => setCategoryId(event.target.value)}><option value="">{t('全部分类')}</option>{activeGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select><select aria-label={t('筛选')} className={selectStyle} value={filter} onChange={event => setFilter(event.target.value as Filter)}>{([['all', '全部'], ['unpracticed', '今天没练'], ['unknown', '不会'], ['shaky', '卡顿'], ['fluent', '流畅'], ['unrated', '未评级'], ['starred', '星标']] as [Filter, string][]).map(([key, label]) => <option key={key} value={key}>{t(label)}</option>)}</select><Button className="col-span-2 h-11 lg:col-span-1" disabled={busy || !visible.length} onClick={startRound}><Shuffle size={16}/>{t('开始练习')}</Button></div>
      {!activeItems.length ? <div className="space-y-3 rounded-lg border p-6 text-center"><p className="text-sm text-muted-foreground">{t('还没有题目，导入内容即可开始。')}</p><Button onClick={() => setModal('import')}><Import size={15}/>{t('导入')}</Button></div> : !visible.length ? <p className="py-8 text-center text-sm text-muted-foreground">{t('没有符合条件的题目。')}</p> : <PracticeBank items={visible} groups={activeGroups} {...actions}/>}
    </>}

    {undo && <div role="status" className="fixed bottom-5 left-4 right-4 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border bg-background p-3 shadow-lg"><span className="text-sm">{t('已记录，可撤销本次操作。')}</span><Button variant="outline" disabled={busy} onClick={() => void mutate({ action: 'attempt', ...undo }, { undoing: true })}><RotateCcw size={15}/>{t('撤销')}</Button></div>}

    {outlineItem && <Dialog title={t('回答要点')} closeLabel={t('关闭')} size="sm" onClose={() => setOutlineId(null)}><p className="font-mono text-xs text-muted-foreground">{questionCode(outlineItem)}</p><h3 className="whitespace-pre-wrap break-words text-sm font-medium leading-6">{outlineItem.prompt}</h3><div className="whitespace-pre-wrap break-words border-t pt-4 text-sm leading-7">{outlineItem.outline}</div></Dialog>}

    {modal === 'export' && dialog(t('导出题库与练习数据'), () => setModal(null), <>
      <label className="block space-y-2 text-sm"><span>{t('导出范围')}</span><select className={`${selectStyle} w-full`} value={exportScope} onChange={event => setExportScope(event.target.value as 'current' | 'all')}><option value="current">{t('当前题库（含归档与全部历史）')}</option><option value="all">{t('全部题库（含归档与全部历史）')}</option></select></label>
      <p className="text-xs leading-5 text-muted-foreground">{t('固定编号便于 AI 对应题目。导出包含要点、统计、逐次评级与备注，以及已删除记录的标记。')}</p>
      {exportSummary && <p className="text-sm">{t('已汇总 {0} 个题库、{1} 道题、{2} 条记录。', exportSummary.sets, exportSummary.items, exportSummary.attempts)}</p>}
      <label className="block space-y-2 text-sm"><span>{t('可复制的 Markdown 文本')}</span><Textarea readOnly className="h-[42dvh] min-h-48 font-mono text-xs" value={exportText} placeholder={exportLoading ? t('正在汇总数据…') : ''}/></label>
      <p className="text-xs text-muted-foreground">{t('本文件供阅读和 AI 整理使用，不能直接导入以恢复全部历史。')}</p>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={exportLoading || !exportText} onClick={() => { void navigator.clipboard.writeText(exportText).then(() => setNotice('已复制。')).catch(() => setError('复制失败，请手动选择文本。')); }}>{t('复制全部')}</Button><Button disabled={exportLoading || !exportText} onClick={downloadExport}><Download size={15}/>{t('下载 Markdown')}</Button></div>
    </>)}

    {modal === 'import' && data && dialog(t('导入练习内容'), () => setModal(null), <>
      <p className="text-sm text-muted-foreground">{t('只导入大分类、题目和整块回答要点，不改变练习历史。')}</p>
      <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">{t('导入规则 / 给 AI 的整理指令')}</summary><pre className="mt-3 whitespace-pre-wrap break-words text-xs leading-6">{language === 'en' ? importInstructionsEnglish : importInstructions}</pre><Button className="mt-3" variant="outline" onClick={() => { void navigator.clipboard.writeText(language === 'en' ? importInstructionsEnglish : importInstructions).then(() => setNotice('已复制。')).catch(() => setError('复制失败，请手动选择文本。')); }}>{t('复制指令')}</Button></details>
      <label className="block space-y-2 text-sm"><span>{t('粘贴导入文本')}</span><Textarea className="min-h-64 font-mono text-sm" disabled={busy} value={source} onChange={event => { setSource(event.target.value); setPreview(null); }} placeholder={'# …\nQ: …\nA:\n…'}/></label>
      {source.trim() && <p className="text-sm">{t('识别到 {0} 个分类、{1} 道题。', parsed.groups.length, parsed.count)}</p>}
      {(preview?.errors ?? parsed.errors).length > 0 && source.trim() && <ul role="alert" className="space-y-1 text-sm text-destructive">{(preview?.errors ?? parsed.errors).map((error, index) => <li key={index}>{t('第 {0} 行：{1}', error.line, t(error.message))}</li>)}</ul>}
      {preview && !preview.errors.length && <p className="text-sm">{t('预计新增 {0} 道，跳过 {1} 道。', preview.added, preview.skipped)}{preview.changed > 0 && ` ${t('{0} 道重复题要点不同，将保留原内容。', preview.changed)}`}</p>}
      {!!source.trim() && !parsed.errors.length && <details className="max-h-48 overflow-y-auto rounded-md border p-3"><summary className="cursor-pointer text-sm">{t('内容预览')}</summary>{parsed.groups.map(group => <div key={group.name} className="mt-3 space-y-2"><h3 className="font-medium">{group.name}</h3>{group.items.map(item => <div key={item.line} className="border-l pl-3 text-sm"><p className="whitespace-pre-wrap break-words">{item.prompt}</p>{item.outline && <p className="mt-1 whitespace-pre-wrap break-words text-muted-foreground">{item.outline}</p>}</div>)}</div>)}</details>}
      <p className="text-xs text-muted-foreground">{t('同分类重复题会跳过，原要点与历史保留。已归档分类需先明确恢复。')}</p>
      <div className="flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={busy || !source.trim() || !!parsed.errors.length} onClick={() => void previewImport()}>{t('检查重复')}</Button><Button disabled={busy || !source.trim() || !!parsed.errors.length || !!preview?.errors.length} onClick={() => void importContent()}><Import size={15}/>{busy ? t('保存中…') : t('导入')}</Button></div>
    </>)}

    {editor && data && dialog(t(editor.id ? '编辑题目' : '新增题目'), () => setEditor(null), <form className="space-y-4" onSubmit={event => { event.preventDefault(); void mutate({ action: 'item', ...editor }, { close: true }); }}>
      <label className="block space-y-2 text-sm"><span>{t('大分类')}</span><select required className={`${selectStyle} w-full`} value={editor.groupId} onChange={event => setEditor({ ...editor, groupId: event.target.value })}>{activeGroups.map(group => <option key={group.id} value={group.id}>{group.name}</option>)}</select></label>
      <label className="block space-y-2 text-sm"><span>{t('题目')}</span><Textarea required maxLength={4000} value={editor.prompt} onChange={event => setEditor({ ...editor, prompt: event.target.value })}/></label>
      <label className="block space-y-2 text-sm"><span>{t('回答要点（可选）')}</span><Textarea className="min-h-48" maxLength={200000} value={editor.outline} onChange={event => setEditor({ ...editor, outline: event.target.value })}/></label>
      {editor.id && <label className="block space-y-2 text-sm"><span>{t('排序（数字越小越靠前）')}</span><Input type="number" min={0} step={1} required value={editor.sortOrder} onChange={event => setEditor({ ...editor, sortOrder: Number(event.target.value) })}/></label>}
      <div className="flex justify-end"><Button disabled={busy}>{busy ? t('保存中…') : t('保存')}</Button></div>
    </form>)}

    {historyItem && dialog(t('练习详情'), () => setHistoryId(null), <>
      <p className="font-mono text-xs text-muted-foreground">{questionCode(historyItem)}</p>
      <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 whitespace-pre-wrap break-words font-medium">{historyItem.prompt}</h3><Button variant="outline" className="shrink-0" disabled={busy} onClick={() => { setHistoryId(null); editItem(historyItem); }}><Pencil size={14}/>{t('编辑')}</Button></div>
      {!!historyItem.outline && <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm">{t('回答要点')}</summary><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{historyItem.outline}</p></details>}
      <PracticeProgress item={historyItem} expanded/>
      <p className="text-sm text-muted-foreground">{t('按次保留记录。取消今日勾选时，请在这里选择具体记录删除。')}</p>
      {attempts === null ? <p>{t('加载中…')}</p> : !attempts.length ? <p className="text-sm text-muted-foreground">{t('还没有练习记录。')}</p> : attempts.map(attempt => <AttemptRow key={attempt.id} attempt={attempt} busy={busy} date={dateTime(attempt.created_at)} onSave={changes => void mutate({ action: 'attempt', itemId: historyItem.id, attemptId: attempt.id, revision: historyItem.revision, ...changes })}/>)}
    </>)}

    {modal === 'manage' && data && dialog(t('管理练习内容'), () => setModal(null), <>
      <form className="space-y-2" onSubmit={async event => { event.preventDefault(); if (await mutate({ action: 'set', name: setName })) setSetName(''); }}><label htmlFor="new-practice-set" className="text-sm font-medium">{t('新增练习集')}</label><div className="flex gap-2"><Input id="new-practice-set" value={setName} required maxLength={100} onChange={event => setSetName(event.target.value)}/><Button disabled={busy}><Plus size={16}/>{t('创建')}</Button></div></form>
      {data.setId && <>
        <NameForm key={data.setId} label={t('重命名当前练习集')} initial={data.sets.find(set => set.id === data.setId)?.name ?? ''} busy={busy} onSave={name => void mutate({ action: 'set', id: data.setId, name })}/>
        <form className="space-y-2 border-t pt-4" onSubmit={async event => { event.preventDefault(); if (await mutate({ action: 'group', setId: data.setId, name: groupName })) setGroupName(''); }}><label htmlFor="new-practice-group" className="text-sm font-medium">{t('新增大分类')}</label><div className="flex gap-2"><Input id="new-practice-group" required maxLength={100} value={groupName} onChange={event => setGroupName(event.target.value)}/><Button disabled={busy}><Plus size={16}/>{t('创建')}</Button></div></form>
        {data.groups.map(group => <GroupEditor key={`${group.id}-${group.name}-${group.sort_order}-${group.archived}`} group={group} busy={busy} onSave={changes => void mutate({ action: 'group', id: group.id, name: group.name, archived: !!group.archived, ...changes })}/>)}
        <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm font-medium">{t('题目管理（含归档）')}</summary><div className="mt-3 divide-y">{data.items.map(item => <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div className="min-w-0 flex-1"><p className="whitespace-pre-wrap break-words text-sm">{item.prompt}</p><p className="text-xs text-muted-foreground">{data.groups.find(group => group.id === item.group_id)?.name} · {item.archived ? t('已归档') : t('使用中')}</p></div><div className="flex gap-1"><Button variant="ghost" className="min-h-11" disabled={busy || !!data.groups.find(group => group.id === item.group_id)?.archived} onClick={() => { setModal(null); editItem(item); }}>{t('编辑')}</Button><Button variant="outline" className="min-h-11" disabled={busy || !!data.groups.find(group => group.id === item.group_id)?.archived} onClick={() => { if (item.archived || window.confirm(t('归档题目？练习历史会保留。'))) void mutate({ ...itemBody(item), archived: !item.archived }); }}>{t(item.archived ? '恢复' : '归档')}</Button></div></div>)}</div></details>
      </>}
    </>)}
  </section>;
}

function PracticeProgress({ item, expanded = false }: { item: PracticeItem; expanded?: boolean }) {
  const { t } = useLanguage(), progress = fluentProgress(item);
  const unrated = item.total_count - item.fluent_count - item.shaky_count - item.unknown_count;
  return <div className="space-y-2 rounded-md border bg-muted/20 p-3"><div className="flex flex-wrap items-center justify-between gap-2 text-sm"><span>{t('流畅进度')} <strong className="tabular-nums">{progress.score} / 100</strong></span>{progress.status !== 'learning' && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{progress.status === 'passed' ? <Check size={14}/> : <RotateCcw size={14}/>} {t(progress.status === 'passed' ? '目标达成' : '待复习')}</span>}</div>
    <div role="progressbar" aria-label={t('流畅进度')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.score} className="h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${progress.score}%` }}/></div>
    <p className="text-xs leading-5 text-muted-foreground">{progress.remaining ? t('再获得 {0} 次流畅记录，即可达到 100 分。', progress.remaining) : progress.status === 'review' ? t('积分保留，建议再练一次。') : t('已达成练习目标，仍可继续复习。')}</p>
    <details open={expanded}><summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground"><ChevronDown size={13}/>{t('已练 {0} 次 · 查看次数', item.total_count)}</summary><div className="flex flex-wrap gap-x-4 gap-y-2 pb-1 text-xs">{ratings.map(value => { const Icon = symbols[value]; return <span key={value} className={`inline-flex items-center gap-1 ${color[value]}`}><Icon size={12}/>{t(ratingLabels[value])} {item[`${value}_count`]}</span>; })}{unrated > 0 && <span className="text-muted-foreground">{t('未评级')} {unrated}</span>}</div></details>
  </div>;
}

function AttemptRow({ attempt, busy, date, onSave }: { attempt: Attempt; busy: boolean; date: string; onSave: (changes: Record<string, unknown>) => void }) {
  const { t } = useLanguage();
  const [note, setNote] = useState(attempt.note);
  useEffect(() => { setNote(attempt.note); }, [attempt.note]);
  return <div className={`space-y-3 rounded-md border p-3 ${attempt.deleted ? 'bg-muted/40' : ''}`}><div className="flex flex-wrap items-center justify-between gap-2"><div className="text-sm"><span className="font-medium">{date} JST</span><p className="text-xs text-muted-foreground">{t('学习日 {0}', attempt.study_day)} · {attempt.rating ? t(ratingLabels[attempt.rating]) : t('未评级')}{!!attempt.deleted && ` · ${t('已删除')}`}</p></div><Button className="min-h-11" variant="ghost" disabled={busy} onClick={() => { if (attempt.deleted || window.confirm(t('删除这一条练习记录？其他记录会保留。'))) onSave({ deleted: attempt.deleted ? 0 : 1 }); }}>{attempt.deleted ? <RotateCcw size={15}/> : <Trash2 size={15}/>} {t(attempt.deleted ? '恢复' : '删除')}</Button></div>
    {!attempt.deleted && <><label className="block space-y-2 text-sm"><span>{t('练习备注（可选）')}</span><Textarea disabled={busy} maxLength={20000} value={note} onChange={event => setNote(event.target.value)}/></label><Button variant="outline" disabled={busy || note === attempt.note} onClick={() => onSave({ note })}>{t('保存备注')}</Button></>}
  </div>;
}
function NameForm({ label, initial, busy, onSave }: { label: string; initial: string; busy: boolean; onSave: (name: string) => void }) {
  const { t } = useLanguage(); const [name, setName] = useState(initial);
  return <form className="space-y-2" onSubmit={event => { event.preventDefault(); onSave(name); }}><label className="block space-y-2 text-sm"><span>{label}</span><Input value={name} required maxLength={100} onChange={event => setName(event.target.value)}/></label><Button variant="outline" disabled={busy || name === initial}>{t('保存名称')}</Button></form>;
}
function GroupEditor({ group, busy, onSave }: { group: PracticeGroup; busy: boolean; onSave: (changes: Record<string, unknown>) => void }) {
  const { t } = useLanguage(); const [name, setName] = useState(group.name), [sortOrder, setSortOrder] = useState(group.sort_order);
  return <form className="space-y-3 rounded-md border p-3" onSubmit={event => { event.preventDefault(); onSave({ name, sortOrder }); }}><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">{group.name} {group.archived ? `· ${t('已归档')}` : ''}</p><Button type="button" variant="ghost" disabled={busy} onClick={() => { if (group.archived || window.confirm(t('归档分类？题目和历史会保留。'))) onSave({ archived: !group.archived }); }}>{t(group.archived ? '恢复' : '归档')}</Button></div><div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-2"><label className="space-y-1 text-sm"><span>{t('分类名称')}</span><Input required maxLength={100} value={name} onChange={event => setName(event.target.value)}/></label><label className="space-y-1 text-sm"><span>{t('排序')}</span><Input type="number" min={0} step={1} required value={sortOrder} onChange={event => setSortOrder(Number(event.target.value))}/></label></div><Button variant="outline" disabled={busy || name === group.name && sortOrder === group.sort_order}>{t('保存')}</Button></form>;
}
const importInstructionsEnglish = `Convert the supplied material to Weave import text. Output only this format:
# Category name
Q: Question
A:
The complete answer outline. Preserve paragraphs, blank lines and lists.

Use ASCII markers: # plus a space for each category, Q: for each question, and A: on its own line to start the outline. A: is optional. All following text belongs to that outline until the next category or question. Questions may also span multiple lines.
If a content line begins with #, Q:, A:, or three backticks, prefix it with a backslash; importing removes the backslash.
Do not add extra fields, explanations, or invented personal facts.`;
