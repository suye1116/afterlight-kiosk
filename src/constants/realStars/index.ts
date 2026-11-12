/**
 * 실제 별 / 실제 별자리 — 바깥으로 내보내는 자리.
 *
 * 이 폴더는 아직 어디에도 연결되지 않았다. `App.tsx`도, `useKiosk`도,
 * 어떤 화면도 이 모듈을 import하지 않는다 — 배정 알고리즘과 새 화면은
 * 다음 단계의 일이다. 지금은 타입과 검증된 데이터만 준비해 둔다.
 */
export type {
  ConstellationCard,
  ConstellationShape,
  Distance,
  ObservableSeason,
  ObservationInfo,
  RealConstellationId,
  RealStar,
  RealStarAstronomy,
  RealStarLookup,
  RealStarName,
  RealStarPoetry,
  SkyPosition,
  SourceRef,
  StarCandidate,
  StarComfortDirection,
  StarQuality,
  VerificationStatus,
} from './types'
export { REAL_CONSTELLATION_IDS } from './types'

export { DRAFT_CONSTELLATIONS } from './constellations'
export { SAMPLE_STARS, WINTER_STARS, SPRING_STARS, SUMMER_STARS, AUTUMN_STARS } from './stars'
export { CANDIDATE_STARS, CANDIDATE_COUNT_NOTE } from './candidates'
