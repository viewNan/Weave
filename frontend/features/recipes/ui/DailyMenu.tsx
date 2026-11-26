'use client';
import { useLanguage } from '../../../shared/i18n/LanguageProvider';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Star } from 'lucide-react';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import type { DailyRecommendation, MealLog, MealInput, Recipe } from '../domain';
import { recipeRequest } from './client';

type Snapshot = { date: string; daily: DailyRecommendation | null; meal: MealLog | null; recentMeals: MealLog[]; recipes: Recipe[]; generation: { status: string; attempts: number } | null };
type Editor = { mode: 'edit' | 'replace' | 'create'; target: MealLog | null; name: string; recipeId: string };
const sources = { recommended: '来自推荐', library: '来自食谱库', freeform: '自由记录' };

export default function DailyMenu() {
  const { t } = useLanguage();

  const [data, setData] = useState<Snapshot | null>(null), [busy, setBusy] = useState(false);
  const [error, setError] = useState(''), [editor, setEditor] = useState<Editor | null>(null);
  const inFlight = useRef(false);
  const load = async () => setData(await recipeRequest<Snapshot>('/daily'));
  useEffect(() => { load().catch(e => setError(e.message)); }, []);
  async function run(action: () => Promise<void>) {
    if (inFlight.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try { await action(); await load(); }
    catch (e) { setError((e as Error).message); await load().catch(() => {}); }
    finally { inFlight.current = false; setBusy(false); }
  }
  const daily = data?.daily, selected = daily?.candidates[daily.selectedIndex], meal = data?.meal;
  const identity = (item: MealLog) => ({ date: item.date, id: item.id, revision: item.revision });
  async function recordRecommended() {
    if (!data || !daily) return;
    if (meal && !window.confirm(t("将「{0}」替换为「{1}」？原评分会清除。", meal.name, selected?.title))) return;
    await run(async () => {
      const input: MealInput = { source: 'recommended', candidateIndex: daily.selectedIndex };
      await recipeRequest('/daily/meal', meal ? 'PATCH' : 'POST', meal ? { ...identity(meal), ...input, mode: 'replace' } : { date: data.date, ...input });
      setEditor(null);
    });
  }
  async function saveEditor() {
    if (!data || !editor) return;
    if (editor.mode === 'replace' && !window.confirm(t("确认替换这条饮食记录并清除原评分？"))) return;
    await run(async () => {
      const input: MealInput = editor.mode !== 'edit' && editor.recipeId ? { source: 'library', recipeId: editor.recipeId } : { source: 'freeform', name: editor.name };
      await recipeRequest('/daily/meal', editor.target ? 'PATCH' : 'POST', editor.target ? { ...identity(editor.target), ...input, mode: editor.mode } : { date: data.date, ...input });
      setEditor(null);
    });
  }
  function clear(item: MealLog) {
    if (window.confirm(t("清除 {0} 的「{1}」？它将不再参与以后推荐。", item.date, item.name))) void run(async () => {
      await recipeRequest('/daily/meal', 'DELETE', identity(item)); setEditor(null);
    });
  }
  function rating(item: MealLog) {
    return <div className="flex flex-wrap items-center gap-1" role="group" aria-label={t("{0}的用餐评分", item.name)}>
      {[1, 2, 3, 4, 5].map(value => <Button key={value} type="button" size="sm" variant="ghost" disabled={busy}
        aria-label={t("{0} 分", value)} aria-pressed={item.rating === value}
        onClick={() => void run(async () => { await recipeRequest('/daily/feedback', 'POST', { ...identity(item), rating: value }); })}>
        <Star size={20} className={value <= (item.rating || 0) ? 'text-amber-500' : 'text-muted-foreground'} fill={value <= (item.rating || 0) ? 'currentColor' : 'none'} />
      </Button>)}
      <span className="ml-2 text-sm text-muted-foreground">{item.rating ? `${item.rating} / 5` : t("未评分")}</span>
      {item.rating !== null && <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(async () => { await recipeRequest('/daily/feedback', 'POST', { ...identity(item), rating: null }); })}>{t("清除评分")}</Button>}
    </div>;
  }
  function actions(item: MealLog) {
    return <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditor({ mode: 'edit', target: item, name: item.name, recipeId: '' })}>{t("修正文字")}</Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => setEditor({ mode: 'replace', target: item, name: '', recipeId: '' })}>{t("换成另一顿")}</Button>
      <Button size="sm" variant="outline" className="text-destructive" disabled={busy} onClick={() => clear(item)}>{t("清除记录")}</Button>
    </div>;
  }
  return <div className="mx-auto w-full max-w-5xl space-y-6 p-6 md:p-10" aria-busy={busy}>
    <header className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-semibold tracking-tight">{t("每日菜单推荐")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{data?.date} {t("· 推荐和实际吃过的内容分别保存。")}</p></div>
      <div className="flex gap-2"><Link href="/console/eat/my-recipes" className="inline-flex h-10 items-center rounded-md border px-4 text-sm font-medium">{t("我的食谱")}</Link>
        <Button variant="outline" disabled={busy} onClick={() => void run(async () => { setEditor(null); })}>{t("刷新")}</Button></div>
    </header>
    {error && <p role="alert" className="rounded-md border border-destructive/30 p-3 text-sm text-destructive">{t(error)}</p>}
    {!data ? <p className="text-sm text-muted-foreground">{error ? t("加载失败，请点击刷新重试。") : t("正在读取菜单和饮食记录…")}</p> : <>
      {!daily ? <Card><CardContent className="space-y-4 p-6"><h2 className="font-semibold">{t("今天还没有推荐")}</h2>
        <p className="text-sm text-muted-foreground">{data.generation ? t("上次生成尚未完成或未成功。可以先记录用餐；稍后刷新或手动重试。") : t("生成三道候选，再决定今天吃什么。也可以直接记录实际用餐。")}</p>
        <Button disabled={busy || (data.generation?.attempts ?? 0) >= 3} onClick={() => void run(async () => { await recipeRequest('/daily', 'POST', { retry: Boolean(data.generation) }); })}>
          {busy ? t("正在处理…") : data.generation ? t("重试生成推荐") : t("生成今日推荐")}</Button>
        {(data.generation?.attempts ?? 0) >= 3 && <p className="text-sm text-muted-foreground">{t("今天已尝试3次，请明天再试。")}</p>}
      </CardContent></Card> : <>
        <Card><CardHeader><CardDescription>{t("今日推荐 ·")} {daily.date}</CardDescription><CardTitle className="text-2xl">{selected?.title}</CardTitle>
          <div className="flex flex-wrap gap-2 pt-2"><Badge variant="outline">{selected?.cuisine}</Badge><Badge variant="outline">{selected?.minutes} {t("分钟")}</Badge><Badge variant="outline">{selected?.difficulty}</Badge></div>
        </CardHeader><CardContent className="space-y-4">
          {daily.origin === 'legacy' && <p className="text-sm text-muted-foreground">{t("这是旧版保存的推荐，无法确认其生成来源。")}</p>}
          <p className="text-sm text-muted-foreground">{selected?.reason}</p>
          <div className="flex flex-wrap gap-2"><Button disabled={busy} onClick={() => void recordRecommended()}>{t("记录为实际吃了")}</Button>
            <Button variant="outline" disabled={busy} onClick={() => void run(async () => { await recipeRequest('/daily', 'PATCH', { date: daily.date, selectedIndex: (daily.selectedIndex + 1) % 3 }); })}>{t("换一个")}</Button></div>
          {selected?.markdown ? <details><summary className="cursor-pointer text-sm font-medium">{t("查看材料与做法")}</summary><pre className="mt-3 whitespace-pre-wrap font-sans text-sm leading-7">{selected.markdown}</pre></details> : <p className="text-sm text-muted-foreground">{t("这条旧推荐没有保存做法。")}</p>}
        </CardContent></Card>
        <section aria-label={t("备选推荐")} className="grid gap-3 sm:grid-cols-2">{daily.candidates.map((item, index) => index === daily.selectedIndex ? null : <Card key={index}><CardContent className="space-y-3 p-4"><p className="font-medium">{item.title}</p><p className="text-sm text-muted-foreground">{item.cuisine} · {item.minutes} {t("分钟")}</p>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => void run(async () => { await recipeRequest('/daily', 'PATCH', { date: daily.date, selectedIndex: index }); })}>{t("选这个")}</Button>
        </CardContent></Card>)}</section>
      </>}
      <Card><CardHeader><CardTitle className="text-lg">{t("今天实际吃了什么？")}</CardTitle><CardDescription>{t("当前每天记录一顿主要用餐；尚无推荐也可以记录。")}</CardDescription></CardHeader>
        <CardContent className="space-y-4">{meal ? <><p className="font-medium">{meal.name}</p><p className="text-xs text-muted-foreground">{t(sources[meal.source])}</p>{actions(meal)}{rating(meal)}</> : <Button variant="outline" disabled={busy} onClick={() => setEditor({ mode: 'create', target: null, name: '', recipeId: '' })}>{t("记录实际用餐")}</Button>}</CardContent>
      </Card>
      {editor && <Card><CardHeader><CardTitle className="text-lg">{editor.target?.date || data.date} · {editor.mode === 'edit' ? t("修正文字") : editor.mode === 'replace' ? t("换成另一顿") : t("记录用餐")}</CardTitle>
        <CardDescription>{editor.mode === 'edit' ? t("用于修正错字，保留原来源和评分。换了一道菜请用“换成另一顿”。") : t("保存实际吃过的内容；替换已有记录会清除原评分。")}</CardDescription></CardHeader>
        <CardContent><form className="space-y-3" onSubmit={event => { event.preventDefault(); void saveEditor(); }}>
          {editor.mode !== 'edit' && <select className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label={t("从食谱库选择")} disabled={busy} value={editor.recipeId} onChange={e => setEditor({ ...editor, recipeId: e.target.value })}><option value="">{t("自己填写")}</option>{data.recipes.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select>}
          {!editor.recipeId && <Input aria-label={t("实际用餐内容")} autoFocus maxLength={120} required disabled={busy} value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} placeholder={t("例如：外食 · 拉面")} />}
          <div className="flex gap-2"><Button disabled={busy || (!editor.recipeId && !editor.name.trim())}>{busy ? t("保存中…") : t("保存")}</Button><Button type="button" variant="outline" disabled={busy} onClick={() => setEditor(null)}>{t("取消")}</Button></div>
        </form></CardContent></Card>}
      <details className="rounded-lg border p-4"><summary className="cursor-pointer text-sm font-medium">{t("最近吃过 · 最近30条记录")}</summary>
        <p className="mt-3 text-sm text-muted-foreground">{t("推荐会参考近90天有效记录及评分。修正或清除后，下次生成时会使用更新后的记录。")}</p>
        {!data.recentMeals.length ? <p className="mt-4 text-sm text-muted-foreground">{t("还没有饮食记录。")}</p> : <ul className="divide-y">{data.recentMeals.map(item => <li key={`${item.id}-${item.revision}`} className="space-y-3 py-4"><p className="text-sm">{item.date} · {item.name} <span className="text-muted-foreground">· {t(sources[item.source])}</span></p>{actions(item)}{rating(item)}</li>)}</ul>}
      </details>
    </>}
  </div>;
}
