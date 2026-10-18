import { randomUUID } from 'node:crypto'

/**
 * 오가는 말.
 *
 * 한 마디는 JSON 한 줄이고, 봉투는 언제나 같다.
 *
 *   { v, id, event, at, origin, ...짐 }
 *
 * `v`      규약의 판. 지금은 1
 * `id`     이 마디 하나의 이름. **같은 id는 두 번 처리하지 않는다**
 * `event`  아래 EVENTS 중 하나
 * `at`     보낸 때 (epoch ms)
 * `origin` live(사람이 겪은 일) | stage(점검하려고 손으로 낸 것)
 *
 * ─── 작업본의 다리와의 관계 ────────────────────────────
 *  원작 작업본(`~/Desktop/조형실습/AFTERLIGHT/bridge/`)에 이미 다리가 있고,
 *  거기서 정한 것들을 그대로 잇는다 — 봉투의 모양, `origin`으로 점검 신호를
 *  가르는 법, 사람이 쓴 글은 벽으로 보내지 않는다는 원칙, `ack`로 넘긴 수와
 *  받은 수를 따로 세는 법. **그 저장소는 건드리지 않았다.**
 *
 *  이벤트 이름은 다르다. 그쪽은 한 사람의 하늘을 위한 것이고
 *  (`star.returning` · `constellation.named` · `scene.changed`),
 *  여기는 공동 우주와 키오스크를 위한 것이다. 겹치는 둘(`star.arrived`,
 *  `sky.snapshot`→`universe.state`)은 뜻이 같도록 맞췄다.
 * ───────────────────────────────────────────────────────
 */

export const VERSION = 1

/**
 * 일곱 가지 말.
 *
 * 이보다 늘어나면 다리가 하는 일이 아니라 작품이 하는 일을 다리가 떠안게 된다.
 */
export const EVENTS = {
  /** 하늘 → 다리. 빛 하나를 보냅니다 */
  STAR_REQUESTED: 'star.requested',
  /** 다리 → 하늘. 받았습니다 (검증을 통과했다) */
  STAR_ACCEPTED: 'star.accepted',
  /** 하늘 → 다리 → 벽. 그 빛이 우리의 우주에 닿았습니다 */
  STAR_ARRIVED: 'star.arrived',
  /** 다리 → 벽. 이 별자리가 이만큼 자랐습니다 */
  CONSTELLATION_UPDATED: 'constellation.updated',
  /** 하늘 → 다리 → 벽. 지금 우주가 이렇습니다 */
  UNIVERSE_STATE: 'universe.state',
  /** 아두이노 → 다리 → 하늘. 버튼이 눌렸습니다 */
  BUTTON_PRESSED: 'button.pressed',
  /** 다리 → 프린터. 이 영수증을 내보내 주세요 */
  RECEIPT_REQUESTED: 'receipt.requested',
}

/** 다리가 제 상태를 알리는 말. 위의 일곱과 달리 작품의 일이 아니다. */
export const BRIDGE_STATUS = 'bridge.status'
/** 다리가 영수증의 결과를 알리는 말 */
export const RECEIPT_RESULT = 'receipt.result'

/**
 * 장치 사이드채널 — 손 감지 센서와 LED.
 *
 * 위의 일곱과 같은 자리에 두지 않는다. `bridge.status`처럼 **다리와 장치
 * 사이의 사정**을 나르는 말이다 — 작품의 뜻(별·별자리·우주)을 싣지 않는다.
 *
 *   SENSOR_PROXIMITY  아두이노 → 다리 → 하늘(만). 지금 거리가 얼마인가.
 *                      "가깝다"의 판정과 1초 보유는 하늘이 한다 —
 *                      다리는 원값만 나른다.
 *   STAR_SHOWN         다리 → 하늘. 벽이 `shown`을 알려 온 별의 id.
 *                      (지금까지는 집계 수치로만 하늘에 갔다.)
 *   LED_SET            하늘 → 다리 → 아두이노(시리얼). LED를 몇 개 켤 것인가.
 */
export const SENSOR_PROXIMITY = 'sensor.proximity'
export const STAR_SHOWN = 'star.shown'
export const LED_SET = 'led.set'

const KNOWN = new Set([
  ...Object.values(EVENTS),
  BRIDGE_STATUS,
  RECEIPT_RESULT,
  SENSOR_PROXIMITY,
  STAR_SHOWN,
  LED_SET,
])

/** 벽이 다리에게 거는 말 */
export const COMMANDS = new Set([
  /** 받았습니다 — 넘긴 수와 받은 수를 따로 세는 데 쓴다 */
  'ack',
  /** 화면에 띄웠습니다 — **받은 것과 띄운 것은 다른 일이다** */
  'shown',
  /** 저는 이 면입니다 (north / east / …). 다리는 적어 두기만 한다 */
  'hello',
  /** 지금 우주를 한 번 더 보내 주세요 */
  'resend',
])

export const ORIGINS = new Set(['live', 'stage'])

/** 이 마디 하나의 이름. 같은 이름은 두 번 처리하지 않는다. */
export function newEventId() {
  return randomUUID()
}

/** 봉투에 담는다 */
export function envelope(event, body = {}, origin = 'live') {
  return {
    v: VERSION,
    id: newEventId(),
    event,
    at: Date.now(),
    origin,
    ...body,
  }
}

export function isKnownEvent(event) {
  return KNOWN.has(event)
}

/**
 * 받아들일 만한 마디인가.
 *
 * 돌려주는 것은 `{ ok, reason }`이다. 거절하는 이유를 적어 두어야
 * 전시장에서 "왜 안 가지?"를 세어 볼 수 있다.
 */
export function readEnvelope(raw) {
  let message
  try {
    message = JSON.parse(raw)
  } catch {
    return { ok: false, reason: 'JSON이 아닙니다' }
  }

  if (typeof message !== 'object' || message === null || Array.isArray(message)) {
    return { ok: false, reason: '객체가 아닙니다' }
  }

  // 벽이 거는 말은 봉투가 아니다
  if (typeof message.command === 'string') {
    if (!COMMANDS.has(message.command)) return { ok: false, reason: '모르는 부름' }
    return { ok: true, command: message }
  }

  if (message.v !== VERSION) return { ok: false, reason: `규약의 판이 다릅니다 (${message.v})` }
  if (typeof message.id !== 'string' || message.id.length === 0 || message.id.length > 128) {
    return { ok: false, reason: '이벤트 id가 없습니다' }
  }
  if (!isKnownEvent(message.event)) return { ok: false, reason: `모르는 이벤트 (${message.event})` }
  if (!Number.isFinite(message.at)) return { ok: false, reason: '보낸 때가 없습니다' }
  if (message.origin !== undefined && !ORIGINS.has(message.origin)) {
    return { ok: false, reason: '모르는 origin' }
  }

  // 적혀 있지 않으면 live로 읽는다 (작업본의 규칙 그대로)
  message.origin ??= 'live'
  return { ok: true, message }
}

/**
 * 이미 지나간 마디인가.
 *
 * 같은 id가 두 번 오는 일은 생긴다 — 끊겼다 이어지며 다시 보내거나,
 * 손가락이 두 번 닿거나. 두 번 처리하면 벽에 같은 별이 둘 뜬다.
 *
 * 전부 기억하면 하루 종일 켜 둔 전시에서 메모리가 샌다. 최근 것만 들고 있다.
 */
export function createSeen(limit = 4000) {
  const seen = new Set()
  const order = []
  return {
    /** 처음 보는 것이면 true. 이미 본 것이면 false. */
    first(id) {
      if (seen.has(id)) return false
      seen.add(id)
      order.push(id)
      if (order.length > limit) seen.delete(order.shift())
      return true
    },
    get size() {
      return seen.size
    },
  }
}
