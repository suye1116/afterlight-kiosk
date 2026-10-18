/**
 * 하늘을 계측해 본다.
 *
 * 브라우저가 없으므로 캔버스 자리에 **세는 캔버스**를 끼운다. 원작이 쓰던 방법이다.
 * 진짜로 그려지는지는 눈으로 봐야 하지만, "별이 몇 번 그려졌는가",
 * "빛이 하나 더해졌을 때 나머지가 다시 지어졌는가"는 이렇게 셀 수 있다.
 *
 * 여기서 확인하는 것은 하나다 —
 * **새 빛이 와도 하늘은 다시 지어지지 않는다.**
 */
import type { Emotion, UniverseStar } from '@/types'
import { EMOTIONS } from '@/constants/emotions'
import { constellationIdFor } from '@/lib/starMath'
/*
 * 엔진을 그냥 들여와도 된다 — 모듈을 읽는 동안에는 document를 건드리지 않고,
 * `createSky`를 부를 때 비로소 캔버스를 찾기 때문이다.
 * 그래서 흉내 낸 브라우저는 그 전까지만 깔아 두면 된다.
 */
import { createSky } from '@/canvas/skyEngine'

let pass = 0
let fail = 0
function ok(name: string, condition: boolean, extra = '') {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`) }
  else { fail += 1; console.log(`  ✗ ${name} ${extra}`) }
}
function section(name: string) { console.log(`\n${name}`) }

/* ── 세는 캔버스 ─────────────────────────────────────── */

interface Tally {
  drawImage: number
  stroke: number
  fillRect: number
}

function makeContext(tally: Tally) {
  const gradient = { addColorStop() {} }
  return {
    canvas: null as unknown,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '' as unknown,
    strokeStyle: '' as unknown,
    lineWidth: 1,
    filter: 'none',
    imageSmoothingEnabled: true,
    imageSmoothingQuality: 'high',
    setTransform() {},
    save() {},
    restore() {},
    translate() {},
    rotate() {},
    beginPath() {},
    rect() {},
    clip() {},
    moveTo() {},
    lineTo() {},
    stroke() { tally.stroke += 1 },
    fillRect() { tally.fillRect += 1 },
    drawImage() { tally.drawImage += 1 },
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4) }),
    putImageData() {},
  }
}

const tally: Tally = { drawImage: 0, stroke: 0, fillRect: 0 }

/*
 * 손에 쥔 시계.
 *
 * 별자리의 선은 1.8초에 걸쳐 **배어 나온다**(`LINK_REVEAL_MS`). 갓 앉은 별의
 * 선을 곧바로 세면 당연히 0이다 — 그건 고장이 아니라 연출이다.
 * 시계를 직접 돌려야 '그 뒤에 선이 생기는가'를 볼 수 있다.
 */
let clock = 1_700_000_000_000
Date.now = () => clock
function wait(ms: number) {
  clock += ms
}

function makeCanvas() {
  const canvas: Record<string, unknown> = { width: 0, height: 0 }
  canvas.getContext = () => makeContext(tally)
  canvas.getBoundingClientRect = () => ({ width: 1280, height: 800, left: 0, top: 0 })
  return canvas
}

/* ── 브라우저 흉내 ───────────────────────────────────── */

let frame: ((now: number) => void) | null = null
const g = globalThis as unknown as Record<string, unknown>

g.document = { createElement: () => makeCanvas() }
g.devicePixelRatio = 2
g.requestAnimationFrame = (callback: (now: number) => void) => {
  frame = callback
  return 1
}
g.cancelAnimationFrame = () => {}
g.matchMedia = () => ({ matches: false })
if (!g.addEventListener) g.addEventListener = () => {}
if (!g.removeEventListener) g.removeEventListener = () => {}

/** 한 판 그린다 */
function tick(at: number) {
  const run = frame
  frame = null
  run?.(at)
}

/* ── 하늘을 띄운다 ───────────────────────────────────── */

let seq = 0
function star(emotion: Emotion, type: 'keep' | 'letgo', x: number, y: number): UniverseStar {
  seq += 1
  return {
    id: `s${seq}`,
    seq,
    sessionId: 'sky',
    source: 'live',
    text: '하늘을 세어 본다',
    timeRef: { kind: 'unknown', label: '기억나지 않음' },
    emotion: emotion.type,
    type,
    createdAt: Date.now(),
    arrivedAt: Date.now(),
    x,
    y,
    brightness: type === 'keep' ? 0.9 : 0.5,
    seed: seq * 7919,
    constellation: constellationIdFor(emotion),
    status: 'arrived',
  }
}

/** 한 별자리 안에 고르게 흩어 둔다 */
function cluster(emotion: Emotion, count: number, type: 'keep' | 'letgo' = 'keep') {
  const f = emotion.field
  const made: UniverseStar[] = []
  for (let i = 0; i < count; i += 1) {
    const t = (i + 0.5) / count
    made.push(
      star(
        emotion,
        type,
        f.left + (f.right - f.left) * (0.15 + 0.7 * ((i * 0.37) % 1)),
        f.top + (f.bottom - f.top) * (0.15 + 0.7 * t),
      ),
    )
  }
  return made
}

section('하늘을 계측한다')

const canvas = makeCanvas() as unknown as HTMLCanvasElement
let stars = [...cluster(EMOTIONS[0], 8), ...cluster(EMOTIONS[1], 8), ...cluster(EMOTIONS[2], 6)]
const sky = createSky(canvas, { stars, constellation: true, linkMax: 2, dim: 0 })

tick(0)
tick(16)
const justBorn = { ...tally }
ok('별과 성운이 그려진다', justBorn.drawImage > 0, `(drawImage ${justBorn.drawImage}번)`)
ok('갓 앉은 별의 선은 아직 없다 — 배어 나오는 중이다', justBorn.stroke === 0,
  `(stroke ${justBorn.stroke}번)`)

// 선이 다 배어 나올 때까지 기다린다
wait(2_000)
tally.stroke = 0
tick(2_016)
ok('기다리면 별자리의 선이 그어진다', tally.stroke > 0, `(stroke ${tally.stroke}번)`)

/* ── 빛이 하나 더해진다 ──────────────────────────────── */

section('빛이 하나 더해질 때')

const locatedBefore = stars.map((one) => sky.locate(one.id))
ok('모든 별이 자기 자리를 알고 있다', locatedBefore.every((spot) => spot !== null))

const newcomer = cluster(EMOTIONS[0], 1)[0]
stars = [...stars, newcomer]
sky.setOptions({ stars })
tick(32)

// 선이 몇 개나 그어져 있었는지 세어 둔다
wait(2_000)
tally.stroke = 0
tick(4_000)
const strokesBefore = tally.stroke

const locatedAfter = stars.slice(0, -1).map((one) => sky.locate(one.id))
let moved = 0
for (let i = 0; i < locatedBefore.length; i += 1) {
  const was = locatedBefore[i]
  const now = locatedAfter[i]
  if (!was || !now) { moved += 1; continue }
  // 시차로 하늘이 아주 조금 흐르므로 1px 안쪽의 떨림은 같은 자리로 본다
  if (Math.abs(was.x - now.x) > 1.5 || Math.abs(was.y - now.y) > 1.5) moved += 1
}
ok('이미 떠 있던 별이 하나도 사라지지 않는다',
  locatedAfter.every((spot) => spot !== null))
ok('이미 떠 있던 별이 자리를 옮기지 않는다', moved === 0, `(옮긴 별 ${moved}개)`)
ok('새 별도 자기 자리를 받는다', sky.locate(newcomer.id) !== null)

// 새 별의 선까지 배어 나온 뒤에 다시 센다
wait(2_000)
tally.stroke = 0
tick(6_000)
ok('이미 그어진 선이 끊기지 않는다', tally.stroke >= strokesBefore,
  `(전 ${strokesBefore}번 → 후 ${tally.stroke}번)`)

/* ── 점검용 빛을 비운다 ──────────────────────────────── */

section('점검용 빛을 비울 때')
const keepers = stars.filter((one) => one.emotion !== EMOTIONS[1].type)
sky.setOptions({ stars: keepers })
tick(48)
ok('비운 별은 하늘에서 사라진다',
  stars.filter((one) => one.emotion === EMOTIONS[1].type).every((one) => sky.locate(one.id) === null))
ok('남은 별은 그대로 떠 있다', keepers.every((one) => sky.locate(one.id) !== null))

/* ── 건너가는 중인 빛 ────────────────────────────────── */

section('건너가는 중인 빛')
const flying = { ...cluster(EMOTIONS[3], 1)[0], status: 'sending' as const }
sky.setOptions({ stars: [...keepers, flying] })
tick(64)
ok('건너가는 중인 빛은 아직 하늘에 없다', sky.locate(flying.id) === null)

sky.setOptions({ stars: [...keepers, { ...flying, status: 'arrived' as const }] })
tick(80)
ok('닿으면 하늘에 뜬다', sky.locate(flying.id) !== null)

/* ── 흘려보낸 빛은 멀어진다 ──────────────────────────── */

section('흘려보낸 빛')
const long = clock - 120_000
const drifting = {
  ...cluster(EMOTIONS[4], 1, 'letgo')[0],
  createdAt: long,
  arrivedAt: long,
}
const still = cluster(EMOTIONS[5], 1, 'keep')[0]
sky.setOptions({ stars: [...keepers, drifting, still] })
tick(96)
const driftSpot = sky.locate(drifting.id)
const stillSpot = sky.locate(still.id)
ok('흘려보낸 빛도 하늘에 남아 있다', driftSpot !== null)
ok('간직한 빛은 제자리에 있다', stillSpot !== null)

// 멀어진 자리는 저장된 자리와 다르다
const area = { left: 0.085, right: 0.915, top: 0.21, bottom: 0.81 }
const origin = {
  x: (area.left + ((drifting.x - 0.06) / 0.88) * (area.right - area.left)) * 1280,
  y: (area.top + ((drifting.y - 0.1) / 0.78) * (area.bottom - area.top)) * 800,
}
const away = driftSpot ? Math.hypot(driftSpot.x - origin.x, driftSpot.y - origin.y) : 0
ok('흘려보낸 빛은 떠나온 자리에서 멀어져 있다', away > 10, `(${away.toFixed(1)}px)`)

sky.destroy()

console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
