import type { Emotion, MemoryType, UniverseStar } from '@/types'
import { buildAmbient, type AmbientStar } from './stars'
import { NEBULA_DRIFTS, paintNebulaPixels } from './nebula'
import { safeAreaFor, toSafe } from './safeArea'
import { formFor, type FormShape } from './starForm'
import { getEmotion } from '@/constants/emotions'
import { getTone } from '@/constants/tones'
import { letgoDriftRatio, remainingLight } from '@/lib/starMath'
import type { Rect } from '@/lib/safeZones'
import { clamp01, hashString, lerp } from '@/lib/random'
import { growLinks, type LinkNode } from '@/lib/constellationLinks'

/**
 * 하늘.
 *
 * React 밖에서 requestAnimationFrame으로 돈다. 상태는 handle로만 전달한다.
 * 원작 `canvas/starfieldEngine.ts`의 규칙과 수치를 그대로 따르되,
 * 한 사람의 하늘에만 필요한 것들(NOW/THEN · 중력 · 잔광 보기 · 도감 판면 ·
 * 다시 도착한 빛)은 들여오지 않았다. 여기 있는 것은 공동 우주에 필요한 것뿐이다.
 *
 * 'lighter' 합성 + 미리 구운 스프라이트 캔버스. DPR은 2로 제한한다.
 */

/* ── 수치 (원작과 같다) ───────────────────────────────── */

/** 하늘이 처음 밝아 오는 데 걸리는 시간(초) */
const INTRO_REVEAL = 2.3
const MAX_DPR = 2
/** 시차로 밀려도 가장자리가 드러나지 않게 하는 여유 */
const OVERSCAN = 64

/** 별자리 — 모든 별을 잇지 않는다. 가까운 것끼리, 한 별에 두 개까지만. */
const LINK_RADIUS = 0.34 // 짧은 변에 대한 비율
const DEFAULT_LINK_MAX = 2
const LINK_INK = '#f0e6d2'
const LINK_BASE = 0.42
const LINK_WIDTH = 1.1
const LINK_WIDTH_NARROW = 1.35
const LINK_GLOW_WIDTH = 3.2
const LINK_GLOW_ALPHA = 0.17
/** 선이 별에 닿기 전에 멈추는 거리 (핵 반지름의 배수) */
const LINK_CLEAR = 1.7
const LINK_CLEAR_PAD = 3
/** 새 별의 연결선이 떠오르는 데 걸리는 시간(ms) */
const LINK_REVEAL_MS = 1800

/** 비추는 별의 숨 */
const FOCUS_PULSE = 0.22
const FOCUS_PULSE_PERIOD = 2.2
const FOCUS_GROW = 0.2
const FOCUS_HALO = 0.3

/** 빛이 우리의 우주로 건너가는 데 걸리는 시간(초) */
export const DEPARTURE_SECONDS = 2.6

/**
 * 닿은 빛이 하늘에 떠오르는 데 걸리는 시간(ms).
 *
 * 툭 켜지면 '추가되었다'가 되고, 배어 나오면 '도착했다'가 된다.
 * 선이 떠오르는 시간(1800ms)보다 짧아야 별이 먼저 보이고 선이 뒤따른다.
 */
const ARRIVE_MS = 1400

/**
 * 아무리 흐려도 이보다 어두워지지 않는다.
 *
 * 이 하늘의 빛은 원래 희미하지만, **보이지 않는 빛은 없는 빛이다.**
 * 네 면에 투사하면 더 묽어지므로 바닥을 둔다.
 */
export const MIN_STAR_ALPHA = 0.24
/** 핵과 번짐의 가장 작은 크기 (CSS 픽셀) */
export const MIN_CORE_R = 2.6
export const MIN_HALO_R = 9

/**
 * 흘려보낸 빛은 머물지 않는다.
 *
 * 지우는 것이 아니라 **조금씩 멀어진다.** 떠난 자리에는 잔광이 남는다 —
 * "흘려보낸 시간도, 없었던 시간이 되지는 않습니다."
 *
 * 멀어지는 거리는 짧은 변에 대한 비율이다. 크게 두면 제 별자리를 벗어나
 * 남의 별자리로 걸어 들어간다.
 */
const LETGO_DRIFT = 0.052
/** 떠난 자리에 남는 잔광의 짙기 */
const LETGO_TRACE_ALPHA = 0.26


/* ── 크기 ─────────────────────────────────────────────── */

export function coreRadius(brightness: number, coreScale: number, shape: FormShape): number {
  return (5 + brightness * 9) * shape.core * coreScale
}

export function haloRadius(brightness: number, haloScale: number, shape: FormShape): number {
  return (17 + brightness * 34) * shape.halo * haloScale
}

/**
 * 이 빛이 **가장 어두워지는 순간**의 밝기.
 *
 * 숨을 가장 깊이 내쉬고, 흘려보낸 빛이라면 다 옅어진 뒤의 값이다.
 * 바닥(`MIN_STAR_ALPHA`)이 지켜지는지 캔버스 없이도 셀 수 있게 떼어 두었다.
 */
export function dimmestAlpha(
  star: Pick<UniverseStar, 'type' | 'brightness' | 'createdAt'>,
  now: number = Date.now(),
): number {
  const breathDepth = star.type === 'letgo' ? 0.2 : 0.12
  const pulse = 1 - breathDepth
  return Math.max(star.brightness * pulse * remainingLight(star, now), MIN_STAR_ALPHA)
}

/** 화면에 실제로 그려지는 핵의 크기 (CSS 픽셀) */
export function drawnCoreRadius(brightness: number, coreScale: number, shape: FormShape): number {
  return Math.max(MIN_CORE_R, coreRadius(brightness, coreScale, shape))
}

/** 화면에 실제로 그려지는 번짐의 크기 (CSS 픽셀) */
export function drawnHaloRadius(brightness: number, haloScale: number, shape: FormShape): number {
  return Math.max(MIN_HALO_R, haloRadius(brightness, haloScale, shape))
}

function spikeRadius(brightness: number, shape: FormShape): number {
  return (34 + brightness * 54) * shape.spikeReach
}

/* ── 스프라이트 ───────────────────────────────────────── */

const spriteCache = new Map<string, HTMLCanvasElement>()

function withAlpha(color: string, alpha: number): string {
  const hex = color.replace('#', '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  const r = parseInt(full.slice(0, 2), 16)
  const g = parseInt(full.slice(2, 4), 16)
  const b = parseInt(full.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/** 핵이 뚜렷한 빛 */
function getGlowSprite(color: string): HTMLCanvasElement {
  const key = `glow:${color}`
  const cached = spriteCache.get(key)
  if (cached) return cached

  const size = 64
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const half = size / 2
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
    gradient.addColorStop(0, color)
    gradient.addColorStop(0.1, withAlpha(color, 0.8))
    gradient.addColorStop(0.3, withAlpha(color, 0.2))
    gradient.addColorStop(0.62, withAlpha(color, 0.05))
    gradient.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  spriteCache.set(key, canvas)
  return canvas
}

/** 핵 없이 번지기만 하는 잔광. 장노출 사진의 흐린 별. */
function getBloomSprite(color: string): HTMLCanvasElement {
  const key = `bloom:${color}`
  const cached = spriteCache.get(key)
  if (cached) return cached

  const size = 96
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const half = size / 2
    const gradient = ctx.createRadialGradient(half, half, 0, half, half, half)
    // 가운데를 태우지 않는다. 그래야 '점'이 아니라 '번짐'으로 보인다.
    gradient.addColorStop(0, withAlpha(color, 0.34))
    gradient.addColorStop(0.28, withAlpha(color, 0.2))
    gradient.addColorStop(0.58, withAlpha(color, 0.07))
    gradient.addColorStop(1, withAlpha(color, 0))
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, size, size)
  }
  spriteCache.set(key, canvas)
  return canvas
}

/** 회절 십자. 망원경 사진에서 밝은 별이 별처럼 보이게 만드는 것. */
function getSpikeSprite(color: string): HTMLCanvasElement {
  const key = `spike:${color}`
  const cached = spriteCache.get(key)
  if (cached) return cached

  const size = 160
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')
  if (ctx) {
    const half = size / 2
    ctx.translate(half, half)
    // 긴 세로·가로 축과 짧고 희미한 대각 축
    const arms: ReadonlyArray<[number, number, number]> = [
      [0, 1, 0.62],
      [Math.PI / 2, 0.96, 0.62],
      [Math.PI / 4, 0.36, 0.22],
      [-Math.PI / 4, 0.36, 0.22],
    ]
    for (const [angle, scale, strength] of arms) {
      ctx.save()
      ctx.rotate(angle)
      const reach = half * scale
      const gradient = ctx.createLinearGradient(-reach, 0, reach, 0)
      gradient.addColorStop(0, withAlpha(color, 0))
      gradient.addColorStop(0.42, withAlpha(color, strength * 0.28))
      gradient.addColorStop(0.5, withAlpha(color, strength))
      gradient.addColorStop(0.58, withAlpha(color, strength * 0.28))
      gradient.addColorStop(1, withAlpha(color, 0))
      ctx.fillStyle = gradient
      // 얇을수록 오래된 사진의 십자에 가깝다
      ctx.fillRect(-reach, -0.5, reach * 2, 1)
      ctx.restore()
    }
  }
  spriteCache.set(key, canvas)
  return canvas
}

/* ── 엔진 ─────────────────────────────────────────────── */

export interface SkyOptions {
  stars?: ReadonlyArray<UniverseStar>
  /** 별자리 선을 긋는가 */
  constellation?: boolean
  /** 한 빛이 이을 수 있는 선의 수 */
  linkMax?: number
  /** 하늘이 얼마나 물러나 있는가 (0~1) */
  dim?: number
  /** 처음 들어설 때 하늘이 서서히 밝아 오는가 */
  intro?: boolean
  /** 글자가 놓인 자리. 그 자리에는 선을 긋지 않는다. */
  safeZones?: ReadonlyArray<Rect>
  /** 이 별 하나만 또렷하게 비춘다 (방금 보낸 사람의 빛) */
  focusedId?: string | null
}

export interface DepartureSpec {
  emotion: Emotion
  type: MemoryType
  seed: number
  brightness: number
  /** 어디에서 출발하는가 (0~1 화면 비율). 비우면 한가운데 조금 아래. */
  from?: { x: number; y: number }
}

export interface SkyHandle {
  setOptions(next: SkyOptions): void
  /** 빛 하나가 우리의 우주로 건너간다 */
  playDeparture(spec: DepartureSpec): void
  /** 그 별이 지금 화면 어디에 있는가 */
  locate(id: string): { x: number; y: number } | null
  destroy(): void
}

interface DrawnStar {
  star: UniverseStar
  emotion: Emotion
  shape: FormShape
  /** 중심광 · 외곽광 · 잔광 — 색은 마음이 정한다 */
  coreSprite: HTMLCanvasElement
  haloSprite: HTMLCanvasElement
  trailSprite: HTMLCanvasElement
  spikeSprite: HTMLCanvasElement
  spikes: boolean
  coreScale: number
  haloScale: number
  phase: number
  /** 떠난 자리 — 흘려보낸 빛은 여기에서 멀어진다 */
  px: number
  py: number
  /** 이 하늘에서 처음 보인 때. 떠오르는 연출과 선이 배어 나오는 데 쓴다. */
  bornAt: number
  /** 이어진 상대 (별의 id). **한 번 그어진 선은 지워지지 않는다.** */
  links: string[]
  /** 이어진 선의 수. 둘을 넘지 않는다. */
  degree: number
  /** 흘려보낸 빛이 멀어지는 방향 */
  driftAngle: number
}

interface AmbientEntry {
  star: AmbientStar
  glow: HTMLCanvasElement
  bloom: HTMLCanvasElement
  spike: HTMLCanvasElement
}

export function createSky(canvas: HTMLCanvasElement, initial: SkyOptions = {}): SkyHandle {
  const maybeCtx = canvas.getContext('2d', { alpha: false })
  if (!maybeCtx) {
    // 캔버스를 쓸 수 없는 환경이라면 하늘 없이도 글자는 읽혀야 한다
    return {
      setOptions: () => {},
      playDeparture: () => {},
      locate: () => null,
      destroy: () => {},
    }
  }
  const ctx = maybeCtx

  let options: SkyOptions = { ...initial }
  let width = 1
  let height = 1
  let dpr = 1
  let running = true
  let raf = 0
  let start = 0
  let introStart: number | null = null

  let backdrop: CanvasGradient | null = null
  let nebula: HTMLCanvasElement | null = null
  let ambient: AmbientEntry[] = []
  /** 이름으로 찾는 빛들. 더해질 때 이미 있는 것을 알아보는 데 쓴다. */
  const byId = new Map<string, DrawnStar>()
  /** 그리는 차례. byId의 값들을 늘어놓은 것이다. */
  let order: DrawnStar[] = []

  let departure: { spec: DepartureSpec; at: number; from: { x: number; y: number } } | null = null

  const reducedMotion =
    globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false

  /* ── 성운 ───────────────────────────────────────────── */

  function paintNebula() {
    const nw = Math.max(140, Math.round(width / 4))
    const nh = Math.max(140, Math.round(height / 4))

    const raw = document.createElement('canvas')
    raw.width = nw
    raw.height = nh
    const rawCtx = raw.getContext('2d')
    if (!rawCtx) return

    const image = rawCtx.createImageData(nw, nh)
    paintNebulaPixels(image.data, nw, nh)
    rawCtx.putImageData(image, 0, 0)

    const layer = document.createElement('canvas')
    layer.width = nw
    layer.height = nh
    const layerCtx = layer.getContext('2d')
    if (!layerCtx) return

    // 잡음의 날을 죽인다
    if ('filter' in layerCtx) layerCtx.filter = 'blur(1px)'
    layerCtx.drawImage(raw, 0, 0)
    if ('filter' in layerCtx) layerCtx.filter = 'none'

    // 큰 결. 중심이 아니라 어긋난 세 곳에 둔다.
    layerCtx.globalCompositeOperation = 'lighter'
    for (const drift of NEBULA_DRIFTS) {
      const cx = drift.x * nw
      const cy = drift.y * nh
      const radius = drift.r * Math.max(nw, nh)
      const gradient = layerCtx.createRadialGradient(cx, cy, 0, cx, cy, radius)
      gradient.addColorStop(0, withAlpha(drift.color, drift.a))
      gradient.addColorStop(0.5, withAlpha(drift.color, drift.a * 0.34))
      gradient.addColorStop(1, withAlpha(drift.color, 0))
      layerCtx.fillStyle = gradient
      layerCtx.fillRect(0, 0, nw, nh)
    }

    nebula = layer
  }

  /**
   * 하늘에는 예산이 있다.
   *
   * 빛이 쌓일수록 이름 없는 주변 별이 물러난다. 그래야 별이 수백 개가
   * 되어도 화면이 그리는 총량이 크게 늘지 않는다. 뜻으로도 맞는다 —
   * 사람들의 빛이 그 자리를 대신하는 것이다.
   */
  function resolveDensity(): number {
    const area = width * height
    // 1280×800 기준 약 260개
    const base = clamp01(area / (1280 * 800)) * 190 + 105
    const taken = Math.min(base * 0.55, (options.stars?.length ?? 0) * 0.5)
    return Math.max(90, Math.round(base - taken))
  }

  /* ── 자리 ───────────────────────────────────────────── */

  /**
   * 하늘에 떠 있는 빛들.
   *
   * **다시 짓지 않는다.** 빛이 하나 더해져도 이미 떠 있는 별의 객체는
   * 그대로 두고 새것만 끼워 넣는다. 통째로 다시 지으면 그 순간 모든 별의
   * 나이(떠오른 때)와 이어 둔 선이 사라져, 하늘이 한 번 깜박인다.
   */
  function syncStars() {
    const list = options.stars ?? []
    const now = Date.now()
    const area = safeAreaFor(width, height)

    /*
     * 닿은 빛만 하늘에 있다.
     * 건너가는 중인 빛은 아직 이 하늘의 것이 아니다 — 그 장면은
     * `drawDeparture`가 맡는다.
     */
    const arrived = list.filter((star) => star.status !== 'sending')
    const wanted = new Set(arrived.map((star) => star.id))

    // 사라진 빛을 거둔다 (점검용 빛을 비웠을 때)
    for (const id of [...byId.keys()]) {
      if (!wanted.has(id)) byId.delete(id)
    }

    let added = false
    for (const star of arrived) {
      const was = byId.get(star.id)
      if (was) {
        // 같은 빛이다. 내용만 새것으로 갈아 끼운다 — 나이와 선은 지킨다.
        was.star = star
        continue
      }

      const emotion = getEmotion(star.emotion)
      const tone = getTone(star.type)
      const spot = toSafe(star.x, star.y, area)
      const drawn: DrawnStar = {
        star,
        emotion,
        shape: formFor(emotion, star.seed),
        /*
         * **색은 마음이 정하고, 간직/흘려보내기는 밝기와 크기와 갈래만 정한다.**
         *
         * 세 겹이 모두 그 마음의 색을 진다 — 중심광 · 외곽광 · 잔광.
         * 멀리서 별 하나만 보아도 어떤 마음인지 읽혀야 하기 때문이다.
         * 두 축은 나란하므로 어느 한쪽이 다른 쪽을 덮어쓰지 않는다.
         */
        coreSprite: getGlowSprite(emotion.light.core),
        haloSprite: getBloomSprite(emotion.light.halo),
        trailSprite: getBloomSprite(emotion.light.trail),
        spikeSprite: getSpikeSprite(emotion.light.core),
        spikes: tone.spikes,
        coreScale: tone.coreScale,
        haloScale: tone.haloScale,
        phase: ((hashString(star.id) % 1000) / 1000) * Math.PI * 2,
        px: spot.x * width,
        py: spot.y * height,
        bornAt: now,
        links: [],
        degree: 0,
        driftAngle: ((hashString(star.id + ':drift') % 1000) / 1000) * Math.PI * 2,
      }
      byId.set(star.id, drawn)
      added = true
    }

    order = [...byId.values()]
    // 새로 온 빛만 이어 준다. 이미 그어진 선은 건드리지 않는다.
    if (added) growConstellations()
  }

  /**
   * 화면 크기가 바뀌었다. 자리를 다시 재고 선을 처음부터 다시 긋는다.
   *
   * 선을 다시 긋는 것은 이을 수 있는 거리가 화면 크기에 달려 있기 때문이다.
   * 빛이 하나 더해질 때는 이 길로 오지 않는다 — 여기는 창을 끌 때만이다.
   */
  function relayout() {
    const area = safeAreaFor(width, height)
    for (const drawn of byId.values()) {
      const spot = toSafe(drawn.star.x, drawn.star.y, area)
      drawn.px = spot.x * width
      drawn.py = spot.y * height
      drawn.links = []
      drawn.degree = 0
    }
    order = [...byId.values()]
    growConstellations()
  }

  /**
   * 별자리를 자라게 한다.
   *
   * 규칙 자체는 `lib/constellationLinks.ts`에 있다 — 캔버스 없이도
   * 확인할 수 있어야 하는 셈이기 때문이다. 여기서는 그 셈에 지금의
   * 자리를 넘겨 주고, 나온 결과를 하늘의 별에 되돌려 담기만 한다.
   */
  function growConstellations() {
    const nodes: LinkNode[] = order.map((drawn) => ({
      id: drawn.star.id,
      x: drawn.px,
      y: drawn.py,
      type: drawn.star.type,
      constellation: drawn.star.constellation,
      radius: coreRadius(drawn.star.brightness, drawn.coreScale, drawn.shape),
      links: drawn.links,
      degree: drawn.degree,
    }))

    growLinks(nodes, {
      radius: Math.min(width, height) * LINK_RADIUS,
      linkMax: options.linkMax ?? DEFAULT_LINK_MAX,
    })

    for (let i = 0; i < order.length; i += 1) {
      order[i].links = nodes[i].links
      order[i].degree = nodes[i].degree
    }
  }

  /* ── 화면 ───────────────────────────────────────────── */

  function resize() {
    const rect = canvas.getBoundingClientRect()
    dpr = Math.min(globalThis.devicePixelRatio || 1, MAX_DPR)

    width = Math.max(1, rect.width)
    height = Math.max(1, rect.height)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    backdrop = null
    ambient = buildAmbient(resolveDensity(), 0xa17e33).map((star) => ({
      star,
      glow: getGlowSprite(star.color),
      bloom: getBloomSprite(star.color),
      spike: getSpikeSprite(star.color),
    }))
    paintNebula()
    syncStars()
    relayout()
  }

  /**
   * 하늘이 얼마나 드러났는가. 0이면 거의 검정뿐이다.
   */
  function skyReveal(time: number): number {
    const dim = options.dim ?? 0
    if (introStart === null) return 1 - dim
    const t = clamp01((time - introStart) / INTRO_REVEAL)
    // 거듭제곱. easeOut 계열은 초반에 급히 올라 '처음에는 거의 어두운 우주'가 깨진다.
    return Math.pow(t, 1.6) * (1 - dim)
  }

  function drawBackground(ox: number, oy: number, reveal: number) {
    if (!backdrop) {
      backdrop = ctx.createLinearGradient(width * 0.82, 0, width * 0.16, height)
      backdrop.addColorStop(0, '#04050b')
      backdrop.addColorStop(0.42, '#06070e')
      backdrop.addColorStop(0.76, '#090911')
      backdrop.addColorStop(1, '#0c0b14')
    }
    ctx.fillStyle = backdrop
    ctx.fillRect(0, 0, width, height)

    if (nebula) {
      // 성운이 가장 느리게 움직인다. 가장 멀리 있으므로.
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = reveal
      ctx.drawImage(
        nebula,
        -OVERSCAN + ox * 0.2,
        -OVERSCAN + oy * 0.2,
        width + OVERSCAN * 2,
        height + OVERSCAN * 2,
      )
      ctx.globalAlpha = 1
      ctx.globalCompositeOperation = 'source-over'
    }
  }

  function drawAmbient(time: number, ox: number, oy: number, reveal: number) {
    ctx.globalCompositeOperation = 'lighter'

    for (const entry of ambient) {
      const star = entry.star
      // 숨 쉬지 않는 별은 sin을 계산하지도 않는다
      const breath =
        star.breathes && !reducedMotion
          ? 1 - star.amplitude + star.amplitude * Math.sin(time * star.speed + star.phase)
          : 1
      const alpha = star.alpha * breath * reveal
      if (alpha <= 0.012) continue

      // 깊이가 다르면 속도가 다르다. 가까운 별이 가장 많이 움직인다.
      const speed = 0.35 + star.depth * 1.05
      const px = star.x * width + ox * speed
      const py = star.y * height + oy * speed

      ctx.globalAlpha = alpha

      switch (star.kind) {
        case 'point': {
          // 흐린 그라디언트가 아니라 또렷한 점. 오래된 사진 속 별의 대부분.
          ctx.fillStyle = star.color
          const s = star.size
          ctx.fillRect(px, py, s, s)
          break
        }
        case 'soft': {
          const r = star.size * 3.4
          ctx.drawImage(entry.glow, px - r, py - r, r * 2, r * 2)
          break
        }
        case 'bloom': {
          // 핵이 없다. 번지기만 한다.
          const r = star.size * 9
          ctx.drawImage(entry.bloom, px - r, py - r, r * 2, r * 2)
          break
        }
        case 'spike': {
          const r = star.size * 3.2
          ctx.drawImage(entry.glow, px - r, py - r, r * 2, r * 2)
          const s = star.size * 17
          ctx.globalAlpha = alpha * 0.5
          ctx.drawImage(entry.spike, px - s, py - s, s * 2, s * 2)
          break
        }
      }
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  /**
   * 글자가 놓인 자리를 도려낸다.
   *
   * 화면 전체와 글자 자리들을 한 길에 담고 '홀짝' 규칙으로 자른다.
   * 부르는 쪽에서 save/restore로 감싸야 한다.
   */
  function clipAwayFromWords() {
    const zones = options.safeZones ?? []
    if (zones.length === 0) return
    ctx.beginPath()
    ctx.rect(0, 0, width, height)
    for (const zone of zones) ctx.rect(zone.x, zone.y, zone.w, zone.h)
    ctx.clip('evenodd')
  }

  /** 갓 앉은 별의 선은 천천히 배어 나온다 */
  function linkFade(drawn: DrawnStar, now: number): number {
    return clamp01((now - drawn.bornAt) / LINK_REVEAL_MS)
  }

  /** 닿은 빛이 하늘에 떠오르는 정도 (0~1) */
  function arriving(drawn: DrawnStar, now: number): number {
    return clamp01((now - drawn.bornAt) / ARRIVE_MS)
  }

  /**
   * 흘려보낸 빛이 지금 어디쯤 멀어져 있는가.
   *
   * 간직한 빛은 움직이지 않는다 — 0을 돌려준다.
   */
  function driftOf(drawn: DrawnStar, now: number): number {
    return letgoDriftRatio(drawn.star, now) * LETGO_DRIFT * Math.min(width, height)
  }

  /** 이 빛이 지금 그려질 자리 */
  function placeOf(drawn: DrawnStar, now: number, ox: number, oy: number) {
    const away = driftOf(drawn, now)
    return {
      x: drawn.px + ox * 0.7 + Math.cos(drawn.driftAngle) * away,
      y: drawn.py + oy * 0.7 + Math.sin(drawn.driftAngle) * away,
    }
  }

  function drawConstellation(ox: number, oy: number, reveal: number) {
    if (options.constellation === false || order.length < 2) return

    const now = Date.now()
    ctx.save()
    /*
     * 글자 자리를 먼저 도려낸다.
     * 먼저 읽혀야 하는 것은 글자와 별이고, 선은 그다음이다.
     */
    clipAwayFromWords()
    ctx.globalCompositeOperation = 'lighter'

    const narrow = width < 640
    const lineWidth = narrow ? LINK_WIDTH_NARROW : LINK_WIDTH
    const lift = narrow ? 1.12 : 1

    for (const a of order) {
      for (const id of a.links) {
        const b = byId.get(id)
        if (!b) continue

        // 간직한 빛끼리만 잇는다. 둘 다 움직이지 않으므로 선도 흔들리지 않는다.
        const from = placeOf(a, now, ox, oy)
        const to = placeOf(b, now, ox, oy)

        /*
         * 별 둘레를 비운다. 선이 별 한가운데를 뚫고 지나가면
         * 그건 이어진 것이 아니라 꿰뚫린 것이다.
         */
        const spanX = to.x - from.x
        const spanY = to.y - from.y
        const span = Math.hypot(spanX, spanY)
        const clearA =
          coreRadius(a.star.brightness, a.coreScale, a.shape) * LINK_CLEAR + LINK_CLEAR_PAD
        const clearB =
          coreRadius(b.star.brightness, b.coreScale, b.shape) * LINK_CLEAR + LINK_CLEAR_PAD
        if (span <= clearA + clearB + 6) continue

        const ax = from.x + (spanX / span) * clearA
        const ay = from.y + (spanY / span) * clearA
        const bx = to.x - (spanX / span) * clearB
        const by = to.y - (spanY / span) * clearB

        /*
         * 흐린 별끼리는 선도 흐리다. 다만 밝기를 그대로 곱하지는 않는다 —
         * 0.6짜리 별의 선이 0.6배로 어두워지면 그 연결은 없는 것이나 같다.
         * 바닥을 들어 0.84~1.0 사이로 눌러 둔다.
         */
        const dim = Math.min(a.star.brightness, b.star.brightness)
        const strength = (0.6 + 0.4 * dim) * Math.min(linkFade(a, now), linkFade(b, now))

        const alpha = strength * reveal * lift * LINK_BASE
        if (alpha <= 0.004) continue

        ctx.beginPath()
        ctx.moveTo(ax, ay)
        ctx.lineTo(bx, by)

        // 둘레의 번짐을 먼저 깔고, 그 위에 또렷한 선 하나
        ctx.lineWidth = lineWidth * LINK_GLOW_WIDTH
        ctx.strokeStyle = withAlpha(LINK_INK, alpha * LINK_GLOW_ALPHA)
        ctx.stroke()

        ctx.lineWidth = lineWidth
        ctx.strokeStyle = withAlpha(LINK_INK, alpha)
        ctx.stroke()
      }
    }

    ctx.restore()
  }

  /** 비추는 별의 숨. 밝기가 아니라 크기에 실린다. */
  function focusPulse(time: number): number {
    if (reducedMotion) return 1
    return 1 + FOCUS_PULSE * (0.5 + 0.5 * Math.sin((time / FOCUS_PULSE_PERIOD) * Math.PI * 2))
  }

  function drawStars(time: number, ox: number, oy: number, reveal: number) {
    if (order.length === 0) return

    const now = Date.now()
    ctx.globalCompositeOperation = 'lighter'

    for (const drawn of order) {
      const { star, shape } = drawn

      const spot = placeOf(drawn, now, ox, oy)
      const px = spot.x
      const py = spot.y

      /*
       * 숨.
       * 흘려보낸 잔광은 조금 더 깊게 쉰다. 거의 꺼진 빛을 눈이 찾아내는
       * 단서가 밝기가 아니라 '변하고 있다'는 사실이기 때문이다.
       */
      const breathDepth = star.type === 'letgo' ? 0.2 : 0.12
      const pulse = reducedMotion
        ? 1
        : 1 - breathDepth + breathDepth * Math.sin(time * 0.11 + drawn.phase)

      // 흘려보낸 빛은 천천히 옅어져 잔광만 남는다. 사라지지는 않는다.
      const left = remainingLight(star, now)

      const lit = star.id === options.focusedId ? focusPulse(time) : 0
      const focus = star.id === options.focusedId ? 1.35 : 1

      /*
       * 보이지 않는 빛은 없는 빛이다.
       *
       * 이 하늘의 빛은 원래 희미하지만, 바닥은 둔다. 떠오르는 중인 빛에는
       * 바닥을 적용하지 않는다 — 그러면 배어 나오지 않고 툭 켜진다.
       */
      const settled = Math.max(star.brightness * pulse * left * focus, MIN_STAR_ALPHA)
      const rising = arriving(drawn, now)
      const alpha = clamp01(settled * reveal * rising)
      if (alpha <= 0.004) continue

      // 떠오르는 동안에는 작게 시작해 제 크기가 된다
      const grow = (1 + FOCUS_GROW * lit) * lerp(0.72, 1, rising)

      /*
       * 떠나온 자리의 잔광.
       *
       * 흘려보낸 빛이 멀어진 만큼, 원래 있던 자리에 희미한 흔적이 남는다.
       * 사라진 것이 아니라 조금 멀어진 것이라는 말을 그림으로 하는 자리다.
       */
      const away = driftOf(drawn, now)
      if (away > 2) {
        const traceR = Math.max(MIN_HALO_R, haloRadius(star.brightness, drawn.haloScale, shape) * 0.52)
        ctx.globalAlpha = clamp01(alpha * LETGO_TRACE_ALPHA * shape.haloAlpha)
        ctx.drawImage(
          drawn.trailSprite,
          drawn.px + ox * 0.7 - traceR,
          drawn.py + oy * 0.7 - traceR,
          traceR * 2,
          traceR * 2,
        )
      }

      // halo는 밝기보다 크게 자란다. 커지는 것이 눈에 먼저 들어오기 때문이다.
      const haloR = Math.max(
        MIN_HALO_R,
        haloRadius(star.brightness, drawn.haloScale, shape) * grow * (1 + FOCUS_HALO * lit),
      )
      const haloInk = clamp01(alpha * 0.7 * shape.haloAlpha)

      /*
       * 가장 바깥의 잔광.
       *
       * 외곽광보다 넓고 훨씬 옅다. 이 한 겹이 있어야 별이 '점'이 아니라
       * '빛'으로 읽히고, 멀리서도 그 마음의 색이 번져 보인다.
       */
      const trailR = haloR * 1.75
      ctx.globalAlpha = clamp01(haloInk * 0.34)
      ctx.drawImage(drawn.trailSprite, px - trailR, py - trailR, trailR * 2, trailR * 2)

      ctx.globalAlpha = haloInk
      ctx.drawImage(drawn.haloSprite, px - haloR, py - haloR, haloR * 2, haloR * 2)

      const coreR = Math.max(
        MIN_CORE_R,
        coreRadius(star.brightness, drawn.coreScale, shape) * grow,
      )
      ctx.globalAlpha = alpha
      ctx.drawImage(drawn.coreSprite, px - coreR, py - coreR, coreR * 2, coreR * 2)

      /*
       * 잔광의 핵은 거의 사라져 있다. 그 상태로는 '무언가 번져 있다'는
       * 인상만 남고 '별 하나가 저기 있다'가 되지 않는다. 가운데에 또렷한
       * 점 하나를 두면 눈이 곧바로 그것을 별로 읽는다.
       */
      if (!drawn.spikes) {
        ctx.globalAlpha = clamp01(alpha * 0.8)
        const dotR = 1.6
        ctx.drawImage(drawn.coreSprite, px - dotR * 3, py - dotR * 3, dotR * 6, dotR * 6)
      }

      // 갈래는 간직한 빛에만, 그것도 모양이 허락할 때만
      if (drawn.spikes && shape.spike > 0) {
        const r = spikeRadius(star.brightness, shape) * grow
        ctx.globalAlpha = clamp01(alpha * shape.spike * 0.5)
        ctx.drawImage(drawn.spikeSprite, px - r, py - r, r * 2, r * 2)
      }
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  function drawDeparture(time: number) {
    if (!departure) return

    const t = clamp01((time - departure.at) / DEPARTURE_SECONDS)
    if (t >= 1) {
      departure = null
      return
    }

    const { spec, from } = departure
    const tone = getTone(spec.type)
    const shape = formFor(spec.emotion, spec.seed)

    // 가속한다. 처음에는 머뭇거리다 끝에 빠르게 멀어진다.
    const travel = t * t * (3 - 2 * t)
    const px = lerp(from.x, width * 0.5, travel)
    // 위로, 그리고 화면 밖으로
    const py = lerp(from.y, -height * 0.25, travel)

    // 멀어질수록 작아지고 흐려진다
    const scale = lerp(1, 0.12, travel)
    const fade = t < 0.75 ? 1 : 1 - (t - 0.75) / 0.25

    ctx.globalCompositeOperation = 'lighter'

    const haloR = haloRadius(spec.brightness, tone.haloScale, shape) * scale * 1.6
    ctx.globalAlpha = clamp01(0.7 * shape.haloAlpha * fade)
    const halo = getBloomSprite(spec.emotion.light.halo)
    ctx.drawImage(halo, px - haloR, py - haloR, haloR * 2, haloR * 2)

    const coreR = coreRadius(spec.brightness, tone.coreScale, shape) * scale * 1.6
    ctx.globalAlpha = clamp01(fade)
    const core = getGlowSprite(spec.emotion.light.core)
    ctx.drawImage(core, px - coreR, py - coreR, coreR * 2, coreR * 2)

    if (tone.spikes) {
      const r = spikeRadius(spec.brightness, shape) * scale * 1.4
      ctx.globalAlpha = clamp01(0.55 * fade)
      ctx.drawImage(getSpikeSprite(spec.emotion.light.core), px - r, py - r, r * 2, r * 2)
    }

    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  /* ── 시차 ───────────────────────────────────────────── */

  let pointerX = 0
  let pointerY = 0
  let pointerLive = false

  function onPointerMove(event: PointerEvent) {
    pointerLive = true
    pointerX = event.clientX / width - 0.5
    pointerY = event.clientY / height - 0.5
  }

  function onPointerLeave() {
    pointerLive = false
  }

  /**
   * 하늘이 아주 천천히 흐른다.
   *
   * 키오스크에서는 손이 화면에 거의 닿지 않는다. 포인터만 보고 있으면
   * 하늘이 정지화면처럼 굳어 버리므로, 스스로 아주 느리게 흐르게 둔다.
   * 두 주기가 서로 나누어떨어지지 않아 같은 자리로 돌아오지 않는다.
   */
  function offset(time: number): { x: number; y: number } {
    if (reducedMotion) return { x: 0, y: 0 }
    const driftX = Math.sin(time * 0.037) * 22
    const driftY = Math.cos(time * 0.029) * 16
    if (!pointerLive) return { x: driftX, y: driftY }
    return { x: driftX + pointerX * -26, y: driftY + pointerY * -18 }
  }

  /* ── 루프 ───────────────────────────────────────────── */

  function draw(time: number) {
    const reveal = skyReveal(time)
    const { x: ox, y: oy } = offset(time)

    drawBackground(ox, oy, reveal)
    drawAmbient(time, ox, oy, reveal)
    drawConstellation(ox, oy, reveal)
    drawStars(time, ox, oy, reveal)
    drawDeparture(time)
  }

  function frame(now: number) {
    if (!running) return
    if (!start) start = now
    draw((now - start) / 1000)
    raf = globalThis.requestAnimationFrame(frame)
  }

  /* ── 시작 ───────────────────────────────────────────── */

  const observer =
    typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => resize()) : null
  observer?.observe(canvas)
  globalThis.addEventListener('resize', resize)
  globalThis.addEventListener('pointermove', onPointerMove)
  globalThis.addEventListener('pointerleave', onPointerLeave)

  resize()
  if (options.intro) introStart = 0
  raf = globalThis.requestAnimationFrame(frame)

  return {
    setOptions(next) {
      const starsChanged = next.stars !== options.stars
      const linksChanged = next.linkMax !== options.linkMax
      options = { ...options, ...next }
      // 빛이 더해지면 새것만 끼운다. 이을 수 있는 거리가 바뀌었을 때만 다시 긋는다.
      if (starsChanged) syncStars()
      if (linksChanged) relayout()
    },

    playDeparture(spec) {
      const elapsed = start ? (performance.now() - start) / 1000 : 0
      departure = {
        spec,
        at: elapsed,
        from: spec.from
          ? { x: spec.from.x * width, y: spec.from.y * height }
          : { x: width * 0.5, y: height * 0.56 },
      }
    },

    locate(id) {
      const found = byId.get(id)
      if (!found) return null
      const { x: ox, y: oy } = offset(start ? (performance.now() - start) / 1000 : 0)
      return placeOf(found, Date.now(), ox, oy)
    },

    destroy() {
      running = false
      globalThis.cancelAnimationFrame(raf)
      observer?.disconnect()
      globalThis.removeEventListener('resize', resize)
      globalThis.removeEventListener('pointermove', onPointerMove)
      globalThis.removeEventListener('pointerleave', onPointerLeave)
    },
  }
}
