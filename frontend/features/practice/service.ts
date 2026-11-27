import { identifier, normalized, PracticeError, rating, revision, studyDay, text, type Attempt, type Dashboard, type PracticeGroup, type PracticeItem, type PracticeSet, type Undo } from './domain.ts';
import { parseImport } from './import-format.ts';
import type { PracticeExportSnapshot } from './export.ts';

export type Statement = {
  bind(...values: unknown[]): Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
};
export type PracticeDatabase = { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<{ meta: { changes: number } }[]> };
type Input = Record<string, unknown>;
const conflict = () => new PracticeError('数据已在其他设备更新，请刷新后重试。', 409);

export class PracticeService {
  db: PracticeDatabase;
  clock: () => Date;
  constructor(db: PracticeDatabase, clock = () => new Date()) { this.db = db; this.clock = clock; }
  private sql(query: string, ...values: unknown[]) { return this.db.prepare(query).bind(...values); }
  async dashboard(requested?: string): Promise<Dashboard> {
    const sets = (await this.sql('SELECT * FROM practice_sets ORDER BY created_at,id').all<PracticeSet>()).results;
    const setId = requested || sets[0]?.id || '', day = studyDay(this.clock());
    if (setId && !sets.some(set => set.id === setId)) throw new PracticeError('找不到练习集。', 404);
    const groups = (await this.sql('SELECT * FROM practice_groups WHERE set_id=? ORDER BY sort_order,id', setId).all<PracticeGroup>()).results;
    const items = (await this.sql(`SELECT i.*,n.number question_number,
      COALESCE(c.total_count,0) total_count,COALESCE(c.fluent_count,0) fluent_count,
      COALESCE(c.shaky_count,0) shaky_count,COALESCE(c.unknown_count,0) unknown_count,
      (SELECT COUNT(*) FROM practice_attempts a WHERE a.item_id=i.id AND a.study_day=? AND a.deleted=0) today_count,
      (SELECT a.id FROM practice_attempts a WHERE a.item_id=i.id AND a.study_day=? AND a.deleted=0 ORDER BY a.sequence DESC LIMIT 1) latest_id,
      (SELECT a.rating FROM practice_attempts a WHERE a.item_id=i.id AND a.study_day=? AND a.deleted=0 ORDER BY a.sequence DESC LIMIT 1) latest_rating,
      (SELECT a.rating FROM practice_attempts a WHERE a.item_id=i.id AND a.deleted=0 AND a.rating IS NOT NULL ORDER BY a.sequence DESC LIMIT 1) current_rating,
      (SELECT a.created_at FROM practice_attempts a WHERE a.item_id=i.id AND a.deleted=0 AND a.rating IS NOT NULL ORDER BY a.sequence DESC LIMIT 1) last_rated_at
      FROM practice_items i JOIN practice_groups g ON g.id=i.group_id
      JOIN practice_question_numbers n ON n.item_id=i.id
      LEFT JOIN (SELECT item_id,COUNT(*) total_count,
        SUM(CASE WHEN rating='fluent' THEN 1 ELSE 0 END) fluent_count,
        SUM(CASE WHEN rating='shaky' THEN 1 ELSE 0 END) shaky_count,
        SUM(CASE WHEN rating='unknown' THEN 1 ELSE 0 END) unknown_count
        FROM practice_attempts WHERE deleted=0 GROUP BY item_id) c ON c.item_id=i.id
      WHERE g.set_id=? ORDER BY i.sort_order,i.id`, day, day, day, setId).all<PracticeItem>()).results;
    return { sets, setId, groups, items, day };
  }
  async history(itemId: string) {
    await this.item(itemId);
    return (await this.sql('SELECT * FROM practice_attempts WHERE item_id=? ORDER BY sequence DESC', itemId).all<Attempt>()).results;
  }
  async exportSnapshot(setId?: string): Promise<PracticeExportSnapshot> {
    const scope = setId ?? null;
    // One read statement gives content and attempts from the same database snapshot.
    const row = await this.sql(`SELECT
      (SELECT json_group_array(json_object('id',id,'name',name,'created_at',created_at))
        FROM (SELECT * FROM practice_sets WHERE (? IS NULL OR id=?) ORDER BY created_at,id)) sets_json,
      (SELECT json_group_array(json_object('id',id,'set_id',set_id,'name',name,'name_key',name_key,'sort_order',sort_order,'archived',archived))
        FROM (SELECT * FROM practice_groups WHERE (? IS NULL OR set_id=?) ORDER BY set_id,sort_order,id)) groups_json,
      (SELECT json_group_array(json_object('id',id,'question_number',question_number,'group_id',group_id,'prompt',prompt,'prompt_key',prompt_key,'outline',outline,'sort_order',sort_order,'starred',starred,'archived',archived,'revision',revision))
        FROM (SELECT i.*,n.number question_number FROM practice_items i JOIN practice_question_numbers n ON n.item_id=i.id
          JOIN practice_groups g ON g.id=i.group_id WHERE (? IS NULL OR g.set_id=?) ORDER BY n.number)) items_json,
      (SELECT json_group_array(json_object('id',id,'sequence',sequence,'item_id',item_id,'rating',rating,'note',note,'study_day',study_day,'created_at',created_at,'deleted',deleted))
        FROM (SELECT a.* FROM practice_attempts a JOIN practice_items i ON i.id=a.item_id
          JOIN practice_groups g ON g.id=i.group_id WHERE (? IS NULL OR g.set_id=?) ORDER BY a.sequence)) attempts_json,
      COALESCE((SELECT seq FROM sqlite_sequence WHERE name='practice_question_numbers'),0) numbering_last_allocated`,
      scope, scope, scope, scope, scope, scope, scope, scope).first<{ sets_json: string; groups_json: string; items_json: string; attempts_json: string; numbering_last_allocated: number }>();
    if (!row) throw new PracticeError('数据服务暂不可用，请稍后重试。', 503);
    const sets = JSON.parse(row.sets_json);
    if (setId && !sets.length) throw new PracticeError('找不到练习集。', 404);
    return { schema_version: 1, exported_at: this.clock().toISOString(), scope: setId ? 'current' : 'all', timezone: 'Asia/Tokyo', study_day_boundary: '04:00',
      numbering_last_allocated: row.numbering_last_allocated, sets, groups: JSON.parse(row.groups_json), items: JSON.parse(row.items_json), attempts: JSON.parse(row.attempts_json) };
  }
  private async item(id: string) {
    const item = await this.sql('SELECT * FROM practice_items WHERE id=?', id).first<PracticeItem>();
    if (!item) throw new PracticeError('找不到题目。', 404);
    return item;
  }
  private async group(id: string) {
    const group = await this.sql('SELECT * FROM practice_groups WHERE id=?', id).first<PracticeGroup>();
    if (!group) throw new PracticeError('找不到分类。', 404);
    return group;
  }
  async saveSet(input: Input) {
    const name = text(input.name, 100);
    if (input.id) {
      const result = await this.sql('UPDATE practice_sets SET name=? WHERE id=?', name, identifier(input.id)).run();
      if (!result.meta.changes) throw new PracticeError('找不到练习集。', 404);
      return { id: input.id };
    }
    const id = crypto.randomUUID();
    await this.sql('INSERT INTO practice_sets (id,name,created_at) VALUES (?,?,?)', id, name, this.clock().toISOString()).run();
    return { id };
  }
  async saveGroup(input: Input) {
    const name = text(input.name, 100), key = normalized(name);
    if (input.id) {
      const id = identifier(input.id), current = await this.group(id);
      const duplicate = await this.sql('SELECT id FROM practice_groups WHERE set_id=? AND name_key=? AND id<>?', current.set_id, key, id).first();
      if (duplicate) throw new PracticeError('已有同名分类（包含已归档分类）。');
      await this.sql('UPDATE practice_groups SET name=?,name_key=?,archived=?,sort_order=? WHERE id=?', name, key, input.archived === true ? 1 : 0,
        input.sortOrder === undefined ? current.sort_order : revision(input.sortOrder), id).run();
      return { id };
    }
    const setId = identifier(input.setId), id = crypto.randomUUID();
    if (await this.sql('SELECT id FROM practice_groups WHERE set_id=? AND name_key=?', setId, key).first()) throw new PracticeError('已有同名分类（包含已归档分类）。');
    await this.sql('INSERT INTO practice_groups (id,set_id,name,name_key,sort_order) SELECT ?,?,?,?,COALESCE(MAX(sort_order),-1)+1 FROM practice_groups WHERE set_id=?', id, setId, name, key, setId).run();
    return { id };
  }
  async saveItem(input: Input) {
    const groupId = identifier(input.groupId), group = await this.group(groupId);
    if (group.archived) throw new PracticeError('请先恢复已归档分类。');
    const prompt = text(input.prompt, 4000), outline = text(input.outline ?? '', 200_000, false), key = normalized(prompt);
    if (await this.sql('SELECT id FROM practice_items WHERE group_id=? AND prompt_key=? AND id<>?', groupId, key, input.id ? identifier(input.id) : '').first()) throw new PracticeError('分类中已有相同题目（包含已归档题目）。');
    if (input.id) {
      const id = identifier(input.id), current = await this.item(id);
      if ((await this.group(current.group_id)).set_id !== group.set_id) throw new PracticeError('不能移到其他练习集。');
      const result = await this.sql('UPDATE practice_items SET group_id=?,prompt=?,prompt_key=?,outline=?,starred=?,archived=?,sort_order=?,revision=revision+1 WHERE id=? AND revision=?',
        groupId, prompt, key, outline, input.starred === true ? 1 : 0, input.archived === true ? 1 : 0,
        input.sortOrder === undefined ? current.sort_order : revision(input.sortOrder), id, revision(input.revision)).run();
      if (!result.meta.changes) throw conflict();
      return { id };
    }
    const id = crypto.randomUUID();
    await this.sql('INSERT INTO practice_items (id,group_id,prompt,prompt_key,outline,sort_order) SELECT ?,?,?,?,?,COALESCE(MAX(sort_order),-1)+1 FROM practice_items WHERE group_id=?', id, groupId, prompt, key, outline, groupId).run();
    return { id };
  }
  async importContent(setId: string, source: string, preview: boolean) {
    const parsed = parseImport(source);
    if (parsed.errors.length) return { ...parsed, imported: false };
    const existing = await this.dashboard(setId);
    const archived = parsed.groups.filter(group => existing.groups.some(current => normalized(current.name) === normalized(group.name) && current.archived));
    // Imported archived categories require an explicit restore in management first.
    for (const group of archived) parsed.errors.push({ line: group.line, message: '同名分类已归档，请在管理中明确恢复后再导入。' });
    let added = 0, skipped = 0, changed = 0;
    const groups = parsed.groups.map((group, index) => {
      const current = existing.groups.find(current => normalized(current.name) === normalized(group.name));
      const sort = Math.max(-1, ...existing.groups.map(value => value.sort_order)) + 1 + index;
      return { id: current?.id ?? crypto.randomUUID(), name: group.name, key: normalized(group.name), sort };
    });
    const items = parsed.groups.flatMap((group, index) => group.items.map((question, order) => {
      const target = groups[index];
      const duplicate = existing.items.find(item => item.group_id === target.id && normalized(item.prompt) === normalized(question.prompt));
      if (duplicate) { skipped++; if (duplicate.outline !== question.outline) changed++; } else added++;
      return { id: crypto.randomUUID(), groupKey: target.key, prompt: question.prompt, key: normalized(question.prompt), outline: question.outline,
        sort: Math.max(-1, ...existing.items.filter(item => item.group_id === target.id).map(item => item.sort_order)) + 1 + order };
    }));
    if (preview || parsed.errors.length) return { ...parsed, added, skipped, changed, imported: false };
    const result = await this.db.batch([
      this.sql(`INSERT INTO practice_groups (id,set_id,name,name_key,sort_order)
        SELECT json_extract(value,'$.id'),?,json_extract(value,'$.name'),json_extract(value,'$.key'),json_extract(value,'$.sort')
        FROM json_each(?) WHERE 1
        ON CONFLICT(set_id,name_key) DO UPDATE SET archived=CASE WHEN practice_groups.archived=1 THEN NULL ELSE 0 END`, setId, JSON.stringify(groups)),
      this.sql(`INSERT INTO practice_items (id,group_id,prompt,prompt_key,outline,sort_order)
        SELECT json_extract(j.value,'$.id'),g.id,json_extract(j.value,'$.prompt'),json_extract(j.value,'$.key'),json_extract(j.value,'$.outline'),json_extract(j.value,'$.sort')
        FROM json_each(?) j JOIN practice_groups g ON g.set_id=? AND g.name_key=json_extract(j.value,'$.groupKey') WHERE 1
        ON CONFLICT(group_id,prompt_key) DO NOTHING`, JSON.stringify(items), setId),
    ]);
    return { imported: true, added: result[1].meta.changes, skipped: parsed.count - result[1].meta.changes, changed, errors: [] };
  }
  private async commit(itemId: string, expected: number, statements: Statement[]) {
    const result = await this.db.batch([...statements,
      this.sql('UPDATE practice_items SET revision=revision+1 WHERE id=? AND revision=?', itemId, expected)]);
    if (!result.at(-1)?.meta.changes) throw conflict();
  }
  async record(input: Input): Promise<{ undo?: Undo }> {
    const itemId = identifier(input.itemId), expected = revision(input.revision), id = identifier(input.id), now = this.clock(), day = studyDay(now);
    if (input.day !== day) throw new PracticeError('已过凌晨 4 点，请刷新后重新操作。', 409);
    if (!['check', 'rate', 'again'].includes(String(input.mode))) throw new PracticeError('未知操作。');
    const targetRating = input.mode === 'rate' ? rating(input.rating) : null;
    // Retrying a creation always refers to the original row, even after later attempts.
    const retried = await this.sql('SELECT item_id FROM practice_attempts WHERE id=?', id).first<{ item_id: string }>();
    if (retried) { if (retried.item_id !== itemId) throw conflict(); return {}; }
    const item = await this.item(itemId);
    if (item.archived || (await this.group(item.group_id)).archived) throw new PracticeError('请先恢复已归档题目或分类。');
    const latest = await this.sql('SELECT * FROM practice_attempts WHERE item_id=? AND study_day=? AND deleted=0 ORDER BY sequence DESC LIMIT 1', itemId, day).first<Attempt>();
    if (input.mode === 'check' && latest) return {};
    if (item.revision !== expected) throw conflict();
    if (input.mode === 'rate' && latest) {
      if (latest.rating === targetRating) return {};
      await this.commit(itemId, expected, [this.sql('UPDATE practice_attempts SET rating=? WHERE id=? AND (SELECT revision FROM practice_items WHERE id=?)=?', targetRating, latest.id, itemId, expected)]);
      return { undo: { itemId, attemptId: latest.id, rating: latest.rating, revision: expected + 1 } };
    }
    await this.commit(itemId, expected, [this.sql(`INSERT INTO practice_attempts (id,item_id,rating,study_day,created_at)
      SELECT ?,?,?,?,? WHERE (SELECT revision FROM practice_items WHERE id=?)=?`, id, itemId, targetRating, day, now.toISOString(), itemId, expected)]);
    return { undo: { itemId, attemptId: id, deleted: 1, revision: expected + 1 } };
  }
  async changeAttempt(input: Input): Promise<{ undo: Undo }> {
    const id = identifier(input.attemptId), itemId = identifier(input.itemId), expected = revision(input.revision);
    const current = await this.sql('SELECT * FROM practice_attempts WHERE id=? AND item_id=?', id, itemId).first<Attempt>();
    if (!current) throw new PracticeError('找不到练习记录。', 404);
    const nextRating = input.rating === undefined ? current.rating : rating(input.rating);
    const note = input.note === undefined ? current.note : text(input.note, 20_000, false);
    if (input.deleted !== undefined && input.deleted !== 0 && input.deleted !== 1) throw new PracticeError('删除状态无效。');
    const deleted = input.deleted === undefined ? current.deleted : input.deleted;
    await this.commit(itemId, expected, [this.sql('UPDATE practice_attempts SET rating=?,note=?,deleted=? WHERE id=? AND item_id=? AND (SELECT revision FROM practice_items WHERE id=?)=?', nextRating, note, deleted, id, itemId, itemId, expected)]);
    return { undo: { itemId, attemptId: id, rating: current.rating, note: current.note, deleted: current.deleted, revision: expected + 1 } };
  }
  async execute(input: Input) {
    switch (input.action) {
      case 'set': return this.saveSet(input);
      case 'group': return this.saveGroup(input);
      case 'item': return this.saveItem(input);
      case 'import': return this.importContent(identifier(input.setId), text(input.source, 1_000_000), input.preview === true);
      case 'record': return this.record(input);
      case 'attempt': return this.changeAttempt(input);
      default: throw new PracticeError('未知操作。');
    }
  }
}
