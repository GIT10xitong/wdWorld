import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/store'
import { EntryType } from '@/types'
import { Crosshair, Image, MapPin, Move, Plus, X, ZoomIn, ZoomOut } from 'lucide-react'
import linjiangMapUrl from '@/assets/linjiang-investigation-map.png'
import { BUILTIN_ASSET_PATHS, resolveAssetSource } from '@/lib/assetSources'

export function MapView() {
  const {
    entries,
    projectAssets,
    mapEntries,
    mapImageAssetId,
    fetchMapEntries,
    setMapImageAssetId,
    updateEntryMapPosition,
    selectEntry,
    selectedEntryId,
  } = useStore()

  const [scale, setScale] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [placingEntryId, setPlacingEntryId] = useState<string | null>(null)
  const [showImageSelectModal, setShowImageSelectModal] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)
  const isPlacingMode = placingEntryId !== null

  useEffect(() => {
    fetchMapEntries()
  }, [fetchMapEntries])

  useEffect(() => {
    if (!isPlacingMode) return
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPlacingEntryId(null)
    }
    window.addEventListener('keydown', cancelOnEscape)
    return () => window.removeEventListener('keydown', cancelOnEscape)
  }, [isPlacingMode])

  const mapImage =
    projectAssets.find((asset) => asset.id === mapImageAssetId) ??
    projectAssets.find((asset) => asset.relativePath === BUILTIN_ASSET_PATHS.map) ??
    projectAssets.find((asset) => asset.kind === 'map_image')

  const handleMapClick = async (event: React.MouseEvent) => {
    if (!placingEntryId || !mapRef.current) return

    // getBoundingClientRect already includes pan/zoom transforms.
    const rect = mapRef.current.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height))
    await updateEntryMapPosition(placingEntryId, x, y)
    setPlacingEntryId(null)
  }

  const handleMouseDown = (event: React.MouseEvent) => {
    if (isPlacingMode || event.target !== mapRef.current) return
    setIsDragging(true)
    setDragStart({ x: event.clientX - offset.x, y: event.clientY - offset.y })
  }

  const handleMouseMove = (event: React.MouseEvent) => {
    if (!isDragging) return
    setOffset({ x: event.clientX - dragStart.x, y: event.clientY - dragStart.y })
  }

  const handleWheel = (event: React.WheelEvent) => {
    event.preventDefault()
    setScale((current) => Math.max(0.5, Math.min(3, current + (event.deltaY > 0 ? -0.1 : 0.1))))
  }

  const getEntryTypeColor = (type: EntryType): string =>
    ({
      character: 'bg-blue-500',
      location: 'bg-green-500',
      faction: 'bg-purple-500',
      item: 'bg-yellow-500',
      event: 'bg-red-500',
      lore: 'bg-cyan-500',
      region: 'bg-orange-500',
      note: 'bg-gray-500',
    })[type]

  const unplacedEntries = entries.filter((entry) => entry.mapPositionX == null || entry.mapPositionY == null)
  const selectableMapAssets = projectAssets.filter(
    (asset) => asset.kind === 'image' || asset.kind === 'map_image',
  )

  return (
    <div className="h-full flex flex-col bg-slate-900">
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <MapPin className="w-5 h-5 text-purple-400" />
          <h2 className="text-lg font-semibold text-white">地图视图</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowImageSelectModal(true)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
          >
            <Image className="w-4 h-4" />
            {mapImage ? '更换底图' : '设置底图'}
          </button>
          <button
            onClick={() => setScale((current) => Math.min(3, current + 0.2))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScale((current) => Math.max(0.5, current - 0.2))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => {
              setScale(1)
              setOffset({ x: 0, y: 0 })
            }}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300"
            title="重置视图"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <aside className="w-64 border-r border-white/10 p-4 overflow-y-auto">
          <h3 className="text-sm font-medium text-slate-300 mb-3">待放置条目</h3>
          <div className="space-y-2">
            {unplacedEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`w-full flex items-center justify-between p-2 rounded-lg cursor-pointer group transition-colors ${placingEntryId === entry.id ? 'bg-green-500/15 ring-1 ring-green-400/50' : 'bg-white/5 hover:bg-white/10'}`}
                onClick={() => setPlacingEntryId(entry.id)}
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 shrink-0 rounded-full ${getEntryTypeColor(entry.type)}`} />
                  <span className="text-sm text-white truncate">{entry.title}</span>
                </span>
                <Plus className="w-4 h-4 text-slate-500 group-hover:text-white" />
              </button>
            ))}
            {unplacedEntries.length === 0 && <p className="text-xs text-slate-500">暂无待放置条目</p>}
          </div>

          <h3 className="text-sm font-medium text-slate-300 mt-6 mb-3">已放置条目</h3>
          <div className="space-y-2">
            {mapEntries.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className={`w-full flex items-center p-2 rounded-lg transition-colors ${selectedEntryId === entry.id ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-white/5 hover:bg-white/10'}`}
                onClick={() => selectEntry(entry.id)}
              >
                <span className={`w-2 h-2 shrink-0 rounded-full mr-2 ${getEntryTypeColor(entry.type)}`} />
                <span className="text-sm text-white truncate">{entry.title}</span>
              </button>
            ))}
          </div>
        </aside>

        <div className="flex-1 relative overflow-hidden bg-slate-800">
          <div className="absolute inset-0 flex items-center justify-center">
            <div
              ref={mapRef}
              className={`relative max-w-full max-h-full select-none ${isPlacingMode ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'}`}
              style={{
                transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                transformOrigin: 'center center',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={() => setIsDragging(false)}
              onMouseLeave={() => setIsDragging(false)}
              onWheel={handleWheel}
              onClick={handleMapClick}
            >
              <img
                src={resolveAssetSource(mapImage, linjiangMapUrl)}
                alt="地图底图"
                className="block max-w-full max-h-[calc(100vh-12rem)] object-contain pointer-events-none"
                draggable={false}
              />

              {mapEntries.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  className={`absolute -translate-x-1/2 -translate-y-full group ${isPlacingMode ? 'pointer-events-none' : ''}`}
                  style={{ left: `${entry.mapPositionX! * 100}%`, top: `${entry.mapPositionY! * 100}%` }}
                  onClick={(event) => {
                    event.stopPropagation()
                    selectEntry(entry.id)
                  }}
                  title={entry.title}
                >
                  <span
                    className={`block w-4 h-4 rounded-full ${getEntryTypeColor(entry.type)} border-2 border-white shadow-lg`}
                  />
                  <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1 px-2 py-1 rounded bg-slate-900/90 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100">
                    {entry.title}
                  </span>
                </button>
              ))}

              {isPlacingMode && (
                <div className="absolute inset-0 pointer-events-none border-2 border-dashed border-green-500/60 rounded-lg">
                  <div className="absolute top-4 left-4 px-3 py-1 rounded bg-green-950/80 text-green-300 text-sm flex items-center gap-2">
                    <Move className="w-4 h-4" />
                    点击地图放置条目 · Esc 取消
                  </div>
                  <button
                    type="button"
                    className="pointer-events-auto absolute right-4 top-4 flex items-center gap-1 rounded bg-slate-950/85 px-3 py-1 text-sm text-slate-200 hover:bg-slate-900"
                    onClick={(event) => {
                      event.stopPropagation()
                      setPlacingEntryId(null)
                    }}
                  >
                    <X className="h-4 w-4" />
                    取消
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showImageSelectModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-slate-800 rounded-xl border border-white/10 shadow-2xl">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-xl font-bold text-white">选择地图底图</h2>
              <button
                onClick={() => setShowImageSelectModal(false)}
                className="p-2 rounded-lg hover:bg-white/10 text-slate-400"
                aria-label="关闭"
              >
                ×
              </button>
            </div>
            <div className="p-6">
              {selectableMapAssets.length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {selectableMapAssets.map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      className={`relative aspect-video rounded-lg overflow-hidden border-2 ${mapImage?.id === asset.id ? 'border-purple-500' : 'border-transparent hover:border-white/20'}`}
                      onClick={() => {
                        setMapImageAssetId(asset.id)
                        setShowImageSelectModal(false)
                      }}
                    >
                      <img
                        src={resolveAssetSource(asset, linjiangMapUrl)}
                        alt={asset.filename}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute inset-x-0 bottom-0 px-2 py-1 bg-black/70 text-xs text-white truncate">
                        {asset.filename}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-slate-400 text-center">当前使用内置默认底图。上传图片后可在这里替换。</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
