/**
 * 지금 무엇이 어디까지 왔는가.
 *
 * 다리가 들고 있는 유일한 상태다. **기억은 저장하지 않는다** —
 * 관람객의 시간은 브라우저에 있고(나중에는 허브의 DB에), 이 서버는
 * 지나가는 말을 한 번 보고 흘려보낼 뿐이다. 서버를 끄면 남는 것이 없다.
 *
 * ─── 별 하나가 지나는 다섯 단계 ────────────────────────
 *  이 다섯을 **절대로 한 가지로 묶지 않는다.** 전시장에서 "별이 안 떠요"라는
 *  말을 들었을 때, 어디까지 갔는지 알아야 어디를 고칠지 알 수 있다.
 *
 *   requested  하늘이 보냈다            (웹 → 다리)
 *   accepted   다리가 받아들였다        (검증을 통과했다)
 *   relayed    다리가 벽으로 넘겼다     (TD가 받았는지는 아직 모른다)
 *   received   TD가 받았다고 알려 왔다  (`ack`)
 *   shown      TD가 화면에 띄웠다고 한다 (`shown`)
 *
 *  **넘긴 것과 받은 것과 띄운 것은 다른 일이다.** TD가 꺼져 있으면
 *  relayed만 올라가고 received는 그대로다. TD가 받았지만 화면에 못 띄우면
 *  received만 올라간다.
 * ───────────────────────────────────────────────────────
 */

/** 별의 발자취를 몇 개까지 들고 있을 것인가 */
const TRAIL_LIMIT = 500

export const STAGES = ['requested', 'accepted', 'relayed', 'received', 'shown']

export function createHub() {
  /** 역할별 손님. 하늘(브라우저) · 벽(TouchDesigner) · 대역 */
  const clients = new Set()

  /** 별 하나가 어디까지 왔는가 */
  const trail = new Map()
  const order = []

  const counts = {
    accepted: 0,
    rejected: 0,
    relayed: 0,
    received: 0,
    shown: 0,
    duplicate: 0,
    /** 벽으로 가려다 떨어진 칸의 수. 0이 아니면 문장이 샐 뻔한 것이다. */
    stripped: 0,
  }

  const devices = {
    /** 아두이노: off(안 씀) · opening · open · error */
    arduino: 'off',
    /** 프린터: off(안 씀) · ready · error */
    printer: 'off',
    /**
     * 어떤 프린터인가 — none · file · tcp
     *
     * **`tcp`일 때만 진짜 종이가 나온다.** `file`은 무엇이 찍힐지
     * 눈으로 보려고 파일에 쌓는 것이고, 종이는 나오지 않는다.
     * 하늘이 "종이가 나옵니다"라고 말해도 되는지를 이 값으로 가른다.
     */
    printerMode: 'none',
    arduinoNote: '',
    printerNote: '',
  }

  function remember(starId, stage) {
    let entry = trail.get(starId)
    if (!entry) {
      entry = { starId, requested: 0, accepted: 0, relayed: 0, received: 0, shown: 0 }
      trail.set(starId, entry)
      order.push(starId)
      if (order.length > TRAIL_LIMIT) trail.delete(order.shift())
    }
    if (entry[stage] === 0) entry[stage] = Date.now()
    return entry
  }

  return {
    clients,
    counts,
    devices,

    add(client) {
      clients.add(client)
    },
    remove(client) {
      clients.delete(client)
    },

    /** 그 역할의 손님이 몇인가 */
    countOf(role) {
      let n = 0
      for (const client of clients) if (client.role === role) n += 1
      return n
    },

    /** 벽이 제 이름을 알려 왔다 (north / east / …). 적어 두기만 한다. */
    walls() {
      const named = []
      for (const client of clients) {
        if (client.role === 'td') named.push(client.wall || '(이름 없음)')
      }
      return named
    },

    mark(starId, stage) {
      if (!starId) return null
      return remember(starId, stage)
    },

    stageOf(starId) {
      return trail.get(starId) ?? null
    },

    /** 지금 다리가 어떤 상태인가. 하늘의 연결 상태 판이 이것을 읽는다. */
    status() {
      return {
        sky: this.countOf('sky'),
        td: this.countOf('td'),
        sim: this.countOf('sim'),
        walls: this.walls(),
        arduino: devices.arduino,
        arduinoNote: devices.arduinoNote,
        printer: devices.printer,
        printerMode: devices.printerMode,
        printerNote: devices.printerNote,
        stars: {
          accepted: counts.accepted,
          relayed: counts.relayed,
          received: counts.received,
          shown: counts.shown,
        },
        rejected: counts.rejected,
        duplicate: counts.duplicate,
        stripped: counts.stripped,
      }
    },
  }
}
