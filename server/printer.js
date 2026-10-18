import { appendFile } from 'node:fs/promises'
import net from 'node:net'

/**
 * 영수증.
 *
 * ─── 아직 종이가 아니다 ────────────────────────────────
 *  **실제 프린터는 연결하지 않았다.** 기본은 `file` — 출력될 내용을
 *  파일에 그대로 쌓는다. 전시 전에 종이에 무엇이 찍힐지 눈으로 보고,
 *  문구와 줄바꿈을 거기서 확정하기 위해서다.
 *
 *  프린터가 오면 `--printer tcp --printer-host 192.168.0.50`으로 바꾼다.
 *  감열 프린터 대부분이 9100 포트로 ESC/POS 바이트를 받는다 — 그 길은
 *  Node의 `net`만으로 되므로 **패키지가 필요 없다.**
 *  USB로만 붙는 모델이라면 그때 `npm i escpos` 같은 것이 필요해진다.
 * ───────────────────────────────────────────────────────
 *
 * 그리고 **프린터가 죽어도 별은 간다.** 출력 실패가 전송을 막지 않는다.
 */

/** 58mm 감열지 한 줄에 들어가는 글자 수 (한글은 두 칸을 먹는다) */
const WIDTH = 32

const ESC = '\x1b'
const GS = '\x1d'

/** 한글의 너비를 두 칸으로 세어 가운데 맞춤 */
function widthOf(line) {
  let n = 0
  for (const ch of line) n += ch.charCodeAt(0) > 0x2000 ? 2 : 1
  return n
}

function center(line) {
  const pad = Math.max(0, Math.floor((WIDTH - widthOf(line)) / 2))
  return ' '.repeat(pad) + line
}

function row(label, value) {
  const gap = Math.max(1, WIDTH - widthOf(label) - widthOf(value))
  return label + ' '.repeat(gap) + value
}

const RULE = '-'.repeat(WIDTH)

/**
 * 종이에 찍히는 글.
 *
 * **기록 원문은 들어 있지 않다.** `receipt.text`는 사람이 `--receipt-text`로
 * 켰을 때만 들어오고, 그때만 적힌다.
 */
export function render(receipt) {
  const date = new Date(receipt.at)
  const stamp = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate(),
  ).padStart(2, '0')}`

  const lines = [
    '',
    center('A F T E R L I G H T'),
    center('아직 도착 중인 시간'),
    '',
    RULE,
    row(`No. ${String(receipt.seq).padStart(4, '0')}`, stamp),
    RULE,
    '',
  ]

  if (receipt.when) lines.push(row('그 시간', receipt.when))
  if (receipt.emotion) lines.push(row('감정', receipt.emotion))
  if (receipt.how) lines.push(row('어떻게', receipt.how))

  if (receipt.text) {
    lines.push('', center(`"${receipt.text}"`))
  }

  lines.push('', RULE, '')

  if (receipt.company > 0 && receipt.emotion) {
    lines.push(
      center('당신의 빛은 우리의 우주에서'),
      center(`같은 ${receipt.emotion}의 빛 ${receipt.company}개와`),
      center('함께 머물고 있습니다.'),
      '',
    )
  }

  lines.push(
    center('시간은 사라지는 것이 아니라,'),
    center('계속해서 우리에게'),
    center('도착하고 있는 것입니다.'),
    '',
    RULE,
    '',
    '',
    '',
  )

  return lines.join('\n')
}

/** ESC/POS로 감싼다. 자르기까지. */
function toEscPos(body) {
  return Buffer.concat([
    Buffer.from(`${ESC}@`, 'ascii'), // 초기화
    Buffer.from(body, 'utf8'),
    Buffer.from(`${GS}V\x42\x00`, 'ascii'), // 부분 절단
  ])
}

/**
 * 영수증을 내보낸다.
 *
 *   none  아무것도 하지 않는다 (프린터를 쓰지 않는 자리)
 *   file  파일에 쌓는다 — 기본. 종이에 무엇이 찍힐지 눈으로 본다
 *   tcp   감열 프린터에 ESC/POS 바이트를 보낸다 (9100)
 */
export function createPrinter({ mode = 'file', path = 'receipts.txt', host = '', port = 9100 }) {
  return {
    mode,
    describe() {
      if (mode === 'none') return '쓰지 않음'
      if (mode === 'file') return `파일 (${path})`
      return `tcp ${host}:${port} — **실제 연결은 확인되지 않았다**`
    },

    async print(receipt) {
      const body = render(receipt)

      if (mode === 'none') return { ok: true, note: '프린터를 쓰지 않습니다' }

      if (mode === 'file') {
        const block = `\n===== ${new Date(receipt.at).toISOString()} =====\n${body}\n`
        await appendFile(path, block, 'utf8')
        return { ok: true, note: path }
      }

      if (!host) return { ok: false, note: '프린터 주소가 없습니다' }

      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port }, () => {
          socket.end(toEscPos(body))
        })
        socket.setTimeout(5000)
        socket.on('timeout', () => {
          socket.destroy()
          reject(new Error('프린터가 응답하지 않습니다'))
        })
        socket.on('error', reject)
        socket.on('close', resolve)
      })

      return { ok: true, note: `${host}:${port}` }
    },
  }
}
