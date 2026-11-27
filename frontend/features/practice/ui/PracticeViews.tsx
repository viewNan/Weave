'use client';

import { useState } from 'react';
import { Check, ChevronDown, Circle, History, Plus, Star, Triangle, X } from 'lucide-react';
import { Button } from '../../../components/ui/button';
import { Checkbox } from '../../../components/ui/checkbox';
import { useLanguage } from '../../../shared/i18n/LanguageProvider';
import { fluentProgress, ratingLabels, ratings, type PracticeGroup, type PracticeItem, type PracticeRound, type Rating } from '../domain';

type Actions = {
  busy: boolean;
  onRecord: (item: PracticeItem, mode: 'check' | 'rate' | 'again', rating?: Rating) => Promise<unknown>;
  onHistory: (id: string) => void;
  onStar: (item: PracticeItem) => void;
};
const icons = { fluent: Circle, shaky: Triangle, unknown: X };
const colors = { fluent: 'text-emerald-700', shaky: 'text-amber-700', unknown: 'text-red-600' };

function RatingButtons({ item, busy, onRate, compact = false }: { item: PracticeItem; busy: boolean; onRate: (value: Rating) => void; compact?: boolean }) {
  const { t } = useLanguage();
  return <div role="group" aria-label={t('本次评级：{0}', item.prompt)} className="grid grid-cols-3 gap-2">
    {ratings.map(value => { const Icon = icons[value]; return <Button key={value} variant={item.latest_rating === value ? 'secondary' : 'outline'} className={`h-11 min-w-0 gap-1 px-1 text-xs sm:px-2 sm:text-sm ${colors[value]}`} aria-label={`${t(ratingLabels[value])}：${item.prompt}`} title={t(ratingLabels[value])} aria-pressed={item.latest_rating === value} disabled={busy} onClick={() => onRate(value)}><Icon size={16} className="shrink-0"/>{!compact && t(ratingLabels[value])}</Button>; })}
  </div>;
}

function MiniProgress({ item }: { item: PracticeItem }) {
  const { t } = useLanguage(), progress = fluentProgress(item);
  return <div className="min-w-0 space-y-1" aria-label={t('流畅进度')}><div className="text-sm font-semibold tabular-nums">{progress.score}<span className="font-normal text-muted-foreground"> / 100</span></div><div role="progressbar" aria-label={t('流畅进度')} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress.score} className="h-1 overflow-hidden rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${progress.score}%` }}/></div></div>;
}

function Counts({ item }: { item: PracticeItem }) {
  const { t } = useLanguage();
  return <details><summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground"><ChevronDown size={13}/>{t('已练 {0} 次 · 查看次数', item.total_count)}</summary><div className="flex flex-wrap gap-3 pb-2 text-xs">{ratings.map(value => { const Icon = icons[value]; return <span className={`inline-flex items-center gap-1 ${colors[value]}`} key={value}><Icon size={12}/>{t(ratingLabels[value])} {item[`${value}_count`]}</span>; })}{item.total_count > item.fluent_count + item.shaky_count + item.unknown_count && <span>{t('未评级')} {item.total_count - item.fluent_count - item.shaky_count - item.unknown_count}</span>}</div></details>;
}

function Outline({ item }: { item: PracticeItem }) {
  const { t } = useLanguage();
  return item.outline ? <details className="rounded-md bg-muted/40 px-3"><summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 text-sm text-muted-foreground"><ChevronDown size={14}/>{t('回答要点')}</summary><div className="max-h-[32dvh] overflow-y-auto whitespace-pre-wrap break-words pb-3 text-sm leading-7">{item.outline}</div></details> : null;
}

function TodayCheck({ item, busy, onRecord, onHistory }: Actions & { item: PracticeItem }) {
  const { t } = useLanguage();
  return <label className="flex h-11 w-10 shrink-0 cursor-pointer items-center justify-center"><Checkbox aria-label={t('今日练过：{0}', item.prompt)} checked={item.today_count > 0} disabled={busy} onChange={() => item.today_count ? onHistory(item.id) : void onRecord(item, 'check')}/></label>;
}

function StarButton({ item, busy, onStar }: Pick<Actions, 'busy' | 'onStar'> & { item: PracticeItem }) {
  const { t } = useLanguage();
  return <Button variant="ghost" className="h-11 w-10 shrink-0 p-0" aria-label={t('星标：{0}', item.prompt)} aria-pressed={!!item.starred} disabled={busy} onClick={() => onStar(item)}><Star size={16} className={item.starred ? 'fill-amber-400 text-amber-600' : 'text-muted-foreground'}/></Button>;
}

export function PracticeBank({ items, groups, ...actions }: Actions & { items: PracticeItem[]; groups: PracticeGroup[] }) {
  const { t } = useLanguage();
  return <div className="overflow-hidden rounded-lg border bg-card">
    <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_5rem_4.5rem_9rem_2.5rem] items-center gap-2 border-b bg-muted/30 px-3 py-2 text-xs text-muted-foreground lg:grid"><span/><span>{t('题目')}</span><span>{t('流畅进度')}</span><span>{t('练习次数')}</span><span className="text-center">{t('本次评级')}</span><span/></div>
    <div className="divide-y">{items.map(item => {
      const category = groups.find(group => group.id === item.group_id)?.name, progress = fluentProgress(item);
      return <article key={item.id}>
        <div className="hidden grid-cols-[2.5rem_minmax(0,1fr)_5rem_4.5rem_9rem_2.5rem] items-center gap-2 px-3 py-2 lg:grid">
          <TodayCheck item={item} {...actions}/>
          <div className="min-w-0"><button className="line-clamp-2 min-h-8 text-left text-sm font-medium leading-6 hover:underline" onClick={() => actions.onHistory(item.id)}>{item.prompt}</button><p className="truncate text-xs text-muted-foreground">{category} · <span className={item.current_rating ? colors[item.current_rating] : ''}>{t(item.current_rating ? ratingLabels[item.current_rating] : '未评级')}</span>{progress.status !== 'learning' && ` · ${t(progress.status === 'passed' ? '目标达成' : '待复习')}`}</p></div>
          <MiniProgress item={item}/>
          <Button variant="ghost" className="h-11 px-1 text-xs tabular-nums" onClick={() => actions.onHistory(item.id)} aria-label={t('已练 {0} 次 · 查看次数', item.total_count)}>{item.total_count} {t('次')}</Button>
          <RatingButtons item={item} busy={actions.busy} compact onRate={value => void actions.onRecord(item, 'rate', value)}/>
          <StarButton item={item} {...actions}/>
        </div>
        <details className="lg:hidden"><summary className="flex min-h-20 cursor-pointer list-none items-center gap-3 px-4 py-3"><div className="min-w-0 flex-1"><p className="line-clamp-2 text-sm font-medium leading-6">{item.prompt}</p><p className="mt-1 truncate text-xs text-muted-foreground">{category} · {t(item.current_rating ? ratingLabels[item.current_rating] : '未评级')}</p></div><span className="shrink-0 text-sm font-semibold tabular-nums">{progress.score}<span className="text-xs font-normal text-muted-foreground">/100</span></span><ChevronDown size={14} className="shrink-0 text-muted-foreground"/></summary>
          <div className="space-y-3 border-t bg-muted/10 p-4"><p className="whitespace-pre-wrap break-words text-sm leading-6">{item.prompt}</p><div className="flex items-center justify-between"><div className="flex items-center text-xs text-muted-foreground"><TodayCheck item={item} {...actions}/>{t('今日 {0} 次', item.today_count)}</div><StarButton item={item} {...actions}/></div><Counts item={item}/><Outline item={item}/><RatingButtons item={item} busy={actions.busy} onRate={value => void actions.onRecord(item, 'rate', value)}/><div className="flex justify-between gap-2"><Button variant="ghost" disabled={actions.busy} onClick={() => actions.onHistory(item.id)}><History size={15}/>{t('练习详情')}</Button>{item.today_count > 0 && <Button variant="outline" disabled={actions.busy} onClick={() => void actions.onRecord(item, 'again')}><Plus size={15}/>{t('再练一次')}</Button>}</div></div>
        </details>
      </article>;
    })}</div>
  </div>;
}

export function PracticeRoundView({ items, groups, round, onNewRound, ...actions }: Actions & { items: PracticeItem[]; groups: PracticeGroup[]; round: PracticeRound; onNewRound: () => void }) {
  const { t } = useLanguage(), [focusedId, setFocusedId] = useState<string | null>(null);
  const remaining = items.filter(item => !round.completed.includes(item.id));
  const current = items.find(item => item.id === focusedId) ?? remaining[0];
  const completed = items.length - remaining.length;
  async function rate(value: Rating) {
    if (current && await actions.onRecord(current, 'rate', value)) setFocusedId(null);
  }
  return <div className="grid items-start gap-5 lg:grid-cols-[13rem_minmax(0,1fr)]">
    <aside className="hidden overflow-hidden rounded-lg border bg-card lg:block"><div className="flex items-center justify-between border-b px-3 py-3 text-sm font-medium"><span>{t('本轮题目')}</span><span className="text-xs text-muted-foreground">{completed}/{items.length}</span></div><div className="max-h-[calc(100dvh-15rem)] overflow-y-auto p-1">{items.map((item, index) => <button key={item.id} disabled={actions.busy} className={`flex min-h-11 w-full items-start gap-2 rounded-md px-3 py-2 text-left text-xs leading-5 hover:bg-accent disabled:opacity-50 ${current?.id === item.id ? 'bg-secondary font-medium' : ''}`} onClick={() => setFocusedId(item.id)}><span className="w-4 shrink-0 tabular-nums text-muted-foreground">{round.completed.includes(item.id) ? <Check size={13}/> : index + 1}</span><span className="line-clamp-2">{item.prompt}</span></button>)}</div></aside>
    <div className="min-w-0 space-y-3"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{t('本轮已评 {0} / {1}', completed, items.length)}</span><span>{t('剩余 {0} 题', remaining.length)}</span></div>
      {!current ? <div className="space-y-4 rounded-lg border bg-card px-6 py-12 text-center"><Check className="mx-auto text-emerald-700" size={28}/><h2 className="text-lg font-semibold">{t('本轮练习完成')}</h2><p className="text-sm text-muted-foreground">{t('本轮题目都已评价，可以休息或换一轮。')}</p><Button onClick={onNewRound}>{t('换一轮')}</Button></div> : <article key={current.id} className="overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="space-y-4 p-4 sm:p-6"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">{groups.find(group => group.id === current.group_id)?.name}</p><h2 className="mt-3 whitespace-pre-wrap break-words text-xl font-semibold leading-8">{current.prompt}</h2></div><StarButton item={current} {...actions}/></div>
          <div className="flex items-center gap-4"><div className="w-28 shrink-0"><MiniProgress item={current}/></div><p className="text-xs leading-5 text-muted-foreground">{fluentProgress(current).remaining ? t('再获得 {0} 次流畅记录，即可达到 100 分。', fluentProgress(current).remaining) : t(fluentProgress(current).status === 'passed' ? '目标达成' : '待复习')}</p></div>
          <Counts item={current}/><Outline item={current}/>
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="flex items-center gap-1 text-xs text-muted-foreground"><TodayCheck item={current} {...actions}/>{t('今日 {0} 次', current.today_count)}</div><Button variant="ghost" onClick={() => actions.onHistory(current.id)}><History size={15}/>{t('练习详情')}</Button></div>
        </div>
        <div className="sticky bottom-0 space-y-3 border-t bg-background p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6"><RatingButtons item={current} busy={actions.busy} onRate={value => void rate(value)}/><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs text-muted-foreground">{t(current.latest_rating ? '评级后自动进入下一题。' : '本次未评级')}</p>{current.today_count > 0 && <Button variant="outline" disabled={actions.busy} onClick={() => void actions.onRecord(current, 'again')}><Plus size={14}/>{t('再练一次')}</Button>}</div></div>
      </article>}
    </div>
  </div>;
}
