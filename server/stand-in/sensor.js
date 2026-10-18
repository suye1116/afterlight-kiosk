/**
 * HC-SR04 손 감지 센서 자리에 서는 대역.
 *
 * **진짜 센서가 아니다.** 아두이노가 아직 없을 때, 거리 신호가 하늘까지
 * 제대로 오는지, 그리고 `SceneConfirm`의 손 감지 트리거가 제대로 동작하는지
 * 보기 위한 것이다.
 *
 *   node server/index.js --sim          ← 다리를 이 길이 열린 채로 띄우고
 *   node server/stand-in/sensor.js      ← 이것을 띄운 뒤 터미널에서 키를 누른다
 *
 *     h  손을 가까이 둔다 (가깝다, 계속 보낸다)
 *     l  손을 멀리 둔다   (멀다, 계속 보낸다)
 *     Ctrl+C 끝내기
 *
 * 실제 아두이노처럼 **쉬지 않고** 거리를 보낸다 — 한 번 누르면 그 상태를
 * 유지한 채 150ms마다 계속 보낸다. "가깝다"의 판정과 1초 보유는 다리가
 * 아니라 하늘(`src/lib/sensorGate.ts`)이 하므로, 여기서는 숫자만 보낸다.
 *
 * `--sim`은 기본으로 꺼져 있다. 전시 중에는 켜지 않는다.
 */
const flags = { port: 9981, host: '127.0.0.1' }
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--port' || argv[i] === '-p') flags.port = Number(argv[++i])
  else if (argv[i] === '--host') flags.host = String(argv[++i])
}

/** 가까울 때와 멀 때의 본보기 거리(cm). 실제 HC-SR04의 흔한 범위 안이다. */
const NEAR_CM = 8
const FAR_CM = 60
const INTERVAL_MS = 150

const url = `ws://${flags.host}:${flags.port}/sim`
const socket = new WebSocket(url)

let cm = FAR_CM
let timer = null

function send() {
  if (socket.readyState !== WebSocket.OPEN) return
  socket.send(
    JSON.stringify({
      v: 1,
      id: crypto.randomUUID(),
      event: 'sensor.proximity',
      at: Date.now(),
      origin: 'stage',
      cm,
    }),
  )
}

socket.addEventListener('open', () => {
  console.log(`\n  센서 대역이 붙었습니다 — ${url}`)
  console.log('  h 손을 가까이 · l 손을 멀리 · Ctrl+C 끝내기\n')
  timer = setInterval(send, INTERVAL_MS)
})

socket.addEventListener('close', () => {
  console.log('\n  다리가 끊겼습니다. 다리를 --sim으로 띄웠는지 확인하세요.\n')
  if (timer) clearInterval(timer)
  process.exit(1)
})

socket.addEventListener('error', () => {
  console.log('\n  붙지 못했습니다. 다리를 --sim으로 띄웠는지 확인하세요.\n')
})

/** Ctrl+C */
const QUIT = String.fromCharCode(3)

process.stdin.setRawMode?.(true)
process.stdin.resume()
process.stdin.setEncoding('utf8')
process.stdin.on('data', (key) => {
  if (key === QUIT) {
    if (timer) clearInterval(timer)
    process.exit(0)
  }
  const lower = key.toLowerCase()
  if (lower === 'h') {
    cm = NEAR_CM
    console.log(`  ⏵ 손을 가까이 (${cm}cm)`)
  } else if (lower === 'l') {
    cm = FAR_CM
    console.log(`  ⏵ 손을 멀리 (${cm}cm)`)
  }
})
