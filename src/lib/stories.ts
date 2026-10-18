import type { UniverseStar } from '@/types'

/**
 * 남의 이야기를 보여도 되는가.
 *
 * ─── 규칙 ───────────────────────────────────────────────
 *  **동의한 기록만 보여 준다.** 그리고 동의는 '적혀 있을 때'에만 있는 것으로
 *  본다 — 빠뜨렸거나, 옛 기록이거나, 깨진 값이면 **보여 주지 않는다.**
 *  빠뜨렸을 때 안전한 쪽으로 틀려야 한다.
 *
 *  지금 이 작품에는 **공개 동의를 묻는 걸음이 없다.** 그러므로 여기서
 *  돌아오는 것은 언제나 빈 목록이고, 우리의 우주에는 남이 적은 글이
 *  한 줄도 뜨지 않는다. 그것이 맞다 — 묻지 않았으면 보여 줄 수 없다.
 *
 *  나중에 동의를 묻게 되면, 고치는 곳은 그 걸음 하나뿐이다.
 *  이 함수와 화면은 그대로 쓴다.
 * ───────────────────────────────────────────────────────
 */
export function consentedStories(
  stars: ReadonlyArray<UniverseStar>,
): ReadonlyArray<UniverseStar> {
  return stars.filter((star) => star.shared === true && star.status === 'arrived')
}

/** 내 빛인가. 자기 기록은 언제나 자기에게 보인다. */
export function isMine(star: UniverseStar, sessionId: string): boolean {
  return star.sessionId === sessionId
}
