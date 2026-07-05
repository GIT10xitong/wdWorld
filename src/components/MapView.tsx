import { useState, useEffect, useRef } from 'react'
import { useStore } from '@/store'
import { EntryType } from '@/types'
import { MapPin, Plus, Image, ZoomIn, ZoomOut, Move, Crosshair } from 'lucide-react'

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
  const [isPlacingMode, setIsPlacingMode] = useState(false)
  const [placingEntryId, setPlacingEntryId] = useState<string | null>(null)
  const [showImageSelectModal, setShowImageSelectModal] = useState(false)
  const mapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchMapEntries()
  }, [])

  const mapImage = projectAssets.find((a) => a.id === mapImageAssetId)

  const handleMapClick = (e: React.MouseEvent) => {
    if (!isPlacingMode || !placingEntryId || !mapRef.current) return

    const rect = mapRef.current.getBoundingClientRect()
    const x = ((e.clientX - rect.left - offset.x) / scale) / rect.width
    const y = ((e.clientY - rect.top - offset.y) / scale) / rect.height

    updateEntryMapPosition(placingEntryId, Math.max(0, Math.min(1, x)), Math.max(0, Math.min(1, y)))
    setIsPlacingMode(false)
    setPlacingEntryId(null)
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target !== mapRef.current) return
    setIsDragging(true)
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setScale((prev) => Math.max(0.5, Math.min(3, prev + delta)))
  }

  const handlePlaceEntry = (entryId: string) => {
    setPlacingEntryId(entryId)
    setIsPlacingMode(true)
  }

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
            onClick={() => setScale((prev) => Math.min(3, prev + 0.2))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            title="放大"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            onClick={() => setScale((prev) => Math.max(0.5, prev - 0.2))}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            title="缩小"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setScale(1); setOffset({ x: 0, y: 0 }) }}
            className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-slate-300 transition-colors"
            title="重置视图"
          >
            <Crosshair className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex">
        <div className="w-64 border-r border-white/10 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-slate-300">待放置条目</h3>
          </div>
          <div className="space-y-2">
            {entries
              .filter((e) => !e.mapPositionX && !e.mapPositionY)
              .map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-white/5 hover:bg-white/10 cursor-pointer group"
                  onClick={() => handlePlaceEntry(entry.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getEntryTypeColor(entry.type)}`} />
                    <span className="text-sm text-white">{entry.title}</span>
                  </div>
                  <Plus className="w-4 h-4 text-slate-500 group-hover:text-white opacity-0 group-hover:opacity-100 transition-all" />
                </div>
              ))}
            {entries.filter((e) => !e.mapPositionX && !e.mapPositionY).length === 0 && (
              <p className="text-xs text-slate-500">暂无待放置条目</p>
            )}
          </div>

          <div className="mt-6">
            <h3 className="text-sm font-medium text-slate-300 mb-3">已放置条目</h3>
            <div className="space-y-2">
              {mapEntries.map((entry) => (
                <div
                  key={entry.id}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                    selectedEntryId === entry.id ? 'bg-purple-500/20 border border-purple-500/50' : 'bg-white/5 hover:bg-white/10'
                  }`}
                  onClick={() => selectEntry(entry.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${getEntryTypeColor(entry.type)}`} />
                    <span className="text-sm text-white truncate">{entry.title}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden">
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800">
            {!mapImage ? (
              <div className="text-center text-slate-500">
                <Image className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>点击上方"设置底图"上传地图图片</p>
                <p className="text-sm mt-2">支持 PNG、JPG 格式</p>
              </div>
            ) : (
              <div
                ref={mapRef}
                className="relative cursor-grab active:cursor-grabbing"
                style={{
                  transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
                  transformOrigin: 'center center',
                }}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onClick={handleMapClick}
              >
                <img
                  src={`data:image/${mapImage.mimeType.split('/')[1]};base64,${localStorage.getItem(`wdworld_asset_${mapImage.id}`)}`}
                  alt="地图底图"
                  className="max-w-full max-h-full object-contain"
                  draggable={false}
                />

                {mapEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className={`absolute transform -translate-x-1/2 -translate-y-full cursor-pointer group ${
                      isPlacingMode ? 'pointer-events-none' : ''
                    }`}
                    style={{
                      left: `${entry.mapPositionX! * 100}%`,
                      top: `${entry.mapPositionY! * 100}%`,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      selectEntry(entry.id)
                    }}
                  >
                    <div className={`w-4 h-4 rounded-full ${getEntryTypeColor(entry.type)} border-2 border-white shadow-lg`} />
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-1 px-2 py-1 rounded bg-slate-900/90 text-xs text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                      {entry.title}
                    </div>
                  </div>
                ))}

                {isPlacingMode && (
                  <div className="absolute inset-0 border-2 border-dashed border-green-500/50 rounded-lg">
                    <div className="absolute top-4 left-4 px-3 py-1 rounded bg-green-500/20 text-green-300 text-sm flex items-center gap-2">
                      <Move className="w-4 h-4" />
                      点击地图放置条目
                    </div>
                  </div>
                )}
              </div>
            )}
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
                className="p-2 rounded-lg hover:bg-white/10 transition-colors"
              >
                <span className="text-slate-400">×</span>
              </button>
            </div>
            <div className="p-6">
              {projectAssets.filter((a) => a.kind === 'image').length > 0 ? (
                <div className="grid grid-cols-2 gap-3">
                  {projectAssets.filter((a) => a.kind === 'image').map((asset) => (
                    <div
                      key={asset.id}
                      className={`relative aspect-video rounded-lg overflow-hidden cursor-pointer border-2 transition-colors ${
                        mapImageAssetId === asset.id ? 'border-purple-500' : 'border-transparent hover:border-white/20'
                      }`}
                      onClick={() => {
                        setMapImageAssetId(asset.id)
                        setShowImageSelectModal(false)
                      }}
                    >
                      <img
                        src={`data:image/${asset.mimeType.split('/')[1]};base64,${localStorage.getItem(`wdworld_asset_${asset.id}`)}`}
                        alt={asset.filename}
                        className="w-full h-full object-cover"
                      />
                      {mapImageAssetId === asset.id && (
                        <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                          <span className="text-white text-xs">✓</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-center">请先上传图片作为地图底图</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}