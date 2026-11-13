import { spawn } from 'node:child_process'
import { readFile, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import os from 'node:os'
import { isPrivateAddressForTest } from './lib/address.js'
import { readLine, createDebounce } from './arduino.js'
import { render, toEscPosBuffer } from './printer.js'
import { sanitize, sanitizeReceipt } from './sanitize.js'
import {
  createSeen,
  envelope,
  readEnvelope,
  EVENTS,
  LED_SET,
  SENSOR_PROXIMITY,
  STAR_SHOWN,
} from './protocol.js'

/**
 * 다리를 처음부터 끝까지 시험한다.
 *
 * **장비 없이** 돈다 — TouchDesigner 자리에도, 아두이노 자리에도 대역이 선다.
 * 진짜 서버를 띄우고, 진짜 WebSocket으로 붙어서, 진짜 말을 주고받는다.
 *
 *   npm run bridge:test
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PORT = 19981
const RECEIPTS = path.join(os.tmpdir(), `afterlight-receipts-${process.pid}.txt`)

let pass = 0
let fail = 0
function ok(name, condition, extra = '') {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`) }
  else { fail += 1; console.log(`  ✗ ${name} ${extra}`) }
}
function section(name) { console.log(`\n${name}`) }

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 방금의 연결 상태를 받아 온다.
 *
 * 다리는 2초마다 상태를 알린다. 그 사이에 센 것을 보려면
 * **새로 오는 한 장**을 기다려야 한다 — 손에 든 것은 이미 지난 것이다.
 */
async function freshStatus(client, ms = 4000) {
  const had = client.count('bridge.status')
  const until = Date.now() + ms
  for (;;) {
    if (client.count('bridge.status') > had) return client.last('bridge.status')
    if (Date.now() > until) return client.last('bridge.status')
    await wait(50)
  }
}

/**
 * 손님 하나. 받은 말을 모아 둔다.
 *
 * 벽으로 붙는 손님은 진짜 벽처럼 **받았다(ack)**와 **띄웠다(shown)**를
 * 따로 알린다. 그래야 다리가 둘을 따로 세는지 확인할 수 있다.
 */
function connect(pathName, { ack = true } = {}) {
  const socket = new WebSocket(`ws://127.0.0.1:${PORT}${pathName}`)
  const inbox = []
  socket.addEventListener('message', (event) => {
    let message
    try {
      message = JSON.parse(String(event.data))
    } catch {
      inbox.push({ broken: String(event.data) })
      return
    }
    inbox.push(message)

    if (pathName === '/td' && ack && typeof message.event === 'string') {
      const starId = message.star?.id
      socket.send(JSON.stringify({ command: 'ack', event: message.event, starId }))
      if (starId) socket.send(JSON.stringify({ command: 'shown', starId }))
    }
  })
  const ready = new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve)
    socket.addEventListener('error', reject)
  })
  return {
    socket,
    inbox,
    ready,
    send: (payload) => socket.send(JSON.stringify(payload)),
    /** 이 이벤트가 올 때까지 기다린다 */
    async expect(event, ms = 1500) {
      const until = Date.now() + ms
      for (;;) {
        const found = inbox.find((one) => one.event === event)
        if (found) return found
        if (Date.now() > until) return null
        await wait(20)
      }
    },
    last(event) {
      return [...inbox].reverse().find((one) => one.event === event) ?? null
    },
    count(event) {
      return inbox.filter((one) => one.event === event).length
    },
  }
}

function star(id, constellation = 'con-sad') {
  return {
    id,
    emotion: 'sad',
    type: 'keep',
    constellation,
    x: 0.5,
    y: 0.5,
    brightness: 0.8,
    seed: 12345,
    createdAt: Date.now(),
  }
}

/* ── 장비 없이 셀 수 있는 것부터 ─────────────────────── */

section('걸러내는 자리')
{
  const dirty = {
    ...envelope(EVENTS.STAR_REQUESTED),
    star: { ...star('s-dirty'), text: '아무도 보면 안 되는 한 문장', sessionId: 'abc' },
    text: '여기에도 적어 본다',
  }
  const clean = sanitize(dirty)
  ok('벽으로 넘기는 모양에 문장이 없다', clean.ok && !('text' in clean.message.star))
  ok('누가 보냈는지도 없다', clean.ok && !('sessionId' in clean.message.star))
  ok('봉투에 붙은 문장도 떨어진다', clean.ok && !('text' in clean.message))
  ok('떨어낸 칸을 세어 둔다', clean.dropped.length >= 2, `(${clean.dropped.join(', ')})`)

  const broken = sanitize({ ...envelope(EVENTS.STAR_REQUESTED), star: { id: 'x' } })
  ok('별을 그릴 만큼 적혀 있지 않으면 넘기지 않는다', !broken.ok)

  const wild = sanitize({
    ...envelope(EVENTS.STAR_REQUESTED),
    star: { ...star('s-wild'), x: 9, y: -4, brightness: Number.NaN },
  })
  ok('화면 밖 좌표는 가장자리로 묶는다', wild.ok && wild.message.star.x === 1 && wild.message.star.y === 0)
  ok('NaN은 기본값으로 바뀐다', wild.ok && Number.isFinite(wild.message.star.brightness))
}

section('영수증에 적히는 것')
{
  const receipt = sanitizeReceipt({
    starId: 's-1',
    seq: 7,
    at: Date.now(),
    when: '3년쯤 전',
    emotion: '슬픔',
    how: '간직한 시간',
    company: 12,
    text: '아무도 보면 안 되는 한 문장',
  })
  ok('기본으로는 기록 원문이 영수증에 없다', receipt !== null && receipt.text === undefined)

  const opted = sanitizeReceipt({ starId: 's-1', seq: 7, text: '적어 달라고 켰을 때만' }, { allowText: true })
  ok('--receipt-text를 켰을 때만 들어간다', opted.text === '적어 달라고 켰을 때만')

  const paper = render(receipt)
  ok('종이에 제목이 찍힌다', paper.includes('A F T E R L I G H T'))
  ok('종이에 번호가 찍힌다', paper.includes('No. 0007'))
  ok('종이에 고른 항목이 찍힌다',
    paper.includes('3년쯤 전') && paper.includes('슬픔') && paper.includes('간직한 시간'))
  ok('종이에 기록 원문이 없다', !paper.includes('아무도 보면 안 되는'))
  ok('종이가 원작의 문장으로 맺는다', paper.includes('도착하고 있는 것입니다.'))
}

section('영수증의 실제 별 정보 — 다리를 거쳐도 그대로 간다')
{
  const validStar = {
    realName: 'Betelgeuse',
    korean: '베텔게우스',
    poeticName: '흔들리는 어깨의 별',
    constellationKorean: '오리온자리',
    comfortMessage: '당신이 간직한 그 마음처럼, 이 별도 흔들리면서도 꺼지지는 않았어요.',
    lookupUrl: 'https://en.wikipedia.org/wiki/Alpha_Orionis',
  }

  const withStar = sanitizeReceipt({
    starId: 's-1',
    seq: 1,
    when: '3년쯤 전',
    emotion: '슬픔',
    how: '흘려보낸 시간',
    company: 1,
    star: validStar,
    universeUrl: 'https://example.com/universe',
  })
  ok('실제 별 정보가 그대로 통과한다', withStar !== null && withStar.star?.realName === 'Betelgeuse')
  ok('"우리의 우주" 주소도 그대로 통과한다', withStar?.universeUrl === 'https://example.com/universe')

  const paperWithStar = render(withStar)
  ok('종이에 실제 별 이름이 찍힌다', paperWithStar.includes('Betelgeuse'))
  ok('종이에 소속 별자리가 찍힌다', paperWithStar.includes('오리온자리'))
  ok('종이에 위로 메시지가 찍힌다', paperWithStar.includes(validStar.comfortMessage))
  ok('종이에 별 찾아보는 주소가 찍힌다', paperWithStar.includes(validStar.lookupUrl))
  ok('종이에 "우리의 우주" 주소가 찍힌다', paperWithStar.includes('https://example.com/universe'))

  // 허용 목록을 벗어나면(https가 아닌 주소, 빠진 칸) 조용히 떨어진다
  const brokenUrl = sanitizeReceipt({
    starId: 's-2',
    star: { ...validStar, lookupUrl: 'javascript:alert(1)' },
  })
  ok('https가 아닌 주소는 떨어진다(별 정보 전체가 통째로 빠진다)', brokenUrl.star === undefined)

  const missingField = sanitizeReceipt({
    starId: 's-3',
    star: { ...validStar, comfortMessage: '' },
  })
  ok('한 칸이라도 비어 있으면 별 정보 전체를 찍지 않는다', missingField.star === undefined)

  const noUniverseUrl = sanitizeReceipt({ starId: 's-4' })
  ok('"우리의 우주" 주소가 없으면(아직 배포 전) 그 칸을 만들어 내지 않는다', noUniverseUrl.universeUrl === undefined)

  const paperWithoutStar = render(noUniverseUrl)
  ok('별 정보가 없으면 그 블록 전체를 찍지 않는다', !paperWithoutStar.includes('실제 별'))
}

section('영수증의 질문·답 — 원문과 같은 허용 목록·같은 정책을 따른다')
{
  const longQuestion = '다시 돌아갈 수 있다면 어떤 하루로 돌아가고 싶나요?'
  const longAnswer = '초등학교 졸업식 날 다 같이 운동장에서 사진을 찍고 떡볶이를 먹으러 갔던 그 하루요'

  const withoutAllow = sanitizeReceipt({
    starId: 's-8',
    prompt: { question: longQuestion, answer: longAnswer },
  })
  ok('--receipt-text를 켜지 않으면 질문도 답도 통과하지 않는다(기록 원문과 같은 정책)',
    withoutAllow.prompt === undefined)

  const withPrompt = sanitizeReceipt(
    { starId: 's-9', prompt: { question: longQuestion, answer: longAnswer } },
    { allowText: true },
  )
  ok('--receipt-text를 켜면 질문과 답이 함께 통과한다',
    withPrompt.prompt?.question === longQuestion && withPrompt.prompt?.answer === longAnswer)

  const missingAnswer = sanitizeReceipt(
    { starId: 's-10', prompt: { question: longQuestion, answer: '' } },
    { allowText: true },
  )
  ok('질문과 답 중 하나라도 비어 있으면 통째로 떨어진다(반쪽짜리를 찍지 않는다)',
    missingAnswer.prompt === undefined)

  const paper = render(withPrompt)
  const answerWords = longAnswer.split(' ')
  ok('종이에 질문의 낱말이 찍힌다', longQuestion.split(' ').every((word) => paper.includes(word)))
  ok('종이에 답의 낱말이 찍힌다', answerWords.every((word) => paper.includes(word)))

  const linesWithAnswerWords = paper.split('\n').filter((line) =>
    answerWords.some((word) => line.includes(word)))
  ok('58mm 폭을 넘는 긴 답은 한 줄에 다 넣지 않고 여러 줄로 줄바꿈한다',
    linesWithAnswerWords.length >= 2, `(${linesWithAnswerWords.length}줄)`)

  const bytesText = toEscPosBuffer(withPrompt).toString('utf8')
  ok('프린터로 가는 바이트에도 질문의 낱말이 포함된다(미리보기와 어긋나지 않는다)',
    longQuestion.split(' ').every((word) => bytesText.includes(word)))
  ok('프린터로 가는 바이트에도 답의 낱말이 포함된다',
    answerWords.every((word) => bytesText.includes(word)))

  const freeformOnly = render(sanitizeReceipt({ starId: 's-11', text: '직접 적은 문장' }, { allowText: true }))
  ok('직접 작성 방식은 그대로다(기존과 같다)', freeformOnly.includes('직접 적은 문장'))
}

section('다리의 마지막 방어선 — 브라우저 검사만 믿지 않는다')
{
  // 브라우저가 우회됐다고 가정하고, --receipt-text를 켠 상태로 다리에 직접 들이민다.
  const withSlur = sanitizeReceipt(
    { starId: 's-12', text: '진짜 개새끼 같은 하루였다' },
    { allowText: true },
  )
  ok('욕설이 섞인 원문은 종이로 가지 않는다', withSlur.text === undefined)

  const withPhone = sanitizeReceipt(
    { starId: 's-13', text: '연락은 010-1234-5678 로 주세요' },
    { allowText: true },
  )
  ok('전화번호처럼 보이는 원문도 종이로 가지 않는다', withPhone.text === undefined)

  const withSpam = sanitizeReceipt(
    { starId: 's-14', text: 'ㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁ' },
    { allowText: true },
  )
  ok('뜻 없는 반복도 종이로 가지 않는다', withSpam.text === undefined)

  const sadButFine = sanitizeReceipt(
    { starId: 's-15', text: '너무 슬프고 후회되는 하루였어요. 눈물이 멈추지 않았다.' },
    { allowText: true },
  )
  ok('슬픔·후회를 적은 원문은 그대로 종이로 간다(막지 않는다)', sadButFine.text?.length > 0)

  const laughterFine = sanitizeReceipt(
    { starId: 's-16', text: 'ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ 그때 진짜 웃겼다' },
    { allowText: true },
  )
  ok('자연스러운 한국어 반복(ㅋㅋㅋ)은 막지 않는다', laughterFine.text?.length > 0)

  const badAnswer = sanitizeReceipt(
    { starId: 's-17', prompt: { question: '다시 돌아갈 수 있다면?', answer: '씨발 다 망쳤어' } },
    { allowText: true },
  )
  ok('질문 방식의 답에 욕설이 있으면 질문·답 통째로 찍지 않는다', badAnswer.prompt === undefined)

  // §1 — 띄어쓰기·특수문자·숫자로 떼어 적는 흔한 회피도 다리에서 한 번 더 잡는다.
  const spaced = sanitizeReceipt({ starId: 's-18', text: '진짜 씨 발 같은 하루였다' }, { allowText: true })
  ok('띄어쓰기로 떼어 적은 욕설도 종이로 가지 않는다', spaced.text === undefined)

  const symboled = sanitizeReceipt({ starId: 's-19', text: '진짜 씨.발.같은 하루였다' }, { allowText: true })
  ok('특수문자를 끼워 넣은 욕설도 종이로 가지 않는다', symboled.text === undefined)

  // §1 — "병 신발"처럼 멀쩡한 두 낱말이 띄어쓰기만 없어지면 겹치는 오탐은 피한다.
  const notAFalsePositive = sanitizeReceipt(
    { starId: 's-20', text: '겨울이라 병 신발을 샀다' },
    { allowText: true },
  )
  ok('"병 신발"(병+신발) 같은 멀쩡한 문장은 종이에 그대로 간다', notAFalsePositive.text?.length > 0)
}

section('실제 프린터로 가는 바이트 — QR코드가 장식이 아니라 명령으로 들어 있다')
{
  const GSK = Buffer.from([0x1d, 0x28, 0x6b])

  function countGsk(buffer) {
    let count = 0
    let from = 0
    for (;;) {
      const at = buffer.indexOf(GSK, from)
      if (at === -1) break
      count += 1
      from = at + GSK.length
    }
    return count
  }

  const validStar = {
    realName: 'Betelgeuse',
    korean: '베텔게우스',
    poeticName: '흔들리는 어깨의 별',
    constellationKorean: '오리온자리',
    comfortMessage: '당신이 간직한 그 마음처럼, 이 별도 흔들리면서도 꺼지지는 않았어요.',
    lookupUrl: 'https://en.wikipedia.org/wiki/Alpha_Orionis',
  }

  const both = sanitizeReceipt({
    starId: 's-5',
    seq: 5,
    star: validStar,
    universeUrl: 'https://example.com/universe',
  })
  const bytesBoth = toEscPosBuffer(both)
  // QR 하나마다 GS(k가 5번(모델·크기·정정등급·데이터저장·인쇄) 나온다
  ok('QR 두 개 몫의 명령이 다 들어 있다', countGsk(bytesBoth) === 10, `(${countGsk(bytesBoth)})`)
  ok('별 찾아보는 주소가 QR 데이터로 들어 있다', bytesBoth.includes(Buffer.from(validStar.lookupUrl, 'utf8')))
  ok('"우리의 우주" 주소도 QR 데이터로 들어 있다', bytesBoth.includes(Buffer.from('https://example.com/universe', 'utf8')))
  ok('그 주소는 읽을 수 있는 글자로도 한 번 더 찍힌다(QR을 못 읽을 때를 위해)',
    bytesBoth.toString('utf8').includes(validStar.lookupUrl))
  ok('초기화 명령으로 시작한다', bytesBoth.subarray(0, 2).equals(Buffer.from('\x1b@', 'ascii')))

  const onlyStar = sanitizeReceipt({ starId: 's-6', star: validStar })
  ok('"우리의 우주" 주소가 없으면 QR이 하나만 찍힌다(명령도 그만큼만)', countGsk(toEscPosBuffer(onlyStar)) === 5)

  const neither = sanitizeReceipt({ starId: 's-7' })
  ok('둘 다 없으면 QR 명령 자체가 없다', countGsk(toEscPosBuffer(neither)) === 0)
}

section('같은 마디를 두 번 처리하지 않는다')
{
  const seen = createSeen(3)
  ok('처음 보는 마디는 받는다', seen.first('a') === true)
  ok('같은 마디는 두 번 받지 않는다', seen.first('a') === false)
  seen.first('b'); seen.first('c'); seen.first('d')
  ok('오래된 것은 잊는다 (메모리가 새지 않게)', seen.size <= 3)
}

section('봉투를 읽는다')
{
  ok('JSON이 아니면 받지 않는다', readEnvelope('{{{').ok === false)
  ok('판이 다르면 받지 않는다', readEnvelope(JSON.stringify({ v: 2, id: 'x', event: 'star.arrived', at: 1 })).ok === false)
  ok('모르는 이벤트는 받지 않는다', readEnvelope(JSON.stringify({ v: 1, id: 'x', event: 'nope', at: 1 })).ok === false)
  ok('이벤트 id가 없으면 받지 않는다', readEnvelope(JSON.stringify({ v: 1, event: 'star.arrived', at: 1 })).ok === false)
  ok('보낸 때가 없으면 받지 않는다', readEnvelope(JSON.stringify({ v: 1, id: 'x', event: 'star.arrived' })).ok === false)
  const good = readEnvelope(JSON.stringify(envelope(EVENTS.STAR_ARRIVED, { star: star('s') })))
  ok('제대로 된 봉투는 받는다', good.ok === true)
  ok('origin이 없으면 live로 읽는다', good.message.origin === 'live')
}

section('바깥에서 오는 연결은 받지 않는다')
{
  ok('이 기계 안', isPrivateAddressForTest('127.0.0.1'))
  ok('같은 공유기 (192.168)', isPrivateAddressForTest('192.168.0.12'))
  ok('같은 공유기 (10.x)', isPrivateAddressForTest('10.0.1.5'))
  ok('같은 공유기 (172.16~31)', isPrivateAddressForTest('172.20.1.1'))
  ok('인터넷 주소는 거절한다', !isPrivateAddressForTest('203.0.113.9'))
  ok('172.32는 사설이 아니다', !isPrivateAddressForTest('172.32.0.1'))
}

section('아두이노가 올려 보내는 한 줄')
{
  ok('한 줄 JSON을 읽는다', readLine('{"btn":"send","v":1}')?.button === 'send')
  ok('뗀 것도 읽는다', readLine('{"btn":"send","v":0}')?.down === false)
  ok('부팅 메시지는 버린다', readLine('Arduino ready') === null)
  ok('빈 줄은 버린다', readLine('   ') === null)
  ok('깨진 JSON은 버린다', readLine('{"btn":') === null)

  const allow = createDebounce(80)
  ok('첫 입력은 받는다', allow('send', 1000) === true)
  ok('너무 빠른 되풀이는 한 번으로 본다', allow('send', 1030) === false)
  ok('시간이 지나면 다시 받는다', allow('send', 1200) === true)
}

/* ── 진짜 다리를 띄운다 ──────────────────────────────── */

section('다리를 띄운다')

const bridge = spawn(
  process.execPath,
  [
    path.join(HERE, 'index.js'),
    '--port', String(PORT),
    '--sim',
    '--quiet',
    '--printer', 'file',
    '--printer-path', RECEIPTS,
    // 이 기계의 server/config.local.json이 실제 전시 때 쓴 아두이노 포트를
    // 담고 있을 수 있다 — 그 값이 새어 들어오면 'off'를 기대하는 아래
    // 검사가 기계마다 다르게(설정에 따라) 흔들린다. 시험은 항상 장비
    // 없이 결정적으로 돌아야 하므로 여기서 명시적으로 비워 둔다.
    '--arduino', '',
  ],
  { stdio: ['ignore', 'pipe', 'pipe'] },
)
bridge.stderr.on('data', (chunk) => console.error('  [다리]', String(chunk).trim()))

await wait(400)

const sky = connect('/sky')
const wall = connect('/td')
const sim = connect('/sim')
await Promise.all([sky.ready, wall.ready, sim.ready])
wall.send({ command: 'hello', wall: 'north' })
await wait(120)

ok('하늘이 붙었다', sky.socket.readyState === WebSocket.OPEN)
ok('벽이 붙었다', wall.socket.readyState === WebSocket.OPEN)

ok('다리가 연결 상태를 알려 준다', (await sky.expect('bridge.status')) !== null)
const status0 = await freshStatus(sky)
ok('하늘과 벽을 따로 센다', status0?.sky === 1 && status0?.td === 1, `(sky ${status0?.sky} · td ${status0?.td})`)
ok('벽이 제 이름을 알려 왔다고 적어 둔다', (sky.last('bridge.status')?.walls ?? []).includes('north'))
ok('아두이노는 아직 연결되지 않았다고 말한다', status0?.arduino === 'off')
ok('프린터는 파일로 받고 있다고 말한다', status0?.printer === 'ready')

/* ── 빛 하나를 보낸다 ────────────────────────────────── */

section('빛 하나를 보낸다')

const one = star('s-001')
sky.send({ ...envelope(EVENTS.STAR_REQUESTED), star: { ...one, text: '벽으로 가면 안 되는 문장' } })

const accepted = await sky.expect(EVENTS.STAR_ACCEPTED)
ok('다리가 받았다고 답한다', accepted?.ok === true && accepted.starId === 's-001')

const atWall = await wall.expect(EVENTS.STAR_REQUESTED)
ok('벽에 그 빛이 간다', atWall?.star?.id === 's-001')
ok('**벽으로 간 것에는 문장이 없다**', atWall !== null && !('text' in atWall.star))
ok('벽이 그릴 것은 다 있다',
  atWall !== null && ['id', 'emotion', 'type', 'constellation', 'x', 'y'].every((k) => k in atWall.star))

const afterSend = await freshStatus(sky)
ok('받아들인 수와 넘긴 수를 센다', afterSend?.stars.accepted === 1 && afterSend?.stars.relayed === 1)
ok('벽이 받았다고 한 수를 따로 센다', afterSend?.stars.received >= 1, `(${afterSend?.stars.received})`)
ok('벽이 띄웠다고 한 수를 또 따로 센다', afterSend?.stars.shown >= 1, `(${afterSend?.stars.shown})`)

/* ── 같은 것을 두 번 보낸다 ──────────────────────────── */

section('같은 것을 두 번 보낼 때')

const repeat = envelope(EVENTS.STAR_REQUESTED)
sky.send({ ...repeat, star: star('s-002') })
await wait(150)
sky.send({ ...repeat, star: star('s-002') })
await wait(200)
ok('같은 이벤트 id는 한 번만 처리한다', wall.inbox.filter((m) => m.star?.id === 's-002').length === 1)

sky.send({ ...envelope(EVENTS.STAR_REQUESTED), star: star('s-002') })
await wait(200)
ok('이벤트 id가 달라도 같은 별은 한 번만 받는다',
  wall.inbox.filter((m) => m.event === EVENTS.STAR_REQUESTED && m.star?.id === 's-002').length === 1)
ok('두 번째에는 이미 받았다고 답한다',
  sky.inbox.some((m) => m.event === EVENTS.STAR_ACCEPTED && m.starId === 's-002' && m.already === true))

/* ── 잘못된 말 ───────────────────────────────────────── */

section('잘못된 말')

const wallBefore = wall.inbox.length
sky.socket.send('이건 JSON이 아니다')
sky.send({ v: 9, id: 'x', event: EVENTS.STAR_ARRIVED, at: Date.now(), star: star('s-bad') })
sky.send({ ...envelope(EVENTS.STAR_REQUESTED), star: { id: 'only-id' } })
sky.send({ ...envelope('star.nonsense'), star: star('s-bad2') })
await wait(300)
ok('잘못된 말은 벽으로 가지 않는다', wall.inbox.length === wallBefore,
  `(벽이 ${wall.inbox.length - wallBefore}개 더 받음)`)
ok('거절한 수를 세어 둔다', ((await freshStatus(sky))?.rejected ?? 0) > 0)
ok('하늘은 끊기지 않는다', sky.socket.readyState === WebSocket.OPEN)

/* ── 영수증은 도착한 뒤에만 ──────────────────────────── */

section('영수증은 도착한 뒤에만')

const paper = { starId: 's-003', seq: 3, at: Date.now(), when: '얼마 전', emotion: '슬픔', how: '간직한 시간', company: 4 }
sky.send({ ...envelope(EVENTS.RECEIPT_REQUESTED), receipt: paper })
const tooEarly = await sky.expect('receipt.result')
ok('도착하지 않은 빛의 영수증은 찍지 않는다', tooEarly?.ok === false, `(${tooEarly?.note})`)

sky.send({ ...envelope(EVENTS.STAR_REQUESTED), star: star('s-003') })
await wait(150)
sky.send({ ...envelope(EVENTS.STAR_ARRIVED), star: star('s-003') })
const arrivedAtWall = await wall.expect(EVENTS.STAR_ARRIVED)
ok('닿았다는 말이 벽으로 간다', arrivedAtWall?.star?.id === 's-003')

await wait(150)
sky.send({ ...envelope(EVENTS.RECEIPT_REQUESTED), receipt: { ...paper, text: '종이에 가면 안 되는 문장' } })
await wait(400)
const printed = [...sky.inbox].reverse().find((m) => m.event === 'receipt.result' && m.starId === 's-003')
ok('도착한 뒤에는 찍는다', printed?.ok === true, `(${printed?.note})`)
/*
 * 이 `paper`에는 `star`·`assignment`가 없다(실제 별 배정 결과가 아니다) —
 * 그런 영수증은 QR1 주소를 지어내면 안 된다. `lookupUrl`이 정확히
 * `null`로 와야, 화면이 "아직 모른다"와 "실제 주소가 있다"를 가릴 수 있다.
 */
ok('별 정보가 없는 영수증은 QR1 주소도 null로 알린다(지어내지 않는다)', printed?.lookupUrl === null)

const onPaper = await readFile(RECEIPTS, 'utf8').catch(() => '')
ok('종이에 번호가 찍혔다', onPaper.includes('No. 0003'))
ok('종이에 고른 항목이 찍혔다', onPaper.includes('슬픔') && onPaper.includes('간직한 시간'))
ok('**종이에 기록 원문이 없다**', !onPaper.includes('종이에 가면 안 되는 문장'))

/* ── 별자리와 우주 ───────────────────────────────────── */

section('별자리와 우주')

sky.send({ ...envelope(EVENTS.CONSTELLATION_UPDATED), constellation: { id: 'con-sad', emotion: 'sad', size: 9 } })
const grew = await wall.expect(EVENTS.CONSTELLATION_UPDATED)
ok('별자리가 자랐다는 말이 벽으로 간다', grew?.constellation?.size === 9)

sky.send({
  ...envelope(EVENTS.UNIVERSE_STATE),
  universe: { total: 42, keep: 30, letgo: 12, byConstellation: { 'con-sad': 9, 'con-joy': 7 } },
})
const state = await wall.expect(EVENTS.UNIVERSE_STATE)
ok('우주의 상태가 벽으로 간다', state?.universe?.total === 42)
ok('별자리별 수가 함께 간다', state?.universe?.byConstellation?.['con-sad'] === 9)

const lateWall = connect('/td')
await lateWall.ready
const handed = await lateWall.expect(EVENTS.UNIVERSE_STATE)
ok('늦게 켠 벽에도 지금 우주를 건넨다', handed?.universe?.total === 42)
lateWall.socket.close()

/* ── 버튼 ────────────────────────────────────────────── */

section('아두이노 버튼 (대역)')

sim.send({ ...envelope(EVENTS.BUTTON_PRESSED, {}, 'stage'), button: 'send', down: true })
const pressed = await sky.expect(EVENTS.BUTTON_PRESSED)
ok('버튼 입력이 하늘로 간다', pressed?.button === 'send')
ok('점검용이라고 적혀 있다', pressed?.origin === 'stage')

const wallButtons = wall.count(EVENTS.BUTTON_PRESSED)
ok('버튼 입력은 벽으로 가지 않는다', wallButtons === 0)

/* ── 손 감지 센서 (대역) ─────────────────────────────── */

section('손 감지 센서 (대역)')

sim.send({ ...envelope(SENSOR_PROXIMITY, {}, 'stage'), cm: 12.3 })
const distance = await sky.expect(SENSOR_PROXIMITY)
ok('거리 신호가 하늘로 간다', distance?.cm === 12.3)

const wallDistances = wall.count(SENSOR_PROXIMITY)
ok('거리 신호는 벽으로 가지 않는다', wallDistances === 0)

sky.send({ ...envelope(SENSOR_PROXIMITY), cm: 9 })
await wait(200)
ok('하늘은 거리를 만들어 낼 수 없다 — 대역에서만 온다',
  !sky.inbox.some((m) => m.event === SENSOR_PROXIMITY && m.cm === 9))

/* ── 벽이 "띄웠다"고 알려 온 별 ──────────────────────── */

section('벽이 "띄웠다"고 알려 온 별')

// wall()은 star.id가 있는 모든 말에 ack와 shown을 보낸다(위 connect() 참고)
const starShown = await sky.expect(STAR_SHOWN)
ok('벽이 띄운 별의 id가 하늘에도 간다', starShown?.starId === 's-001')

/* ── LED (하늘 → 다리 → 아두이노) ────────────────────── */

section('LED')

const beforeLed = await freshStatus(sky)
sky.send({ ...envelope(LED_SET), step: 3 })
await wait(150)
ok('LED 명령은 벽으로 가지 않는다', wall.count(LED_SET) === 0)
const afterGoodLed = await freshStatus(sky)
ok('올바른 LED 명령은 거절되지 않는다', afterGoodLed.rejected === beforeLed.rejected)

sky.send({ ...envelope(LED_SET), step: 9 })
await wait(150)
const afterBadLed = await freshStatus(sky)
ok('범위를 벗어난 LED 단계는 거절한다', afterBadLed.rejected > afterGoodLed.rejected)

/* ── 벽이 꺼져도 ─────────────────────────────────────── */

section('벽이 꺼져도')

const withWall = await freshStatus(sky)
wall.socket.close()
await wait(300)

sky.send({ ...envelope(EVENTS.STAR_REQUESTED), star: star('s-004') })
await wait(300)
const stillAccepted = [...sky.inbox].reverse().find((m) => m.event === EVENTS.STAR_ACCEPTED && m.starId === 's-004')
ok('벽이 없어도 하늘은 계속 보낼 수 있다', stillAccepted?.ok === true)

const noWall = await freshStatus(sky)
ok('벽이 0이라고 알린다', noWall?.td === 0)
ok('벽이 없어도 다리는 빛을 받아들인다',
  noWall.stars.accepted > withWall.stars.accepted,
  `(${withWall.stars.accepted} → ${noWall.stars.accepted})`)
ok('**넘긴 수는 늘지 않는다 — 넘길 벽이 없었다**',
  noWall.stars.relayed === withWall.stars.relayed,
  `(${withWall.stars.relayed} → ${noWall.stars.relayed})`)
ok('받은 수도 띄운 수도 늘지 않는다',
  noWall.stars.received === withWall.stars.received &&
  noWall.stars.shown === withWall.stars.shown,
  `(받음 ${noWall.stars.received} · 띄움 ${noWall.stars.shown})`)

/* ── 끝 ──────────────────────────────────────────────── */

sky.socket.close()
sim.socket.close()
await wait(150)
bridge.kill('SIGTERM')
await rm(RECEIPTS, { force: true })

console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
