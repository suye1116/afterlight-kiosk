import { create } from 'zustand'
import type {
  EmotionKey,
  MemoryType,
  RecordMode,
  Scene,
  Season,
  TimeRef,
  UniverseStar,
  UniverseStats,
} from '@/types'
import { getEmotion } from '@/constants/emotions'
import { RECORD, PROMPTS, EMOTION as EMOTION_TEXT, CHOICE } from '@/constants/text.exhibit'
import { statsOf, universe } from '@/data'
import { EVENTS } from '@/lib/bridge'
import { pickShowcase } from '@/lib/showcase'
import { play, playSend } from '@/audio'
import { buildReceipt } from '@/lib/receipt'
import { useBridge } from './useBridge'
import { randomSeed } from '@/lib/random'
import { assignRealStar } from '@/lib/starAssignment'
import type { AssignedStarView } from '@/lib/starAssignment'
import { canSendNow, checkMemoryText, markSent, type GuardReason } from '@/lib/inputGuard'

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

/** 질문을 바꿀 때 가능하면 직전 질문과는 다른 것을 고른다. */
function pickRandomPrompt(exclude: string | null): string {
  const pool = exclude ? PROMPTS.filter((one) => one !== exclude) : PROMPTS
  const choices = pool.length > 0 ? pool : PROMPTS
  return choices[randomSeed() % choices.length]
}

/**
 * 지금 보내려는 한 문장.
 *
 * 직접 작성 방식이면 `text`, 질문에 답하는 방식이면 `promptAnswer` —
 * 둘은 전환해도 서로 지우지 않고 각자 간직한다(`setRecordMode`). 별
 * 배정 알고리즘·영수증·확인 화면은 모두 이 한 곳만 읽는다.
 */
function effectiveText(state: Pick<KioskState, 'recordMode' | 'text' | 'promptAnswer'>): string {
  return state.recordMode === 'prompt' ? state.promptAnswer : state.text
}

/**
 * 막혔을 때 보여 줄 한 문장(`RECORD.guard.blocked`).
 *
 * §PART 1 — 어떤 이유(욕설·개인정보·스팸)로 막혔는지 문구로 가르지
 * 않는다. 셋 다 "이대로는 보낼 수 없다, 조금만 바꿔 달라"는 같은
 * 한 문장이다. `GuardReason`은 자동 검사가 "어떤 검사가 걸렸는지"를
 * 확인하는 데만 쓰고, 화면 문구에는 더 쓰지 않는다.
 */
function guardMessage(_reason: GuardReason): string {
  return RECORD.guard.blocked
}

interface KioskState {
  scene: Scene

  /**
   * 기억을 적는 두 가지 방식 중 지금 어느 쪽인가.
   *
   * 전환해도 두 칸(`text`·`promptAnswer`)의 내용은 서로 지우지 않는다 —
   * 의도치 않게 이미 적던 것이 사라지면 안 되기 때문이다.
   */
  recordMode: RecordMode
  /** 지금 이 사람이 적고 있는 것 — 직접 작성 방식 */
  text: string
  /** 지금 이 사람이 적고 있는 것 — 질문에 답하는 방식 */
  promptAnswer: string
  /** 질문 방식일 때 지금 보여 주고 있는 질문. 아직 고르지 않았으면 null. */
  selectedPrompt: string | null
  timeRef: TimeRef | null
  /** 그때는 어떤 계절이었나. 고르지 않아도 된다 — 그때는 보낼 때 'unknown'으로 채운다. */
  season: Season | null
  emotion: EmotionKey | null
  type: MemoryType | null
  /**
   * 이 빛을 온라인 "우리의 우주"에도 남길지.
   *
   * **기본은 거짓이다(전시장 하늘에만)** — 전시장 화면에 뜨는 것과
   * 인터넷에 계속 공개되는 것은 다른 일이라고 보기 때문이다. 참이면
   * `send()`가 영수증에 실어 보내는 값(`buildReceipt`의 `shareOnline`)
   * 하나로만 쓰인다 — 이 선택 자체도, 기억 원문도 Firebase의
   * `universe_stars`(공개) 쪽에는 결코 함께 가지 않는다.
   */
  shareOnline: boolean

  /**
   * 이번에 보낸 빛에 배정된 실제 별.
   *
   * **별이 우리의 우주에 닿은 뒤에 비로소 생긴다**(`finishSending`에서
   * 배정한다) — 그전에는 `null`이다. 이제는 `sent.id`(진짜
   * `UniverseStar.id`)로 배정하므로, 영수증·별자리 카드 같은 나중 기능도
   * 같은 id로 이 결과를 다시 찾아볼 수 있다. `reset()`에서 지워지므로
   * 다음 기억은 새로 배정받는다.
   */
  yourStar: AssignedStarView | null

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
  /** 직접 작성 ↔ 질문에 답하기. 전환해도 두 칸의 내용은 그대로 남는다. */
  setRecordMode: (mode: RecordMode) => void
  setPromptAnswer: (text: string) => void
  /** 다른 질문을 본다. 가능하면 직전 질문과는 다른 질문이 나온다. */
  pickPrompt: () => void
  chooseTime: (time: TimeRef | null) => void
  chooseSeason: (season: Season | null) => void
  chooseEmotion: (emotion: EmotionKey) => void
  chooseType: (type: MemoryType) => void
  /** 온라인 "우리의 우주" 공개 여부를 고른다. 기본은 false. */
  setShareOnline: (shareOnline: boolean) => void
  /** 기억을 적었다 — 그 시간이 얼마나 오래전인지 묻는 자리로 */
  toTime: () => void
  /** 시간까지 골랐다(또는 건너뛰었다) — 계절을 묻는 자리로 */
  toSeason: () => void
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
  /** 우리의 우주를 다 보았다 — 가져갈 별자리 카드를 안내한다(없으면 그냥 처음으로). */
  toCardGuide: () => void
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
  time: 'record',
  season: 'time',
  emotion: 'season',
  choice: 'emotion',
  confirm: 'choice',
  universe: 'attract',
}

export const useKiosk = create<KioskState>((set, get) => ({
  scene: 'attract',

  recordMode: 'free',
  text: '',
  promptAnswer: '',
  selectedPrompt: null,
  timeRef: null,
  season: null,
  emotion: null,
  type: null,
  shareOnline: false,
  yourStar: null,

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

  setRecordMode: (mode) => {
    // 질문 방식으로 처음 들어설 때는 질문이 하나 있어야 한다.
    if (mode === 'prompt' && !get().selectedPrompt) {
      set({ selectedPrompt: pickRandomPrompt(null) })
    }
    set({ recordMode: mode })
  },

  setPromptAnswer: (promptAnswer) => set({ promptAnswer: promptAnswer.slice(0, TEXT_LIMIT) }),

  pickPrompt: () =>
    set((state) => ({
      selectedPrompt: pickRandomPrompt(state.selectedPrompt),
      // 질문이 바뀌면 그 답도 다시 적어야 한다 — 이전 질문에 대한 답을 남겨 두지 않는다.
      promptAnswer: '',
    })),

  chooseTime: (timeRef) => set({ timeRef }),

  chooseSeason: (season) => set({ season }),

  // 빛을 고르는 일이 곧 다음 걸음이다. 확인 버튼을 따로 두지 않는다.
  chooseEmotion: (emotion) => set({ emotion, scene: 'choice' }),

  // 빛을 고르는 일이 곧 다음 걸음이다. 확인 버튼을 따로 두지 않는다.
  chooseType: (type) => set({ type, scene: 'confirm' }),

  setShareOnline: (shareOnline) => set({ shareOnline }),

  /*
   * 기록 화면을 벗어나는 **처음이자 유일한 문**이다(`record`에서 앞으로
   * 가는 길은 이 함수뿐이고, 되돌아와 고쳐도 다시 여기를 거친다) —
   * 그래서 부적절한 입력 검사는 여기서 한 번이면 흐름 전체를 지킨다.
   * `toSeason`·`toEmotion`·`toChoice`·`toConfirm`·`send()`에서 같은
   * 검사를 또 보는 것은 §1의 "다른 화면 전환 경로로 우회할 수 없는가"를
   * 위한 겹겹의 방어선이다 — 어느 길로도 막힌 글은 끝까지 못 간다.
   *
   * ─── §PART 2 — 질문에 답하기는 시간·계절을 건너뛴다 ──────
   *  "언제의 기억인지, 어떤 계절이었는지"는 **직접 적은 기억**에만
   *  어울리는 물음이다. 질문에 답하는 방식은 질문 자체가 이미 "지금"을
   *  향해 있으므로, 이 걸음에서 바로 `emotion`으로 건너간다 — `time`·
   *  `season` 화면은 그려지지도 않는다. `season`은 원래 기본값이 없는
   *  칸이라(`null`) 아무것도 더 안 해도 `send()`가 'unknown'으로 읽는다
   *  — 겨울이나 오늘 계절을 거짓으로 채워 넣지 않는다.
   * ───────────────────────────────────────────────────────
   */
  toTime: () => {
    const body = effectiveText(get()).trim()
    if (body.length === 0) {
      get().notify(RECORD.empty)
      return
    }
    const guard = checkMemoryText(body)
    if (!guard.ok) {
      get().notify(guardMessage(guard.reason))
      return
    }
    set({ scene: get().recordMode === 'prompt' ? 'emotion' : 'time' })
  },

  // 시간은 고르지 않아도 된다 — 여기서는 문장만 다시 확인한다 (뒤로 왔다가 지웠을 수 있다).
  toSeason: () => {
    const body = effectiveText(get()).trim()
    if (body.length === 0) {
      get().notify(RECORD.empty)
      return
    }
    const guard = checkMemoryText(body)
    if (!guard.ok) {
      get().notify(guardMessage(guard.reason))
      return
    }
    set({ scene: 'season' })
  },

  // 계절은 고르지 않아도 된다 — 여기서는 문장만 다시 확인한다 (뒤로 왔다가 지웠을 수 있다).
  toEmotion: () => {
    const body = effectiveText(get()).trim()
    if (body.length === 0) {
      get().notify(RECORD.empty)
      return
    }
    const guard = checkMemoryText(body)
    if (!guard.ok) {
      get().notify(guardMessage(guard.reason))
      return
    }
    set({ scene: 'emotion' })
  },

  toChoice: () => {
    const body = effectiveText(get()).trim()
    const guard = checkMemoryText(body)
    if (!guard.ok) {
      get().notify(guardMessage(guard.reason))
      return
    }
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
    const { scene, sending, recordMode } = get()
    // 건너가는 중에는 돌아갈 곳이 없다
    if (sending || scene === 'sending') return
    /*
     * 질문에 답하는 방식은 `record`에서 곧장 `emotion`으로 왔다
     * (`time`·`season`을 보지 않았다) — 그래서 되돌아갈 곳도 그 두
     * 화면이 아니라 `record`다. `BACK_TO`는 직접 작성 방식의 순서
     * 그대로 두고, 이 한 자리만 따로 가른다.
     */
    const to = scene === 'emotion' && recordMode === 'prompt' ? 'record' : BACK_TO[scene]
    if (to) set({ scene: to })
  },

  send: async () => {
    const { type, emotion, timeRef, season, sending, sessionId, recordMode, selectedPrompt } =
      get()

    // 빗장. 연타로 같은 별이 둘 생기지 않게 한다.
    if (sending) return

    const body = effectiveText(get()).trim()
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
    /*
     * 마지막 방어선. `toTime()`이 이미 한 번 보았지만, 이 값이 바뀔 길이
     * 또 있다 — 질문 방식으로 전환했거나, 뒤로 가서 다시 적었거나.
     * "브라우저 검사만으로 충분하다고 보지 않는다"는 §6을 여기서도 지킨다.
     */
    const guard = checkMemoryText(body)
    if (!guard.ok) {
      get().notify(guardMessage(guard.reason))
      set({ scene: 'record' })
      return
    }
    /*
     * 짧은 시간 반복 제출 제한. 관람객 개인의 체험이 아니라 **이
     * 기계 전체**를 기준으로 아주 짧게(15초) 두었다 — `lib/inputGuard.ts`
     * 설명 참고. 걸려도 영영 막히지 않고, 잠시 뒤 다시 시도할 수 있다.
     */
    if (!canSendNow()) {
      get().notify(RECORD.guard.cooldown)
      return
    }

    set({ sending: true, scene: 'sending' })

    try {
      const { star, stars } = await universe.add({
        text: body,
        type,
        emotion: getEmotion(emotion),
        timeRef: timeRef ?? { kind: 'unknown', label: '기억나지 않음' },
        // 고르지 않았으면 'unknown'. 추후 별 배정에서 읽을 입력값이다.
        season: season ?? 'unknown',
        sessionId,
        recordMode,
        // 직접 작성 방식이면 질문이 없다 — 지어내지 않는다.
        promptQuestion: recordMode === 'prompt' ? selectedPrompt ?? undefined : undefined,
      })

      set((state) => ({
        sent: star,
        stars,
        stats: statsOf(stars),
        departureToken: state.departureToken + 1,
      }))
      // 실제로 보낸 뒤에만 쿨다운을 적어 둔다 — 막히거나 실패한 시도는 세지 않는다.
      markSent()

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
    // 빛이 우리의 우주에 닿는 그 순간
    play('star.born')

    /*
     * 실제 별 배정은 **여기서, 동기적으로** 일어난다.
     *
     * `sent.id`는 진짜 `UniverseStar.id`다 — 그래서 영수증·별자리 카드
     * 같은 나중 기능도 같은 id로 이 결과를 다시 찾아볼 수 있다
     * (`lib/starAssignment.getAssignedStar`). `markArrived`가 나중에
     * 바꾸는 것은 `status`·`arrivedAt`뿐이라(text·emotion·season·type은
     * 그대로다), 그 응답을 기다리지 않고 바로 배정한다 — 비동기 안에
     * 넣으면 "도착 직후 바로 누르는" 물리 버튼과 경쟁 상태가 생긴다.
     */
    const outcome = assignRealStar({
      id: sent.id,
      text: sent.text,
      emotion: sent.emotion,
      season: sent.season ?? 'unknown',
      type: sent.type,
      // 질문 방식으로 적었으면, '나의 별 이야기'가 그 질문을 밝힐 수 있게 함께 넘긴다.
      // 의미 분석(어떤 별을 고를지)에는 쓰이지 않는다 — `sent.text`만 분석한다.
      recordMode: sent.recordMode,
      promptQuestion: sent.promptQuestion,
    })

    if (outcome.ok) {
      /*
       * 정상 경로 — 전시 순서가 바뀌어, 이제는 '도착했다' 화면을 거치지
       * 않고 곧장 실제 별 소개(`SceneYourStar`)로 간다. 도착 피드백이
       * 사라지는 것은 아니다 — 그 화면이 스스로 "당신의 별이
       * 도착했습니다"를 보여 준다.
       */
      set({ sending: false, yourStar: outcome.view, scene: 'yourStar', doneBeat: 'arrived' })
    } else {
      /*
       * 폴백 — 검증된 별이 하나도 없는, 있어서는 안 되는 경우에만 쓰인다.
       * 이때는 새로 만들지 않고, 이미 있던 '도착' 화면과 그 초대 흐름을
       * 그대로 쓴다.
       */
      set({ sending: false, yourStar: null, scene: 'done', doneBeat: 'arrived' })
    }

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
       *
       * 실제 별 배정은 이보다 앞서(`finishSending`의 동기 구간에서)
       * 이미 끝나 있으므로, 여기서는 그 결과(`get().yourStar`)를
       * 그대로 읽기만 한다 — 다시 배정하지 않는다.
       */
      handle.receipt(
        buildReceipt(mine, stats.byEmotion[mine.emotion] ?? 1, get().yourStar, {
          shareOnline: get().shareOnline,
        }),
      )
    })
  },

  /**
   * 닿았다는 말이 머물 만큼 머문 뒤, 다음 자리로 건너간다.
   *
   * **실제 별이 배정되어 있으면 '나의 별' 화면으로 간다** — `finishSending`이
   * 이미 배정해 두었으므로 여기서는 그 결과를 보여 주기만 한다.
   * 배정이 안 되어 있으면(있어서는 안 되는, 검증된 별이 하나도 없는 경우)
   * **원래의 초대 흐름(묻고, 고르지 않아도 되는)으로 그대로 돌아간다** —
   * 기존 폴백을 새로 만들지 않고 이미 있던 것을 그대로 쓴다.
   */
  invite: () => {
    // 이미 보지 않겠다고 한 사람에게 다시 묻지 않는다
    if (get().doneBeat !== 'arrived') return
    if (!get().sent) return
    if (get().yourStar) {
      set({ scene: 'yourStar' })
    } else {
      set({ doneBeat: 'invite' })
    }
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
      recordMode: 'free',
      text: '',
      promptAnswer: '',
      selectedPrompt: null,
      timeRef: null,
      season: null,
      emotion: null,
      type: null,
      shareOnline: false,
      yourStar: null,
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
   * 우리의 우주를 다 보고 "처음으로"를 눌렀다.
   *
   * **우리의 우주를 대신 끝내거나 짧게 만들지 않는다** — 이 액션은
   * 그 화면의 "처음으로" 버튼이 눌린 **뒤**에만 불린다. 실제 별이
   * 배정되어 있으면(평소라면 늘 그렇다) 그 별이 속한 카드를 한 번
   * 보여 주고, 없으면(기존 폴백 경로를 탄 경우) 곧장 처음으로 간다 —
   * 새 폴백을 만들지 않는다.
   */
  toCardGuide: () => {
    if (get().yourStar) {
      set({ scene: 'cardGuide' })
    } else {
      get().goHome()
    }
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
