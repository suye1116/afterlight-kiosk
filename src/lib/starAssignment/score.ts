import type { EmotionKey, MemoryType, Season } from '@/types'
import type { RealStar, StarQuality } from '@/constants/realStars'
import type { AssignmentWeights, MeaningTag, ScoreBreakdown } from './types'
import { MEANING_QUALITY_AFFINITY } from './meaning'
import { etymologyScore } from './etymology'

/**
 * 네 조건의 점수 — 전부 0~1로 정규화한다.
 *
 * §6이 요구한 "같은 점수 범위로 정규화"를 이렇게 지킨다. 가중합
 * (`scoreStar`)이 그대로 0~1이 되도록, 각 조건 함수는 절대 이 범위를
 * 벗어나지 않는다.
 */

/**
 * 계절 적합도.
 *
 *   '모르겠어요'(season이 'unknown') — 계절로 가르지 않는다. 모두 1.
 *   고른 계절이 그 별의 관측 계절에 들어있다 — 1.
 *   들어있지 않다 — 0.3.
 *
 * 0이 아니라 0.3인 이유: §3이 "여러 계절에 걸쳐 보이는 별도 후보가 될 수
 * 있다"고 했고, 계절이 안 맞는다고 그 별을 영영 못 받게 하면 다른 세
 * 조건(간직/흘려보내기·의미·감정)이 아주 잘 맞는 별을 계절 하나로
 * 떨어뜨리게 된다. 0.3은 "맞는 별에 밀리지만, 완전히 배제되지는 않는다"
 * 는 뜻이다.
 */
export function seasonScore(star: RealStar, season: Season): number {
  if (season === 'unknown') return 1
  return star.astronomy.bestSeasonKR.includes(season) ? 1 : 0.3
}

/**
 * 간직하기 / 흘려보내기 적합도.
 *
 *   별의 결(`comfortDirection`)이 고른 것과 **정확히 같다** — 1.
 *   별이 'either'(둘 다 어울린다) — 0.75. 꽉 들어맞는 별보다는 낮지만,
 *     반대쪽보다는 훨씬 높다 — "같은 별이 양쪽에 다 어울릴 수 있다"는
 *     §4·§6의 원칙을 점수로 나타낸 값이다.
 *   반대 결 — 0.2. 0이 아닌 이유는 seasonScore와 같다 — 다른 조건이
 *     압도적으로 좋으면 그 별도 여전히 후보일 수 있어야 한다.
 */
export function comfortScore(star: RealStar, type: MemoryType): number {
  const direction = star.poetry.comfortDirection
  if (direction === type) return 1
  if (direction === 'either') return 0.75
  return 0.2
}

/**
 * 하나의 질 목록이 다른 질 목록과 얼마나 겹치는가.
 *
 * `affinity`가 비어 있으면(그 감정·의미에 딱히 바이어스를 주지 않기로
 * 한 경우 — 예: '기타' 감정) 중립값 0.5를 낸다. 하나도 안 겹치면 0.2
 * (완전히 0은 아니다 — comfortScore와 같은 이유), 전부 겹치면 1.
 */
function affinityOverlap(starQualities: readonly StarQuality[], affinity: readonly StarQuality[]): number {
  if (affinity.length === 0) return 0.5
  const matched = affinity.filter((q) => starQualities.includes(q)).length
  const ratio = matched / affinity.length
  return 0.2 + ratio * 0.8
}

/**
 * 감정 적합도.
 *
 * 일곱 마음이 각자 어떤 실제 특징(`StarQuality`)에 가까운지를 미리
 * 정해 두고, 그 별이 가진 특징과 겹치는 만큼 점수를 준다.
 *
 * ─── 획일적으로 흐르지 않는 이유 ───────────────────────
 *  '슬픔'이라고 전부 어두운 별이 되지 않는다. 같은 '슬픔'이어도 별마다
 *  가진 질이 달라서(예: `evolving`만 가진 별과 `distant-past-light`만
 *  가진 별은 둘 다 '슬픔'과 어느 정도 맞지만 서로 다른 별이다), 그리고
 *  이 점수는 전체의 15%일 뿐이라 의미(40%)·간직흘려보내기(25%)·계절
 *  (20%)이 함께 갈라 놓는다(`weights.ts`). '기타'는 affinity를 비워 둬서
 *  아예 바이어스가 없다 — 이름 붙지 않은 마음에 억지로 색을 입히지
 *  않는다는 원작의 뜻(`constants/emotions.ts`)과 같은 결이다.
 * ───────────────────────────────────────────────────────
 */
export const EMOTION_QUALITY_AFFINITY: Record<string, readonly StarQuality[]> = {
  happy: ['steady', 'companion', 'cluster'],
  flutter: ['companion', 'variable'],
  calm: ['steady', 'circumpolar'],
  anxious: ['variable', 'eclipsing'],
  numb: ['distant-past-light', 'evolving'],
  sad: ['evolving', 'distant-past-light', 'variable'],
  other: [],
}

export function emotionScore(star: RealStar, emotion: EmotionKey): number {
  const affinity = EMOTION_QUALITY_AFFINITY[emotion] ?? []
  return affinityOverlap(star.poetry.qualities, affinity)
}

/**
 * 기억 내용과의 의미 적합도.
 *
 * `analyzeMeaning`(`meaning.ts`)이 찾아낸 의미들의 어울리는 특징을
 * 모두 모아 겹침을 본다. **짚인 의미가 하나도 없으면 0.5로, 모든 별에
 * 똑같이 준다** — 가중합에서 상수를 더하는 것과 같아서 순위를 전혀
 * 바꾸지 않는다. 이것이 §5가 요청한 "내용 분석이 불확실하면 감정·계절·
 * 선택에 맡긴다"를 셈으로 옮긴 자리다.
 */
export function meaningScore(star: RealStar, tags: readonly MeaningTag[]): number {
  if (tags.length === 0) return 0.5
  const affinity = [...new Set(tags.flatMap((tag) => MEANING_QUALITY_AFFINITY[tag]))]
  return affinityOverlap(star.poetry.qualities, affinity)
}

/** 다섯 점수를 가중합해 총점을 낸다. 다섯 조건 모두 0~1이므로 가중치의 합이 1이면 총점도 0~1이다. */
export function scoreStar(
  star: RealStar,
  context: { season: Season; type: MemoryType; emotion: EmotionKey; meaningTags: readonly MeaningTag[] },
  weights: AssignmentWeights,
): ScoreBreakdown {
  const season = seasonScore(star, context.season)
  const comfort = comfortScore(star, context.type)
  const meaning = meaningScore(star, context.meaningTags)
  const emotion = emotionScore(star, context.emotion)
  const etymology = etymologyScore(star, context.meaningTags)
  const total =
    season * weights.season +
    comfort * weights.comfort +
    meaning * weights.meaning +
    emotion * weights.emotion +
    etymology * weights.etymology
  return { season, comfort, meaning, emotion, etymology, total }
}
