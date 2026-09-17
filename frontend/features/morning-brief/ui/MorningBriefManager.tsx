'use client';

import { useEffect, useState } from 'react';
import styles from './MorningBriefManager.module.css';

const days = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
const headers = { 'content-type': 'application/json' };

export default function MorningBriefManager() {
  const [brief, setBrief] = useState<any>(null); const [history, setHistory] = useState<any[]>([]); const [settings, setSettings] = useState<any>(null); const [status, setStatus] = useState(''); const [text, setText] = useState('');
  async function loadSettings() { const r = await fetch('/api/internal/morning-brief/settings', { headers }); if (r.ok) setSettings(await r.json()); else setStatus('设置加载失败'); }
  useEffect(() => { loadSettings(); }, []);
  async function load() { setStatus('正在生成或读取今天的晨报…'); const r = await fetch('/api/internal/morning-brief/today', { method: 'POST', headers }); const d = await r.json(); if (!r.ok) return setStatus(d.error || '加载失败'); setBrief(d); setText(d.speechText); const h = await fetch('/api/internal/morning-brief/history?limit=30', { headers }); setHistory((await h.json()).briefs || []); setStatus(d.created ? '已生成并推送' : '已加载今日晨报'); }
  async function save() { const r = await fetch(`/api/internal/morning-brief/briefs/${brief.date}`, { method: 'PATCH', headers, body: JSON.stringify({ speechText: text }) }); if (r.ok) { setBrief(await r.json()); setStatus('已保存；不会重复推送。'); } else setStatus((await r.json()).error || '保存失败'); }
  async function saveSettings() { const r = await fetch('/api/internal/morning-brief/settings', { method: 'PUT', headers, body: JSON.stringify({ weekdays: settings.weekdays }) }); setStatus(r.ok ? '星期设置已保存' : '星期设置保存失败'); }
  return <main className={styles.main}><a href="/">← 返回主页</a><h1>每日晨报</h1><p className={styles.muted}>这是个人管理页；Google 登录接入前不需要输入 Token。</p><section className={styles.card}><button onClick={load}>生成 / 加载今日晨报</button></section>{status && <p className={styles.status}>{status}</p>}{settings && <section className={styles.card}><h2>星期内容设置</h2>{days.map((day, i) => <div className={styles.setting} key={i}><strong>{day}</strong><div>{Object.entries(settings.availableCategories).map(([id, label]) => <label className={styles.check} key={id}><input type="checkbox" checked={(settings.weekdays[String(i)] || []).includes(id)} onChange={e => setSettings({ ...settings, weekdays: { ...settings.weekdays, [String(i)]: e.target.checked ? [...(settings.weekdays[String(i)] || []), id] : (settings.weekdays[String(i)] || []).filter((x: string) => x !== id) } })} />{label as string}</label>)}</div></div>)}<button onClick={saveSettings}>保存星期设置</button></section>}{brief && <section className={styles.card}><div className={styles.meta}>{brief.date} · {brief.title}</div><textarea value={text} onChange={e => setText(e.target.value)} rows={18} /><button onClick={save}>保存 speechText</button><p className={styles.muted}>推送：{brief.pushStatus}</p></section>}<section className={styles.card}><h2>消息记录</h2>{history.map(b => <div className={styles.row} key={b.date}><span>{b.date}</span><span>{b.title}</span><span>{b.pushStatus}</span></div>)}</section></main>;
}
