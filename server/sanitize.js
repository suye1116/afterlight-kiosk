import { EVENTS } from './protocol.js'

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

/**
 * 영수증에 적히는 것.
 *
 * **기록 원문은 기본적으로 적지 않는다.** 종이는 전시장에 남고, 사진으로 찍히고,
 * 누군가의 손을 거친다. 그 사람의 한 문장이 거기까지 갈 이유가 없다.
 *
 * `allowText`는 사람이 `--receipt-text`로 켰을 때만 true가 된다.
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
  if (allowText && typeof raw.text === 'string') receipt.text = raw.text.slice(0, 120)

  return receipt
}
