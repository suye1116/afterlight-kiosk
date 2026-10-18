/**
 * 하늘 쪽 손(`src/lib/bridge.ts`)이 진짜 다리에 붙는가.
 *
 * `server/test.js`는 다리를 시험한다 — 생 WebSocket으로 붙어서.
 * 여기서는 **웹사이트가 실제로 쓰는 코드**로 붙는다. 그 둘 사이가 어긋나면
 * 다리는 멀쩡한데 작품만 말을 못 거는 일이 생긴다.
 *
 * 그리고 **끊겼다 다시 붙는지**를 본다. 전시 중에 서버를 한 번 껐다 켜는 일은
 * 반드시 생기고, 그때 사람이 브라우저를 새로고침하러 뛰어다닐 수는 없다.
 */
import { spawn } from 'node:child_process'
import { createBridge, EVENTS, toWallLight, type BridgeStatus, type LinkState } from '@/lib/bridge'
import { buildReceipt } from '@/lib/receipt'
import { constellationIdFor } from '@/lib/starMath'
import { EMOTIONS } from '@/constants/emotions'
import type { UniverseStar } from '@/types'

let pass = 0
let fail = 0
function ok(name: string, condition: boolean, extra = '') {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`) }
  else { fail += 1; console.log(`  ✗ ${name} ${extra}`) }
}
function section(name: string) { console.log(`\n${name}`) }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const PORT = 19982
const URL = `ws://127.0.0.1:${PORT}/sky`

function startBridge() {
  const child = spawn(
    process.execPath,
    ['server/index.js', '--port', String(PORT), '--quiet', '--printer', 'none', '--sim'],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  )
  child.stderr?.on('data', (chunk) => console.error('  [다리]', String(chunk).trim()))
  return child
}

/** 손 감지 센서 대역 자리. 생 WebSocket으로 `/sim`에 붙는다. */
function simDevice() {
  return new WebSocket(`ws://127.0.0.1:${PORT}/sim`)
}

/** 벽 자리. 생 WebSocket으로 붙어 받은 것을 모아 둔다. */
function wall() {
  const socket = new WebSocket(`ws://127.0.0.1:${PORT}/td`)
  const inbox: Record<string, unknown>[] = []
  socket.addEventListener('message', (event) => {
    try {
      const message = JSON.parse(String(event.data))
      inbox.push(message)
      const starId = message.star?.id
      socket.send(JSON.stringify({ command: 'ack', starId }))
      if (starId) socket.send(JSON.stringify({ command: 'shown', starId }))
    } catch {
      /* 깨진 것은 버린다 */
    }
  })
  return { socket, inbox }
}

function star(id: string): UniverseStar {
  const emotion = EMOTIONS[5]
  return {
    id,
    seq: 1,
    sessionId: 'link-check',
    source: 'live',
    text: '이 문장은 벽으로도 종이로도 가지 않는다',
    timeRef: { kind: 'years', years: 3, label: '3년쯤 전' },
    emotion: emotion.type,
    type: 'keep',
    createdAt: Date.now(),
    arrivedAt: Date.now(),
    x: 0.55,
    y: 0.6,
    brightness: 0.82,
    seed: 4242,
    constellation: constellationIdFor(emotion),
    status: 'arrived',
  }
}

/* ── 다리 없이도 괜찮은가 ────────────────────────────── */

section('다리가 없을 때')
{
  const links: LinkState[] = []
  const lonely = createBridge({ url: URL, onLink: (state) => links.push(state) })
  ok('붙지 못해도 던지지 않는다', true)
  ok('보내려 해도 조용히 false를 돌려준다', lonely.send('star.requested') === false)
  ok('별을 보내려 해도 마찬가지다', lonely.star(EVENTS.STAR_REQUESTED, star('s-none')) === false)
  await wait(300)
  ok('붙는 중 또는 끊김이라고 말한다',
    links.includes('connecting') || links.includes('closed'), `(${links.join(' → ')})`)
  lonely.close()
}

/* ── 다리를 띄운다 ───────────────────────────────────── */

section('하늘 쪽 손이 다리에 붙는다')

let bridge = startBridge()
await wait(500)

const links: LinkState[] = []
let status: BridgeStatus | null = null
let opened = 0
const sensorReadings: number[] = []
const shownIds: string[] = []

const handle = createBridge({
  url: URL,
  onLink: (state) => links.push(state),
  onStatus: (next) => { status = next },
  onOpen: () => { opened += 1 },
  onSensor: (cm) => { sensorReadings.push(cm) },
  onShown: (starId) => { shownIds.push(starId) },
})

const theWall = wall()
await wait(600)

ok('붙었다고 알려 준다', links.includes('open'), `(${links.join(' → ')})`)
ok('이어질 때 한 번 불린다', opened === 1, `(${opened}번)`)
ok('다리가 상태를 보내 준다', status !== null)
ok('하늘이 하나 붙어 있다고 센다', (status as BridgeStatus | null)?.sky === 1)

/* ── 빛 하나를 보낸다 ────────────────────────────────── */

section('빛 하나를 보낸다')

const one = star('link-001')
ok('보내진다', handle.star(EVENTS.STAR_REQUESTED, one, { travelSeconds: 2.6 }) === true)
await wait(400)

const atWall = theWall.inbox.find(
  (message) => message.event === EVENTS.STAR_REQUESTED,
) as { star?: Record<string, unknown> } | undefined
ok('벽에 닿는다', atWall?.star?.id === 'link-001')
ok('**벽으로 간 것에는 문장이 없다**', atWall !== undefined && !('text' in (atWall.star ?? {})))
ok('떼어 내는 일을 하늘에서도 한 번 한다', !('text' in toWallLight(one)))

handle.star(EVENTS.STAR_ARRIVED, one)
await wait(300)
ok('닿았다는 말도 벽으로 간다',
  theWall.inbox.some((message) => message.event === EVENTS.STAR_ARRIVED))

/* ── 영수증 ──────────────────────────────────────────── */

section('영수증')
{
  const receipt = buildReceipt(one, 12)
  ok('영수증에 기록 원문이 없다', receipt.text === undefined)
  ok('고른 항목만 있다',
    receipt.when === '3년쯤 전' && receipt.emotion === '슬픔' && receipt.how === '간직한 시간')
  ok('청하면 보내진다', handle.receipt(receipt) === true)
  await wait(400)
  ok('프린터를 쓰지 않아도 하늘은 멈추지 않는다', links[links.length - 1] === 'open')
}

/* ── 장치 사이드채널 ─────────────────────────────────── */

section('장치 사이드채널 — 손 감지 센서 · 벽의 확인 · LED')
{
  ok('벽이 "띄웠다"고 한 별의 id가 하늘 코드에도 닿는다',
    shownIds.includes('link-001'), `(${shownIds.join(', ')})`)

  const sim = simDevice()
  await new Promise((resolve, reject) => {
    sim.addEventListener('open', resolve)
    sim.addEventListener('error', reject)
  })
  sim.send(JSON.stringify({
    v: 1, id: crypto.randomUUID(), event: 'sensor.proximity', at: Date.now(), origin: 'stage', cm: 14,
  }))
  await wait(300)
  ok('대역이 보낸 거리가 하늘 코드(onSensor)에도 닿는다',
    sensorReadings.includes(14), `(${sensorReadings.join(', ')})`)
  sim.close()

  ok('LED 명령을 보낼 수 있다', handle.led(3) === true)
  ok('LED를 끄는 명령도 보낼 수 있다', handle.led('off') === true)
}

/* ── 끊겼다 다시 붙는다 ──────────────────────────────── */

section('다리를 껐다 켠다')

bridge.kill('SIGTERM')
await wait(700)
ok('끊겼다고 알려 준다', links.includes('closed'), `(${links.join(' → ')})`)
ok('끊긴 동안에는 조용히 false다', handle.star(EVENTS.STAR_REQUESTED, star('s-gone')) === false)

bridge = startBridge()
// 다시 붙기까지 기다린다 (0.9 → 1.8 → 3.6초)
for (let i = 0; i < 60 && links[links.length - 1] !== 'open'; i += 1) await wait(150)

ok('**스스로 다시 붙는다**', links[links.length - 1] === 'open', `(${links.slice(-4).join(' → ')})`)
ok('다시 붙을 때도 한 번 불린다', opened === 2, `(${opened}번)`)
ok('다시 보낼 수 있다', handle.star(EVENTS.STAR_REQUESTED, star('link-002')) === true)

handle.close()
await wait(150)
bridge.kill('SIGTERM')
theWall.socket.close()

console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
