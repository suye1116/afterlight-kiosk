import type { ConstellationId, MemoryType } from '@/types'

/**
 * 별자리의 선.
 *
 * 캔버스와 무관한 순수한 셈이다. 화면 없이도 "선이 그물이 되지 않는가",
 * "엉뚱한 별을 스치지 않는가", "한 번 그은 선이 지워지지 않는가"를
 * 눈이 아니라 값으로 확인할 수 있어야 하기 때문에 떼어 두었다.
 *
 * 규칙은 넷이다.
 *
 *   1. **같은 별자리의 간직한 빛끼리만** 잇는다.
 *      흘려보낸 빛은 멀어지는 빛이라 선을 받지 않는다 — 이어 두면 선이 끌려다닌다.
 *   2. 가까운 것끼리, **한 별에 두 개까지만.** 전부 이으면 별자리가 아니라 그물이 된다.
 *   3. 엉뚱한 별 곁을 **스치고 지나가지 않는다.** 스치면 그 별이 선에 매달린 것처럼
 *      보여, 이어진 둘이 아니라 셋으로 읽힌다.
 *   4. 이미 그어진 선을 **가로지르지 않는다.**
 *
 * 그리고 이 함수는 **선을 지우지 않는다.** 이미 이어진 것은 그대로 두고
 * 아직 이어지지 않은 빛에만 선을 준다 — 새 빛이 왔다고 남의 선이 끊기면,
 * 보고 있던 사람에게는 별자리가 제멋대로 다시 그려지는 것으로 보인다.
 */
export interface LinkNode {
  id: string
  /** 화면에서의 자리 */
  x: number
  y: number
  type: MemoryType
  constellation: ConstellationId
  /** 이 별의 핵 반지름. 선이 비켜 가야 할 거리를 재는 데 쓴다. */
  radius: number
  /** 이어진 상대의 id */
  links: string[]
  /** 이어진 선의 수 */
  degree: number
}

/** 선이 제3의 별 곁에 두어야 하는 거리 (그 별 핵 반지름의 배수) */
export const LINK_AVOID = 3.4

/** 점 하나가 선분에서 얼마나 떨어져 있는가 */
export function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const dx = bx - ax
  const dy = by - ay
  const lengthSq = dx * dx + dy * dy
  if (lengthSq === 0) return Math.hypot(px - ax, py - ay)
  let t = ((px - ax) * dx + (py - ay) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** 두 선분이 서로를 가로지르는가 */
export function crosses(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number,
): boolean {
  const side = (x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) =>
    Math.sign((x2 - x1) * (y3 - y1) - (y2 - y1) * (x3 - x1))
  const d1 = side(ax, ay, bx, by, cx, cy)
  const d2 = side(ax, ay, bx, by, dx, dy)
  const d3 = side(cx, cy, dx, dy, ax, ay)
  const d4 = side(cx, cy, dx, dy, bx, by)
  return d1 !== d2 && d3 !== d4
}

/**
 * 아직 이어지지 않은 빛에 선을 준다.
 *
 * 이미 이어진 빛은 건드리지 않는다 — 별자리는 다시 그려지는 것이 아니라
 * **자라는** 것이다.
 */
export function growLinks(
  nodes: ReadonlyArray<LinkNode>,
  options: { radius: number; linkMax: number },
): void {
  const { radius, linkMax } = options
  if (linkMax <= 0) return
  const radiusSq = radius * radius
  const byId = new Map(nodes.map((node) => [node.id, node]))

  for (const node of nodes) {
    // 이미 이어진 빛은 그대로 둔다. 선은 지워지지 않는다.
    if (node.links.length > 0 || node.degree > 0) continue
    if (node.type !== 'keep') continue

    const family = nodes.filter(
      (other) =>
        other !== node &&
        other.type === 'keep' &&
        other.constellation === node.constellation,
    )

    const near = family
      .map((other) => ({
        other,
        distanceSq: (node.x - other.x) ** 2 + (node.y - other.y) ** 2,
      }))
      .filter((candidate) => candidate.distanceSq <= radiusSq)
      .sort((a, b) => a.distanceSq - b.distanceSq)

    for (const candidate of near) {
      if (node.degree >= linkMax) break
      const other = candidate.other
      if (other.degree >= linkMax) continue
      if (node.links.includes(other.id) || other.links.includes(node.id)) continue

      // 엉뚱한 별을 스치고 지나가는 선은 긋지 않는다
      const brushes = family.some((third) => {
        if (third === node || third === other) return false
        return (
          distanceToSegment(third.x, third.y, node.x, node.y, other.x, other.y) <
          third.radius * LINK_AVOID
        )
      })
      if (brushes) continue

      // 이미 그어진 선을 가로지르지 않는다
      const tangles = family.some((one) =>
        one.links.some((id) => {
          const two = byId.get(id)
          if (!two) return false
          if (one === node || one === other || two === node || two === other) return false
          return crosses(node.x, node.y, other.x, other.y, one.x, one.y, two.x, two.y)
        }),
      )
      if (tangles) continue

      node.links.push(other.id)
      node.degree += 1
      other.degree += 1
    }
  }
}
