import type {
  Emotion,
  MemoryType,
  StarSource,
  TimeRef,
  UniverseStar,
  UniverseStats,
  WallLight,
} from '@/types'
import { EMOTIONS, isEmotionKey } from '@/constants/emotions'
import { constellationIdFor, createStar } from '@/lib/starMath'

/**
 * 우주를 어디에 두는가.
 *
 * 화면은 이 약속만 알고, 그것이 브라우저인지 서버인지는 모른다.
 *
 * ─── 지금 ──────────────────────────────────────────────
 *  이 브라우저의 localStorage.  같은 브라우저의 여러 탭까지는
 *  BroadcastChannel로 실시간으로 이어지지만, **다른 기기와는 이어지지 않는다.**
 *  전시장에서 태블릿 두 대를 놓으면 각자 다른 우주를 갖는다.
 *
 * ─── 다음 ──────────────────────────────────────────────
 *  허브(Node + WebSocket + SQLite)가 붙으면 이 인터페이스를 구현한 객체
 *  하나만 갈아 끼운다. `data/index.ts`의 한 줄이 바뀌는 곳 전부다.
 *  화면과 store는 손대지 않는다.
 * ───────────────────────────────────────────────────────
 *
 * ## 실제의 빛과 점검용 빛은 저장소부터 다르다
 *
 *   afterlight.universe.v1        실제 관람객의 빛. 전시의 기록이다
 *   afterlight.universe.test.v1   점검용으로 만들어 낸 빛
 *
 * 한 통에 담고 표만 붙이면, 언젠가 지우다가 실제 기록을 함께 지운다.
 * 통을 아예 나누면 그럴 일이 없다. **전시 빌드는 test 통을 열지도 않는다.**
 */
export interface UniverseRepository {
  readonly name: string
  /** 여러 기기가 하나의 우주를 나눠 쓰는가 */
  readonly shared: boolean
  /** 점검용 빛을 함께 보고 있는가 */
  readonly testing: boolean

  /** 지금 알고 있는 것. 즉시 돌려준다 — 화면이 비어 있는 순간을 없앤다. */
  snapshot(): UniverseStar[]

  /** 저장소에 다시 묻는다. 서버라면 네트워크가 걸린다. */
  refresh(): Promise<UniverseStar[]>

  /** 빛 하나를 더한다. 자리와 번호와 이름은 저장소가 정한다. */
  add(draft: StarDraft): Promise<{ star: UniverseStar; stars: UniverseStar[] }>

  /** 건너가던 빛이 닿았다 */
  markArrived(id: string): Promise<UniverseStar[]>

  /** 다른 곳에서 바뀌면 알려 준다. */
  subscribe(onChange: (stars: UniverseStar[]) => void): () => void

  /**
   * 점검용 빛만 지운다. 실제 관람객의 빛은 건드리지 않는다.
   *
   * **실제의 빛을 지우는 길은 두지 않았다.** 흘려보내는 것도, 다음 사람이
   * 오는 것도 빛을 지우지 않는다 — "흘려보낸다는 것은 삭제한다는 뜻이 아니다"가
   * 이 작품의 뜻이기 때문이다. 전시를 다시 시작할 때는 사람이 저장소를 직접 비운다.
   */
  eraseTest(): Promise<void>
}

export interface StarDraft {
  text: string
  type: MemoryType
  emotion: Emotion
  timeRef: TimeRef
  sessionId: string
  /** 비우면 실제 관람객의 빛으로 본다 */
  source?: StarSource
}

const LIVE_KEY = 'afterlight.universe.v1'
const TEST_KEY = 'afterlight.universe.test.v1'
const CHANNEL = 'afterlight.universe'

interface UniverseFile {
  version: 1
  stars: UniverseStar[]
}

/** localStorage는 사생활 보호 모드나 용량 초과에서 그냥 던진다. 하늘은 그래도 떠 있어야 한다. */
function safeStorage(): Storage | null {
  try {
    const probe = '__afterlight__'
    globalThis.localStorage.setItem(probe, probe)
    globalThis.localStorage.removeItem(probe)
    return globalThis.localStorage
  } catch {
    return null
  }
}

function isStar(value: unknown): value is UniverseStar {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    typeof s.text === 'string' &&
    (s.type === 'keep' || s.type === 'letgo') &&
    isEmotionKey(s.emotion) &&
    typeof s.createdAt === 'number' &&
    typeof s.x === 'number' &&
    typeof s.y === 'number' &&
    typeof s.brightness === 'number' &&
    typeof s.seed === 'number'
  )
}

/**
 * 저장된 빛을 지금의 모양으로 받아들인다.
 *
 * 별자리 이름과 전송 상태는 나중에 생긴 칸이다. 그전에 저장된 빛에는
 * 없으므로 여기서 채워 준다 — 옛 빛이 하늘에서 사라지지 않게.
 */
function adopt(star: UniverseStar, source: StarSource): UniverseStar {
  const emotion = EMOTIONS.find((one) => one.type === star.emotion)
  return {
    ...star,
    source: star.source ?? source,
    constellation: star.constellation ?? (emotion ? constellationIdFor(emotion) : 'con-other'),
    // 저장되어 있다는 것은 이미 닿았다는 뜻이다
    status: star.status ?? 'arrived',
  }
}

function read(storage: Storage, key: string, source: StarSource): UniverseStar[] {
  try {
    const raw = storage.getItem(key)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    const stars = (parsed as Partial<UniverseFile>)?.stars
    if (!Array.isArray(stars)) return []
    // 깨진 항목 하나가 우주 전체를 지우지 않도록 걸러서 받는다
    return stars.filter(isStar).map((star) => adopt(star, source))
  } catch {
    return []
  }
}

function write(storage: Storage, key: string, stars: UniverseStar[]): boolean {
  try {
    const file: UniverseFile = { version: 1, stars }
    storage.setItem(key, JSON.stringify(file))
    return true
  } catch {
    return false
  }
}

/**
 * 이 브라우저에 기대는 구현. 허브가 붙기 전까지의 자리다.
 *
 * `testing`이 꺼져 있으면 점검용 통은 **열지도 않는다.**
 */
export function createLocalUniverse(testing = false): UniverseRepository {
  const storage = safeStorage()
  let live: UniverseStar[] = storage ? read(storage, LIVE_KEY, 'live') : []
  let test: UniverseStar[] = storage && testing ? read(storage, TEST_KEY, 'test') : []
  let cache: UniverseStar[] = [...live, ...test]
  const listeners = new Set<(stars: UniverseStar[]) => void>()

  /** 같은 브라우저의 다른 탭에 알린다 */
  let channel: BroadcastChannel | null = null
  try {
    channel = new BroadcastChannel(CHANNEL)
  } catch {
    channel = null
  }

  function publish(tell = true) {
    cache = [...live, ...test]
    for (const listener of listeners) listener(cache)
    if (tell) channel?.postMessage({ type: 'changed' })
  }

  function reload() {
    if (!storage) return
    live = read(storage, LIVE_KEY, 'live')
    if (testing) test = read(storage, TEST_KEY, 'test')
    publish(false)
  }

  channel?.addEventListener('message', reload)
  // BroadcastChannel이 없는 브라우저를 위한 길
  globalThis.addEventListener?.('storage', (event) => {
    const key = (event as StorageEvent).key
    if (key === LIVE_KEY || (testing && key === TEST_KEY)) reload()
  })

  return {
    name: 'local',
    shared: false,
    testing,

    snapshot: () => cache,

    async refresh() {
      if (storage) reload()
      return cache
    },

    async add(draft) {
      const source: StarSource = draft.source ?? 'live'
      const key = source === 'test' ? TEST_KEY : LIVE_KEY

      /*
       * 덧붙이기 전에 저장소를 다시 읽는다.
       * 캐시로 다음 배열을 만들면, 그 캐시가 저장소와 어긋난 순간
       * (다른 탭이 먼저 썼는데 알림을 놓쳤다거나) 남의 빛을 통째로 덮어쓴다.
       */
      const current = storage ? read(storage, key, source) : source === 'test' ? test : live
      const other = source === 'test' ? live : testing ? test : []
      const all = [...current, ...other]

      /*
       * 번호는 실제의 빛과 점검용 빛이 따로 센다.
       * 점검하느라 보낸 스무 개 때문에 전시 첫 관람객이 21번이 되면 안 된다.
       */
      const seq = current.reduce((max, star) => Math.max(max, star.seq ?? 0), 0) + 1

      // 같은 별자리의 빛 곁에만 앉는다. 이것이 별자리를 만드는 전부다.
      const constellation = constellationIdFor(draft.emotion)
      const siblings = all
        .filter((star) => star.constellation === constellation)
        .map((star) => ({ x: star.x, y: star.y }))

      const star = createStar({
        ...draft,
        source,
        seq,
        siblings,
        taken: new Set(all.map((one) => one.id)),
      })

      const next = [...current, star]
      if (storage) write(storage, key, next)
      if (source === 'test') test = next
      else live = next
      publish()
      return { star, stars: cache }
    },

    async markArrived(id) {
      const touch = (list: UniverseStar[]) =>
        list.map((star) =>
          star.id === id && star.status !== 'arrived'
            ? { ...star, status: 'arrived' as const, arrivedAt: Date.now() }
            : star,
        )

      if (live.some((star) => star.id === id)) {
        live = touch(live)
        if (storage) write(storage, LIVE_KEY, live)
      } else if (test.some((star) => star.id === id)) {
        test = touch(test)
        if (storage) write(storage, TEST_KEY, test)
      }
      publish()
      return cache
    },

    subscribe(onChange) {
      listeners.add(onChange)
      return () => listeners.delete(onChange)
    },

    async eraseTest() {
      storage?.removeItem(TEST_KEY)
      test = []
      publish()
    },
  }
}

/** 모인 빛을 센다. 무엇을 적었는지는 세지 않는다. */
export function statsOf(stars: ReadonlyArray<UniverseStar>): UniverseStats {
  const byEmotion: Record<string, number> = {}
  for (const emotion of EMOTIONS) byEmotion[emotion.type] = 0

  let keep = 0
  let letgo = 0
  let liveCount = 0
  let testCount = 0
  for (const star of stars) {
    if (star.emotion in byEmotion) byEmotion[star.emotion] += 1
    if (star.type === 'letgo') letgo += 1
    else keep += 1
    if (star.source === 'test') testCount += 1
    else liveCount += 1
  }

  return { total: stars.length, live: liveCount, test: testCount, byEmotion, keep, letgo }
}

/**
 * 문장을 떼어 낸다. 벽으로 건너가는 것은 빛뿐이다.
 *
 * 지금은 쓰이지 않지만(벽이 아직 없다) 전송 단위를 미리 못 박아 둔다.
 * 작업본의 다리(`bridge/`)가 붙을 때 이 모양 그대로 WebSocket에 실린다.
 */
export function toWallLight(star: UniverseStar): WallLight {
  return {
    id: star.id,
    // 전송 하나를 가리키는 고유 이름. 지금은 id와 같다 (WallLight 설명 참고)
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
