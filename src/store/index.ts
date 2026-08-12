import { create } from 'zustand'
import { saveAs } from 'file-saver'
import {
  Project,
  Entry,
  EntryType,
  Tag,
  Relation,
  Alias,
  Asset,
  Anchor,
  TimelineEvent,
  Template,
  RecentProject,
  CustomFieldSchema,
  CustomFieldValue,
  Era,
} from '@/types'
import {
  Database,
  saveProjectData,
  loadProjectData,
  saveRecentProjects as dbSaveRecentProjects,
  loadRecentProjects as dbLoadRecentProjects,
  listStoredProjects as _listStoredProjects,
  deleteStoredProject,
} from '@/lib/storage/database'
import {
  EXAMPLE_PROJECT_DESCRIPTION,
  EXAMPLE_PROJECT_NAME,
  enhanceMysteryRevivalWorld,
  seedMysteryRevivalWorld,
} from '@/lib/defaultWorld'
import { BUILTIN_ASSET_PATHS } from '@/lib/assetSources'

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
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  saveError: string | null
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
  recentProjects: RecentProject[]
  fieldSchemas: CustomFieldSchema[]
  entryFieldValues: CustomFieldValue[]
  eras: Era[]
  eraTree: Array<Era & { children: Era[] }>
  showCreateEraModal: boolean
}

interface AppActions {
  initializeDatabase: () => Promise<void>
  createProject: (name: string, description?: string) => Promise<void>
  openExampleProject: () => Promise<void>
  openProject: (projectId: string) => Promise<void>
  closeProject: () => void
  createEntry: (type: EntryType, title: string, summary?: string, content?: string) => Promise<void>
  updateEntry: (
    id: string,
    updates: Partial<Pick<Entry, 'title' | 'summary' | 'content' | 'status' | 'visibility'>>,
  ) => Promise<void>
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
  createAsset: (
    kind: string,
    filename: string,
    relativePath: string,
    mimeType: string,
    size: number,
    checksum?: string,
  ) => Promise<void>
  deleteAsset: (id: string) => Promise<void>
  setEntryCoverAsset: (entryId: string, assetId: string | null) => Promise<void>
  createRelation: (sourceEntryId: string, targetEntryId: string, type: string, note?: string) => Promise<void>
  updateRelation: (
    id: string,
    updates: Partial<Pick<Relation, 'type' | 'direction' | 'note'>>,
  ) => Promise<void>
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
  createTimelineEvent: (
    entryId: string,
    pointLabel: string,
    title: string,
    sortValue: number,
    description?: string,
  ) => Promise<void>
  deleteTimelineEvent: (id: string) => Promise<void>
  fetchTemplates: () => Promise<void>
  createTemplate: (
    name: string,
    type: EntryType,
    description: string,
    content: string,
    tags: string[],
    aliases: string[],
  ) => Promise<void>
  updateTemplate: (
    id: string,
    name: string,
    type: EntryType,
    description: string,
    content: string,
    tags: string[],
    aliases: string[],
  ) => Promise<void>
  deleteTemplate: (id: string) => Promise<void>
  loadRecentProjects: () => Promise<void>
  saveRecentProjects: () => Promise<void>
  deleteProject: (projectId: string) => Promise<void>
  fetchFieldSchemas: (entryType?: EntryType) => Promise<void>
  fetchEntryFieldValues: (entryId: string) => Promise<void>
  saveFieldValue: (entryId: string, fieldId: string, value: unknown) => Promise<void>
  createCustomField: (schema: Omit<CustomFieldSchema, 'id'> & { id?: string }) => Promise<void>
  deleteCustomField: (schemaId: string) => Promise<void>
  exportProjectJSON: () => Promise<void>
  importProjectJSON: (file: File) => Promise<void>
  getProjectBackupJSON: () => Promise<string>
  importProjectBackupJSON: (text: string) => Promise<Project>
  fetchEras: () => Promise<void>
  createEra: (
    parentId: string | null,
    name: string,
    shortName: string,
    start: number,
    end: number,
    desc?: string,
    color?: string,
  ) => Promise<void>
  updateEra: (
    id: string,
    updates: Partial<
      Pick<
        Era,
        'name' | 'shortName' | 'startSortValue' | 'endSortValue' | 'description' | 'color' | 'parentId'
      >
    >,
  ) => Promise<void>
  deleteEra: (id: string) => Promise<void>
  toggleCreateEraModal: () => void
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
  saveStatus: 'idle',
  saveError: null,
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
  recentProjects: [],
  fieldSchemas: [],
  entryFieldValues: [],
  eras: [],
  eraTree: [],
  showCreateEraModal: false,

  initializeDatabase: async () => {
    const db = new Database()
    await db.open()
    set({ database: db })
    await get().loadRecentProjects()
  },

  loadRecentProjects: async () => {
    const list = await dbLoadRecentProjects()
    if (Array.isArray(list)) {
      set({ recentProjects: list as RecentProject[] })
    }
  },

  saveRecentProjects: async () => {
    const { recentProjects } = get()
    await dbSaveRecentProjects(recentProjects)
  },

  deleteProject: async (projectId) => {
    await deleteStoredProject(projectId)
    set((state) => ({
      recentProjects: state.recentProjects.filter((p) => p.id !== projectId),
    }))
    await get().saveRecentProjects()
    if (get().currentProject?.id === projectId) {
      get().closeProject()
    }
  },

  createProject: async (name, description = '') => {
    const { database } = get()
    if (!database) {
      await get().initializeDatabase()
    }

    const db = get().database!
    const project = await db.createProject(name, description)

    const now = new Date().toISOString()
    const recentProjects = get().recentProjects
    const updatedRecent = [
      { id: project.id, name: project.name, path: project.slug, lastOpened: now },
      ...recentProjects.filter((p) => p.id !== project.id),
    ].slice(0, 20)

    set({
      recentProjects: updatedRecent,
      currentProject: project,
      lastSaveTime: null,
      saveStatus: 'idle',
      saveError: null,
      showCreateProjectModal: false,
      entries: [],
      tags: [],
      relations: [],
      selectedEntryId: null,
      entryTags: [],
      entryAliases: [],
      projectAssets: [],
      mapImageAssetId: null,
      mapEntries: [],
      entryRelations: [],
      backlinks: [],
      searchResults: [],
      fieldSchemas: [],
      entryFieldValues: [],
      eras: [],
      eraTree: [],
    })

    await get().fetchEntries()
    await get().fetchTags()
    await get().fetchRelations()
    await get().fetchFieldSchemas()
    await get().fetchEras()
    await get().saveProject()
  },

  openExampleProject: async () => {
    const existing = get().recentProjects.find((project) => project.name === EXAMPLE_PROJECT_NAME)
    if (existing && (await loadProjectData(existing.id))) {
      await get().openProject(existing.id)
      await get().fetchProjectAssets()

      const { database, currentProject, projectAssets, entries } = get()
      if (database && currentProject) {
        await enhanceMysteryRevivalWorld(database, currentProject.id)
        const coverSpecs = [
          { path: BUILTIN_ASSET_PATHS.linMo, filename: '林默.png', size: 1753962, title: '林默' },
          {
            path: BUILTIN_ASSET_PATHS.blackUmbrella,
            filename: '收容物-黑伞.png',
            size: 2243848,
            title: '收容物：黑伞',
          },
          {
            path: BUILTIN_ASSET_PATHS.seventhSchool,
            filename: '雾港第七中学.png',
            size: 1692064,
            title: '雾港第七中学',
          },
        ]

        for (const spec of coverSpecs) {
          let asset = projectAssets.find((candidate) => candidate.relativePath === spec.path)
          if (!asset) {
            asset = await database.createAsset(
              currentProject.id,
              'cover',
              spec.filename,
              spec.path,
              'image/png',
              spec.size,
            )
          }
          const entry = entries.find((candidate) => candidate.title === spec.title)
          if (entry && entry.coverAssetId !== asset.id) {
            await database.updateEntryCoverAsset(entry.id, asset.id)
          }
        }

        await Promise.all([
          get().fetchProjectAssets(),
          get().fetchEntries(),
          get().fetchTags(),
          get().fetchRelations(),
          get().fetchMapEntries(),
          get().fetchFieldSchemas(),
          get().fetchTemplates(),
          get().fetchEras(),
        ])
        await get().saveProject()
      }
      return
    }

    await get().createProject(EXAMPLE_PROJECT_NAME, EXAMPLE_PROJECT_DESCRIPTION)
    const { database, currentProject } = get()
    if (!database || !currentProject) throw new Error('示例世界初始化失败')

    const { mapAssetId } = await seedMysteryRevivalWorld(database, currentProject.id)
    set({ mapImageAssetId: mapAssetId })
    await Promise.all([
      get().fetchEntries(),
      get().fetchTags(),
      get().fetchRelations(),
      get().fetchProjectAssets(),
      get().fetchMapEntries(),
      get().fetchFieldSchemas(),
      get().fetchTemplates(),
      get().fetchEras(),
    ])
    await get().saveProject()
  },

  openProject: async (projectId) => {
    const loaded = await loadProjectData(projectId)
    if (!loaded) return

    const db = new Database()
    await db.importDatabase(loaded.dbData)

    const now = new Date().toISOString()
    const { recentProjects } = get()
    const updatedRecent = [
      { id: loaded.project.id, name: loaded.project.name, path: loaded.project.slug, lastOpened: now },
      ...recentProjects.filter((p) => p.id !== loaded.project.id),
    ].slice(0, 20)
    set({ recentProjects: updatedRecent })
    await get().saveRecentProjects()

    set({
      database: db,
      currentProject: loaded.project,
      lastSaveTime: null,
      saveStatus: 'idle',
      saveError: null,
      showOpenProjectModal: false,
      entries: [],
      tags: [],
      relations: [],
      selectedEntryId: null,
      entryTags: [],
      entryAliases: [],
      projectAssets: [],
      mapImageAssetId: null,
      mapEntries: [],
      entryRelations: [],
      backlinks: [],
      searchResults: [],
      fieldSchemas: [],
      entryFieldValues: [],
      eras: [],
      eraTree: [],
    })

    await get().fetchEntries()
    await get().fetchTags()
    await get().fetchRelations()
    await get().fetchFieldSchemas()
    await get().fetchEras()
  },

  closeProject: () => {
    const { database } = get()
    if (database) {
      database.close()
    }
    set({
      database: null,
      currentProject: null,
      lastSaveTime: null,
      saveStatus: 'idle',
      saveError: null,
      entries: [],
      tags: [],
      relations: [],
      selectedEntryId: null,
      entryTags: [],
      entryAliases: [],
      projectAssets: [],
      mapImageAssetId: null,
      mapEntries: [],
      entryRelations: [],
      backlinks: [],
      searchResults: [],
      fieldSchemas: [],
      entryFieldValues: [],
      eras: [],
      eraTree: [],
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
    const updatedEntry = await database.getEntry(id)

    if (updatedEntry) {
      set((state) => ({
        entries: state.entries.map((entry) => (entry.id === id ? updatedEntry : entry)),
        mapEntries: state.mapEntries.map((entry) => (entry.id === id ? updatedEntry : entry)),
        searchResults: [],
        backlinks: state.backlinks.map((backlink) =>
          backlink.entry.id === id ? { ...backlink, entry: updatedEntry } : backlink,
        ),
      }))
    }

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
  },

  deleteEntry: async (id) => {
    const { database } = get()
    if (!database) return

    await database.deleteEntry(id)

    set((state) => ({
      entries: state.entries.filter((entry) => entry.id !== id),
      mapEntries: state.mapEntries.filter((entry) => entry.id !== id),
      worldTimelineEvents: state.worldTimelineEvents.filter((event) => event.entryId !== id),
      entryTimelineEvents: state.entryTimelineEvents.filter((event) => event.entryId !== id),
      relations: state.relations.filter(
        (relation) => relation.sourceEntryId !== id && relation.targetEntryId !== id,
      ),
      searchResults: state.searchResults.filter((entry) => entry.id !== id),
      selectedEntryId: state.selectedEntryId === id ? null : state.selectedEntryId,
      entryTags: state.selectedEntryId === id ? [] : state.entryTags,
      entryAliases: state.selectedEntryId === id ? [] : state.entryAliases,
      entryRelations: state.entryRelations.filter(
        (relation) => relation.sourceEntryId !== id && relation.targetEntryId !== id,
      ),
      backlinks: state.backlinks.filter((backlink) => backlink.entry.id !== id),
      anchors: state.selectedEntryId === id ? [] : state.anchors,
      entryFieldValues: state.selectedEntryId === id ? [] : state.entryFieldValues,
    }))

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
  },

  selectEntry: (id) => {
    set({
      selectedEntryId: id,
      entryTags: [],
      entryAliases: [],
      entryRelations: [],
      backlinks: [],
      entryFieldValues: [],
      anchors: [],
      entryTimelineEvents: [],
    })
    if (id) {
      void get().fetchEntryTags(id)
      void get().fetchEntryAliases(id)
      void get().fetchEntryRelations(id)
      void get().fetchBacklinks(id)
      void get().fetchEntryFieldValues(id)
      void get().fetchAnchors(id)
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
    if (get().selectedEntryId === entryId) set({ entryTags: tags })
  },

  fetchEntryAliases: async (entryId) => {
    const { database } = get()
    if (!database) return

    const aliases = await database.getEntryAliases(entryId)
    if (get().selectedEntryId === entryId) set({ entryAliases: aliases })
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
    if (get().selectedEntryId === entryId) set({ entryRelations: relations })
  },

  fetchBacklinks: async (entryId) => {
    const { database } = get()
    if (!database) return

    const backlinks = await database.getBacklinks(entryId)
    if (get().selectedEntryId === entryId) set({ backlinks })
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

    await get().fetchTags()
    const selectedId = get().selectedEntryId
    if (selectedId) await get().fetchEntryTags(selectedId)

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
  },

  deleteTag: async (id) => {
    const { database } = get()
    if (!database) return

    await database.deleteTag(id)

    set((state) => ({
      tags: state.tags.filter((tag) => tag.id !== id),
      entryTags: state.entryTags.filter((tag) => tag.id !== id),
    }))

    if (get().autoSaveEnabled) {
      await get().saveProject()
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

    set((state) => ({
      projectAssets: state.projectAssets.filter((asset) => asset.id !== id),
      entries: state.entries.map((entry) =>
        entry.coverAssetId === id ? { ...entry, coverAssetId: null } : entry,
      ),
      mapEntries: state.mapEntries.map((entry) =>
        entry.coverAssetId === id ? { ...entry, coverAssetId: null } : entry,
      ),
      mapImageAssetId: state.mapImageAssetId === id ? null : state.mapImageAssetId,
    }))

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
  },

  setEntryCoverAsset: async (entryId, assetId) => {
    const { database } = get()
    if (!database) return

    await database.updateEntryCoverAsset(entryId, assetId)

    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === entryId ? { ...entry, coverAssetId: assetId } : entry,
      ),
      mapEntries: state.mapEntries.map((entry) =>
        entry.id === entryId ? { ...entry, coverAssetId: assetId } : entry,
      ),
    }))

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
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

    await get().fetchRelations()
    const selectedId = get().selectedEntryId
    if (selectedId) await get().fetchEntryRelations(selectedId)

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
  },

  updateRelation: async (id, updates) => {
    const { database } = get()
    if (!database) return

    await database.updateRelation(id, updates)

    await get().fetchRelations()
    const selectedId = get().selectedEntryId
    if (selectedId) await get().fetchEntryRelations(selectedId)

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
  },

  deleteRelation: async (id) => {
    const { database } = get()
    if (!database) return

    await database.deleteRelation(id)

    set((state) => ({
      relations: state.relations.filter((relation) => relation.id !== id),
      entryRelations: state.entryRelations.filter((relation) => relation.id !== id),
    }))

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
  },

  addBacklink: async (sourceEntryId, targetEntryId, linkText = '') => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    await database.addBacklink(currentProject.id, sourceEntryId, targetEntryId, linkText)

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
    if (get().selectedEntryId === entryId) set({ anchors })
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

    set((state) => ({
      anchors: state.anchors.filter((anchor) => anchor.id !== id),
      entries: state.entries.map((entry) => (entry.anchorId === id ? { ...entry, anchorId: null } : entry)),
      mapEntries: state.mapEntries.map((entry) =>
        entry.anchorId === id ? { ...entry, anchorId: null } : entry,
      ),
    }))

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
  },

  updateEntryMapPosition: async (entryId, x, y) => {
    const { database } = get()
    if (!database) return

    await database.updateEntryMapPosition(entryId, x, y)
    set((state) => ({
      entries: state.entries.map((entry) =>
        entry.id === entryId ? { ...entry, mapPositionX: x, mapPositionY: y } : entry,
      ),
      mapEntries: state.mapEntries.map((entry) =>
        entry.id === entryId ? { ...entry, mapPositionX: x, mapPositionY: y } : entry,
      ),
    }))

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }

    await get().fetchMapEntries()
  },

  updateEntryAnchor: async (entryId, anchorId) => {
    const { database } = get()
    if (!database) return

    await database.updateEntryAnchor(entryId, anchorId)

    set((state) => ({
      entries: state.entries.map((entry) => (entry.id === entryId ? { ...entry, anchorId } : entry)),
      mapEntries: state.mapEntries.map((entry) => (entry.id === entryId ? { ...entry, anchorId } : entry)),
    }))

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
    if (get().selectedEntryId === entryId) set({ entryTimelineEvents: events })
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
    const { database, currentProject, recentProjects } = get()
    if (!database || !currentProject) return
    set({ saveStatus: 'saving', saveError: null })
    try {
      const dbData = await database.exportDatabase()
      const result = await saveProjectData(currentProject.id, currentProject, dbData)
      if (!result.ok) throw new Error(result.error || '保存失败')

      const now = new Date().toISOString()
      const updatedRecent = recentProjects.map((p) =>
        p.id === currentProject.id
          ? { ...p, name: currentProject.name, path: currentProject.slug, lastOpened: now }
          : p,
      )
      if (!updatedRecent.some((p) => p.id === currentProject.id)) {
        updatedRecent.unshift({
          id: currentProject.id,
          name: currentProject.name,
          path: currentProject.slug,
          lastOpened: now,
        })
      }
      const trimmed = updatedRecent.slice(0, 20)
      set({ recentProjects: trimmed, lastSaveTime: now, saveStatus: 'saved', saveError: null })
      await get().saveRecentProjects()
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      console.error('Save failed:', error)
      set({ saveStatus: 'error', saveError: message })
    }
  },

  exportProjectJSON: async () => {
    const { database, currentProject } = get()
    if (!database || !currentProject) {
      alert('请先打开一个项目')
      return
    }

    try {
      const jsonStr = await database.exportProjectJSON(currentProject.id)
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' })
      const date = new Date()
      const dateStr = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`
      const fileName = `${currentProject.name}_wdworld_backup_${dateStr}.json`
      saveAs(blob, fileName)
    } catch (error) {
      console.error('Export failed:', error)
      alert(`导出失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  },

  getProjectBackupJSON: async () => {
    const { database, currentProject } = get()
    if (!database || !currentProject) throw new Error('请先打开一个项目')
    return database.exportProjectJSON(currentProject.id)
  },

  importProjectBackupJSON: async (text) => {
    let db = get().database
    if (!db) {
      await get().initializeDatabase()
      db = get().database
    }
    if (!db) throw new Error('数据库初始化失败')

    const newProject = await db.importProjectJSON(text)
    const dbData = await db.exportDatabase()
    const result = await saveProjectData(newProject.id, newProject, dbData)
    if (!result.ok) throw new Error(result.error || '导入后的项目保存失败')

    await get().openProject(newProject.id)
    return newProject
  },

  importProjectJSON: async (file: File) => {
    try {
      const text = await file.text()
      await get().importProjectBackupJSON(text)
    } catch (error) {
      console.error('Import failed:', error)
      alert(`导入失败：${error instanceof Error ? error.message : '未知错误'}`)
    }
  },

  fetchFieldSchemas: async (entryType) => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    await database.ensureBuiltinFieldSchemas(currentProject.id)
    const schemas = await database.listFieldSchemas(currentProject.id, entryType)
    set({ fieldSchemas: schemas })
  },

  fetchEntryFieldValues: async (entryId) => {
    const { database } = get()
    if (!database) return

    const values = await database.getEntryFieldValues(entryId)
    if (get().selectedEntryId === entryId) set({ entryFieldValues: values })
  },

  saveFieldValue: async (entryId, fieldId, value) => {
    const { database } = get()
    if (!database) return

    await database.upsertFieldValue(entryId, fieldId, value)

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }

    await get().fetchEntryFieldValues(entryId)
  },

  createCustomField: async (schema) => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return

    await database.createCustomFieldSchema(currentProject.id, schema)

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }

    await get().fetchFieldSchemas()
  },

  deleteCustomField: async (schemaId) => {
    const { database } = get()
    if (!database) return

    await database.deleteCustomFieldSchema(schemaId)

    set((state) => ({
      fieldSchemas: state.fieldSchemas.filter((schema) => schema.id !== schemaId),
      entryFieldValues: state.entryFieldValues.filter((value) => value.fieldId !== schemaId),
    }))

    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
  },

  fetchEras: async () => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return
    const eras = await database.listEras(currentProject.id)
    const eraTree = await database.buildEraTree(currentProject.id)
    set({ eras, eraTree })
  },

  createEra: async (parentId, name, shortName, start, end, desc = '', color = '#6366f1') => {
    const { database, currentProject } = get()
    if (!database || !currentProject) return
    await database.createEra(currentProject.id, parentId, name, shortName, start, end, desc, color)
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    await get().fetchEras()
  },

  updateEra: async (id, updates) => {
    const { database } = get()
    if (!database) return
    await database.updateEra(id, updates)
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    await get().fetchEras()
  },

  deleteEra: async (id) => {
    const { database } = get()
    if (!database) return
    await database.deleteEra(id)
    if (get().autoSaveEnabled) {
      await get().saveProject()
    }
    await get().fetchEras()
  },

  toggleCreateEraModal: () => {
    set((state) => ({ showCreateEraModal: !state.showCreateEraModal }))
  },
}))
