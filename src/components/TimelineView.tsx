import { useState, useEffect } from 'react'
import { useStore } from '@/store'
import { TimelineEvent, EntryType } from '@/types'
import { Clock, Plus, Calendar, Trash2 } from 'lucide-react'

export function TimelineView() {
  const {
    entries,
    entryTimelineEvents,
    worldTimelineEvents,
    selectedEntryId,
    selectEntry,
    fetchTimelineEvents,
    fetchWorldTimelineEvents,
    createTimelineEvent,
    deleteTimelineEvent,
  } = useStore()

  const [mode, setMode] = useState<'entry' | 'world'>('world')
  const [showAddEventModal, setShowAddEventModal] = useState(false)
  const [newEventPointLabel, setNewEventPointLabel] = useState('')
  const [newEventTitle, setNewEventTitle] = useState('')
  const [newEventSortValue, setNewEventSortValue] = useState(0)
  const [newEventDescription, setNewEventDescription] = useState('')

  useEffect(() => {
    if (selectedEntryId) {
      fetchTimelineEvents(selectedEntryId)
    }
    fetchWorldTimelineEvents()
  }, [selectedEntryId])

  const selectedEntry = entries.find((e) => e.id === selectedEntryId)

  const events = mode === 'entry' ? entryTimelineEvents : worldTimelineEvents

  const getEntryTypeColor = (type: EntryType): string => {
    const colors: Record<EntryType, string> = {
      character: 'bg-blue-500',
      location: 'bg-green-500',
      faction: 'bg-purple-500',
      item: 'bg-yellow-500',
      event: 'bg-red-500',
      lore: 'bg-cyan-500',
      region: 'bg-orange-500',
      note: 'bg-gray-500',
    }
    return colors[type]
  }

  const getEventColor = (sortValue: number): string => {
    if (sortValue < 100) return 'bg-blue-500'
    if (sortValue < 200) return 'bg-green-500'
    if (sortValue < 300) return 'bg-yellow-500'
    if (sortValue < 400) return 'bg-orange-500'
    return 'bg-red-500'
  }

  const handleAddEvent = () => {
    if (!newEventTitle) return

    const targetEntryId = mode === 'entry' && selectedEntryId ? selectedEntryId : entries[0]?.id
    if (!targetEntryId) {
      alert('请先创建至少一个条目')
      return
    }

    createTimelineEvent(targetEntryId, newEventPointLabel, newEventTitle, newEventSortValue, newEventDescription)
    setShowAddEventModal(false)
    setNewEventPointLabel('')
    setNewEventTitle('')
    setNewEventSortValue(0)
    setNewEventDescription('')
  }

  const groupedEvents = events.reduce((acc, event) => {
    const entry = entries.find((e) => e.id === event.entryId)
    const groupKey = event.pointLabel || '未分组'
    if (!acc[groupKey]) {
      acc[groupKey] = []
    }
    acc[groupKey].push({ ...event, entry })
    return acc
  }, {} as Record<string, (TimelineEvent & { entry?: typeof entries[0] })[]>)

  const sortedGroups = Object.entries(groupedEvents).sort((a, b) => {
    const aMin = Math.min(...a[1].map((e) => e.sortValue))
    const bMin = Math.min(...b[1].map((e) => e.sortValue))
    return aMin - bMin
  })

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">时间轴</h2>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-white/10 rounded-lg p-1">
            <button
              onClick={() => setMode('world')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                mode === 'world' ? 'bg-purple-500 text-white' : 'text-slate-300 hover:text-white'
              }`}
            >
              世界时间轴
            </button>
            <button
              onClick={() => setMode('entry')}
              disabled={!selectedEntryId}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                mode === 'entry'
                  ? 'bg-purple-500 text-white'
                  : selectedEntryId
                  ? 'text-slate-300 hover:text-white'
                  : 'text-slate-500 cursor-not-allowed'
              }`}
            >
              {selectedEntry ? `${selectedEntry.title}` : '条目时间轴'}
            </button>
          </div>
          <button
            onClick={() => setShowAddEventModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500 text-white hover:bg-purple-600 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加事件
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-500">
            <Calendar className="w-16 h-16 mb-4 opacity-50" />
            <p>{mode === 'entry' ? '该条目暂无时间轴事件' : '暂无世界时间轴事件'}</p>
            <p className="text-sm mt-2">点击上方"添加事件"创建</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-white/10" />

            {sortedGroups.map(([groupLabel, groupEvents]) => (
              <div key={groupLabel} className="mb-8">
                {groupLabel !== '未分组' && (
                  <div className="flex items-center gap-4 mb-4">
                    <div className="w-16 h-10 flex items-center justify-center">
                      <span className="text-xs font-medium text-slate-400">{groupLabel}</span>
                    </div>
                    <h3 className="text-sm font-medium text-slate-300">{groupLabel}</h3>
                  </div>
                )}

                {groupEvents.map((event) => (
                  <div key={event.id} className="relative flex gap-4 mb-4">
                    <div className="relative w-16 flex-shrink-0">
                      <div
                        className={`absolute left-6 top-2 w-4 h-4 rounded-full border-2 border-slate-900 shadow-lg ${getEventColor(event.sortValue)}`}
                      />
                    </div>

                    <div className="flex-1 bg-slate-800/50 rounded-xl border border-white/10 p-4 hover:border-white/20 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700 text-slate-400">
                              {event.sortValue}
                            </span>
                            {event.entry && (
                              <span
                                className="text-xs px-2 py-0.5 rounded-full cursor-pointer hover:bg-white/10 transition-colors"
                                onClick={() => selectEntry(event.entry!.id)}
                              >
                                <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1 ${getEntryTypeColor(event.entry!.type)}`} />
                                {event.entry.title}
                              </span>
                            )}
                          </div>
                          <h4 className="text-white font-medium">{event.title}</h4>
                          {event.description && (
                            <p className="text-sm text-slate-400 mt-2">{event.description}</p>
                          )}
                        </div>
                        <button
                          onClick={() => deleteTimelineEvent(event.id)}
                          className="p-1.5 rounded-lg hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddEventModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-800 rounded-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">添加时间轴事件</h2>
              <button
                onClick={() => setShowAddEventModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <span className="text-slate-400">×</span>
              </button>
            </div>
            <div className="p-6 space-y-4">
              {mode === 'world' && (
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">关联条目</label>
                  <select
                    value={entries[0]?.id}
                    className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white focus:outline-none focus:border-purple-500/50 transition-colors"
                  >
                    {entries.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.title} ({entry.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">时间点标签</label>
                <input
                  type="text"
                  value={newEventPointLabel}
                  onChange={(e) => setNewEventPointLabel(e.target.value)}
                  placeholder="例如：故事开端、第一章"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">事件标题 *</label>
                <input
                  type="text"
                  value={newEventTitle}
                  onChange={(e) => setNewEventTitle(e.target.value)}
                  placeholder="事件名称"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">排序值</label>
                <input
                  type="number"
                  value={newEventSortValue}
                  onChange={(e) => setNewEventSortValue(Number(e.target.value))}
                  placeholder="用于时间排序，越小越靠前"
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">描述</label>
                <textarea
                  value={newEventDescription}
                  onChange={(e) => setNewEventDescription(e.target.value)}
                  placeholder="事件详情描述..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-purple-500/50 transition-colors resize-none"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddEventModal(false)}
                  className="flex-1 px-4 py-3 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
                >
                  取消
                </button>
                <button
                  onClick={handleAddEvent}
                  disabled={!newEventTitle}
                  className="flex-1 px-4 py-3 rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  添加事件
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}