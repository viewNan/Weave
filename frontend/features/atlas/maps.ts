export type AtlasMap = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  thumbnail: string | null;
  createdAt: string;
  updatedAt: string;
};

type Row = { id: string; title: string; summary: string; tags_json: string; thumbnail: string | null; created_at: string; updated_at: string };
type Database = NonNullable<CloudflareEnv['PUSH_SUBSCRIPTIONS_DB']>;

const fromRow = (row: Row): AtlasMap => ({
  id: row.id, title: row.title, summary: row.summary, tags: JSON.parse(row.tags_json),
  thumbnail: row.thumbnail, createdAt: row.created_at, updatedAt: row.updated_at,
});

export function parseMapInput(value: Record<string, unknown>) {
  const title = typeof value.title === 'string' ? value.title.trim() : '';
  const summary = typeof value.summary === 'string' ? value.summary.trim() : '';
  const tags = value.tags;
  if (!title || title.length > 100 || summary.length > 300 || !Array.isArray(tags) || tags.length > 8 ||
    tags.some(tag => typeof tag !== 'string' || !tag.trim() || tag.trim().length > 24)) {
    throw new SyntaxError('标题、说明或标签无效。');
  }
  return { title, summary, tags: [...new Set(tags.map((tag: string) => tag.trim()))] as string[] };
}

export async function listMaps(db: Database): Promise<AtlasMap[]> {
  const { results } = await db.prepare('SELECT * FROM atlas_maps ORDER BY updated_at DESC').bind().all<Row>();
  return results.map(fromRow);
}

export async function getMap(db: Database, id: string): Promise<AtlasMap | null> {
  const row = await db.prepare('SELECT * FROM atlas_maps WHERE id=?').bind(id).first<Row>();
  return row ? fromRow(row) : null;
}

export async function createMap(db: Database, value: Record<string, unknown>): Promise<AtlasMap> {
  const { title, summary, tags } = parseMapInput(value);
  const id = crypto.randomUUID(), now = new Date().toISOString();
  await db.prepare('INSERT INTO atlas_maps (id,title,summary,tags_json,created_at,updated_at) VALUES (?,?,?,?,?,?)')
    .bind(id, title, summary, JSON.stringify(tags), now, now).run();
  return { id, title, summary, tags, thumbnail: null, createdAt: now, updatedAt: now };
}

export async function deleteMap(db: Database, id: string): Promise<boolean> {
  if (!await getMap(db, id)) return false;
  await db.prepare('DELETE FROM atlas_maps WHERE id=?').bind(id).run();
  return true;
}
