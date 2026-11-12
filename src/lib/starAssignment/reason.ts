import type { RealStar } from '@/constants/realStars'
import type { RecordMode } from '@/types'
import type { MemoryContext, MeaningTag } from './types'

/**
 * "왜 이 별인가" — '나의 별 이야기'의 본문.
 *
 * ─── 전면 개편 ──────────────────────────────────────────
 *  예전에는 실제로 셈에 쓴 조건(계절·간직흘려보내기·감정·의미 키워드)을
 *  하나씩 문장으로 만들어 이어 붙였다. 그중 의미 키워드 문장이 특히
 *  문제였다 — `relationship`(옛 태그, '사랑과 관계')이 '함께'·'같이'·
 *  '친구'·'가족' 같은 흔한 말까지 받아서, 사랑과 무관한 기억에도
 *  "사랑과 관계의 결이 느껴졌다"는 말이 반복해 나왔다.
 *
 *  이제는 늘 **두 문장**이다(길어도 셋을 넘지 않는다).
 *    ① 이 별의 이름(또는 실제 특징)이 무엇을 뜻하는가
 *    ② 그 뜻이 당신이 적은 기억의 **주제**(`meaning.ts`가 키워드로
 *       짚은 것)와 어떻게 닿는지, 그리고 왜 이 별을 전하는지
 *
 *  ①은 `RealStarName.etymology`(검증된 어원)가 있으면 그 뜻을 그대로
 *  쓰고, 없으면 그 별 자신의 소개 문장(`poetry.assignmentReason`,
 *  이미 검증된 실제 특징에 근거해 미리 써 둔 것)으로 대신한다 — 둘
 *  다 지어내지 않는다. ②는 `meaning.ts`가 **실제로 짚은 주제**에만
 *  대응하는 문장을 쓴다 — 아무 주제도 안 짚였으면("기타 또는 판단
 *  하기 어려운 기억") 특정 주제를 지어내 말하지 않는다.
 *
 *  고르신 계절이 그 별의 관측 계절과 **실제로 맞을 때만** ①의 앞에
 *  살며시 끼워 넣는다("겨울에 뜨는 ○○의 이름에는…") — 맞지 않는데
 *  맞는 척하지 않는다.
 *
 *  이 글은 **저장되지 않는다** — `record.ts`가 저장해 둔 적은 정보로
 *  읽을 때마다 다시 짓는다.
 * ───────────────────────────────────────────────────────
 */

const SEASON_PREFIX: Record<string, string> = {
  spring: '봄에',
  summer: '여름에',
  autumn: '가을에',
  winter: '겨울에',
}

function seasonMatched(star: RealStar, season: MemoryContext['season']): boolean {
  if (season === 'unknown') return false
  return star.astronomy.bestSeasonKR.includes(season)
}

/**
 * 받침이 있는 글자로 끝나는가.
 *
 * 괄호·따옴표처럼 한글이 아닌 글자로 끝나는 말도 있어("…정강이)")
 * 끝에서부터 한글 음절을 찾아 그 글자의 받침을 본다. 한글이 아니면
 * 보수적으로 받침이 있다고 본다(아래 조사들 모두 "있다" 쪽이 더
 * 흔한 모양이라 더 안전한 쪽을 고른다).
 */
function hasBatchim(word: string): boolean {
  const match = /[가-힣](?=[^가-힣]*$)/.exec(word)
  if (!match) return true
  const code = match[0].codePointAt(0) ?? 0
  return (code - 0xac00) % 28 !== 0
}

/** 받침 유무에 따라 "이라는"/"라는"을 고른다. */
function withEuiJosa(word: string): string {
  return hasBatchim(word) ? '이라는' : '라는'
}

/** 받침 유무에 따라 "이에요"/"예요"를 고른다. 같은 받침 규칙이다. */
function withIeyoJosa(word: string): string {
  return hasBatchim(word) ? '이에요' : '예요'
}

/**
 * 첫 문장 — 이 별의 이름 또는 실제 특징이 무엇을 뜻하는가.
 *
 * 검증된 어원이 있으면 그 뜻을 그대로 쓴다. 없으면(여러 해석이
 * 엇갈리거나 유래가 알려지지 않은 별 — `null`) 그 별 자신의 소개
 * 문장으로 대신한다. 둘 다 이미 검증되었거나 미리 써 둔 것이라,
 * 여기서 새로 지어내는 말은 없다.
 */
function nameClause(star: RealStar, season: MemoryContext['season']): string {
  const prefix = seasonMatched(star, season) ? `${SEASON_PREFIX[season as string]} 뜨는 ` : ''
  const { etymology } = star.name

  if (etymology) {
    return `${prefix}${star.name.korean}의 이름에는 '${etymology.meaning}'${withEuiJosa(etymology.meaning)} 뜻이 담겨 있어요.`
  }
  // 어원이 불분명한 별은 그 별 자신의 소개 문장(이미 실제 특징에 근거해 미리 써 둔 것)으로 대신한다.
  // `prefix`는 이미 끝에 띄어쓰기를 담고 있다("겨울에 뜨는 ") — 여기서 또 붙이면 띄어쓰기가 두 번 겹친다.
  return `${prefix}${star.poetry.assignmentReason}`
}

/**
 * 둘째 문장 — 그 뜻이 당신이 적은 기억의 주제와 어떻게 닿는지,
 * 그리고 왜 이 별을 전하는지. **실제로 짚인 주제에만** 대응한다.
 */
const TOPIC_CLAUSE: Record<MeaningTag, string> = {
  romance: '그 사람과의 기억을 닮은, 이 별을 전합니다.',
  family: '소중한 가족과의 기억을 닮은, 이 별을 전합니다.',
  friendship: '친구와 나눈 편안한 기억을 닮은, 이 별을 전합니다.',
  achievement: '오랜 시간 쌓아 온 노력이 결실을 맺었던 당신에게, 이 별을 전합니다.',
  growth: '어려움을 이겨내며 나아갔던 당신의 시간을 닮은 별이에요.',
  everyday: '특별한 일 없이도 충분했던 그날의 평온을 닮은 별이에요.',
  longing: '자꾸 떠오르는 그리운 기억을 품은 당신에게, 이 별을 전합니다.',
  parting: '마음에 남은 아쉬움까지도 보내 주려는 당신에게, 이 별을 전합니다.',
  comfort: '힘들었던 마음을 다독이고 싶은 당신에게, 이 별을 전합니다.',
  newBeginning: '새로운 시작 앞에 섰던 당신의 순간을 닮은 별이에요.',
  freedom: '두려움 속에서도 스스로 나아가기로 했던 당신의 순간을 닮은 별이에요.',
}

/** 짚인 주제가 여럿이면, 더 구체적인 것을 앞세운다(흔한 감정 낱말로도 걸리는 주제를 뒤로 둔다). */
const TOPIC_PRIORITY: readonly MeaningTag[] = [
  'romance', 'family', 'friendship', 'achievement',
  'growth', 'freedom', 'newBeginning', 'parting', 'longing', 'comfort', 'everyday',
]

function primaryTopic(tags: readonly MeaningTag[]): MeaningTag | null {
  for (const tag of TOPIC_PRIORITY) {
    if (tags.includes(tag)) return tag
  }
  return null
}

function meaningClause(tags: readonly MeaningTag[]): string {
  const topic = primaryTopic(tags)
  // 아무 주제도 안 짚였으면("기타 또는 판단하기 어려운 기억") 특정 주제를 지어내지 않는다.
  if (!topic) return '당신이 적어 주신 그 마음을 닮은 별이에요.'
  return TOPIC_CLAUSE[topic]
}

/**
 * 셋째 문장 — 이 별만의 상징적 의미(`poetry.symbolism`)를 그대로 들려준다.
 *
 * ─── 왜 더하는가 ───────────────────────────────────────
 *  `meaningClause`(둘째 문장)는 **주제별**로 짓는 문장이라, 같은 주제로
 *  묶이는 여러 별이 그 문장을 그대로 나눠 쓴다(예: '그리움'으로 짚힌
 *  별 10여 개가 전부 같은 둘째 문장을 받는다). 반면 `poetry.symbolism`은
 *  **별 하나마다** 따로 써 둔, 다른 별과 겹치지 않는 한 줄이다
 *  (`constants/realStars/stars.*.ts`, 90개 모두 서로 다르다). 이 문장을
 *  더하면 "같은 주제라도 결국 나만의 별 이야기"가 된다 — 지어내는 것이
 *  아니라, 이미 있는데 지금까지 어느 화면에도 쓰이지 않던 데이터를
 *  마지막으로 들려주는 것이다.
 *
 *  질문에 답하는 방식이었으면 앞에 그 질문을 그대로 인용해 연다 — "이
 *  질문을 보고 답하셨다"는 사실을 확인해 주는 자리다. 질문의 **낱말**로
 *  무엇을 짚지는 않는다(그 일은 여기서 하지 않는다) — 그래서 이 문장은
 *  늘 같은 모양("~라는 질문에 답하며 들려주신 마음처럼, …")이고, 어떤
 *  구체적 사건도 지어내 덧붙이지 않는다.
 * ───────────────────────────────────────────────────────
 */
function symbolismClause(
  star: RealStar,
  recordMode: RecordMode | undefined,
  promptQuestion: string | undefined,
): string {
  const { symbolism } = star.poetry
  const body = `이 별은 '${symbolism}'${withIeyoJosa(symbolism)}.`
  if (recordMode !== 'prompt' || !promptQuestion) return body
  return `'${promptQuestion}'라는 질문에 답하며 들려주신 마음처럼, ${body}`
}

export function buildAssignmentReason(
  star: RealStar,
  context: Pick<MemoryContext, 'season' | 'type' | 'emotion' | 'recordMode' | 'promptQuestion'>,
  meaningTags: readonly MeaningTag[],
): string {
  const first = nameClause(star, context.season)
  const second = meaningClause(meaningTags)
  const third = symbolismClause(star, context.recordMode, context.promptQuestion)
  return `${first} ${second} ${third}`
}
