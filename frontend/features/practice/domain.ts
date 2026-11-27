export type Rating = 'fluent' | 'shaky' | 'unknown';
export const ratings: Rating[] = ['fluent', 'shaky', 'unknown'];
export const ratingLabels = { fluent: '流畅', shaky: '卡顿', unknown: '不会' };
export const FLUENT_POINTS = 10;
export const PASS_SCORE = 100;
export type PracticeSet = { id: string; name: string };
export type PracticeGroup = { id: string; set_id: string; name: string; archived: number; sort_order: number };
export type Attempt = { id: string; item_id: string; rating: Rating | null; note: string; study_day: string; created_at: string; deleted: number };
export type PracticeItem = {
  id: string; question_number: number; group_id: string; prompt: string; outline: string; starred: number; archived: number;
  sort_order: number; revision: number; today_count: number; current_rating: Rating | null;
  latest_id: string | null; latest_rating: Rating | null; last_rated_at: string | null;
  total_count: number; fluent_count: number; shaky_count: number; unknown_count: number;
};
export type Dashboard = { sets: PracticeSet[]; setId: string; groups: PracticeGroup[]; items: PracticeItem[]; day: string };
export type Undo = { itemId: string; attemptId: string; revision: number; rating?: Rating | null; deleted?: number; note?: string };
export type PracticeRound = { setId: string; day: string; order: string[]; completed: string[] };

export function questionCode(item: Pick<PracticeItem, 'question_number'>) { return `Q${String(item.question_number).padStart(4, '0')}`; }

export function fluentProgress(item: Pick<PracticeItem, 'fluent_count' | 'current_rating'>) {
  const score = Math.min(PASS_SCORE, item.fluent_count * FLUENT_POINTS);
  return { score, remaining: Math.max(0, Math.ceil((PASS_SCORE - score) / FLUENT_POINTS)),
    status: score < PASS_SCORE ? 'learning' : item.current_rating === 'fluent' ? 'passed' : 'review' } as const;
}

export function practicePriority(rating: Rating | null) {
  return rating === 'unknown' ? 0 : rating === 'shaky' ? 1 : rating === null ? 2 : 3;
}

export function startPracticeRound(items: PracticeItem[], setId: string, day: string, random = Math.random): PracticeRound {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  // Stable sorting keeps the shuffled order inside each priority tier.
  shuffled.sort((a, b) => practicePriority(a.current_rating) - practicePriority(b.current_rating));
  return { setId, day, order: shuffled.map(item => item.id), completed: [] };
}

export function refreshPracticeRound(round: PracticeRound | null, items: PracticeItem[], setId: string, day: string): PracticeRound {
  if (!round || round.setId !== setId || round.day !== day) return startPracticeRound(items, setId, day);
  const ids = new Set(items.map(item => item.id)), known = new Set(round.order);
  return { ...round, order: [...round.order.filter(id => ids.has(id)), ...items.filter(item => !known.has(item.id)).map(item => item.id)],
    completed: round.completed.filter(id => ids.has(id)) };
}

export function orderedPracticeItems(items: PracticeItem[], round: PracticeRound | null) {
  if (!round) return items;
  const rank = new Map(round.order.map((id, index) => [id, index])), completed = new Set(round.completed);
  return [...items].sort((a, b) => Number(completed.has(a.id)) - Number(completed.has(b.id)) ||
    (rank.get(a.id) ?? Infinity) - (rank.get(b.id) ?? Infinity));
}

export class PracticeError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

// Japan has no daylight saving: JST minus the 04:00 boundary is UTC + 5 hours.
export function studyDay(now = new Date()) { return new Date(now.getTime() + 5 * 3_600_000).toISOString().slice(0, 10); }
export function nextStudyDayDelay(now = new Date()) {
  return Date.parse(`${studyDay(now)}T19:00:00Z`) - now.getTime();
}
export function normalized(value: string) { return value.normalize('NFC').trim().replace(/\s+/gu, ' '); }
export function text(value: unknown, max: number, required = true): string {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > max) throw new PracticeError('文本为空或超出长度限制。');
  return value.trim();
}
export function identifier(value: unknown) { return text(value, 100); }
export function rating(value: unknown): Rating | null {
  if (value === null) return null;
  if (!ratings.includes(value as Rating)) throw new PracticeError('熟练度无效。');
  return value as Rating;
}
export function revision(value: unknown) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) throw new PracticeError('版本无效，请刷新。');
  return value;
}
export function statistics(items: PracticeItem[]) {
  return { total: items.length, practiced: items.filter(item => item.today_count > 0).length,
    attempts: items.reduce((sum, item) => sum + item.today_count, 0),
    fluent: items.filter(item => item.current_rating === 'fluent').length,
    shaky: items.filter(item => item.current_rating === 'shaky').length,
    unknown: items.filter(item => item.current_rating === 'unknown').length,
    unrated: items.filter(item => item.current_rating === null).length };
}
