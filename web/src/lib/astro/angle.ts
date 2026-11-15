/**
 * 두 각도(0~360°) 사이의 최단 차이. 0°/360° 경계를 안전하게 넘는다.
 *
 * 양수면 `from`에서 시계방향(오른쪽)으로 돌아야 `target`과 만나고,
 * 음수면 반시계방향(왼쪽)으로 돌아야 만난다 — 방위각이 시계방향으로
 * 커지는(북0·동90·남180·서270) 나침반 기준과 그대로 맞는다.
 */
export function shortestAngleDiff(target: number, from: number): number {
  let diff = (target - from) % 360
  if (diff > 180) diff -= 360
  if (diff <= -180) diff += 360
  return diff
}

export type AlignmentTier = 'near' | 'slight' | 'far'
export type AlignmentDirection = 'left' | 'right' | 'centered'

const NEAR_DEG = 15
const SLIGHT_DEG = 45
/** 경계에서 안내가 자꾸 바뀌지 않도록, 지금 단계를 벗어날 때만 더 넓게 본다(히스테리시스). */
const EXIT_BUFFER_DEG = 5

function classify(absDiff: number): AlignmentTier {
  if (absDiff <= NEAR_DEG) return 'near'
  if (absDiff <= SLIGHT_DEG) return 'slight'
  return 'far'
}

/**
 * 지금 각도 차이로 "왼쪽/오른쪽/이 근처" 단계를 정한다 — 상태 없이,
 * 순수하게 각도 차이만 보고 결정하는 기본형. 히스테리시스가 필요하면
 * `nextAlignmentTier`를 쓴다.
 */
export function classifyAlignment(diff: number): { tier: AlignmentTier; direction: AlignmentDirection } {
  const tier = classify(Math.abs(diff))
  const direction: AlignmentDirection = tier === 'near' ? 'centered' : diff > 0 ? 'right' : 'left'
  return { tier, direction }
}

/**
 * 히스테리시스를 적용한 다음 단계. 지금 단계의 경계 바로 바깥(±5°)에서는
 * 그대로 머무르고, 그보다 확실히 벗어났을 때만 단계를 바꾼다 — 나침반이
 * 경계값 언저리에서 흔들려도 안내 문구가 깜빡이지 않는다.
 */
export function nextAlignmentTier(previous: AlignmentTier | null, diff: number): AlignmentTier {
  const absDiff = Math.abs(diff)
  if (previous === null) return classify(absDiff)

  if (previous === 'near') {
    return absDiff <= NEAR_DEG + EXIT_BUFFER_DEG ? 'near' : classify(absDiff)
  }
  if (previous === 'far') {
    return absDiff > SLIGHT_DEG - EXIT_BUFFER_DEG ? 'far' : classify(absDiff)
  }
  // previous === 'slight'
  if (absDiff <= NEAR_DEG - EXIT_BUFFER_DEG) return 'near'
  if (absDiff > SLIGHT_DEG + EXIT_BUFFER_DEG) return 'far'
  return 'slight'
}
