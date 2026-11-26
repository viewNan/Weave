'use client';
import { useLanguage } from '../../../shared/i18n/LanguageProvider';

import { ChevronRight, Clock3, LoaderCircle, Radio, RefreshCw, Save, Send, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Textarea } from '../../../components/ui/textarea';
import { todayJst } from '../server/jst-date';

const headers = { 'content-type': 'application/json', 'x-weave-client': 'admin' };
type Brief = { date:string; title:string; speechText:string; items?:Array<{category?:string;eventKey:string;headline:string;summary:string;updateType:string;sourceUrls?:string[]}>; pushStatus:string; pushAccepted:number; pushRejected:number; generatedAt:string; manuallyEditedAt:string|null };
const pushLabel = (brief: Brief | null) => !brief ? '等待生成' : ({ pending:'待推送', sent:'已推送', partial:'部分送达', failed:'推送失败' }[brief.pushStatus] || '待推送');

export default function MorningBriefManager() {
  const { t } = useLanguage();

  const [brief, setBrief] = useState<Brief | null>(null); const [history, setHistory] = useState<Brief[]>([]); const [status, setStatus] = useState(''); const [text, setText] = useState(''); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false); const [pushing, setPushing] = useState(false);
  const [regenerateOpen,setRegenerateOpen]=useState(false),[instructions,setInstructions]=useState(''),[regenerating,setRegenerating]=useState(false),[regenerateError,setRegenerateError]=useState('');
  const busy=loading||saving||pushing||regenerating;
  const dirty = Boolean(brief && text !== brief.speechText); const topics = brief?.items || []; const currentDate = brief?.date || history[0]?.date || '—';
  const summary = useMemo(() => brief?.manuallyEditedAt ? t("已保存") : dirty ? t("有未保存修改") : brief ? t("生成于 {0}", brief.generatedAt.slice(11, 16)) : '', [brief, dirty]);
  function openBrief(next: Brief) { setBrief(next); setText(next.speechText); setStatus(t("{0} 的晨报已打开。", next.date)); }
  async function refresh() { const response = await fetch('/api/internal/morning-brief/history?limit=7', { headers }); if (!response.ok) throw new Error(t("晨报记录加载失败。")); const saved = (await response.json()).briefs as Brief[]; setHistory(saved); if (saved[0]) { setBrief(current => current || saved[0]); setText(current => current || saved[0].speechText); } }
  useEffect(() => { refresh().catch(error => setStatus(error instanceof Error ? error.message : t("页面数据加载失败。"))); }, []);
  async function regenerate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setRegenerating(true);setRegenerateError('');setStatus(t("正在根据补充提示重新生成今日播报…"));
    try {
      const response=await fetch('/api/internal/morning-brief/regenerate',{method:'POST',headers,body:JSON.stringify({instructions:instructions.trim()})});
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||t("重新生成失败，原稿已保留。"));
      openBrief(data);setHistory(items=>[data,...items.filter(item=>item.date!==data.date)]);
      setRegenerateOpen(false);setInstructions('');setStatus(t("今日播报已重新生成，请检查内容后手动推送。"));
    } catch(error) {setRegenerateError(error instanceof Error?error.message:t("重新生成失败，原稿已保留。"));setStatus(t("重新生成未完成，原稿已保留。"));}
    finally {setRegenerating(false);}
  }
  async function generate() { setLoading(true); setStatus(t("正在整理今天的新信息，这通常需要几分钟。")); try { const response = await fetch('/api/internal/morning-brief/today', { method:'POST', headers }); const data = await response.json(); if (!response.ok) throw new Error(data.error || t("生成失败。")); openBrief(data); await refresh(); setStatus(data.created ? t("晨报已生成，等待你确认后推送。") : t("今天的晨报已打开。")); } catch (error) { setStatus(error instanceof Error ? error.message : t("生成失败。")); } finally { setLoading(false); } }
  async function save() { if (!brief) return; setSaving(true); try { const response = await fetch(`/api/internal/morning-brief/briefs/${brief.date}`, { method:'PATCH', headers, body:JSON.stringify({ speechText:text }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || t("保存失败。")); openBrief(data); setStatus(t("晨报正文已保存。")); } catch (error) { setStatus(error instanceof Error ? error.message : t("保存失败。")); } finally { setSaving(false); } }
  async function push() { if (!brief) return; setPushing(true); try { const response = await fetch('/api/internal/morning-brief/push', { method:'POST', headers }); const data = await response.json(); if (!response.ok) throw new Error(data.error || t("推送失败。")); openBrief(data); setStatus(data.pushStatus === 'sent' ? t("晨报已推送。") : t("晨报推送未完全送达。")); } catch (error) { setStatus(error instanceof Error ? error.message : t("推送失败。")); } finally { setPushing(false); } }
  return <div className="mx-auto w-full max-w-6xl select-text space-y-6 p-6 md:p-10">
    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><h1 className="text-3xl font-semibold tracking-tight">{t("全球晨报")}</h1><div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><span>{currentDate}</span>{brief && <Badge variant="outline">{t(pushLabel(brief))}</Badge>}</div>{status && <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">{t(status)}</p>}</div><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => refresh().catch(() => setStatus(t("刷新失败。")))}><RefreshCw size={15}/>{t("刷新")}</Button><Button onClick={generate} disabled={busy}>{loading ? <LoaderCircle className="animate-spin" size={16}/> : <Sparkles size={16}/>}{t("生成今日晨报")}</Button></div></header>
    <div><Button variant="outline" disabled={busy} aria-expanded={regenerateOpen} aria-controls="regenerate-brief" onClick={()=>{setRegenerateOpen(value=>!value);setRegenerateError('');}}><RefreshCw size={16}/>{t("重新生成今日播报")}</Button></div>
    {regenerateOpen && <Card id="regenerate-brief"><CardHeader><CardTitle>{t("重新生成今日播报")}</CardTitle><CardDescription>{t("填写想补充、删去或调整的内容。确认后会调用 AI 重新生成，成功后替换今日原稿；失败保留原稿，不会自动推送。")}</CardDescription></CardHeader><CardContent><form className="space-y-4" onSubmit={regenerate}>
      <label htmlFor="brief-instructions" className="block text-sm font-medium">{t("补充提示（可选）")}</label>
      <Textarea id="brief-instructions" autoFocus value={instructions} onChange={event=>setInstructions(event.target.value)} maxLength={2000} disabled={regenerating} placeholder={t("例如：补充这次国际贸易政策的关键变化；减少重复背景，保留具体数据与来源。")} />
      <p className="text-xs text-muted-foreground">{instructions.length} {t("/ 2000 字")}{dirty?t("· 当前未保存的修改会在重新生成成功后被替换。"):''}</p>
      {(!brief || brief.date!==todayJst()) && <p className="text-sm text-muted-foreground">{t("请先生成并打开今天的晨报，再重新生成。")}</p>}
      {regenerateError && <p role="alert" className="text-sm text-destructive">{t(regenerateError)}</p>}
      <div className="flex gap-2"><Button type="submit" disabled={busy || !brief || brief.date!==todayJst()}>{regenerating && <LoaderCircle size={16} className="animate-spin"/>}{regenerating?t("正在重新生成…"):t("确定并重新生成")}</Button><Button type="button" variant="outline" disabled={regenerating} onClick={()=>setRegenerateOpen(false)}>{t("取消")}</Button></div>
    </form></CardContent></Card>}
    <section className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(18rem,1fr)]">
      <Card><CardHeader className="flex-row items-start justify-between gap-4 space-y-0"><div><CardDescription>{t("今日晨报")}</CardDescription><CardTitle className="mt-1 text-xl">{brief?.title || t("今天的晨报还在等你")}</CardTitle></div>{brief && <Badge variant="outline"><Clock3 size={14}/>{brief.date}</Badge>}</CardHeader><CardContent>{brief ? <><Textarea className="min-h-[36rem] resize-y leading-7" value={text} onChange={event => setText(event.target.value)} aria-label={t("晨报正文")} disabled={regenerating}/><div className="mt-4 flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between"><span>{text.length} {t("字")}{summary && ` · ${summary}`}</span><Button onClick={save} disabled={busy || !dirty}>{saving ? <LoaderCircle className="animate-spin" size={15}/> : <Save size={15}/>}{t("保存修改")}</Button></div></> : <div className="grid min-h-96 place-items-center text-center text-sm text-muted-foreground"><div><Radio className="mx-auto mb-3" size={24}/><p>{t("生成后，你可以在这里查看和调整晨报正文。")}</p></div></div>}</CardContent></Card>
      <aside className="grid content-start gap-6"><Card><CardHeader><CardDescription>{t("今日状态")}</CardDescription></CardHeader><CardContent className="space-y-4"><div className="flex justify-between text-sm"><span>{t("晨报生成")}</span><strong>{brief ? t("✓ 已生成") : t("待处理")}</strong></div><div className="flex justify-between text-sm"><span>{t("保存修改")}</span><strong>{brief ? dirty ? t("有未保存修改") : t("✓ 已保存") : t("待处理")}</strong></div><div className="flex justify-between text-sm"><span>{t("推送")}</span><strong>{t(pushLabel(brief))}</strong></div><Button className="w-full" onClick={push} disabled={!brief || busy || dirty}>{pushing ? <LoaderCircle className="animate-spin" size={16}/> : <Send size={16}/>} {brief?.pushStatus === 'sent' ? t("再次推送晨报") : t("推送今日晨报")}</Button>{dirty && <p className="text-xs text-muted-foreground">{t("保存修改后即可推送。")}</p>}</CardContent></Card>
        <Card><CardHeader><div className="flex items-center justify-between"><div><CardDescription>{t("今日选题")}</CardDescription><CardTitle className="mt-1 text-lg">{topics.length} {t("条")}</CardTitle></div><Sparkles size={18}/></div></CardHeader><CardContent>{topics.length ? <ul className="space-y-4">{topics.map(item => <li key={item.eventKey}><div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{item.headline}</p><Badge variant="outline">{item.updateType === 'material_update' ? t("实质更新") : t("新事件")}</Badge></div>{item.category && <p className="mt-1 text-xs text-muted-foreground">{item.category}</p>}<p className="mt-1 text-sm text-muted-foreground">{item.summary}</p>{item.sourceUrls?.length ? <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">{item.sourceUrls.map(url => <a className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground" href={url} key={url} rel="noreferrer" target="_blank">{t("查看来源：")}{new URL(url).hostname}</a>)}</div> : null}</li>)}</ul> : <p className="text-sm text-muted-foreground">{t("生成后会显示本期实际选入的事件。")}</p>}{brief && <details className="mt-5 border-t pt-4"><summary className="cursor-pointer text-sm font-medium">{t("查看结构化响应")}</summary><pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-xs leading-5">{JSON.stringify({ title:brief.title, speechText:brief.speechText, items:brief.items }, null, 2)}</pre></details>}</CardContent></Card></aside>
    </section>
    <Card><CardHeader><CardDescription>Archive</CardDescription><CardTitle className="text-lg">{t("最近晨报")}</CardTitle></CardHeader><CardContent>{history.length ? <div>{history.map(item => <button className="flex w-full items-center gap-3 border-t py-3 text-left text-sm first:border-t-0 first:pt-0 hover:bg-muted/50" key={item.date} disabled={busy} onClick={() => openBrief(item)}><span className="shrink-0 text-muted-foreground">{item.date.slice(5).replace('-', '/')}</span><span className="min-w-0 flex-1 truncate font-medium">{item.title}</span><ChevronRight className="text-muted-foreground" size={15}/></button>)}</div> : <p className="text-sm text-muted-foreground">{t("生成第一份晨报后，这里会保留最近记录。")}</p>}</CardContent></Card>
  </div>;
}
