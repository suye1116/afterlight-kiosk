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
 * ─── QR코드는 장식이 아니라 실제로 찍어 보낸다 ───────────
 *  두 QR(실제 별 찾기·우리의 우주)은 글자로만 찍지 않는다 — ESC/POS의
 *  표준 QR 인쇄 명령(`GS ( k`, Epson 공식 규격)을 그대로 따라 실제
 *  스캔되는 코드로 찍는다. 이 명령 자체는 공식 문서에 정의된 그대로
 *  구현했지만, **실제 감열 프린터로 찍어서 스캔해 본 적은 없다** —
 *  이 전시에 쓸 모델이 `GS ( k`를 지원하는지는 실제 기기로 반드시
 *  확인해야 한다(값싼 호환 프린터 중에는 이 명령을 통째로 무시하는
 *  것도 있다). 그래서 URL은 QR 아래에 **읽을 수 있는 글자로도** 한
 *  번 더 찍는다 — QR을 못 읽어도 손으로 입력할 수 있게.
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
 * 한 줄 폭(`maxWidth`)을 넘기면 낱말 사이에서 줄을 바꾼다.
 *
 * 질문·답은 길이를 고르지 않으므로(사람이 직접 적거나 고른 글이다)
 * 한 줄로 찍으면 58mm 폭을 넘겨 잘리거나 겹쳐 찍힐 수 있다 — 그래서
 * 여기서만 쓴다(`comfortMessage` 같은 기존 줄은 손대지 않는다).
 * 띄어쓰기가 없는 낱말 하나가 그 자체로 너무 길면(거의 없지만) 글자
 * 단위로도 자른다.
 */
function wrapLines(text, maxWidth = WIDTH) {
  const lines = []
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const last = lines.length > 0 ? lines[lines.length - 1] : null
    const candidate = last ? `${last} ${word}` : word
    if (last !== null && widthOf(candidate) <= maxWidth) {
      lines[lines.length - 1] = candidate
      continue
    }
    if (widthOf(word) <= maxWidth) {
      lines.push(word)
      continue
    }
    // 한 낱말 자체가 너무 길면 글자 단위로 자른다
    let piece = ''
    for (const ch of word) {
      const next = piece + ch
      if (piece && widthOf(next) > maxWidth) {
        lines.push(piece)
        piece = ch
      } else {
        piece = next
      }
    }
    if (piece) lines.push(piece)
  }
  return lines.length > 0 ? lines : ['']
}

/** QR 하나를 가리키는 마디. `lines()`가 이 마디를 만나면 텍스트 쪼기와 실제 인쇄에서 다르게 다룬다. */
function qrMark(url, title) {
  return { qr: url, title }
}

/**
 * 영수증에 들어갈 마디들.
 *
 * 평범한 문자열(한 줄)과, QR 하나를 가리키는 `qrMark(...)`가 섞여
 * 있다 — `render()`는 이걸 읽을 수 있는 글로, `toEscPosBuffer()`는
 * 실제로 스캔되는 바이트로 각각 바꾼다. **두 출력이 같은 자리에서
 * 나오므로, 미리보기(화면)와 종이가 어긋나지 않는다.**
 *
 * **기록 원문은 들어 있지 않다.** `receipt.text`는 사람이 `--receipt-text`로
 * 켰을 때만 들어오고, 그때만 적힌다.
 */
function lines(receipt) {
  const date = new Date(receipt.at)
  const stamp = `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(
    date.getDate(),
  ).padStart(2, '0')}`

  const out = [
    '',
    center('A F T E R L I G H T'),
    center('아직 도착 중인 시간'),
    '',
    RULE,
    row(`No. ${String(receipt.seq).padStart(4, '0')}`, stamp),
    RULE,
    '',
  ]

  if (receipt.when) out.push(row('그 시간', receipt.when))
  if (receipt.emotion) out.push(row('감정', receipt.emotion))
  if (receipt.how) out.push(row('어떻게', receipt.how))

  if (receipt.text) {
    out.push('', center(`"${receipt.text}"`))
  }

  /*
   * 질문에 답하는 방식으로 적었을 때만(`receipt.text`와 같은 자리,
   * 같은 조건 — `--receipt-text`로 켰을 때만 온다). 질문과 답 모두
   * 길이를 고르지 않으므로 `wrapLines`로 줄을 바꿔 찍는다.
   */
  if (receipt.prompt) {
    out.push('', ...wrapLines(receipt.prompt.question).map((line) => center(line)))
    out.push('', ...wrapLines(`"${receipt.prompt.answer}"`).map((line) => center(line)))
  }

  /*
   * 실제 별 배정 결과. `receipt.star`가 없으면(검증된 별이 하나도
   * 없는, 있어서는 안 되는 경우) 이 블록 전체를 찍지 않는다 — 없는
   * 별을 지어내 찍지 않는다. 별 그림은 감열 프린터가 비트맵을 못
   * 받으므로(지금은 텍스트만 보낸다) ASCII 글자 하나(*)로 대신한다.
   */
  if (receipt.star) {
    out.push(
      '',
      RULE,
      '',
      center('*'),
      row('실제 별', `${receipt.star.realName}(${receipt.star.korean})`),
      row('시적인 이름', receipt.star.poeticName),
      row('소속 별자리', receipt.star.constellationKorean),
      '',
      center(receipt.star.comfortMessage),
    )
  }

  out.push('', RULE, '')

  if (receipt.company > 0 && receipt.emotion) {
    out.push(
      center('당신의 빛은 우리의 우주에서'),
      center(`같은 ${receipt.emotion}의 빛 ${receipt.company}개와`),
      center('함께 머물고 있습니다.'),
      '',
    )
  }

  out.push(
    center('시간은 사라지는 것이 아니라,'),
    center('계속해서 우리에게'),
    center('도착하고 있는 것입니다.'),
    '',
    RULE,
  )

  /*
   * 두 QR — 위아래로. 화면(`components/Receipt.tsx`)과 같은 순서
   * (실제 별 찾기 → 우리의 우주)다. "우리의 우주" 주소가 아직 없으면
   * (`constants/deployment.ts`의 `PUBLIC_UNIVERSE_URL`) 그 블록 자체를
   * 만들어 내지 않는다.
   */
  if (receipt.star) {
    out.push('', center('실제 하늘에서 나의 별 찾기'), qrMark(receipt.star.lookupUrl, '실제 별'), center(receipt.star.lookupUrl))
    out.push('', center('(지금 바로 볼 수 있다는 뜻은 아니에요)'))
  }
  if (receipt.universeUrl) {
    out.push('', center('우리의 우주 다시 만나기'), qrMark(receipt.universeUrl, '우리의 우주'), center(receipt.universeUrl))
  }

  out.push('', RULE, '', '', '')
  return out
}

/**
 * 종이에 찍히는 글 — 사람이 읽는 판(파일 모드·미리보기용 텍스트).
 *
 * QR 마디는 실제 코드를 그릴 수 없으니, 이 글에서는 "[QR코드]"라는
 * 표시로만 남긴다 — 그 아래 적히는 URL 글자가 실제 내용이다.
 */
export function render(receipt) {
  return lines(receipt)
    .map((line) => (typeof line === 'string' ? line : center(`[ QR코드 — ${line.title} ]`)))
    .join('\n')
}

/** ESC/POS 초기화 + 자르기로 감싼다. */
function wrapEscPos(bodyBuffer) {
  return Buffer.concat([
    Buffer.from(`${ESC}@`, 'ascii'), // 초기화
    bodyBuffer,
    Buffer.from(`${GS}V\x42\x00`, 'ascii'), // 부분 절단
  ])
}

/**
 * QR코드 하나를 실제로 찍는 ESC/POS 명령 — `GS ( k`(Epson 공식 규격,
 * 대부분의 호환 감열 프린터가 따른다).
 *
 * 네 단계를 차례로 보낸다: 모델 선택 → 모듈(점) 크기 → 오류 정정
 * 등급 → 데이터 저장 → 인쇄. 길이 필드(pL·pH)는 리틀엔디안 2바이트다.
 *
 * **이 바이트 구성은 공식 문서를 그대로 따랐지만, 실제 하드웨어로
 * 인쇄·스캔해 확인한 적은 없다.** 전시 전에 실제 프린터로 반드시
 * 시험 인쇄를 해 봐야 한다 — §6의 "실제 스캔 테스트 방법" 참고.
 */
function qrCommands(url, { moduleSize = 5, errorCorrection = 'M' } = {}) {
  const EC_LEVEL = { L: 0x30, M: 0x31, Q: 0x32, H: 0x33 }

  const gsk = (payload) => {
    const len = payload.length
    return Buffer.concat([Buffer.from([0x1d, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff]), payload])
  }

  const data = Buffer.from(url, 'utf8')
  return Buffer.concat([
    gsk(Buffer.from([0x31, 0x41, 0x32, 0x00])), // 모델 2 선택
    gsk(Buffer.from([0x31, 0x43, moduleSize])), // 모듈 크기
    gsk(Buffer.from([0x31, 0x45, EC_LEVEL[errorCorrection] ?? EC_LEVEL.M])), // 오류 정정 등급
    gsk(Buffer.concat([Buffer.from([0x31, 0x50, 0x30]), data])), // 데이터 저장
    gsk(Buffer.from([0x31, 0x51, 0x30])), // 저장된 심벌 인쇄
  ])
}

/**
 * 종이에 찍히는 바이트 — 실제 프린터로 보내는 판. QR 마디는 진짜 QR코드로 찍힌다.
 * (시험 코드에서 바이트 안에 QR 명령이 실제로 들어 있는지 확인하려고 export한다.)
 */
export function toEscPosBuffer(receipt) {
  const parts = lines(receipt).map((line) =>
    typeof line === 'string' ? Buffer.from(`${line}\n`, 'utf8') : qrCommands(line.qr),
  )
  return wrapEscPos(Buffer.concat(parts))
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
      if (mode === 'none') return { ok: true, note: '프린터를 쓰지 않습니다' }

      if (mode === 'file') {
        const block = `\n===== ${new Date(receipt.at).toISOString()} =====\n${render(receipt)}\n`
        await appendFile(path, block, 'utf8')
        return { ok: true, note: path }
      }

      if (!host) return { ok: false, note: '프린터 주소가 없습니다' }

      await new Promise((resolve, reject) => {
        const socket = net.createConnection({ host, port }, () => {
          socket.end(toEscPosBuffer(receipt))
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
