import { create } from 'zustand'
import type { EmotionKey, MemoryType, Scene, TimeRef, UniverseStar, UniverseStats } from '@/types'
import { getEmotion } from '@/constants/emotions'
import { RECORD, EMOTION as EMOTION_TEXT, CHOICE } from '@/constants/text.exhibit'
import { statsOf, universe } from '@/data'
import { EVENTS } from '@/lib/bridge'
import { pickShowcase } from '@/lib/showcase'
import { play, playSend } from '@/audio'
import { buildReceipt } from '@/lib/receipt'
import { useBridge } from './useBridge'
import { randomSeed } from '@/lib/random'

/** 한 문장이면 충분하다. 원작과 같은 길이. */
export const TEXT_LIMIT = 80

/**
 * 아무도 손대지 않으면 처음으로 돌아가기까지 (ms).
 *
 * 전시장에서 가장 흔한 일은 관람객이 중간에 그냥 가 버리는 것이다.
 * 다음 사람이 남의 문장이 적힌 화면을 마주하면 안 된다.
 */
export const IDLE_MS = 45_000

/** 도착 화면에 머무는 시간. 그 뒤에는 스스로 처음으로 돌아간다. */
export const DONE_HOLD_MS = 20_000

/**
 * 초대 앞에 서 있을 때 머무는 시간.
 *
 * 읽을 것이 세 문단이고, 고르는 일이 남아 있다. 20초로는 **읽다가 끊긴다.**
 * 고르지 않고 가만히 있어도 되지만, 그 '가만히'가 재촉이 되면 안 된다.
 * 그래도 다음 사람은 와야 하므로 한없이 두지는 않는다.
 */
export const INVITE_HOLD_MS = 60_000

interface KioskState {
  scene: Scene

  /** 지금 이 사람이 적고 있는 것 */
  text: string
  timeRef: TimeRef | null
  emotion: EmotionKey | null
  type: MemoryType | null

  /** 보내는 중인가. 두 번 눌러도 별이 둘 생기지 않게 하는 빗장이다. */
  sending: boolean
  /** 방금 보낸 빛. 우리의 우주에서 자기 빛을 찾는 데 쓴다. */
  sent: UniverseStar | null
  /** 빛이 떠나는 연출을 한 번만 틀기 위한 표 */
  departureToken: number
  /**
   * 벽(TouchDesigner)이 마지막으로 "띄웠다"고 알려 온 별의 id.
   *
   * 손 감지 전송(`SceneSending`)이 "LED 연출이 끝났고 벽도 확인했다"를
   * 판단하는 데 쓴다. 다리가 없으면 이 값은 바뀌지 않고, `SceneSending`은
   * 넉넉한 폴백 시간 뒤에 그냥 넘어간다 — 다리가 없어도 작품은 돈다.
   */
  lastShownStarId: string | null

  /**
   * 도착 화면 안에서 어디쯤인가.
   *
   *   arrived — 닿았다는 말이 머무는 동안
   *   invite  — 남의 별들을 만나 보겠냐고 묻는 자리
   *   stayed  — 보지 않겠다고 했다. 다시 묻지 않는다
   */
  doneBeat: 'arrived' | 'invite' | 'stayed'

  /** 잘못 눌렀을 때의 안내. 꾸짖지 않는다. */
  notice: { id: number; text: string } | null

  /**
   * 지금 들여다보고 있는 열 개.
   *
   * 우리의 우주에 들어설 때 한 번 고르고, 나갈 때까지 바뀌지 않는다 —
   * 보는 동안 목록이 흔들리면 그건 감상이 아니라 새로고침이다.
   */
  viewIds: string[]
  /**
   * 그중 몇 번째를 보고 있는가.
   *
   *   -1  아직 흩어져 있다
   *    n  n번째 별이 가운데 있다
   *   길이와 같으면 다 보았다
   */
  viewIndex: number

  /** 모두의 빛 */
  stars: UniverseStar[]
  stats: UniverseStats

  /** 익명. 같은 사람이 이어서 보낸 것만 묶는다. */
  sessionId: string

  goTo: (scene: Scene) => void
  begin: () => void
  setText: (text: string) => void
  chooseTime: (time: TimeRef | null) => void
  chooseEmotion: (emotion: EmotionKey) => void
  chooseType: (type: MemoryType) => void
  toEmotion: () => void
  toChoice: () => void
  toConfirm: () => void
  back: () => void
  send: () => Promise<void>
  finishSending: () => void
  /** 완료 문장이 머물 만큼 머물렀다. 이제 묻는다. */
  invite: () => void
  /** 보지 않겠다고 했다. 그 선택을 그대로 둔다. */
  declineUniverse: () => void
  /** 다음 사람을 위해 적던 것을 지운다. 보낸 빛은 그대로 남는다. */
  reset: () => void
  goHome: () => void
  showUniverse: () => void
  /** 열 개를 고르고 흩어 놓는다 */
  startViewing: () => void
  /** 다음 별을 가운데로 */
  nextStar: () => void
  /** 다시 처음부터 */
  replayViewing: () => void
  /** 감상을 그만두고 흩어진 하늘로 */
  stopViewing: () => void
  notify: (text: string) => void
  clearNotice: () => void
  /** 지금 우주가 이렇다고 다리에 알린다 */
  reportUniverse: () => void
  syncUniverse: (stars: UniverseStar[]) => void
  /** 벽이 이 별을 띄웠다고 알려 왔다 */
  noteWallShown: (starId: string) => void
}

/** 걸음의 순서. 뒤로 가기가 이 표를 거꾸로 읽는다. */
const BACK_TO: Partial<Record<Scene, Scene>> = {
  record: 'intro',
  emotion: 'record',
  choice: 'emotion',
  confirm: 'choice',
  universe: 'attract',
}

export const useKiosk = create<KioskState>((set, get) => ({
  scene: 'attract',

  text: '',
  timeRef: null,
  emotion: null,
  type: null,

  sending: false,
  sent: null,
  departureToken: 0,
  lastShownStarId: null,
  doneBeat: 'arrived',

  notice: null,

  viewIds: [],
  viewIndex: -1,

  stars: universe.snapshot(),
  stats: statsOf(universe.snapshot()),

  sessionId: randomSeed().toString(36),

  goTo: (scene) => set({ scene }),

  begin: () => set({ scene: 'intro' }),

  setText: (text) => set({ text: text.slice(0, TEXT_LIMIT) }),

  chooseTime: (timeRef) => set({ timeRef }),

  // 빛을 고르는 일이 곧 다음 걸음이다. 확인 버튼을 따로 두지 않는다.
  chooseEmotion: (emotion) => set({ emotion, scene: 'choice' }),

  chooseType: (type) => set({ type, scene: 'confirm' }),

  toEmotion: () => {
    if (get().text.trim().length === 0) {
      get().notify(RECORD.empty)
      return
    }
    set({ scene: 'emotion' })
  },

  toChoice: () => {
    if (!get().emotion) {
      get().notify(EMOTION_TEXT.empty)
      return
    }
    set({ scene: 'choice' })
  },

  toConfirm: () => {
    if (!get().type) {
      get().notify(CHOICE.empty)
      return
    }
    set({ scene: 'confirm' })
  },

  back: () => {
    const { scene, sending } = get()
    // 건너가는 중에는 돌아갈 곳이 없다
    if (sending || scene === 'sending') return
    const to = BACK_TO[scene]
    if (to) set({ scene: to })
  },

  send: async () => {
    const { text, type, emotion, timeRef, sending, sessionId } = get()

    // 빗장. 연타로 같은 별이 둘 생기지 않게 한다.
    if (sending) return

    const body = text.trim()
    if (body.length === 0) {
      get().notify(RECORD.empty)
      set({ scene: 'record' })
      return
    }
    if (!emotion) {
      get().notify(EMOTION_TEXT.empty)
      set({ scene: 'emotion' })
      return
    }
    if (!type) {
      get().notify(CHOICE.empty)
      set({ scene: 'choice' })
      return
    }

    set({ sending: true, scene: 'sending' })

    try {
      const { star, stars } = await universe.add({
        text: body,
        type,
        emotion: getEmotion(emotion),
        timeRef: timeRef ?? { kind: 'unknown', label: '기억나지 않음' },
        sessionId,
      })

      set((state) => ({
        sent: star,
        stars,
        stats: statsOf(stars),
        departureToken: state.departureToken + 1,
      }))

      /*
       * 다리에 알린다 — **빛이 떠났습니다.**
       *
       * 벽은 이 말을 받아 빛이 날아오는 것을 그린다. 아직 닿은 것은 아니다.
       * 다리가 없으면 아무 일도 일어나지 않고, 작품은 그대로 돈다.
       */
      useBridge.getState().handle?.star(EVENTS.STAR_REQUESTED, star, { travelSeconds: 2.6 })

      /*
       * 그 마음의 소리.
       *
       * 화면에서 빛이 멀어지는 2.6초와 **같은 순간에** 시작한다.
       * 보내는 버튼에는 소리를 달지 않았다(`sound="none"`) — 여기 이 소리가
       * 그 버튼의 소리이고, 둘을 함께 내면 겹친다.
       */
      playSend(star.emotion, star.type)
    } catch {
      /*
       * 보내지 못했다.
       *
       * 지금은 이 브라우저뿐이라 거의 일어나지 않지만, 허브가 붙으면
       * 네트워크가 끊길 수 있다. 그때 관람객의 시간이 조용히 사라지면 안 된다.
       */
      set({ sending: false, scene: 'confirm' })
      get().notify('빛을 보내지 못했습니다. 다시 시도해 주세요.')
    }
  },

  /**
   * 떠나는 연출이 끝났다. 그 빛이 우리의 우주에 닿은 순간이다.
   *
   * 여기서 비로소 `status`가 `arrived`가 되고, 하늘이 그 별을 그리기 시작한다.
   * 건너가는 동안 하늘에 미리 떠 있으면 '보냈다'는 일이 일어나지 않는다.
   */
  finishSending: () => {
    const sent = get().sent
    if (!sent) return
    // 닿았다는 말부터. 묻는 것은 그 문장이 머문 뒤다.
    set({ sending: false, scene: 'done', doneBeat: 'arrived' })
    // 빛이 우리의 우주에 닿는 그 순간
    play('star.born')
    void universe.markArrived(sent.id).then((stars) => {
      const mine = stars.find((star) => star.id === sent.id) ?? sent
      const stats = statsOf(stars)
      set({ stars, stats, sent: mine })

      const handle = useBridge.getState().handle
      if (!handle) return

      // 닿았습니다
      handle.star(EVENTS.STAR_ARRIVED, mine)

      // 그 별자리가 이만큼 자랐습니다
      const size = stars.filter(
        (star) => star.constellation === mine.constellation && star.status === 'arrived',
      ).length
      handle.send(EVENTS.CONSTELLATION_UPDATED, {
        constellation: { id: mine.constellation, emotion: mine.emotion, size },
      })

      get().reportUniverse()

      /*
       * 그리고 영수증.
       *
       * **도착이 확인된 뒤에만 청한다.** 다리도 같은 것을 한 번 더 확인하고,
       * 아직 닿지 않은 빛의 영수증은 찍지 않는다.
       * 종이에 기록 원문은 들어가지 않는다 (`lib/receipt.ts`).
       */
      handle.receipt(buildReceipt(mine, stats.byEmotion[mine.emotion] ?? 1))
    })
  },

  /**
   * 묻는 자리로 넘어간다.
   *
   * 묻기만 한다. 고르지 않아도 되고, 고르지 않은 채로 두면 그대로 머문다 —
   * **스스로 우리의 우주로 건너가는 일은 없다.**
   */
  invite: () => {
    // 이미 보지 않겠다고 한 사람에게 다시 묻지 않는다
    if (get().doneBeat !== 'arrived') return
    if (!get().sent) return
    set({ doneBeat: 'invite' })
  },

  /**
   * 보지 않겠다고 했다.
   *
   * 보낸 일은 **끝난 그대로 남는다** — 별도, 영수증도, 번호도 그대로다.
   * 다시 묻지 않고, 아무것도 더 요구하지 않는다.
   */
  declineUniverse: () => set({ doneBeat: 'stayed' }),

  reset: () =>
    set({
      text: '',
      timeRef: null,
      emotion: null,
      type: null,
      sending: false,
      sent: null,
      notice: null,
      doneBeat: 'arrived',
      viewIds: [],
      viewIndex: -1,
    }),

  goHome: () => {
    get().reset()
    set({ scene: 'attract' })
  },

  showUniverse: () => {
    get().startViewing()
    set({ scene: 'universe' })
  },

  /**
   * 들여다볼 열 개를 고른다.
   *
   * **실제로 우주에 있는 별에서만 고른다.** 열보다 적으면 있는 만큼이고,
   * 없으면 빈 채로 둔다 — 가짜 별을 지어내지 않는다.
   */
  startViewing: () => {
    const picked = pickShowcase(get().stars)
    set({ viewIds: picked.map((star) => star.id), viewIndex: -1 })
  },

  nextStar: () => {
    const { viewIds, viewIndex } = get()
    if (viewIds.length === 0) return
    // 다 본 뒤에는 더 가지 않는다. 그 자리에서 고를 일이 남아 있다.
    if (viewIndex >= viewIds.length) return
    set({ viewIndex: viewIndex + 1 })
  },

  replayViewing: () => set({ viewIndex: -1 }),

  stopViewing: () => set({ viewIndex: -1 }),

  /**
   * 지금 우주가 이렇다고 다리에 알린다.
   *
   * 다리가 없으면 조용히 아무 일도 일어나지 않는다.
   * 지나간 별을 쌓아 두지는 않지만, '지금의 상태' 한 장은 언제 읽어도 지금의 것이다.
   */
  reportUniverse: () => {
    const handle = useBridge.getState().handle
    if (!handle) return
    const { stars, stats } = get()
    const byConstellation: Record<string, number> = {}
    for (const star of stars) {
      if (star.status !== 'arrived') continue
      byConstellation[star.constellation] = (byConstellation[star.constellation] ?? 0) + 1
    }
    handle.send(EVENTS.UNIVERSE_STATE, {
      universe: {
        total: stats.total,
        keep: stats.keep,
        letgo: stats.letgo,
        byConstellation,
      },
    })
  },

  notify: (text) => set({ notice: { id: Date.now(), text } }),
  clearNotice: () => set({ notice: null }),

  syncUniverse: (stars) => set({ stars, stats: statsOf(stars) }),

  noteWallShown: (starId) => set({ lastShownStarId: starId }),
}))
