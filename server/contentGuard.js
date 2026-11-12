/**
 * 서버(다리) 쪽의 마지막 방어선.
 *
 * ─── 왜 서버에도 있어야 하는가 ──────────────────────────
 *  `src/lib/inputGuard.ts`가 브라우저에서 이미 한 번(두 번) 본다.
 *  하지만 "브라우저 검사만으로 완벽한 보호가 된다고 보지 않는다" —
 *  브라우저 쪽 코드는 사람이 손댈 수 있는 곳이다(개발자 도구로 store를
 *  직접 건드리는 경우 등). 기록 원문이 실제로 서버에 닿는 유일한
 *  자리는 `--receipt-text`를 켰을 때의 영수증 인쇄뿐이라
 *  (`server/sanitize.js`), 그 좁은 자리 하나에만 같은 검사를 한 번 더
 *  둔다. 공동 우주(TouchDesigner)·Firebase 쪽은 구조적으로 원문이
 *  애초에 오지 않으므로(`sanitize.js`의 `NEVER` 목록, `firestoreWrite.js`)
 *  여기서 다시 볼 필요가 없다.
 *
 *  **두 파일(`src/lib/inputGuard.ts`·이 파일)의 규칙은 같은 결이어야
 *  한다** — 브라우저에서 통과됐는데 서버에서 막히면 "왜 영수증엔
 *  안 찍히지"로 혼란을 준다. 다만 완전히 같은 모듈을 공유하지는
 *  않는다(브라우저는 TS로, 다리는 평범한 JS로 돈다) — 그래서 목록이
 *  둘로 나뉘어 있다는 것을 이 주석으로 남겨, 한쪽을 고칠 때 다른
 *  쪽도 같이 보게 한다.
 * ───────────────────────────────────────────────────────
 */

const PROFANITY_STEMS = [
  '씨발',
  '씨팔',
  '개새끼',
  '개년',
  '병신',
  '존나',
  '좆',
  '지랄',
  '닥쳐',
  '죽어버려',
  '꺼져',
  '새끼야',
  '걸레같',
  '쓰레기같은놈',
  '쓰레기같은년',
]

/*
 * 띄어쓰기를 떼고 보면 멀쩡한 낱말과 겹치는 짧은 어간 —
 * `src/lib/inputGuard.ts`의 `SPACE_SENSITIVE_STEMS`와 같다("병 신발"
 * 문제). 이 어간만은 띄어쓰기를 뗀 글에서 찾지 않는다.
 */
const SPACE_SENSITIVE_STEMS = new Set(['병신'])

const PLAYFUL_REPEATS = new Set(['ㅋ', 'ㅎ', 'ㅠ', 'ㅜ', '.', '!', '?', '~', ' ', ','])
const PHONE_PATTERN = /(01[016789]|0[2-6][0-5]?)[-.\s]?\d{3,4}[-.\s]?\d{4}/
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

/* `src/lib/inputGuard.ts`의 `EVASION_CHARS`·`normalizeForProfanity`와 같은 규칙. */
const EVASION_CHARS = /[0-9.,!?*\-_~^'"()[\]{}@#$%&+=<>/\\|;:·…]/gu
const WHITESPACE = /\s+/gu

function normalizeForProfanity(text, { keepSpaces = false } = {}) {
  const withoutSymbols = text.replace(EVASION_CHARS, '')
  const tight = keepSpaces ? withoutSymbols : withoutSymbols.replace(WHITESPACE, '')
  return tight.replace(/(.)\1{2,}/gu, '$1')
}

function hasProfanity(text) {
  const noSpace = normalizeForProfanity(text)
  const spaced = normalizeForProfanity(text, { keepSpaces: true })
  return PROFANITY_STEMS.some((stem) => {
    const haystack = SPACE_SENSITIVE_STEMS.has(stem) ? spaced : noSpace
    return haystack.includes(stem)
  })
}

function isSpammyRepeat(text) {
  const match = /(.)\1{7,}/u.exec(text)
  if (!match) return false
  return !PLAYFUL_REPEATS.has(match[1])
}

/**
 * 이 글이 영수증에 찍혀도 괜찮은가.
 *
 * `checkMemoryText`(브라우저 쪽)와 같은 세 가지·같은 회피 대응을 본다 —
 * 욕설·혐오·괴롭힘(특수문자·숫자·늘여 쓰기를 곧게 편 뒤, 띄어쓰기 회피도
 * 멀쩡한 낱말과 안 겹치는 어간에 한해), 개인정보처럼 보이는 모양, 뜻
 * 없는 반복. 슬픔·분노·불안·후회·힘든 경험은 여기서도 당연히 걸리지
 * 않는다(같은 목록이므로). **이 역시 완벽한 검열은 아니다** — 키워드
 * 매칭의 한계는 그대로 있다.
 */
export function isPrintableText(text) {
  if (typeof text !== 'string' || text.length === 0) return true
  if (hasProfanity(text)) return false
  if (PHONE_PATTERN.test(text) || EMAIL_PATTERN.test(text)) return false
  if (isSpammyRepeat(text)) return false
  return true
}
