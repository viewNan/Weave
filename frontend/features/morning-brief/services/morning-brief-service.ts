import { DAILY_CATEGORIES } from '../config/content-policy.ts';
import type { Brief, MorningBriefRepository } from '../repositories/morning-brief-repository.ts';
import type { MorningBriefProvider } from './morning-brief-provider.ts';
import { todayJst } from '../server/jst-date.ts';
import type { FeaturePreferences } from '../../push/preferences.ts';
import { validateGeneratedBrief } from './validate-generated-brief.ts';
import { briefNotification } from './brief-notification.ts';

type Notifier = { send(input: { title: string; body: string; url: string; type: string }): Promise<{ accepted: number; rejected: number; invalidated: number; skipped?: boolean }> };

export class MorningBriefService {
  private repo: MorningBriefRepository;
  private provider: MorningBriefProvider;
  private notifier: Notifier;
  private preferences?: FeaturePreferences;
  constructor(repo: MorningBriefRepository, provider: MorningBriefProvider, notifier: Notifier, preferences?: FeaturePreferences) { this.repo = repo; this.provider = provider; this.notifier = notifier; this.preferences = preferences; }
  private async requireEnabled() {
    if (this.preferences && !(await this.preferences.read()).morning_brief) throw new Error('每日晨报功能已停止，AI API 调用已暂停。请在设置中开启功能。');
  }
  async getTodayForShortcut() {
    const date = todayJst(); const brief = await this.repo.find(date);
    if (!brief) return null;
    await this.repo.markShortcutAccessed(date, new Date().toISOString());
    return { ...brief, created: false };
  }
  async getOrCreateToday(client:'shortcut'|'admin'='shortcut') {
    const date=todayJst();const accessedAt=new Date().toISOString();const existing=await this.repo.find(date);
    if(existing){if(client==='shortcut')await this.repo.markShortcutAccessed(date,accessedAt);return {...existing,created:false};}
    await this.requireEnabled();
    const owner=crypto.randomUUID();const staleBefore=new Date(Date.now()-6*60_000).toISOString();if(!await this.repo.acquireGeneration(date,owner,staleBefore)){const completed=await this.repo.find(date);if(completed)return {...completed,created:false};throw new Error('Today’s brief is already being generated. Please retry shortly.');}
    try {const again=await this.repo.find(date);if(again)return {...again,created:false};
    const recentItems=await this.repo.recentItems(date,7);
    await this.requireEnabled();
    const generated=validateGeneratedBrief(await this.provider.generate({date,categories:DAILY_CATEGORIES,recentItems}));const now=new Date().toISOString();
    const brief: Brief = { date, title: generated.title, speechText: generated.speechText, categories: generated.categories, sources: generated.sources, items:generated.items, generatedAt: now, updatedAt: now, manuallyEditedAt: null, shortcutLastAccessedAt: client==='shortcut'?accessedAt:null, pushStatus: 'pending', pushAccepted: 0, pushRejected: 0, pushInvalidated: 0, pushSentAt: null };
    await this.repo.insert(brief);
    return { ...brief, created: true };
    } finally {await this.repo.releaseGeneration(date,owner);}
  }
  async generateAndPushToday() {
    await this.requireEnabled();
    const brief = await this.getOrCreateToday('admin');
    return brief.pushStatus === 'pending' ? this.pushToday() : brief;
  }
  async regenerateToday(instructions: string) {
    if (typeof instructions !== 'string' || instructions.trim().length > 2000) throw new Error('补充提示不能超过2000字。');
    await this.requireEnabled();
    const date=todayJst(),owner=crypto.randomUUID();
    if (!await this.repo.acquireGeneration(date,owner,new Date(Date.now()-6*60_000).toISOString())) throw new Error('今日播报正在生成，请稍候再试。');
    try {
      const previous=await this.repo.find(date);
      if (!previous) throw new Error('今天还没有播报，请先生成今日晨报。');
      const recentItems=await this.repo.recentItems(date,7);
      await this.requireEnabled();
      const generated=validateGeneratedBrief(await this.provider.generate({date,categories:DAILY_CATEGORIES,recentItems,instructions:instructions.trim(),previousBrief:{title:previous.title,speechText:previous.speechText}}));
      const now=new Date().toISOString();
      const brief:Brief={...previous,...generated,generatedAt:now,updatedAt:now,manuallyEditedAt:null,pushStatus:'pending',pushAccepted:0,pushRejected:0,pushInvalidated:0,pushSentAt:null};
      if (!await this.repo.replace(brief,previous.updatedAt)) throw new Error('生成期间原稿已被修改，新结果未覆盖原稿，请刷新后重试。');
      return brief;
    } finally {await this.repo.releaseGeneration(date,owner);}
  }
  async pushToday() {
    await this.requireEnabled();
    const date = todayJst(); const brief = await this.repo.find(date); if (!brief) throw new Error('今天还没有可推送的晨报。');
    try { const p = await this.notifier.send(briefNotification(brief)); if (p.skipped) return brief; const status = !p.accepted ? 'failed' : p.rejected ? 'partial' : 'sent'; await this.repo.updatePush(date, { status, accepted:p.accepted, rejected:p.rejected, invalidated:p.invalidated, sentAt:new Date().toISOString() }); return { ...brief, pushStatus:status, pushAccepted:p.accepted, pushRejected:p.rejected, pushInvalidated:p.invalidated, pushSentAt:new Date().toISOString() }; }
    catch { await this.repo.updatePush(date, { status:'failed', accepted:0, rejected:0, invalidated:0, sentAt:null }); return { ...brief, pushStatus:'failed' }; }
  }
  updateSpeechText(date: string, text: string) { return this.repo.updateSpeechText(date, text, new Date().toISOString()); }
  history(n: number) { return this.repo.history(n); }
}
