import { EVENTS } from './protocol.js'
import { isPrintableText } from './contentGuard.js'

/**
 * 걸러내는 자리.
 *
 * **사람이 쓴 글은 벽으로 가지 않는다.**
 *
 * 하늘(브라우저)이 이미 막고 있다 — `toWallLight()`가 문장을 떼어 내므로
 * 애초에 여기까지 오지 않는다. 그런데도 한 번 더 막는 것은,
 * **사람의 기록을 스위치 하나에 걸어 두지 않기 위해서다.**
 * 누군가 하늘 쪽 코드를 고쳐 문장을 실어 보내도, 다리가 떨어낸다.
 *
 * 방식은 '지우기'가 아니라 **'허용 목록'**이다. 목록에 없는 칸은 전부 떨어진다.
 * 새 칸이 생겼을 때 깜빡 잊어도 그 칸은 벽으로 가지 않는다 — 안전한 쪽으로 틀린다.
 */

/** 벽이 별 하나를 그리는 데 필요한 것. 이게 전부다. */
const STAR_FIELDS = {
  id: 'string',
  // 전송 하나를 가리키는 고유 이름. 지금은 id와 같은 값이다(WallLight 설명 참고)
  transferId: 'string',
  emotion: 'string',
  type: 'string',
  constellation: 'string',
  x: 'number',
  y: 'number',
  brightness: 'number',
  seed: 'number',
  createdAt: 'number',
}

/** 절대로 벽에 가지 않는 것. 들어 있으면 떨어내고 세어 둔다. */
export const NEVER = ['text', 'timeRef', 'sessionId', 'note', 'reaction', 'name', 'label']

const TYPES = new Set(['keep', 'letgo'])

const clamp01 = (value) => Math.min(1, Math.max(0, value))

function cleanStar(raw) {
  if (typeof raw !== 'object' || raw === null) return null

  const star = {}
  for (const [key, kind] of Object.entries(STAR_FIELDS)) {
    const value = raw[key]
    if (kind === 'string') {
      if (typeof value !== 'string' || value.length === 0 || value.length > 128) continue
      star[key] = value
    } else {
      // NaN과 Infinity는 조용히 떨어진다. 벽에서 그리면 화면이 깨진다.
      if (!Number.isFinite(value)) continue
      star[key] = value
    }
  }

  // 별을 그릴 만큼 적혀 있지 않으면 그 마디는 쓸모가 없다
  if (!star.id || !star.emotion || !star.constellation) return null
  if (!TYPES.has(star.type)) return null
  if (star.x === undefined || star.y === undefined) return null

  // 0~1을 벗어나면 가장자리로 묶는다 — 벽이 화면 밖을 그리지 않게
  star.x = clamp01(star.x)
  star.y = clamp01(star.y)
  star.brightness = star.brightness === undefined ? 0.6 : clamp01(star.brightness)

  return star
}

function cleanConstellation(raw) {
  if (typeof raw !== 'object' || raw === null) return null
  const id = raw.id
  if (typeof id !== 'string' || id.length === 0 || id.length > 128) return null
  const size = Number.isFinite(raw.size) ? Math.max(0, Math.floor(raw.size)) : 0
  const emotion = typeof raw.emotion === 'string' ? raw.emotion.slice(0, 64) : ''
  return { id, emotion, size }
}

/**
 * 벽으로 넘길 수 있는 모양으로 깎는다.
 *
 * 돌려주는 것은 `{ ok, message, dropped }`.
 * `dropped`는 떨어낸 칸들이다 — 세어 두면 "문장이 새고 있지 않은가"를 볼 수 있다.
 */
export function sanitize(message) {
  const dropped = []
  for (const key of NEVER) {
    if (key in message) dropped.push(key)
    if (message.star && typeof message.star === 'object' && key in message.star) {
      dropped.push(`star.${key}`)
    }
  }

  const base = {
    v: message.v,
    id: message.id,
    event: message.event,
    at: message.at,
    origin: message.origin,
  }

  switch (message.event) {
    case EVENTS.STAR_REQUESTED:
    case EVENTS.STAR_ACCEPTED:
    case EVENTS.STAR_ARRIVED: {
      const star = cleanStar(message.star)
      if (!star) return { ok: false, reason: '별을 그릴 만큼 적혀 있지 않습니다', dropped }
      const out = { ...base, star }
      if (Number.isFinite(message.travelSeconds)) {
        out.travelSeconds = Math.min(30, Math.max(0, message.travelSeconds))
      }
      return { ok: true, message: out, dropped }
    }

    case EVENTS.CONSTELLATION_UPDATED: {
      const constellation = cleanConstellation(message.constellation)
      if (!constellation) return { ok: false, reason: '별자리를 알 수 없습니다', dropped }
      return { ok: true, message: { ...base, constellation }, dropped }
    }

    case EVENTS.UNIVERSE_STATE: {
      const raw = message.universe
      if (typeof raw !== 'object' || raw === null) {
        return { ok: false, reason: '우주의 상태가 없습니다', dropped }
      }
      const byConstellation = {}
      const source = raw.byConstellation
      if (typeof source === 'object' && source !== null) {
        for (const [key, value] of Object.entries(source)) {
          if (typeof key !== 'string' || key.length > 128) continue
          if (!Number.isFinite(value)) continue
          byConstellation[key] = Math.max(0, Math.floor(value))
        }
      }
      const count = (name) => (Number.isFinite(raw[name]) ? Math.max(0, Math.floor(raw[name])) : 0)
      return {
        ok: true,
        dropped,
        message: {
          ...base,
          universe: {
            total: count('total'),
            keep: count('keep'),
            letgo: count('letgo'),
            byConstellation,
          },
        },
      }
    }

    case EVENTS.BUTTON_PRESSED: {
      const button = typeof message.button === 'string' ? message.button.slice(0, 32) : ''
      if (!button) return { ok: false, reason: '어느 버튼인지 없습니다', dropped }
      return { ok: true, message: { ...base, button, down: message.down !== false }, dropped }
    }

    default:
      return { ok: false, reason: `벽으로 넘기지 않는 이벤트 (${message.event})`, dropped }
  }
}

/** `https://`로 시작하는, 너무 길지 않은 주소만 받는다. 그 외는 조용히 떨어진다. */
function httpsUrl(value, max) {
  if (typeof value !== 'string') return ''
  if (!value.startsWith('https://')) return ''
  if (value.length > max) return ''
  return value
}

const SEASONS = new Set(['spring', 'summer', 'autumn', 'winter', 'unknown'])
const MEMORY_TYPES = new Set(['keep', 'letgo'])
const RECORD_MODES = new Set(['free', 'prompt'])

/**
 * Firebase에 쓸 **구조화된** 배정 정보. 허용 목록 바깥은 전부 떨어진다.
 *
 * 여기 적힌 칸 중 어디에도 "사람이 적은 글"은 없다 — 전부 고른 항목이거나
 * 짚인 태그 이름뿐이다. 하나라도 모양이 이상하면(허용 목록을 벗어나면)
 * **이 블록 전체를 버린다** — Firebase 쪽은 반쪽짜리를 받지 않는다.
 * (`cleanReceiptStar`와 달리 `recordMode`·`promptQuestion`은 원래
 * 없을 수 있는 칸이라 "전부 비어 있으면 안 된다" 규칙은 적용하지 않는다.)
 */
function cleanAssignment(raw) {
  if (typeof raw !== 'object' || raw === null) return null

  const realStarId = typeof raw.realStarId === 'string' ? raw.realStarId.slice(0, 64) : ''
  if (!realStarId) return null

  if (!SEASONS.has(raw.season)) return null
  if (!MEMORY_TYPES.has(raw.type)) return null
  if (typeof raw.emotion !== 'string' || raw.emotion.length === 0 || raw.emotion.length > 32) {
    return null
  }

  const meaningTags = Array.isArray(raw.meaningTags)
    ? raw.meaningTags.filter((tag) => typeof tag === 'string' && tag.length <= 32).slice(0, 16)
    : []

  const assignment = {
    realStarId,
    season: raw.season,
    type: raw.type,
    emotion: raw.emotion,
    meaningTags,
    shareOnline: raw.shareOnline === true,
  }

  if (RECORD_MODES.has(raw.recordMode)) assignment.recordMode = raw.recordMode
  if (typeof raw.promptQuestion === 'string' && raw.promptQuestion.length > 0) {
    assignment.promptQuestion = raw.promptQuestion.slice(0, 200)
  }

  return assignment
}

/**
 * 실제 별 배정 결과. 허용 목록 바깥은 전부 떨어진다 — 안전한 쪽으로 틀린다.
 * 하나라도 비어 있으면(특히 `lookupUrl`이 `https://`가 아니면) 통째로
 * 버린다 — 반쪽짜리 별 정보를 종이에 찍지 않는다.
 */
function cleanReceiptStar(raw, text) {
  if (typeof raw !== 'object' || raw === null) return null

  const star = {
    realName: text(raw.realName, 64),
    korean: text(raw.korean, 64),
    poeticName: text(raw.poeticName, 64),
    constellationKorean: text(raw.constellationKorean, 32),
    comfortMessage: text(raw.comfortMessage, 160),
    lookupUrl: httpsUrl(raw.lookupUrl, 256),
  }

  if (Object.values(star).some((value) => value.length === 0)) return null
  return star
}

/**
 * 영수증에 적히는 것.
 *
 * **기록 원문은 기본적으로 적지 않는다.** 종이는 전시장에 남고, 사진으로 찍히고,
 * 누군가의 손을 거친다. 그 사람의 한 문장이 거기까지 갈 이유가 없다.
 *
 * `allowText`는 사람이 `--receipt-text`로 켰을 때만 true가 된다.
 *
 * `star`(실제 별 배정 결과)와 `universeUrl`("우리의 우주" 공개 주소)도
 * 같은 허용 목록 방식을 따른다 — 둘 다 하늘(브라우저) 쪽에서 이미
 * 없는 값을 지어내지 않지만, 다리를 한 번 더 거치면서도 같은 원칙을
 * 지킨다. 모양이 이상하면(허용 목록을 벗어나면) 조용히 빠진다 —
 * 그 칸이 없는 영수증이 찍힐 뿐, 잘못된 값이 찍히지는 않는다.
 */
export function sanitizeReceipt(raw, { allowText = false } = {}) {
  if (typeof raw !== 'object' || raw === null) return null

  const text = (value, max) =>
    typeof value === 'string' && value.length > 0 ? value.slice(0, max) : ''

  const receipt = {
    starId: text(raw.starId, 128),
    seq: Number.isFinite(raw.seq) ? Math.max(0, Math.floor(raw.seq)) : 0,
    at: Number.isFinite(raw.at) ? raw.at : Date.now(),
    // 화면에 보이는 이름들. 사람이 적은 글이 아니라 고른 항목이다.
    when: text(raw.when, 32),
    emotion: text(raw.emotion, 32),
    how: text(raw.how, 32),
    company: Number.isFinite(raw.company) ? Math.max(0, Math.floor(raw.company)) : 0,
  }

  if (!receipt.starId) return null
  /*
   * 브라우저가 이미 한 번(두 번) 걸러낸 글이지만, 그 코드는 사람이
   * 손댈 수 있는 자리라 믿지 않는다(`contentGuard.js` 설명 참고) —
   * 명백한 욕설·개인정보·뜻 없는 반복이면 **종이에 찍지 않는다.**
   * 슬픔·분노·불안·후회 같은 말은 같은 목록에 없으므로 여기서도
   * 당연히 그대로 찍힌다.
   */
  if (allowText && typeof raw.text === 'string' && isPrintableText(raw.text)) {
    receipt.text = raw.text.slice(0, 120)
  }

  /*
   * 질문에 답하는 방식이었을 때만. `text`와 같은 자리이므로 같은 조건
   * (`allowText`)을 따른다 — 질문과 답 둘 다 있어야만 받는다(반쪽짜리는
   * 찍지 않는다). 답에 같은 내용 검사를 한 번 더 한다 — 질문은 고정된
   * 10개 중 하나라 검사할 것이 없다.
   */
  if (allowText && raw.prompt && typeof raw.prompt === 'object') {
    const question = text(raw.prompt.question, 120)
    const answer = text(raw.prompt.answer, 120)
    if (question && answer && isPrintableText(answer)) receipt.prompt = { question, answer }
  }

  const star = cleanReceiptStar(raw.star, text)
  if (star) receipt.star = star

  const universeUrl = httpsUrl(raw.universeUrl, 256)
  if (universeUrl) receipt.universeUrl = universeUrl

  /*
   * Firebase에 쓸 구조화된 배정 정보. `star`(화면에 보일 글)와는 별개로,
   * 없어도(모양이 이상해도) 영수증 자체는 그대로 찍힌다 — 이 칸은
   * "나의 별 관측 페이지" QR을 살리는 데만 쓰이고, 없다고 영수증 인쇄를
   * 막지 않는다.
   */
  const assignment = cleanAssignment(raw.assignment)
  if (assignment) receipt.assignment = assignment

  return receipt
}
