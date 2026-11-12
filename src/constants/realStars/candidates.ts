import type { StarCandidate } from './types'

/**
 * 검증하다가 막힌 이름 — 억지로 끼워 넣지 않은 자리.
 *
 * ─── 왜 여기 하나만 남았는가 ───────────────────────────
 *  지난 단계에 있던 40개의 후보 이름 중 39개는 이번 단계에서 거리·
 *  겉보기 밝기·분광형·적경·적위를 다시 확인해 `stars.ts`로 옮겼다
 *  (정밀 좌표나 밝기 수치가 끝내 안 잡힌 6개는 `verification:
 *  'needs-verification'`을 달아 그대로 옮겼다 — 완전히 모른다기보다
 *  "무엇을 더 봐야 하는지가 분명한" 경우였기 때문이다).
 *
 *  이 별 하나만은 그렇게 하지 않았다. 검색 결과가 **서로 다른 두 별을
 *  가리키는 것처럼 어긋났기 때문이다**:
 *
 *    "Veritate" = "14 Andromedae" 라는 결과 — 겉보기 밝기 5.22,
 *      거리 248광년
 *    "Upsilon Andromedae"(입실론 안드로메다자리) 라는 결과 — 겉보기
 *      밝기 4.10, 거리 44광년, 적경/적위도 전혀 다름
 *
 *  "Veritate"는 2015년 IAU의 NameExoWorlds 캠페인에서 입실론
 *  안드로메다자리(외계행성을 가진 별로 유명하다)에 붙은 이름으로
 *  알고 있었는데, 검색이 그것을 "14 Andromedae"라는 다른 별과
 *  섞어 설명했다 — 플램스티드 번호를 34로 알던 것과도 어긋난다.
 *  어느 쪽이 맞는지 이 단계의 검색만으로는 가려낼 수 없었다.
 *
 *  **80개를 채우는 데 이 별이 필요하지 않았다**(검증 완료가 이미
 *  84개다). 그래서 숫자를 맞추려고 아무 쪽이나 골라 적지 않고,
 *  이름이 가리키는 실제 별이 무엇인지부터 다시 확인해야 하는
 *  상태로 남겨 둔다.
 * ───────────────────────────────────────────────────────
 */
export const CANDIDATE_STARS: readonly StarCandidate[] = [
  {
    properName: 'Veritate',
    designation: 'Upsilon Andromedae (추정) — "14 Andromedae"라는 자료와 상충',
    constellationId: 'rc-andromeda',
    note:
      '검색 자료가 "Veritate = 14 Andromedae"(5.22등급, 248광년)와 "Upsilon Andromedae"' +
      '(4.10등급, 44광년, 전혀 다른 적경/적위)를 서로 다르게 설명했다. 어느 쪽이 실제 ' +
      '"Veritate"인지 SIMBAD 또는 IAU WGSN의 공식 목록으로 다시 확인해야 한다. ' +
      '확인 전에는 distance·magnitude·position 중 어떤 값도 verified로 쓰지 않는다.',
  },
] as const

/**
 * 지금까지 검증을 마친 수.
 *
 *   SAMPLE_STARS.length === 90 (84 verified + 6 needs-verification)
 *   CANDIDATE_STARS.length === 1 (이름의 정체부터 다시 확인해야 하는 별)
 *
 * 80개 목표는 이미 채워졌다 — 이 목록이 남아 있는 것은 "더 채워야 해서"가
 * 아니라 "확인되지 않은 것을 확인된 것처럼 적지 않기 위해서"다.
 */
export const CANDIDATE_COUNT_NOTE =
  '검증 완료 90개(verified 84 + needs-verification 6) + 정체가 상충해 보류한 후보 1개. ' +
  '80개 목표는 이미 채웠으며, 보류된 후보는 숫자를 채우기 위해서가 아니라 ' +
  '정직하게 남겨 둔 미해결 항목이다.'
