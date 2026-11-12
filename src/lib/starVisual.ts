/**
 * 실제 별의 색을 화면의 빛으로.
 *
 * ─── 지어내지 않는다 ───────────────────────────────────
 *  `constants/realStars`의 `astronomy.colorDescription`(검증된 사실,
 *  예: '청백색 (초거성)', '붉은빛 (적색초거성)')에 적힌 낱말만 보고
 *  색을 고른다. 분광형을 직접 계산해 색을 뽑는 정교한 일은 하지 않는다 —
 *  그 별 데이터를 쓸 때 이미 사람이 "무슨 색"이라고 말로 적어 두었으므로,
 *  그 말을 다시 읽는 것으로 충분하다.
 *
 *  **색 정보가 없거나(아주 드문 경우) 낱말이 안 걸리면, 원작의 기본
 *  별빛(크림~앰버)으로 돌아간다.** 없는 사실을 지어내 색을 매기지 않는다.
 * ───────────────────────────────────────────────────────
 *
 * ─── 키오스크 하늘에는 더 이상 쓰이지 않는다 ────────────────
 *  한때 이 파일에는 감정색과 실제 별의 색·밝기를 섞어 캔버스·감상
 *  화면에 함께 쓰는 `resolveStarVisual`이 있었다. 여러 시제품을 본
 *  뒤, "처음 사용했던 감정 중심 디자인이 더 잘 어울린다"고 결정되어
 *  그 함수는 지웠다 — 키오스크의 별은 다시 **감정만으로** 색이
 *  정해진다(`canvas/skyEngine.ts`·`scenes/StarShowcase.tsx`).
 *
 *  이 파일 자체는 지우지 않았다 — `colorFromDescription`은 지금도
 *  '나의 별' 화면(`scenes/SceneYourStar.tsx`)에서 **그 사람 한 명의
 *  별 소개**에 쓰인다. 그 화면은 "지금 보고 있는 게 실제로 그 별의
 *  색"이라고 분명히 말하는 자리라 원래부터 감정과 섞지 않았다 — 이번
 *  결정과 무관하게 그대로 둔다.
 * ───────────────────────────────────────────────────────
 */

export interface StarLight {
  core: string
  halo: string
  trail: string
}

/** 원작의 기본 별빛. tokens.css의 --cream · --amber-300 · --amber-400과 같은 값이다. */
export const DEFAULT_STAR_LIGHT: StarLight = {
  core: '#fff8e9',
  halo: '#efc188',
  trail: '#d3945a',
}

const PALETTE: ReadonlyArray<{ match: readonly string[]; light: StarLight }> = [
  {
    // 적색 계열
    match: ['붉은'],
    light: { core: '#ffd7c4', halo: '#c85a3e', trail: '#7a3526' },
  },
  {
    // 청색 · 청백색 계열
    match: ['청백', '푸른', '청색'],
    light: { core: '#eaf1ff', halo: '#5f86c9', trail: '#3a5272' },
  },
  {
    // 주황색 계열
    match: ['주황'],
    light: { core: '#ffe3bc', halo: '#dd8f49', trail: '#8a5a2c' },
  },
  {
    // 황색 · 금색 계열
    match: ['노란', '금빛'],
    light: { core: '#fff3cc', halo: '#d8b65e', trail: '#8a7036' },
  },
  {
    // 백색 계열
    match: ['흰빛', '백색'],
    light: { core: '#fffdf7', halo: '#cdd3da', trail: '#8b9097' },
  },
]

/**
 * 색 서술에서 화면에 쓸 세 겹의 빛을 고른다.
 *
 * 쌍성처럼 색 서술이 둘 이상 겹치는 경우(예: '금빛과 청백색의 쌍성')는
 * 위 목록에서 **먼저 걸리는 쪽 하나**를 쓴다 — 두 색을 섞으면 오히려
 * 실제로 보이는 색과 멀어진다. 어느 쪽도 안 걸리면 기본 별빛이다.
 */
export function colorFromDescription(description: string | null | undefined): StarLight {
  const text = description ?? ''
  for (const { match, light } of PALETTE) {
    if (match.some((word) => text.includes(word))) return light
  }
  return DEFAULT_STAR_LIGHT
}
