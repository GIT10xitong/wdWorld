import { t } from '@/lib/i18n'
import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { Template, EntryType } from '@/types'
import {
  Plus,
  Edit3,
  Trash2,
  FileText,
  Users,
  Map,
  Building,
  Sword,
  Scroll,
  Folder,
  Tag,
  X,
  Check,
  Sparkles,
} from 'lucide-react'

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  get character() {
    return t('人物')
  },
  get location() {
    return t('地点')
  },
  get faction() {
    return t('组织')
  },
  get item() {
    return t('物品')
  },
  get event() {
    return t('事件')
  },
  get lore() {
    return t('设定')
  },
  get region() {
    return t('区域')
  },
  get note() {
    return t('笔记')
  },
}

const ENTRY_TYPE_ICONS: Record<EntryType, typeof FileText> = {
  character: Users,
  location: Map,
  faction: Building,
  item: Sword,
  event: Scroll,
  lore: Folder,
  region: Map,
  note: FileText,
}

const DEFAULT_TEMPLATES: {
  name: string
  type: EntryType
  description: string
  content: string
  tags: string[]
  aliases: string[]
}[] = [
  {
    get name() {
      return t('人物模板')
    },
    type: 'character',
    get description() {
      return t('适用于角色人物设定')
    },
    get content() {
      return t(
        '## 基本信息\n\n- 姓名：\n- 性别：\n- 年龄：\n- 种族：\n- 职业：\n\n## 外貌特征\n\n## 性格特点\n\n## 背景故事\n\n## 能力特长\n\n## 关系人物',
      )
    },
    tags: [t('人物')],
    aliases: [],
  },
  {
    get name() {
      return t('地点模板')
    },
    type: 'location',
    get description() {
      return t('适用于地理位置设定')
    },
    get content() {
      return t(
        '## 基本信息\n\n- 名称：\n- 类型：城市/村庄/森林/山脉等\n- 所属区域：\n\n## 地理特征\n\n## 历史背景\n\n## 重要建筑\n\n## 知名人物\n\n## 相关事件',
      )
    },
    tags: [t('地点')],
    aliases: [],
  },
  {
    get name() {
      return t('组织模板')
    },
    type: 'faction',
    get description() {
      return t('适用于组织势力设定')
    },
    get content() {
      return t(
        '## 基本信息\n\n- 名称：\n- 类型：国家/教派/行会/家族等\n- 成立时间：\n- 总部位置：\n\n## 组织结构\n\n## 核心成员\n\n## 宗旨与目标\n\n## 历史事件\n\n## 势力范围',
      )
    },
    tags: [t('组织')],
    aliases: [],
  },
  {
    get name() {
      return t('事件模板')
    },
    type: 'event',
    get description() {
      return t('适用于重要事件设定')
    },
    get content() {
      return t(
        '## 基本信息\n\n- 名称：\n- 时间：\n- 地点：\n\n## 事件概述\n\n## 参与人物\n\n## 事件经过\n\n## 事件结果\n\n## 影响与意义',
      )
    },
    tags: [t('事件')],
    aliases: [],
  },
]

export function TemplateManager() {
  const { templates, fetchTemplates, createTemplate, updateTemplate, deleteTemplate, createEntry } =
    useStore()
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    type: 'character' as EntryType,
    description: '',
    content: '',
    tags: '',
    aliases: '',
  })

  useEffect(() => {
    fetchTemplates()
  }, [fetchTemplates])

  const handleOpenModal = (template?: Template) => {
    if (template) {
      setEditingTemplate(template)
      setFormData({
        name: template.name,
        type: template.type,
        description: template.description,
        content: template.content,
        tags: template.tags.join(', '),
        aliases: template.aliases.join(', '),
      })
    } else {
      setEditingTemplate(null)
      setFormData({
        name: '',
        type: 'character' as EntryType,
        description: '',
        content: '',
        tags: '',
        aliases: '',
      })
    }
    setShowCreateModal(true)
  }

  const handleSubmit = async () => {
    const tags = formData.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)
    const aliases = formData.aliases
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    if (editingTemplate) {
      await updateTemplate(
        editingTemplate.id,
        formData.name,
        formData.type,
        formData.description,
        formData.content,
        tags,
        aliases,
      )
    } else {
      await createTemplate(
        formData.name,
        formData.type,
        formData.description,
        formData.content,
        tags,
        aliases,
      )
    }
    setShowCreateModal(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm(t('确定要删除这个模板吗？'))) {
      await deleteTemplate(id)
    }
  }

  const handleApplyTemplate = async (template: Template) => {
    await createEntry(template.type, template.name, template.description, template.content)
    alert(t('已根据模板创建条目'))
  }

  const handleCreateDefaultTemplates = async () => {
    for (const tpl of DEFAULT_TEMPLATES) {
      const exists = templates.find((t) => t.name === tpl.name)
      if (!exists) {
        await createTemplate(tpl.name, tpl.type, tpl.description, tpl.content, tpl.tags, tpl.aliases)
      }
    }
    await fetchTemplates()
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="flex items-center justify-between p-6 border-b border-white/10">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-amber-400" />
            {t('模板管理')}
          </h2>
          <p className="text-slate-400 mt-1">{t('创建和管理条目模板，快速生成标准化设定')}</p>
        </div>
        <div className="flex items-center gap-3">
          {templates.length === 0 && (
            <button
              onClick={handleCreateDefaultTemplates}
              className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              {t('加载默认模板')}
            </button>
          )}
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            {t('新建模板')}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <FileText className="w-16 h-16 mb-4" />
            <h3 className="text-xl font-medium mb-2">{t('暂无模板')}</h3>
            <p className="text-center max-w-md mb-6">
              {t('点击"新建模板"创建自定义模板，或点击"加载默认模板"导入预设模板。')}
            </p>
            <button
              onClick={handleCreateDefaultTemplates}
              className="px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              {t('加载默认模板')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templates.map((template) => {
              const IconComponent = ENTRY_TYPE_ICONS[template.type]
              return (
                <div
                  key={template.id}
                  className="bg-slate-800/50 rounded-xl border border-white/10 p-5 hover:border-purple-500/50 transition-all hover:shadow-lg hover:shadow-purple-500/10"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg bg-${template.type === 'character' ? 'blue' : template.type === 'location' ? 'green' : template.type === 'faction' ? 'purple' : 'amber'}-500/20`}
                      >
                        <IconComponent
                          className={`w-5 h-5 text-${template.type === 'character' ? 'blue' : template.type === 'location' ? 'green' : template.type === 'faction' ? 'purple' : 'amber'}-400`}
                        />
                      </div>
                      <div>
                        <h3 className="font-semibold text-white">{template.name}</h3>
                        <span className="text-xs text-slate-400">{ENTRY_TYPE_LABELS[template.type]}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleOpenModal(template)}
                        className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title={t('编辑')}
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title={t('删除')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {template.description && (
                    <p className="text-slate-400 text-sm mb-4 line-clamp-2">{template.description}</p>
                  )}

                  <div className="flex flex-wrap gap-2 mb-4">
                    {template.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-white/5 text-slate-400 text-xs rounded-full flex items-center gap-1"
                      >
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="text-xs text-slate-500 mb-4 line-clamp-3 bg-black/20 p-3 rounded-lg">
                    {template.content.slice(0, 100)}
                    {template.content.length > 100 ? '...' : ''}
                  </div>

                  <button
                    onClick={() => handleApplyTemplate(template)}
                    className="w-full py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {t('使用模板创建条目')}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl bg-slate-800 rounded-xl border border-white/10 shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">
                {editingTemplate ? t('编辑模板') : t('新建模板')}
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t('模板名称')}</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  placeholder={t('输入模板名称')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t('条目类型')}</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as EntryType })}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                >
                  {(
                    [
                      'character',
                      'location',
                      'faction',
                      'item',
                      'event',
                      'lore',
                      'region',
                      'note',
                    ] as EntryType[]
                  ).map((type) => (
                    <option key={type} value={type}>
                      {ENTRY_TYPE_LABELS[type]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t('描述')}</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  placeholder={t('简要描述这个模板的用途')}
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('标签（逗号分隔）')}
                </label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  placeholder={t('例如：人物, 角色')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  {t('别名（逗号分隔）')}
                </label>
                <input
                  type="text"
                  value={formData.aliases}
                  onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  placeholder={t('例如：昵称, 称号')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">{t('模板内容')}</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none font-mono text-sm"
                  placeholder={t('输入模板的 Markdown 内容')}
                  rows={10}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                {t('取消')}
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {editingTemplate ? t('保存修改') : t('创建模板')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
