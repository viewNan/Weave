import type { CategoryId } from '../config/content-policy.ts';
import { DEFAULT_WEEKDAYS } from '../config/content-policy.ts';
import type { Brief, MorningBriefRepository } from '../repositories/morning-brief-repository.ts';
import type { MorningBriefProvider } from './morning-brief-provider.ts';
import { todayJst, weekdayForJstDate } from '../server/jst-date.ts';

type Notifier = { send(input: { title: string; body: string; url: string; type: string }): Promise<{ accepted: number; rejected: number; invalidated: number }> };

export class MorningBriefService {
  private repo: MorningBriefRepository;
  private provider: MorningBriefProvider;
  private notifier: Notifier;
  constructor(repo: MorningBriefRepository, provider: MorningBriefProvider, notifier: Notifier) { this.repo = repo; this.provider = provider; this.notifier = notifier; }
  async getTodayForShortcut() {
    const date = todayJst(); const brief = await this.repo.find(date);
    if (!brief) return null;
    await this.repo.markShortcutAccessed(date, new Date().toISOString());
    return { ...brief, created: false };
  }
  async getOrCreateToday(client:'shortcut'|'admin'='shortcut') {
    const date=todayJst();const accessedAt=new Date().toISOString();const existing=await this.repo.find(date);
    if(existing){if(client==='shortcut')await this.repo.markShortcutAccessed(date,accessedAt);return {...existing,created:false};}
    const owner=crypto.randomUUID();const staleBefore=new Date(Date.now()-3*60_000).toISOString();if(!await this.repo.acquireGeneration(date,owner,staleBefore)){const completed=await this.repo.find(date);if(completed)return {...completed,created:false};throw new Error('Today’s brief is already being generated. Please retry shortly.');}
    try {const again=await this.repo.find(date);if(again)return {...again,created:false};const day=weekdayForJstDate(date);const settings=await this.repo.getSettings();
    const categories=settings.weekdays[day]||DEFAULT_WEEKDAYS[day];const generated=await this.provider.generate({date,categories,recentItems:await this.repo.recentItems(date,7)});const now=new Date().toISOString();
    const brief: Brief = { date, title: generated.title, speechText: generated.speechText, categories: generated.categories, sources: generated.sources, items:generated.items, generatedAt: now, updatedAt: now, manuallyEditedAt: null, shortcutLastAccessedAt: client==='shortcut'?accessedAt:null, pushStatus: 'pending', pushAccepted: 0, pushRejected: 0, pushInvalidated: 0, pushSentAt: null };
    await this.repo.insert(brief);
    try {
      const p = await this.notifier.send({ title: '晨报已准备好', body: '今天的晨报已经生成，点击查看或用快捷指令播报。', url: '/morning-brief', type: 'morning_brief' });
      const status = p.rejected ? 'partial' : 'sent'; await this.repo.updatePush(date, { status, accepted: p.accepted, rejected: p.rejected, invalidated: p.invalidated, sentAt: now });
      Object.assign(brief, { pushStatus: status, pushAccepted: p.accepted, pushRejected: p.rejected, pushInvalidated: p.invalidated, pushSentAt: now });
    } catch { await this.repo.updatePush(date, { status: 'failed', accepted: 0, rejected: 0, invalidated: 0, sentAt: null }); brief.pushStatus = 'failed'; }
    return { ...brief, created: true };
    } finally {await this.repo.releaseGeneration(date,owner);}
  }
  updateSpeechText(date: string, text: string) { return this.repo.updateSpeechText(date, text, new Date().toISOString()); }
  getSettings() { return this.repo.getSettings(); }
  updateSettings(w: Record<string, CategoryId[]>) { return this.repo.updateSettings(w); }
  history(n: number) { return this.repo.history(n); }
}
