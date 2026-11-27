'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Circle, Import, Pencil, Plus, RotateCcw, Settings2, Star, Trash2, Triangle, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Card, CardContent } from '../../../components/ui/card';
import { Checkbox } from '../../../components/ui/checkbox';
import { Dialog } from '../../../components/ui/dialog';
import { Input } from '../../../components/ui/input';
import { Textarea } from '../../../components/ui/textarea';
import { useLanguage } from '../../../shared/i18n/LanguageProvider';
import { nextStudyDayDelay, ratingLabels, ratings, statistics, type Attempt, type Dashboard, type PracticeGroup, type PracticeItem, type Rating, type Undo } from '../domain';
import { importInstructions, parseImport, type ImportResult } from '../import-format';

type Filter = 'all' | Rating | 'unrated' | 'unpracticed' | 'starred';
type Preview = ImportResult & { added: number; skipped: number; changed: number; imported: boolean };
type Editor = { id?: string; groupId: string; prompt: string; outline: string; sortOrder: number; starred: boolean; archived: boolean; revision?: number };
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
  const [filter, setFilter] = useState<Filter>('all'), [search, setSearch] = useState(''), [undo, setUndo] = useState<Undo | null>(null);
  const [modal, setModal] = useState<'import' | 'manage' | null>(null), [editor, setEditor] = useState<Editor | null>(null);
  const [historyId, setHistoryId] = useState<string | null>(null), [attempts, setAttempts] = useState<Attempt[] | null>(null);
  const [source, setSource] = useState(''), [preview, setPreview] = useState<Preview | null>(null);
  const [setName, setSetName] = useState(''), [groupName, setGroupName] = useState('');
  const load = useCallback(async (setId = selectedSet.current) => {
    const version = ++loadVersion.current;
    const next = await request<Dashboard>(`${endpoint}${setId ? `?setId=${encodeURIComponent(setId)}` : ''}`);
    if (version !== loadVersion.current) return;
    selectedSet.current = next.setId; setData(next);
    const url = new URL(window.location.href);
    if (next.setId) url.searchParams.set('setId', next.setId); else url.searchParams.delete('setId');
    window.history.replaceState(null, '', url);
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

  async function mutate(body: Record<string, unknown>, options: { setId?: string; close?: boolean; undoing?: boolean } = {}) {
    if (lock.current) return false;
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const result = await request<{ undo?: Undo; id?: string }>(endpoint, body);
      setUndo(options.undoing ? null : result.undo ?? null);
      await load(options.setId ?? (body.action === 'set' ? result.id : undefined));
      if (historyId) await loadHistory(historyId);
      if (options.close) { setEditor(null); setModal(null); }
      setNotice('已保存。'); return true;
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
  const visible = activeItems.filter(item => (!search || `${item.prompt}\n${item.outline}`.toLocaleLowerCase().includes(search.toLocaleLowerCase())) &&
    (filter === 'all' || filter === 'starred' && !!item.starred || filter === 'unpracticed' && !item.today_count || filter === 'unrated' && !item.current_rating || item.current_rating === filter));
  const historyItem = data?.items.find(item => item.id === historyId);
  const parsed = useMemo(() => parseImport(source), [source]);
  const dateTime = (value: string) => new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : 'zh-CN', { timeZone: 'Asia/Tokyo', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
  function record(item: PracticeItem, mode: 'check' | 'rate' | 'again', rating?: Rating) {
    void mutate({ action: 'record', itemId: item.id, revision: item.revision, day: data?.day, id: crypto.randomUUID(), mode, rating });
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

  return <section className="mx-auto w-full max-w-5xl space-y-5 p-4 pb-28 sm:p-6 sm:pb-28">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="m-0 text-2xl font-semibold tracking-tight">{t('练习清单')}</h1><p className="mt-1 text-sm text-muted-foreground">{t('记录每次练习，看见掌握的变化。')}</p></div><div className="flex gap-2">
      <Button variant="outline" className="min-h-11" disabled={busy || !data?.setId} onClick={() => { setModal('import'); setPreview(null); }}><Import size={16}/>{t('导入')}</Button>
      <Button variant="outline" className="min-h-11" disabled={busy || !data} onClick={() => { setSetName(''); setModal('manage'); }}><Settings2 size={16}/>{t('管理')}</Button>
    </div></header>
    {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{t(error)}</div>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{t(notice)}</p>}
    {!data ? <Card><CardContent className="space-y-3 p-5 !pt-5"><p>{t('加载中…')}</p>{error && <Button variant="outline" onClick={() => void load().then(() => setError('')).catch(value => setError(value.message))}>{t('重试')}</Button>}</CardContent></Card> : <>
      {!!data.sets.length && <div className="flex flex-wrap gap-3"><label className="flex min-w-0 flex-1 items-center gap-3 text-sm"><span className="shrink-0">{t('练习集')}</span><select aria-label={t('练习集')} className={`${selectStyle} w-full max-w-md`} value={data.setId} disabled={busy} onChange={event => { setUndo(null); setFilter('all'); setSearch(''); void load(event.target.value).catch(value => setError(value.message)); }}>{data.sets.map(set => <option key={set.id} value={set.id}>{set.name}</option>)}</select></label>
      <Button disabled={busy || !activeGroups.length} className="min-h-11" onClick={() => editItem()}><Plus size={16}/>{t('新增题目')}</Button></div>}
      {!data.sets.length ? <Card><CardContent className="space-y-4 p-6 !pt-6"><h2 className="font-semibold">{t('创建第一个练习集')}</h2><p className="text-sm text-muted-foreground">{t('分类、题目和回答要点都可以自由编辑。')}</p><form className="flex flex-wrap gap-2" onSubmit={async event => { event.preventDefault(); await mutate({ action: 'set', name: setName }); }}><Input className="min-w-0 flex-1" aria-label={t('练习集名称')} placeholder={t('练习集名称')} value={setName} maxLength={100} onChange={event => setSetName(event.target.value)} required/><Button disabled={busy}>{t('创建')}</Button></form></CardContent></Card> : <>
        <Card><CardContent className="space-y-4 p-5 !pt-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0 flex-1"><h2 className="font-medium">{t('今日练习')}</h2><p className="mt-1 text-sm text-muted-foreground">{t('学习日 {0} · 日本时间 04:00 更新', data.day)}</p></div><div className="shrink-0 text-right"><span className="text-2xl font-semibold tabular-nums">{stats.practiced}<span className="text-base font-normal text-muted-foreground"> / {stats.total}</span></span><p className="text-sm text-muted-foreground">{t('今日共 {0} 次', stats.attempts)}</p></div></div>
          <progress aria-label={t('今日进度')} className="h-2 w-full overflow-hidden rounded-full accent-slate-900" max={stats.total || 1} value={stats.practiced}/>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">{ratings.map(value => { const Icon = symbols[value]; return <span key={value} className={`inline-flex items-center gap-1 ${color[value]}`}><Icon size={13}/>{t(ratingLabels[value])} {stats[value]}</span>; })}<span className="text-muted-foreground">{t('未评级')} {stats.unrated}</span></div>
        </CardContent></Card>
        <div className="space-y-3"><Input aria-label={t('搜索题目和要点')} placeholder={t('搜索题目和要点')} value={search} onChange={event => setSearch(event.target.value)}/><div className="flex flex-wrap gap-2" role="group" aria-label={t('筛选')}>
          {([['all', '全部'], ['unpracticed', '今天没练'], ['unknown', '不会'], ['shaky', '卡顿'], ['fluent', '流畅'], ['unrated', '未评级'], ['starred', '星标']] as [Filter, string][]).map(([key, label]) => <Button key={key} size="sm" className="min-h-11" variant={filter === key ? 'secondary' : 'ghost'} aria-pressed={filter === key} onClick={() => setFilter(key)}>{t(label)}</Button>)}
        </div></div>
        {!activeItems.length && <Card><CardContent className="space-y-3 p-6 !pt-6"><p>{t('还没有题目，导入内容即可开始。')}</p><Button onClick={() => setModal('import')}><Import size={16}/>{t('导入')}</Button><p className="text-sm text-muted-foreground">{t('也可以在管理中创建分类，再手动添加题目。')}</p></CardContent></Card>}
        {!!activeItems.length && !visible.length && <p className="py-8 text-center text-muted-foreground">{t('没有符合条件的题目。')}</p>}
        {activeGroups.map(group => { const items = visible.filter(item => item.group_id === group.id); if (!items.length) return null; return <details key={group.id} open className="group rounded-lg border bg-card"><summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 font-semibold"><ChevronDown size={16}/><span className="min-w-0 flex-1 break-words">{group.name}</span><span className="text-sm font-normal text-muted-foreground">{items.length}</span></summary><div className="divide-y border-t">
          {items.map(item => <article key={item.id} className="space-y-3 p-4"><div className="flex items-start gap-2"><label className="flex min-h-11 min-w-11 cursor-pointer items-center justify-center"><Checkbox aria-label={t('今日练过：{0}', item.prompt)} checked={item.today_count > 0} disabled={busy} onChange={() => item.today_count ? openHistory(item.id) : record(item, 'check')}/></label><div className="min-w-0 flex-1"><button type="button" className="min-h-11 w-full whitespace-pre-wrap break-words text-left text-sm font-medium leading-6 hover:underline" onClick={() => openHistory(item.id)}>{item.prompt}</button><p className="text-xs leading-5 text-muted-foreground">{t('今日 {0} 次', item.today_count)} · {item.current_rating ? t('上次评级：{0} · {1}', t(ratingLabels[item.current_rating]), item.last_rated_at ? dateTime(item.last_rated_at) : '') : t('未评级')}</p></div><Button variant="ghost" className="h-11 w-11 shrink-0 p-0" disabled={busy} aria-label={t('星标：{0}', item.prompt)} aria-pressed={!!item.starred} onClick={() => void mutate({ ...itemBody(item), starred: !item.starred })}><Star size={17} className={item.starred ? 'fill-amber-400 text-amber-600' : 'text-muted-foreground'}/></Button></div>
            {!!item.outline && <details className="ml-1 rounded-md bg-muted/40 px-3 py-2"><summary className="cursor-pointer text-sm text-muted-foreground">{t('回答要点')}</summary><div className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{item.outline}</div></details>}
            <div className="flex flex-wrap items-center gap-2"><div className="grid w-full min-w-0 flex-none grid-cols-3 gap-2 sm:w-auto sm:flex-1" role="group" aria-label={t('本次评级：{0}', item.prompt)}>{ratings.map(value => { const Icon = symbols[value]; return <Button key={value} variant={item.latest_rating === value ? 'secondary' : 'outline'} className={`min-h-11 min-w-0 gap-1 whitespace-nowrap px-2 ${color[value]}`} disabled={busy} aria-pressed={item.latest_rating === value} onClick={() => record(item, 'rate', value)}><Icon size={14}/>{t(ratingLabels[value])}</Button>; })}</div>{item.today_count > 0 && <Button variant="outline" className="min-h-11 px-3" disabled={busy} onClick={() => record(item, 'again')}><Plus size={15}/>{t('再练一次')}</Button>}</div>
            {!item.latest_rating && <p className="text-xs text-muted-foreground">{t('本次未评级')}</p>}
          </article>)}
        </div></details>; })}
      </>}
    </>}

    {undo && <div role="status" className="fixed bottom-5 left-4 right-4 z-30 mx-auto flex max-w-md items-center justify-between gap-3 rounded-lg border bg-background p-3 shadow-lg"><span className="text-sm">{t('已记录，可撤销本次操作。')}</span><Button variant="outline" disabled={busy} onClick={() => void mutate({ action: 'attempt', ...undo }, { undoing: true })}><RotateCcw size={15}/>{t('撤销')}</Button></div>}

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
      <div className="flex items-start justify-between gap-3"><h3 className="min-w-0 whitespace-pre-wrap break-words font-medium">{historyItem.prompt}</h3><Button variant="outline" className="shrink-0" disabled={busy} onClick={() => { setHistoryId(null); editItem(historyItem); }}><Pencil size={14}/>{t('编辑')}</Button></div>
      {!!historyItem.outline && <details className="rounded-md border p-3"><summary className="cursor-pointer text-sm">{t('回答要点')}</summary><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{historyItem.outline}</p></details>}
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
