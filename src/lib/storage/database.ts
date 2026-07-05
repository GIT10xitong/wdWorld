import initSqlJs, { Database as SqlJsDatabase, SqlJsStatic, SqlValue } from 'sql.js'
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
} from '@/types'
import { generateId, generateSlug, getNow } from '@/lib/utils'

const SCHEMA_VERSION = 1

const INITIAL_SQL = `
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_entries_project_slug ON entries(project_id, slug);
CREATE INDEX IF NOT EXISTS idx_entries_project_type ON entries(project_id, type);
CREATE INDEX IF NOT EXISTS idx_entries_project_updated ON entries(project_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_region ON entries(region);
CREATE INDEX IF NOT EXISTS idx_relations_source ON relations(source_entry_id);
CREATE INDEX IF NOT EXISTS idx_relations_target ON relations(target_entry_id);
CREATE INDEX IF NOT EXISTS idx_timeline_entry_sort ON timeline_events(entry_id, sort_value);
`

let sqlJsInstance: SqlJsStatic | null = null

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsInstance) {
    sqlJsInstance = await initSqlJs({
      locateFile: (file) => `https://sql.js.org/dist/${file}`,
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
    this.db.run(INITIAL_SQL)
  }

  async createProject(name: string, description: string = ''): Promise<Project> {
    if (!this.db) throw new Error('Database not opened')

    const id = generateId('proj')
    const slug = generateSlug(name)
    const now = getNow()

    const project: Project = {
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
      [id, name, slug, description, SCHEMA_VERSION, now, now] as SqlValue[]
    )

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

  async createEntry(
    projectId: string,
    type: EntryType,
    title: string,
    summary: string = '',
    content: string = ''
  ): Promise<Entry> {
    if (!this.db) throw new Error('Database not opened')

    const id = generateId(type.slice(0, 3))
    const slug = generateSlug(title)
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
      ] as SqlValue[]
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
    updates: Partial<Pick<Entry, 'title' | 'summary' | 'content' | 'status' | 'visibility' | 'region' | 'condition' | 'occupants'>>
  ): Promise<void> {
    if (!this.db) throw new Error('Database not opened')

    const now = getNow()
    const fields: string[] = []
    const values: SqlValue[] = []

    if (updates.title !== undefined) {
      fields.push('title = ?')
      values.push(updates.title)
      fields.push('slug = ?')
      values.push(generateSlug(updates.title))
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
    this.db.run('DELETE FROM entries WHERE id = ?', [id])
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
      [projectId, `%${query}%`, `%${query}%`, `%${query}%`] as SqlValue[]
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

    this.db.run(
      'INSERT INTO tags (id, project_id, name, color, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, projectId, name, color || null, now] as SqlValue[]
    )

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
    this.db.run(
      'UPDATE tags SET name = ?, color = ? WHERE id = ?',
      [name, color || null, id] as SqlValue[]
    )
  }

  async deleteTag(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('DELETE FROM tags WHERE id = ?', [id])
    this.db.run('DELETE FROM entry_tags WHERE tag_id = ?', [id])
  }

  async getEntryTags(entryId: string): Promise<Tag[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec(
      `SELECT t.* FROM tags t JOIN entry_tags et ON t.id = et.tag_id WHERE et.entry_id = ? ORDER BY t.name`,
      [entryId]
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
    this.db.run(
      'INSERT OR IGNORE INTO entry_tags (entry_id, tag_id) VALUES (?, ?)',
      [entryId, tagId] as SqlValue[]
    )
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

    this.db.run(
      'INSERT INTO entry_aliases (id, entry_id, value, normalized_value) VALUES (?, ?, ?, ?)',
      [id, entryId, value, normalizedValue] as SqlValue[]
    )

    return alias
  }

  async getEntryAliases(entryId: string): Promise<Alias[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT * FROM entry_aliases WHERE entry_id = ? ORDER BY normalized_value', [entryId])
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
    checksum?: string
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
      [id, projectId, kind, filename, relativePath, mimeType, size, checksum || null, now] as SqlValue[]
    )

    return asset
  }

  async getAssets(projectId: string, kind?: string): Promise<Asset[]> {
    if (!this.db) throw new Error('Database not opened')

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
    this.db.run('DELETE FROM assets WHERE id = ?', [id])
  }

  async updateEntryCoverAsset(entryId: string, assetId: string | null): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('UPDATE entries SET cover_asset_id = ? WHERE id = ?', [assetId, entryId])
  }

  async searchByTag(projectId: string, tagId: string): Promise<Entry[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec(
      `SELECT e.* FROM entries e JOIN entry_tags et ON e.id = et.entry_id WHERE e.project_id = ? AND et.tag_id = ? ORDER BY e.updated_at DESC`,
      [projectId, tagId] as SqlValue[]
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

    const result = this.db.exec(
      'SELECT * FROM tags WHERE project_id = ? AND name LIKE ? ORDER BY name',
      [projectId, `%${query}%`] as SqlValue[]
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

  async createRelation(
    projectId: string,
    sourceEntryId: string,
    targetEntryId: string,
    type: string,
    note: string = ''
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
      [id, projectId, sourceEntryId, targetEntryId, type, 'directed', note, now, now] as SqlValue[]
    )

    return relation
  }

  async getRelations(projectId: string): Promise<Relation[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT * FROM relations WHERE project_id = ? ORDER BY created_at DESC', [projectId])
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
      [entryId, entryId]
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

  async updateRelation(id: string, updates: Partial<Pick<Relation, 'type' | 'direction' | 'note'>>): Promise<void> {
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
      [entryId]
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

  async addBacklink(sourceEntryId: string, targetEntryId: string, linkText: string = ''): Promise<void> {
    if (!this.db) throw new Error('Database not opened')

    const id = generateId('bl')
    const now = getNow()

    this.db.run(
      'INSERT OR IGNORE INTO backlinks (id, project_id, source_entry_id, target_entry_id, link_text, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [id, '', sourceEntryId, targetEntryId, linkText, now] as SqlValue[]
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
        [projectId, `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`] as SqlValue[]
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

  async createAnchor(entryId: string, label: string, x: number, y: number, notes: string = ''): Promise<Anchor> {
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
      [id, entryId, label, x, y, notes, now] as SqlValue[]
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
    this.db.run('DELETE FROM anchors WHERE id = ?', [id])
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
      [projectId]
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

  async createTimelineEvent(entryId: string, pointLabel: string, title: string, sortValue: number, description: string = ''): Promise<TimelineEvent> {
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
      [id, entryId, pointLabel, title, sortValue, description, now] as SqlValue[]
    )

    return event
  }

  async getTimelineEvents(entryId: string): Promise<TimelineEvent[]> {
    if (!this.db) throw new Error('Database not opened')

    const result = this.db.exec('SELECT * FROM timeline_events WHERE entry_id = ? ORDER BY sort_value', [entryId])
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
      [projectId]
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

  async createTemplate(projectId: string, name: string, type: EntryType, description: string, content: string, tags: string[], aliases: string[]): Promise<Template> {
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
      [id, projectId, name, type, description, content, JSON.stringify(tags), JSON.stringify(aliases), now, now] as SqlValue[]
    )
    return template
  }

  async getTemplates(projectId: string): Promise<Template[]> {
    if (!this.db) throw new Error('Database not opened')
    const result = this.db.exec('SELECT * FROM templates WHERE project_id = ? ORDER BY name', [projectId])
    if (result.length === 0 || result[0].values.length === 0) return []
    return result[0].values.map(row => ({
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

  async updateTemplate(id: string, name: string, type: EntryType, description: string, content: string, tags: string[], aliases: string[]): Promise<Template | null> {
    if (!this.db) throw new Error('Database not opened')
    const now = getNow()
    const result = this.db.exec(
      'UPDATE templates SET name = ?, type = ?, description = ?, content = ?, tags = ?, aliases = ?, updated_at = ? WHERE id = ?',
      [name, type, description, content, JSON.stringify(tags), JSON.stringify(aliases), now, id] as SqlValue[]
    )
    if (result.length === 0) return null
    return this.getTemplate(id)
  }

  async deleteTemplate(id: string): Promise<void> {
    if (!this.db) throw new Error('Database not opened')
    this.db.run('DELETE FROM templates WHERE id = ?', [id])
  }

  async exportDatabase(): Promise<Uint8Array> {
    if (!this.db) throw new Error('Database not opened')
    return this.db.export()
  }

  async importDatabase(data: Uint8Array): Promise<void> {
    const SQL = await getSqlJs()
    this.db = new SQL.Database(data)
  }
}

export async function saveProjectData(projectId: string, project: Project, dbData: Uint8Array): Promise<void> {
  localStorage.setItem(`wdworld_project_${projectId}`, JSON.stringify(project))
  localStorage.setItem(`wdworld_db_${projectId}`, btoa(String.fromCharCode(...new Uint8Array(dbData))))
}

export async function loadProjectData(projectId: string): Promise<{ project: Project; dbData: Uint8Array } | null> {
  const projectStr = localStorage.getItem(`wdworld_project_${projectId}`)
  const dbStr = localStorage.getItem(`wdworld_db_${projectId}`)

  if (!projectStr || !dbStr) return null

  const project = JSON.parse(projectStr) as Project
  const dbData = new Uint8Array(atob(dbStr).split('').map(c => c.charCodeAt(0)))

  return { project, dbData }
}