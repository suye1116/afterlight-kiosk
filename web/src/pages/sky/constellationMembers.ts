import { CONSTELLATION_LINES } from '@/constants/realStars/constellationLines'
import { SAMPLE_STARS, type ConstellationCard, type RealStar } from '@/constants/realStars'
import { parsePosition } from '../../lib/astro/coords'
import type { OverlayStar } from './free/ConstellationOverlay'

export interface ConstellationMembers {
  members: OverlayStar[]
  lines: ReadonlyArray<readonly [string, string]>
}

/**
 * 배정받은 별이 속한 별자리의 "모양을 보여줄 별들"을 만든다 — STEP 5-3
 * `FreeCaptureMode.tsx`가 쓰던 로직을 그대로 뽑아 둔 것이다(동작을 바꾸지
 * 않는 리팩터). "자유롭게 담기"와 "실제 별 찾기" 두 화면이 같은 함수를
 * 쓰기 때문에, 어떤 별을 어떻게 고르는지가 두 화면에서 갈라질 일이
 * 구조적으로 없다.
 *
 * 승인된 연결선이 있으면 그 선이 가리키는 별들을 그대로 쓴다(선의 양
 * 끝이 전부 화면에 그려지도록 보장하는 가장 단순한 방법 — 페가수스자리처럼
 * 다른 별자리 소속 별을 선이 참조하는 경우도 이렇게 자동으로 포함된다).
 * 아직 승인된 선이 없는 별자리는 `keyStarIds`만으로 점을 찍는다. 배정받은
 * 별이 그 목록 밖에도 있을 수 있으므로, 반드시 보이도록 따로 더한다
 * (중복 없이).
 */
export function buildConstellationMembers(star: RealStar, card: ConstellationCard | undefined): ConstellationMembers {
  const lines = card ? CONSTELLATION_LINES[card.id] ?? [] : []
  const lineIds = [...new Set(lines.flat())]
  const shapeIds = lineIds.length > 0 ? lineIds : card?.shape.keyStarIds ?? []
  const ids = shapeIds.includes(star.id) ? shapeIds : [...shapeIds, star.id]

  const members: OverlayStar[] = []
  for (const id of ids) {
    const s = SAMPLE_STARS.find((one) => one.id === id)
    if (!s) continue
    const position = parsePosition(s.astronomy.position)
    if (!position) continue // 못 읽으면 지어내지 않고 건너뛴다
    members.push({ id: s.id, name: s.name.korean, position, mine: s.id === star.id })
  }
  return { members, lines }
}
