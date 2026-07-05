import { useState, useEffect, useRef, useCallback } from 'react'
import { useStore } from '@/store'
import { EntryType } from '@/types'
import { GitBranch, ZoomIn, ZoomOut, Crosshair, MousePointer } from 'lucide-react'

const ENTRY_TYPE_COLORS: Record<EntryType, string> = {
  character: '#3b82f6',
  location: '#22c55e',
  faction: '#a855f7',
  item: '#eab308',
  event: '#ef4444',
  lore: '#06b6d4',
  region: '#f97316',
  note: '#6b7280',
}

export function GraphView() {
  const { entries, relations, selectedEntryId, selectEntry, fetchEntries, fetchRelations } = useStore()

  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({})
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchEntries()
    fetchRelations()
  }, [])

  useEffect(() => {
    const positions: Record<string, { x: number; y: number }> = {}
    const width = 800
    const height = 600
    const padding = 100

    const centerX = width / 2 + padding
    const centerY = height / 2 + padding

    if (selectedEntryId) {
      positions[selectedEntryId] = { x: centerX, y: centerY }

      const relatedRelations = relations.filter(
        (r) => r.sourceEntryId === selectedEntryId || r.targetEntryId === selectedEntryId
      )

      const angleStep = (2 * Math.PI) / Math.max(relatedRelations.length, 1)
      relatedRelations.forEach((relation, index) => {
        const targetId = relation.sourceEntryId === selectedEntryId ? relation.targetEntryId : relation.sourceEntryId
        const angle = index * angleStep - Math.PI / 2
        const radius = 200
        positions[targetId] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        }
      })

      const secondLevelIds = new Set<string>()
      relatedRelations.forEach((relation) => {
        const targetId = relation.sourceEntryId === selectedEntryId ? relation.targetEntryId : relation.sourceEntryId
        relations.forEach((r) => {
          if (r.sourceEntryId === targetId && r.targetEntryId !== selectedEntryId) {
            secondLevelIds.add(r.targetEntryId)
          }
          if (r.targetEntryId === targetId && r.sourceEntryId !== selectedEntryId) {
            secondLevelIds.add(r.sourceEntryId)
          }
        })
      })

      let secondIndex = 0
      secondLevelIds.forEach((id) => {
        if (!positions[id]) {
          const angle = secondIndex * angleStep * 0.5 + Math.PI / 4
          const radius = 350
          positions[id] = {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
          }
          secondIndex++
        }
      })
    } else {
      entries.forEach((entry, index) => {
        const angle = (index / entries.length) * 2 * Math.PI - Math.PI / 2
        const radius = Math.min(width, height) / 3
        positions[entry.id] = {
          x: centerX + Math.cos(angle) * radius,
          y: centerY + Math.sin(angle) * radius,
        }
      })
    }

    setNodePositions(positions)
  }, [entries, relations, selectedEntryId])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
    }
  }, [offset])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isDragging) {
      setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((prev) => Math.max(0.3, Math.min(3, prev + delta)))
  }, [])

  const handleNodeClick = useCallback((entryId: string) => {
    selectEntry(entryId)
    setSelectedNodes((prev) => (prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId]))
  }, [selectEntry])

  const visibleRelations = relations.filter((r) => {
    if (!selectedEntryId) return true
    return r.sourceEntryId === selectedEntryId || r.targetEntryId === selectedEntryId
  })

  const visibleEntries = entries.filter((entry) => {
    if (!selectedEntryId) return true
    if (entry.id === selectedEntryId) return true
    return relations.some(
      (r) =>
        (r.sourceEntryId === entry.id && r.targetEntryId === selectedEntryId) ||
        (r.targetEntryId === entry.id && r.sourceEntryId === selectedEntryId)
    )
  })

  const getRelationTypeColor = (type: string): string => {
    const colors: Record<string, string> = {
      隶属: '#a855f7',
      对抗: '#ef4444',
      合作: '#22c55e',
      亲属: '#f97316',
      师徒: '#06b6d4',
      朋友: '#3b82f6',
      敌人: '#dc2626',
      同事: '#8b5cf6',
      创造者: '#10b981',
      使用者: '#f59e0b',
      位于: '#14b8a6',
      拥有: '#6366f1',
      参与: '#ec4899',
      导致: '#84cc16',
      相关: '#6b7280',
      member_of: '#a855f7',
      leader_of: '#f59e0b',
      located_in: '#22c55e',
      part_of: '#3b82f6',
      allied_with: '#10b981',
      enemy_of: '#ef4444',
      parent_of: '#f97316',
      child_of: '#f97316',
      owns: '#6366f1',
      created: '#06b6d4',
      discovered: '#14b8a6',
      participated_in: '#ec4899',
      caused: '#84cc16',
      mentions: '#6b7280',
    }
    return colors[type] || '#6b7280'
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">关系图谱</h2>
          <span className="text-xs text-slate-500">
            {visibleEntries.length} 个节点 · {visibleRelations.length} 条关系
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setScale((prev) => Math.min(3, prev + 0.2))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScale((prev) => Math.max(0.3, prev - 0.2))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setScale(1)
              setOffset({ x: 0, y: 0 })
            }}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            title="重置视图"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="w-56 border-r border-white/10 p-4 overflow-y-auto">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2">图例</h3>
            <div className="space-y-2">
              {Object.entries(ENTRY_TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs text-slate-400">{ENTRY_TYPE_LABELS[type as EntryType]}</span>
                </div>
              ))}
            </div>
          </div>

          {selectedEntryId && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">相关关系</h3>
              <div className="space-y-2">
                {visibleRelations.map((relation) => {
                  const targetEntry = entries.find(
                    (e) => e.id === (relation.sourceEntryId === selectedEntryId ? relation.targetEntryId : relation.sourceEntryId)
                  )
                  return (
                    <div
                      key={relation.id}
                      onClick={() => targetEntry && handleNodeClick(targetEntry.id)}
                      className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
                    >
                      <span className="text-sm text-white">{targetEntry?.title}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `${getRelationTypeColor(relation.type)}20`, color: getRelationTypeColor(relation.type) }}
                      >
                        {relation.type}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div
          ref={containerRef}
          className="flex-1 relative overflow-hidden"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        >
          <svg
            className="w-full h-full"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'center center',
            }}
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
              </marker>
            </defs>

            {visibleRelations.map((relation) => {
              const sourcePos = nodePositions[relation.sourceEntryId]
              const targetPos = nodePositions[relation.targetEntryId]
              if (!sourcePos || !targetPos) return null

              const isSelected = selectedNodes.includes(relation.sourceEntryId) || selectedNodes.includes(relation.targetEntryId)
              const isHighlighted = relation.sourceEntryId === selectedEntryId || relation.targetEntryId === selectedEntryId

              return (
                <g key={relation.id}>
                  <line
                    x1={sourcePos.x}
                    y1={sourcePos.y}
                    x2={targetPos.x}
                    y2={targetPos.y}
                    stroke={isHighlighted ? getRelationTypeColor(relation.type) : '#374151'}
                    strokeWidth={isHighlighted || isSelected ? 2 : 1}
                    markerEnd="url(#arrowhead)"
                    opacity={isHighlighted || isSelected ? 1 : 0.5}
                  />
                  {(isHighlighted || hoveredNode === relation.sourceEntryId || hoveredNode === relation.targetEntryId) && (
                    <text
                      x={(sourcePos.x + targetPos.x) / 2}
                      y={(sourcePos.y + targetPos.y) / 2 - 10}
                      className="text-xs fill-slate-400"
                      textAnchor="middle"
                      style={{
                        backgroundColor: '#1f2937',
                        padding: '2px 6px',
                        borderRadius: '4px',
                      }}
                    >
                      {relation.type}
                    </text>
                  )}
                </g>
              )
            })}

            {visibleEntries.map((entry) => {
              const pos = nodePositions[entry.id]
              if (!pos) return null

              const isSelected = selectedNodes.includes(entry.id)
              const isCenter = entry.id === selectedEntryId
              const color = ENTRY_TYPE_COLORS[entry.type]

              return (
                <g
                  key={entry.id}
                  onClick={() => handleNodeClick(entry.id)}
                  onMouseEnter={() => setHoveredNode(entry.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer"
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isCenter ? 28 : isSelected ? 24 : 20}
                    fill={color}
                    opacity={isSelected || isCenter ? 0.8 : 0.6}
                    stroke="white"
                    strokeWidth={isCenter ? 3 : isSelected ? 2 : 1}
                  />
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={isCenter ? 28 : isSelected ? 24 : 20}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    opacity={hoveredNode === entry.id ? 0.5 : 0}
                  >
                    <animate attributeName="r" values={`${isCenter ? 28 : isSelected ? 24 : 20};${isCenter ? 35 : isSelected ? 31 : 27}`} dur="1s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.5;0" dur="1s" repeatCount="indefinite" />
                  </circle>
                  <text
                    x={pos.x}
                    y={pos.y + 5}
                    className="text-xs fill-white font-medium"
                    textAnchor="middle"
                    style={{
                      fontSize: isCenter ? '12px' : isSelected ? '11px' : '10px',
                    }}
                  >
                    {entry.title.length > 6 ? entry.title.slice(0, 6) + '...' : entry.title}
                  </text>
                  {hoveredNode === entry.id && (
                    <g>
                      <rect
                        x={pos.x - 80}
                        y={pos.y - 45}
                        width={160}
                        height={35}
                        rx={8}
                        fill="#1f2937"
                        stroke="white"
                        strokeWidth={1}
                        opacity={0.9}
                      />
                      <text x={pos.x} y={pos.y - 30} className="text-sm fill-white font-medium" textAnchor="middle">
                        {entry.title}
                      </text>
                      <text x={pos.x} y={pos.y - 18} className="text-xs fill-slate-400" textAnchor="middle">
                        {ENTRY_TYPE_LABELS[entry.type]}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}
          </svg>

          {visibleEntries.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
              <GitBranch className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">暂无数据</p>
              <p className="text-sm mt-2">创建条目和关系后可在此查看图谱</p>
            </div>
          )}

          <div className="absolute bottom-4 left-4 flex items-center gap-2 text-xs text-slate-500">
            <MousePointer className="w-4 h-4" />
            <span>点击节点查看详情</span>
            <span className="mx-2">|</span>
            <span>拖拽画布平移</span>
            <span className="mx-2">|</span>
            <span>滚轮缩放</span>
          </div>
        </div>
      </div>
    </div>
  )
}

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