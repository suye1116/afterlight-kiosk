import type { RealStar } from '@/constants/realStars'
import { hashString, makeRandom } from '@/lib/random'
import type { ScoreBreakdown } from './types'

/** 점수를 매긴 별 하나(순수 데이터 + 원본 별 객체). 테스트와 다음 단계가 함께 쓰기 좋게 둔다. */
export interface ScoredCandidate {
  star: RealStar
  scores: ScoreBreakdown
}

/**
 * 후보를 좁힌다 — "적합도가 낮은 별이 무작위로 배정되지 않도록".
 *
 * ─── 왜 필터가 아니라 문턱(threshold)인가 ──────────────
 *  계절·의미 점수는 아예 걸러내지 않는다(`score.ts`가 최저 0.2~0.3을
 *  주어 늘 살아 있게 한다). 그래서 "조건을 완화한다"는 말은 여기서는
 *  **1등 점수에 가까운 별만 후보로 남기다가, 그래도 모자라면 점차
 *  문턱을 낮추는 일**이 된다. 검증되지 않은 별을 들이는 일은 없다 —
 *  `pool.ts`가 애초에 그런 별을 넘겨주지 않는다.
 * ───────────────────────────────────────────────────────
 */
const RELAX_THRESHOLDS = [0.85, 0.7, 0.55, 0.4, 0] as const
const MIN_CANDIDATES = 2
const MAX_CANDIDATES = 12

/**
 * 점수가 완전히 같을 때, 어느 쪽을 앞에 둘지 — **배열에 먼저 적힌 별이
 * 아니라** 별 id를 씨앗으로 한 고정된 순서로 가른다.
 *
 * ─── 왜 이게 필요한가 — "겨울이면 늘 같은 별" 버그의 핵심 원인 ──
 *  `StarQuality`(아홉 가지)만으로 맺는 의미·감정 적합도는 소수의
 *  값으로만 떨어져서, 많은 별이 **점수가 완전히 같아진다.** 자바스크립트의
 *  `Array.prototype.sort`는 안정 정렬이라, 동점이면 원래 배열 순서
 *  (= `constants/realStars/stars.*.ts`에 적힌 순서)가 그대로 남는다.
 *  그래서 동점인 별이 여럿일 때 **늘 배열에서 먼저 나오는 별들만**
 *  (`MAX_CANDIDATES`로 자른 상위 몇 개 안에) 후보가 되고, 나머지는
 *  아무리 점수가 같아도 영영 후보에 들지 못했다 — "히아둠 1"처럼
 *  특정 별이 반복되는 현상의 실제 원인이다. 점수가 다르면(즉 실제로
 *  더 잘 맞으면) 이 tie-break는 전혀 끼어들지 않는다 — 오직 **완전히
 *  동점일 때만** 작동한다.
 * ───────────────────────────────────────────────────────
 */
function tieBreakKey(starId: string): number {
  return hashString(`${starId}:tie-break`)
}

/**
 * 점수를 매긴 별들 중 "충분히 잘 맞는" 상위 몇 개를 고른다.
 *
 * 1등 점수의 85% 이상만 먼저 본다. 그걸로 `MIN_CANDIDATES`(2)가 안 되면
 * 문턱을 70%, 55%, 40%, 마지막엔 0%(전부)까지 차례로 낮춘다 — 데이터가
 * 아주 치우쳐 1등 혼자만 압도적으로 높은 경우에도 후보가 완전히
 * 하나로 좁혀지지 않게 한다.
 */
export function pickCandidates(scored: readonly ScoredCandidate[]): ScoredCandidate[] {
  if (scored.length === 0) return []

  const sorted = [...scored].sort((a, b) => {
    const diff = b.scores.total - a.scores.total
    if (diff !== 0) return diff
    return tieBreakKey(a.star.id) - tieBreakKey(b.star.id)
  })
  const top = sorted[0].scores.total

  for (const ratio of RELAX_THRESHOLDS) {
    const kept = sorted.filter((c) => c.scores.total >= top * ratio)
    if (kept.length >= Math.min(MIN_CANDIDATES, sorted.length)) {
      return kept.slice(0, MAX_CANDIDATES)
    }
  }
  return sorted.slice(0, MAX_CANDIDATES)
}

/**
 * 후보 중 하나를 "무작위로" 뽑는다 — 단, 같은 기억은 언제 다시 뽑아도
 * 같은 결과가 나오도록 `memoryId`를 씨앗으로 쓴다.
 *
 * 이것은 §7("한 번 배정된 별은 유지")의 **두 번째 방어선**이다. 첫
 * 번째는 저장소(`storage.ts`)가 이미 있는 기록을 그대로 돌려주는 것이고,
 * 이 씨앗 고정은 저장 전에 같은 입력으로 두 번 계산해도(예: 테스트에서
 * 저장 없이 순수 함수만 두 번 부를 때) 결과가 흔들리지 않게 하는
 * 안전망이다.
 */
export function pickOne(candidates: readonly ScoredCandidate[], memoryId: string): ScoredCandidate {
  const random = makeRandom(hashString(`${memoryId}:real-star`))
  const index = Math.floor(random() * candidates.length)
  return candidates[Math.min(index, candidates.length - 1)]
}
