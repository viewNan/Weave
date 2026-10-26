import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { RecipeService, type RecipeDatabase } from '../features/recipes/services/recipe-service.ts';
import { buildMemory, validDate } from '../features/recipes/domain.ts';
import { parseCandidates } from '../features/recipes/services/generate-candidates.ts';
import { localDevelopment, requireSameOrigin } from '../features/recipes/server/auth.ts';
import { todayJst } from '../features/morning-brief/server/jst-date.ts';

function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  for (const name of ['0002_recipes.sql','0003_meal_ratings.sql']) sql.exec(readFileSync(new URL(`../migrations/${name}`, import.meta.url), 'utf8'));
  const migrate = () => sql.exec(readFileSync(new URL('../migrations/0006_recipe_reliability.sql', import.meta.url), 'utf8'));
  const db: RecipeDatabase = { prepare(query) { return { bind(...values: any[]) { const statement = sql.prepare(query); return {
    async first<T>() { return (statement.get(...values) as T) ?? null; },
    async all<T>() { return { results: statement.all(...values) as T[] }; },
    async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
  }; } }; } };
  return { sql, db, migrate };
}
const candidates = [0,1,2].map(i => ({ title: `菜${i}`, cuisine:'家常',minutes:20,difficulty:'简单',reason:'工作日快捷',markdown:'## 材料\n鸡肉\n## 做法\n煮熟' }));
const output = () => ({ id:'resp_test',status:'completed',output:[{type:'reasoning',summary:[]},{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates})}]}] });

test('migration preserves duplicates but only exposes one active meal; clear does not resurrect old rows', async () => {
  const { sql, db, migrate } = database();
  sql.exec("INSERT INTO meal_logs(id,meal_date,meal_name,source,created_at) VALUES ('a','2026-09-28','旧菜','freeform','2026-09-28T01:00:00Z'),('b','2026-09-28','新菜','freeform','2026-09-28T02:00:00Z')");
  migrate(); const service = new RecipeService(db);
  const current = (await service.todayMeal('2026-09-28'))!;
  assert.equal(current.id,'b'); await service.clearMeal(current.date,current.id,current.revision);
  assert.equal(await service.todayMeal(current.date),null);
  assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM meal_logs').get()?.n,2);
  sql.close();
});
test('meal without recommendation persists, duplicates conflict, stale edits fail and replacement resets rating/source', async () => {
  const { sql, db, migrate } = database();migrate();const service=new RecipeService(db); const date=todayJst();
  const first=(await service.logMeal(date,{name:'鸡肉',source:'freeform',recipeId:'forged'}))!;
  assert.equal(await service.daily(),null);assert.equal(first.recipeId,null);
  await assert.rejects(service.logMeal(date,{name:'重复',source:'freeform'}),/已有/);
  const rated=(await service.rateMeal(date,first.id,first.revision,5))!;
  await assert.rejects(service.clearMeal(date,first.id,first.revision),/已被修改/);
  const fixed=(await service.updateMeal(date,rated.id,rated.revision,'edit',{name:'鸡腿肉',source:'freeform'}))!;
  assert.equal(fixed.rating,5);
  const replaced=(await service.updateMeal(date,fixed.id,fixed.revision,'replace',{name:'拉面',source:'freeform'}))!;
  assert.equal(replaced.rating,null);assert.equal(replaced.recipeId,null);assert.equal(replaced.recommendationDate,null);
  assert.equal((await new RecipeService(db).todayMeal(date))?.name,'拉面');
  const memory=await service.memory(date);assert.equal(memory.observations[0].name,'拉面');assert.equal(memory.observations[0].ratedCount,0);
  await service.clearMeal(date,replaced.id,replaced.revision);assert.equal((await service.memory(date)).recentMeals.length,0);
  await assert.rejects(service.rateMeal(date,replaced.id,replaced.revision,1),/已被修改/);
  sql.close();
});
test('recommendation and library attribution are resolved on server and selection persists', async () => {
  const { sql, db, migrate }=database();migrate();const service=new RecipeService(db);const date=todayJst();
  sql.prepare('INSERT INTO daily_recipe_recommendations(recommendation_date,candidates_json,generated_at) VALUES (?,?,?)').run(date,JSON.stringify(candidates),'now');
  await service.select(2,date);assert.equal((await service.daily())?.selectedIndex,2);
  const logged=(await service.logMeal(date,{source:'recommended',candidateIndex:2,name:'forged'}))!;
  assert.equal(logged.name,'菜2');assert.equal(logged.candidateIndex,2);
  await assert.rejects(service.select(3,date),/无效/);
  await service.rateMeal(date,logged.id,logged.revision,4);
  const recipe=await service.saveRecipe({title:'番茄饭',tags:['番茄'],markdown:'煮饭',minutes:20});
  const current=(await service.todayMeal(date))!;
  const next=(await service.updateMeal(date,current.id,current.revision,'replace',{source:'library',recipeId:recipe!.id}))!;
  assert.equal(next.source,'library');assert.equal(next.name,'番茄饭');assert.equal(next.rating,null);assert.equal(next.candidateIndex,null);
  sql.close();
});
test('Responses parser reads nested output and rejects incomplete, duplicate and malformed results', () => {
  assert.equal(parseCandidates(output()).length,3);
  assert.throws(()=>parseCandidates({...output(),status:'incomplete'}));
  assert.throws(()=>parseCandidates({status:'completed',output_text:JSON.stringify({candidates})}));
  assert.throws(()=>parseCandidates({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({candidates:[candidates[0],candidates[0],candidates[2]]})}]}]}));
  assert.throws(()=>validDate('2026-02-30'));
});
test('concurrent generation calls pay once, persist context, and reuse saved recommendation', async () => {
  const { sql, db, migrate }=database();migrate();const service=new RecipeService(db,'test-key');
  const original=globalThis.fetch;let calls=0;let release!:()=>void;let started!:()=>void;
  const gate=new Promise<void>(resolve=>release=resolve),entered=new Promise<void>(resolve=>started=resolve);
  globalThis.fetch=async (_url,options)=>{calls++;assert.equal(JSON.parse(options!.body as string).store,false);started();await gate;return Response.json(output());};
  try {
    const first=service.getOrCreateDaily();await entered;
    await assert.rejects(service.getOrCreateDaily(),/正在生成/);release();await first;
    await service.getOrCreateDaily();assert.equal(calls,1);
    const row=sql.prepare('SELECT * FROM daily_recipe_recommendations').get()!;
    assert.equal(row.origin,'ai');assert.equal(JSON.parse(row.context_json as string).version,'recipe-context-v1');
  } finally {release();globalThis.fetch=original;sql.close();}
});
test('failed generation stores no fake menu and does not retry without explicit cooldown-controlled request', async () => {
  const { sql, db, migrate }=database();migrate();const service=new RecipeService(db,'test-key');const original=globalThis.fetch;let calls=0;
  globalThis.fetch=async()=>{calls++;return Response.json({error:'failure'},{status:503});};
  try {
    await assert.rejects(service.getOrCreateDaily());assert.equal(await service.daily(),null);
    await assert.rejects(service.getOrCreateDaily());await assert.rejects(service.getOrCreateDaily(true));assert.equal(calls,1);
    sql.exec("UPDATE recipe_generation_runs SET started_at='2000-01-01T00:00:00Z'");
    globalThis.fetch=async()=>{calls++;return Response.json(output());};await service.getOrCreateDaily(true);assert.equal(calls,2);
  } finally {globalThis.fetch=original;sql.close();}
});
test('push is claimed once, no subscribers is failure rather than sent', async () => {
  const { sql, db, migrate }=database();migrate();const date=todayJst();let calls=0;
  sql.prepare('INSERT INTO daily_recipe_recommendations(recommendation_date,candidates_json,generated_at) VALUES (?,?,?)').run(date,JSON.stringify(candidates),'now');
  const service=new RecipeService(db,undefined,{async send(){calls++;return {accepted:0,rejected:0};}});
  await Promise.all([service.pushToday(),service.pushToday()]);assert.equal(calls,1);assert.equal((await service.daily())?.pushStatus,'failed');sql.close();
});
test('single-user routes retain same-origin write protection', () => {
  const url='https://weave.example/api/internal/recipes';
  assert.throws(()=>requireSameOrigin(new Request(url,{headers:{origin:'https://evil.example'}})));
  assert.throws(()=>requireSameOrigin(new Request(url)));
  requireSameOrigin(new Request(url,{headers:{origin:'https://weave.example'}}));
  assert.equal(localDevelopment(new Request('http://localhost:3000'),false),false);
  assert.equal(localDevelopment(new Request(url),true),false);
  const loopback = new Request('http://localhost:3000/api/notification-preferences', { headers: { host:'127.0.0.1:3000', origin:'http://127.0.0.1:3000' } });
  requireSameOrigin(loopback, true);
  assert.throws(()=>requireSameOrigin(loopback, false));
  assert.throws(()=>requireSameOrigin(new Request('http://localhost:3000', { headers: { host:'evil.example', origin:'http://evil.example' } }), true));
});

test('stopped recipe notifications remain pending and can be sent after restart', async () => {
  const { sql, db, migrate }=database();migrate();const date=todayJst();let stopped=true;
  try {
    sql.prepare('INSERT INTO daily_recipe_recommendations(recommendation_date,candidates_json,generated_at) VALUES (?,?,?)').run(date,JSON.stringify(candidates),'now');
    const service=new RecipeService(db,undefined,{async send(){return stopped?{accepted:0,rejected:0,skipped:true}:{accepted:1,rejected:0};}});
    assert.equal((await service.pushToday())?.pushStatus,'pending');
    stopped=false;
    assert.equal((await service.pushToday())?.pushStatus,'sent');
  } finally { sql.close(); }
});

test('stopped daily recipe blocks paid generation and push but preserves saved content', async () => {
  const { sql, db, migrate }=database();migrate();let enabled=false,calls=0,pushes=0;
  const original=globalThis.fetch;
  globalThis.fetch=async()=>{calls++;return Response.json(output());};
  try {
    const service=new RecipeService(db,'test-key',{async send(){pushes++;return {accepted:1,rejected:0};}}, {async read(){return {morning_brief:true,daily_recipe:enabled};}});
    await assert.rejects(service.getOrCreateDaily(),/功能已停止/);
    await assert.rejects(service.getOrCreateDaily(true),/功能已停止/);
    await assert.rejects(service.pushToday(),/功能已停止/);
    assert.equal(calls,0);assert.equal(pushes,0);
    assert.equal(await service.generationState(),null);
    enabled=true;
    const generated=await service.getOrCreateDaily();
    assert.equal(calls,1);
    enabled=false;
    assert.equal((await service.daily())?.date,generated.date);
    assert.equal((await service.getOrCreateDaily()).date,generated.date);
    await assert.rejects(service.pushToday(),/功能已停止/);
    assert.equal(calls,1);assert.equal(pushes,0);
    enabled=true;
    await service.pushToday();assert.equal(pushes,1);
  } finally { globalThis.fetch=original;sql.close(); }
});
