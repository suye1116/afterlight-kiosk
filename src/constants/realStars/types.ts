/**
 * 실제 별 / 실제 별자리 — 타입만.
 *
 * ─── 이 폴더가 따로 있는 이유 ──────────────────────────
 *  AFTERLIGHT에는 이미 "별자리"라는 말이 있다 — 관람객이 보낸 빛들이
 *  전시장 우주에서 모여 이루는, 감정별로 나뉜 작품 속 별자리
 *  (`constants/emotions.ts`의 `field`, `lib/starMath.ts`의 `constellationIdFor`).
 *
 *  여기서 다루는 "별자리"는 **다른 것**이다 — 관람객에게 배정될 실제
 *  하늘의 별이 천문학적으로 속한, 실물 카드 12종과 연결되는 별자리다.
 *  이름이 겹치면 언젠가 두 개념이 섞인다. 그래서:
 *
 *    작품 속 별자리   `ConstellationId`           (`@/types`)
 *    실제 별자리      `RealConstellationId`        (이 파일)
 *
 *  로 **타입 이름부터** 분리해 둔다. 이 폴더의 어떤 파일도 `@/types`의
 *  `ConstellationId`·`Emotion`·`UniverseStar`를 import하지 않는다 —
 *  가져다 쓰기 시작하면 두 체계가 서로의 가정에 묶이기 때문이다.
 *
 *  같은 이유로 계절도 따로 둔다. `@/types`의 `Season`은 '기억의 계절'이고
 *  '모르겠어요'가 있을 수 있다. 여기 `ObservableSeason`은 '그 별이 한국에서
 *  보기 좋은 철'이라는 **천문학적 사실**이라 '모르겠어요'가 있을 수 없다.
 * ───────────────────────────────────────────────────────
 *
 * 아직 어떤 화면도, 어떤 저장소도 이 파일을 참조하지 않는다. 별 배정
 * 알고리즘과 새 화면은 다음 단계의 일이다. 지금은 데이터의 모양만 정한다.
 */

/**
 * 실제 별자리의 식별자. 사용자가 승인한 12종으로 못박는다.
 *
 * 문자열로 두지 않고 리터럴 유니온으로 둔 이유는, "별 하나가 12종 밖의
 * 별자리를 가리키는" 실수를 **컴파일 때 잡기 위해서다** — §6의 검사
 * 2번("실제 별자리 ID가 12종 중 하나인지")을 타입이 이미 절반쯤 해 준다.
 * 나머지 절반(런타임 데이터가 실제로 이 중 하나인지)은
 * `scripts/check.realStars.ts`가 돈다.
 */
export type RealConstellationId =
  | 'rc-orion'
  | 'rc-canis-major'
  | 'rc-taurus'
  | 'rc-ursa-major'
  | 'rc-leo'
  | 'rc-bootes'
  | 'rc-lyra'
  | 'rc-cygnus'
  | 'rc-scorpius'
  | 'rc-pegasus'
  | 'rc-andromeda'
  | 'rc-cassiopeia'

/** 위 유니온을 런타임에도 순회해야 할 때(검사 스크립트 등) 쓰는 배열. */
export const REAL_CONSTELLATION_IDS: readonly RealConstellationId[] = [
  'rc-orion',
  'rc-canis-major',
  'rc-taurus',
  'rc-ursa-major',
  'rc-leo',
  'rc-bootes',
  'rc-lyra',
  'rc-cygnus',
  'rc-scorpius',
  'rc-pegasus',
  'rc-andromeda',
  'rc-cassiopeia',
] as const

/** 그 별(또는 별자리)을 한국에서 보기 좋은 철. '모르겠어요'가 없다 — 천문학적 사실이기 때문이다. */
export type ObservableSeason = 'spring' | 'summer' | 'autumn' | 'winter'

/**
 * 이 기록을 얼마나 믿을 수 있는가.
 *
 *   verified             — 바깥 자료로 확인했다. `sources`에 무엇을 보았는지 남겼다.
 *   needs-verification   — 기억이나 짧은 검색에만 기댔다. 최종 데이터로 쓰기 전에
 *                           공인 자료(SIMBAD·Stellarium·IAU 목록 등)로 다시 확인해야 한다.
 *
 * **지어낸 값에는 이 표식을 붙이지 않는다.** 모르면 숫자 대신 `null`을 두고,
 * `needs-verification`과 그 이유를 적는다 — 80개를 채우려고 숫자를 메우지 않는다.
 */
export type VerificationStatus = 'verified' | 'needs-verification'

/** 무엇을 보고 확인했는가. URL은 되도록 두지 않는다 — 링크는 썩고, 이름은 남는다. */
export interface SourceRef {
  /** 예: "Wikipedia: Betelgeuse", "IAU Working Group on Star Names 승인 목록" */
  note: string
  /** 확인한 날짜(YYYY-MM-DD). 거리·변광 주기 같은 값은 관측이 쌓이며 갱신되므로 언제 본 것인지를 남긴다. */
  checkedAt?: string
}

/**
 * 간직하기 / 흘려보내기 — 이 별이 어느 쪽에 더 어울리는가.
 *
 *   keep    — 간직하는 결에 가깝다
 *   letgo   — 흘려보내는 결에 가깝다
 *   either  — 둘 다로 읽을 수 있다 (실제로 많은 별이 그렇다 —
 *             하나의 과학적 사실에서 서로 다른 두 이야기가 나올 수 있다)
 */
export type StarComfortDirection = 'keep' | 'letgo' | 'either'

/**
 * 그 별의 실제 특징에서 시적인 결을 길어 올리는 갈래.
 *
 * ─── §3의 요청에 대한 답 ───────────────────────────────
 *  예시로 주신 "꾸준히 빛나는 별 / 방향을 안내하는 별 / 함께 빛나는 별 /
 *  소중한 관계와 연결되는 별"(간직)과 "밝기가 변하는 별 / 가려지는 별 /
 *  변화와 순환 / 지나간 시간의 의미"(흘려보내기)를 그대로 쓰지 않고,
 *  **실제 천문학적 범주**로 다시 묶었다. 이렇게 하면:
 *
 *   1. 하나의 질(quality)이 간직과 흘려보내기 양쪽에 다 쓰일 수 있다.
 *      (`variable`은 "그래도 주기를 두고 돌아온다"로 간직에 쓸 수도,
 *       "한결같지 않았다"로 흘려보내기에 쓸 수도 있다 — 배정 시점의
 *       실제 선택(keep/letgo)이 해석의 방향을 정하지, 질 자체가
 *       한쪽에 못박히지 않는다.)
 *   2. "흘려보내는 별 = 죽어가는 별"이라는 단순 대응을 피할 수 있다.
 *      초거성(`evolving`)은 흘려보내기에 쓰기 좋지만, 쌍성(`companion`)도
 *      식변광성이면 `eclipsing`이면서 동시에 `companion`일 수 있다 —
 *      "가려졌다 다시 나타나는 동행"처럼, 흘려보내기 안에서도 더 따뜻한
 *      결이 나온다.
 * ───────────────────────────────────────────────────────
 */
export type StarQuality =
  /** 밝기 변화가 거의 없다 — 한결같다 */
  | 'steady'
  /** 실제로 방위나 길을 찾는 데 쓰였거나 쓰인다 (예: 북극성을 가리키는 별, 뱃사람의 별) */
  | 'guide'
  /** 쌍성·다중성 — 가까이 두 개 이상의 별이 함께 있다 */
  | 'companion'
  /** 한국(북반구 중위도)에서 연중 거의 내내 보이는, 지평선 아래로 잘 지지 않는 별자리에 속한다 */
  | 'circumpolar'
  /** 밝기가 변한다 (주기적이든 불규칙하든) */
  | 'variable'
  /** 식변광성 — 동반성에 가려지는 주기로 어두워진다 */
  | 'eclipsing'
  /** 거성·초거성 등, 별의 생애 말기에 해당하는 진화 단계에 있다 */
  | 'evolving'
  /** 성단(여러 별이 뭉친 무리)에 속한다 */
  | 'cluster'
  /** 지구에서 보기에 매우 멀어, 지금 보는 빛이 아주 오래전에 그 별을 떠난 빛이다 */
  | 'distant-past-light'

/** 별 이름 — 실제 이름과 표기만. 시적인 이름은 `poetry.poeticName`에 따로 둔다. */
export interface RealStarName {
  /** IAU가 승인한 공식 고유명이 있으면 그 이름. 없으면 `null` — 지어내지 않는다. */
  properName: string | null
  /**
   * 검증 가능한 지정법. 공식 고유명이 없는 별도 이것으로 가리킬 수 있다.
   * 예: 'Alpha Orionis'(바이어), '61 Cygni'(플램스티드).
   */
  designation: string
  /** 한국어 표기. 확정된 표기가 따로 없으면 통용되는 음역을 쓴다(지어낸 번역이 아니다). */
  korean: string
  /**
   * 그 이름의 실제 어원과 뜻 — 검증된 것만.
   *
   * 대부분 아랍어(Ptolemy의 『알마게스트』를 옮기며 붙은 이름)나 그리스
   * 신화에서 왔다. `origin`은 그 말이 온 언어·전통, `meaning`은 그
   * 말의 글자 그대로의 뜻이다(시적으로 지은 뜻이 아니다 — 그건
   * `RealStarPoetry.symbolism`의 자리다).
   *
   * **고유명이 없거나(`properName`이 `null`), 어원이 불분명하거나
   * 여러 해석이 엇갈리면 `null`이다.** 확정할 수 없는 뜻을 하나로
   * 지어 붙이지 않는다 — 예: 알리오트·사르가스·하티사·세긴·아치르드는
   * 자료마다 뜻이 갈리거나 유래가 알려지지 않아 `null`로 둔다.
   */
  etymology: { origin: string; meaning: string } | null
}

/** 거리는 보통 범위로 보고된다. 하나의 숫자로 못박지 않는다. */
export interface Distance {
  /** 대표값(광년). 자료마다 다르면 가장 널리 쓰이는 값을 둔다. */
  lightYears: number
  /** 자료 간에 차이가 있으면 그 범위. 없으면 생략. */
  range?: [number, number]
  /** 대표값이 근사치라는 뜻. 대부분 `true`다 — 별까지의 거리는 늘 추정값이다. */
  approximate: boolean
}

/**
 * 하늘에서의 실제 위치 (적경/적위, J2000 기준).
 *
 * 숫자로 쪼개지 않고 통용되는 "시분초 / 도분초" 문자열 그대로 둔다 —
 * 천문 지도·망원경 소프트웨어가 흔히 그 모양으로 보여 주므로, 사람이
 * 옮겨 적거나 눈으로 맞춰 볼 때 숫자 하나보다 이 모양이 더 쓸모 있다.
 * 각 별의 `astronomy.sources`가 이 값의 출처이기도 하다.
 */
export interface SkyPosition {
  /** 예: '05h 55m 10.3s' */
  raJ2000: string
  /** 예: '+07° 24′ 25″' */
  decJ2000: string
}

export interface RealStarAstronomy {
  /** 분광형. 예: 'M1-M2 Ia-ab'. 모르면 `null`. */
  spectralType: string | null
  /** 색을 말로. 예: '붉은빛 (적색초거성)'. */
  colorDescription: string
  /**
   * 겉보기 밝기(apparent magnitude)의 대표값. 숫자가 작을수록 밝다.
   * 변광성이면 `facts`에 변화 폭을 글로 적어 둔다(숫자 범위를 또 다른 필드로
   * 쪼개지 않는다 — 변광 방식이 저마다 달라 숫자 하나로 통일하기 어렵다).
   */
  apparentMagnitude: number | null
  distance: Distance
  position: SkyPosition
  /** 한국에서 보기 좋은 철. 하나 이상일 수 있다(저녁 내내 보이는 별자리는 두 철에 걸친다). */
  bestSeasonKR: ObservableSeason[]
  /** 확인된 사실만. 한 줄씩. 지어내지 않는다. */
  facts: string[]
  verification: VerificationStatus
  /** `verification`이 'verified'면 반드시 하나 이상. */
  sources: SourceRef[]
}

/**
 * 관람객이 영수증의 QR코드로 이 별을 실제로 찾아볼 때 필요한 정보.
 *
 * ─── "실존한다"와 "맨눈으로 쉽게 보인다"는 다른 말이다 ────────
 *  `nakedEyeVisible`은 **겉보기 밝기만으로** 판단한다. 기준은 도심·교외의
 *  실제 밤하늘에 가까운 기준으로 잡았다(아주 깨끗한 암흑 하늘의 6등급
 *  한계가 아니라) — 관람객이 전시장을 나서서 실제로 올려다볼 하늘이기
 *  때문이다.
 *
 *    4.5등급 이하  → 맨눈, 도구 없이도 (`requiresOptics: 'none'`)
 *    4.5~6.0등급   → 맨눈은 어둡고 깨끗한 하늘에서만. 쌍안경을 권한다
 *                    (`requiresOptics: 'binoculars'`)
 *    6.0등급 초과  → 쌍안경으로도 어렵다. 망원경을 권한다
 *                    (`requiresOptics: 'telescope'`)
 *
 *  이 경계는 **이 프로젝트가 정한 실용적 기준**이며 절대적인 과학 상수가
 *  아니다 — 그래서 `note`에 그 기준을 함께 적어, 다음 사람이 바꿀 때
 *  무엇을 바꾸는지 알 수 있게 한다.
 * ───────────────────────────────────────────────────────
 */
export interface ObservationInfo {
  /** 한국(북반구 중위도, 약 37°N)에서 지평선 위로 뜨는가. */
  visibleFromKorea: boolean
  /** 위 기준(4.5등급)으로 맨눈 관측이 가능한가. */
  nakedEyeVisible: boolean
  requiresOptics: 'none' | 'binoculars' | 'telescope'
  /** 판단 근거(등급 기준)와, 낮게 뜨는 별이면 그 사정을 함께 적는다. */
  note: string
  /**
   * 외부 천문 지도·별자리 앱에서 이 별을 찾을 때 검색창에 넣을 식별자.
   * 특정 서비스의 URL은 적지 않는다 — 링크는 썩고, 바이어 지정법은 썩지 않는다.
   * (대개 `RealStarLookup.bayerFlamsteed`와 같은 값이다.)
   */
  skyMapIdentifier: string
  /** 이 별을 찾는 데 도움이 되는, 더 잘 알려진 주변 별이나 모양 */
  findingTip: string
}

export interface RealStarPoetry {
  /** AFTERLIGHT가 지어 붙이는 시적인 이름. 실제 이름이 아니라는 것을 화면에서도 밝힌다. */
  poeticName: string
  /** 이 별이 상징할 수 있는 감정·기억의 결 */
  symbolism: string
  comfortDirection: StarComfortDirection
  /** 이 별이 가진, 시적 해석의 바탕이 되는 실제 특징들 */
  qualities: StarQuality[]
  /**
   * 위로의 한마디 — 간직하기/흘려보내기에 따라 다르다.
   *
   * 같은 별이라도 그 특징을 간직하는 쪽으로 읽을 수도, 흘려보내는
   * 쪽으로 읽을 수도 있다("§6 StarQuality"의 원칙과 같다). 흘려보내기
   * 쪽 문장도 "잊으라"거나 "사라진다"고 말하지 않는다 — 흘려보낸
   * 시간도 없었던 시간이 되지는 않는다는 것이 이 작품의 철학이다.
   */
  comfortMessage: { keep: string; letgo: string }
  /**
   * "왜 이 별인가"를 설명하는 문장의 바탕글.
   * 배정 알고리즘(다음 단계)이 관람객의 선택을 끼워 넣어 완성할 문장이다.
   */
  assignmentReason: string
}

/** 외부 관측 자료·사이트에 연결할 때 쓰는 식별자. 추측해서 적지 않는다 — 모르면 비워 둔다. */
export interface RealStarLookup {
  /** 바이어/플램스티드 지정법. 외부 스카이맵 서비스가 대부분 이 형식을 받아들인다. */
  bayerFlamsteed: string | null
  /** 다른 카탈로그 번호. 확인하지 못한 항목은 아예 키를 두지 않는다(틀린 번호를 적는 것보다 낫다). */
  catalogIds?: {
    hd?: string
    hip?: string
    hr?: string
  }
}

/** 실제 별 하나. */
export interface RealStar {
  /** 프로젝트 내부 고유 ID. 예: 'star-betelgeuse'. */
  id: string
  name: RealStarName
  /** 소속 실제 별자리 — 실물 카드 12종 중 하나를 가리킨다. */
  constellationId: RealConstellationId
  astronomy: RealStarAstronomy
  poetry: RealStarPoetry
  lookup: RealStarLookup
  /** 영수증 QR코드로 이 별을 실제로 찾아볼 때 필요한 정보. */
  observation: ObservationInfo
}

/**
 * 80개 채우기의 후보 — 아직 `RealStar`로 완성되지 않은 별.
 *
 * 이름(공식 고유명 또는 바이어/플램스티드 지정법)은 실제로 쓰이는 것만
 * 적었다. 거리·밝기·분광형 같은 수치는 **이번 단계에서 하나도 확인하지
 * 않았으므로 아예 필드를 두지 않는다** — 비워 두는 것과 "확인했지만
 * null"을 구분하기 위해서다. 이 목록은 "이름이 실존한다"는 것과 "그래서
 * 80개를 채울 수 있다"는 것만 보증한다. `RealStar`로 옮기려면 그때
 * 다시 자료를 찾아 `astronomy.verification`을 'verified'로 바꿔야 한다.
 */
export interface StarCandidate {
  /** 공식 고유명이 있으면 그 이름. 없으면 `null`. */
  properName: string | null
  /** 바이어/플램스티드 지정법. */
  designation: string
  constellationId: RealConstellationId
  /** 왜 이 이름을 후보로 올렸는지, 무엇을 더 확인해야 하는지. */
  note: string
}

/** 별자리 카드가 참고할, 그 별자리의 형태 정보. */
export interface ConstellationShape {
  /**
   * 그 별자리를 이루는 대표 별들(밝은 순, 또는 흔히 그려지는 순서).
   * `RealStar.id`를 가리킨다 — 실제 좌표(RA/Dec)는 여기 두지 않는다.
   * 도안 작업 시에는 Stellarium·IAU 별자리 경계도 같은 공인 자료로
   * 실제 모양을 다시 확인해야 한다(이 데이터는 "어떤 별들로 이루어지는가"까지만 보증한다).
   */
  keyStarIds: string[]
  /** 그 모양을 말로. 도안가가 참고할 설명. */
  description: string
}

/** 별자리 카드 12종 중 하나. */
export interface ConstellationCard {
  id: RealConstellationId
  name: {
    korean: string
    international: string
  }
  /** 실물 카드 번호 (1~12). 아직 최종 확정된 순서가 아니면 추천 순서를 둔다. */
  cardNumber: number
  bestSeasonKR: ObservableSeason[]
  shape: ConstellationShape
  astronomy: {
    /** 문화적 이야기·신화. 검증된 것만 — 각색은 `comfort`에서 한다. */
    story: string
    facts: string[]
    verification: VerificationStatus
    sources: SourceRef[]
  }
  comfort: {
    /** 카드에 인쇄될, 그 별자리의 공통 위로 메시지 */
    message: string
    /** 한 줄 테마. 예: "늘 그 자리에서 길을 알려 주는" */
    theme: string
  }
  /**
   * 12개 목록이 아직 사용자 검토를 거쳐 확정되지 않았다는 표시.
   * 참이면 "추천 단계"다 — 화면이나 영수증에 노출하면 안 된다.
   */
  draft: boolean
}
