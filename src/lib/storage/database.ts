import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic, SqlValue } from 'sql.js'
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url'
import {
  Project,
  Entry,
  Tag,
  Relation,
  Alias,
  Asset,
  Anchor,
  TimelineEvent,
  Template,
  EntryType,
  EntryStatus,
  EntryVisibility,
  CustomFieldSchema,
  CustomFieldValue,
  BUILTIN_FIELD_SCHEMAS,
  Era,
} from '@/types'
import { generateId, generateSlug, getNow } from '@/lib/utils'
import { emptyNovel, textToHtml, validateNovel, type NovelDocument } from '@/features/novel/model'
import { emptyStudio, validateStudio, remapStudio, type StudioDocument } from '@/features/studio/model'
import { cacheAssetData, cachedAssetData } from '@/lib/assetSources'

const SCHEMA_VERSION = 5

const migrations: Array<{ fromVersion: number; toVersion: number; sql: string[] }> = [
  {
    fromVersion: 1,
    toVersion: 2,
    sql: [
      `CREATE TABLE IF NOT EXISTS custom_field_schemas (
      id TEXT PRIMARY KEY, project_id TEXT, key TEXT NOT NULL, label TEXT NOT NULL,
      type TEXT NOT NULL, entry_type TEXT, required INTEGER DEFAULT 0,
      options TEXT DEFAULT '[]', placeholder TEXT DEFAULT '', default_value TEXT,
      sort_order INTEGER DEFAULT 0, group_label TEXT DEFAULT '',
      is_builtin INTEGER DEFAULT 0, created_at TEXT NOT NULL
    )`,
      `CREATE TABLE IF NOT EXISTS custom_field_values (
      entry_id TEXT NOT NULL, field_id TEXT NOT NULL, value_text TEXT DEFAULT '',
      updated_at TEXT NOT NULL,
      PRIMARY KEY (entry_id, field_id),
      FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
    )`,
      `CREATE TABLE IF NOT EXISTS eras (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, parent_id TEXT,
      name TEXT NOT NULL, short_name TEXT DEFAULT '', start_sort_value REAL NOT NULL,
      end_sort_value REAL NOT NULL, description TEXT DEFAULT '',
      color TEXT DEFAULT '#6366f1', created_at TEXT NOT NULL,
      FOREIGN KEY (project_id) REFERENCES projects(id),
      FOREIGN KEY (parent_id) REFERENCES eras(id)
    )`,
      `CREATE INDEX IF NOT EXISTS idx_eras_project ON eras(project_id);`,
      `UPDATE backlinks SET project_id = COALESCE((SELECT project_id FROM entries e WHERE e.id = backlinks.source_entry_id), '')
      WHERE project_id IS NULL OR project_id = ''`,
    ],
  },
]

const INITIAL_SQL = `
CREATE TABLE IF NOT EXISTS project_modes (project_id TEXT PRIMARY KEY, mode TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS studio_documents (
  project_id TEXT PRIMARY KEY REFERENCES projects(id),
  document TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS novel_documents (
  project_id TEXT PRIMARY KEY REFERENCES projects(id),
  document TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS asset_data (
  asset_id TEXT PRIMARY KEY REFERENCES assets(id) ON DELETE CASCADE,
  data_url TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  schema_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  summary TEXT DEFAULT '',
  content TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'private',
  region TEXT DEFAULT '',
  condition TEXT DEFAULT '',
  occupants TEXT DEFAULT '',
  cover_asset_id TEXT,
  map_position_x REAL,
  map_position_y REAL,
  anchor_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  archived_at TEXT,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS entry_aliases (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  value TEXT NOT NULL,
  normalized_value TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS entry_tags (
  entry_id TEXT NOT NULL,
  tag_id TEXT NOT NULL,
  PRIMARY KEY (entry_id, tag_id),
  FOREIGN KEY (entry_id) REFERENCES entries(id),
  FOREIGN KEY (tag_id) REFERENCES tags(id)
);

CREATE TABLE IF NOT EXISTS relations (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_entry_id TEXT NOT NULL,
  target_entry_id TEXT NOT NULL,
  type TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'directed',
  note TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (source_entry_id) REFERENCES entries(id),
  FOREIGN KEY (target_entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  filename TEXT NOT NULL,
  relative_path TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  checksum TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS backlinks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  source_entry_id TEXT NOT NULL,
  target_entry_id TEXT NOT NULL,
  link_text TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id),
  FOREIGN KEY (source_entry_id) REFERENCES entries(id),
  FOREIGN KEY (target_entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS anchors (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  label TEXT NOT NULL,
  x REAL NOT NULL,
  y REAL NOT NULL,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS timeline_events (
  id TEXT PRIMARY KEY,
  entry_id TEXT NOT NULL,
  point_label TEXT DEFAULT '',
  title TEXT NOT NULL,
  sort_value REAL NOT NULL,
  description TEXT DEFAULT '',
  created_at TEXT NOT NULL,
  FOREIGN KEY (entry_id) REFERENCES entries(id)
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT DEFAULT '',
  content TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  aliases TEXT DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (project_id) REFERENCES projects(id)
);

CREATE TABLE IF NOT EXISTS custom_field_schemas (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  key TEXT NOT NULL,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  entry_type TEXT,
  required INTEGER DEFAULT 0,
  options TEXT DEFAULT '[]',
  placeholder TEXT DEFAULT '',
  default_value TEXT,
  sort_order INTEGER DEFAULT 0,
  group_label TEXT DEFAULT '',
  is_builtin INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS custom_field_values (
  entry_id TEXT NOT NULL,
  field_id TEXT NOT NULL,
  value_text TEXT DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (entry_id, field_id),
  FOREIGN KEY (entry_id) REFERENCES entries(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_project_slug ON entries(project_id, slug);
CREATE INDEX IF NOT EXISTS idx_entries_project_type ON entries(project_id, type);
CREATE INDEX IF NOT EXISTS idx_entries_project_updated ON entries(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_region ON entries(region);
CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_entry_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_entry_id);
CREATE INDEX IF NOT EXISTS idx_timeline_entry_sort ON timeline_events(entry_id, sort_value);
CREATE INDEX IF NOT EXISTS idx_cf_schemas_project ON custom_field_schemas(project_id);
CREATE INDEX IF NOT EXISTS idx_cf_values_entry ON custom_field_values(entry_id);
`

let sqlJsInstance: SqlJsStatic | null = null

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsInstance) {
    sqlJsInstance = await initSqlJs({
      locateFile: () => sqlWasmUrl,
    })
  }
  return sqlJsInstance
}

export class Database {
  private db: SqlJsDatabase | null = null

  async open(): Promise<void> {
    const SQL = await getSqlJs()
    this.db = new SQL.Database()
    await this.init()
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  async init(): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('PRAGMA foreign_keys = ON')
    this.db.run(INITIAL_SQL)

    const versionResult = this.db.exec('PRAGMA user_version')
    let currentVersion = 0
    if (versionResult.length > 0 && versionResult[0].values.length > 0) {
      currentVersion = versionResult[0].values[0][0] as number
    }

    if (currentVersion < SCHEMA_VERSION) {
      for (const migration of migrations) {
        if (migration.fromVersion >= currentVersion && migration.toVersion <= SCHEMA_VERSION) {
          for (const sql of migration.sql) {
            this.db.run(sql)
          }
        }
      }
      this.db.run(`PRAGMA user_version = ${SCHEMA_VERSION}`)
    }
  }

  async createProject(
    name: string,
    description: string = '',
    mode: Project['mode'] = 'free',
  ): Promise<Project> {
    if (!this.db) throw new Error('Database not opened')

    const id = generateId('proj')
    const slug = generateSlug(name)
    const now = getNow()

    const project: Project = {
      mode,
      id,
      name,
      slug,
      description,
      schemaVersion: SCHEMA_VERSION,
      createdAt: now,
      updatedAt: now,
    }

    this.db.run(
      'INSERT INTO projects (id, name, slug, description, schema_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, name, slug, description, SCHEMA_VERSION, now, now] as SqlValue[],
    )

    this.db.run('INSERT INTO project_modes (project_id, mode) VALUES (?, ?)', [id, mode])
    return project
  }

  async getProject(id: string): Promise<Project | null> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT * FROM projects WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      return null
    }

    const row = result[0].values[0]
    return {
      mode: this.getProjectMode(id),
      id: row[0] as string,
      name: row[1] as string,
      slug: row[2] as string,
      description: row[3] as string,
      schemaVersion: row[4] as number,
      createdAt: row[5] as string,
      updatedAt: row[6] as string,
    }
  }

  async getProjectByPath(path: string): Promise<Project | null> {
    try {
      const data = localStorage.getItem(`wdworld_project_${path}`)
      if (!data) return null
      return JSON.parse(data) as Project
    } catch {
      return null
    }
  }

  getProjectMode(id: string): NonNullable<Project['mode']> {
    const value = this.db?.exec('SELECT mode FROM project_modes WHERE project_id = ?', [id])[0]
      ?.values[0]?.[0]
    return ['novel', 'oc', 'trpg', 'tavern'].includes(String(value))
      ? (value as NonNullable<Project['mode']>)
      : 'free'
  }

  async createEntry(
    projectId: string,
    type: EntryType,
    title: string,
    summary: string = '',
    content: string = '',
  ): Promise<Entry> {
    if (!this.db) throw new Error('Database not opened')

    const id = generateId(type.slice(0, 3))
    const baseSlug = generateSlug(title)
    let slug = baseSlug
    let suffix = 2
    while (
      this.db.exec('SELECT id FROM entries WHERE project_id = ? AND slug = ?', [projectId, slug])[0]?.values
        .length
    )
      slug = `${baseSlug}-${suffix++}`
    const now = getNow()

    const entry: Entry = {
      id,
      projectId,
      type,
      title,
      slug,
      summary,
      content,
      status: 'draft',
      visibility: 'private',
      region: '',
      condition: '',
      occupants: '',
      coverAssetId: null,
      mapPositionX: null,
      mapPositionY: null,
      anchorId: null,
      createdAt: now,
      updatedAt: now,
      archivedAt: null,
    }

    this.db.run(
      `INSERT INTO entries (id, project_id, type, title, slug, summary, content, status, visibility, region, 
        condition, occupants, cover_asset_id, map_position_x, map_position_y, anchor_id, created_at, updated_at) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId,
        type,
        title,
        slug,
        summary,
        content,
        'draft',
        'private',
        '',
        '',
        '',
        null,
        null,
        null,
        null,
        now,
        now,
      ] as SqlValue[],
    )

    return entry
  }

  async getEntry(id: string): Promise<Entry | null> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT * FROM entries WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      return null
    }

    const row = result[0].values[0]
    return {
      id: row[0] as string,
      projectId: row[1] as string,
      type: row[2] as EntryType,
      title: row[3] as string,
      slug: row[4] as string,
      summary: row[5] as string,
      content: row[6] as string,
      status: row[7] as EntryStatus,
      visibility: row[8] as EntryVisibility,
      region: row[9] as string,
      condition: row[10] as string,
      occupants: row[11] as string,
      coverAssetId: row[12] as string | null,
      mapPositionX: row[13] as number | null,
      mapPositionY: row[14] as number | null,
      anchorId: row[15] as string | null,
      createdAt: row[16] as string,
      updatedAt: row[17] as string,
      archivedAt: row[18] as string | null,
    }
  }

  async updateEntry(
    id: string,
    updates: Partial<
      Pick<
        Entry,
        'title' | 'summary' | 'content' | 'status' | 'visibility' | 'region' | 'condition' | 'occupants'
      >
    >,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not opened')

    const now = getNow()
    const fields: string[] = []
    const values: SqlValue[] = []

    if (updates.title !== undefined) {
      fields.push('title = ?')
      values.push(updates.title)
      const current = await this.getEntry(id)
      if (current && updates.title !== current.title) {
        const baseSlug = generateSlug(updates.title)
        let slug = baseSlug
        let suffix = 2
        while (
          this.db.exec('SELECT id FROM entries WHERE project_id = ? AND slug = ? AND id != ?', [
            current.projectId,
            slug,
            id,
          ])[0]?.values.length
        )
          slug = `${baseSlug}-${suffix++}`
        fields.push('slug = ?')
        values.push(slug)
      }
    }
    if (updates.summary !== undefined) {
      fields.push('summary = ?')
      values.push(updates.summary)
    }
    if (updates.content !== undefined) {
      fields.push('content = ?')
      values.push(updates.content)
    }
    if (updates.status !== undefined) {
      fields.push('status = ?')
      values.push(updates.status)
    }
    if (updates.visibility !== undefined) {
      fields.push('visibility = ?')
      values.push(updates.visibility)
    }
    if (updates.region !== undefined) {
      fields.push('region = ?')
      values.push(updates.region)
    }
    if (updates.condition !== undefined) {
      fields.push('condition = ?')
      values.push(updates.condition)
    }
    if (updates.occupants !== undefined) {
      fields.push('occupants = ?')
      values.push(updates.occupants)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.run(`UPDATE entries SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  async deleteEntry(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('BEGIN TRANSACTION')
    try {
      this.db.run('DELETE FROM custom_field_values WHERE entry_id = ?', [id])
      this.db.run('DELETE FROM entry_tags WHERE entry_id = ?', [id])
      this.db.run('DELETE FROM entry_aliases WHERE entry_id = ?', [id])
      this.db.run(
        'UPDATE entries SET anchor_id = NULL WHERE anchor_id IN (SELECT id FROM anchors WHERE entry_id = ?)',
        [id],
      )
      this.db.run('DELETE FROM anchors WHERE entry_id = ?', [id])
      this.db.run('DELETE FROM timeline_events WHERE entry_id = ?', [id])
      this.db.run('DELETE FROM relations WHERE source_entry_id = ? OR target_entry_id = ?', [id, id])
      this.db.run('DELETE FROM backlinks WHERE source_entry_id = ? OR target_entry_id = ?', [id, id])
      this.db.run('DELETE FROM entries WHERE id = ?', [id])
      this.db.run('COMMIT')
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }

  async listEntries(projectId: string, type?: EntryType): Promise<Entry[]> {
    if (!this.db) throw new Error('Database not opened')

    const query = type
      ? 'SELECT * FROM entries WHERE project_id = ? AND type = ? ORDER BY updated_at DESC'
      : 'SELECT * FROM entries WHERE project_id = ? ORDER BY updated_at DESC'

    const result = this.db.exec(query, type ? [projectId, type] : [projectId])
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      projectId: row[1] as string,
      type: row[2] as EntryType,
      title: row[3] as string,
      slug: row[4] as string,
      summary: row[5] as string,
      content: row[6] as string,
      status: row[7] as EntryStatus,
      visibility: row[8] as EntryVisibility,
      region: row[9] as string,
      condition: row[10] as string,
      occupants: row[11] as string,
      coverAssetId: row[12] as string | null,
      mapPositionX: row[13] as number | null,
      mapPositionY: row[14] as number | null,
      anchorId: row[15] as string | null,
      createdAt: row[16] as string,
      updatedAt: row[17] as string,
      archivedAt: row[18] as string | null,
    }))
  }

  async searchEntries(projectId: string, query: string): Promise<Entry[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec(
      `SELECT * FROM entries WHERE project_id = ? AND 
        (title LIKE ? OR summary LIKE ? OR content LIKE ?) 
        ORDER BY updated_at DESC`,
      [projectId, `%${query}%`, `%${query}%`, `%${query}%`] as SqlValue[],
    )

    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      projectId: row[1] as string,
      type: row[2] as EntryType,
      title: row[3] as string,
      slug: row[4] as string,
      summary: row[5] as string,
      content: row[6] as string,
      status: row[7] as EntryStatus,
      visibility: row[8] as EntryVisibility,
      region: row[9] as string,
      condition: row[10] as string,
      occupants: row[11] as string,
      coverAssetId: row[12] as string | null,
      mapPositionX: row[13] as number | null,
      mapPositionY: row[14] as number | null,
      anchorId: row[15] as string | null,
      createdAt: row[16] as string,
      updatedAt: row[17] as string,
      archivedAt: row[18] as string | null,
    }))
  }

  async createTag(projectId: string, name: string, color?: string): Promise<Tag> {
    if (!this.db) throw new Error('Database not opened')

    const id = generateId('tag')
    const now = getNow()

    const tag: Tag = {
      id,
      projectId,
      name,
      color: color || null,
      createdAt: now,
    }

    this.db.run('INSERT INTO tags (id, project_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)', [
      id,
      projectId,
      name,
      color || null,
      now,
    ] as SqlValue[])

    return tag
  }

  async getTags(projectId: string): Promise<Tag[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT * FROM tags WHERE project_id = ? ORDER BY name', [projectId])
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      projectId: row[1] as string,
      name: row[2] as string,
      color: row[3] as string | null,
      createdAt: row[4] as string,
    }))
  }

  async updateTag(id: string, name: string, color?: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('UPDATE tags SET name = ?, color = ? WHERE id = ?', [name, color || null, id] as SqlValue[])
  }

  async deleteTag(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('BEGIN TRANSACTION')
    try {
      this.db.run('DELETE FROM entry_tags WHERE tag_id = ?', [id])
      this.db.run('DELETE FROM tags WHERE id = ?', [id])
      this.db.run('COMMIT')
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }

  async getEntryTags(entryId: string): Promise<Tag[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec(
      `SELECT t.* FROM tags t JOIN entry_tags et ON t.id = et.tag_id WHERE et.entry_id = ? ORDER BY t.name`,
      [entryId],
    )
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      projectId: row[1] as string,
      name: row[2] as string,
      color: row[3] as string | null,
      createdAt: row[4] as string,
    }))
  }

  async addTagToEntry(entryId: string, tagId: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)', [
      entryId,
      tagId,
    ] as SqlValue[])
  }

  async removeTagFromEntry(entryId: string, tagId: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('DELETE FROM entry_tags WHERE entry_id = ? AND tag_id = ?', [entryId, tagId])
  }

  async createAlias(entryId: string, value: string): Promise<Alias> {
    if (!this.db) throw new Error('Database not opened')

    const id = generateId('als')
    const normalizedValue = value.toLowerCase().trim()

    const alias: Alias = {
      id,
      entryId,
      value,
      normalizedValue,
    }

    this.db.run('INSERT INTO entry_aliases (id, entry_id, value, normalized_value) VALUES (?, ?, ?, ?)', [
      id,
      entryId,
      value,
      normalizedValue,
    ] as SqlValue[])

    return alias
  }

  async getEntryAliases(entryId: string): Promise<Alias[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT * FROM entry_aliases WHERE entry_id = ? ORDER BY normalized_value', [
      entryId,
    ])
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      entryId: row[1] as string,
      value: row[2] as string,
      normalizedValue: row[3] as string,
    }))
  }

  async deleteAlias(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('DELETE FROM entry_aliases WHERE id = ?', [id])
  }

  async createAsset(
    projectId: string,
    kind: string,
    filename: string,
    relativePath: string,
    mimeType: string,
    size: number,
    checksum?: string,
  ): Promise<Asset> {
    if (!this.db) throw new Error('Database not opened')

    const id = generateId('ast')
    const now = getNow()

    const asset: Asset = {
      id,
      projectId,
      kind: kind as Asset['kind'],
      filename,
      relativePath,
      mimeType,
      size,
      checksum: checksum || null,
      createdAt: now,
    }

    this.db.run(
      'INSERT INTO assets (id, project_id, kind, filename, relative_path, mime_type, size, checksum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, projectId, kind, filename, relativePath, mimeType, size, checksum || null, now] as SqlValue[],
    )

    return asset
  }

  async getAssets(projectId: string, kind?: string): Promise<Asset[]> {
    if (!this.db) throw new Error('Database not opened')

    const bytes = this.db.exec(
      'SELECT a.relative_path, d.data_url FROM asset_data d JOIN assets a ON a.id = d.asset_id WHERE a.project_id = ?',
      [projectId],
    )
    for (const [path, data] of bytes[0]?.values ?? []) cacheAssetData(String(path), String(data))

    const query = kind
      ? 'SELECT * FROM assets WHERE project_id = ? AND kind = ? ORDER BY created_at DESC'
      : 'SELECT * FROM assets WHERE project_id = ? ORDER BY created_at DESC'

    const result = this.db.exec(query, kind ? [projectId, kind] : [projectId])
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      projectId: row[1] as string,
      kind: row[2] as Asset['kind'],
      filename: row[3] as string,
      relativePath: row[4] as string,
      mimeType: row[5] as string,
      size: row[6] as number,
      checksum: row[7] as string | null,
      createdAt: row[8] as string,
    }))
  }

  async deleteAsset(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('BEGIN TRANSACTION')
    try {
      this.db.run('UPDATE entries SET cover_asset_id = NULL WHERE cover_asset_id = ?', [id])
      this.db.run('DELETE FROM assets WHERE id = ?', [id])
      this.db.run('COMMIT')
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }

  async updateEntryCoverAsset(entryId: string, assetId: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('UPDATE entries SET cover_asset_id = ? WHERE id = ?', [assetId, entryId])
  }

  async searchByTag(projectId: string, tagId: string): Promise<Entry[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec(
      `SELECT e.* FROM entries e JOIN entry_tags et ON e.id = et.entry_id WHERE e.project_id = ? AND et.tag_id = ? ORDER BY e.updated_at DESC`,
      [projectId, tagId] as SqlValue[],
    )
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      projectId: row[1] as string,
      type: row[2] as EntryType,
      title: row[3] as string,
      slug: row[4] as string,
      summary: row[5] as string,
      content: row[6] as string,
      status: row[7] as EntryStatus,
      visibility: row[8] as EntryVisibility,
      region: row[9] as string,
      condition: row[10] as string,
      occupants: row[11] as string,
      coverAssetId: row[12] as string | null,
      mapPositionX: row[13] as number | null,
      mapPositionY: row[14] as number | null,
      anchorId: row[15] as string | null,
      createdAt: row[16] as string,
      updatedAt: row[17] as string,
      archivedAt: row[18] as string | null,
    }))
  }

  async searchTags(projectId: string, query: string): Promise<Tag[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT * FROM tags WHERE project_id = ? AND name LIKE ? ORDER BY name', [
      projectId,
      `%${query}%`,
    ] as SqlValue[])
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      projectId: row[1] as string,
      name: row[2] as string,
      color: row[3] as string | null,
      createdAt: row[4] as string,
    }))
  }

  async createRelation(
    projectId: string,
    sourceEntryId: string,
    targetEntryId: string,
    type: string,
    note: string = '',
  ): Promise<Relation> {
    if (!this.db) throw new Error('Database not opened')

    const id = generateId('rel')
    const now = getNow()

    const relation: Relation = {
      id,
      projectId,
      sourceEntryId,
      targetEntryId,
      type,
      direction: 'directed',
      note,
      createdAt: now,
      updatedAt: now,
    }

    this.db.run(
      'INSERT INTO relations (id, project_id, source_entry_id, target_entry_id, type, direction, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, projectId, sourceEntryId, targetEntryId, type, 'directed', note, now, now] as SqlValue[],
    )

    return relation
  }

  async getRelations(projectId: string): Promise<Relation[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT * FROM relations WHERE project_id = ? ORDER BY created_at DESC', [
      projectId,
    ])
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      projectId: row[1] as string,
      sourceEntryId: row[2] as string,
      targetEntryId: row[3] as string,
      type: row[4] as string,
      direction: row[5] as 'directed' | 'bidirectional',
      note: row[6] as string,
      createdAt: row[7] as string,
      updatedAt: row[8] as string,
    }))
  }

  async getEntryRelations(entryId: string): Promise<Relation[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec(
      'SELECT * FROM relations WHERE source_entry_id = ? OR target_entry_id = ? ORDER BY created_at DESC',
      [entryId, entryId],
    )
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      projectId: row[1] as string,
      sourceEntryId: row[2] as string,
      targetEntryId: row[3] as string,
      type: row[4] as string,
      direction: row[5] as 'directed' | 'bidirectional',
      note: row[6] as string,
      createdAt: row[7] as string,
      updatedAt: row[8] as string,
    }))
  }

  async updateRelation(
    id: string,
    updates: Partial<Pick<Relation, 'type' | 'direction' | 'note'>>,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not opened')

    const now = getNow()
    const fields: string[] = []
    const values: SqlValue[] = []

    if (updates.type !== undefined) {
      fields.push('type = ?')
      values.push(updates.type)
    }
    if (updates.direction !== undefined) {
      fields.push('direction = ?')
      values.push(updates.direction)
    }
    if (updates.note !== undefined) {
      fields.push('note = ?')
      values.push(updates.note)
    }

    fields.push('updated_at = ?')
    values.push(now)
    values.push(id)

    this.db.run(`UPDATE relations SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  async deleteRelation(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('DELETE FROM relations WHERE id = ?', [id])
  }

  async getBacklinks(entryId: string): Promise<{ entry: Entry; linkText: string }[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec(
      `SELECT e.*, b.link_text FROM entries e JOIN backlinks b ON e.id = b.source_entry_id WHERE b.target_entry_id = ? ORDER BY b.created_at DESC`,
      [entryId],
    )
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      entry: {
        id: row[0] as string,
        projectId: row[1] as string,
        type: row[2] as EntryType,
        title: row[3] as string,
        slug: row[4] as string,
        summary: row[5] as string,
        content: row[6] as string,
        status: row[7] as EntryStatus,
        visibility: row[8] as EntryVisibility,
        region: row[9] as string,
        condition: row[10] as string,
        occupants: row[11] as string,
        coverAssetId: row[12] as string | null,
        mapPositionX: row[13] as number | null,
        mapPositionY: row[14] as number | null,
        anchorId: row[15] as string | null,
        createdAt: row[16] as string,
        updatedAt: row[17] as string,
        archivedAt: row[18] as string | null,
      },
      linkText: row[19] as string,
    }))
  }

  async addBacklink(
    projectId: string,
    sourceEntryId: string,
    targetEntryId: string,
    linkText: string = '',
  ): Promise<void> {
    if (!this.db) throw new Error('Database not opened')

    const id = generateId('bl')
    const now = getNow()

    this.db.run(
      'INSERT OR IGNORE INTO backlinks (id, project_id, source_entry_id, target_entry_id, link_text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, projectId, sourceEntryId, targetEntryId, linkText, now] as SqlValue[],
    )
  }

  async fullTextSearch(projectId: string, query: string): Promise<Entry[]> {
    if (!this.db) throw new Error('Database not opened')

    try {
      const result = this.db.exec(
        `SELECT e.* FROM entries e WHERE e.project_id = ? AND 
          (e.title LIKE ? OR e.summary LIKE ? OR e.content LIKE ?) 
          ORDER BY 
            CASE WHEN e.title LIKE ? THEN 1 ELSE 2 END,
            e.updated_at DESC`,
        [projectId, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`] as SqlValue[],
      )

      if (result.length === 0) return []

      return result[0].values.map((row) => ({
        id: row[0] as string,
        projectId: row[1] as string,
        type: row[2] as EntryType,
        title: row[3] as string,
        slug: row[4] as string,
        summary: row[5] as string,
        content: row[6] as string,
        status: row[7] as EntryStatus,
        visibility: row[8] as EntryVisibility,
        region: row[9] as string,
        condition: row[10] as string,
        occupants: row[11] as string,
        coverAssetId: row[12] as string | null,
        mapPositionX: row[13] as number | null,
        mapPositionY: row[14] as number | null,
        anchorId: row[15] as string | null,
        createdAt: row[16] as string,
        updatedAt: row[17] as string,
        archivedAt: row[18] as string | null,
      }))
    } catch {
      return this.searchEntries(projectId, query)
    }
  }

  async getProjectStats(projectId: string): Promise<{ entryCount: number }> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT COUNT(*) as count FROM entries WHERE project_id = ?', [projectId])
    if (result.length === 0 || result[0].values.length === 0) {
      return { entryCount: 0 }
    }

    return { entryCount: result[0].values[0][0] as number }
  }

  async createAnchor(
    entryId: string,
    label: string,
    x: number,
    y: number,
    notes: string = '',
  ): Promise<Anchor> {
    if (!this.db) throw new Error('Database not opened')

    const id = generateId('anc')
    const now = getNow()

    const anchor: Anchor = {
      id,
      entryId,
      label,
      x,
      y,
      notes,
      createdAt: now,
    }

    this.db.run(
      'INSERT INTO anchors (id, entry_id, label, x, y, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, entryId, label, x, y, notes, now] as SqlValue[],
    )

    return anchor
  }

  async getAnchors(entryId: string): Promise<Anchor[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT * FROM anchors WHERE entry_id = ? ORDER BY created_at', [entryId])
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      entryId: row[1] as string,
      label: row[2] as string,
      x: row[3] as number,
      y: row[4] as number,
      notes: row[5] as string,
      createdAt: row[6] as string,
    }))
  }

  async deleteAnchor(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('BEGIN TRANSACTION')
    try {
      this.db.run('UPDATE entries SET anchor_id = NULL WHERE anchor_id = ?', [id])
      this.db.run('DELETE FROM anchors WHERE id = ?', [id])
      this.db.run('COMMIT')
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }

  async updateEntryMapPosition(entryId: string, x: number | null, y: number | null): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('UPDATE entries SET map_position_x = ?, map_position_y = ? WHERE id = ?', [x, y, entryId])
  }

  async updateEntryAnchor(entryId: string, anchorId: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('UPDATE entries SET anchor_id = ? WHERE id = ?', [anchorId, entryId])
  }

  async getEntriesWithMapPosition(projectId: string): Promise<Entry[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec(
      'SELECT * FROM entries WHERE project_id = ? AND map_position_x IS NOT NULL AND map_position_y IS NOT NULL ORDER BY updated_at DESC',
      [projectId],
    )
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      projectId: row[1] as string,
      type: row[2] as EntryType,
      title: row[3] as string,
      slug: row[4] as string,
      summary: row[5] as string,
      content: row[6] as string,
      status: row[7] as EntryStatus,
      visibility: row[8] as EntryVisibility,
      region: row[9] as string,
      condition: row[10] as string,
      occupants: row[11] as string,
      coverAssetId: row[12] as string | null,
      mapPositionX: row[13] as number | null,
      mapPositionY: row[14] as number | null,
      anchorId: row[15] as string | null,
      createdAt: row[16] as string,
      updatedAt: row[17] as string,
      archivedAt: row[18] as string | null,
    }))
  }

  async createTimelineEvent(
    entryId: string,
    pointLabel: string,
    title: string,
    sortValue: number,
    description: string = '',
  ): Promise<TimelineEvent> {
    if (!this.db) throw new Error('Database not opened')

    const id = generateId('t')
    const now = getNow()

    const event: TimelineEvent = {
      id,
      entryId,
      pointLabel,
      title,
      sortValue,
      description,
      createdAt: now,
    }

    this.db.run(
      'INSERT INTO timeline_events (id, entry_id, point_label, title, sort_value, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, entryId, pointLabel, title, sortValue, description, now] as SqlValue[],
    )

    return event
  }

  async getTimelineEvents(entryId: string): Promise<TimelineEvent[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT * FROM timeline_events WHERE entry_id = ? ORDER BY sort_value', [
      entryId,
    ])
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      entryId: row[1] as string,
      pointLabel: row[2] as string,
      title: row[3] as string,
      sortValue: row[4] as number,
      description: row[5] as string,
      createdAt: row[6] as string,
    }))
  }

  async getAllTimelineEvents(projectId: string): Promise<TimelineEvent[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec(
      `SELECT te.* FROM timeline_events te JOIN entries e ON te.entry_id = e.id WHERE e.project_id = ? ORDER BY te.sort_value`,
      [projectId],
    )
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      entryId: row[1] as string,
      pointLabel: row[2] as string,
      title: row[3] as string,
      sortValue: row[4] as number,
      description: row[5] as string,
      createdAt: row[6] as string,
    }))
  }

  async deleteTimelineEvent(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('DELETE FROM timeline_events WHERE id = ?', [id])
  }

  async createTemplate(
    projectId: string,
    name: string,
    type: EntryType,
    description: string,
    content: string,
    tags: string[],
    aliases: string[],
  ): Promise<Template> {
    if (!this.db) throw new Error('Database not opened')
    const id = generateId('tpl')
    const now = getNow()
    const template: Template = {
      id,
      projectId,
      name,
      type,
      description,
      content,
      tags,
      aliases,
      createdAt: now,
      updatedAt: now,
    }
    this.db.run(
      'INSERT INTO templates (id, project_id, name, type, description, content, tags, aliases, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        id,
        projectId,
        name,
        type,
        description,
        content,
        JSON.stringify(tags),
        JSON.stringify(aliases),
        now,
        now,
      ] as SqlValue[],
    )
    return template
  }

  async getTemplates(projectId: string): Promise<Template[]> {
    if (!this.db) throw new Error('Database not opened')
    const result = this.db.exec('SELECT * FROM templates WHERE project_id = ? ORDER BY name', [projectId])
    if (result.length === 0 || result[0].values.length === 0) return []
    return result[0].values.map((row) => ({
      id: row[0] as string,
      projectId: row[1] as string,
      name: row[2] as string,
      type: row[3] as EntryType,
      description: row[4] as string,
      content: row[5] as string,
      tags: JSON.parse(row[6] as string) as string[],
      aliases: JSON.parse(row[7] as string) as string[],
      createdAt: row[8] as string,
      updatedAt: row[9] as string,
    }))
  }

  async getTemplate(id: string): Promise<Template | null> {
    if (!this.db) throw new Error('Database not opened')
    const result = this.db.exec('SELECT * FROM templates WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) return null
    const row = result[0].values[0]
    return {
      id: row[0] as string,
      projectId: row[1] as string,
      name: row[2] as string,
      type: row[3] as EntryType,
      description: row[4] as string,
      content: row[5] as string,
      tags: JSON.parse(row[6] as string) as string[],
      aliases: JSON.parse(row[7] as string) as string[],
      createdAt: row[8] as string,
      updatedAt: row[9] as string,
    }
  }

  async updateTemplate(
    id: string,
    name: string,
    type: EntryType,
    description: string,
    content: string,
    tags: string[],
    aliases: string[],
  ): Promise<Template | null> {
    if (!this.db) throw new Error('Database not opened')
    const now = getNow()
    const result = this.db.exec(
      'UPDATE templates SET name = ?, type = ?, description = ?, content = ?, tags = ?, aliases = ?, updated_at = ? WHERE id = ?',
      [
        name,
        type,
        description,
        content,
        JSON.stringify(tags),
        JSON.stringify(aliases),
        now,
        id,
      ] as SqlValue[],
    )
    if (result.length === 0) return null
    return this.getTemplate(id)
  }

  async deleteTemplate(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('DELETE FROM templates WHERE id = ?', [id])
  }

  async ensureBuiltinFieldSchemas(projectId: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    const now = getNow()

    for (const schema of BUILTIN_FIELD_SCHEMAS) {
      const existing = this.db.exec('SELECT id FROM custom_field_schemas WHERE id = ?', [schema.id])
      if (existing.length === 0 || existing[0].values.length === 0) {
        this.db.run(
          `INSERT INTO custom_field_schemas (id, project_id, key, label, type, entry_type, required, options, placeholder, default_value, sort_order, group_label, is_builtin, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
          [
            schema.id,
            projectId,
            schema.key,
            schema.label,
            schema.type,
            schema.entryType || null,
            schema.required ? 1 : 0,
            JSON.stringify(schema.options || []),
            schema.placeholder || '',
            schema.defaultValue !== undefined ? JSON.stringify(schema.defaultValue) : null,
            schema.sortOrder,
            schema.group || '',
            now,
          ] as SqlValue[],
        )
      }
    }
  }

  async listFieldSchemas(projectId: string, entryType?: EntryType): Promise<CustomFieldSchema[]> {
    if (!this.db) throw new Error('Database not opened')

    let query = 'SELECT * FROM custom_field_schemas WHERE (project_id = ? OR is_builtin = 1)'
    const params: SqlValue[] = [projectId]

    if (entryType) {
      query += ' AND (entry_type IS NULL OR entry_type = ?)'
      params.push(entryType)
    }

    query += ' ORDER BY sort_order ASC'

    const result = this.db.exec(query, params)
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      id: row[0] as string,
      key: row[2] as string,
      label: row[3] as string,
      type: row[4] as CustomFieldSchema['type'],
      entryType: row[5] as EntryType | undefined,
      required: row[6] === 1,
      options: JSON.parse(row[7] as string) as string[],
      placeholder: row[8] as string,
      defaultValue: row[9] ? JSON.parse(row[9] as string) : undefined,
      sortOrder: row[10] as number,
      group: row[11] as string,
    }))
  }

  async upsertFieldValue(
    entryId: string,
    fieldId: string,
    value: unknown,
    updatedAt?: string,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    const now = updatedAt || getNow()
    this.db.run(
      'INSERT OR REPLACE INTO custom_field_values (entry_id, field_id, value_text, updated_at) VALUES (?, ?, ?, ?)',
      [entryId, fieldId, JSON.stringify(value), now] as SqlValue[],
    )
  }

  async getEntryFieldValues(entryId: string): Promise<CustomFieldValue[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT * FROM custom_field_values WHERE entry_id = ?', [entryId])
    if (result.length === 0) return []

    return result[0].values.map((row) => ({
      entryId: row[0] as string,
      fieldId: row[1] as string,
      value: row[2] ? JSON.parse(row[2] as string) : null,
      updatedAt: row[3] as string,
    }))
  }

  async deleteFieldValuesForEntry(entryId: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('DELETE FROM custom_field_values WHERE entry_id = ?', [entryId])
  }

  async createCustomFieldSchema(
    projectId: string,
    schema: Omit<CustomFieldSchema, 'id'> & { id?: string },
  ): Promise<CustomFieldSchema> {
    if (!this.db) throw new Error('Database not opened')
    const now = getNow()
    const id = schema.id || generateId('cf')

    const fullSchema: CustomFieldSchema = {
      ...schema,
      id,
    }

    this.db.run(
      `INSERT INTO custom_field_schemas (id, project_id, key, label, type, entry_type, required, options, placeholder, default_value, sort_order, group_label, is_builtin, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
      [
        id,
        projectId,
        schema.key,
        schema.label,
        schema.type,
        schema.entryType || null,
        schema.required ? 1 : 0,
        JSON.stringify(schema.options || []),
        schema.placeholder || '',
        schema.defaultValue !== undefined ? JSON.stringify(schema.defaultValue) : null,
        schema.sortOrder,
        schema.group || '',
        now,
      ] as SqlValue[],
    )

    return fullSchema
  }

  async deleteCustomFieldSchema(schemaId: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('DELETE FROM custom_field_values WHERE field_id = ?', [schemaId])
    this.db.run('DELETE FROM custom_field_schemas WHERE id = ?', [schemaId])
  }

  async createEra(
    projectId: string,
    parentId: string | null,
    name: string,
    shortName: string,
    startSortValue: number,
    endSortValue: number,
    description = '',
    color = '#6366f1',
  ): Promise<Era> {
    if (!this.db) throw new Error('Database not opened')
    const id = generateId('era')
    const now = getNow()
    const era: Era = {
      id,
      projectId,
      parentId,
      name,
      shortName,
      startSortValue,
      endSortValue,
      description,
      color,
      createdAt: now,
    }
    this.db.run(
      `INSERT INTO eras (id, project_id, parent_id, name, short_name, start_sort_value, end_sort_value, description, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        projectId,
        parentId,
        name,
        shortName,
        startSortValue,
        endSortValue,
        description,
        color,
        now,
      ] as SqlValue[],
    )
    return era
  }

  async getEra(id: string): Promise<Era | null> {
    if (!this.db) throw new Error('Database not opened')
    const result = this.db.exec('SELECT * FROM eras WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) return null
    const row = result[0].values[0]
    return {
      id: row[0] as string,
      projectId: row[1] as string,
      parentId: row[2] as string | null,
      name: row[3] as string,
      shortName: row[4] as string,
      startSortValue: row[5] as number,
      endSortValue: row[6] as number,
      description: row[7] as string,
      color: row[8] as string,
      createdAt: row[9] as string,
    }
  }

  async updateEra(
    id: string,
    updates: Partial<
      Pick<
        Era,
        'name' | 'shortName' | 'startSortValue' | 'endSortValue' | 'description' | 'color' | 'parentId'
      >
    >,
  ): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    const fields: string[] = []
    const values: SqlValue[] = []
    if (updates.name !== undefined) {
      fields.push('name = ?')
      values.push(updates.name)
    }
    if (updates.shortName !== undefined) {
      fields.push('short_name = ?')
      values.push(updates.shortName)
    }
    if (updates.startSortValue !== undefined) {
      fields.push('start_sort_value = ?')
      values.push(updates.startSortValue)
    }
    if (updates.endSortValue !== undefined) {
      fields.push('end_sort_value = ?')
      values.push(updates.endSortValue)
    }
    if (updates.description !== undefined) {
      fields.push('description = ?')
      values.push(updates.description)
    }
    if (updates.color !== undefined) {
      fields.push('color = ?')
      values.push(updates.color)
    }
    if (updates.parentId !== undefined) {
      fields.push('parent_id = ?')
      values.push(updates.parentId)
    }
    if (fields.length === 0) return
    values.push(id)
    this.db.run(`UPDATE eras SET ${fields.join(', ')} WHERE id = ?`, values)
  }

  async deleteEra(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('UPDATE eras SET parent_id = NULL WHERE parent_id = ?', [id])
    this.db.run('DELETE FROM eras WHERE id = ?', [id])
  }

  async listEras(projectId: string): Promise<Era[]> {
    if (!this.db) throw new Error('Database not opened')
    const result = this.db.exec('SELECT * FROM eras WHERE project_id = ? ORDER BY start_sort_value', [
      projectId,
    ])
    if (result.length === 0) return []
    return result[0].values.map((row) => ({
      id: row[0] as string,
      projectId: row[1] as string,
      parentId: row[2] as string | null,
      name: row[3] as string,
      shortName: row[4] as string,
      startSortValue: row[5] as number,
      endSortValue: row[6] as number,
      description: row[7] as string,
      color: row[8] as string,
      createdAt: row[9] as string,
    }))
  }

  async buildEraTree(projectId: string): Promise<Array<Era & { children: Era[] }>> {
    const eras = await this.listEras(projectId)
    const eraMap = new Map<string, Era & { children: Era[] }>()
    const roots: Array<Era & { children: Era[] }> = []
    for (const era of eras) {
      eraMap.set(era.id, { ...era, children: [] })
    }
    for (const era of eras) {
      const node = eraMap.get(era.id)!
      if (era.parentId && eraMap.has(era.parentId)) {
        eraMap.get(era.parentId)!.children.push(node)
      } else {
        roots.push(node)
      }
    }
    return roots
  }

  getStudio(projectId: string): StudioDocument {
    if (!this.db) throw new Error('Database not opened')
    const rows = this.db.exec('SELECT document FROM studio_documents WHERE project_id = ?', [projectId])
    const doc = rows[0]?.values[0] ? JSON.parse(rows[0].values[0][0] as string) : emptyStudio()
    validateStudio(doc)
    return doc
  }

  async publishGeneratedSettings(
    projectId: string,
    items: { type: EntryType; title: string; content: string }[],
    save?: (ids: string[]) => void,
  ): Promise<string[]> {
    if (!this.db) throw new Error('Database not opened')
    const existing = await this.listEntries(projectId)
    this.db.run('BEGIN TRANSACTION')
    try {
      const ids: string[] = []
      for (const item of items) {
        const content = textToHtml(item.content)
        let entry = existing.find(
          (e) =>
            e.status !== 'archived' &&
            e.type === item.type &&
            e.title === item.title &&
            e.content === content,
        )
        if (!entry) {
          entry = await this.createEntry(projectId, item.type, item.title, '', content)
          await this.updateEntry(entry.id, { status: 'proposed' })
          existing.push(entry)
        }
        ids.push(entry.id)
      }
      save?.(ids)
      this.db.run('COMMIT')
      return ids
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }

  async confirmGeneratedSettings(projectId: string, ids: string[], save?: () => void) {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('BEGIN TRANSACTION')
    try {
      for (const id of new Set(ids)) {
        const entry = await this.getEntry(id)
        if (entry?.projectId === projectId && entry.status === 'proposed')
          await this.updateEntry(id, { status: 'active' })
      }
      save?.()
      this.db.run('COMMIT')
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }

  saveStudio(projectId: string, document: StudioDocument): void {
    if (!this.db) throw new Error('Database not opened')
    validateStudio(document)
    this.db.run('INSERT OR REPLACE INTO studio_documents (project_id, document) VALUES (?, ?)', [
      projectId,
      JSON.stringify(document),
    ])
  }

  async applyWorldImpact(
    projectId: string,
    simulationId: string,
    impactId: string,
    revert = false,
  ): Promise<StudioDocument> {
    if (!this.db) throw new Error('Database not opened')
    const doc = this.getStudio(projectId)
    const impact = doc.simulations.find((s) => s.id === simulationId)?.impacts.find((p) => p.id === impactId)
    if (!impact || impact.status !== (revert ? 'accepted' : 'pending')) throw new Error('建议已处理或不存在')
    const entry = await this.getEntry(impact.entryId)
    if (!entry || entry.projectId !== projectId) throw new Error('目标条目不存在或不属于当前世界')
    if (
      entry.title !== impact.title ||
      entry.content !== (revert ? impact.appliedContent : impact.before) ||
      entry.updatedAt !== (revert ? impact.appliedUpdatedAt : impact.beforeUpdatedAt)
    )
      throw new Error('条目在推演或确认后已修改，请重新推演，避免覆盖最新设定')
    if (!impact.content.trim()) throw new Error('建议正文不能为空')
    this.db.run('BEGIN TRANSACTION')
    try {
      await this.updateEntry(entry.id, { content: revert ? impact.before : textToHtml(impact.content) })
      if (!revert && impact.pendingEntryId && impact.pendingEntryId !== entry.id) {
        const staged = await this.getEntry(impact.pendingEntryId)
        if (staged?.projectId === projectId && staged.status === 'proposed')
          await this.updateEntry(staged.id, { status: 'archived' })
      }
      const updated = await this.getEntry(entry.id)
      impact.status = revert ? 'reverted' : 'accepted'
      if (!revert) {
        impact.appliedContent = updated!.content
        impact.appliedUpdatedAt = updated!.updatedAt
      }
      this.saveStudio(projectId, doc)
      this.db.run('COMMIT')
      return doc
    } catch (e) {
      this.db.run('ROLLBACK')
      throw e
    }
  }

  getNovel(projectId: string, idea = ''): NovelDocument {
    if (!this.db) throw new Error('Database not opened')
    const rows = this.db.exec('SELECT document FROM novel_documents WHERE project_id = ?', [projectId])
    return rows[0]?.values[0] ? JSON.parse(rows[0].values[0][0] as string) : emptyNovel(idea)
  }

  saveNovel(projectId: string, document: NovelDocument): void {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('INSERT OR REPLACE INTO novel_documents (project_id, document) VALUES (?, ?)', [
      projectId,
      JSON.stringify(document),
    ])
  }

  async confirmNovelProposal(
    projectId: string,
    document: NovelDocument,
    proposalId: string,
  ): Promise<NovelDocument> {
    if (!this.db) throw new Error('Database not opened')
    const proposal = document.proposals.find((p) => p.id === proposalId)
    if (!proposal || proposal.status !== 'pending') throw new Error('建议已处理或不存在')
    if (!proposal.title.trim() || !proposal.content.trim()) throw new Error('请填写名称与内容')
    const previous = proposal.targetEntryId ? await this.getEntry(proposal.targetEntryId) : null
    if (proposal.targetEntryId && (!previous || previous.projectId !== projectId))
      throw new Error('目标设定不存在')
    if (previous && proposal.baseContent !== previous.content)
      throw new Error('原设定已修改，请重新检查后生成建议，避免覆盖最新内容')
    const appliedContent = textToHtml(proposal.content)
    const staged = proposal.pendingEntryId ? await this.getEntry(proposal.pendingEntryId) : null
    if (staged && staged.projectId !== projectId) throw new Error('目标设定不存在')
    if (
      !previous &&
      staged &&
      (staged.content !== (proposal.pendingBaseContent ?? appliedContent) ||
        (staged.status !== 'proposed' && staged.content !== appliedContent))
    )
      throw new Error('原设定已修改，请重新检查后生成建议，避免覆盖最新内容')
    this.db.run('BEGIN TRANSACTION')
    try {
      let id = previous?.id
      if (previous) await this.updateEntry(previous.id, { content: appliedContent })
      else if (staged) {
        id = staged.id
        await this.updateEntry(id, { title: proposal.title, content: appliedContent, status: 'active' })
      } else id = (await this.createEntry(projectId, proposal.type, proposal.title, '', appliedContent)).id
      if (previous && staged && staged.id !== previous.id && staged.status === 'proposed')
        await this.updateEntry(staged.id, { status: 'archived' })
      const next = {
        ...document,
        proposals: document.proposals.map((p) =>
          p.id === proposalId
            ? {
                ...p,
                status: 'accepted' as const,
                appliedEntryId: id,
                previousContent: previous?.content,
                appliedContent,
              }
            : p,
        ),
      }
      this.saveNovel(projectId, next)
      this.db.run('COMMIT')
      return next
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }

  async revertNovelProposal(
    projectId: string,
    document: NovelDocument,
    proposalId: string,
  ): Promise<NovelDocument> {
    if (!this.db) throw new Error('Database not opened')
    const proposal = document.proposals.find((p) => p.id === proposalId)
    if (
      !proposal ||
      proposal.status !== 'accepted' ||
      !proposal.targetEntryId ||
      proposal.appliedEntryId !== proposal.targetEntryId ||
      typeof proposal.previousContent !== 'string' ||
      typeof proposal.appliedContent !== 'string'
    )
      throw new Error('只有已确认的现有设定更新可以撤销')
    const entry = await this.getEntry(proposal.appliedEntryId)
    if (!entry || entry.projectId !== projectId) throw new Error('目标设定不存在')
    if (entry.content !== proposal.appliedContent)
      throw new Error('设定在确认后已修改，无法直接撤销；请对照原设定手动编辑')
    this.db.run('BEGIN TRANSACTION')
    try {
      await this.updateEntry(entry.id, { content: proposal.previousContent })
      const next: NovelDocument = {
        ...document,
        proposals: document.proposals.map((p) => (p.id === proposalId ? { ...p, status: 'reverted' } : p)),
      }
      this.saveNovel(projectId, next)
      this.db.run('COMMIT')
      return next
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }

  private captureAssetData(projectId: string): void {
    if (!this.db) throw new Error('Database not opened')
    const rows = this.db.exec('SELECT id, relative_path FROM assets WHERE project_id = ?', [projectId])
    for (const [id, relativePath] of rows[0]?.values ?? []) {
      const data =
        cachedAssetData(String(relativePath)) ||
        localStorage.getItem('wdworld_asset_' + relativePath) ||
        localStorage.getItem('wdworld_asset_' + id)
      if (data)
        this.db.run('INSERT OR REPLACE INTO asset_data (asset_id, data_url) VALUES (?, ?)', [id, data])
    }
  }

  async exportDatabase(): Promise<Uint8Array> {
    if (!this.db) throw new Error('Database not opened')
    const projects = this.db.exec('SELECT id FROM projects')
    for (const [id] of projects[0]?.values ?? []) this.captureAssetData(String(id))
    return this.db.export()
  }

  async importDatabase(data: Uint8Array): Promise<void> {
    const SQL = await getSqlJs()
    if (this.db) this.db.close()
    this.db = new SQL.Database(data)
    await this.init()
  }

  async exportProjectJSON(projectId: string): Promise<string> {
    if (!this.db) throw new Error('Database not opened')

    const projectResult = this.db.exec('SELECT * FROM projects WHERE id = ?', [projectId])
    if (projectResult.length === 0 || projectResult[0].values.length === 0) {
      throw new Error('Project not found')
    }

    const projectRow = projectResult[0].values[0]
    const project = {
      mode: this.getProjectMode(projectId),
      id: projectRow[0] as string,
      name: projectRow[1] as string,
      slug: projectRow[2] as string,
      description: projectRow[3] as string,
      schemaVersion: projectRow[4] as number,
      createdAt: projectRow[5] as string,
      updatedAt: projectRow[6] as string,
    }

    const selectAll = (sql: string, params: SqlValue[] = []): any[] => {
      const result = this.db!.exec(sql, params)
      if (result.length === 0) return []
      const columns = result[0].columns
      return result[0].values.map((row) => {
        const obj: any = {}
        columns.forEach((col, i) => {
          obj[col] = row[i]
        })
        return obj
      })
    }

    const entries = selectAll('SELECT * FROM entries WHERE project_id = ?', [projectId])
    const entryIds = entries.map((e: any) => e.id)

    const entryAliasesMap: Record<string, any[]> = {}
    if (entryIds.length > 0) {
      const placeholders = entryIds.map(() => '?').join(',')
      const allAliases = selectAll(
        `SELECT * FROM entry_aliases WHERE entry_id IN (${placeholders})`,
        entryIds,
      )
      for (const alias of allAliases) {
        if (!entryAliasesMap[alias.entry_id]) entryAliasesMap[alias.entry_id] = []
        entryAliasesMap[alias.entry_id].push(alias)
      }
    }

    const entryTagsMap: Record<string, any[]> = {}
    if (entryIds.length > 0) {
      const placeholders = entryIds.map(() => '?').join(',')
      const allEntryTags = selectAll(`SELECT * FROM entry_tags WHERE entry_id IN (${placeholders})`, entryIds)
      for (const et of allEntryTags) {
        if (!entryTagsMap[et.entry_id]) entryTagsMap[et.entry_id] = []
        entryTagsMap[et.entry_id].push(et)
      }
    }

    const entryTimelineMap: Record<string, any[]> = {}
    if (entryIds.length > 0) {
      const placeholders = entryIds.map(() => '?').join(',')
      const allTimeline = selectAll(
        `SELECT * FROM timeline_events WHERE entry_id IN (${placeholders})`,
        entryIds,
      )
      for (const t of allTimeline) {
        if (!entryTimelineMap[t.entry_id]) entryTimelineMap[t.entry_id] = []
        entryTimelineMap[t.entry_id].push(t)
      }
    }

    const entryAnchorsMap: Record<string, any[]> = {}
    if (entryIds.length > 0) {
      const placeholders = entryIds.map(() => '?').join(',')
      const allAnchors = selectAll(`SELECT * FROM anchors WHERE entry_id IN (${placeholders})`, entryIds)
      for (const a of allAnchors) {
        if (!entryAnchorsMap[a.entry_id]) entryAnchorsMap[a.entry_id] = []
        entryAnchorsMap[a.entry_id].push(a)
      }
    }

    const entryFieldValuesMap: Record<string, any[]> = {}
    let customFieldValues: any[] = []
    try {
      if (entryIds.length > 0) {
        const placeholders = entryIds.map(() => '?').join(',')
        customFieldValues = selectAll(
          `SELECT * FROM custom_field_values WHERE entry_id IN (${placeholders})`,
          entryIds,
        )
        for (const fv of customFieldValues) {
          if (!entryFieldValuesMap[fv.entry_id]) entryFieldValuesMap[fv.entry_id] = []
          entryFieldValuesMap[fv.entry_id].push(fv)
        }
      }
    } catch {
      customFieldValues = []
    }

    const entriesWithRelated = entries.map((e: any) => ({
      ...e,
      aliases: entryAliasesMap[e.id] || [],
      tags: entryTagsMap[e.id] || [],
      timeline_events: entryTimelineMap[e.id] || [],
      anchors: entryAnchorsMap[e.id] || [],
      fieldValues: entryFieldValuesMap[e.id] || [],
    }))

    const tags = selectAll('SELECT * FROM tags WHERE project_id = ?', [projectId])
    const entryTags = selectAll(
      'SELECT et.* FROM entry_tags et JOIN entries e ON et.entry_id = e.id WHERE e.project_id = ?',
      [projectId],
    )
    const relations = selectAll('SELECT * FROM relations WHERE project_id = ?', [projectId])
    const backlinks = selectAll('SELECT * FROM backlinks WHERE project_id = ?', [projectId])
    const anchors = selectAll(
      'SELECT a.* FROM anchors a JOIN entries e ON a.entry_id = e.id WHERE e.project_id = ?',
      [projectId],
    )
    const timelineEvents = selectAll(
      'SELECT te.* FROM timeline_events te JOIN entries e ON te.entry_id = e.id WHERE e.project_id = ?',
      [projectId],
    )
    this.captureAssetData(projectId)
    const assets = selectAll(
      'SELECT a.*, d.data_url FROM assets a LEFT JOIN asset_data d ON d.asset_id = a.id WHERE a.project_id = ?',
      [projectId],
    )
    const templates = selectAll('SELECT * FROM templates WHERE project_id = ?', [projectId])

    let customFieldSchemas: any[] = []
    try {
      customFieldSchemas = selectAll(
        'SELECT * FROM custom_field_schemas WHERE project_id = ? AND is_builtin = 0',
        [projectId],
      )
    } catch {
      customFieldSchemas = []
    }

    let eras: any[] = []
    try {
      eras = selectAll('SELECT * FROM eras WHERE project_id = ?', [projectId])
    } catch {
      eras = []
    }

    const exportData = {
      _schemaVersion: SCHEMA_VERSION,
      novel: this.getNovel(projectId),
      studio: this.getStudio(projectId),
      templates,
      _exportedAt: new Date().toISOString(),
      project,
      entries: entriesWithRelated,
      tags,
      entry_tags: entryTags,
      relations,
      backlinks,
      anchors,
      timeline_events: timelineEvents,
      assets,
      custom_field_schemas: customFieldSchemas,
      custom_field_values: customFieldValues,
      eras,
    }

    return JSON.stringify(exportData, null, 2)
  }

  async importProjectJSON(jsonString: string, options?: { nameSuffix?: string }): Promise<Project> {
    if (!this.db) throw new Error('Database not opened')

    const data = JSON.parse(jsonString)
    if (!data || !data.project || typeof data.project.name !== 'string' || !Array.isArray(data.entries))
      throw new Error('无效的项目备份')

    if (!data._schemaVersion || data._schemaVersion > SCHEMA_VERSION) {
      throw new Error(`不支持的备份版本：${data._schemaVersion}，当前支持最高版本：${SCHEMA_VERSION}`)
    }

    const newProjectId = generateId('proj')
    const now = getNow()
    const nameSuffix = options?.nameSuffix || ' (副本)'
    const originalProject = data.project
    const newProjectName = originalProject.name + nameSuffix
    const newProjectSlug = generateSlug(newProjectName) + '-' + newProjectId

    const idMapping: Record<string, string> = {}

    const genNewId = (oldId: string, prefix: string) => {
      if (!idMapping[oldId]) {
        idMapping[oldId] = generateId(prefix)
      }
      return idMapping[oldId]
    }

    // Allocate IDs before resolving cross-references, including nested legacy records.
    for (const key of [
      'entries',
      'tags',
      'assets',
      'anchors',
      'timeline_events',
      'custom_field_schemas',
      'eras',
      'templates',
    ]) {
      for (const row of data[key] || []) genNewId(row.id, key.slice(0, 3))
    }
    for (const entry of data.entries) {
      for (const row of entry.anchors || []) genNewId(row.id, 'anc')
      for (const row of entry.timeline_events || []) genNewId(row.id, 'tim')
    }
    this.db.run('BEGIN TRANSACTION')
    this.db.run('PRAGMA defer_foreign_keys = ON')
    try {
      const newProject: Project = {
        id: newProjectId,
        name: newProjectName,
        slug: newProjectSlug,
        description: originalProject.description || '',
        schemaVersion: SCHEMA_VERSION,
        createdAt: now,
        updatedAt: now,
      }

      this.db.run(
        'INSERT INTO projects (id, name, slug, description, schema_version, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          newProjectId,
          newProjectName,
          newProjectSlug,
          originalProject.description || '',
          SCHEMA_VERSION,
          now,
          now,
        ] as SqlValue[],
      )

      this.db.run('INSERT INTO project_modes (project_id, mode) VALUES (?, ?)', [
        newProjectId,
        ['novel', 'oc', 'trpg', 'tavern'].includes(originalProject.mode) ? originalProject.mode : 'free',
      ])
      newProject.mode = this.getProjectMode(newProjectId)
      for (const tag of data.tags || []) {
        const newTagId = genNewId(tag.id, 'tag')
        this.db.run('INSERT INTO tags (id, project_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)', [
          newTagId,
          newProjectId,
          tag.name,
          tag.color || null,
          tag.created_at || now,
        ] as SqlValue[])
      }

      for (const entry of data.entries || []) {
        const newEntryId = genNewId(entry.id, (entry.type || 'ent').slice(0, 3))
        this.db.run(
          `INSERT INTO entries (id, project_id, type, title, slug, summary, content, status, visibility, region,
          condition, occupants, cover_asset_id, map_position_x, map_position_y, anchor_id, created_at, updated_at, archived_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newEntryId,
            newProjectId,
            entry.type,
            entry.title,
            entry.slug || generateSlug(entry.title),
            entry.summary || '',
            entry.content || '',
            entry.status || 'draft',
            entry.visibility || 'private',
            entry.region || '',
            entry.condition || '',
            entry.occupants || '',
            entry.cover_asset_id ? idMapping[entry.cover_asset_id] || null : null,
            entry.map_position_x,
            entry.map_position_y,
            entry.anchor_id ? idMapping[entry.anchor_id] || null : null,
            entry.created_at || now,
            entry.updated_at || now,
            entry.archived_at || null,
          ] as SqlValue[],
        )

        for (const alias of entry.aliases || []) {
          const newAliasId = generateId('als')
          this.db.run(
            'INSERT INTO entry_aliases (id, entry_id, value, normalized_value) VALUES (?, ?, ?, ?)',
            [
              newAliasId,
              newEntryId,
              alias.value,
              alias.normalized_value || (alias.value as string).toLowerCase().trim(),
            ] as SqlValue[],
          )
        }
      }

      for (const entry of data.entries || []) {
        const newEntryId = idMapping[entry.id]
        for (const et of entry.tags || []) {
          const newTagId = idMapping[et.tag_id]
          if (newTagId) {
            this.db.run('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)', [
              newEntryId,
              newTagId,
            ] as SqlValue[])
          }
        }
      }

      for (const et of data.entry_tags || []) {
        const newEntryId = idMapping[et.entry_id]
        const newTagId = idMapping[et.tag_id]
        if (newEntryId && newTagId) {
          this.db.run('INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)', [
            newEntryId,
            newTagId,
          ] as SqlValue[])
        }
      }

      for (const entry of data.entries || []) {
        const newEntryId = idMapping[entry.id]
        for (const anchor of entry.anchors || []) {
          const newAnchorId = genNewId(anchor.id, 'anc')
          this.db.run(
            'INSERT INTO anchors (id, entry_id, label, x, y, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              newAnchorId,
              newEntryId,
              anchor.label,
              anchor.x,
              anchor.y,
              anchor.notes || '',
              anchor.created_at || now,
            ] as SqlValue[],
          )
        }
      }

      for (const anchor of data.anchors || []) {
        if (!this.db.exec('SELECT id FROM anchors WHERE id = ?', [idMapping[anchor.id]])[0]?.values.length) {
          const newEntryId = idMapping[anchor.entry_id]
          if (newEntryId) {
            const newAnchorId = genNewId(anchor.id, 'anc')
            this.db.run(
              'INSERT INTO anchors (id, entry_id, label, x, y, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [
                newAnchorId,
                newEntryId,
                anchor.label,
                anchor.x,
                anchor.y,
                anchor.notes || '',
                anchor.created_at || now,
              ] as SqlValue[],
            )
          }
        }
      }

      for (const entry of data.entries || []) {
        const newEntryId = idMapping[entry.id]
        for (const te of entry.timeline_events || []) {
          const newTeId = genNewId(te.id, 't')
          this.db.run(
            'INSERT INTO timeline_events (id, entry_id, point_label, title, sort_value, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              newTeId,
              newEntryId,
              te.point_label || '',
              te.title,
              te.sort_value,
              te.description || '',
              te.created_at || now,
            ] as SqlValue[],
          )
        }
      }

      for (const te of data.timeline_events || []) {
        if (
          !this.db.exec('SELECT id FROM timeline_events WHERE id = ?', [idMapping[te.id]])[0]?.values.length
        ) {
          const newEntryId = idMapping[te.entry_id]
          if (newEntryId) {
            const newTeId = genNewId(te.id, 't')
            this.db.run(
              'INSERT INTO timeline_events (id, entry_id, point_label, title, sort_value, description, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
              [
                newTeId,
                newEntryId,
                te.point_label || '',
                te.title,
                te.sort_value,
                te.description || '',
                te.created_at || now,
              ] as SqlValue[],
            )
          }
        }
      }

      for (const entry of data.entries || []) {
        const newEntryId = idMapping[entry.id]
        for (const fv of entry.fieldValues || []) {
          const newFieldId = idMapping[fv.field_id] || fv.field_id
          this.db.run(
            'INSERT OR IGNORE INTO custom_field_values (entry_id, field_id, value_text, updated_at) VALUES (?, ?, ?, ?)',
            [newEntryId, newFieldId, fv.value_text || '', fv.updated_at || now] as SqlValue[],
          )
        }
      }

      for (const fv of data.custom_field_values || []) {
        const newEntryId = idMapping[fv.entry_id]
        if (newEntryId) {
          const newFieldId = idMapping[fv.field_id] || fv.field_id
          this.db.run(
            'INSERT OR IGNORE INTO custom_field_values (entry_id, field_id, value_text, updated_at) VALUES (?, ?, ?, ?)',
            [newEntryId, newFieldId, fv.value_text || '', fv.updated_at || now] as SqlValue[],
          )
        }
      }

      for (const relation of data.relations || []) {
        const newRelId = genNewId(relation.id, 'rel')
        const newSourceId = idMapping[relation.source_entry_id]
        const newTargetId = idMapping[relation.target_entry_id]
        if (newSourceId && newTargetId) {
          this.db.run(
            'INSERT INTO relations (id, project_id, source_entry_id, target_entry_id, type, direction, note, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              newRelId,
              newProjectId,
              newSourceId,
              newTargetId,
              relation.type,
              relation.direction || 'directed',
              relation.note || '',
              relation.created_at || now,
              relation.updated_at || now,
            ] as SqlValue[],
          )
        }
      }

      for (const bl of data.backlinks || []) {
        const newBlId = genNewId(bl.id, 'bl')
        const newSourceId = idMapping[bl.source_entry_id]
        const newTargetId = idMapping[bl.target_entry_id]
        if (newSourceId && newTargetId) {
          this.db.run(
            'INSERT OR IGNORE INTO backlinks (id, project_id, source_entry_id, target_entry_id, link_text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            [
              newBlId,
              newProjectId,
              newSourceId,
              newTargetId,
              bl.link_text || '',
              bl.created_at || now,
            ] as SqlValue[],
          )
        }
      }

      for (const asset of data.assets || []) {
        const newAssetId = genNewId(asset.id, 'ast')
        this.db.run(
          'INSERT INTO assets (id, project_id, kind, filename, relative_path, mime_type, size, checksum, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            newAssetId,
            newProjectId,
            asset.kind,
            asset.filename,
            asset.relative_path,
            asset.mime_type,
            asset.size,
            asset.checksum || null,
            asset.created_at || now,
          ] as SqlValue[],
        )
      }

      for (const asset of data.assets || []) {
        if (typeof asset.data_url === 'string')
          this.db.run('INSERT INTO asset_data (asset_id, data_url) VALUES (?, ?)', [
            idMapping[asset.id],
            asset.data_url,
          ])
      }

      for (const schema of data.custom_field_schemas || []) {
        try {
          const newSchemaId = genNewId(schema.id, 'cfs')
          this.db.run(
            `INSERT INTO custom_field_schemas (id, project_id, key, label, type, entry_type, required, options, placeholder, default_value, sort_order, group_label, is_builtin, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newSchemaId,
              newProjectId,
              schema.key,
              schema.label,
              schema.type,
              schema.entry_type || null,
              schema.required || 0,
              schema.options || '[]',
              schema.placeholder || '',
              schema.default_value || null,
              schema.sort_order || 0,
              schema.group_label || '',
              schema.is_builtin || 0,
              schema.created_at || now,
            ] as SqlValue[],
          )
        } catch (error) {
          throw error
        }
      }

      for (const era of data.eras || []) {
        try {
          const newEraId = genNewId(era.id, 'era')
          const newParentId = era.parent_id ? idMapping[era.parent_id] || null : null
          this.db.run(
            `INSERT INTO eras (id, project_id, parent_id, name, short_name, start_sort_value, end_sort_value, description, color, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              newEraId,
              newProjectId,
              newParentId,
              era.name,
              era.short_name || '',
              era.start_sort_value,
              era.end_sort_value,
              era.description || '',
              era.color || '#6366f1',
              era.created_at || now,
            ] as SqlValue[],
          )
        } catch (error) {
          throw error
        }
      }

      for (const template of data.templates || []) {
        this.db.run(
          'INSERT INTO templates (id, project_id, name, type, description, content, tags, aliases, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            idMapping[template.id],
            newProjectId,
            template.name,
            template.type,
            template.description || '',
            template.content || '',
            template.tags || '[]',
            template.aliases || '[]',
            template.created_at || now,
            template.updated_at || now,
          ],
        )
      }
      if (data.studio) {
        validateStudio(data.studio)
        this.saveStudio(newProjectId, remapStudio(data.studio, idMapping))
      }
      if (data.novel) {
        const novel = data.novel as NovelDocument
        validateNovel(novel)
        if (
          novel.version !== 1 ||
          !Array.isArray(novel.chapters) ||
          !Array.isArray(novel.snapshots) ||
          !Array.isArray(novel.generations) ||
          !Array.isArray(novel.proposals) ||
          !Array.isArray(novel.issues)
        )
          throw new Error('小说备份格式无效')
        const remap = (content: {
          chapters: NovelDocument['chapters']
          proposals: NovelDocument['proposals']
        }) => {
          content.chapters.forEach((c) => {
            c.entryIds = c.entryIds.map((id) => idMapping[id]).filter(Boolean)
          })
          content.proposals.forEach((p) => {
            if (p.pendingEntryId) p.pendingEntryId = idMapping[p.pendingEntryId]
            if (p.targetEntryId) p.targetEntryId = idMapping[p.targetEntryId]
            if (p.appliedEntryId) p.appliedEntryId = idMapping[p.appliedEntryId]
          })
        }
        remap(novel)
        novel.snapshots.forEach((s) => remap(s.data))
        novel.generations = novel.generations.map((g) => ({
          ...g,
          status: g.status === 'ready' ? 'discarded' : g.status,
          worldEntryIds: g.worldEntryIds?.map((id) => idMapping[id]).filter(Boolean),
        }))
        this.saveNovel(newProjectId, novel)
      }
      await this.ensureBuiltinFieldSchemas(newProjectId)
      this.db.run('COMMIT')
      return newProject
    } catch (error) {
      this.db.run('ROLLBACK')
      throw error
    }
  }
}

function isElectronEnv(): boolean {
  return typeof window !== 'undefined' && !!window.wdAPI
}

function uint8ToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

function base64ToUint8(base64: string): Uint8Array {
  const binary = atob(base64)
  const len = binary.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}

interface IDBProjectRecord {
  id: string
  project: Project
  dbBase64: string
  updatedAt: string
  createdAt?: string
  name?: string
}

let idbPromise: Promise<IDBDatabase> | null = null

function openIDB(): Promise<IDBDatabase> {
  if (idbPromise) return idbPromise
  idbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open('wdworld', 1)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains('projects')) {
        db.createObjectStore('projects', { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains('recent')) {
        db.createObjectStore('recent')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return idbPromise
}

function idbPut<T>(store: string, value: T, key?: IDBValidKey): Promise<void> {
  return openIDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite')
        const os = tx.objectStore(store)
        const req = key !== undefined ? os.put(value, key) : os.put(value)
        tx.oncomplete = () => resolve()
        tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted'))
        tx.onerror = () => reject(tx.error)
        req.onerror = () => reject(req.error)
      }),
  )
}

function idbGet<T>(store: string, key: IDBValidKey): Promise<T | undefined> {
  return openIDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly')
        const req = tx.objectStore(store).get(key)
        req.onsuccess = () => resolve(req.result as T | undefined)
        req.onerror = () => reject(req.error)
      }),
  )
}

function idbGetAll<T>(store: string): Promise<T[]> {
  return openIDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readonly')
        const req = tx.objectStore(store).getAll()
        req.onsuccess = () => resolve(req.result as T[])
        req.onerror = () => reject(req.error)
      }),
  )
}

function idbDelete(store: string, key: IDBValidKey): Promise<void> {
  return openIDB().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(store, 'readwrite')
        const req = tx.objectStore(store).delete(key)
        tx.oncomplete = () => resolve()
        tx.onabort = () => reject(tx.error || new Error('Storage transaction aborted'))
        tx.onerror = () => reject(tx.error)
        req.onerror = () => reject(req.error)
      }),
  )
}

export async function saveProjectData(
  projectId: string,
  project: Project,
  dbData: Uint8Array,
): Promise<{ ok: boolean; error?: string }> {
  const dbBase64 = uint8ToBase64(dbData)
  const projectJson = JSON.stringify(project)
  const now = new Date().toISOString()

  if (isElectronEnv() && window.wdAPI) {
    try {
      return await window.wdAPI.saveProject(projectId, projectJson, dbBase64)
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  }

  try {
    const record: IDBProjectRecord = {
      id: projectId,
      project,
      dbBase64,
      updatedAt: now,
      createdAt: project.createdAt,
      name: project.name,
    }
    await idbPut('projects', record)
  } catch (e) {
    try {
      localStorage.setItem(`wdworld_project_${projectId}`, projectJson)
      localStorage.setItem(`wdworld_db_${projectId}`, dbBase64)
    } catch (err) {
      if ((err as DOMException).name === 'QuotaExceededError') {
        return { ok: false, error: '存储配额不足' }
      }
      return { ok: false, error: (err as Error).message }
    }
  }

  return { ok: true }
}

export async function loadProjectData(
  projectId: string,
): Promise<{ project: Project; dbData: Uint8Array } | null> {
  if (isElectronEnv() && window.wdAPI) {
    try {
      const result = await window.wdAPI.loadProject(projectId)
      if (!result || !result.projectJson || !result.dbBase64) return null
      const project = JSON.parse(result.projectJson) as Project
      const dbData = base64ToUint8(result.dbBase64)
      return { project, dbData }
    } catch {
      return null
    }
  }

  try {
    const record = await idbGet<IDBProjectRecord>('projects', projectId)
    if (record) {
      return { project: record.project, dbData: base64ToUint8(record.dbBase64) }
    }
  } catch {}

  const projectStr = localStorage.getItem(`wdworld_project_${projectId}`)
  const dbStr = localStorage.getItem(`wdworld_db_${projectId}`)
  if (!projectStr || !dbStr) return null
  try {
    const project = JSON.parse(projectStr) as Project
    const dbData = base64ToUint8(dbStr)
    return { project, dbData }
  } catch {
    return null
  }
}

export async function saveRecentProjects(list: unknown): Promise<{ ok: boolean; error?: string }> {
  if (isElectronEnv() && window.wdAPI) {
    try {
      return await window.wdAPI.saveRecentProjects(list)
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  }

  try {
    await idbPut('recent', list, 'list')
  } catch {
    try {
      localStorage.setItem('wdworld_recent_projects', JSON.stringify(list))
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  }
  return { ok: true }
}

export async function loadRecentProjects(): Promise<unknown | null> {
  if (isElectronEnv() && window.wdAPI) {
    try {
      const result = await window.wdAPI.loadRecentProjects()
      if (result && result.list !== undefined) return result.list
    } catch {}
  }

  try {
    const val = await idbGet<unknown>('recent', 'list')
    if (val !== undefined) return val
  } catch {}

  const raw = localStorage.getItem('wdworld_recent_projects')
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

interface StoredProjectInfo {
  id: string
  name: string
  createdAt: string
  updatedAt: string
}

export async function listStoredProjects(): Promise<StoredProjectInfo[]> {
  if (isElectronEnv() && window.wdAPI) {
    try {
      const result = await window.wdAPI.listProjects()
      if (result.projects) return result.projects
    } catch {}
  }

  try {
    const records = await idbGetAll<IDBProjectRecord>('projects')
    if (records.length > 0) {
      return records.map((r) => ({
        id: r.id,
        name: r.name ?? r.project.name,
        createdAt: r.createdAt ?? r.project.createdAt,
        updatedAt: r.updatedAt ?? r.project.updatedAt,
      }))
    }
  } catch {}

  const results: StoredProjectInfo[] = []
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (!key || !key.startsWith('wdworld_project_')) continue
    const id = key.slice('wdworld_project_'.length)
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const p = JSON.parse(raw) as Project
      results.push({
        id,
        name: p.name,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })
    } catch {}
  }
  return results
}

export async function deleteStoredProject(projectId: string): Promise<{ ok: boolean; error?: string }> {
  if (isElectronEnv() && window.wdAPI) {
    try {
      await window.wdAPI.deleteProject(projectId)
    } catch {}
  }

  try {
    await idbDelete('projects', projectId)
  } catch {}

  try {
    localStorage.removeItem(`wdworld_project_${projectId}`)
    localStorage.removeItem(`wdworld_db_${projectId}`)
  } catch {}

  return { ok: true }
}
