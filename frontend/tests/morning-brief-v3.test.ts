import assert from 'node:assert/strict';
import test from 'node:test';
import { EDITORIAL_RULES, RUNTIME_PROMPT } from '../features/morning-brief/config/editorial-policy.ts';
import { validateGeneratedBrief } from '../features/morning-brief/services/validate-generated-brief.ts';
import { briefNotification } from '../features/morning-brief/services/brief-notification.ts';
import { OpenAIMorningBriefProvider } from '../features/morning-brief/infrastructure/openai-morning-brief-provider.ts';
import type { Brief } from '../features/morning-brief/repositories/morning-brief-repository.ts';

const news=(count:number)=>Array.from({length:count},(_,index)=>({category:'international',eventKey:`event-${index}`,headline:`国家${index}公布新的政策执行安排`,summary:'官方公布了具体实施日期和适用范围。',updateType:'new',materialUpdateReason:'',sourceUrls:[`https://example.com/news/${index}`]}));
const raw=(count:number)=>({title:'今日十大新闻',speechText:news(count).map(item=>`${item.headline}\n${item.summary}`).join('\n\n'),items:news(count)});
const saved=(count:number):Brief=>({...validateGeneratedBrief(raw(count)),date:'2026-10-26',generatedAt:'now',updatedAt:'now',manuallyEditedAt:null,shortcutLastAccessedAt:null,pushStatus:'pending',pushAccepted:0,pushRejected:0,pushInvalidated:0,pushSentAt:null});

test('public examples provide the runtime inputs without personal editorial requirements',()=>{
  assert.ok(EDITORIAL_RULES.trim());
  for(const field of ['reportDateJST','currentTimeJST','historyEvents'])assert.ok(RUNTIME_PROMPT.includes(`{{${field}}}`));
  assert.doesNotMatch(EDITORIAL_RULES,/京都|关西|用户住在|私人晨报编辑/);
});

for(const count of [8,10,12])test(`${count} news items determine the headline and a single exact opening`,()=>{
  const input=raw(count);input.speechText=`早上好，今天有3条重要新闻。\n\n**早上好！今天一共有十条重要新闻。**\n\n${input.speechText}`;
  const brief=validateGeneratedBrief(input);
  assert.equal(brief.title,input.items[0].headline);
  assert.equal(brief.speechText.split('\n\n')[0],`早上好，今天有${count}条重要新闻。`);
  assert.equal(brief.speechText.match(/早上好/g)?.length,1);
  assert.deepEqual(validateGeneratedBrief(brief),brief);
  assert.equal(input.title,'今日十大新闻');
});

test('sorting determines the headline, without category quotas or a 700-character ceiling',()=>{
  const input=raw(12);input.items.reverse();input.speechText='正文及重要背景。'.repeat(160);
  const brief=validateGeneratedBrief(input);
  assert.equal(brief.title,input.items[0].headline);assert.equal(brief.items.length,12);assert.ok(brief.speechText.length>700);
  assert.equal(validateGeneratedBrief(raw(1)).items.length,1);
  assert.throws(()=>validateGeneratedBrief({...raw(0),speechText:'没有有效新闻。'}),/invalid items/);
  assert.throws(()=>validateGeneratedBrief(raw(13)),/invalid items/);
  const missing=raw(1);missing.items[0].sourceUrls=[];assert.throws(()=>validateGeneratedBrief(missing),/invalid sources/);
});

test('notification uses saved headline and next ranked stories, with bounded length and legacy fallback',()=>{
  const brief=saved(10),original=structuredClone(brief);
  const notification=briefNotification(brief);
  assert.equal(notification.title,`全球晨报｜${brief.title}`);
  for(const item of brief.items.slice(1,4))assert.ok(notification.body.includes(item.headline));
  assert.equal(notification.url,'/morning-brief');assert.deepEqual(brief,original);
  assert.equal(briefNotification(saved(1)).body,saved(1).items[0].summary);
  const old={...brief,title:'旧版历史标题',speechText:'用户手动编辑的历史正文',items:[]};
  assert.equal(briefNotification(old).body,old.speechText);assert.equal(old.title,'旧版历史标题');
  assert.equal(briefNotification(old).title,'全球晨报｜旧版历史标题');
  const long=saved(4);long.items.forEach(item=>item.headline='非常长的新闻标题'.repeat(20));
  assert.ok(Array.from(briefNotification(long).body).length<=110);
});

test('a response without completed web search is rejected without replaying the request',async()=>{
  const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return new Response([
    {type:'response.output_text.delta',delta:JSON.stringify(raw(10))},{type:'response.completed'},
  ].map(event=>`data: ${JSON.stringify(event)}\n\n`).join(''));};
  try {await assert.rejects(new OpenAIMorningBriefProvider('test').generate({date:'2026-10-26',categories:['international'],recentItems:[]}),/requires a completed web search/);assert.equal(calls,1);}
  finally {globalThis.fetch=original;}
});
