export type Rating = 'fluent' | 'shaky' | 'unknown';
export const ratings: Rating[] = ['fluent', 'shaky', 'unknown'];
export const ratingLabels = { fluent: '流畅', shaky: '卡顿', unknown: '不会' };
export type PracticeSet = { id: string; name: string };
export type PracticeGroup = { id: string; set_id: string; name: string; archived: number; sort_order: number };
export type Attempt = { id: string; item_id: string; rating: Rating | null; note: string; study_day: string; created_at: string; deleted: number };
export type PracticeItem = {
  id: string; group_id: string; prompt: string; outline: string; starred: number; archived: number;
  sort_order: number; revision: number; today_count: number; current_rating: Rating | null;
  latest_id: string | null; latest_rating: Rating | null; last_rated_at: string | null;
};
export type Dashboard = { sets: PracticeSet[]; setId: string; groups: PracticeGroup[]; items: PracticeItem[]; day: string };
export type Undo = { itemId: string; attemptId: string; revision: number; rating?: Rating | null; deleted?: number; note?: string };

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
