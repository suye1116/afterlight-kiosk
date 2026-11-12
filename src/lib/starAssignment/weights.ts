import type { AssignmentWeights } from './types'

/**
 * 다섯 조건의 가중치 — 초기값.
 *
 * ─── 다시 조정했다 — 요청받은 우선순위 그대로 ────────────
 *  관람객이 실제로 요청한 순서를 가중치로 그대로 옮긴다.
 *
 *    1순위 meaning(.35)    — 실제로 적거나 답한 내용의 핵심 의미
 *    2순위 etymology(.25)  — 그 주제와 별 이름의 어원·상징적 해석의 연관성
 *    3순위 emotion(.18)    — 고른 감정
 *    4순위 comfort(.13)    — 간직하기 / 흘려보내기
 *    5순위 season(.09)     — 계절
 *
 *  **계절은 더 이상 후보를 좌우하는 절대 조건이 아니다.** 이전 비율
 *  (계절 20%)은 "안 맞으면 0.3"이라는 `seasonScore`의 폭(0.2~0.2 차이)이
 *  다른 조건보다 쉽게 동점을 만들어 냈고, 그 동점이 늘 같은 몇몇 별
 *  (배열에서 먼저 나오는 별)에게로 쏠리는 문제(§"하이둠1만 나온다")로
 *  이어졌다. 계절 비중을 가장 낮춰도 `seasonScore`는 여전히 0보다 크므로
 *  (완전 배제 없음) 계절이 맞는 별이 여전히 유리하지만, 기억의 내용이나
 *  어원·감정이 뚜렷하게 더 잘 맞는 별이 있으면 그 별이 이긴다.
 *
 *  **여기 한 곳만 바꾸면 전체 배정이 바뀐다** — `scoreStar`(`score.ts`)가
 *  이 상수를 기본값으로 받고, 호출하는 쪽이 다른 값을 넘기면 그 값을 쓴다.
 *  합이 1이 아니어도 셈은 되지만(가중합이니까), 점수의 뜻이 "0~1"에서
 *  벗어나므로 바꿀 때는 합을 1로 맞추는 것을 권한다.
 */
export const DEFAULT_WEIGHTS: AssignmentWeights = {
  meaning: 0.35,
  etymology: 0.25,
  emotion: 0.18,
  comfort: 0.13,
  season: 0.09,
}

export function sumOf(weights: AssignmentWeights): number {
  return weights.season + weights.comfort + weights.meaning + weights.emotion + weights.etymology
}
