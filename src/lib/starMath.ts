import type { ConstellationId, Emotion, MemoryType, UniverseStar } from '@/types'
import { getTone } from '@/constants/tones'
import { bandWeight } from './noise'
import { clamp, clamp01, lerp, makeRandom, randomSeed } from './random'

const YEAR_MS = 365.25 * 24 * 60 * 60 * 1000
const MONTH_MS = YEAR_MS / 12

/*
 * 자리. (원작 lib/starMath.ts의 규칙을 그대로 잇는다)
 *
 * 균일 난수로 뿌리면 '랜덤하게 찍힌 점'이 된다. 밤하늘은 그렇지 않다.
 * 어떤 곳은 완전히 비어 있고 어떤 곳은 몇 개가 몰려 있다.
 *
 * 그래서 새 빛은 대개 이미 있는 빛 곁에 앉는다(군집). 가끔은 아무도 없는 곳에
 * 새로 자리를 연다. 달라진 것은 하나뿐이다 — **그 '하늘'이 감정 하나의
 * 영역으로 좁혀진다.** 같은 감정의 빛끼리만 곁에 앉으므로 별자리가 생긴다.
 */

/** 이미 있는 빛 곁에 앉을 확률 */
const CLUSTER_CHANCE = 0.7
const CLUSTER_NEAR = 0.042
const CLUSTER_FAR = 0.115
/** 새 자리를 열 때, 기존의 모든 빛에서 이만큼은 떨어져야 한다 */
const NEW_REGION_GAP = 0.22
/**
 * 두 빛이 이보다 가까우면 한 점으로 뭉쳐 보인다.
 *
 * 원작의 값(0.032)은 하늘 전체를 한 사람이 쓸 때의 것이다. 여기서는
 * 감정 하나가 하늘의 한 조각만 받으므로, 빛이 쌓이면 그 조각이 금세 찬다.
 */
const MIN_SEPARATION = 0.032

/**
 * 아무리 붐벼도 이보다 붙지는 않는다.
 *
 * 핵이 5~14px이므로 이 간격이면 두 별이 여전히 둘로 보인다.
 */
const MIN_SEPARATION_FLOOR = 0.012

/**
 * 별자리가 짙어진다.
 *
 * 별자리는 자기 조각 밖으로 번지지 않는다 — 번지면 옆 별자리와 섞여
 * '감정별'이라는 말이 무의미해진다. 대신 **안에서 촘촘해진다.**
 * 사람이 모일수록 그 감정의 빛이 빽빽해지는 것이고, 그건 뜻으로도 맞다.
 *
 * 한 별자리가 이 규칙으로 담아낼 수 있는 빛은 **대략 100개**다
 * (일곱 별자리를 합쳐 700개). 그보다 더 쌓이면 가장자리부터 뭉치기 시작한다 —
 * 그때는 벽(네 면)으로 하늘을 넓힐 때다. 네 면이면 하늘이 네 배가 된다.
 */
export function separationFor(count: number): number {
  return Math.max(MIN_SEPARATION_FLOOR, MIN_SEPARATION / Math.sqrt(1 + count / 40))
}
/** 한 덩어리가 가질 수 있는 최대 이웃 수 */
const CLUSTER_CAP = 6
/** 이웃으로 치는 거리 */
const NEIGHBOUR_RANGE = 0.13

/**
 * 자리를 저장하는 범위.
 *
 * 화면에 그릴 때는 이 범위를 그 화면의 안전 영역으로 다시 매핑한다
 * (`canvas/safeArea.ts`).
 */
export const FIELD = { left: 0.06, right: 0.94, top: 0.1, bottom: 0.88 }

export interface Field {
  left: number
  right: number
  top: number
  bottom: number
}

interface Spot {
  x: number
  y: number
}

/*
 * 가로로 긴 화면에서 정규 좌표의 거리는 실제 거리와 다르다.
 * x 간격을 눌러 두어야 군집이 옆으로 늘어지지 않고 둥글게 보인다.
 */
const X_SQUEEZE = 0.62

function gap(a: Spot, b: Spot): number {
  return Math.hypot((a.x - b.x) * X_SQUEEZE, a.y - b.y)
}

function inField(spot: Spot, field: Field): boolean {
  return (
    spot.x >= field.left &&
    spot.x <= field.right &&
    spot.y >= field.top &&
    spot.y <= field.bottom
  )
}

/** 띠를 따라, 아무도 없는 곳에 새 자리를 연다 */
function openNewRegion(
  random: () => number,
  existing: ReadonlyArray<Spot>,
  field: Field,
  gapNeeded: number,
): Spot {
  let fallback: Spot | null = null

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const spot = {
      x: lerp(field.left, field.right, random()),
      y: lerp(field.top, field.bottom, random()),
    }
    // 은하수 띠를 따라 조금 더 자주 앉는다
    if (random() > 0.3 + 0.7 * bandWeight(spot.x, spot.y)) continue

    fallback ??= spot
    const nearest = existing.reduce((min, other) => Math.min(min, gap(spot, other)), Infinity)
    if (nearest >= gapNeeded) return spot
  }

  // 하늘이 이미 빽빽하면 조건을 못 맞춘다. 그래도 자리는 줘야 한다.
  return fallback ?? { x: (field.left + field.right) / 2, y: (field.top + field.bottom) / 2 }
}

/**
 * 곁에 앉을 빛을 고른다.
 *
 * 아무나 고르면 우주가 고르게 자란다. 이미 이웃이 많은 빛을 고르게 해야
 * 붐비는 곳은 더 붐비고 빈 곳은 계속 비어 있다 — 밤하늘이 그렇게 생겼다.
 */
function chooseAnchor(random: () => number, existing: ReadonlyArray<Spot>): Spot | null {
  if (existing.length === 0) return null

  let best: Spot | null = null
  let bestCount = -1

  for (let i = 0; i < 2; i += 1) {
    const candidate = existing[Math.floor(random() * existing.length)]
    if (!candidate) continue
    const neighbours = existing.filter((other) => gap(candidate, other) < NEIGHBOUR_RANGE).length
    if (neighbours >= CLUSTER_CAP) continue
    if (neighbours > bestCount) {
      bestCount = neighbours
      best = candidate
    }
  }
  return best
}

/** 이미 있는 빛 하나를 골라 그 곁에 앉는다 */
function sitBeside(
  random: () => number,
  existing: ReadonlyArray<Spot>,
  field: Field,
  separation: number,
): Spot | null {
  const anchor = chooseAnchor(random, existing)
  if (!anchor) return null

  for (let attempt = 0; attempt < 16; attempt += 1) {
    const angle = random() * Math.PI * 2
    // 가까운 쪽으로 치우치게. 고르게 뽑으면 고리 모양으로 둘러앉는다.
    const distance = lerp(CLUSTER_NEAR, CLUSTER_FAR, Math.pow(random(), 1.6))
    const spot = {
      x: anchor.x + (Math.cos(angle) * distance) / X_SQUEEZE,
      y: anchor.y + Math.sin(angle) * distance,
    }
    if (!inField(spot, field)) continue
    if (existing.some((other) => gap(spot, other) < separation)) continue
    return spot
  }
  return null
}

function isClear(
  spot: Spot,
  existing: ReadonlyArray<Spot>,
  field: Field,
  separation: number,
): boolean {
  if (!inField(spot, field)) return false
  return existing.every((other) => gap(spot, other) >= separation)
}

/**
 * 가장 가까운 빛에서 밀어낸다. 마지막 수단이다.
 *
 * 한 번 밀어낸 자리가 또 다른 빛과 가까울 수 있으므로 몇 번 되풀이한다.
 * 그래도 못 찾으면 그 자리에 둔다 — 자리를 못 받는 빛은 없어야 한다.
 */
function pushApart(
  spot: Spot,
  existing: ReadonlyArray<Spot>,
  field: Field,
  separation: number,
): Spot {
  let current = spot

  for (let round = 0; round < 12; round += 1) {
    let nearest: Spot | null = null
    let shortest = Infinity
    for (const other of existing) {
      const distance = gap(current, other)
      if (distance < shortest) {
        shortest = distance
        nearest = other
      }
    }
    if (!nearest || shortest >= separation) return current
    if (shortest === 0) {
      // 완전히 같은 자리다. 아무 쪽으로나 한 걸음 뗀다.
      current = {
        x: clamp(current.x + separation / X_SQUEEZE, field.left, field.right),
        y: clamp(current.y + separation * 0.5, field.top, field.bottom),
      }
      continue
    }

    const scale = separation / shortest
    current = {
      x: clamp(nearest.x + (current.x - nearest.x) * scale, field.left, field.right),
      y: clamp(nearest.y + (current.y - nearest.y) * scale, field.top, field.bottom),
    }
  }

  return current
}

function proposeSpot(
  random: () => number,
  existing: ReadonlyArray<Spot>,
  field: Field,
  gapNeeded: number,
  separation: number,
): Spot {
  if (existing.length === 0) {
    // 첫 빛은 한가운데를 피한다. 거기서 시작하면 별자리가 중앙에서 자라난다.
    const side = random() < 0.5 ? -1 : 1
    const midX = (field.left + field.right) / 2
    const halfX = (field.right - field.left) / 2
    return {
      x: clamp(midX + side * lerp(halfX * 0.3, halfX * 0.68, random()), field.left, field.right),
      y: lerp(field.top, field.bottom, 0.2 + random() * 0.6),
    }
  }

  /*
   * 빛이 적을 때는 새 자리를 더 자주 연다.
   * 열 개도 안 되는데 한 덩어리뿐이면 별자리가 아니라 얼룩으로 보인다.
   */
  const clusterChance = existing.length < 8 ? 0.4 : CLUSTER_CHANCE

  if (random() < clusterChance) {
    const beside = sitBeside(random, existing, field, separation)
    if (beside) return beside
  }

  return openNewRegion(random, existing, field, gapNeeded)
}

/**
 * 이 빛이 앉을 자리. 만들 때 한 번 정해 저장한다.
 *
 * `field`를 좁히면 그 안에서만 자란다 — 감정별 별자리가 그렇게 생긴다.
 */
export function placeInField(
  random: () => number,
  existing: ReadonlyArray<Spot>,
  field: Field = FIELD,
  gapNeeded: number = NEW_REGION_GAP,
  separation: number = MIN_SEPARATION,
): Spot {
  /*
   * 붐비는 별자리에서는 네 번으로는 빈자리를 찾지 못한다.
   * 찾는 일은 값이 거의 들지 않지만, 못 찾아서 밀어내면 자리가 흐트러진다.
   */
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const spot = proposeSpot(random, existing, field, gapNeeded, separation)
    if (isClear(spot, existing, field, separation)) return spot
  }
  /*
   * 빈자리를 못 찾았다. 별자리가 거의 다 찼다는 뜻이다.
   *
   * 이때 밀어내기만 하면 두 이웃 사이에서 왔다 갔다 하다가 결국
   * 누군가와 바짝 붙는다. 그 대신 **여러 자리를 뿌려 보고 가장 넓게
   * 트인 곳**을 고른다 — 자리를 못 받는 빛은 없어야 하고,
   * 못 받을 바에는 가장 숨통이 트인 곳에 앉아야 한다.
   */
  let best: Spot | null = null
  let bestRoom = -1
  for (let attempt = 0; attempt < 96; attempt += 1) {
    const spot = {
      x: lerp(field.left, field.right, random()),
      y: lerp(field.top, field.bottom, random()),
    }
    let room = Infinity
    for (const other of existing) room = Math.min(room, gap(spot, other))
    if (room > bestRoom) {
      bestRoom = room
      best = spot
    }
  }

  // 고른 자리를 한 번 더 다듬는다
  return pushApart(best ?? { x: field.left, y: field.top }, existing, field, separation)
}

/**
 * 감정 하나가 차지하는 하늘의 조각.
 *
 * 감정이 직접 네 변을 들고 있다(`constants/emotions.ts`).
 * 여기서는 전체 FIELD 밖으로 나가지 않게 한 번 묶기만 한다.
 */
export function fieldOf(emotion: Emotion): Field {
  return {
    left: Math.max(FIELD.left, emotion.field.left),
    right: Math.min(FIELD.right, emotion.field.right),
    top: Math.max(FIELD.top, emotion.field.top),
    bottom: Math.min(FIELD.bottom, emotion.field.bottom),
  }
}

/**
 * 아무도 없는 곳에 새 자리를 열 때 요구하는 거리.
 *
 * 조각의 크기에 맞춘다 — 고정값을 쓰면 좁은 조각에서는 영영 못 열고
 * 넓은 조각에서는 너무 쉽게 열린다.
 */
function newRegionGapFor(field: Field): number {
  const width = (field.right - field.left) * X_SQUEEZE
  const height = field.bottom - field.top
  return Math.min(width, height) * 0.38
}

/**
 * 이 마음의 별자리 이름.
 *
 * 지금은 마음 하나에 별자리 하나다. 그래도 감정 키를 그대로 쓰지 않는 것은,
 * 한 별자리가 다 차서 둘로 나뉘는 날(`con-sad-2`)을 위해서다.
 * 그때 고칠 곳은 이 함수 하나이고, 화면과 하늘은 별자리 이름만 읽는다.
 */
export function constellationIdFor(emotion: Emotion): ConstellationId {
  return `con-${emotion.type}`
}

/**
 * 빛 하나를 별로 만든다. 이 순간에 그 빛이 우리에게 닿는다.
 *
 * 같은 감정의 빛들을 함께 받는 이유는 자리 때문이다. 별자리는
 * 통째로 설계되는 것이 아니라 한 점씩 자라난다.
 */
export function createStar(input: {
  text: string
  type: MemoryType
  emotion: Emotion
  timeRef: UniverseStar['timeRef']
  sessionId: string
  source: UniverseStar['source']
  seq: number
  /** 같은 별자리의 빛들. 자리를 겹치지 않게 하는 데만 쓴다. */
  siblings: ReadonlyArray<{ x: number; y: number }>
  now?: number
  /** 이미 쓰이고 있는 이름들. 같은 이름이 두 번 나오지 않게 한다. */
  taken?: ReadonlySet<string>
}): UniverseStar {
  const now = input.now ?? Date.now()
  const seed = randomSeed()
  const random = makeRandom(seed)
  // 별자리는 좁은 영역이므로 새 자리를 여는 기준도 함께 좁힌다
  const field = fieldOf(input.emotion)
  const { x, y } = placeInField(
    random,
    input.siblings,
    field,
    newRegionGapFor(field),
    // 그 별자리에 이미 몇이 모였는지에 따라 간격이 좁아진다
    separationFor(input.siblings.length),
  )
  const [low, high] = getTone(input.type).brightness

  /*
   * 이름.
   *
   * 시각과 난수를 엮으므로 같은 이름이 나올 일은 거의 없지만,
   * '거의'로는 모자란다 — 같은 이름의 빛이 둘이면 하나는 하늘에서 사라진다.
   * 이미 쓰이고 있는 이름을 받아 두고, 겹치면 다시 뽑는다.
   */
  const taken = input.taken
  let id = `${now.toString(36)}-${randomSeed().toString(36)}`
  for (let attempt = 0; taken?.has(id) && attempt < 8; attempt += 1) {
    id = `${now.toString(36)}-${randomSeed().toString(36)}-${attempt}`
  }

  return {
    id,
    seq: input.seq,
    sessionId: input.sessionId,
    source: input.source,
    text: input.text,
    timeRef: input.timeRef,
    emotion: input.emotion.type,
    type: input.type,
    createdAt: now,
    x,
    y,
    brightness: Math.round(lerp(low, high, random()) * 1000) / 1000,
    seed,
    constellation: constellationIdFor(input.emotion),
    // 아직 건너가는 중이다. 하늘에 뜨는 것은 닿은 뒤부터다.
    status: 'sending',
  }
}

/**
 * 흘려보낸 빛이 옅어지는 데 걸리는 시간(ms).
 *
 * 원작은 25초였다 — 도착을 지켜본 그 자리에서 흐려지는 것을 볼 수 있어야 했기 때문이다.
 * 공동 우주의 빛은 전시 내내 남으므로 더 천천히 간다. 다만 끝값은 같다.
 */
export const LETGO_FADE_MS = 90_000

/**
 * 다 흐려진 뒤에 남는 잔광의 밝기.
 *
 * 0이 아니다. 흘려보낸 시간도 없었던 시간이 되지는 않으므로,
 * 빛을 거의 잃되 자세히 보면 여전히 거기 있어야 한다.
 *
 * 다만 공동 우주는 네 면의 벽에 멀리서 보는 하늘이다. 원작의 0.12는
 * 손에 든 화면에서나 보이는 값이라, 한눈에 보는 하늘의 값(0.46)을 쓴다.
 */
export const LETGO_RESIDUE_ALPHA = 0.46

/**
 * 지금 이 빛이 얼마나 남아 있는가 (0~1).
 *
 * 저장하지 않고 `지금 - 도착한 때`로 다시 계산한다.
 * 그래서 새로고침해도 흐려진 정도가 그대로다.
 */
export function remainingLight(
  star: Pick<UniverseStar, 'type' | 'createdAt' | 'brightness'>,
  now: number = Date.now(),
): number {
  if (star.type !== 'letgo') return 1

  const t = clamp01((now - star.createdAt) / LETGO_FADE_MS)
  const target = Math.min(1, LETGO_RESIDUE_ALPHA / Math.max(star.brightness, 0.01))
  // 천천히 놓는다. 급히 꺼지면 사라진 것처럼 보인다.
  return lerp(1, target, t * t * (3 - 2 * t))
}

/**
 * 흘려보낸 빛이 멀어지는 데 걸리는 시간(ms).
 *
 * 다 멀어진 뒤에는 그 자리에 머문다. 끝없이 가면 언젠가 남의 별자리로
 * 걸어 들어가고, 그러면 '감정별'이라는 말이 무의미해진다.
 */
export const LETGO_DRIFT_MS = 90_000

/**
 * 지금 이 빛이 얼마나 멀어졌는가 (0~1).
 *
 * 간직한 빛은 움직이지 않는다 — 언제나 0이다.
 * **흘려보낸 빛도 사라지지는 않는다.** 자리를 옮길 뿐이고,
 * 떠나온 자리에는 잔광이 남는다.
 *
 * 저장하지 않고 `지금 - 닿은 때`로 다시 계산한다.
 * 그래서 새로고침해도 멀어진 정도가 그대로다.
 */
export function letgoDriftRatio(
  star: Pick<UniverseStar, 'type' | 'createdAt' | 'arrivedAt'>,
  now: number = Date.now(),
): number {
  if (star.type !== 'letgo') return 0
  const since = now - (star.arrivedAt ?? star.createdAt)
  const t = clamp01(since / LETGO_DRIFT_MS)
  // 처음엔 머뭇거리다 천천히 멀어지고, 끝에서 다시 느려진다
  return t * t * (3 - 2 * t)
}

/**
 * 그 날의 자정 (보는 사람의 지역 시간 기준).
 *
 * UTC로 자르면 한국에서 밤 9시에 남긴 기억이 다음 날 것이 되어 하루가 통째로 밀린다.
 */
export function startOfDay(ms: number): number {
  const date = new Date(ms)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

/**
 * 달력으로 며칠 전인가.
 *
 * 경과한 밀리초를 86400000으로 나누면 안 된다. 어젯밤 11시에 남긴 기억이
 * 오늘 아침에는 '0일'이 되어 오늘 남긴 시간으로 읽힌다.
 */
export function calendarDaysAgo(createdAt: number, now: number = Date.now()): number {
  const days = Math.round((startOfDay(now) - startOfDay(createdAt)) / 86_400_000)
  return Math.max(0, days)
}

/** "9월 15일" — 해가 다르면 "2025년 9월 15일" */
export function formatMonthDay(ms: number, now: number = Date.now()): string {
  const date = new Date(ms)
  const month = `${date.getMonth() + 1}월 ${date.getDate()}일`
  return date.getFullYear() === new Date(now).getFullYear()
    ? month
    : `${date.getFullYear()}년 ${month}`
}

/** "2026. 09. 20" — 자릿수를 맞춘 날짜 */
export function formatStamp(ms: number): string {
  const date = new Date(ms)
  const two = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}. ${two(date.getMonth() + 1)}. ${two(date.getDate())}`
}

/** "2026. 9. 20." — 카드에 놓이는 날짜 */
export function formatDate(ms: number): string {
  const date = new Date(ms)
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}.`
}

/** "3년 2개월 전" — 숫자보다 문장으로 읽히게 */
export function describeElapsed(elapsedMs: number): string {
  const ms = Math.max(0, elapsedMs)
  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  const months = Math.floor(ms / MONTH_MS)
  const years = Math.floor(ms / YEAR_MS)

  if (years >= 1) {
    const restMonths = Math.floor((ms - years * YEAR_MS) / MONTH_MS)
    return restMonths > 0 ? `${years}년 ${restMonths}개월 전` : `${years}년 전`
  }
  if (months >= 1) return `${months}개월 전`
  if (days >= 1) return `${days}일 전`
  if (hours >= 1) return `${hours}시간 전`
  if (minutes >= 1) return `${minutes}분 전`
  return '방금 전'
}
