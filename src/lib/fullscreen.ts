/**
 * 전체화면.
 *
 * 작품이 브라우저 껍데기 없이 홀로 놓이면 어두운 우주가 훨씬 깊어진다.
 * 다만 그건 **덤**이다. 전체화면이 되지 않아도 작품은 그대로 작동해야 한다.
 *
 * 그래서 이 파일의 모든 함수는 절대 던지지 않는다. 브라우저가 이 기능을
 * 모르거나, 정책으로 막았거나, 사용자가 거절해도 조용히 false를 돌려준다.
 *
 * 로드하자마자 부르면 안 된다 — 브라우저는 사용자의 손짓에서 비롯된
 * 요청만 받아 준다. 그래서 인트로의 첫 누름에서만 부른다.
 */

/** 예전 웹킷 이름까지 함께 본다 */
interface LegacyElement extends HTMLElement {
  webkitRequestFullscreen?: () => Promise<void> | void
}
interface LegacyDocument extends Document {
  webkitFullscreenElement?: Element | null
  webkitExitFullscreen?: () => Promise<void> | void
}

/** 이 브라우저가 전체화면을 아는가 */
export function canFullscreen(): boolean {
  const root = globalThis.document?.documentElement as LegacyElement | undefined
  if (!root) return false
  const doc = globalThis.document as LegacyDocument
  // fullscreenEnabled는 iframe 안에서 막혀 있을 때 false가 된다
  if (doc.fullscreenEnabled === false) return false
  return typeof root.requestFullscreen === 'function' ||
    typeof root.webkitRequestFullscreen === 'function'
}

/** 지금 전체화면인가 */
export function isFullscreen(): boolean {
  const doc = globalThis.document as LegacyDocument | undefined
  if (!doc) return false
  return Boolean(doc.fullscreenElement ?? doc.webkitFullscreenElement)
}

/**
 * 전체화면으로 들어간다.
 *
 * 돌려주는 값은 '되었는가'일 뿐 아무도 이 값에 기대지 않는다.
 * 실패는 흔한 일이고(모바일 사파리, iframe, 정책) 전혀 문제가 아니다.
 */
export async function enterFullscreen(): Promise<boolean> {
  if (!canFullscreen() || isFullscreen()) return false
  const root = globalThis.document.documentElement as LegacyElement
  try {
    const request = root.requestFullscreen?.bind(root) ?? root.webkitRequestFullscreen?.bind(root)
    if (!request) return false
    // 거절은 reject로 온다. 여기서 삼키지 않으면 콘솔에 오류가 남는다.
    await request()
    return true
  } catch {
    // 전체화면이 되지 않아도 작품은 100dvh 그대로 화면을 채운다
    return false
  }
}

/** 전체화면에서 나온다. 들어갈 때와 마찬가지로 조용히 실패한다. */
export async function exitFullscreen(): Promise<void> {
  if (!isFullscreen()) return
  const doc = globalThis.document as LegacyDocument
  try {
    await (doc.exitFullscreen?.bind(doc) ?? doc.webkitExitFullscreen?.bind(doc))?.()
  } catch {
    // ESC로 이미 빠져나왔을 수 있다. 그것도 정상이다.
  }
}
