export interface ForceNode {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  pinned?: boolean
  fixed?: boolean
}

export interface ForceEdge {
  source: string
  target: string
}

export interface ForceSimConfig {
  width: number
  height: number
  iterations?: number
  springK?: number
  restLength?: number
  repulsionK?: number
  centerK?: number
  damping?: number
  velocityThreshold?: number
}

const DEFAULT_CONFIG: Required<Omit<ForceSimConfig, 'width' | 'height'>> = {
  iterations: 150,
  springK: 0.05,
  restLength: 120,
  repulsionK: 8000,
  centerK: 0.01,
  damping: 0.85,
  velocityThreshold: 0.1,
}

export function runForceSimulation(
  nodes: ForceNode[],
  edges: ForceEdge[],
  config: ForceSimConfig,
): ForceNode[] {
  const { width, height, iterations, springK, restLength, repulsionK, centerK, damping, velocityThreshold } =
    { ...DEFAULT_CONFIG, ...config }

  const nodeMap = new Map<string, ForceNode>()
  nodes.forEach((n) => {
    nodeMap.set(n.id, { ...n })
  })

  const cx = width / 2
  const cy = height / 2

  for (let iter = 0; iter < iterations; iter++) {
    let maxVelocity = 0

    nodes.forEach((n) => {
      const node = nodeMap.get(n.id)!
      if (node.fixed) return
      node.vx = 0
      node.vy = 0
    })

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodeMap.get(nodes[i].id)!
        const b = nodeMap.get(nodes[j].id)!
        if (a.fixed && b.fixed) continue

        let dx = b.x - a.x
        let dy = b.y - a.y
        let dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 1) {
          dist = 1
          dx = Math.random() - 0.5 || 0.1
          dy = Math.random() - 0.5 || 0.1
        }

        const force = repulsionK / (dist * dist)
        const fx = (dx / dist) * force
        const fy = (dy / dist) * force

        if (!a.fixed) {
          a.vx -= fx
          a.vy -= fy
        }
        if (!b.fixed) {
          b.vx += fx
          b.vy += fy
        }
      }
    }

    edges.forEach((edge) => {
      const source = nodeMap.get(edge.source)
      const target = nodeMap.get(edge.target)
      if (!source || !target) return
      if (source.fixed && target.fixed) return

      let dx = target.x - source.x
      let dy = target.y - source.y
      let dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < 1) {
        dist = 1
        dx = Math.random() - 0.5 || 0.1
        dy = Math.random() - 0.5 || 0.1
      }

      const displacement = dist - restLength
      const force = springK * displacement
      const fx = (dx / dist) * force
      const fy = (dy / dist) * force

      if (!source.fixed) {
        source.vx += fx
        source.vy += fy
      }
      if (!target.fixed) {
        target.vx -= fx
        target.vy -= fy
      }
    })

    nodeMap.forEach((node) => {
      if (node.fixed) return

      const dx = cx - node.x
      const dy = cy - node.y
      node.vx += dx * centerK
      node.vy += dy * centerK

      node.vx *= damping
      node.vy *= damping

      node.x += node.vx
      node.y += node.vy

      const padding = 50
      const minX = padding + node.radius
      const maxX = width - padding - node.radius
      const minY = padding + node.radius
      const maxY = height - padding - node.radius

      if (node.x < minX) {
        node.x = minX
        node.vx *= -0.5
      }
      if (node.x > maxX) {
        node.x = maxX
        node.vx *= -0.5
      }
      if (node.y < minY) {
        node.y = minY
        node.vy *= -0.5
      }
      if (node.y > maxY) {
        node.y = maxY
        node.vy *= -0.5
      }

      const vel = Math.sqrt(node.vx * node.vx + node.vy * node.vy)
      if (vel > maxVelocity) {
        maxVelocity = vel
      }
    })

    if (maxVelocity < velocityThreshold && iter > 30) {
      break
    }
  }

  return nodes.map((n) => {
    const simNode = nodeMap.get(n.id)!
    return {
      ...n,
      x: simNode.x,
      y: simNode.y,
    }
  })
}

export function initializePositions(
  entries: { id: string; type: string }[],
  selectedEntryId: string | null,
  relations: { sourceEntryId: string; targetEntryId: string }[],
  width: number,
  height: number,
): Record<string, { x: number; y: number }> {
  const positions: Record<string, { x: number; y: number }> = {}
  const cx = width / 2
  const cy = height / 2

  if (selectedEntryId) {
    positions[selectedEntryId] = { x: cx, y: cy }

    const relatedIds = new Set<string>()
    relations.forEach((r) => {
      if (r.sourceEntryId === selectedEntryId) relatedIds.add(r.targetEntryId)
      if (r.targetEntryId === selectedEntryId) relatedIds.add(r.sourceEntryId)
    })

    const relatedArr = Array.from(relatedIds)
    const angleStep = (2 * Math.PI) / Math.max(relatedArr.length, 1)
    relatedArr.forEach((id, idx) => {
      const angle = idx * angleStep - Math.PI / 2
      const radius = 180
      positions[id] = {
        x: cx + Math.cos(angle) * radius,
        y: cy + Math.sin(angle) * radius,
      }
    })

    const remaining = entries.filter((e) => !positions[e.id])
    remaining.forEach((entry, idx) => {
      const angle = (idx / Math.max(remaining.length, 1)) * 2 * Math.PI
      const radius = 320 + (idx % 3) * 40
      positions[entry.id] = {
        x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 40,
        y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 40,
      }
    })
  } else {
    entries.forEach((entry, idx) => {
      const angle = (idx / Math.max(entries.length, 1)) * 2 * Math.PI - Math.PI / 2
      const radius = Math.min(width, height) / 3 + (idx % 3) * 30
      positions[entry.id] = {
        x: cx + Math.cos(angle) * radius + (Math.random() - 0.5) * 30,
        y: cy + Math.sin(angle) * radius + (Math.random() - 0.5) * 30,
      }
    })
  }

  return positions
}

export function getNodeRadius(type: string): number {
  switch (type) {
    case 'region':
      return 24
    case 'location':
      return 22
    case 'faction':
      return 21
    case 'character':
      return 20
    case 'event':
      return 19
    case 'lore':
      return 18
    case 'item':
      return 17
    case 'note':
      return 15
    default:
      return 18
  }
}
