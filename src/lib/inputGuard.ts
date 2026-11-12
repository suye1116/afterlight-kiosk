/**
 * 적은 글을 보내기 전에 한 번 보는 자리 — 외부 AI 검열 서비스를 쓰지 않는다.
 *
 * ─── 무엇을 막고, 무엇을 절대 막지 않는가 ─────────────────
 *  막는다: 명백한 욕설·혐오 표현·괴롭힘, 전화번호·이메일처럼 보이는 글,
 *         뜻 없이 같은 글자만 되풀이한 악의적 스팸.
 *
 *  **절대 막지 않는다**: 슬픔·분노·불안·후회·힘든 경험을 적은 글,
 *  'ㅋㅋㅋㅋㅋ'·'ㅎㅎㅎ'·'ㅠㅠㅠ'처럼 자연스러운 한국어 반복 표현,
 *  짧지만 뜻이 있을 수 있는 한두 글자(그래서 최소 글자 수 제한을 두지
 *  않는다 — "ㅁ" 한 글자도 그 사람에게는 뜻이 있을 수 있다).
 *
 *  **흔한 회피도 고려한다**(§1) — 욕설 검사만은 띄어쓰기·특수문자
 *  삽입·글자 늘여 쓰기를 먼저 "곧게 편 뒤"에 본다(`normalizeForProfanity`).
 *  그래도 **완벽한 검열은 아니다** — 키워드·패턴 매칭의 한계는 그대로
 *  있고, 새로운 회피 방식은 늘 더 있을 수 있다.
 *
 *  이 파일은 **키워드·패턴 매칭**만 한다. 뜻을 이해하지 못하므로 틀릴
 *  수 있다는 것을 알고 쓴다 — 그래도 외부로 기억 원문을 보내 "맞는지"
 *  물어보지 않는다. 애매하면 넓게 통과시키는 쪽으로 틀린다(오탐보다
 *  미탐을 택한다 — `score.ts`의 "불확실하면 편들지 않는다"와 같은 결).
 * ───────────────────────────────────────────────────────
 */

export type GuardReason = 'profanity' | 'personal-info' | 'spam'

export type GuardResult = { ok: true } | { ok: false; reason: GuardReason }

/*
 * 명백한 욕설·혐오 표현만 담는다. 감정을 나타내는 말(힘들다·죽고싶다·
 * 우울하다 등)은 **의도적으로 하나도 없다** — 저 말들은 막을 대상이
 * 아니라 이 작품이 받아야 할 이야기다.
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
 * 띄어쓰기를 떼고 보면 **멀쩡한 낱말과 겹치는** 짧은 어간들.
 *
 * "병신"이 대표적이다 — "병 신발을 샀다"·"그 병 신다가 깨졌다"처럼
 * 평범한 두 낱말(병 + 신발/신다)이 공백만 없어지면 "병신"을 포함해
 * 버린다. 그래서 **이 어간들만은 띄어쓰기를 뗀 글에서 찾지 않는다**
 * (특수문자·숫자를 떼거나 늘여 쓴 글자를 줄이는 것까지는 그대로 한다 —
 * 그 둘은 이런 식으로 멀쩡한 낱말과 겹칠 일이 거의 없다). 띄어쓰기
 * 없이 그대로 적었을 때만 걸린다 — §1의 "오탐을 최소화"를 위해서다.
 */
const SPACE_SENSITIVE_STEMS = new Set(['병신'])

/** 자연스러운 한국어 반복 표현 — 같은 글자가 길게 이어져도 스팸으로 보지 않는다. */
const PLAYFUL_REPEATS = new Set(['ㅋ', 'ㅎ', 'ㅠ', 'ㅜ', '.', '!', '?', '~', ' ', ','])

/** 한국 휴대전화·일반 전화번호처럼 보이는 숫자 모양 */
const PHONE_PATTERN = /(01[016789]|0[2-6][0-5]?)[-.\s]?\d{3,4}[-.\s]?\d{4}/
/** 이메일처럼 보이는 모양 */
const EMAIL_PATTERN = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

/*
 * 흔히 사이에 끼워 넣어 검사를 피하려는 글자들 — 마침표·느낌표 같은
 * 특수문자, 숫자. 매칭 전에 떼어 낸다("씨.발"·"씨1발"처럼 글자 사이에
 * 뭔가 끼워 넣는 회피를 막는다). **띄어쓰기는 여기 없다** — 따로
 * 다룬다(아래 `normalizeForProfanity`의 `keepSpaces` 설명 참고).
 */
const EVASION_CHARS = /[0-9.,!?*\-_~^'"()[\]{}@#$%&+=<>/\\|;:·…]/gu
const WHITESPACE = /\s+/gu

/**
 * 욕설 검사 전에 글을 "곧게 편다".
 *
 *   1. 특수문자·숫자를 뗀다 — "씨.발"·"씨1발" → "씨발"
 *   2. 같은 글자가 3번 이상 이어지면 하나로 줄인다 — "개새새새끼" → "개새끼"
 *      (어간의 한 글자를 늘여 쓰는 회피를 잡는다. 'ㅋㅋㅋ' 같은 반복은
 *      **여기서는 상관없다** — 그 반복 자체를 막는 게 아니라, 욕설
 *      어간이 숨어 있는지만 본다.)
 *   3. `keepSpaces`가 거짓이면 띄어쓰기도 뗀다 — "씨 발" → "씨발".
 *      **단, 이건 `SPACE_SENSITIVE_STEMS`에는 하지 않는다** — "병 신발"
 *      (병 + 신발, 멀쩡한 두 낱말)처럼 띄어쓰기만 없어지면 "병신"을
 *      포함해 버리는 낱말이 있기 때문이다(§1 "오탐을 최소화").
 *
 * **이걸로도 다 잡지 못한다.** 어간과 무관한 글자를 가운데 하나 끼워
 * 넣는 창작 회피(예: 이미 지운 특수문자가 아니라 멀쩍이 떨어진 한글
 * 글자를 끼워 넣는 경우)까지는 못 잡는다 — 그래서 "완벽한 검열"이라고
 * 말하지 않는다(§1). 더 공격적으로 다듬을수록(예: 모든 낱말에서
 * 띄어쓰기를 뗀다 등) 평범한 문장이 우연히 욕설처럼 보일 틈도 함께
 * 늘어난다(오탐) — 그 균형을 넘지 않는다.
 */
function normalizeForProfanity(text: string, { keepSpaces = false } = {}): string {
  const withoutSymbols = text.replace(EVASION_CHARS, '')
  const tight = keepSpaces ? withoutSymbols : withoutSymbols.replace(WHITESPACE, '')
  return tight.replace(/(.)\1{2,}/gu, '$1')
}

function hasProfanity(text: string): boolean {
  const noSpace = normalizeForProfanity(text)
  const spaced = normalizeForProfanity(text, { keepSpaces: true })
  return PROFANITY_STEMS.some((stem) => {
    const haystack = SPACE_SENSITIVE_STEMS.has(stem) ? spaced : noSpace
    return haystack.includes(stem)
  })
}

function hasPersonalInfo(text: string): boolean {
  return PHONE_PATTERN.test(text) || EMAIL_PATTERN.test(text)
}

/**
 * 뜻 없이 같은 글자만 되풀이했는가.
 *
 * 같은 글자가 8번 이상 이어져도, 그 글자가 'ㅋ'·'ㅎ'·'ㅠ' 같은 한국어의
 * 자연스러운 반복 표현이면 스팸으로 보지 않는다 — §3의 요청대로다.
 */
function isSpammyRepeat(text: string): boolean {
  const match = /(.)\1{7,}/u.exec(text)
  if (!match) return false
  return !PLAYFUL_REPEATS.has(match[1])
}

/**
 * 기억·질문 답을 보내기 전에 본다. 비어 있는지는 이 함수의 일이
 * 아니다(`useKiosk`가 따로 본다) — 여기는 오직 "이 모양이 명백히
 * 문제가 되는가"만 본다.
 */
export function checkMemoryText(text: string): GuardResult {
  if (hasProfanity(text)) return { ok: false, reason: 'profanity' }
  if (hasPersonalInfo(text)) return { ok: false, reason: 'personal-info' }
  if (isSpammyRepeat(text)) return { ok: false, reason: 'spam' }
  return { ok: true }
}

/*
 * ─── 짧은 시간 반복 제출 ────────────────────────────────
 *  **관람객 한 번의 체험 단위가 아니라, 이 기계 전체를 기준으로 짧게**
 *  둔다. `useKiosk.sessionId`는 브라우저 탭이 살아 있는 동안 바뀌지
 *  않아서(`reset()`이 지우지 않는다), 그걸 기준으로 "몇 분간 금지"를
 *  걸면 **다음 관람객까지 그 벌을 물려받는다** — 바로 이 파일의 원칙이
 *  막으려는 일이다.
 *
 *  그래서 창을 **아주 짧게**(15초) 둔다. 실제 관람객 한 명이 처음부터
 *  빛을 보내기까지는 아무리 빨라도 수십 초가 걸리므로, 평범한 다음
 *  관람객은 이 시간을 넘긴 뒤에야 보내게 되어 있어 거의 걸릴 일이
 *  없다. 반면 같은 사람이 전송 직후 곧바로 처음부터 다시 돌아와
 *  연달아 보내려는 경우(스팸성 반복)는 이 창에 걸린다.
 * ───────────────────────────────────────────────────────
 */
const RESEND_COOLDOWN_MS = 15_000
let lastSentAt = 0

/** 지금 보내도 되는가. 재시도 가능한 쿨다운이라 한 번 걸려도 영영 막히지 않는다. */
export function canSendNow(now: number = Date.now()): boolean {
  return now - lastSentAt >= RESEND_COOLDOWN_MS
}

/** 실제로 보냈다고 기록한다. `send()`가 성공했을 때만 부른다. */
export function markSent(now: number = Date.now()): void {
  lastSentAt = now
}

/** 검사 스크립트·테스트 전용 — 쿨다운을 처음 상태로 되돌린다. */
export function resetGuardForTest(): void {
  lastSentAt = 0
}
