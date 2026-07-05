import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { Template, EntryType } from '@/types'
import { Plus, Edit3, Trash2, FileText, Users, Map, Building, Sword, Scroll, Folder, Tag, X, Check, Sparkles } from 'lucide-react'

const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  character: '人物',
  location: '地点',
  faction: '组织',
  item: '物品',
  event: '事件',
  lore: '设定',
  region: '区域',
  note: '笔记',
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

const DEFAULT_TEMPLATES: { name: string; type: EntryType; description: string; content: string; tags: string[]; aliases: string[] }[] = [
  {
    name: '人物模板',
    type: 'character',
    description: '适用于角色人物设定',
    content: `## 基本信息

- 姓名：
- 性别：
- 年龄：
- 种族：
- 职业：

## 外貌特征

## 性格特点

## 背景故事

## 能力特长

## 关系人物`,
    tags: ['人物'],
    aliases: [],
  },
  {
    name: '地点模板',
    type: 'location',
    description: '适用于地理位置设定',
    content: `## 基本信息

- 名称：
- 类型：城市/村庄/森林/山脉等
- 所属区域：

## 地理特征

## 历史背景

## 重要建筑

## 知名人物

## 相关事件`,
    tags: ['地点'],
    aliases: [],
  },
  {
    name: '组织模板',
    type: 'faction',
    description: '适用于组织势力设定',
    content: `## 基本信息

- 名称：
- 类型：国家/教派/行会/家族等
- 成立时间：
- 总部位置：

## 组织结构

## 核心成员

## 宗旨与目标

## 历史事件

## 势力范围`,
    tags: ['组织'],
    aliases: [],
  },
  {
    name: '事件模板',
    type: 'event',
    description: '适用于重要事件设定',
    content: `## 基本信息

- 名称：
- 时间：
- 地点：

## 事件概述

## 参与人物

## 事件经过

## 事件结果

## 影响与意义`,
    tags: ['事件'],
    aliases: [],
  },
]

export function TemplateManager() {
  const { templates, fetchTemplates, createTemplate, updateTemplate, deleteTemplate, createEntry } = useStore()
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
    const tags = formData.tags.split(',').map(t => t.trim()).filter(Boolean)
    const aliases = formData.aliases.split(',').map(t => t.trim()).filter(Boolean)

    if (editingTemplate) {
      await updateTemplate(editingTemplate.id, formData.name, formData.type, formData.description, formData.content, tags, aliases)
    } else {
      await createTemplate(formData.name, formData.type, formData.description, formData.content, tags, aliases)
    }
    setShowCreateModal(false)
  }

  const handleDelete = async (id: string) => {
    if (confirm('确定要删除这个模板吗？')) {
      await deleteTemplate(id)
    }
  }

  const handleApplyTemplate = async (template: Template) => {
    await createEntry(template.type, template.name, template.description, template.content)
    alert('已根据模板创建条目')
  }

  const handleCreateDefaultTemplates = async () => {
    for (const tpl of DEFAULT_TEMPLATES) {
      const exists = templates.find(t => t.name === tpl.name)
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
            模板管理
          </h2>
          <p className="text-slate-400 mt-1">创建和管理条目模板，快速生成标准化设定</p>
        </div>
        <div className="flex items-center gap-3">
          {templates.length === 0 && (
            <button
              onClick={handleCreateDefaultTemplates}
              className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg hover:bg-amber-500/30 transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              加载默认模板
            </button>
          )}
          <button
            onClick={() => handleOpenModal()}
            className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            新建模板
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <FileText className="w-16 h-16 mb-4" />
            <h3 className="text-xl font-medium mb-2">暂无模板</h3>
            <p className="text-center max-w-md mb-6">点击"新建模板"创建自定义模板，或点击"加载默认模板"导入预设模板。</p>
            <button
              onClick={handleCreateDefaultTemplates}
              className="px-6 py-3 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors flex items-center gap-2"
            >
              <Sparkles className="w-5 h-5" />
              加载默认模板
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
                      <div className={`p-2 rounded-lg bg-${template.type === 'character' ? 'blue' : template.type === 'location' ? 'green' : template.type === 'faction' ? 'purple' : 'amber'}-500/20`}>
                        <IconComponent className={`w-5 h-5 text-${template.type === 'character' ? 'blue' : template.type === 'location' ? 'green' : template.type === 'faction' ? 'purple' : 'amber'}-400`} />
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
                        title="编辑"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(template.id)}
                        className="p-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="删除"
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
                      <span key={tag} className="px-2 py-1 bg-white/5 text-slate-400 text-xs rounded-full flex items-center gap-1">
                        <Tag className="w-3 h-3" />
                        {tag}
                      </span>
                    ))}
                  </div>

                  <div className="text-xs text-slate-500 mb-4 line-clamp-3 bg-black/20 p-3 rounded-lg">
                    {template.content.slice(0, 100)}{template.content.length > 100 ? '...' : ''}
                  </div>

                  <button
                    onClick={() => handleApplyTemplate(template)}
                    className="w-full py-2 bg-purple-500/20 text-purple-400 rounded-lg hover:bg-purple-500/30 transition-colors flex items-center justify-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    使用模板创建条目
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
              <h2 className="text-xl font-bold text-white">{editingTemplate ? '编辑模板' : '新建模板'}</h2>
              <button onClick={() => setShowCreateModal(false)} className="p-2 text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">模板名称</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  placeholder="输入模板名称"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">条目类型</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as EntryType })}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                >
                  {(['character', 'location', 'faction', 'item', 'event', 'lore', 'region', 'note'] as EntryType[]).map((type) => (
                    <option key={type} value={type}>{ENTRY_TYPE_LABELS[type]}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">描述</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  placeholder="简要描述这个模板的用途"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">标签（逗号分隔）</label>
                <input
                  type="text"
                  value={formData.tags}
                  onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  placeholder="例如：人物, 角色"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">别名（逗号分隔）</label>
                <input
                  type="text"
                  value={formData.aliases}
                  onChange={(e) => setFormData({ ...formData, aliases: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none"
                  placeholder="例如：昵称, 称号"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">模板内容</label>
                <textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  className="w-full px-4 py-2 bg-slate-700 border border-white/10 rounded-lg text-white focus:border-purple-500 focus:outline-none font-mono text-sm"
                  placeholder="输入模板的 Markdown 内容"
                  rows={10}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.name}
                className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                {editingTemplate ? '保存修改' : '创建模板'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}