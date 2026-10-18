import { createServer } from 'node:http'
import { networkInterfaces } from 'node:os'
import { accept, createReader, encodeClose, encodePing, encodeText } from './lib/ws.js'
import {
  BRIDGE_STATUS,
  EVENTS,
  LED_SET,
  RECEIPT_RESULT,
  SENSOR_PROXIMITY,
  STAR_SHOWN,
  createSeen,
  envelope,
  readEnvelope,
} from './protocol.js'
import { sanitize, sanitizeReceipt } from './sanitize.js'
import { createHub } from './hub.js'
import { createPrinter } from './printer.js'
import { openArduino } from './arduino.js'
import { isPrivateAddressForTest as isPrivateAddress } from './lib/address.js'
import { CONFIG } from './config.js'

/**
 * 하늘과 벽 사이의 다리.
 *
 * ```
 * 브라우저(하늘) ──▶ server/index.js ──▶ TouchDesigner(벽)
 *                ◀──               ◀──
 *                        │
 *                        ├── 아두이노 (시리얼)
 *                        └── 영수증 프린터
 * ```
 *
 * **아무것도 저장하지 않는다.** 관람객의 시간은 브라우저에 있고, 이 서버는
 * 지나가는 말을 한 번 보고 흘려보낼 뿐이다. 서버를 끄면 남는 것이 없다.
 *
 * **패키지를 쓰지 않는다.** `npm install`을 한 번 더 하지 않아도 된다.
 * (아두이노를 실제로 꽂을 때만 `serialport`가 필요해진다.)
 */

/* ── 어떻게 띄울 것인가 ──────────────────────────────── */

/*
 * **기본값 하나도 코드에 고정하지 않는다** — `server/config.local.json`
 * (없으면 `config.example.json`)에서 읽은 값이 여기 적힌 숫자들을 덮는다.
 * 전시장의 MacBook 주소를 바꿀 때 이 파일을 고칠 일이 없게 하기 위해서다.
 * 그 위에 CLI 플래그(`--port` 등)를 주면 플래그가 다시 그걸 덮는다 —
 * 현장에서 한 번만 다르게 띄워야 할 때 파일을 건드리지 않아도 된다.
 */
function readFlags(argv) {
  const flags = {
    port: 9981,
    host: '127.0.0.1',
    lan: false,
    sim: false,
    verbose: false,
    quiet: false,
    arduino: '',
    baud: 115200,
    printer: 'file',
    printerPath: 'receipts.txt',
    printerHost: '',
    printerPort: 9100,
    receiptText: false,
    ...CONFIG.values,
  }

  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i]
    const next = () => argv[++i]
    switch (flag) {
      case '--port': case '-p': flags.port = Number(next()); break
      case '--host': flags.host = String(next()); break
      case '--lan': flags.lan = true; break
      case '--sim': flags.sim = true; break
      case '--verbose': case '-v': flags.verbose = true; break
      case '--quiet': case '-q': flags.quiet = true; break
      case '--arduino': flags.arduino = String(next()); break
      case '--baud': flags.baud = Number(next()); break
      case '--printer': flags.printer = String(next()); break
      case '--printer-path': flags.printerPath = String(next()); break
      case '--printer-host': flags.printerHost = String(next()); break
      case '--printer-port': flags.printerPort = Number(next()); break
      case '--receipt-text': flags.receiptText = true; break
      default: break
    }
  }

  if (flags.lan) flags.host = '0.0.0.0'
  return flags
}

const flags = readFlags(process.argv.slice(2))

/*
 * 바깥 인터넷에 내놓지 않는다.
 *
 * 기본은 이 기계 안(127.0.0.1)이다. `--lan`을 켜야 같은 공유기의 태블릿이
 * 붙을 수 있고, 그때도 **사설 대역에서 오는 연결만 받는다.**
 * 공유기에 포트 포워딩을 걸지 말 것 — 그 순간 전시장의 다리가 인터넷에 열린다.
 */
const log = (...parts) => {
  if (!flags.quiet) console.log(...parts)
}
const chatter = (...parts) => {
  if (flags.verbose) console.log(...parts)
}

/* ── 다리 ────────────────────────────────────────────── */

const hub = createHub()
const seen = createSeen()
const printer = createPrinter({
  mode: flags.printer,
  path: flags.printerPath,
  host: flags.printerHost,
  port: flags.printerPort,
})
hub.devices.printer = flags.printer === 'none' ? 'off' : 'ready'
hub.devices.printerMode = flags.printer
hub.devices.printerNote = printer.describe()

/** 늦게 켠 벽에 건네줄, 마지막으로 들은 우주의 상태 한 장 */
let lastUniverse = null

/**
 * 아두이노에게 말을 거는 손.
 *
 * `server.listen` 콜백 안에서 실제 핸들로 바뀐다. 그전에(또는 아두이노를
 * 쓰지 않을 때) 불려도 조용히 아무 일도 하지 않는다.
 */
let arduinoHandle = { close() {}, send() {} }

function send(client, payload) {
  if (client.socket.destroyed) return
  try {
    client.socket.write(encodeText(JSON.stringify(payload)))
  } catch {
    /* 끊긴 손님에게 쓰다 나는 소리는 무시한다 */
  }
}

/** 몇 명에게 건넸는지 돌려준다 */
function broadcast(role, payload) {
  let reached = 0
  for (const client of hub.clients) {
    if (client.role !== role) continue
    send(client, payload)
    reached += 1
  }
  return reached
}

let statusTimer = null
function announce() {
  const payload = { ...envelope(BRIDGE_STATUS), ...hub.status() }
  broadcast('sky', payload)
}

/* ── 들어온 말을 어디로 보낼 것인가 ──────────────────── */

function relayToWall(message) {
  const clean = sanitize(message)
  if (clean.dropped.length > 0) {
    hub.counts.stripped += clean.dropped.length
    chatter(`  떨어냄: ${clean.dropped.join(', ')}`)
  }
  if (!clean.ok) {
    hub.counts.rejected += 1
    chatter(`  벽으로 넘기지 않음: ${clean.reason}`)
    return null
  }

  /*
   * **넘겼다는 것은 벽이 있었다는 뜻이다.**
   *
   * 벽이 꺼져 있으면 이 수는 늘지 않는다. 늘려 버리면 "넘겼는데 안 받았다"로
   * 읽혀, 벽이 꺼진 것인지 받고도 못 띄운 것인지 가를 수 없게 된다.
   */
  const reached = broadcast('td', clean.message)
  if (reached > 0) hub.counts.relayed += 1
  return { message: clean.message, reached }
}

async function handleReceipt(client, message) {
  const receipt = sanitizeReceipt(message.receipt, { allowText: flags.receiptText })
  if (!receipt) {
    hub.counts.rejected += 1
    send(client, { ...envelope(RECEIPT_RESULT), ok: false, note: '영수증을 알 수 없습니다' })
    return
  }

  /*
   * **별이 닿은 것이 확인된 뒤에만 찍는다.**
   * 보내다 만 빛의 영수증이 먼저 나오면, 손에 쥔 종이와 벽의 하늘이 어긋난다.
   */
  const stage = hub.stageOf(receipt.starId)
  if (!stage || stage.arrived === 0) {
    hub.counts.rejected += 1
    send(client, {
      ...envelope(RECEIPT_RESULT),
      ok: false,
      starId: receipt.starId,
      note: '아직 도착이 확인되지 않았습니다',
    })
    return
  }

  try {
    const result = await printer.print(receipt)
    hub.devices.printer = result.ok ? 'ready' : 'error'
    hub.devices.printerNote = result.note
    send(client, { ...envelope(RECEIPT_RESULT), ok: result.ok, starId: receipt.starId, note: result.note })
    log(`  영수증 No.${String(receipt.seq).padStart(4, '0')} → ${result.note}`)
  } catch (error) {
    /* 프린터가 죽어도 별은 간다. 실패가 전송을 막지 않는다. */
    hub.devices.printer = 'error'
    hub.devices.printerNote = error.message
    send(client, { ...envelope(RECEIPT_RESULT), ok: false, starId: receipt.starId, note: error.message })
    log(`  영수증 실패: ${error.message}`)
  }
  announce()
}

async function handleEvent(client, message) {
  // 같은 마디를 두 번 처리하지 않는다. 벽에 같은 별이 둘 뜨는 일을 막는다.
  if (!seen.first(message.id)) {
    hub.counts.duplicate += 1
    chatter(`  이미 본 마디 ${message.id}`)
    return
  }

  switch (message.event) {
    case EVENTS.STAR_REQUESTED: {
      const starId = message.star?.id
      // 같은 별을 두 번 보내도 한 번만 받는다 (이벤트 id가 달라도)
      const already = hub.stageOf(starId)
      if (already && already.accepted !== 0) {
        hub.counts.duplicate += 1
        send(client, { ...envelope(EVENTS.STAR_ACCEPTED), starId, already: true })
        return
      }

      hub.mark(starId, 'requested')
      const relayed = relayToWall(message)
      if (!relayed) {
        send(client, { ...envelope(EVENTS.STAR_ACCEPTED), starId, ok: false })
        return
      }
      /*
       * **받아들인 것과 넘긴 것은 다른 일이다.**
       * 벽이 꺼져 있어도 다리는 받아들인다 — 하늘은 멈추면 안 되기 때문이다.
       */
      hub.counts.accepted += 1
      hub.mark(starId, 'accepted')
      if (relayed.reached > 0) hub.mark(starId, 'relayed')
      // **받아들였다는 말이지, 벽에 떴다는 말이 아니다.**
      send(client, { ...envelope(EVENTS.STAR_ACCEPTED), starId, ok: true })
      log(`  ★ 보냄 ${starId} (${message.star.constellation})`)
      announce()
      break
    }

    case EVENTS.STAR_ARRIVED: {
      const starId = message.star?.id
      hub.mark(starId, 'arrived')
      relayToWall(message)
      log(`  ✦ 닿음 ${starId}`)
      announce()
      break
    }

    case EVENTS.CONSTELLATION_UPDATED:
      relayToWall(message)
      break

    case EVENTS.UNIVERSE_STATE: {
      /*
       * 늦게 켠 벽에 건네줄 한 장.
       *
       * 벽이 없어도 들고 있는다 — '지금 하늘이 이렇다'는 사실은
       * 언제 읽어도 지금의 것이기 때문이다. (지나간 별은 쌓아 두지 않는다.)
       */
      const sanitized = sanitize(message)
      if (sanitized.ok) {
        lastUniverse = sanitized.message
        const reached = broadcast('td', sanitized.message)
        if (reached > 0) hub.counts.relayed += 1
      } else {
        hub.counts.rejected += 1
      }
      break
    }

    case EVENTS.RECEIPT_REQUESTED:
      await handleReceipt(client, message)
      break

    case LED_SET: {
      /*
       * 하늘 → 다리 → 아두이노(시리얼). 벽으로는 가지 않는다 —
       * LED는 전시장의 물건이지 네 면의 투사가 아니다.
       */
      if (client.role !== 'sky') {
        hub.counts.rejected += 1
        return
      }
      const { step } = message
      const ok = step === 'off' || (Number.isInteger(step) && step >= 0 && step <= 5)
      if (!ok) {
        hub.counts.rejected += 1
        return
      }
      arduinoHandle.send(step)
      break
    }

    case EVENTS.BUTTON_PRESSED: {
      // 대역(--sim)에서만 올 수 있다. 하늘이 버튼을 만들어 낼 일은 없다.
      if (client.role !== 'sim') {
        hub.counts.rejected += 1
        return
      }
      broadcast('sky', message)
      log(`  ⏵ 버튼 ${message.button}`)
      break
    }

    case SENSOR_PROXIMITY: {
      /*
       * 대역(--sim)에서만 올 수 있다 — `server/stand-in/sensor.js`.
       * 진짜 거리는 아두이노에서 온다(`onDistance`, 클라이언트가 아니라
       * 시리얼로). 둘 다 같은 모양으로 하늘에 흘러간다.
       */
      if (client.role !== 'sim') {
        hub.counts.rejected += 1
        return
      }
      if (!Number.isFinite(message.cm)) {
        hub.counts.rejected += 1
        return
      }
      broadcast('sky', { ...envelope(SENSOR_PROXIMITY), cm: message.cm })
      break
    }

    default:
      hub.counts.rejected += 1
      break
  }
}

function handleCommand(client, command) {
  switch (command.command) {
    case 'hello': {
      client.wall = typeof command.wall === 'string' ? command.wall.slice(0, 32) : ''
      log(`  벽이 이름을 알려 왔습니다: ${client.wall || '(이름 없음)'}`)
      announce()
      break
    }
    case 'ack': {
      hub.counts.received += 1
      if (typeof command.starId === 'string') hub.mark(command.starId, 'received')
      break
    }
    case 'shown': {
      // **받은 것과 띄운 것은 다른 일이다.**
      hub.counts.shown += 1
      if (typeof command.starId === 'string') {
        hub.mark(command.starId, 'shown')
        /*
         * 집계 수치만으로는 "내가 보낸 그 별"이 띄워졌는지 하늘이 알 수 없다.
         * 손 감지 전송의 완료 조건이 바로 이것이므로 별 단위로도 알린다.
         */
        broadcast('sky', { ...envelope(STAR_SHOWN), starId: command.starId })
      }
      announce()
      break
    }
    case 'resend': {
      if (lastUniverse) send(client, lastUniverse)
      break
    }
    default:
      break
  }
}

/* ── 연결 ────────────────────────────────────────────── */

const ROLES = { '/': 'sky', '/sky': 'sky', '/td': 'td', '/sim': 'sim' }

const server = createServer((request, response) => {
  // 이 서버는 웹사이트를 내주지 않는다. WebSocket만 받는다.
  response.writeHead(426, { 'content-type': 'text/plain; charset=utf-8' })
  response.end('AFTERLIGHT bridge — WebSocket으로만 붙을 수 있습니다\n')
})

server.on('upgrade', (request, socket) => {
  const address = socket.remoteAddress
  if (!isPrivateAddress(address)) {
    log(`  거절: 바깥에서 온 연결 (${address})`)
    socket.destroy()
    return
  }

  const path = (request.url ?? '/').split('?')[0]
  const role = ROLES[path]
  if (!role || (role === 'sim' && !flags.sim)) {
    socket.destroy()
    return
  }

  const key = accept(request)
  if (!key) {
    socket.destroy()
    return
  }

  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${key}\r\n\r\n`,
  )
  socket.setNoDelay(true)

  const client = { socket, role, wall: '' }
  hub.add(client)
  log(`+ ${role} 붙음 (${address})`)

  const close = (code, reason) => {
    if (socket.destroyed) return
    try {
      socket.write(encodeClose(code, reason))
    } catch {
      /* 이미 끊겼다 */
    }
    socket.destroy()
  }

  const read = createReader({
    onText: (text) => {
      const parsed = readEnvelope(text)
      if (!parsed.ok) {
        hub.counts.rejected += 1
        chatter(`  받지 않음: ${parsed.reason}`)
        return
      }
      if (parsed.command) {
        if (client.role !== 'td') return
        handleCommand(client, parsed.command)
        return
      }
      void handleEvent(client, parsed.message)
    },
    onPing: () => {
      try {
        socket.write(encodePing())
      } catch {
        /* 끊겼다 */
      }
    },
    onClose: () => close(1000, ''),
    onError: (reason) => {
      chatter(`  끊음: ${reason}`)
      close(1002, '')
    },
  })

  socket.on('data', (chunk) => {
    try {
      read(chunk)
    } catch {
      close(1011, '')
    }
  })

  const bye = () => {
    hub.remove(client)
    log(`- ${role} 떨어짐`)
    announce()
  }
  socket.on('close', bye)
  socket.on('error', bye)

  // 하늘에는 붙자마자 지금 상태를 한 번 알린다
  if (role === 'sky') send(client, { ...envelope(BRIDGE_STATUS), ...hub.status() })
  // 늦게 켠 벽에는 마지막 우주 한 장을 건넨다
  if (role === 'td' && lastUniverse) send(client, lastUniverse)
  announce()
})

/* ── 띄운다 ──────────────────────────────────────────── */

function addresses() {
  const found = []
  for (const list of Object.values(networkInterfaces())) {
    for (const entry of list ?? []) {
      if (entry.family === 'IPv4' && !entry.internal) found.push(entry.address)
    }
  }
  return found
}

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\n포트 ${flags.port}이 이미 쓰이고 있습니다.`)
    console.error(`다른 번호로 띄우세요:  node server/index.js --port ${flags.port + 1}`)
    console.error('(그리고 브라우저에 알려 주세요: ?bridge=ws://127.0.0.1:' + (flags.port + 1) + ')\n')
    process.exit(1)
  }
  console.error(error)
  process.exit(1)
})

server.listen(flags.port, flags.host, async () => {
  log('')
  log('  AFTERLIGHT — 하늘과 벽 사이의 다리')
  log('')
  log(`  설정 파일 ${CONFIG.source}${CONFIG.source.endsWith('config.example.json') ? ' (복사해 config.local.json을 만드세요)' : ''}`)
  log(`  하늘(브라우저)   ws://${flags.lan ? addresses()[0] ?? '127.0.0.1' : '127.0.0.1'}:${flags.port}/sky`)
  log(`  벽(TouchDesigner) ws://${flags.lan ? addresses()[0] ?? '127.0.0.1' : '127.0.0.1'}:${flags.port}/td`)
  if (flags.sim) log(`  대역(--sim)       ws://127.0.0.1:${flags.port}/sim`)
  log('')
  log(`  프린터   ${printer.describe()}`)
  log(`  아두이노 ${flags.arduino || '쓰지 않음'}`)
  log(`  영수증에 기록 원문 ${flags.receiptText ? '**적습니다** (--receipt-text)' : '적지 않습니다'}`)
  log('')
  if (flags.lan) {
    log('  --lan: 같은 공유기 안에서만 붙을 수 있습니다. 사설 대역이 아닌 곳에서 오는')
    log('         연결은 거절합니다. 공유기에 포트 포워딩을 걸지 마세요.')
  } else {
    log('  이 기계 안에서만 붙을 수 있습니다. 태블릿에서 쓰려면 --lan')
  }
  log('')

  const arduino = await openArduino({
    path: flags.arduino,
    baud: flags.baud,
    onButton: ({ button, down }) => {
      broadcast('sky', { ...envelope(EVENTS.BUTTON_PRESSED), button, down })
      log(`  ⏵ 버튼 ${button}`)
    },
    onDistance: ({ cm }) => {
      // "가깝다"의 판정은 여기서 하지 않는다. 값 그대로 하늘에만 흘려보낸다.
      broadcast('sky', { ...envelope(SENSOR_PROXIMITY), cm })
      chatter(`  ◦ 거리 ${cm}cm`)
    },
    onStatus: (state, note) => {
      hub.devices.arduino = state
      hub.devices.arduinoNote = note
      log(`  아두이노: ${state} ${note}`)
      announce()
    },
  })
  arduinoHandle = arduino

  statusTimer = setInterval(announce, 2000)

  const stop = () => {
    clearInterval(statusTimer)
    arduino.close()
    for (const client of hub.clients) client.socket.destroy()
    server.close(() => process.exit(0))
    setTimeout(() => process.exit(0), 300)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
})
