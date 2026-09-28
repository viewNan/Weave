import assert from 'node:assert/strict';
import test from 'node:test';
import { MorningBriefService } from '../features/morning-brief/services/morning-brief-service.ts';
import { OpenAIMorningBriefProvider } from '../features/morning-brief/infrastructure/openai-morning-brief-provider.ts';
import { validateGeneratedBrief } from '../features/morning-brief/services/validate-generated-brief.ts';
import type { Brief, MorningBriefRepository } from '../features/morning-brief/repositories/morning-brief-repository.ts';
import type { EditorialItem } from '../features/morning-brief/config/editorial-policy.ts';

const item: EditorialItem = { category: 'ai_tech', eventKey: 'openai-model-release', headline: '模型发布', summary: '正式发布了新的模型。', updateType: 'new', sourceUrls: ['https://example.com/release'] };

class MemoryRepository implements MorningBriefRepository {
  brief: Brief | null = null; calls = { provider: 0, push: 0, shortcut: 0 };
  async find() { return this.brief; } async insert(brief: Brief) { this.brief = brief; }
  async updateSpeechText(_date:string,text:string,at:string) { if (this.brief) this.brief = { ...this.brief, speechText:text, updatedAt:at, manuallyEditedAt:at }; return this.brief; }
  async markShortcutAccessed(_date:string,at:string) { this.calls.shortcut++; if (this.brief) this.brief.shortcutLastAccessedAt = at; }
  async updatePush(_date:string,result:{status:string;accepted:number;rejected:number;invalidated:number;sentAt:string|null}) { if (this.brief) Object.assign(this.brief, { pushStatus:result.status,pushAccepted:result.accepted,pushRejected:result.rejected,pushInvalidated:result.invalidated,pushSentAt:result.sentAt }); }
  async history() { return this.brief ? [this.brief] : []; } async recentItems() { return []; } async acquireGeneration() { return true; } async releaseGeneration() {}
}

test('morning brief generates once, preserves manual text, and distinguishes admin from Shortcut access', async () => {
  const repo = new MemoryRepository();
  let receivedCategories: string[] = [];
  const service = new MorningBriefService(repo, { generate: async ({ categories }) => { repo.calls.provider++; receivedCategories = categories; return { title:'今日晨报',speechText:'这是足够长的晨报内容。'.repeat(10),categories:['ai_tech'],sources:item.sourceUrls,items:[item] }; } }, { send: async () => { repo.calls.push++; return { accepted:1,rejected:0,invalidated:0 }; } });
  const first = await service.getOrCreateToday('admin');
  assert.equal(first.created, true); assert.deepEqual(receivedCategories, ['ai_tech','japan_life','international','developer']); assert.equal(repo.calls.provider, 1); assert.equal(repo.calls.push, 0); assert.equal(first.shortcutLastAccessedAt, null);
  await service.updateSpeechText(first.date, '这是我手动写好的晨报。');
  const cached = await service.getOrCreateToday('shortcut');
  assert.equal(cached.created, false); assert.equal(cached.speechText, '这是我手动写好的晨报。'); assert.equal(repo.calls.provider, 1); assert.equal(repo.calls.push, 0); assert.equal(repo.calls.shortcut, 1);
  const pushed = await service.pushToday(); assert.equal(repo.calls.push, 1); assert.equal(pushed.pushStatus, 'sent');
});

test('shortcut only reads a prepared brief and never starts generation', async () => {
  const repo = new MemoryRepository();
  const service = new MorningBriefService(repo, { generate: async () => { repo.calls.provider++; throw new Error('must not generate'); } }, { send: async () => ({ accepted:0,rejected:0,invalidated:0 }) });
  assert.equal(await service.getTodayForShortcut(), null);
  assert.equal(repo.calls.provider, 0);
});

test('OpenAI provider does not replay an indeterminate failed request', async () => {
  const fetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw new TypeError('offline'); };
  try {
    const provider = new OpenAIMorningBriefProvider('test-key');
    await assert.rejects(provider.generate({ date:'2026-09-25', categories:['ai_tech'], recentItems:[] }), /offline/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = fetch; }
});

test('OpenAI provider does not replay a stream that fails after a 200 response', async () => {
  const fetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type:'response.failed', response:{error:{code:'server_error',message:'failed'}} })}\n\n`)); controller.close(); } }), { status:200 }); };
  try {
    await assert.rejects(new OpenAIMorningBriefProvider('test-key').generate({ date:'2026-09-25', categories:['ai_tech'], recentItems:[] }), /server_error/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = fetch; }
});

test('OpenAI provider reports an incomplete stream reason without replaying it', async () => {
  const fetch = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; return new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ type:'response.incomplete', response:{incomplete_details:{reason:'max_output_tokens'}} })}\n\n`)); controller.close(); } }), { status:200 }); };
  try {
    await assert.rejects(new OpenAIMorningBriefProvider('test-key').generate({ date:'2026-09-25', categories:['ai_tech'], recentItems:[] }), /incomplete \(max_output_tokens\)/);
    assert.equal(calls, 1);
  } finally { globalThis.fetch = fetch; }
});

test('OpenAI provider exposes safe API failure metadata', async () => {
  const fetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ error:{ type:'invalid_request_error', code:'invalid_schema' } }), { status:400, headers:{ 'x-request-id':'req_test_123' } });
  try {
    const provider = new OpenAIMorningBriefProvider('test-key');
    await assert.rejects(provider.generate({ date:'2026-09-25', categories:['ai_tech'], recentItems:[] }), /400, invalid_request_error, invalid_schema, request req_test_123/);
  } finally { globalThis.fetch = fetch; }
});

test('OpenAI provider consumes streamed output with low-cost reasoning', async () => {
  const fetch = globalThis.fetch; let request: any;
  const payload = JSON.stringify({ title:'今日晨报', speechText:'这是符合要求的中文晨报内容。'.repeat(8), items:[] });
  globalThis.fetch = async (_input, init) => {
    request = JSON.parse(String(init?.body));
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type:'response.output_text.delta', delta:payload })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type:'response.completed' })}\n\n`));
      controller.close();
    } });
    return new Response(body, { status:200, headers:{ 'content-type':'text/event-stream' } });
  };
  try {
    const result = await new OpenAIMorningBriefProvider('test-key').generate({ date:'2026-09-25', categories:['ai_tech'], recentItems:[] });
    assert.equal(result.title, '今日晨报'); assert.equal(request.stream, true); assert.deepEqual(request.reasoning, { effort:'low' }); assert.equal(request.max_output_tokens, 4000); assert.match(request.input, /通常 300–700 字/); assert.match(request.input, /绝不为了达到长度加入次要事件/); assert.match(request.input, /绝对不要出现 URL/);
  } finally { globalThis.fetch = fetch; }
});

test('editorial validation rejects duplicate events and accepts a material update', () => {
  const valid = validateGeneratedBrief({ title:'晨报', speechText:'这是符合要求的中文晨报内容。'.repeat(8), items:[{ ...item, updateType:'material_update', materialUpdateReason:'官方公布了日期。' }] });
  assert.equal(valid.items[0].updateType, 'material_update');
  assert.throws(() => validateGeneratedBrief({ title:'晨报', speechText:'这是符合要求的中文晨报内容。'.repeat(8), items:[item, item] }), /duplicate/);
});
