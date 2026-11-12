import { getEmotion } from '@/constants/emotions'
import { getTone } from '@/constants/tones'
import { PUBLIC_UNIVERSE_URL } from '@/constants/deployment'
import type { AssignedStarView, MeaningTag } from '@/lib/starAssignment'
import type { EmotionKey, MemoryType, RecordMode, Season, UniverseStar } from '@/types'

/**
 * 영수증에 적히는 것.
 *
 * 화면의 미리보기와 종이가 **같은 한 곳**에서 나온다. 둘이 따로 있으면
 * 언젠가 어긋나고, 그때 사람이 보는 것과 손에 쥐는 것이 달라진다.
 *
 * ─── 기록 원문은 적지 않는다 ───────────────────────────
 *  종이는 전시장에 남고, 사진으로 찍히고, 누군가의 손을 거친다.
 *  그 사람의 한 문장이 거기까지 갈 이유가 없다.
 *
 *  적히는 것은 **그 사람이 '고른' 것들**이다 — 언제의 시간인지, 어떤 마음인지,
 *  간직할 것인지 흘려보낼 것인지. 셋 다 화면에 있던 항목이지 적은 글이 아니다.
 *
 *  정말 필요하면 다리를 `--receipt-text`로 띄우고 여기서도 켠다.
 *  기본은 꺼짐이고, 켜는 일은 사람이 한 번 더 생각하고 해야 한다.
 * ───────────────────────────────────────────────────────
 *
 * ─── 실제 별 배정 결과도 같은 곳에서 읽는다 ──────────────
 *  `star`(배정 결과)가 있으면 실제 이름·시적인 이름·소속 별자리·
 *  위로·QR코드 주소까지 여기서 함께 채운다. 배정에 실패한, 있어서는
 *  안 되는 경우에는 `yourStar`가 `null`로 들어오고, 그때는 이 필드
 *  자체를 두지 않는다 — 없는 별 정보를 지어내 채우지 않는다.
 *
 *  "우리의 우주" QR코드(`universeUrl`)도 같은 원칙이다 —
 *  `constants/deployment.ts`의 `PUBLIC_UNIVERSE_URL`이 실제 배포
 *  주소로 채워져 있을 때만 들어온다.
 * ───────────────────────────────────────────────────────
 */
export const RECEIPT_INCLUDES_TEXT = false

export interface ReceiptData {
  starId: string
  seq: number
  at: number
  /** 그 시간은 언제였나 — 고른 항목의 이름 */
  when: string
  /** 어떤 마음이었나 */
  emotion: string
  /** 간직한 시간 / 흘려보낸 시간 */
  how: string
  /** 같은 마음의 빛이 몇인가 */
  company: number
  /** 기본으로는 없다 */
  text?: string
  /**
   * 질문에 답하는 방식으로 적었을 때만. `text`와 동시에 들어오지 않는다
   * — 원문 대신 질문과 답을 함께 보여 준다. `text`와 같은 자리이므로
   * 같은 조건(`includeText`)을 따른다.
   */
  prompt?: { question: string; answer: string }
  /** 실제 별 배정 결과. 배정에 실패한 경우에는 없다(지어내지 않는다). */
  star?: {
    realName: string
    korean: string
    poeticName: string
    constellationKorean: string
    comfortMessage: string
    /** 이 별을 찾아볼 수 있는 주소. 지금 바로 볼 수 있다는 뜻은 아니다. */
    lookupUrl: string
  }
  /** "우리의 우주"를 다시 볼 수 있는 실제 공개 주소. 아직 없으면 없다. */
  universeUrl?: string
  /**
   * 다리(`server/`)가 "나의 별 관측 페이지"를 위해 Firebase에 기록할 때
   * 쓰는, **구조화된 값**. 화면에 보일 글(`star` 위)과 달리 전부 원래
   * 고른 항목·짚인 태그뿐이다 — 기억 원문은 절대 들어가지 않는다.
   *
   * 다리는 이 값으로 (1) `assignments/{토큰}`에 써서 QR1이 가리킬 개인별
   * 문서를 만들고, (2) `shareOnline`이 참일 때만 공개 `universe_stars`에도
   * 남긴다. 배정에 실패했으면(`yourStar`가 없으면) 이 필드 자체가 없다.
   */
  assignment?: {
    realStarId: string
    season: Season
    type: MemoryType
    emotion: EmotionKey
    meaningTags: MeaningTag[]
    recordMode?: RecordMode
    promptQuestion?: string
    /** 이 별을 온라인 "우리의 우주"에도 남길지 — 관람객이 고른 값, 기본 false. */
    shareOnline: boolean
  }
}

export function buildReceipt(
  star: UniverseStar,
  company: number,
  yourStar: AssignedStarView | null,
  { includeText = RECEIPT_INCLUDES_TEXT, shareOnline = false } = {},
): ReceiptData {
  const receipt: ReceiptData = {
    starId: star.id,
    seq: star.seq,
    at: star.arrivedAt ?? star.createdAt,
    when: star.timeRef.label,
    emotion: getEmotion(star.emotion).label,
    how: getTone(star.type).cardLabel,
    company,
  }
  if (includeText) {
    // 질문에 답하는 방식이었으면 원문 대신 질문과 답을 함께 적는다.
    if (star.recordMode === 'prompt' && star.promptQuestion) {
      receipt.prompt = { question: star.promptQuestion, answer: star.text }
    } else {
      receipt.text = star.text
    }
  }
  if (yourStar) {
    receipt.star = {
      realName: yourStar.realStarName,
      korean: yourStar.korean,
      poeticName: yourStar.poeticName,
      constellationKorean: yourStar.constellationKorean,
      comfortMessage: yourStar.comfortMessage,
      // 다리가 Firebase에 성공적으로 기록하면 이 값을 "나의 별 관측 페이지"
      // 주소로 바꿔치운다. 그전까지는(또는 바꿀 수 없으면) 이 위키백과
      // 주소가 그대로 남는다 — 없는 주소를 찍기보다, 있는 대체 주소를 쓴다.
      lookupUrl: yourStar.lookupUrl,
    }
    receipt.assignment = {
      realStarId: yourStar.realStarId,
      season: star.season ?? 'unknown',
      type: star.type,
      emotion: star.emotion,
      meaningTags: yourStar.meaningTags,
      recordMode: star.recordMode,
      promptQuestion: star.promptQuestion,
      shareOnline,
    }
  }
  if (PUBLIC_UNIVERSE_URL) receipt.universeUrl = PUBLIC_UNIVERSE_URL
  return receipt
}
