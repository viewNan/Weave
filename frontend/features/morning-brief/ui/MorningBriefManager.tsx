'use client';

import { BookOpen, Check, ChevronRight, Clock3, CloudSun, Database, History, LoaderCircle, Radio, RefreshCw, Save, Send, Settings2, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import styles from './MorningBriefManager.module.css';

const headers = { 'content-type': 'application/json', 'x-weave-client': 'admin' };
type Brief = { date:string; title:string; speechText:string; items?:Array<{eventKey:string;headline:string;summary:string;updateType:string}>; pushStatus:string; pushAccepted:number; pushRejected:number; generatedAt:string; manuallyEditedAt:string|null };

function StateCard({ tone, icon, eyebrow, value, detail }:{tone:string;icon:React.ReactNode;eyebrow:string;value:string;detail:string}) {
  return <article className={`${styles.stateCard} ${styles[tone]}`}><div className={styles.stateIcon}>{icon}</div><div><p>{eyebrow}</p><strong>{value}</strong><span>{detail}</span></div></article>;
}

export default function MorningBriefManager() {
  const [brief, setBrief] = useState<Brief | null>(null); const [history, setHistory] = useState<Brief[]>([]); const [status, setStatus] = useState(''); const [text, setText] = useState(''); const [loading, setLoading] = useState(false); const [saving, setSaving] = useState(false);
  const memoryCount = useMemo(() => history.slice(0, 7).reduce((count, item) => count + (item.items?.length ?? 0), 0), [history]);
  async function refresh() { const historyResponse = await fetch('/api/internal/morning-brief/history?limit=30', { headers }); if (historyResponse.ok) setHistory((await historyResponse.json()).briefs || []); }
  useEffect(() => { refresh().catch(() => setStatus('页面数据加载失败，请刷新重试。')); }, []);
  async function load() { setLoading(true); setStatus('正在整理今天的新信息，这通常需要几十秒。'); try { const response = await fetch('/api/internal/morning-brief/today', { method: 'POST', headers }); const data = await response.json(); if (!response.ok) throw new Error(data.error || '加载失败'); setBrief(data); setText(data.speechText); await refresh(); setStatus(data.created ? '晨报已准备好，并已尝试发送推送。' : '已打开今天已保存的晨报。'); } catch (error) { setStatus(error instanceof Error ? error.message : '加载失败'); } finally { setLoading(false); } }
  async function save() { if (!brief) return; setSaving(true); try { const response = await fetch(`/api/internal/morning-brief/briefs/${brief.date}`, { method: 'PATCH', headers, body: JSON.stringify({ speechText: text }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || '保存失败'); setBrief(data); setStatus('播报稿已保存，不会重复推送。'); await refresh(); } catch (error) { setStatus(error instanceof Error ? error.message : '保存失败'); } finally { setSaving(false); } }
  const latest = brief || history[0];
  return <main className={styles.main}>
    <header className={styles.header}><a className={styles.brand} href="/"><span>W</span> Weave</a><div><p>PERSONAL INTELLIGENCE</p><h1>Morning Brief</h1></div><div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}><a className={styles.ghost} href="/settings"><Settings2 size={15}/> 设置</a><button className={styles.ghost} onClick={() => refresh().catch(() => setStatus('刷新失败'))}><RefreshCw size={15}/> 刷新</button></div></header>
    <section className={styles.hero}><div><p className={styles.eyebrow}>GOOD MORNING</p><h2>把真正值得知道的事，<br/>留给早晨。</h2><p className={styles.subtitle}>晨报会记住最近七天的事件，只在出现新的实质进展时再次提起。</p></div><button className={styles.primary} onClick={load} disabled={loading}>{loading ? <LoaderCircle className={styles.spin} size={18}/> : <Sparkles size={18}/>} {loading ? '正在准备晨报…' : '生成 / 打开今日晨报'}</button></section>
    {status && <p className={styles.notice} aria-live="polite"><Check size={16}/>{status}</p>}
    <section className={styles.stateGrid}>
      <StateCard tone="sun" icon={<CloudSun size={21}/>} eyebrow="TODAY'S BRIEF" value={latest ? latest.title : '尚未生成'} detail={latest ? `${latest.date} · ${latest.items?.length ?? 0} 条事件` : '点击上方按钮开始'} />
      <StateCard tone="delivery" icon={<Send size={20}/>} eyebrow="DELIVERY" value={latest?.pushStatus === 'sent' ? '已送达' : latest ? '已记录' : '等待晨报'} detail={latest ? `Push：${latest.pushStatus}` : '生成后自动推送'} />
      <StateCard tone="notebook" icon={<BookOpen size={20}/>} eyebrow="NOTEBOOK" value={`${history.length} 篇记录`} detail="保存的每日播报稿" />
      <StateCard tone="memory" icon={<Database size={20}/>} eyebrow="MEMORY" value={`${memoryCount} 条记忆`} detail="最近七天的结构化事件" />
    </section>
    <section className={styles.workspace}>
      <article className={`${styles.panel} ${styles.editor}`}><div className={styles.panelHead}><div><p className={styles.eyebrow}>TODAY'S NOTE</p><h3>{brief?.title || '今天的晨报还在等你'}</h3></div>{brief && <span className={styles.date}><Clock3 size={14}/>{brief.date}</span>}</div>
        {brief ? <><textarea value={text} onChange={event => setText(event.target.value)} aria-label="晨报播报稿"/><div className={styles.editorFoot}><span>{text.length} 字 · 手动编辑不会影响已保存的事件记忆</span><button className={styles.primarySmall} onClick={save} disabled={saving}>{saving ? <LoaderCircle className={styles.spin} size={15}/> : <Save size={15}/>} 保存播报稿</button></div></> : <div className={styles.empty}><Radio size={24}/><p>生成后，你可以在这里自由调整语音播报稿。</p></div>}
      </article>
      <aside className={styles.sideStack}><article className={`${styles.panel} ${styles.items}`}><div className={styles.panelHead}><div><p className={styles.eyebrow}>EDITOR'S MEMORY</p><h3>今天选了什么</h3></div><Sparkles size={18}/></div>{brief?.items?.length ? <ul>{brief.items.map(item => <li key={item.eventKey}><span className={item.updateType === 'material_update' ? styles.update : styles.new}>{item.updateType === 'material_update' ? '更新' : '新'}</span><div><strong>{item.headline}</strong><p>{item.summary}</p></div></li>)}</ul> : <p className={styles.muted}>生成后会在这里显示结构化事件，并成为未来七天的去重记忆。</p>}</article>
        <article className={`${styles.panel} ${styles.history}`}><div className={styles.panelHead}><div><p className={styles.eyebrow}>ARCHIVE</p><h3>最近记录</h3></div><History size={18}/></div>{history.slice(0,5).map(item => <div className={styles.historyRow} key={item.date}><span>{item.date.slice(5).replace('-', '/')}</span><p>{item.title}</p><ChevronRight size={15}/></div>)}{!history.length && <p className={styles.muted}>生成第一份晨报后，这里会保留你的记录。</p>}</article></aside>
    </section>
  </main>;
}
