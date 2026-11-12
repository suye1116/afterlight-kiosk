import type { RealStar } from '@/constants/realStars'
import type { MeaningTag } from './types'

/**
 * 2순위 — 기억의 주제와 별 이름의 어원·상징적 해석의 연관성.
 *
 * ─── 무엇을 보는가 ─────────────────────────────────────
 *  `meaning.ts`가 **관람객이 적은 글**에서 키워드로 주제를 찾듯, 여기서는
 *  **별 쪽에 이미 적혀 있는 글**(`RealStar.name.etymology.meaning`·
 *  `RealStar.poetry.symbolism` — 둘 다 검증되었거나 미리 써 둔 것이다)
 *  에서 그 주제와 통하는 낱말이 있는지를 본다. 새로 지어내는 연결이
 *  아니라, **이미 있는 두 글이 실제로 겹치는가**를 재는 것이다.
 *
 *  아래 `ETYMOLOGY_RESONANCE_WORDS`는 "이 주제라면 별의 어원·상징
 *  글에 이런 낱말이 있을 때 더 잘 통한다"는 느슨한 참고 신호일 뿐,
 *  하나라도 안 걸리면 0이 되는 엄격한 분류가 아니다 — 못 찾아도 0.3
 *  (`meaningScore`·`emotionScore`가 쓰는 것과 같은 "완전히 배제하지
 *  않는다" 원칙), 짚인 주제가 없으면(`matched: []`) 어느 별도 편들지
 *  않는 중립값 0.5를 낸다.
 * ───────────────────────────────────────────────────────
 */
export const ETYMOLOGY_RESONANCE_WORDS: Record<MeaningTag, readonly string[]> = {
  romance: ['곁', '동행', '함께'],
  family: ['지키', '곁', '품', '함께'],
  friendship: ['나란히', '동행', '곁', '함께'],
  achievement: ['완성', '결실', '해내', '도약', '이뤄'],
  growth: ['변화', '달라지', '자라', '나아가', '이겨내'],
  everyday: ['한결같', '제자리', '조용히', '평온'],
  longing: ['오래전', '멀리', '지금에야', '그리운', '떠올라'],
  parting: ['끝', '마지막', '떠나', '보내'],
  comfort: ['품', '지키', '곁', '토닥'],
  newBeginning: ['시작', '첫', '도약', '새로운'],
  freedom: ['혼자', '스스로', '멀리', '자유'],
}

/** 별 쪽에서 어원·상징의 연관성을 찾아볼 글 — 검증된 어원 뜻 + 이미 써 둔 상징 문구. */
function resonanceText(star: RealStar): string {
  return `${star.poetry.symbolism} ${star.name.etymology?.meaning ?? ''}`
}

export function etymologyScore(star: RealStar, tags: readonly MeaningTag[]): number {
  // 짚인 주제가 없으면("기타 또는 판단하기 어려운 기억") 어느 별도 편들지 않는 중립값.
  if (tags.length === 0) return 0.5

  const words = [...new Set(tags.flatMap((tag) => ETYMOLOGY_RESONANCE_WORDS[tag]))]
  if (words.length === 0) return 0.5

  const text = resonanceText(star)
  const matched = words.filter((word) => text.includes(word)).length

  /*
   * 주제가 있는데 **하나도 안 통하면** 0.3 — 완전히 배제하지는 않는다
   * (다른 조건이 강하게 이 별을 가리키면 그래도 후보일 수 있다).
   *
   * **단 하나라도 통하면 중립값(0.5)보다 높아야 한다** — "주제와 통하는
   * 낱말을 실제로 찾았다"는 것이 "애초에 주제가 없어 아무것도 모른다"는
   * 것보다 더 강한 신호이기 때문이다. 그래서 0.5에서 시작해 걸린
   * 비율만큼 1.0까지 올라간다.
   */
  if (matched === 0) return 0.3
  const ratio = matched / words.length
  return 0.5 + ratio * 0.5
}
