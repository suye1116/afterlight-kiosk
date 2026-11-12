/**
 * 실제 별 배정 — 바깥으로 내보내는 자리.
 *
 * 아직 어떤 화면도, 어떤 전송 로직도 이 모듈을 import하지 않는다.
 * `scripts/check.starAssignment.ts`가 직접 불러 돌려 본다. '나의 별을
 * 만나는 화면'이 다음 단계에서 이 자리를 불러 쓰면 된다 —
 * `assignRealStar`로 배정하고(이미 배정됐으면 그대로 돌아온다),
 * `getAssignedStar`로 다시 열어 보면 된다.
 */
export { assignRealStar, getAssignedStar, type MemoryLike } from './assign'
export { DEFAULT_WEIGHTS, sumOf } from './weights'
export { analyzeMeaning, MEANING_QUALITY_AFFINITY } from './meaning'
export { etymologyScore, ETYMOLOGY_RESONANCE_WORDS } from './etymology'
export {
  seasonScore,
  comfortScore,
  meaningScore,
  emotionScore,
  scoreStar,
  EMOTION_QUALITY_AFFINITY,
} from './score'
export { pickCandidates, pickOne, type ScoredCandidate } from './select'
export { buildAssignmentReason } from './reason'
export { buildComfortMessage } from './comfort'
export { getStoredAssignment, saveAssignment } from './storage'
export { toAssignedStarView } from './view'
export { VERIFIED_STARS } from './pool'
export { starLookupUrl } from '@/lib/starLookup'
export type {
  AssignedStarView,
  AssignmentOutcome,
  AssignmentWeights,
  MeaningAnalysis,
  MeaningTag,
  MemoryContext,
  ScoreBreakdown,
  ScoredStar,
  StoredAssignment,
} from './types'
export { MEANING_TAG_LABEL } from './types'
