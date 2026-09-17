import type { CategoryId } from '../config/content-policy';
import { DEFAULT_WEEKDAYS } from '../config/content-policy';
import type { Brief, MorningBriefRepository } from '../repositories/morning-brief-repository';
import type { MorningBriefProvider } from './morning-brief-provider';

type Notifier = { send(input: { title: string; body: string; url: string; type: string }): Promise<{ accepted: number; rejected: number; invalidated: number }> };

export class MorningBriefService {
  constructor(private repo: MorningBriefRepository, private provider: MorningBriefProvider, private notifier: Notifier) {}
  private date() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo' }).format(new Date()); }
  async getOrCreateToday() {
    const date = this.date(); const existing = await this.repo.find(date);
    if (existing) { await this.repo.markShortcutAccessed(date, new Date().toISOString()); return { ...existing, created: false }; }
    const day = new Date(`${date}T00:00:00+09:00`).getDay().toString(); const settings = await this.repo.getSettings();
    const categories = settings.weekdays[day] || DEFAULT_WEEKDAYS[1]; const generated = await this.provider.generate(date, categories); const now = new Date().toISOString();
    const brief: Brief = { date, title: generated.title, speechText: generated.speechText, categories: generated.categories, sources: generated.sources, generatedAt: now, updatedAt: now, manuallyEditedAt: null, shortcutLastAccessedAt: now, pushStatus: 'pending', pushAccepted: 0, pushRejected: 0, pushInvalidated: 0, pushSentAt: null };
    await this.repo.insert(brief);
    try {
      const p = await this.notifier.send({ title: '晨报已准备好', body: '今天的晨报已经生成，点击查看或用快捷指令播报。', url: '/morning-brief', type: 'morning_brief' });
      const status = p.rejected ? 'partial' : 'sent'; await this.repo.updatePush(date, { status, accepted: p.accepted, rejected: p.rejected, invalidated: p.invalidated, sentAt: now });
      Object.assign(brief, { pushStatus: status, pushAccepted: p.accepted, pushRejected: p.rejected, pushInvalidated: p.invalidated, pushSentAt: now });
    } catch { await this.repo.updatePush(date, { status: 'failed', accepted: 0, rejected: 0, invalidated: 0, sentAt: null }); brief.pushStatus = 'failed'; }
    return { ...brief, created: true };
  }
  updateSpeechText(date: string, text: string) { return this.repo.updateSpeechText(date, text, new Date().toISOString()); }
  getSettings() { return this.repo.getSettings(); }
  updateSettings(w: Record<string, CategoryId[]>) { return this.repo.updateSettings(w); }
  history(n: number) { return this.repo.history(n); }
}
