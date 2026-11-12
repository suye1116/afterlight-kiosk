import type { EmotionKey, MemoryType, RecordMode, Season } from '@/types'
import type { ObservableSeason, RealConstellationId } from '@/constants/realStars'

/**
 * 실제 별 배정 — 타입만.
 *
 * ─── 이 폴더가 하는 일 ─────────────────────────────────
 *  관람객이 NOW에서 이미 적고 고른 것(`UniverseStar`의 일부 필드)을 읽어,
 *  `constants/realStars`의 검증된 별 중 하나에 연결한다. 새 화면도,
 *  기존 전송 흐름에 거는 일도 이번 단계에는 없다 — 여기 있는 함수들은
 *  **아직 어디에서도 호출되지 않는다.** `scripts/check.starAssignment.ts`가
 *  직접 불러 돌려 본다.
 *
 *  기존 두 체계를 "읽기만" 한다.
 *    `@/types`               — 관람객이 적은 것(기억·감정·계절·간직/흘려보내기)
 *    `@/constants/realStars`  — 검증된 실제 별 데이터
 *  둘 다 이 폴더가 가져다 쓰지만, 거꾸로 이 폴더를 가져다 쓰는 기존
 *  파일은 없다 — 그래서 "독립적"이다. 기존 로직(별 생성, 좌표, 작품 속
 *  별자리, 전송, 영수증)은 이 폴더가 생겨도 한 줄도 바뀌지 않는다.
 * ───────────────────────────────────────────────────────
 */

/**
 * 배정에 쓰는 다섯 가지 조건의 가중치. 합이 1이 되어야 한다.
 *
 * ─── 우선순위대로 다시 정했다 ──────────────────────────
 *  1순위 `meaning`(실제로 적거나 답한 내용의 핵심 의미) >
 *  2순위 `etymology`(그 주제와 별 이름의 어원·상징적 해석의 연관성) >
 *  3순위 `emotion`(고른 감정) > 4순위 `comfort`(간직/흘려보내기) >
 *  5순위 `season`(계절). 계절은 **참고할 요소일 뿐, 후보를 걸러내는
 *  절대 조건이 아니다** — 그래서 가중치가 가장 낮다(`weights.ts`
 *  `DEFAULT_WEIGHTS` 참고). 다섯 모두 0~1로 정규화되어 있어, 가중치의
 *  합이 1이면 총점(`ScoreBreakdown.total`)도 늘 0~1이다.
 * ───────────────────────────────────────────────────────
 */
export interface AssignmentWeights {
  /** 계절 적합도 — 5순위 */
  season: number
  /** 간직하기 / 흘려보내기 적합도 — 4순위 */
  comfort: number
  /** 기억 내용과의 의미 적합도(키워드로 짚은 주제) — 1순위 */
  meaning: number
  /** 감정 적합도 — 3순위 */
  emotion: number
  /** 그 주제와 별 이름의 어원·상징적 해석의 연관성 — 2순위 */
  etymology: number
}

/**
 * 기억 내용에서 길어 올릴 수 있는 의미의 결 — 열두 가지 주제.
 *
 * ─── 전면 개편 — "감정만으로 사랑을 짚지 않는다" ────────
 *  이전 버전의 `relationship`(사랑과 관계) 태그는 '함께'·'같이'·
 *  '우리'·'친구'·'가족'·'곁에' 같은, **사랑과는 무관한 아주 흔한
 *  낱말**까지 한 덩어리로 묶고 있었다 — 그래서 친구나 가족 이야기를
 *  적어도 "사랑과 관계의 결이 느껴졌다"는 엉뚱한 배정 이유가 나왔다.
 *  이번에 `romance`(사랑·연애)·`family`(가족)·`friendship`(우정)
 *  셋으로 쪼개고, `romance`는 **연애 관계가 명확한 낱말만** 받는다
 *  (낱말은 `meaning.ts` 참고) — 행복·설렘·그리움이라는 **감정**만으로는
 *  결코 사랑으로 짚히지 않는다. 감정은 `score.ts`의 별도 축
 *  (`emotionScore`)이고, 이 태그는 오직 **적은 글의 낱말**로만 짚는다.
 *
 *  `achievement`(노력과 성취)·`freedom`(자유와 독립)·`everyday`
 *  (평범하지만 행복한 일상)은 새로 늘었다. `challenge`·`growth`·
 *  `recovery`는 `growth`(성장과 도전) 하나로, `parting`·`regret`는
 *  `parting`(후회와 이별) 하나로 합쳤다 — 겹치는 결을 억지로 가르지
 *  않는다. 아무것도 안 짚이면(`matched: []`) 그것이 곧 "기타 또는
 *  판단하기 어려운 기억"이다 — 열세 번째 태그를 따로 두지 않는다.
 * ───────────────────────────────────────────────────────
 */
export type MeaningTag =
  | 'romance' // 사랑과 연애 — 연애 관계가 글에서 명확할 때만
  | 'family' // 가족과 소중한 사람
  | 'friendship' // 친구와 우정
  | 'achievement' // 노력과 성취
  | 'growth' // 성장과 도전(회복 포함)
  | 'everyday' // 평범하지만 행복한 일상
  | 'longing' // 그리움과 추억
  | 'parting' // 후회와 이별
  | 'comfort' // 불안과 위로
  | 'newBeginning' // 새로운 시작
  | 'freedom' // 자유와 독립

/** 화면에 보여 줄 때 쓰는 한국어 이름. 로그·배정 이유 문장에 쓴다. */
export const MEANING_TAG_LABEL: Record<MeaningTag, string> = {
  romance: '사랑과 연애',
  family: '가족과 소중한 사람',
  friendship: '친구와 우정',
  achievement: '노력과 성취',
  growth: '성장과 도전',
  everyday: '평범하지만 행복한 일상',
  longing: '그리움과 추억',
  parting: '후회와 이별',
  comfort: '불안과 위로',
  newBeginning: '새로운 시작',
  freedom: '자유와 독립',
}

/**
 * 기억 내용 분석의 결과.
 *
 * `matched`가 빈 배열이면 "키워드로 짚이는 의미가 없다"는 뜻이고, 그때
 * 의미 적합도는 어느 별도 편들지 않는 중립값을 낸다(`score.ts`의
 * `meaningScore`) — "불확실하면 감정·계절·선택에 맡긴다"는 §5의 요청이다.
 */
export interface MeaningAnalysis {
  matched: MeaningTag[]
  /** 분석에 쓴 글자 수. 디버깅·테스트용. */
  textLength: number
}

/** 배정 알고리즘에 들어가는, 관람객이 이미 고른 것들. */
export interface MemoryContext {
  /** `UniverseStar.id`. 이 기억 하나를 가리키는 고유 이름. */
  memoryId: string
  text: string
  emotion: EmotionKey
  /** 비어 있으면 'unknown'으로 본다(옛 기록에는 이 필드가 없을 수 있다). */
  season: Season
  type: MemoryType
  /**
   * 기억을 적은 방식. 직접 작성이면 `'free'`(또는 생략), 질문에 답하는
   * 방식이면 `'prompt'`.
   *
   * **이 값은 의미 분석(`meaning.ts`의 `analyzeMeaning`)에 전혀 쓰이지
   * 않는다** — 주제는 오직 `text`(관람객이 실제로 적은 답)에서만 찾는다.
   * 여기 있는 이유는 딱 하나, '나의 별 이야기' 문장(`reason.ts`)이
   * "어떤 질문에 답했는지"를 자연스럽게 밝혀 주기 위해서다.
   */
  recordMode?: RecordMode
  /**
   * 질문 방식일 때, 실제로 보고 답한 그 질문의 원문.
   *
   * `recordMode`가 `'prompt'`일 때만 뜻이 있다. 이 문구의 **낱말은
   * 주제 매칭에 절대 섞이지 않는다** — 질문에 우연히 들어간 말로 사용자의
   * 경험이나 감정을 추측하지 않기 위해서다(`meaning.ts`는 이 필드를
   * 아예 받지 않는다). 오직 `reason.ts`가 "이 질문에 답하며"라는 문구를
   * 지어내지 않고 그대로 인용할 때만 쓴다.
   */
  promptQuestion?: string
}

/** 조건 하나하나의 점수(0~1)와, 그것을 가중합한 총점. */
export interface ScoreBreakdown {
  season: number
  comfort: number
  meaning: number
  emotion: number
  /** 주제와 별 이름의 어원·상징적 해석의 연관성(`etymology.ts`). */
  etymology: number
  /** 가중합. 0~1. */
  total: number
}

/** 점수를 매긴 별 하나. */
export interface ScoredStar {
  starId: string
  scores: ScoreBreakdown
}

/** 저장소에 남는, 아주 작은 기록. 화면에 보여 줄 문장은 여기 없다 — 읽을 때 다시 짓는다. */
export interface StoredAssignment {
  version: 1
  memoryId: string
  realStarId: string
  /** 배정 당시 관람객이 고른 계절(미정이면 'unknown'). */
  season: Season
  type: MemoryType
  emotion: EmotionKey
  meaningTags: MeaningTag[]
  scores: ScoreBreakdown
  /** 몇 개의 후보 중에서 뽑았는가. 테스트와 운영 점검용. */
  candidateCount: number
  assignedAt: number
  /**
   * 배정 당시 기억을 적은 방식과(질문 방식이면) 그 질문.
   *
   * `MemoryContext`의 같은 필드와 뜻이 같다 — '나의 별 이야기'는
   * **저장되지 않고 읽을 때마다 다시 짓기 때문에**(`view.ts`), 그때도
   * "어떤 질문에 답했는지"를 다시 밝힐 수 있도록 여기 함께 저장해 둔다.
   * 옛 기록에는 없을 수 있다 — 없으면 직접 작성으로 본다.
   */
  recordMode?: RecordMode
  promptQuestion?: string
}

/** 화면이 읽을, 다 합쳐진 모습. 저장되지 않고 매번 다시 만들어진다. */
export interface AssignedStarView {
  memoryId: string
  realStarId: string
  /** 공식 고유명이 있으면 그 이름, 없으면 지정법. */
  realStarName: string
  korean: string
  poeticName: string
  /** 시적인 이름이 무엇을 뜻하는가(`RealStar.poetry.symbolism`). '나의 별 이야기'에서만 보여 준다. */
  symbolism: string
  constellationId: RealConstellationId
  constellationKorean: string
  cardNumber: number
  /**
   * 이 배정에서 실제로 짚인 의미 태그(`meaning.ts`). 기억 원문이 아니라
   * **원문에서 뽑아낸 주제 꼬리표**일 뿐이다 — Firebase에 보낼 때(§관측
   * 페이지) 원문 없이도 '나의 별 이야기'를 똑같이 다시 지을 수 있게
   * 하는 핵심 값이다(`reason.ts`의 `buildAssignmentReason`이 받는
   * 그 값과 같다).
   */
  meaningTags: MeaningTag[]
  /**
   * 색을 말로(`RealStar.astronomy.colorDescription`). 화면이 별빛의 색을
   * 고를 때 쓴다(`lib/starVisual.ts`) — 숫자(분광형)를 다시 계산하지
   * 않고, 이미 검증된 별 데이터에 적힌 말을 그대로 읽는다.
   */
  colorDescription: string
  /** 검증된 사실만(`RealStar.astronomy.facts`). */
  facts: string[]
  /**
   * 이 별을 실제로 찾아볼 수 있는 주소(`lib/starLookup.ts`). 지금 이 순간
   * 관측할 수 있다는 뜻이 아니라, "이 별이 무엇인지 찾아볼 수 있다"는
   * 뜻이다 — 영수증의 QR코드가 이 값을 그대로 쓴다.
   */
  lookupUrl: string
  /**
   * 별자리 공통 위로 메시지(`ConstellationCard.comfort.message`)와는 다른,
   * 별 하나의 위로. 별마다 고정된 문장이 아니라, 감정·간직/흘려보내기에
   * 따라 그때그때 짓는다(`comfort.ts`의 `buildComfortMessage`).
   */
  comfortMessage: string
  /** 이번 배정에 실제로 쓴 조건에 근거해 지은 문장(`reason.ts`). */
  assignmentReason: string
  season: Season
  type: MemoryType
  /**
   * 실물 별자리 카드(12종 중 하나) 쪽 정보.
   *
   * **개인화된 것이 아니다** — `poeticName`·`comfortMessage`·
   * `assignmentReason`은 이 별 하나, 이 기억 하나를 위한 것이고,
   * 여기 아래는 같은 별자리를 받은 모든 관람객에게 똑같이 적히는
   * 말이다(`ConstellationCard.comfort`). 둘을 같은 화면에 섞어 적으면
   * "이 말도 내 이야기만을 위한 것인가"를 헷갈리게 하므로, 타입에서부터
   * 따로 묶어 둔다.
   */
  constellationCard: {
    international: string
    bestSeasonKR: ObservableSeason[]
    /** 카드에 인쇄되는, 그 별자리의 공통 위로 메시지. */
    comfortMessage: string
    /** 한 줄 테마(`ConstellationCard.comfort.theme`). */
    theme: string
  }
}

export type AssignmentOutcome =
  | { ok: true; record: StoredAssignment; view: AssignedStarView }
  | { ok: false; reason: 'no-verified-stars' | 'constellation-not-found' }
