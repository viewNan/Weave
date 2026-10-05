import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import test from 'node:test';
import { createMap, deleteMap, getMap, listMaps, parseMapInput } from '../features/atlas/maps.ts';
import { getDocument, saveDocument } from '../features/atlas/document.ts';
import { atlasExamples } from '../features/atlas/examples.ts';

test('Atlas maps survive database reads and reject invalid input', async () => {
  const sql = new DatabaseSync(':memory:');
  sql.exec('PRAGMA foreign_keys=ON');
  sql.exec(readFileSync(new URL('../migrations/0010_atlas_maps.sql', import.meta.url), 'utf8'));
  sql.exec(readFileSync(new URL('../migrations/0011_atlas_documents.sql', import.meta.url), 'utf8'));
  const db = { prepare(query: string) { return { bind(...values: string[]) {
    const statement = sql.prepare(query);
    return {
      async run() { return { meta: { changes: Number(statement.run(...values).changes) } }; },
      async first<T>() { return (statement.get(...values) as T) ?? null; },
      async all<T>() { return { results: statement.all(...values) as T[] }; },
    };
  } }; } };
  const map = await createMap(db, { title: ' Activity Roulette ', summary: ' 关键设计 ', tags: [' Study ', 'Study'] });
  assert.equal(map.title, 'Activity Roulette');
  assert.deepEqual((await listMaps(db))[0].tags, ['Study']);
  assert.equal((await getMap(db, map.id))?.summary, '关键设计');
  const first = await saveDocument(db, map.id, { nodes: [{ id: 'n1', type: 'feature', title: '转盘', summary: '', notes: '' }], edges: [], layout: [{ nodeId: 'n1', x: 10, y: 20, width: 240, height: 115 }], canvas: null, revision: 0 });
  assert.equal(first.revision, 1);
  assert.equal((await getDocument(db, map.id)).nodes[0].title, '转盘');
  const thumbnail = 'data:image/png;base64,iVBORw0KGgo=';
  await saveDocument(db, map.id, { ...first, thumbnail });
  assert.equal((await getMap(db, map.id))?.thumbnail, thumbnail);
  await assert.rejects(saveDocument(db, map.id, { ...first, revision: 0 }), /别处更新/);
  await assert.rejects(saveDocument(db, map.id, { ...first, edges: [{ id: 'e1', from: 'n1', to: 'missing', type: 'uses' }] }), SyntaxError);
  await assert.rejects(saveDocument(db, map.id, { ...first, thumbnail: 'data:image/svg+xml,<script>alert(1)</script>' }), /缩略图无效/);
  await assert.rejects(saveDocument(db, map.id, { ...first, nodes: [
    { id: 'a', type: 'feature', title: 'A', summary: '', notes: '', parentId: 'b' },
    { id: 'b', type: 'feature', title: 'B', summary: '', notes: '', parentId: 'a' },
  ], edges: [], layout: [] }), /成环/);
  for (const item of atlasExamples) {
    const exampleMap = await createMap(db, item);
    const saved = await saveDocument(db, exampleMap.id, item.document);
    assert.equal(saved.nodes.length, item.document.nodes.length);
    assert.equal(saved.edges.length, item.document.edges.length);
    await deleteMap(db, exampleMap.id);
  }
  assert.equal(await deleteMap(db, map.id), true);
  assert.deepEqual(await listMaps(db), []);
  assert.equal(sql.prepare('SELECT COUNT(*) AS count FROM atlas_documents').get()?.count, 0);
  assert.throws(() => parseMapInput({ title: '', summary: '', tags: [] }), SyntaxError);
  sql.close();
});
