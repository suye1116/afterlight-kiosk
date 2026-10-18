/**
 * Arduino 자리에 서는 대역.
 *
 * **진짜 버튼이 아니다.** 아두이노가 아직 없을 때, 물리 버튼이 눌렸을 때
 * 하늘이 어떻게 움직이는지 보기 위한 것이다.
 *
 *   node server/index.js --sim          ← 다리를 이 길이 열린 채로 띄우고
 *   node server/stand-in/button.js      ← 이것을 띄운 뒤 터미널에서 키를 누른다
 *
 *     s  보내기      n  다음      r  (관리자) 처음으로
 *
 * `--sim`은 기본으로 꺼져 있다. 전시 중에는 켜지 않는다 —
 * 버튼을 만들어 낼 수 있는 길을 열어 둘 이유가 없다.
 */
const flags = { port: 9981, host: '127.0.0.1' }
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i += 1) {
  if (argv[i] === '--port' || argv[i] === '-p') flags.port = Number(argv[++i])
  else if (argv[i] === '--host') flags.host = String(argv[++i])
}

const KEYS = { s: 'send', n: 'next', r: 'reset' }
const url = `ws://${flags.host}:${flags.port}/sim`
const socket = new WebSocket(url)

socket.addEventListener('open', () => {
  console.log(`\n  버튼 대역이 붙었습니다 — ${url}`)
  console.log('  s 보내기 · n 다음 · r 처음으로 · Ctrl+C 끝내기\n')
})

socket.addEventListener('close', () => {
  console.log('\n  다리가 끊겼습니다. 다리를 --sim으로 띄웠는지 확인하세요.\n')
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
  if (key === QUIT) process.exit(0)
  const button = KEYS[key.toLowerCase()]
  if (!button) return
  socket.send(
    JSON.stringify({
      v: 1,
      id: crypto.randomUUID(),
      event: 'button.pressed',
      at: Date.now(),
      // 점검용임을 숨기지 않는다
      origin: 'stage',
      button,
      down: true,
    }),
  )
  console.log(`  ⏵ ${button}`)
})
