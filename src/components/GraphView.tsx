import { t } from '@/lib/i18n'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useStore } from '@/store'
import { EntryType, RELATION_TYPE_META, RELATION_TYPE_LABELS, ENTRY_TYPE_LABELS, Entry } from '@/types'
import { GitBranch, ZoomIn, ZoomOut, Crosshair, MousePointer, RefreshCw, Pin } from 'lucide-react'
import {
  runForceSimulation,
  initializePositions,
  getNodeRadius,
  ForceNode,
  ForceEdge,
} from '@/lib/forceLayout'

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

const SIM_WIDTH = 1200
const SIM_HEIGHT = 900

export function GraphView() {
  const { entries, relations, selectedEntryId, selectEntry, fetchEntries, fetchRelations } = useStore()

  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [nodePositions, setNodePositions] = useState<Record<string, { x: number; y: number }>>({})
  const [pinnedNodes, setPinnedNodes] = useState<Set<string>>(new Set())
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [selectedNodes, setSelectedNodes] = useState<string[]>([])
  const [simKey, setSimKey] = useState(0)

  const [draggingNode, setDraggingNode] = useState<string | null>(null)
  const [dragNodeOffset, setDragNodeOffset] = useState({ x: 0, y: 0 })
  const [preDragPos, setPreDragPos] = useState<{ x: number; y: number } | null>(null)

  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    fetchEntries()
    fetchRelations()
  }, [])

  const visibleRelations = useMemo(() => {
    return relations.filter((r) => {
      if (!selectedEntryId) return true
      return r.sourceEntryId === selectedEntryId || r.targetEntryId === selectedEntryId
    })
  }, [relations, selectedEntryId])

  const visibleEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (!selectedEntryId) return true
      if (entry.id === selectedEntryId) return true
      return relations.some(
        (r) =>
          (r.sourceEntryId === entry.id && r.targetEntryId === selectedEntryId) ||
          (r.targetEntryId === entry.id && r.sourceEntryId === selectedEntryId),
      )
    })
  }, [entries, relations, selectedEntryId])

  const runLayout = useCallback(() => {
    if (visibleEntries.length === 0) {
      setNodePositions({})
      return
    }

    const initPos = initializePositions(visibleEntries, selectedEntryId, relations, SIM_WIDTH, SIM_HEIGHT)

    const forceNodes: ForceNode[] = visibleEntries.map((e) => {
      const pos = initPos[e.id] || { x: SIM_WIDTH / 2, y: SIM_HEIGHT / 2 }
      return {
        id: e.id,
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        radius: getNodeRadius(e.type),
        pinned: pinnedNodes.has(e.id),
        fixed: e.id === selectedEntryId || pinnedNodes.has(e.id),
      }
    })

    const forceEdges: ForceEdge[] = visibleRelations.map((r) => ({
      source: r.sourceEntryId,
      target: r.targetEntryId,
    }))

    const result = runForceSimulation(forceNodes, forceEdges, {
      width: SIM_WIDTH,
      height: SIM_HEIGHT,
    })

    const positions: Record<string, { x: number; y: number }> = {}
    result.forEach((n) => {
      positions[n.id] = { x: n.x, y: n.y }
    })
    setNodePositions(positions)
  }, [visibleEntries, visibleRelations, selectedEntryId, relations, pinnedNodes])

  useEffect(() => {
    runLayout()
  }, [simKey, visibleEntries.length, selectedEntryId])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (draggingNode) return
      if (e.target === containerRef.current || e.target === svgRef.current) {
        setIsDragging(true)
        setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
      }
    },
    [offset, draggingNode],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (draggingNode && svgRef.current) {
        const rect = svgRef.current.getBoundingClientRect()
        const svgX = (e.clientX - rect.left - offset.x) / scale
        const svgY = (e.clientY - rect.top - offset.y) / scale
        setNodePositions((prev) => ({
          ...prev,
          [draggingNode]: {
            x: svgX - dragNodeOffset.x,
            y: svgY - dragNodeOffset.y,
          },
        }))
        return
      }
      if (isDragging) {
        setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
      }
    },
    [isDragging, dragStart, draggingNode, dragNodeOffset, offset, scale],
  )

  const handleMouseUp = useCallback(() => {
    if (draggingNode) {
      if (!pinnedNodes.has(draggingNode) && preDragPos) {
        setNodePositions((prev) => ({
          ...prev,
          [draggingNode]: preDragPos,
        }))
      }
      setDraggingNode(null)
      setPreDragPos(null)
      return
    }
    setIsDragging(false)
  }, [draggingNode, pinnedNodes, preDragPos])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((prev) => Math.max(0.3, Math.min(3, prev + delta)))
  }, [])

  const handleNodeMouseDown = useCallback(
    (e: React.MouseEvent, entryId: string) => {
      e.stopPropagation()
      const pos = nodePositions[entryId]
      if (!pos || !svgRef.current) return

      const rect = svgRef.current.getBoundingClientRect()
      const svgX = (e.clientX - rect.left - offset.x) / scale
      const svgY = (e.clientY - rect.top - offset.y) / scale

      setDraggingNode(entryId)
      setDragNodeOffset({ x: svgX - pos.x, y: svgY - pos.y })
      setPreDragPos({ x: pos.x, y: pos.y })
    },
    [nodePositions, offset, scale],
  )

  const handleNodeClick = useCallback(
    (e: React.MouseEvent, entryId: string) => {
      e.stopPropagation()
      if (draggingNode) return
      selectEntry(entryId)
      setSelectedNodes((prev) =>
        prev.includes(entryId) ? prev.filter((id) => id !== entryId) : [...prev, entryId],
      )
    },
    [selectEntry, draggingNode],
  )

  const handleNodeDoubleClick = useCallback(
    (e: React.MouseEvent, entryId: string) => {
      e.stopPropagation()
      selectEntry(entryId)
    },
    [selectEntry],
  )

  const togglePinNode = useCallback((e: React.MouseEvent, entryId: string) => {
    e.stopPropagation()
    setPinnedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(entryId)) {
        next.delete(entryId)
      } else {
        next.add(entryId)
      }
      return next
    })
  }, [])

  const handleRelayout = useCallback(() => {
    setSimKey((k) => k + 1)
  }, [])

  const getRelationTypeColor = (type: string): string => {
    return RELATION_TYPE_META[type]?.color || '#6b7280'
  }

  const getNodeBaseRadius = (entry: Entry): number => {
    const base = getNodeRadius(entry.type)
    const isCenter = entry.id === selectedEntryId
    const isSelected = selectedNodes.includes(entry.id)
    if (isCenter) return base + 8
    if (isSelected) return base + 4
    return base
  }

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <GitBranch className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">{t('关系图谱')}</h2>
          <span className="text-xs text-slate-500">
            {visibleEntries.length}
            {t(' 个节点 ·')}
            {visibleRelations.length}
            {t(' 条关系')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRelayout}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            title={t('重新布局')}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScale((prev) => Math.min(3, prev + 0.2))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            title={t('放大')}
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScale((prev) => Math.max(0.3, prev - 0.2))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            title={t('缩小')}
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setScale(1)
              setOffset({ x: 0, y: 0 })
            }}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            title={t('重置视图')}
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="w-56 border-r border-white/10 p-4 overflow-y-auto">
          <div className="mb-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2">{t('图例')}</h3>
            <div className="space-y-2">
              {Object.entries(ENTRY_TYPE_COLORS).map(([type, color]) => (
                <div key={type} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs text-slate-400">{ENTRY_TYPE_LABELS[type as EntryType]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mb-4 pt-4 border-t border-white/10">
            <h3 className="text-sm font-medium text-slate-300 mb-2">{t('操作')}</h3>
            <div className="space-y-1 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <RefreshCw className="w-3 h-3" />
                <span>{t('重新布局按钮重置模拟')}</span>
              </div>
              <div className="flex items-center gap-2">
                <Pin className="w-3 h-3" />
                <span>{t('右键节点切换固定')}</span>
              </div>
            </div>
          </div>

          {selectedEntryId && (
            <div>
              <h3 className="text-sm font-medium text-slate-300 mb-2">{t('相关关系')}</h3>
              <div className="space-y-2">
                {visibleRelations.map((relation) => {
                  const targetEntry = entries.find(
                    (e) =>
                      e.id ===
                      (relation.sourceEntryId === selectedEntryId
                        ? relation.targetEntryId
                        : relation.sourceEntryId),
                  )
                  return (
                    <div
                      key={relation.id}
                      onClick={() =>
                        targetEntry &&
                        handleNodeClick({ stopPropagation: () => {} } as React.MouseEvent, targetEntry.id)
                      }
                      className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer"
                    >
                      <span className="text-sm text-white">{targetEntry?.title}</span>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: `${getRelationTypeColor(relation.type)}20`,
                          color: getRelationTypeColor(relation.type),
                        }}
                      >
                        {RELATION_TYPE_LABELS[relation.type] || relation.type}
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
            ref={svgRef}
            className="w-full h-full"
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transformOrigin: 'center center',
            }}
          >
            <defs>
              <marker id="arrowhead-blue" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
              </marker>
              <marker
                id="arrowhead-green"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#22c55e" />
              </marker>
              <marker
                id="arrowhead-purple"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#a855f7" />
              </marker>
              <marker
                id="arrowhead-yellow"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#eab308" />
              </marker>
              <marker id="arrowhead-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
              </marker>
              <marker id="arrowhead-cyan" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#06b6d4" />
              </marker>
              <marker
                id="arrowhead-orange"
                markerWidth="10"
                markerHeight="7"
                refX="9"
                refY="3.5"
                orient="auto"
              >
                <polygon points="0 0, 10 3.5, 0 7" fill="#f97316" />
              </marker>
              <marker id="arrowhead-gray" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
              </marker>
            </defs>

            {visibleRelations.map((relation) => {
              const sourcePos = nodePositions[relation.sourceEntryId]
              const targetPos = nodePositions[relation.targetEntryId]
              if (!sourcePos || !targetPos) return null

              const isSelected =
                selectedNodes.includes(relation.sourceEntryId) ||
                selectedNodes.includes(relation.targetEntryId)
              const isHighlighted =
                relation.sourceEntryId === selectedEntryId || relation.targetEntryId === selectedEntryId
              const meta = RELATION_TYPE_META[relation.type]
              const isSymmetric = meta?.symmetric || relation.direction === 'bidirectional'
              const color = getRelationTypeColor(relation.type)

              const dx = targetPos.x - sourcePos.x
              const dy = targetPos.y - sourcePos.y
              const dist = Math.sqrt(dx * dx + dy * dy) || 1
              const sourceRadius = getNodeBaseRadius(entries.find((e) => e.id === relation.sourceEntryId)!)
              const targetRadius = getNodeBaseRadius(entries.find((e) => e.id === relation.targetEntryId)!)

              const sx = sourcePos.x + (dx / dist) * sourceRadius
              const sy = sourcePos.y + (dy / dist) * sourceRadius
              const tx = targetPos.x - (dx / dist) * (targetRadius + (isSymmetric ? 0 : 10))
              const ty = targetPos.y - (dy / dist) * (targetRadius + (isSymmetric ? 0 : 10))

              const midX = (sx + tx) / 2
              const midY = (sy + ty) / 2

              const colorMap: Record<string, string> = {
                '#3b82f6': 'arrowhead-blue',
                '#22c55e': 'arrowhead-green',
                '#a855f7': 'arrowhead-purple',
                '#eab308': 'arrowhead-yellow',
                '#ef4444': 'arrowhead-red',
                '#06b6d4': 'arrowhead-cyan',
                '#f97316': 'arrowhead-orange',
                '#6b7280': 'arrowhead-gray',
              }
              const markerId = colorMap[color] || 'arrowhead-gray'

              const showLabel =
                isHighlighted ||
                hoveredNode === relation.sourceEntryId ||
                hoveredNode === relation.targetEntryId

              return (
                <g key={relation.id}>
                  <line
                    x1={sx}
                    y1={sy}
                    x2={tx}
                    y2={ty}
                    stroke={isHighlighted ? color : '#374151'}
                    strokeWidth={isHighlighted || isSelected ? 2.5 : 1.5}
                    strokeDasharray={isSymmetric ? 'none' : 'none'}
                    markerEnd={isSymmetric ? undefined : `url(#${markerId})`}
                    opacity={isHighlighted || isSelected ? 1 : 0.5}
                  />
                  {showLabel && (
                    <g>
                      <rect
                        x={midX - 40}
                        y={midY - 12}
                        width={80}
                        height={18}
                        rx={4}
                        fill="#1f2937"
                        stroke={color}
                        strokeWidth={0.5}
                        opacity={0.95}
                      />
                      <text
                        x={midX}
                        y={midY + 1}
                        className="text-[10px] fill-slate-200 font-medium"
                        textAnchor="middle"
                      >
                        {RELATION_TYPE_LABELS[relation.type] || relation.type}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}

            {visibleEntries.map((entry) => {
              const pos = nodePositions[entry.id]
              if (!pos) return null

              const isSelected = selectedNodes.includes(entry.id)
              const isCenter = entry.id === selectedEntryId
              const isPinned = pinnedNodes.has(entry.id)
              const isHovered = hoveredNode === entry.id
              const color = ENTRY_TYPE_COLORS[entry.type]
              const baseR = getNodeBaseRadius(entry)
              const displayR = isHovered ? baseR * 1.1 : baseR

              return (
                <g
                  key={entry.id}
                  onClick={(e) => handleNodeClick(e, entry.id)}
                  onDoubleClick={(e) => handleNodeDoubleClick(e, entry.id)}
                  onContextMenu={(e) => togglePinNode(e, entry.id)}
                  onMouseDown={(e) => handleNodeMouseDown(e, entry.id)}
                  onMouseEnter={() => setHoveredNode(entry.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  className="cursor-pointer"
                  style={{ transition: 'transform 0.15s ease-out' }}
                >
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={displayR + 4}
                    fill={color}
                    opacity={isHovered ? 0.15 : 0}
                  />
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={displayR}
                    fill={color}
                    opacity={isSelected || isCenter ? 0.9 : 0.7}
                    stroke="white"
                    strokeWidth={isCenter ? 3 : isPinned ? 2.5 : isSelected ? 2 : 1}
                  />
                  {isPinned && (
                    <circle
                      cx={pos.x}
                      cy={pos.y}
                      r={displayR - 3}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={2}
                      strokeDasharray="3 2"
                    />
                  )}
                  <circle
                    cx={pos.x}
                    cy={pos.y}
                    r={displayR}
                    fill="none"
                    stroke={color}
                    strokeWidth={2}
                    opacity={isHovered ? 0.4 : 0}
                  >
                    <animate
                      attributeName="r"
                      values={`${displayR};${displayR + 8}`}
                      dur="1s"
                      repeatCount="indefinite"
                    />
                    <animate attributeName="opacity" values="0.4;0" dur="1s" repeatCount="indefinite" />
                  </circle>
                  <text
                    x={pos.x}
                    y={pos.y + 4}
                    className="fill-white font-medium pointer-events-none select-none"
                    textAnchor="middle"
                    style={{
                      fontSize: isCenter ? '12px' : isSelected ? '11px' : '10px',
                    }}
                  >
                    {entry.title.length > 5 ? entry.title.slice(0, 5) + '..' : entry.title}
                  </text>
                  {isHovered && (
                    <g pointerEvents="none">
                      <rect
                        x={pos.x - 100}
                        y={pos.y - displayR - 85}
                        width={200}
                        height={70}
                        rx={8}
                        fill="#1f2937"
                        stroke={color}
                        strokeWidth={1.5}
                        opacity={0.98}
                      />
                      <text
                        x={pos.x}
                        y={pos.y - displayR - 65}
                        className="text-sm fill-white font-semibold"
                        textAnchor="middle"
                      >
                        {entry.title}
                      </text>
                      <text
                        x={pos.x}
                        y={pos.y - displayR - 50}
                        className="text-[11px] fill-slate-400"
                        textAnchor="middle"
                      >
                        {ENTRY_TYPE_LABELS[entry.type]} · {isPinned ? t('已固定') : t('未固定')}
                      </text>
                      {entry.summary && (
                        <text
                          x={pos.x}
                          y={pos.y - displayR - 32}
                          className="text-[10px] fill-slate-300"
                          textAnchor="middle"
                        >
                          {entry.summary.length > 24
                            ? entry.summary.slice(0, 24) + '...'
                            : entry.summary || t('暂无简介')}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              )
            })}
          </svg>

          {visibleEntries.length === 0 && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500">
              <GitBranch className="w-16 h-16 mb-4 opacity-50" />
              <p className="text-lg">{t('暂无数据')}</p>
              <p className="text-sm mt-2">{t('创建条目和关系后可在此查看图谱')}</p>
            </div>
          )}

          <div className="absolute bottom-4 left-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 bg-slate-900/70 px-3 py-2 rounded-lg backdrop-blur-sm">
            <div className="flex items-center gap-1">
              <MousePointer className="w-3 h-3" />
              <span>{t('点击选中 · 双击跳转')}</span>
            </div>
            <span className="text-slate-700">|</span>
            <span>{t('拖拽节点移动')}</span>
            <span className="text-slate-700">|</span>
            <span>{t('右键固定/解除')}</span>
            <span className="text-slate-700">|</span>
            <span>{t('滚轮缩放')}</span>
          </div>

          {pinnedNodes.size > 0 && (
            <div className="absolute bottom-4 right-4 flex items-center gap-2 text-xs text-amber-400 bg-amber-950/50 px-3 py-1.5 rounded-lg border border-amber-900/50">
              <Pin className="w-3 h-3" />
              <span>
                {pinnedNodes.size}
                {t(' 个节点已固定')}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
