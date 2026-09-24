import assert from 'node:assert/strict';
import test from 'node:test';
import { MorningBriefService } from '../features/morning-brief/services/morning-brief-service.ts';
import { validateGeneratedBrief } from '../features/morning-brief/services/validate-generated-brief.ts';
import type { Brief, MorningBriefRepository, Settings } from '../features/morning-brief/repositories/morning-brief-repository.ts';
import type { EditorialItem } from '../features/morning-brief/config/editorial-policy.ts';

const item: EditorialItem = { category: 'ai_tech', eventKey: 'openai-model-release', headline: '模型发布', summary: '正式发布了新的模型。', updateType: 'new', sourceUrls: ['https://example.com/release'] };

class MemoryRepository implements MorningBriefRepository {
  brief: Brief | null = null; calls = { provider: 0, push: 0, shortcut: 0 };
  async getSettings(): Promise<Settings> { return { timezone: 'Asia/Tokyo', weekdays: { 0:['ai_tech'],1:['ai_tech'],2:['ai_tech'],3:['ai_tech'],4:['ai_tech'],5:['ai_tech'],6:['ai_tech'] } }; }
  async updateSettings() {} async find() { return this.brief; } async insert(brief: Brief) { this.brief = brief; }
  async updateSpeechText(_date:string,text:string,at:string) { if (this.brief) this.brief = { ...this.brief, speechText:text, updatedAt:at, manuallyEditedAt:at }; return this.brief; }
  async markShortcutAccessed(_date:string,at:string) { this.calls.shortcut++; if (this.brief) this.brief.shortcutLastAccessedAt = at; }
  async updatePush(_date:string,result:{status:string;accepted:number;rejected:number;invalidated:number;sentAt:string|null}) { if (this.brief) Object.assign(this.brief, { pushStatus:result.status,pushAccepted:result.accepted,pushRejected:result.rejected,pushInvalidated:result.invalidated,pushSentAt:result.sentAt }); }
  async history() { return this.brief ? [this.brief] : []; } async recentItems() { return []; } async acquireGeneration() { return true; } async releaseGeneration() {}
}

test('morning brief generates once, preserves manual text, and distinguishes admin from Shortcut access', async () => {
  const repo = new MemoryRepository();
  const service = new MorningBriefService(repo, { generate: async () => { repo.calls.provider++; return { title:'今日晨报',speechText:'这是足够长的晨报内容。'.repeat(10),categories:['ai_tech'],sources:item.sourceUrls,items:[item] }; } }, { send: async () => { repo.calls.push++; return { accepted:1,rejected:0,invalidated:0 }; } });
  const first = await service.getOrCreateToday('admin');
  assert.equal(first.created, true); assert.equal(repo.calls.provider, 1); assert.equal(repo.calls.push, 1); assert.equal(first.shortcutLastAccessedAt, null);
  await service.updateSpeechText(first.date, '这是我手动写好的晨报。');
  const cached = await service.getOrCreateToday('shortcut');
  assert.equal(cached.created, false); assert.equal(cached.speechText, '这是我手动写好的晨报。'); assert.equal(repo.calls.provider, 1); assert.equal(repo.calls.push, 1); assert.equal(repo.calls.shortcut, 1);
});

test('shortcut only reads a prepared brief and never starts generation', async () => {
  const repo = new MemoryRepository();
  const service = new MorningBriefService(repo, { generate: async () => { repo.calls.provider++; throw new Error('must not generate'); } }, { send: async () => ({ accepted:0,rejected:0,invalidated:0 }) });
  assert.equal(await service.getTodayForShortcut(), null);
  assert.equal(repo.calls.provider, 0);
});

test('editorial validation rejects duplicate events and accepts a material update', () => {
  const valid = validateGeneratedBrief({ title:'晨报', speechText:'这是符合要求的中文晨报内容。'.repeat(8), items:[{ ...item, updateType:'material_update', materialUpdateReason:'官方公布了日期。' }] });
  assert.equal(valid.items[0].updateType, 'material_update');
  assert.throws(() => validateGeneratedBrief({ title:'晨报', speechText:'这是符合要求的中文晨报内容。'.repeat(8), items:[item, item] }), /duplicate/);
});
