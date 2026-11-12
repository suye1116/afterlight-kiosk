import { SAMPLE_STARS, type RealStar } from '@/constants/realStars'

/**
 * 배정 대상이 될 수 있는 별 — **검증 완료(verified)된 것만.**
 *
 * §1의 요청대로, `astronomy.verification`이 'needs-verification'인
 * 별(지금 6개 — 플레이아데스 자매 다섯과 플레이오네)은 여기서 걸러진다.
 * 배정 알고리즘의 어떤 단계도 이 목록 바깥의 별을 보지 않는다 —
 * `select.ts`의 후보 완화도 이 안에서만 일어난다.
 */
export const VERIFIED_STARS: readonly RealStar[] = SAMPLE_STARS.filter(
  (star) => star.astronomy.verification === 'verified',
)
