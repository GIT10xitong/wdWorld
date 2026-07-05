import { create } from 'zustand'
import { Project, Entry, EntryType, Tag, Relation, Alias, Asset, Anchor, TimelineEvent, Template } from '@/types'
import { Database, saveProjectData, loadProjectData } from '@/lib/storage/database'

interface AppState {
  database: Database | null
  currentProject: Project | null
  entries: Entry[]
  tags: Tag[]
  relations: Relation[]
  searchQuery: string
  selectedEntryId: string | null
  showCreateProjectModal: boolean
  showOpenProjectModal: boolean
  showCreateEntryModal: boolean
  autoSaveEnabled: boolean
  lastSaveTime: string | null
  entryTags: Tag[]
  entryAliases: Alias[]
  projectAssets: Asset[]
  entryRelations: Relation[]
  backlinks: { entry: Entry; linkText: string }[]
  searchResults: Entry[]
  anchors: Anchor[]
  entryTimelineEvents: TimelineEvent[]
  worldTimelineEvents: TimelineEvent[]
  mapImageAssetId: string | null
  mapEntries: Entry[]
  templates: Template[]
}

interface AppActions {
  initializeDatabase: () => Promise<void>
  createProject: (name: string, description?: string) => Promise<void>
  openProject: (projectId: string) => Promise<void>
  closeProject: () => void
  createEntry: (type: EntryType, title: string, summary?: string, content?: string) => Promise<void>
  updateEntry: (id: string, updates: Partial<Pick<Entry, 'title' | 'summary' | 'content' | 'status' | 'visibility'>>) => Promise<void>
  deleteEntry: (id: string) => Promise<void>
  selectEntry: (id: string | null) => void
  setSearchQuery: (query: string) => void
  toggleCreateProjectModal: () => void
  toggleOpenProjectModal: () => void
  toggleCreateEntryModal: () => void
  fetchEntries: () => Promise<void>
  fetchTags: () => Promise<void>
  fetchRelations: () => Promise<void>
  fetchEntryTags: (entryId: string) => Promise<void>
  fetchEntryAliases: (entryId: string) => Promise<void>
  fetchProjectAssets: () => Promise<void>
  fetchEntryRelations: (entryId: string) => Promise<void>
  fetchBacklinks: (entryId: string) => Promise<void>
  createTag: (name: string, color?: string) => Promise<void>
  updateTag: (id: string, name: string, color?: string) => Promise<void>
  deleteTag: (id: string) => Promise<void>
  addTagToEntry: (entryId: string, tagId: string) => Promise<void>
  removeTagFromEntry: (entryId: string, tagId: string) => Promise<void>
  createAlias: (entryId: string, value: string) => Promise<void>
  deleteAlias: (id: string) => Promise<void>
  createAsset: (kind: string, filename: string, relativePath: string, mimeType: string, size: number, checksum?: string) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  setEntryCoverAsset: (entryId: string, assetId: string | null) => Promise<void>
  createRelation: (sourceEntryId: string, targetEntryId: string, type: string, note?: string) => Promise<void>
  updateRelation: (id: string, updates: Partial<Pick<Relation, 'type' | 'direction' | 'note'>>) => Promise<void>
  deleteRelation: (id: string) => Promise<void>
  addBacklink: (sourceEntryId: string, targetEntryId: string, linkText?: string) => Promise<void>
  fullTextSearch: (query: string) => Promise<void>
  searchByTag: (tagId: string) => Promise<Entry[]>
  saveProject: () => Promise<void>
  fetchAnchors: (entryId: string) => Promise<void>
  createAnchor: (entryId: string, label: string, x: number, y: number, notes?: string) => Promise<void>
  deleteAnchor: (id: string) => Promise<void>
  updateEntryMapPosition: (entryId: string, x: number | null, y: number | null) => Promise<void>
  updateEntryAnchor: (entryId: string, anchorId: string | null) => Promise<void>
  fetchMapEntries: () => Promise<void>
  setMapImageAssetId: (assetId: string | null) => void
  fetchTimelineEvents: (entryId: string) => Promise<void>
  fetchWorldTimelineEvents: () => Promise<void>
  createTimelineEvent: (entryId: string, pointLabel: string, title: string, sortValue: number, description?: string) => Promise<void>
  deleteTimelineEvent: (id: string) => Promise<void>
  fetchTemplates: () => Promise<void>
  createTemplate: (name: string, type: EntryType, description: string, content: string, tags: string[], aliases: string[]) => Promise<void>
  updateTemplate: (id: string, name: string, type: EntryType, description: string, content: string, tags: string[], aliases: string[]) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
}

export const useStore = create<AppState & AppActions>((set, get) => ({
  database: null,
  currentProject: null,
  entries: [],
  tags: [],
  relations: [],
  searchQuery: '',
  selectedEntryId: null,
  showCreateProjectModal: false,
  showOpenProjectModal: false,
  showCreateEntryModal: false,
  autoSaveEnabled: true,
  lastSaveTime: null,
  entryTags: [],
  entryAliases: [],
  projectAssets: [],
  entryRelations: [],
  backlinks: [],
  searchResults: [],
  anchors: [],
  entryTimelineEvents: [],
  worldTimelineEvents: [],
  mapImageAssetId: null,
  mapEntries: [],
  templates: [],

  initializeDatabase: async () => {
    const db = new Database()
    await db.open()
    set({ database: db })
  },

  createProject: async (name, description = '') => {
    const { database } = get()
    if (!database) {
      await get().initializeDatabase()
    }
    
    const db = get().database!
    const project = await db.createProject(name, description)
    await get().saveProject()
    
    set({
      currentProject: project,
      showCreateProjectModal: false,
      entries: [],
      tags: [],
      relations: [],
      selectedEntryId: null,
      entryTags: [],
      entryAliases: [],
      projectAssets: [],
      entryRelations: [],
      backlinks: [],
      searchResults: [],
    })
    
    await get().fetchEntries()
    await get().fetchTags()
    await get().fetchRelations()
  },

  openProject: async (projectId) => {
    const loaded = await loadProjectData(projectId)
    if (!loaded) return

    const db = new Database()
    await db.importDatabase(loaded.dbData)
    
    set({
      database: db,
      currentProject: loaded.project,
      showOpenProjectModal: false,
      entries: [],
      tags: [],
      relations: [],
      selectedEntryId: null,
      entryTags: [],
      entryAliases: [],
      projectAssets: [],
      entryRelations: [],
      backlinks: [],
      searchResults: [],
    })
    
    await get().fetchEntries()
    await get().fetchTags()
    await get().fetchRelations()
  },

  closeProject: () => {
    const { database } = get()
    if (database) {
      database.close()
    }
    set({
      database: null,
      currentProject: null,
      entries: [],
      tags: [],
      relations: [],
      selectedEntryId: null,
      entryTags: [],
      entryAliases: [],
      projectAssets: [],
      entryRelations: [],
      backlinks: [],
      searchResults: [],
    })
  },

  createEntry: async (type, title, summary = '', content = '') => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    const entry = await database.createEntry(currentProject.id, type, title, summary, content)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    set((state) => ({
      entries: [entry, ...state.entries],
      showCreateEntryModal: false,
    }))
  },

  updateEntry: async (id, updates) => {
    const { database } = get()
    if (!database) return

    await database.updateEntry(id, updates)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === id ? { ...entry, ...updates, updatedAt: new Date().toISOString() } : entry
      ),
    }))
  },

  deleteEntry: async (id) => {
    const { database } = get()
    if (!database) return

    await database.deleteEntry(id)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    set((state) => ({
      entries: state.entries.filter((entry) => entry.id !== id),
      selectedEntryId: state.selectedEntryId === id ? null : state.selectedEntryId,
      entryTags: [],
      entryAliases: [],
      entryRelations: [],
      backlinks: [],
    }))
  },

  selectEntry: (id) => {
    set({ selectedEntryId: id })
    if (id) {
      get().fetchEntryTags(id)
      get().fetchEntryAliases(id)
      get().fetchEntryRelations(id)
      get().fetchBacklinks(id)
    } else {
      set({ entryTags: [], entryAliases: [] })
    }
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query })
  },

  toggleCreateProjectModal: () => {
    set((state) => ({ showCreateProjectModal: !state.showCreateProjectModal }))
  },

  toggleOpenProjectModal: () => {
    set((state) => ({ showOpenProjectModal: !state.showOpenProjectModal }))
  },

  toggleCreateEntryModal: () => {
    set((state) => ({ showCreateEntryModal: !state.showCreateEntryModal }))
  },

  fetchEntries: async () => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    const entries = await database.listEntries(currentProject.id)
    set({ entries })
  },

  fetchTags: async () => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    const tags = await database.getTags(currentProject.id)
    set({ tags })
  },

  fetchRelations: async () => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    const relations = await database.getRelations(currentProject.id)
    set({ relations })
  },

  fetchEntryTags: async (entryId) => {
    const { database } = get()
    if (!database) return

    const tags = await database.getEntryTags(entryId)
    set({ entryTags: tags })
  },

  fetchEntryAliases: async (entryId) => {
    const { database } = get()
    if (!database) return

    const aliases = await database.getEntryAliases(entryId)
    set({ entryAliases: aliases })
  },

  fetchProjectAssets: async () => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    const assets = await database.getAssets(currentProject.id)
    set({ projectAssets: assets })
  },

  fetchEntryRelations: async (entryId) => {
    const { database } = get()
    if (!database) return

    const relations = await database.getEntryRelations(entryId)
    set({ entryRelations: relations })
  },

  fetchBacklinks: async (entryId) => {
    const { database } = get()
    if (!database) return

    const backlinks = await database.getBacklinks(entryId)
    set({ backlinks })
  },

  createTag: async (name, color) => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    await database.createTag(currentProject.id, name, color)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchTags()
  },

  updateTag: async (id, name, color) => {
    const { database } = get()
    if (!database) return

    await database.updateTag(id, name, color)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchTags()
  },

  deleteTag: async (id) => {
    const { database } = get()
    if (!database) return

    await database.deleteTag(id)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchTags()
    const selectedId = get().selectedEntryId
    if (selectedId) {
      await get().fetchEntryTags(selectedId)
    }
  },

  addTagToEntry: async (entryId, tagId) => {
    const { database } = get()
    if (!database) return

    await database.addTagToEntry(entryId, tagId)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchEntryTags(entryId)
  },

  removeTagFromEntry: async (entryId, tagId) => {
    const { database } = get()
    if (!database) return

    await database.removeTagFromEntry(entryId, tagId)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchEntryTags(entryId)
  },

  createAlias: async (entryId, value) => {
    const { database } = get()
    if (!database) return

    await database.createAlias(entryId, value)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchEntryAliases(entryId)
  },

  deleteAlias: async (id) => {
    const { database } = get()
    if (!database) return

    await database.deleteAlias(id)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    const selectedId2 = get().selectedEntryId
    if (selectedId2) {
      await get().fetchEntryAliases(selectedId2)
    }
  },

  createAsset: async (kind, filename, relativePath, mimeType, size, checksum) => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    await database.createAsset(currentProject.id, kind, filename, relativePath, mimeType, size, checksum)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchProjectAssets()
  },

  deleteAsset: async (id) => {
    const { database } = get()
    if (!database) return

    await database.deleteAsset(id)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchProjectAssets()
  },

  setEntryCoverAsset: async (entryId, assetId) => {
    const { database } = get()
    if (!database) return

    await database.updateEntryCoverAsset(entryId, assetId)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchEntries()
  },

  searchByTag: async (tagId) => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return []

    return await database.searchByTag(currentProject.id, tagId)
  },

  createRelation: async (sourceEntryId, targetEntryId, type, note = '') => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    await database.createRelation(currentProject.id, sourceEntryId, targetEntryId, type, note)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchRelations()
    await get().fetchEntryRelations(sourceEntryId)
    await get().fetchEntryRelations(targetEntryId)
  },

  updateRelation: async (id, updates) => {
    const { database } = get()
    if (!database) return

    await database.updateRelation(id, updates)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    const selectedId = get().selectedEntryId
    if (selectedId) {
      await get().fetchEntryRelations(selectedId)
    }
  },

  deleteRelation: async (id) => {
    const { database } = get()
    if (!database) return

    await database.deleteRelation(id)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    const selectedId = get().selectedEntryId
    if (selectedId) {
      await get().fetchEntryRelations(selectedId)
    }
  },

  addBacklink: async (sourceEntryId, targetEntryId, linkText = '') => {
    const { database } = get()
    if (!database) return

    await database.addBacklink(sourceEntryId, targetEntryId, linkText)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchBacklinks(targetEntryId)
  },

  fullTextSearch: async (query) => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    const results = await database.fullTextSearch(currentProject.id, query)
    set({ searchResults: results })
  },

  fetchAnchors: async (entryId) => {
    const { database } = get()
    if (!database) return

    const anchors = await database.getAnchors(entryId)
    set({ anchors })
  },

  createAnchor: async (entryId, label, x, y, notes = '') => {
    const { database } = get()
    if (!database) return

    await database.createAnchor(entryId, label, x, y, notes)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchAnchors(entryId)
  },

  deleteAnchor: async (id) => {
    const { database } = get()
    if (!database) return

    await database.deleteAnchor(id)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    const selectedId = get().selectedEntryId
    if (selectedId) {
      await get().fetchAnchors(selectedId)
    }
  },

  updateEntryMapPosition: async (entryId, x, y) => {
    const { database } = get()
    if (!database) return

    await database.updateEntryMapPosition(entryId, x, y)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchMapEntries()
  },

  updateEntryAnchor: async (entryId, anchorId) => {
    const { database } = get()
    if (!database) return

    await database.updateEntryAnchor(entryId, anchorId)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
  },

  fetchMapEntries: async () => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    const entries = await database.getEntriesWithMapPosition(currentProject.id)
    set({ mapEntries: entries })
  },

  setMapImageAssetId: (assetId) => {
    set({ mapImageAssetId: assetId })
  },

  fetchTimelineEvents: async (entryId) => {
    const { database } = get()
    if (!database) return

    const events = await database.getTimelineEvents(entryId)
    set({ entryTimelineEvents: events })
  },

  fetchWorldTimelineEvents: async () => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    const events = await database.getAllTimelineEvents(currentProject.id)
    set({ worldTimelineEvents: events })
  },

  createTimelineEvent: async (entryId, pointLabel, title, sortValue, description = '') => {
    const { database } = get()
    if (!database) return

    await database.createTimelineEvent(entryId, pointLabel, title, sortValue, description)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchTimelineEvents(entryId)
    await get().fetchWorldTimelineEvents()
  },

  deleteTimelineEvent: async (id) => {
    const { database } = get()
    if (!database) return

    await database.deleteTimelineEvent(id)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    const selectedId = get().selectedEntryId
    if (selectedId) {
      await get().fetchTimelineEvents(selectedId)
    }
    await get().fetchWorldTimelineEvents()
  },

  fetchTemplates: async () => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    const templates = await database.getTemplates(currentProject.id)
    set({ templates })
  },

  createTemplate: async (name, type, description, content, tags, aliases) => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    await database.createTemplate(currentProject.id, name, type, description, content, tags, aliases)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchTemplates()
  },

  updateTemplate: async (id, name, type, description, content, tags, aliases) => {
    const { database } = get()
    if (!database) return

    await database.updateTemplate(id, name, type, description, content, tags, aliases)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchTemplates()
  },

  deleteTemplate: async (id) => {
    const { database } = get()
    if (!database) return

    await database.deleteTemplate(id)
    
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    
    await get().fetchTemplates()
  },

  saveProject: async () => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    const dbData = await database.exportDatabase()
    await saveProjectData(currentProject.id, currentProject, dbData)
    
    set({ lastSaveTime: new Date().toISOString() })
  },
}))