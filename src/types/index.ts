/**
 * AFTERLIGHT — 전시 키오스크 / 공동 우주.
 *
 * 은유는 원작과 같다.
 *
 *   하나의 기억  =  하나의 별
 *   그 기억을 보낸 일  =  빛이 출발한 일
 *   그 의미가 우리에게 닿는 일  =  빛의 도착
 *
 * 달라진 것은 하늘의 임자다. 여기서 하늘은 한 사람의 것이 아니라
 * 전시를 다녀간 모든 사람의 것이다.
 */

/**
 * 장면. 페이지를 옮기지 않는다. 같은 우주 위에서 겹쳐 바뀔 뿐이다.
 */
export type Scene =
  | 'attract' // 대기 — 아무도 없을 때의 공동 우주
  | 'intro' // 아직 도착 중인 시간
  | 'record' // 적는다 — 한 문장과, 그 시간이 언제였는지
  | 'emotion' // 고른다 — 어떤 빛인가
  | 'choice' // 고른다 — 간직할 것인가, 흘려보낼 것인가
  | 'confirm' // 무엇을 보내는지 보고 나서
  | 'sending' // 빛이 우리의 우주로 건너간다
  | 'done' // 도착했다
  | 'universe' // OUR UNIVERSE — 모두의 빛과 감정별 별자리

/**
 * 그 시간을 어떻게 기억하고 싶은가.
 *
 *   keep  — 간직하고 싶은 시간. 따뜻하고 조금 더 선명하다.
 *   letgo — 흘려보내고 싶은 시간. 희미하고 부드럽다.
 *
 * **감정과는 다른 축이다.** 같은 그리움이라도 간직한 것과 흘려보낸 것이 있다.
 */
export type MemoryType = 'keep' | 'letgo'

/** 감정의 식별자. 이름과 색은 `constants/emotions.ts`에 있다. */
export type EmotionKey = string

/**
 * 별자리의 식별자.
 *
 * 지금은 마음 하나에 별자리 하나이므로 `con-sad`처럼 생겼다.
 * 한 별자리가 100개를 넘겨 둘로 나뉠 때를 위해 **감정 키를 그대로 쓰지 않고**
 * 따로 둔다 — 그때는 `con-sad-2`가 생긴다. (`lib/starMath.ts`의 `constellationIdFor`)
 */
export type ConstellationId = string

/**
 * 빛이 어디까지 왔는가.
 *
 *   sending — 키오스크를 떠나 건너가는 중. 하늘에는 아직 없다
 *   arrived — 우리의 우주에 닿았다. 이제 하늘에 뜬다
 *
 * 허브가 붙으면 `sending`인 채로 남은 빛이 '보냈는데 닿지 않은 것'이 되고,
 * 그것이 다시 보내야 할 목록이 된다.
 */
export type SendStatus = 'sending' | 'arrived'

/**
 * 이 빛은 어디서 왔는가.
 *
 *   live — 실제 관람객이 보낸 것
 *   test — 점검하려고 만들어 낸 것
 *
 * **두 가지를 섞어 두지 않는다.** 저장소부터 다르다
 * (`data/universeRepository.ts`). 전시 빌드는 `test`를 읽지도 않는다.
 */
export type StarSource = 'live' | 'test'

/**
 * 그 시간은 언제였는가.
 *
 * 달력을 띄우지 않는다. 전시장에서 날짜 피커가 뜨는 순간
 * 작품이 서식이 되기 때문이다. 고른 값은 빛이 건너온 거리로만 쓰인다.
 */
export interface TimeRef {
  kind: 'recent' | 'years' | 'longAgo' | 'unknown'
  /** 'years'일 때만. 몇 해 전인가. */
  years?: number
  /** 화면과 영수증에 그대로 찍히는 말 */
  label: string
}

/**
 * 우주에 떠 있는 빛 하나.
 *
 * 한 사람의 저장소가 아니라 **모두의 저장소**에 이 모양 그대로 쌓인다.
 */
export interface UniverseStar {
  /** 이 빛 하나를 가리키는 이름. 우주 안에서 겹치지 않는다. */
  id: string
  /** 전시 통산 번호. 영수증에 찍힌다. */
  seq: number
  /** 익명. 같은 사람이 이어서 보낸 것만 묶는 용도다. */
  sessionId: string
  /** 실제 관람객의 빛인가, 점검용으로 만든 빛인가 */
  source: StarSource

  /** 기억의 한 문장. 키오스크와 영수증에만 쓰인다 — 벽으로는 건너가지 않는다. */
  text: string
  timeRef: TimeRef

  /** 감정 — 색 · 모양 · 어느 별자리에 속하는가 */
  emotion: EmotionKey
  /** 간직 / 흘려보내기 — 밝기 · 핵과 번짐의 비율 */
  type: MemoryType

  /**
   * 그 빛이 우리에게 닿은 때 (epoch ms).
   * 저장하는 순간이 아니라 도착하는 순간이다.
   */
  createdAt: number

  /** 공동 우주에서의 자리 (0~1 정규 좌표, FIELD 범위) */
  x: number
  y: number
  /** 타고난 밝기 0~1 */
  brightness: number
  /** 같은 별은 언제나 같은 모습이어야 한다. 그 씨앗. */
  seed: number

  /** 어느 별자리에 속하는가 */
  constellation: ConstellationId
  /** 보내는 중인가, 닿았는가 */
  status: SendStatus
  /**
   * 이 기록의 **내용**을 남에게 보여도 되는가.
   *
   * 적혀 있지 않으면 동의하지 않은 것으로 본다 — 빠뜨렸을 때 안전한 쪽으로
   * 틀려야 하기 때문이다. 지금은 동의를 묻는 걸음이 없으므로 언제나 비어 있고,
   * 따라서 우리의 우주에 남이 적은 글은 한 줄도 뜨지 않는다.
   *
   * 벽으로도 가지 않는다(`toWallLight`가 내용을 떼어 낸다).
   */
  shared?: boolean
  /** 우리의 우주에 닿은 때. 아직 건너가는 중이면 없다. */
  arrivedAt?: number
}

/**
 * 벽으로 건너가는 빛.
 *
 * **문장이 들어 있지 않다.** 일부러 빠뜨린 것이다 — 감추는 것이 아니라
 * 애초에 그 자리까지 가지 않는다. (원작 `SharedLight`의 뜻을 그대로 잇는다.)
 */
export interface WallLight {
  id: string
  /**
   * 이 전송 한 건을 가리키는 이름.
   *
   * 지금은 `id`와 같은 값이다 — 아두이노·다리·TouchDesigner가 "같은
   * 기록"임을 알아보는 고유 키로, 전송 과정 전체(센서 트리거 → LED →
   * 별 생성 → 완료 응답)에서 이 값 하나로 묶인다. `id`와 따로 두는
   * 이유는, 벽(TD) 쪽 코드가 "이건 전송 식별자다"라고 읽을 수 있는
   * 이름을 갖도록 하기 위해서다.
   */
  transferId: string
  createdAt: number
  emotion: EmotionKey
  type: MemoryType
  constellation: ConstellationId
  x: number
  y: number
  brightness: number
  seed: number
}

/** 지금 우주에 무엇이 모여 있는가 */
export interface UniverseStats {
  total: number
  /** 실제 관람객의 빛 / 점검용으로 만든 빛 */
  live: number
  test: number
  byEmotion: Record<EmotionKey, number>
  keep: number
  letgo: number
}

export interface Tone {
  type: MemoryType
  /** 화면에 보이는 이름 */
  label: string
  /** 선택지 옆에 놓이는 기호 */
  glyph: string
  /** 별의 핵 색 */
  core: string
  /** 번지는 후광 색 */
  halo: string
  /** 이 빛이 타고나는 밝기의 범위 */
  brightness: readonly [number, number]
  /** 핵의 크기 배수 */
  coreScale: number
  /** 번짐의 크기 배수 */
  haloScale: number
  /** 얇은 빛 갈래를 가질 수 있는가 */
  spikes: boolean
  /** 카드에 적히는 이름 */
  cardLabel: string
  /** 손이 닿았을 때 밝아지는 폭 */
  hoverGain: number
  /** 잔광 보기에서의 목표 밝기 */
  afterglowAlpha: number
  /** 잔광 보기에서 커지는 배수 */
  afterglowGrow: number
  /** 잔광 보기에서의 번짐 색 */
  afterglowHalo: string
  /** 잔광 보기에서 번짐의 짙기 */
  afterglowHaloGain: number
}

/**
 * 감정 하나.
 *
 * 색은 크림~러스트의 좁은 띠 안에 둔다. 무지개로 나누면 이 작품의
 * 색 원칙("빛은 차갑지 않다, 푸른빛은 그림자에 섞이는 불순물")이 무너진다.
 * 구분은 색상이 아니라 ① 색온도 ② 별의 모양 ③ 하늘에서의 자리로 한다.
 */
export interface Emotion {
  /** 저장되는 식별자 */
  type: EmotionKey
  /** 화면에 보이는 이름 */
  label: string
  /**
   * 원작이 고른 이 마음의 색.
   *
   * 지금은 별을 칠하는 데 쓰지 않는다(아래 `light`가 그 일을 한다).
   * **출처로 남겨 둔다** — 새 색이 어디에서 출발했는지 알 수 있어야 하고,
   * 되돌릴 일이 생기면 여기가 그 자리다.
   */
  tint: string
  /** 원작에서, 별의 번짐에 이 색이 섞이는가 */
  blends: boolean
  /**
   * 별을 이루는 세 겹의 빛.
   *
   *   core   중심광 — 가장 밝은 한 점
   *   halo   외곽광 — 색을 가장 많이 지는 겹
   *   trail  잔광  — 가장 바깥, 가장 어두운 번짐
   *
   * **감정이 색을 정하고, 간직/흘려보내기는 밝기와 크기와 갈래만 정한다.**
   * 둘은 나란한 축이므로 어느 한쪽이 다른 쪽을 덮어쓰지 않는다.
   */
  light: { core: string; halo: string; trail: string }
  /**
   * 이 감정의 별이 타고나는 생김새.
   *
   * 색만으로는 일곱이 서로 갈리지 않는다(번짐에 0.34만 섞이므로).
   * 모양이 한 겹 더 거들어야 '다른 마음의 빛'으로 읽힌다.
   */
  form: 'ember' | 'cross' | 'halo' | 'soft'
  /**
   * 공동 우주에서 이 별자리가 차지하는 하늘의 조각.
   *
   * 반지름이 아니라 네 변이다. 반지름으로 두면 일곱 조각이 하늘을
   * 어떻게 나눠 갖는지 눈으로 셀 수 없고, 가로 거리가 X_SQUEEZE(0.62)로
   * 눌려 셈해지는 탓에 실제로는 겹치면서 겹치지 않는 것처럼 보인다.
   */
  field: { left: number; right: number; top: number; bottom: number }
}
