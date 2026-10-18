import { getEmotion } from '@/constants/emotions'
import { getTone } from '@/constants/tones'
import type { UniverseStar } from '@/types'

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
}

export function buildReceipt(
  star: UniverseStar,
  company: number,
  { includeText = RECEIPT_INCLUDES_TEXT } = {},
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
  if (includeText) receipt.text = star.text
  return receipt
}
