import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import test from 'node:test';
import { fluentProgress, normalized, orderedPracticeItems, PracticeError, practicePriority, refreshPracticeRound, startPracticeRound, statistics, studyDay, nextStudyDayDelay, type PracticeItem, type Rating } from '../features/practice/domain.ts';
import { parseImport } from '../features/practice/import-format.ts';
import { PracticeService, type PracticeDatabase, type Statement } from '../features/practice/service.ts';
import { requireSameOrigin } from '../features/recipes/server/auth.ts';

// Execute the service's real SQL and migration with SQLite, including atomic D1-style batches.
class SqlStatement implements Statement {
  db: DatabaseSync; query: string; values: SQLInputValue[];
  constructor(db: DatabaseSync, query: string, values: SQLInputValue[] = []) { this.db = db; this.query = query; this.values = values; }
  bind(...values: unknown[]) { return new SqlStatement(this.db, this.query, values as SQLInputValue[]); }
  first<T>(): Promise<T | null> { return Promise.resolve((this.db.prepare(this.query).get(...this.values) ?? null) as T | null); }
  all<T>(): Promise<{ results: T[] }> { return Promise.resolve({ results: this.db.prepare(this.query).all(...this.values) as T[] }); }
  rawRun() { return { meta: { changes: Number(this.db.prepare(this.query).run(...this.values).changes) } }; }
  run() { return Promise.resolve(this.rawRun()); }
}
class TestDatabase implements PracticeDatabase {
  raw = new DatabaseSync(':memory:');
  constructor() { this.raw.exec('PRAGMA foreign_keys=ON'); this.raw.exec(readFileSync(new URL('../migrations/0013_practice.sql', import.meta.url), 'utf8')); }
  prepare(sql: string) { return new SqlStatement(this.raw, sql); }
  async batch(statements: Statement[]) {
    this.raw.exec('BEGIN');
    try { const result = statements.map(statement => (statement as SqlStatement).rawRun()); this.raw.exec('COMMIT'); return result; }
    catch (error) { this.raw.exec('ROLLBACK'); throw error; }
  }
}
const material = '# 面接\nQ: 自己紹介をしてください。\nA:\n名前と現在の立場\n\n- 経験\n  詳細をそのまま保持。\n\nQ: 質問はありますか？\n\n# 技術\nQ: 研究の説明\n二行目\nA:\n「結果」：😀 Q: # 通常文字';
async function fixture(t: { after: (fn: () => void) => void }) {
  const db = new TestDatabase(); t.after(() => db.raw.close());
  let now = new Date('2026-11-27T12:00:00+09:00');
  const service = new PracticeService(db, () => now);
  const { id: setId } = await service.saveSet({ name: 'Practice' });
  await service.importContent(String(setId), material, false);
  const fresh = async () => (await service.dashboard(String(setId))).items[0];
  const record = async (mode: string, rating?: string, id = crypto.randomUUID()) => {
    const item = await fresh();
    return service.record({ itemId: item.id, revision: item.revision, day: studyDay(now), mode, rating, id });
  };
  return { db, service, setId: String(setId), fresh, record, setNow: (value: string) => { now = new Date(value); } };
}

test('study days use Tokyo 04:00 across midnight, year changes and offsets', () => {
  const cases = [
    ['2026-11-27T03:59:59+09:00', '2026-11-26'], ['2026-11-27T04:00:00+09:00', '2026-11-27'],
    ['2026-11-28T00:30:00+09:00', '2026-11-27'], ['2026-11-27T19:00:00Z', '2026-11-28'],
    ['2027-01-01T03:59:59+09:00', '2026-12-31'], ['2027-01-01T04:00:00+09:00', '2027-01-01'],
    ['2026-11-26T14:00:00-05:00', '2026-11-27'],
  ];
  for (const [input, expected] of cases) assert.equal(studyDay(new Date(input)), expected);
  assert.equal(nextStudyDayDelay(new Date('2026-11-27T03:59:59+09:00')), 1000);
  assert.equal(nextStudyDayDelay(new Date('2026-11-27T04:00:00+09:00')), 86_400_000);
});
test('import preserves whole outlines, paragraphs, indentation, Unicode and multiline questions', () => {
  const result = parseImport(material);
  assert.deepEqual(result.errors, []); assert.equal(result.count, 3); assert.equal(result.groups.length, 2);
  assert.equal(result.groups[0].items[0].outline, '名前と現在の立場\n\n- 経験\n  詳細をそのまま保持。');
  assert.equal(result.groups[0].items[1].outline, '');
  assert.equal(result.groups[1].items[0].prompt, '研究の説明\n二行目');
  assert.equal(result.groups[1].items[0].outline, '「結果」：😀 Q: # 通常文字');
  assert.deepEqual(parseImport(`\uFEFF\n\x60\x60\x60text\r\n${material}\r\n\x60\x60\x60\n`).groups, result.groups.map(group => ({ ...group, line: group.line + 2, items: group.items.map(item => ({ ...item, line: item.line + 2 })) })));
});
test('escaped reserved markers survive inside outlines; malformed markers have line errors', () => {
  const parsed = parseImport('# A\nQ: Test\nA:\n\\# Heading\n\\Q: literal\n\\A:\n\\```');
  assert.deepEqual(parsed.errors, []); assert.equal(parsed.groups[0].items[0].outline, '# Heading\nQ: literal\nA:\n```');
  for (const marker of ['Q：bad', 'q: bad', '## bad', '＃ A', 'A: text']) {
    assert.ok(parseImport(`# A\nQ: Test\n${marker}`).errors.some(error => error.line === 3), marker);
  }
  assert.ok(parseImport('# A\nQ: X\nA:\nA:').errors.length);
  assert.ok(parseImport('# A\nQ: X\nQ: X').errors.length);
  assert.ok(parseImport('# A\n# B').errors.length);
  assert.ok(parseImport('Q: X').errors.length);
  assert.equal(normalized(' e\u0301\n  A '), 'é A');
});
test('imports are all-or-nothing, deduplicated, and preserve history and existing outlines', async t => {
  const { service, setId, record, fresh } = await fixture(t);
  await record('rate', 'fluent');
  const original = await fresh(), before = await service.history(original.id);
  const retry = await service.importContent(setId, material.replace('名前と現在の立場', 'changed'), false);
  assert.equal(retry.added, 0); assert.equal(retry.skipped, 3); assert.equal(retry.changed, 1);
  assert.deepEqual(await service.history(original.id), before);
  assert.equal((await fresh()).outline, original.outline);
  const invalid = await service.importContent(setId, '# New\nQ: valid\n# Invalid', false);
  assert.ok(invalid.errors.length); assert.equal((await service.dashboard(setId)).groups.length, 2);
});
test('archived groups block the entire import until explicitly restored', async t => {
  const { service, setId } = await fixture(t);
  const group = (await service.dashboard(setId)).groups[0];
  await service.saveGroup({ id: group.id, name: group.name, archived: true });
  const result = await service.importContent(setId, `# New\nQ: New\n# ${group.name}\nQ: Another`, false);
  assert.ok(result.errors.length);
  assert.equal((await service.dashboard(setId)).groups.length, 2);
  assert.equal((await service.dashboard(setId)).groups.find(value => value.id === group.id)?.archived, 1);
});
test('D1-style batch constraint failure rolls the import back, including newly created groups', async t => {
  const { db, service, setId } = await fixture(t);
  db.raw.exec("CREATE TRIGGER reject_question BEFORE INSERT ON practice_items WHEN NEW.prompt='reject' BEGIN SELECT RAISE(ABORT, 'test failure'); END;");
  await assert.rejects(service.importContent(setId, '# New\nQ: valid\nQ: reject', false));
  assert.equal((await service.dashboard(setId)).groups.length, 2);
  assert.equal((await service.dashboard(setId)).items.length, 3);
});
test('checking then rating is one attempt; again adds an unrated attempt without losing prior mastery', async t => {
  const { service, fresh, record } = await fixture(t);
  await record('check'); await record('rate', 'fluent');
  let item = await fresh(); assert.equal(item.today_count, 1); assert.equal(item.latest_rating, 'fluent');
  await record('rate', 'shaky'); item = await fresh(); assert.equal(item.today_count, 1);
  const { undo } = await record('again'); assert.ok(undo);
  item = await fresh(); assert.equal(item.today_count, 2); assert.equal(item.latest_rating, null); assert.equal(item.current_rating, 'shaky');
  await record('rate', 'unknown');
  const history = await service.history(item.id); assert.equal(history[0].rating, 'unknown'); assert.equal(history[1].rating, 'shaky');
  assert.equal(statistics([await fresh()]).attempts, 2);
});
test('undo changes only its target attempt; delete and restore recalculate mastery', async t => {
  const { service, fresh, record } = await fixture(t);
  await record('rate', 'fluent'); await record('again');
  const { undo } = await record('rate', 'unknown'); assert.ok(undo);
  await service.changeAttempt(undo);
  let item = await fresh(); assert.equal(item.current_rating, 'fluent'); assert.equal(item.latest_rating, null);
  const latest = (await service.history(item.id))[0];
  const removed = await service.changeAttempt({ itemId: item.id, attemptId: latest.id, revision: item.revision, deleted: 1 });
  item = await fresh(); assert.equal(item.today_count, 1);
  await service.changeAttempt(removed.undo); assert.equal((await fresh()).today_count, 2);
});
test('creation retry is idempotent, even after subsequent attempts', async t => {
  const { service, record, fresh } = await fixture(t);
  const item = await fresh(), id = crypto.randomUUID();
  const body = { itemId: item.id, revision: item.revision, id, mode: 'rate', rating: 'fluent', day: '2026-11-27' };
  await service.record(body); await record('again'); await service.record(body);
  assert.equal((await fresh()).today_count, 2);
});
test('racing devices cannot both create attempts or overwrite a newer one', async t => {
  const { service, fresh } = await fixture(t);
  const item = await fresh();
  const body = { itemId: item.id, revision: item.revision, day: '2026-11-27', mode: 'rate' };
  const results = await Promise.allSettled([
    service.record({ ...body, id: crypto.randomUUID(), rating: 'fluent' }),
    service.record({ ...body, id: crypto.randomUUID(), rating: 'unknown' }),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal((await fresh()).today_count, 1);
  const current = await fresh();
  await assert.rejects(service.record({ ...body, id: crypto.randomUUID(), rating: 'shaky' }), (error: unknown) => error instanceof PracticeError && error.status === 409);
  assert.equal((await fresh()).current_rating, current.current_rating);
});
test('04:00 resets today while preserving history, and rejects stale-day edits', async t => {
  const { service, fresh, record, setNow } = await fixture(t);
  setNow('2026-11-28T03:59:59+09:00'); await record('rate', 'shaky');
  const old = await fresh(); setNow('2026-11-28T04:00:00+09:00');
  let item = await fresh(); assert.equal(item.today_count, 0); assert.equal(item.latest_rating, null); assert.equal(item.current_rating, 'shaky');
  await assert.rejects(service.record({ itemId: item.id, revision: item.revision, mode: 'rate', rating: 'fluent', id: crypto.randomUUID(), day: '2026-11-27' }));
  await record('rate', 'fluent'); item = await fresh();
  const attempts = await service.history(item.id); assert.equal(attempts.length, 2);
  assert.equal(attempts[1].rating, old.current_rating); assert.equal(attempts[0].study_day, '2026-11-28');
});
test('notes, item edits, starring and archives preserve attempts; stale edits fail', async t => {
  const { service, fresh, record } = await fixture(t);
  await record('check'); const original = await fresh();
  const attempt = (await service.history(original.id))[0];
  await service.changeAttempt({ itemId: original.id, attemptId: attempt.id, revision: original.revision, note: 'Practice note' });
  const item = await fresh();
  const body = { id: item.id, revision: item.revision, groupId: item.group_id, prompt: item.prompt, outline: 'New outline', starred: true, archived: true };
  await service.saveItem(body); await assert.rejects(service.saveItem(body));
  assert.equal((await service.history(item.id))[0].note, 'Practice note');
  assert.equal((await fresh()).starred, 1); assert.equal((await fresh()).archived, 1);
});
test('existing same-origin protection rejects forged browser origins', () => {
  assert.doesNotThrow(() => requireSameOrigin(new Request('https://weave.example/api/internal/practice', { method: 'POST', headers: { origin: 'https://weave.example' } }), false));
  for (const origin of ['https://other.example', 'null', '']) assert.throws(() => requireSameOrigin(new Request('https://weave.example/api/internal/practice', { method: 'POST', headers: { origin } }), false));
});

test('manual content editing, ordering and archive restore retain whole outlines', async t => {
  const { service } = await fixture(t);
  const { id: setId } = await service.saveSet({ name: 'Personal' });
  const { id: groupId } = await service.saveGroup({ setId, name: 'Category' });
  const outline = 'A complete outline\n\n  Indented detail\n- A list item';
  const { id } = await service.saveItem({ groupId, prompt: 'Question', outline });
  let dashboard = await service.dashboard(String(setId));
  assert.equal(dashboard.items[0].outline, outline);
  await service.saveGroup({ id: groupId, name: 'Renamed category', sortOrder: 5 });
  await service.saveSet({ id: setId, name: 'Renamed set' });
  await service.saveItem({ id, groupId, prompt: 'Renamed question', outline, revision: 0, archived: true, sortOrder: 4 });
  dashboard = await service.dashboard(String(setId));
  assert.equal(dashboard.groups[0].sort_order, 5); assert.equal(dashboard.items[0].sort_order, 4);
  assert.equal(dashboard.sets.find(set => set.id === setId)?.name, 'Renamed set');
  await service.saveItem({ id, groupId, prompt: 'Renamed question', outline, revision: 1, archived: false });
  dashboard = await service.dashboard(String(setId));
  assert.equal(dashboard.items[0].archived, 0); assert.equal(dashboard.items[0].outline, outline);
});

test('whole-history counters and positive progress derive from valid attempts, including unrated ones', async t => {
  const { fresh, record, service } = await fixture(t);
  const sequence = ['fluent', 'unknown', 'fluent', 'shaky', 'unknown', 'fluent', 'unknown', 'shaky', 'fluent', 'unknown', 'unknown'];
  for (const [index, value] of sequence.entries()) {
    if (index) await record('again');
    await record('rate', value);
  }
  let item = await fresh();
  assert.equal(item.total_count, 11); assert.equal(item.fluent_count, 4); assert.equal(item.shaky_count, 2); assert.equal(item.unknown_count, 5);
  assert.deepEqual(fluentProgress(item), { score: 40, remaining: 6, status: 'learning' });
  await record('check'); assert.equal((await fresh()).total_count, 11);
  await record('again'); item = await fresh();
  assert.equal(item.total_count, 12); assert.equal(item.fluent_count, 4);
  const latest = (await service.history(item.id))[0];
  await service.changeAttempt({ itemId: item.id, attemptId: latest.id, revision: item.revision, deleted: 1 });
  assert.equal((await fresh()).total_count, 11);
});

test('rating corrections, undo, deletion and restoration recalculate points without duplicate rewards', async t => {
  const { fresh, record, service } = await fixture(t);
  await record('check'); await record('rate', 'fluent'); await record('rate', 'fluent');
  let item = await fresh(); assert.equal(item.fluent_count, 1); assert.equal(fluentProgress(item).score, 10);
  const { undo } = await record('rate', 'unknown'); assert.ok(undo);
  assert.equal(fluentProgress(await fresh()).score, 0);
  await service.changeAttempt(undo); item = await fresh();
  assert.equal(fluentProgress(item).score, 10); assert.equal(item.total_count, 1);
  const attempt = (await service.history(item.id))[0];
  const deleted = await service.changeAttempt({ itemId: item.id, attemptId: attempt.id, revision: item.revision, deleted: 1 });
  assert.equal(fluentProgress(await fresh()).score, 0);
  await service.changeAttempt(deleted.undo); assert.equal(fluentProgress(await fresh()).score, 10);
});

test('points cap at 100; later failed attempts preserve points and change status to review', async t => {
  const { fresh, record } = await fixture(t);
  for (let index = 0; index < 11; index++) { if (index) await record('again'); await record('rate', 'fluent'); }
  assert.deepEqual(fluentProgress(await fresh()), { score: 100, remaining: 0, status: 'passed' });
  await record('again'); await record('rate', 'unknown');
  assert.deepEqual(fluentProgress(await fresh()), { score: 100, remaining: 0, status: 'review' });
  await record('rate', 'shaky'); assert.equal(fluentProgress(await fresh()).score, 100);
  await record('rate', 'fluent'); assert.equal(fluentProgress(await fresh()).status, 'passed');
});

test('rounds prioritize ratings across categories and shuffle within every tier without mutating the bank', async t => {
  const { fresh } = await fixture(t), base = await fresh();
  const create = (id: string, rating: Rating | null): PracticeItem => ({ ...base, id, group_id: id, current_rating: rating });
  const bank = [create('f1', 'fluent'), create('u1', 'unknown'), create('s1', 'shaky'), create('n1', null),
    create('u2', 'unknown'), create('s2', 'shaky'), create('n2', null), create('f2', 'fluent')];
  const original = bank.map(item => item.id);
  const round = startPracticeRound(bank, 'set', '2026-11-27', () => 0);
  const second = startPracticeRound(bank, 'set', '2026-11-27', () => .999);
  const ordered = orderedPracticeItems(bank, round);
  assert.deepEqual(ordered.map(item => practicePriority(item.current_rating)), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.notDeepEqual(round.order, second.order);
  assert.equal(new Set(round.order).size, bank.length); assert.deepEqual(bank.map(item => item.id), original);
  assert.deepEqual(orderedPracticeItems(bank, null).map(item => item.id), original);
});

test('a round stays stable across refreshes; only rated items move behind remaining items and undo restores place', async t => {
  const { fresh } = await fixture(t), base = await fresh();
  const bank = ['a', 'b', 'c'].map(id => ({ ...base, id, current_rating: 'unknown' as const }));
  const round = startPracticeRound(bank, 'set', '2026-11-27', () => .999);
  const changed = bank.map(item => item.id === 'a' ? { ...item, current_rating: 'fluent' as const } : item);
  const refreshed = refreshPracticeRound(round, changed, 'set', round.day);
  assert.deepEqual(refreshed.order, round.order);
  const completed = { ...refreshed, completed: ['a'] };
  assert.deepEqual(orderedPracticeItems(changed, completed).map(item => item.id), ['b', 'c', 'a']);
  assert.deepEqual(orderedPracticeItems(changed, { ...completed, completed: [] }).map(item => item.id), round.order);
  const expanded = refreshPracticeRound(completed, [...changed, { ...base, id: 'new' }], 'set', round.day);
  assert.deepEqual(expanded.order, ['a', 'b', 'c', 'new']);
  assert.deepEqual(refreshPracticeRound(completed, changed.slice(1), 'set', round.day).completed, []);
  assert.deepEqual(refreshPracticeRound(completed, changed, 'other', round.day).completed, []);
  assert.deepEqual(refreshPracticeRound(completed, changed, 'set', '2026-11-28').completed, []);
});
