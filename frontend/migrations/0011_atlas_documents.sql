CREATE TABLE IF NOT EXISTS atlas_documents (
  map_id TEXT PRIMARY KEY REFERENCES atlas_maps(id) ON DELETE CASCADE,
  nodes_json TEXT NOT NULL DEFAULT '[]',
  edges_json TEXT NOT NULL DEFAULT '[]',
  layout_json TEXT NOT NULL DEFAULT '[]',
  canvas_json TEXT,
  revision INTEGER NOT NULL DEFAULT 0
);
