'use client';
import { useLanguage } from '../../shared/i18n/LanguageProvider';

import { useEffect, useMemo, useState } from 'react';
import { Map, Plus, Search, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import type { AtlasMap } from './maps';
import { atlasRequest } from './client';
import { atlasExamples, exampleThumbnail } from './examples';
import type { AtlasDocument } from './model';

export default function AtlasLibrary() {
  const { t } = useLanguage();

  const [maps, setMaps] = useState<AtlasMap[]>([]);
  const [query, setQuery] = useState('');
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [tags, setTags] = useState('');
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    atlasRequest<AtlasMap[]>().then(setMaps).catch(error => setError(error.message)).finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => maps.filter(map =>
    `${map.title} ${map.summary} ${map.tags.join(' ')}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())), [maps, query]);

  async function create(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const map = await atlasRequest<AtlasMap>('', 'POST', {
        title, summary, tags: tags.split(',').map(tag => tag.trim()).filter(Boolean),
      });
      setMaps(current => [map, ...current]);
      setTitle(''); setSummary(''); setTags(''); setCreating(false);
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  async function remove(map: AtlasMap) {
    if (!confirm(t("删除「{0}」？", map.title))) return;
    setBusy(true); setError('');
    try {
      await atlasRequest(`/${encodeURIComponent(map.id)}`, 'DELETE');
      setMaps(current => current.filter(item => item.id !== map.id));
    } catch (error) { setError((error as Error).message); }
    finally { setBusy(false); }
  }

  async function addExamples() {
    setBusy(true); setError('');
    try {
      for (const item of atlasExamples) {
        if (maps.some(map => map.title === item.title)) continue;
        const map = await atlasRequest<AtlasMap>('', 'POST', { title: item.title, summary: item.summary, tags: item.tags });
        try {
          await atlasRequest<AtlasDocument>(`/${encodeURIComponent(map.id)}/document`, 'PUT',
            { ...item.document, thumbnail: exampleThumbnail(item.document) });
        } catch (cause) {
          await atlasRequest(`/${encodeURIComponent(map.id)}`, 'DELETE');
          throw cause;
        }
        setMaps(current => [{ ...map, thumbnail: exampleThumbnail(item.document) }, ...current]);
      }
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return <div className="mx-auto w-full max-w-6xl space-y-6 p-6 md:p-10">
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">Atlas</h1><p className="mt-2 text-muted-foreground">{t("收藏 Weave 中值得长期记住的设计地图。")}</p></div><div className="flex gap-2"><Button variant="outline" disabled={busy || atlasExamples.every(item => maps.some(map => map.title === item.title))} onClick={() => void addExamples()}>{t("添加示例图")}</Button><Button onClick={() => setCreating(value => !value)}><Plus size={16} /> {t("新建 Atlas")}</Button></div></header>
    {creating && <Card><CardHeader><CardTitle className="text-lg">{t("新建设计图")}</CardTitle><CardDescription>{t("给这张图一个清楚的主题。")}</CardDescription></CardHeader><CardContent><form className="grid gap-3" onSubmit={event => void create(event)}><label className="text-sm" htmlFor="atlas-title">{t("标题")}</label><Input id="atlas-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={100} required /><label className="text-sm" htmlFor="atlas-summary">{t("一句话说明")}</label><Input id="atlas-summary" value={summary} onChange={event => setSummary(event.target.value)} maxLength={300} /><label className="text-sm" htmlFor="atlas-tags">{t("标签（用逗号分隔）")}</label><Input id="atlas-tags" value={tags} onChange={event => setTags(event.target.value)} placeholder="Architecture, Agent" /><div><Button disabled={busy || !title.trim()}>{busy ? t("正在保存…") : t("创建")}</Button></div></form></CardContent></Card>}
    <div className="relative max-w-sm"><Search className="absolute left-3 top-3 text-muted-foreground" size={16}/><Input className="pl-9" placeholder={t("搜索标题、说明或标签")} value={query} onChange={event => setQuery(event.target.value)} /></div>
    {error && <p role="alert" className="text-sm text-destructive">{t(error)}</p>}
    {loading ? <p className="text-sm text-muted-foreground">{t("正在读取 Atlas…")}</p> : filtered.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{filtered.map(map => <Card key={map.id} className="overflow-hidden"><div className="flex h-36 items-center justify-center bg-muted text-muted-foreground">{map.thumbnail ? <img src={map.thumbnail} alt="" className="h-full w-full object-cover" /> : <Map size={40} strokeWidth={1.2} />}</div><CardHeader><a href={`/console/atlas/${map.id}`} className="hover:underline"><CardTitle className="text-lg">{map.title}</CardTitle></a><CardDescription>{map.summary || t("暂无说明")}</CardDescription></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-1">{map.tags.map(tag => <span key={tag} className="rounded-full bg-secondary px-2 py-1 text-xs">{tag}</span>)}</div><div className="flex items-center justify-between gap-3 text-xs text-muted-foreground"><time dateTime={map.updatedAt}>{t("更新于")} {new Date(map.updatedAt).toLocaleDateString('zh-CN')}</time><Button variant="ghost" size="icon" aria-label={t("删除 {0}", map.title)} disabled={busy} onClick={() => void remove(map)}><Trash2 size={16}/></Button></div></CardContent></Card>)}</div> : <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{query ? t("没有匹配的设计图。") : t("还没有设计图。创建一张 Atlas 开始整理。")}</CardContent></Card>}
  </div>;
}
