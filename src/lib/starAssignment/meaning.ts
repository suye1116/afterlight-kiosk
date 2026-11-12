import type { StarQuality } from '@/constants/realStars'
import type { MeaningAnalysis, MeaningTag } from './types'

/**
 * 기억 내용 분석 — 키워드·태그 기반.
 *
 * ─── AI가 아니다 ───────────────────────────────────────
 *  이 프로젝트에는 지금 실제로 쓸 수 있는 의미 분석 AI API가 없다.
 *  없는 것을 있는 척 구현하지 않는다 — 그래서 여기는 **글자를 그대로
 *  맞춰 보는 키워드 매칭**이다. 정교하지 않다는 것을 알고 쓴다.
 *
 *  "불확실하면 지어내지 않는다"는 원칙을 이렇게 지킨다.
 *    매칭되는 키워드가 없으면 `matched: []`를 돌려주고, 점수 계산
 *    (`score.ts`의 `meaningScore`)은 그 경우 **어느 별도 편들지 않는
 *    중립값**을 낸다 — 의미를 억지로 읽어 내지 않고, 대신 계절·간직
 *    흘려보내기·감정 세 가지가 배정을 더 많이 좌우하게 둔다.
 *
 *  나중에 실제 AI 분석으로 바꿀 때는 `analyzeMeaning`의 안(본문)만
 *  바꾸면 된다 — 타입(`MeaningAnalysis`)과 호출하는 쪽(`score.ts`)은
 *  그대로다.
 * ───────────────────────────────────────────────────────
 *
 * ─── "사랑"은 더 이상 함부로 짚히지 않는다 ───────────────
 *  예전에는 '함께'·'같이'·'우리'·'친구'·'가족'·'곁에' 같은, 사랑과
 *  무관한 아주 흔한 낱말까지 `relationship`(사랑과 관계) 하나로
 *  묶어서, 친구나 가족 이야기에도 "사랑과 관계의 결이 느껴졌다"는
 *  말이 나왔다. 그래서 `romance`(사랑과 연애) 키워드는 **연애 관계가
 *  명확한 낱말만** 받는다 — '연인'·'애인'·'남자친구'·'여자친구'·
 *  '첫사랑'·'짝사랑'·'사랑에 빠'·'고백'·'데이트'·'프로포즈'·'키스'
 *  처럼, 가족애·우정과 혼동될 수 없는 말만 둔다. 바로 '사랑'이라는
 *  낱말 하나만으로는(가족에게도 흔히 쓰는 말이라) 짚지 않는다.
 *
 *  '행복'·'설렜'·'그리워' 같은 **감정을 나타내는 말은 어떤 주제
 *  태그에도 없다** — 감정은 `score.ts`의 별도 축(`emotionScore`,
 *  관람객이 고른 7가지 마음)이 이미 담당하고 있고, 주제(이 파일)는
 *  오직 "무엇에 대한 기억인가"만 본다. 그래서 행복하다고 적었다고
 *  해서 곧바로 사랑이나 성취로 짚히는 일이 없다.
 * ───────────────────────────────────────────────────────
 */

/**
 * 각 주제에 걸리는 낱말들.
 *
 * 전부 흔히 쓰는 표현만 골랐다 — 활용형이 여럿인 말은 어간만 적어
 * 중복을 줄였다. 한 문장이 여러 주제에 걸릴 수 있다 — 막지 않는다.
 * (`reason.ts`가 그중 **가장 구체적인 것 하나**만 문장에 쓴다.)
 */
const MEANING_KEYWORDS: Record<MeaningTag, readonly string[]> = {
  romance: [
    '연인', '애인', '남자친구', '여자친구', '첫사랑', '짝사랑',
    '사랑에 빠', '사랑한다고', '고백했', '고백하', '데이트', '프로포즈', '키스',
  ],
  family: [
    '가족', '부모님', '엄마', '아빠', '어머니', '아버지',
    '할머니', '할아버지', '언니', '오빠', '누나', '형', '동생',
    '딸', '아들',
  ],
  friendship: ['친구', '우정', '동창', '절친', '단짝'],
  achievement: [
    '합격', '시험', '성공', '완성했', '이뤄냈', '달성', '졸업',
    '수상', '상을 받', '취업', '승진', '해냈',
  ],
  growth: [
    '도전', '용기', '맞섰', '버텼', '이겨냈', '극복', '뛰어들',
    '성장', '배웠', '깨달았', '달라졌', '자랐', '철이 들',
    '회복', '나아지', '다시 일어', '치유', '다시 웃',
  ],
  everyday: [
    '평범한', '평범했', '소소한', '별일 없이', '아무 이유 없이', '아무 생각 없이',
    '그냥 좋았', '일상',
  ],
  longing: ['그리워', '그리움', '보고 싶', '보고싶', '생각나', '생각난', '떠올라', '아직도', '그때가', '추억'],
  parting: [
    '이별', '헤어졌', '헤어진', '헤어지', '떠났', '떠나간', '떠나버',
    '마지막', '안녕', '끝났', '멀어졌', '후회', '아쉬웠', '아쉬운',
    '미안', '돌이키', '내려놓',
  ],
  comfort: ['위로', '괜찮아', '힘들었', '지쳤', '쉬고 싶', '토닥', '안아주', '불안했', '두려웠', '걱정'],
  newBeginning: ['시작', '처음', '새로운', '새로 ', '첫 ', '다짐', '출발'],
  /*
   * 바로 '혼자'·'홀로'만으로는 짚지 않는다 — 이별 뒤의 외로움("이별한
   * 뒤 혼자 걷던 밤")처럼 자유와는 반대의 뜻으로도 흔히 쓰이기 때문이다.
   * "혼자 여행/떠났다"처럼 **스스로 나아간 모양이 뚜렷한 구절만** 받는다.
   */
  freedom: ['자유로웠', '자유를', '독립', '스스로 선택', '혼자 여행', '혼자 떠났', '홀로 떠났'],
}

/**
 * 주제 하나가 어떤 실제 특징(`StarQuality`)과 어울리는가.
 *
 * `types.ts`의 `StarQuality` 설명과 같은 원칙을 따른다 — 하나의 질이
 * 여러 주제에 걸칠 수 있고, 일대일 대응을 피한다.
 */
export const MEANING_QUALITY_AFFINITY: Record<MeaningTag, readonly StarQuality[]> = {
  romance: ['companion'],
  family: ['companion', 'steady'],
  friendship: ['companion', 'cluster'],
  achievement: ['guide', 'steady'],
  growth: ['evolving', 'eclipsing'],
  everyday: ['steady', 'circumpolar'],
  longing: ['distant-past-light', 'guide'],
  parting: ['variable', 'eclipsing', 'distant-past-light'],
  comfort: ['steady', 'guide', 'circumpolar'],
  newBeginning: ['eclipsing', 'evolving'],
  freedom: ['distant-past-light', 'evolving'],
}

/** 대소문자를 가리지 않는 단순 부분 문자열 검사. 한국어엔 대소문자가 없으니 사실상 그대로 비교한다. */
function includesKeyword(text: string, keyword: string): boolean {
  return text.includes(keyword)
}

/**
 * 기억 한 문장에서 짚이는 주제를 찾는다.
 *
 * 글자 수가 아주 적어도(§12 "기억 내용이 매우 짧은 경우") 던지지 않는다
 * — 그냥 매칭되는 게 없을 뿐이고, 그 경우 `matched`가 비게 된다
 * ("기타 또는 판단하기 어려운 기억").
 */
export function analyzeMeaning(text: string): MeaningAnalysis {
  const body = text.trim()
  const matched: MeaningTag[] = []

  for (const tag of Object.keys(MEANING_KEYWORDS) as MeaningTag[]) {
    const hit = MEANING_KEYWORDS[tag].some((keyword) => includesKeyword(body, keyword))
    if (hit) matched.push(tag)
  }

  return { matched, textLength: body.length }
}
