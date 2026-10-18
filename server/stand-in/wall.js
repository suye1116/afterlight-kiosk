/**
 * TouchDesigner 자리에 서는 대역.
 *
 * **진짜 벽이 아니다.** TD가 아직 없을 때 다리가 제대로 말을 건네는지
 * 보기 위한 것이고, TD를 붙인 뒤에도 "다리가 문제인가 TD가 문제인가"를
 * 가르는 데 쓴다.
 *
 *   node server/stand-in/wall.js
 *   node server/stand-in/wall.js --port 9981 --wall north --slow
 *
 * `--slow`를 켜면 받은 뒤 0.4초 있다가 '띄웠다'고 알린다 —
 * **받은 것과 띄운 것이 다른 일**임을 눈으로 보기 위해서다.
 */
const flags = { port: 9981, host: '127.0.0.1', wall: 'north', slow: false, quiet: false }
const argv = process.argv.slice(2)
for (let i = 0; i < argv.length; i += 1) {
  const flag = argv[i]
  if (flag === '--port' || flag === '-p') flags.port = Number(argv[++i])
  else if (flag === '--host') flags.host = String(argv[++i])
  else if (flag === '--wall') flags.wall = String(argv[++i])
  else if (flag === '--slow') flags.slow = true
  else if (flag === '--quiet' || flag === '-q') flags.quiet = true
}

const url = `ws://${flags.host}:${flags.port}/td`
const log = (...parts) => {
  if (!flags.quiet) console.log(...parts)
}

let wait = 900

function connect() {
  const socket = new WebSocket(url)

  socket.addEventListener('open', () => {
    wait = 900
    log(`\n  벽(${flags.wall})이 다리에 붙었습니다 — ${url}\n`)
    // 저는 이 면입니다. 다리는 적어 두기만 한다 (배치는 가정하지 않는다).
    socket.send(JSON.stringify({ command: 'hello', wall: flags.wall }))
    socket.send(JSON.stringify({ command: 'resend' }))
  })

  socket.addEventListener('message', (event) => {
    let signal
    try {
      signal = JSON.parse(String(event.data))
    } catch {
      return
    }

    /*
     * 점검용 신호는 벽에 띄우지 않는다.
     * 전시 중에 점검 신호가 관람자의 빛과 섞여 벽에 뜨면,
     * 그건 그 사람의 시간이 아니다.
     */
    if (signal.origin === 'stage') {
      log(`  (점검 신호 ${signal.event} — 벽에 띄우지 않습니다)`)
      return
    }

    const starId = signal.star?.id

    switch (signal.event) {
      case 'star.requested':
        log(`  ★ 빛 하나가 옵니다 — ${starId} · ${signal.star.constellation}`)
        break
      case 'star.arrived':
        log(`  ✦ 닿았습니다 — ${starId}`)
        break
      case 'constellation.updated':
        log(`  ✧ 별자리 ${signal.constellation.id} — ${signal.constellation.size}개`)
        break
      case 'universe.state':
        log(`  ◌ 우주 — 모두 ${signal.universe.total} (간직 ${signal.universe.keep} · 흘려보냄 ${signal.universe.letgo})`)
        break
      default:
        return
    }

    // 받았다고 알린다 — 다리가 '넘긴 수'와 '받은 수'를 따로 센다
    socket.send(JSON.stringify({ command: 'ack', event: signal.event, starId }))

    // 그리고 실제로 화면에 띄운 뒤에 한 번 더 알린다. 이 둘은 다른 일이다.
    if (starId) {
      const show = () => socket.send(JSON.stringify({ command: 'shown', starId }))
      if (flags.slow) setTimeout(show, 400)
      else show()
    }
  })

  socket.addEventListener('close', () => {
    log(`  다리가 끊겼습니다. ${(wait / 1000).toFixed(1)}초 뒤에 다시 붙습니다.`)
    setTimeout(connect, wait)
    wait = Math.min(wait * 2, 8000)
  })

  socket.addEventListener('error', () => {
    /* close가 뒤따라 오므로 여기서는 아무것도 하지 않는다 */
  })
}

connect()
