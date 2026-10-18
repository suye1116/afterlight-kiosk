import type { UniverseStar, WallLight } from '@/types'
import type { ReceiptData } from './receipt'

/**
 * 하늘 쪽에서 다리에 거는 손.
 *
 * ─── 지키는 것 ─────────────────────────────────────────
 *  **다리가 없어도 작품은 그대로 돈다.** 이 파일의 어떤 함수도 던지지 않고,
 *  붙지 않았으면 조용히 흘려보낸다. 전시 중에 서버가 죽어도 관람객은
 *  아무것도 눈치채지 못해야 한다.
 *
 *  **지나간 신호를 쌓아 두지 않는다.** 다시 이어졌을 때 밀린 순간들이
 *  한꺼번에 쏟아지면 그건 도착이 아니라 알림이 된다. 빛은 그때 그 순간의 것이다.
 *  다만 '지금 우주가 이렇다'는 한 장은 다르다 — 이어질 때마다 한 번 보낸다.
 * ───────────────────────────────────────────────────────
 */

export const BRIDGE_VERSION = 1

/** 일곱 가지 말. 서버의 `server/protocol.js`와 같아야 한다. */
export const EVENTS = {
  STAR_REQUESTED: 'star.requested',
  STAR_ACCEPTED: 'star.accepted',
  STAR_ARRIVED: 'star.arrived',
  CONSTELLATION_UPDATED: 'constellation.updated',
  UNIVERSE_STATE: 'universe.state',
  BUTTON_PRESSED: 'button.pressed',
  RECEIPT_REQUESTED: 'receipt.requested',
} as const

/**
 * 장치 사이드채널. 위 일곱과 같은 자리에 두지 않는다 — `bridge.status`처럼
 * 다리와 장치 사이의 사정을 나르는 말이고, 작품의 뜻(별·별자리·우주)을
 * 싣지 않는다. 서버의 `server/protocol.js`와 같아야 한다.
 */
export const DEVICE_EVENTS = {
  /** 아두이노 → 다리 → 하늘. 지금 거리(cm). "가깝다"의 판정은 하늘이 한다. */
  SENSOR_PROXIMITY: 'sensor.proximity',
  /** 다리 → 하늘. 벽이 이 별을 실제로 띄웠다. */
  STAR_SHOWN: 'star.shown',
  /** 하늘 → 다리 → 아두이노(시리얼). LED를 몇 개 켤 것인가. */
  LED_SET: 'led.set',
} as const

/** 웹사이트와 다리 사이가 어떤가 */
export type LinkState = 'idle' | 'connecting' | 'open' | 'closed'

/** 다리가 알려 주는, 다리 너머의 상태 */
export interface BridgeStatus {
  sky: number
  td: number
  walls: string[]
  arduino: 'off' | 'opening' | 'open' | 'error'
  arduinoNote: string
  printer: 'off' | 'ready' | 'error'
  /** none · file · tcp — **tcp일 때만 진짜 종이가 나온다** */
  printerMode: 'none' | 'file' | 'tcp'
  printerNote: string
  stars: { accepted: number; relayed: number; received: number; shown: number }
  rejected: number
  duplicate: number
  stripped: number
}

export interface BridgeHandle {
  send(event: string, body?: Record<string, unknown>): boolean
  star(event: string, star: UniverseStar, extra?: Record<string, unknown>): boolean
  receipt(receipt: ReceiptData): boolean
  /** LED를 몇 개 켤 것인가(0~5), 또는 `'off'`로 끈다 */
  led(step: number | 'off'): boolean
  close(): void
}

/**
 * 다리의 주소.
 *
 * 태블릿에서 열면 `location.hostname`이 그 기계의 주소가 되므로,
 * 같은 공유기 안의 다리에 그대로 닿는다. 다른 데 띄웠으면
 * 주소에 `?bridge=ws://192.168.0.7:9981/sky`를 붙인다.
 */
export function bridgeUrl(): string {
  try {
    const asked = new URLSearchParams(globalThis.location.search).get('bridge')
    if (asked) return asked.endsWith('/sky') ? asked : `${asked.replace(/\/$/, '')}/sky`
    const host = globalThis.location.hostname || '127.0.0.1'
    return `ws://${host}:9981/sky`
  } catch {
    return 'ws://127.0.0.1:9981/sky'
  }
}

/** 다시 붙기까지 기다리는 시간. 끝에서는 드물게 두드린다. */
const BACKOFF = [900, 1800, 3600, 8000, 30_000]

/**
 * 문장을 떼어 낸다. 벽으로 건너가는 것은 빛뿐이다.
 *
 * 다리도 한 번 더 떨어내지만(`server/sanitize.js`), 여기서 먼저 떼는 것은
 * **사람의 기록을 서버 하나에 맡겨 두지 않기 위해서다.**
 */
export function toWallLight(star: UniverseStar): WallLight {
  return {
    id: star.id,
    // 전송 하나를 가리키는 고유 이름. 지금은 id와 같다 — WallLight 설명 참고
    transferId: star.id,
    createdAt: star.createdAt,
    emotion: star.emotion,
    type: star.type,
    constellation: star.constellation,
    x: star.x,
    y: star.y,
    brightness: star.brightness,
    seed: star.seed,
  }
}

export function createBridge(options: {
  url?: string
  onLink?: (state: LinkState) => void
  onStatus?: (status: BridgeStatus) => void
  onButton?: (button: string, down: boolean) => void
  /** 손 감지 센서의 거리(cm)가 올라올 때마다. "가깝다" 판정은 여기서 하지 않는다. */
  onSensor?: (cm: number) => void
  /** 벽이 이 별을 실제로 띄웠다 */
  onShown?: (starId: string) => void
  /** 이어질 때마다 한 번 불린다. 지금 우주를 한 장 보내는 자리다. */
  onOpen?: (handle: BridgeHandle) => void
}): BridgeHandle {
  const url = options.url ?? bridgeUrl()
  let socket: WebSocket | null = null
  let attempt = 0
  let closed = false
  let timer: ReturnType<typeof setTimeout> | null = null

  const link = (state: LinkState) => options.onLink?.(state)

  function newId(): string {
    try {
      return globalThis.crypto.randomUUID()
    } catch {
      return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
    }
  }

  const handle: BridgeHandle = {
    send(event, body = {}) {
      if (!socket || socket.readyState !== WebSocket.OPEN) return false
      try {
        socket.send(
          JSON.stringify({
            v: BRIDGE_VERSION,
            id: newId(),
            event,
            at: Date.now(),
            origin: 'live',
            ...body,
          }),
        )
        return true
      } catch {
        // 다리가 없어도 작품은 그대로 돈다
        return false
      }
    },

    star(event, star, extra = {}) {
      return handle.send(event, { star: toWallLight(star), ...extra })
    },

    receipt(receipt) {
      return handle.send(EVENTS.RECEIPT_REQUESTED, { receipt })
    },

    led(step) {
      return handle.send(DEVICE_EVENTS.LED_SET, { step })
    },

    close() {
      closed = true
      if (timer) clearTimeout(timer)
      try {
        socket?.close()
      } catch {
        /* 이미 끊겼다 */
      }
      socket = null
      link('idle')
    },
  }

  function connect() {
    if (closed) return
    link('connecting')

    let next: WebSocket
    try {
      next = new WebSocket(url)
    } catch {
      retry()
      return
    }
    socket = next

    next.addEventListener('open', () => {
      attempt = 0
      link('open')
      options.onOpen?.(handle)
    })

    next.addEventListener('message', (event) => {
      let message: Record<string, unknown>
      try {
        message = JSON.parse(String(event.data))
      } catch {
        return
      }
      if (message.event === 'bridge.status') {
        options.onStatus?.(message as unknown as BridgeStatus)
      } else if (message.event === EVENTS.BUTTON_PRESSED) {
        options.onButton?.(String(message.button ?? ''), message.down !== false)
      } else if (message.event === DEVICE_EVENTS.SENSOR_PROXIMITY) {
        if (Number.isFinite(message.cm)) options.onSensor?.(message.cm as number)
      } else if (message.event === DEVICE_EVENTS.STAR_SHOWN) {
        if (typeof message.starId === 'string') options.onShown?.(message.starId)
      }
    })

    next.addEventListener('close', () => {
      if (socket === next) socket = null
      link('closed')
      retry()
    })

    next.addEventListener('error', () => {
      /* close가 뒤따라 오므로 여기서는 아무것도 하지 않는다 */
    })
  }

  function retry() {
    if (closed) return
    const wait = BACKOFF[Math.min(attempt, BACKOFF.length - 1)]
    attempt += 1
    timer = setTimeout(connect, wait)
  }

  connect()
  return handle
}
