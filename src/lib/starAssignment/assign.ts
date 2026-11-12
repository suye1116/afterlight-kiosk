import type { EmotionKey, MemoryType, RecordMode, Season } from '@/types'
import { DRAFT_CONSTELLATIONS, type RealStar } from '@/constants/realStars'
import type { AssignmentOutcome, AssignmentWeights, StoredAssignment } from './types'
import { DEFAULT_WEIGHTS } from './weights'
import { analyzeMeaning } from './meaning'
import { scoreStar } from './score'
import { VERIFIED_STARS } from './pool'
import { pickCandidates, pickOne, type ScoredCandidate } from './select'
import { getStoredAssignment, saveAssignment } from './storage'
import { toAssignedStarView } from './view'

/**
 * 관람객이 NOW에서 이미 적고 고른 것.
 *
 * `@/types`의 `UniverseStar`에서 이 배정에 필요한 네 가지만 뽑았다 —
 * `UniverseStar` 전체를 받지 않는 이유는, 이 함수가 "별이 어떻게
 * 생겼는지(x·y·seed·brightness)"까지 알 필요가 없기 때문이다. 그런
 * 것까지 받으면 이 함수가 기존 별 생성 로직(`lib/starMath.ts`)에
 * 암묵적으로 묶인다.
 */
export interface MemoryLike {
  /** `UniverseStar.id`. */
  id: string
  text: string
  emotion: EmotionKey
  /** 없으면(옛 기록) 'unknown'으로 본다. */
  season?: Season
  type: MemoryType
  /**
   * 기억을 적은 방식. 질문에 답하는 방식이면 `'prompt'`.
   *
   * 의미 분석(`analyzeMeaning`)에는 쓰이지 않는다 — 아래로 넘기는 `text`
   * (답한 내용 그 자체)만 분석한다. 이 값은 오직 '나의 별 이야기'가
   * "어떤 질문에 답했는지"를 밝히는 데만 쓴다(`reason.ts`).
   */
  recordMode?: RecordMode
  /** 질문 방식일 때, 실제로 답한 그 질문의 원문. 낱말이 주제 매칭에 섞이지 않는다. */
  promptQuestion?: string
}

/**
 * 기억 하나에 실제 별 하나를 배정한다. **멱등이다** — 이미 배정된
 * 기억이면 다시 뽑지 않고 그 결과를 그대로 돌려준다(§7).
 *
 * 실패는 예외로 던지지 않고 `{ ok: false, reason }`로 돌아온다(§6) —
 * 호출하는 쪽이 "배정이 안 됐다"를 평범한 분기로 다룰 수 있게 하기
 * 위해서다. 가짜 별을 만들어 끼워 넣는 길은 없다.
 *
 * `pool`은 기본값이 `VERIFIED_STARS`다 — 검사 스크립트가 "검증된 후보가
 * 하나도 없을 때"를 실제로 만들어 보려고 빈 배열을 넘길 수 있게
 * 열어 둔 것일 뿐, 평소 호출에서는 넘길 일이 없다.
 */
export function assignRealStar(
  memory: MemoryLike,
  weights: AssignmentWeights = DEFAULT_WEIGHTS,
  pool: readonly RealStar[] = VERIFIED_STARS,
): AssignmentOutcome {
  const existing = getStoredAssignment(memory.id)
  if (existing) {
    const view = toAssignedStarView(existing)
    if (view) return { ok: true, record: existing, view }
    // 저장은 되어 있는데 참조 데이터를 못 찾는, 있어서는 안 되는 경우다.
    return { ok: false, reason: 'constellation-not-found' }
  }

  if (pool.length === 0) {
    return { ok: false, reason: 'no-verified-stars' }
  }

  const season: Season = memory.season ?? 'unknown'
  /*
   * 의미 분석은 **오직 `memory.text`(실제로 적거나 답한 내용)만** 본다.
   * 질문 방식이어도 `memory.promptQuestion`은 여기 넘기지 않는다 — 질문에
   * 우연히 들어간 낱말로 경험이나 감정을 추측하지 않기 위해서다.
   */
  const meaning = analyzeMeaning(memory.text)
  const context = { season, type: memory.type, emotion: memory.emotion, meaningTags: meaning.matched }

  const scored: ScoredCandidate[] = pool.map((star) => ({
    star,
    scores: scoreStar(star, context, weights),
  }))
  const candidates = pickCandidates(scored)
  const chosen = pickOne(candidates, memory.id)

  const card = DRAFT_CONSTELLATIONS.find((c) => c.id === chosen.star.constellationId)
  if (!card) return { ok: false, reason: 'constellation-not-found' }

  const record: StoredAssignment = {
    version: 1,
    memoryId: memory.id,
    realStarId: chosen.star.id,
    season,
    type: memory.type,
    emotion: memory.emotion,
    meaningTags: meaning.matched,
    scores: chosen.scores,
    candidateCount: candidates.length,
    assignedAt: Date.now(),
    recordMode: memory.recordMode,
    promptQuestion: memory.promptQuestion,
  }
  const saved = saveAssignment(record)
  const view = toAssignedStarView(saved)
  if (!view) return { ok: false, reason: 'constellation-not-found' }

  return { ok: true, record: saved, view }
}

/**
 * 이미 배정된 별을 읽기만 한다 — **새로 배정하지 않는다.**
 *
 * 화면을 다시 열거나, 영수증을 다시 보거나, 기존 기록을 다시 열 때
 * 쓰는 자리다(§7). 아직 배정된 적이 없으면(또는 옛 기록처럼 애초에
 * 배정을 시도한 적이 없으면) `null`을 돌려준다 — 그것도 정상이다.
 */
export function getAssignedStar(memoryId: string) {
  const stored = getStoredAssignment(memoryId)
  if (!stored) return null
  return toAssignedStarView(stored)
}
