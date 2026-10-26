import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { D1MorningBriefRepository } from '../features/morning-brief/infrastructure/d1-morning-brief-repository.ts';
import test from 'node:test';
import { MorningBriefService } from '../features/morning-brief/services/morning-brief-service.ts';
import { OpenAIMorningBriefProvider } from '../features/morning-brief/infrastructure/openai-morning-brief-provider.ts';
import { validateGeneratedBrief } from '../features/morning-brief/services/validate-generated-brief.ts';
import type { Brief, MorningBriefRepository } from '../features/morning-brief/repositories/morning-brief-repository.ts';
import type { EditorialItem } from '../features/morning-brief/config/editorial-policy.ts';

const item: EditorialItem = { category: 'ai_tech', eventKey: 'openai-model-release', headline: '模型发布', summary: '正式发布了新的模型。', updateType: 'new', sourceUrls: ['https://example.com/release'] };

class MemoryRepository implements MorningBriefRepository {
  locked=false;
  brief: Brief | null = null; calls = { provider: 0, push: 0, shortcut: 0 };
  async find() { return this.brief; } async insert(brief: Brief) { this.brief = brief; }
  async replace(brief:Brief, expectedUpdatedAt:string) { if(this.brief?.updatedAt!==expectedUpdatedAt)return false;this.brief=brief;return true; }
  async updateSpeechText(_date:string,text:string,at:string) { if (this.brief) this.brief = { ...this.brief, speechText:text, updatedAt:at, manuallyEditedAt:at }; return this.brief; }
  async markShortcutAccessed(_date:string,at:string) { this.calls.shortcut++; if (this.brief) this.brief.shortcutLastAccessedAt = at; }
  async updatePush(_date:string,result:{status:string;accepted:number;rejected:number;invalidated:number;sentAt:string|null}) { if (this.brief) Object.assign(this.brief, { pushStatus:result.status,pushAccepted:result.accepted,pushRejected:result.rejected,pushInvalidated:result.invalidated,pushSentAt:result.sentAt }); }
  async history() { return this.brief ? [this.brief] : []; } async recentItems() { return []; } async acquireGeneration() { if(this.locked)return false;this.locked=true;return true; } async releaseGeneration() {this.locked=false;}
}

test('morning brief generates once, preserves manual text, and distinguishes admin from Shortcut access', async () => {
  const repo = new MemoryRepository();
  let receivedCategories: string[] = [];
  const service = new MorningBriefService(repo, { generate: async ({ categories }) => { repo.calls.provider++; receivedCategories = categories; return { title:'今日晨报',speechText:'这是足够长的晨报内容。'.repeat(10),categories:['ai_tech'],sources:item.sourceUrls,items:[item] }; } }, { send: async () => { repo.calls.push++; return { accepted:1,rejected:0,invalidated:0 }; } });
  const first = await service.getOrCreateToday('admin');
  assert.equal(first.created, true); assert.deepEqual(receivedCategories, ['international','ai_tech','business_market','science_space','japan_life']); assert.equal(repo.calls.provider, 1); assert.equal(repo.calls.push, 0); assert.equal(first.shortcutLastAccessedAt, null);
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

test('scheduled brief pushes once after generation', async () => {
  const repo = new MemoryRepository();
  const service = new MorningBriefService(repo, { generate: async () => { repo.calls.provider++; return { title:'今日晨报',speechText:'这是足够长的晨报内容。'.repeat(10),categories:['ai_tech'],sources:item.sourceUrls,items:[item] }; } }, { send: async () => { repo.calls.push++; return { accepted:1,rejected:0,invalidated:0 }; } });
  const first = await service.generateAndPushToday();
  assert.equal(first.pushStatus, 'sent');
  assert.equal(repo.calls.provider, 1);
  assert.equal(repo.calls.push, 1);
  await service.generateAndPushToday();
  assert.equal(repo.calls.provider, 1);
  assert.equal(repo.calls.push, 1);
});

test('push uses saved ranked news without another model call and preserves manual edits and history', async()=>{
  const repo=new MemoryRepository();let calls=0;const delivered:any[]=[];
  const service=new MorningBriefService(repo,{generate:async()=>{calls++;return {title:'无意义的总标题',speechText:'具体新闻正文',categories:['ai_tech'],sources:item.sourceUrls,items:[item,{...item,eventKey:'second-event',headline:'另一家公司正式发布新芯片'}]};}},{send:async input=>{delivered.push(input);return {accepted:1,rejected:0,invalidated:0};}});
  const brief=await service.getOrCreateToday('admin');
  await service.updateSpeechText(brief.date,'用户手动保存的正文，不应被标题和开头规范化改写');
  await service.pushToday();await service.getOrCreateToday('admin');
  assert.equal(calls,1);assert.equal(delivered.length,1);
  assert.equal(delivered[0].title,`全球晨报｜${repo.brief!.title}`);
  assert.equal(delivered[0].body,'另一家公司正式发布新芯片');
  assert.equal((await service.history(7))[0].speechText,'用户手动保存的正文，不应被标题和开头规范化改写');
  assert.equal((await service.getTodayForShortcut())?.speechText,repo.brief?.speechText);
});

test('a push with no subscribers is not marked sent', async () => {
  const repo = new MemoryRepository();
  const service = new MorningBriefService(repo, { generate: async () => ({ title:'今日晨报',speechText:'这是足够长的晨报内容。'.repeat(10),categories:['ai_tech'],sources:item.sourceUrls,items:[item] }) }, { send: async () => ({ accepted:0,rejected:0,invalidated:0 }) });
  assert.equal((await service.generateAndPushToday()).pushStatus, 'failed');
});

test('stopping morning brief notifications preserves content and allows restart', async () => {
  const repo = new MemoryRepository();let stopped=true;
  const service = new MorningBriefService(repo, { generate: async () => ({ title:'今日晨报',speechText:'这是足够长的晨报内容。'.repeat(10),categories:['ai_tech'],sources:item.sourceUrls,items:[item] }) }, { send: async () => ({ accepted:stopped?0:1,rejected:0,invalidated:0,skipped:stopped }) });
  const brief = await service.generateAndPushToday();
  assert.equal(brief.pushStatus,'pending');
  assert.equal(repo.brief?.title,item.headline);
  stopped=false;
  assert.equal((await service.pushToday()).pushStatus,'sent');
});

test('stopped morning brief blocks manual and scheduled generation, retains archive and resumes', async () => {
  const repo=new MemoryRepository();let enabled=false;
  const service=new MorningBriefService(repo, {generate:async()=>{repo.calls.provider++;return {title:'今日晨报',speechText:'已保存的内容',categories:['ai_tech'],sources:item.sourceUrls,items:[item]};}}, {send:async()=>{repo.calls.push++;return {accepted:1,rejected:0,invalidated:0};}}, {async read(){return {morning_brief:enabled,daily_recipe:true};}});
  await assert.rejects(service.getOrCreateToday('admin'),/功能已停止/);
  await assert.rejects(service.getOrCreateToday('shortcut'),/功能已停止/);
  await assert.rejects(service.generateAndPushToday(),/功能已停止/);
  await assert.rejects(service.pushToday(),/功能已停止/);
  assert.equal(repo.calls.provider,0);assert.equal(repo.calls.push,0);
  enabled=true;
  await service.generateAndPushToday();
  assert.equal(repo.calls.provider,1);assert.equal(repo.calls.push,1);
  enabled=false;
  assert.equal((await service.getTodayForShortcut())?.title,item.headline);
  assert.equal((await service.getOrCreateToday('admin')).title,item.headline);
  assert.equal((await service.history(10)).length,1);
  await assert.rejects(service.generateAndPushToday(),/功能已停止/);
  await assert.rejects(service.pushToday(),/功能已停止/);
  assert.equal(repo.calls.provider,1);assert.equal(repo.calls.push,1);
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

test('regeneration passes user instructions and saved draft, replaces content, and does not push', async () => {
  const repo=new MemoryRepository();let received:unknown;
  const service=new MorningBriefService(repo,{generate:async input=>{received=input;return {title:input.previousBrief?'新的具体标题':'原始标题',speechText:'完整的播报正文',categories:['ai_tech'],sources:item.sourceUrls,items:[item]};}}, {send:async()=>{repo.calls.push++;return {accepted:1,rejected:0,invalidated:0};}});
  await service.getOrCreateToday('admin');
  await service.updateSpeechText(repo.brief!.date,'用户保存的原稿');
  const regenerated=await service.regenerateToday('  增加京都的展览，减少行业消息  ');
  assert.equal((received as any).instructions,'增加京都的展览，减少行业消息');
  assert.deepEqual((received as any).previousBrief,{title:item.headline,speechText:'用户保存的原稿'});
  assert.equal(regenerated.title,item.headline);assert.equal(repo.brief?.title,regenerated.title);
  assert.equal(regenerated.manuallyEditedAt,null);assert.equal(regenerated.pushStatus,'pending');
  assert.equal(repo.calls.push,0);assert.equal(repo.locked,false);
});

test('regeneration failure, concurrent requests, and edits leave the original draft safe', async () => {
  const repo=new MemoryRepository();let fail=false,edit=false,wait:Promise<void>|undefined,started!:()=>void;
  const service=new MorningBriefService(repo,{generate:async()=>{if(wait){started();await wait;}if(fail)throw new Error('provider failed');if(edit)await repo.updateSpeechText(repo.brief!.date,'另一页面的修改','new-revision');return {title:'新稿',speechText:'完整正文',categories:['ai_tech'],sources:item.sourceUrls,items:[item]};}}, {send:async()=>({accepted:1,rejected:0,invalidated:0})});
  await service.getOrCreateToday('admin');const original=structuredClone(repo.brief);
  fail=true;await assert.rejects(service.regenerateToday('重写'),/provider failed/);
  assert.deepEqual(repo.brief,original);assert.equal(repo.locked,false);
  fail=false;let release!:()=>void;const entered=new Promise<void>(resolve=>started=resolve);wait=new Promise<void>(resolve=>release=resolve);
  const first=service.regenerateToday('重写');await entered;
  await assert.rejects(service.regenerateToday('重复点击'),/正在生成/);
  release();await first;wait=undefined;
  edit=true;await assert.rejects(service.regenerateToday('重写'),/原稿已被修改/);
  assert.equal(repo.brief?.speechText,'另一页面的修改');assert.equal(repo.locked,false);
});

test('regeneration requires an existing draft and obeys the feature switch before calling the provider', async () => {
  const repo=new MemoryRepository();let calls=0,enabled=true;
  const service=new MorningBriefService(repo,{generate:async()=>{calls++;throw new Error('must not call');}}, {send:async()=>({accepted:0,rejected:0,invalidated:0})}, {read:async()=>({morning_brief:enabled,daily_recipe:true})});
  await assert.rejects(service.regenerateToday('补充'),/还没有播报/);assert.equal(calls,0);assert.equal(repo.locked,false);
  enabled=false;await assert.rejects(service.regenerateToday('补充'),/功能已停止/);
  await assert.rejects(service.regenerateToday('长'.repeat(2001)),/2000/);assert.equal(calls,0);
});

test('OpenAI regeneration request includes supplemental instructions and previous content', async () => {
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async(_url,options)=>{
    calls++;const body=JSON.parse(options!.body as string);
    assert.match(body.input,/增加京都展览/);assert.match(body.input,/原稿内容/);
    assert.equal(body.store,false);
    const generated={title:'京都展览有新安排',speechText:'这是足够长的完整播报正文。'.repeat(10),items:[item]};
    const events=[{type:'response.web_search_call.completed'},{type:'response.output_text.delta',delta:JSON.stringify(generated)},{type:'response.completed',response:{id:'test'}}];
    return new Response(events.map(event=>`data: ${JSON.stringify(event)}\n\n`).join(''),{headers:{'content-type':'text/event-stream'}});
  };
  try {await new OpenAIMorningBriefProvider('test-key').generate({date:'2026-10-26',categories:['japan_life'],recentItems:[],instructions:'增加京都展览',previousBrief:{title:'旧标题',speechText:'原稿内容'}});assert.equal(calls,1);}
  finally {globalThis.fetch=original;}
});

test('database replaces a complete brief atomically and rejects a stale replacement', async () => {
  const sql=new DatabaseSync(':memory:');
  try {
    for(const name of ['0002_morning_brief.sql','0003_morning_brief_editorial.sql'])sql.exec(readFileSync(new URL(`../migrations/${name}`,import.meta.url),'utf8'));
    const repo=new D1MorningBriefRepository({prepare(query){return {bind(...values:any[]){const statement=sql.prepare(query);return {
      async first<T>(){return (statement.get(...values) as T)??null;},async all<T>(){return {results:statement.all(...values) as T[]};},async run(){return {meta:{changes:Number(statement.run(...values).changes)}};},
    };}};}});
    const old:Brief={date:'2026-10-26',title:'旧稿',speechText:'旧正文',categories:[],sources:item.sourceUrls,items:[item],generatedAt:'old',updatedAt:'old',manuallyEditedAt:'old',shortcutLastAccessedAt:'access',pushStatus:'sent',pushAccepted:1,pushRejected:0,pushInvalidated:0,pushSentAt:'old'};
    await repo.insert(old);
    const next={...old,title:'新稿',speechText:'新正文',items:[item],sources:item.sourceUrls,generatedAt:'new',updatedAt:'new'};
    assert.equal(await repo.replace(next,'old'),true);
    const saved=await repo.find(old.date);
    assert.equal(saved?.title,'新稿');assert.deepEqual(saved?.items,[item]);assert.equal(saved?.pushStatus,'pending');assert.equal(saved?.pushSentAt,null);assert.equal(saved?.pushAccepted,0);assert.equal(saved?.manuallyEditedAt,null);assert.equal(saved?.shortcutLastAccessedAt,'access');
    assert.equal(await repo.replace({...next,title:'过期覆盖'},'old'),false);
    assert.equal((await repo.find(old.date))?.title,'新稿');
  } finally {sql.close();}
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
  const payload = JSON.stringify({ title:'今日晨报', speechText:'这是符合要求的中文晨报内容。'.repeat(8), items:[item] });
  globalThis.fetch = async (_input, init) => {
    request = JSON.parse(String(init?.body));
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({ start(controller) {
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({type:'response.web_search_call.completed'})}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type:'response.output_text.delta', delta:payload })}\n\n`));
      controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type:'response.completed' })}\n\n`));
      controller.close();
    } });
    return new Response(body, { status:200, headers:{ 'content-type':'text/event-stream' } });
  };
  try {
    const result = await new OpenAIMorningBriefProvider('test-key').generate({ date:'2026-09-25', categories:['ai_tech'], recentItems:[{...item,summary:"价格中的 $& 和 $' 必须原样保留"}] });
    assert.equal(result.title, item.headline); assert.equal(request.stream, true); assert.deepEqual(request.reasoning, { effort:'low' }); assert.equal(request.max_output_tokens, 12000); assert.equal(request.tool_choice,'required'); assert.match(request.instructions,/每天通常选择 8–12 条新闻/); assert.doesNotMatch(request.input,/300–700|最多 2 条|\{\{/); assert.match(request.input,/2026-09-25/); assert.ok(request.input.includes("价格中的 $& 和 $' 必须原样保留"));
  } finally { globalThis.fetch = fetch; }
});

test('editorial validation rejects duplicate events and accepts a material update', () => {
  const valid = validateGeneratedBrief({ title:'晨报', speechText:'这是符合要求的中文晨报内容。'.repeat(8), items:[{ ...item, updateType:'material_update', materialUpdateReason:'官方公布了日期。' }] });
  assert.equal(valid.items[0].updateType, 'material_update');
  assert.throws(() => validateGeneratedBrief({ title:'晨报', speechText:'这是符合要求的中文晨报内容。'.repeat(8), items:[item, item] }), /duplicate/);
});
