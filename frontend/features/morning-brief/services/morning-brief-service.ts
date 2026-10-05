import { DAILY_CATEGORIES } from '../config/content-policy.ts';
import type { Brief, MorningBriefRepository } from '../repositories/morning-brief-repository.ts';
import type { MorningBriefProvider } from './morning-brief-provider.ts';
import { todayJst } from '../server/jst-date.ts';

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
    const owner=crypto.randomUUID();const staleBefore=new Date(Date.now()-6*60_000).toISOString();if(!await this.repo.acquireGeneration(date,owner,staleBefore)){const completed=await this.repo.find(date);if(completed)return {...completed,created:false};throw new Error('Today’s brief is already being generated. Please retry shortly.');}
    try {const again=await this.repo.find(date);if(again)return {...again,created:false};
    const generated=await this.provider.generate({date,categories:DAILY_CATEGORIES,recentItems:await this.repo.recentItems(date,7)});const now=new Date().toISOString();
    const brief: Brief = { date, title: generated.title, speechText: generated.speechText, categories: generated.categories, sources: generated.sources, items:generated.items, generatedAt: now, updatedAt: now, manuallyEditedAt: null, shortcutLastAccessedAt: client==='shortcut'?accessedAt:null, pushStatus: 'pending', pushAccepted: 0, pushRejected: 0, pushInvalidated: 0, pushSentAt: null };
    await this.repo.insert(brief);
    return { ...brief, created: true };
    } finally {await this.repo.releaseGeneration(date,owner);}
  }
  async generateAndPushToday() {
    const brief = await this.getOrCreateToday('admin');
    return brief.pushStatus === 'pending' ? this.pushToday() : brief;
  }
  async pushToday() {
    const date = todayJst(); const brief = await this.repo.find(date); if (!brief) throw new Error('今天还没有可推送的晨报。');
    try { const p = await this.notifier.send({ title: '晨报已准备好', body: '今天的晨报已经生成，点击查看或用快捷指令播报。', url: '/morning-brief', type: 'morning_brief' }); const status = !p.accepted ? 'failed' : p.rejected ? 'partial' : 'sent'; await this.repo.updatePush(date, { status, accepted:p.accepted, rejected:p.rejected, invalidated:p.invalidated, sentAt:new Date().toISOString() }); return { ...brief, pushStatus:status, pushAccepted:p.accepted, pushRejected:p.rejected, pushInvalidated:p.invalidated, pushSentAt:new Date().toISOString() }; }
    catch { await this.repo.updatePush(date, { status:'failed', accepted:0, rejected:0, invalidated:0, sentAt:null }); return { ...brief, pushStatus:'failed' }; }
  }
  updateSpeechText(date: string, text: string) { return this.repo.updateSpeechText(date, text, new Date().toISOString()); }
  history(n: number) { return this.repo.history(n); }
}
