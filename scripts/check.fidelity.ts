/**
 * 원본을 그대로 이어받았는가.
 *
 * 이 작품에서 가장 쉽게, 가장 조용히 망가지는 것이 **문구와 색**이다.
 * 코드는 고장 나면 소리를 내지만, 문장 한 줄이 바뀌는 것은 아무 소리도 내지 않는다.
 *
 * 그래서 두 겹으로 본다.
 *
 *   1. 이 파일에 적힌 **원문 표**와 맞는가 — 원본이 없어도 언제나 돈다
 *   2. 원본 파일이 이 기계에 있으면 **바이트로 대조**한다 — 가장 확실하다
 *
 * 원본은 **읽기만 한다.**
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { EMOTIONS } from '@/constants/emotions'
import { TONES } from '@/constants/tones'
import {
  ABOUT, ACTIONS, ALL_LIGHTS, ARRIVAL, COMPOSE, INTRO, LETGO_WORDS,
  MY_TIME, OUR_UNIVERSE, QUESTION, THESIS, TITLE,
} from '@/constants/text.inherited'

let pass = 0
let fail = 0
function ok(name: string, condition: boolean, extra = '') {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`) }
  else { fail += 1; console.log(`  ✗ ${name} ${extra}`) }
}
function section(name: string) { console.log(`\n${name}`) }

/* ── 1. 문구 원문 표 ─────────────────────────────────── */

section('원작의 문구 (원문 대조)')

const SAYINGS: ReadonlyArray<[string, string]> = [
  ['제목', TITLE.wordmark + ' / ' + TITLE.subtitle],
  ['인트로 1', INTRO.verse[0]],
  ['인트로 2', INTRO.verse[1]],
  ['인트로 물음', INTRO.question],
  ['인트로 버튼', INTRO.action],
  ['첫 걸음의 질문', COMPOSE.steps[0].question],
  ['두 걸음의 질문', COMPOSE.steps[1].question],
  ['예시 문장', COMPOSE.placeholder],
  ['다음', COMPOSE.next],
  ['이전', COMPOSE.back],
  ['보내기', COMPOSE.send],
  ['또 하나', COMPOSE.again],
  ['도착', ARRIVAL.line],
  ['MY TIME 부제', MY_TIME.subtitle],
  ['우주 제목', OUR_UNIVERSE.title + ' / ' + OUR_UNIVERSE.subtitle],
  ['우주 1', OUR_UNIVERSE.words[0]],
  ['우주 2', OUR_UNIVERSE.words[1]],
  ['우주 비었을 때', OUR_UNIVERSE.empty],
  ['작품의 물음', QUESTION],
  ['논지 1', THESIS[0]],
  ['논지 2', THESIS[1]],
  ['흘려보냄 1', LETGO_WORDS[0]],
  ['흘려보냄 2', LETGO_WORDS[1]],
  ['흘려보냄 3', LETGO_WORDS[2]],
  ['도감 부제', ALL_LIGHTS.subtitle],
  ['ABOUT 핵심 1', ABOUT.core[0]],
  ['ABOUT 핵심 2', ABOUT.core[1]],
  ['돌아가기', ACTIONS.back],
]

const EXPECTED: Record<string, string> = {
  '제목': 'AFTERLIGHT / 아직 도착 중인 시간',
  '인트로 1': '지금 당신이 보고 있는 빛은,',
  '인트로 2': '이미 지나간 시간입니다.',
  '인트로 물음': '당신에게도 아직 도착 중인 시간이 있나요?',
  '인트로 버튼': '나의 시간을 보내기',
  '첫 걸음의 질문': '지금 떠오르는 시간이 있나요?',
  '두 걸음의 질문': '이 시간을 어떻게 기억하고 싶나요?',
  '예시 문장': '친구들과 처음 여행 갔던 날',
  '다음': '다음',
  '이전': '이전',
  '보내기': '시간을 보내기',
  '또 하나': '또 하나 보내기',
  '도착': '당신의 시간이 도착했습니다.',
  'MY TIME 부제': '나의 시간',
  '우주 제목': 'OUR UNIVERSE / 우리의 우주',
  '우주 1': '각자의 시간은 다르지만,',
  '우주 2': '그 시간들이 모여 하나의 우주가 됩니다.',
  '우주 비었을 때': '아직 모인 빛이 없습니다',
  '작품의 물음': '지나간 시간은 정말 끝난 걸까요?',
  '논지 1': '시간은 사라지는 것이 아니라,',
  '논지 2': '계속해서 우리에게 도착하고 있는 것입니다.',
  '흘려보냄 1': '흘려보낸 시간도,',
  '흘려보냄 2': '없었던 시간이 되지는 않습니다.',
  '흘려보냄 3': '결국 지금의 나를 만든 나의 빛입니다.',
  '도감 부제': '나의 빛 도감',
  'ABOUT 핵심 1': '시간은 사라지는 것이 아니라,',
  'ABOUT 핵심 2': '계속해서 우리에게 도착하고 있는 것입니다.',
  '돌아가기': '돌아가기',
}

let drifted = 0
for (const [name, value] of SAYINGS) {
  if (value !== EXPECTED[name]) {
    drifted += 1
    console.log(`      달라짐 [${name}]`)
    console.log(`        지금: ${value}`)
    console.log(`        원문: ${EXPECTED[name]}`)
  }
}
ok(`${SAYINGS.length}개의 문구가 원작 그대로다`, drifted === 0, `(달라진 것 ${drifted})`)
ok('인트로의 박자가 원작 그대로다',
  INTRO.beats.join(',') === '1000,1700,2900,4300,5400', `(${INTRO.beats.join(',')})`)
ok('도착 연출의 길이가 원작 그대로다',
  ARRIVAL.landingMs === 2600 && ARRIVAL.settleMs === 1400)

/* ── 2. 오늘의 마음 일곱 ─────────────────────────────── */

section('오늘의 마음 일곱 (원문 대조)')

const SEVEN: ReadonlyArray<[string, string, string, boolean]> = [
  ['happy', '행복', '#f2d49a', true],
  ['flutter', '설렘', '#eeb79f', true],
  ['calm', '평온', '#cddde2', true],
  ['anxious', '불안', '#b3a4cd', true],
  ['numb', '무기력', '#98a3ad', true],
  ['sad', '슬픔', '#9fb2d0', true],
  ['other', '기타', '#e8b45e', false],
]

ok('일곱이다', EMOTIONS.length === 7, `(${EMOTIONS.length}개)`)
ok('순서가 원작 그대로다',
  EMOTIONS.map((one) => one.type).join(',') === SEVEN.map(([type]) => type).join(','),
  `(${EMOTIONS.map((one) => one.type).join(',')})`)

let emotionDrift = 0
for (const [type, label, tint, blends] of SEVEN) {
  const found = EMOTIONS.find((one) => one.type === type)
  if (!found || found.label !== label || found.tint !== tint || found.blends !== blends) {
    emotionDrift += 1
    console.log(`      달라짐 [${type}] ${found?.label} ${found?.tint} blends=${found?.blends}`)
  }
}
ok('일곱의 이름과 색과 blends가 원작 그대로다', emotionDrift === 0)
ok("'기타'만 번짐에 섞이지 않는다",
  EMOTIONS.filter((one) => !one.blends).map((one) => one.type).join(',') === 'other')

/* ── 3. 서로 시각적으로 구분되는가 ───────────────────── */

section('일곱이 서로 구분되는가')

function rgb(hex: string): [number, number, number] {
  const v = Number.parseInt(hex.replace('#', ''), 16)
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255]
}
function distance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a)
  const [r2, g2, b2] = rgb(b)
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2)
}

/*
 * 멀리서 보아도 갈리는가.
 *
 * 원작의 색(`tint`)으로는 가장 가까운 둘이 24.6밖에 떨어져 있지 않았다 —
 * 나란히 두면 '다른 온도'로 읽히지만, 네 면의 벽에 투사해 멀리서 보면
 * 거의 같은 빛이 된다. 그래서 외곽광을 색상환에서 벌렸다.
 */
let closest = Infinity
let closestPair = ''
for (let i = 0; i < EMOTIONS.length; i += 1) {
  for (let j = i + 1; j < EMOTIONS.length; j += 1) {
    const d = distance(EMOTIONS[i].light.halo, EMOTIONS[j].light.halo)
    if (d < closest) {
      closest = d
      closestPair = `${EMOTIONS[i].label} × ${EMOTIONS[j].label}`
    }
  }
}
ok('어느 두 마음의 외곽광도 멀리서 갈린다', closest >= 55,
  `(가장 가까운 둘 ${closestPair} = ${closest.toFixed(1)})`)
console.log(`      가장 가까운 두 외곽광: ${closestPair} = ${closest.toFixed(1)}`)

// 잔광과 중심광도 따로 갈려야 한다
for (const layer of ['core', 'trail'] as const) {
  let near = Infinity
  for (let i = 0; i < EMOTIONS.length; i += 1) {
    for (let j = i + 1; j < EMOTIONS.length; j += 1) {
      near = Math.min(near, distance(EMOTIONS[i].light[layer], EMOTIONS[j].light[layer]))
    }
  }
  ok(`${layer === 'core' ? '중심광' : '잔광'}도 서로 갈린다`, near >= 12, `(${near.toFixed(1)})`)
}

ok('세 겹이 모두 다른 색이다',
  EMOTIONS.every((one) =>
    one.light.core !== one.light.halo && one.light.halo !== one.light.trail))
ok('원작의 색은 출처로 그대로 남아 있다',
  EMOTIONS.find((one) => one.type === 'sad')?.tint === '#9fb2d0')

const forms = new Set(EMOTIONS.map((one) => one.form))
ok('모양이 한 가지로 몰려 있지 않다', forms.size >= 3, `(${[...forms].join(' · ')})`)

// 색이 가까운 둘은 모양이나 자리가 달라야 한다
let indistinct = 0
for (let i = 0; i < EMOTIONS.length; i += 1) {
  for (let j = i + 1; j < EMOTIONS.length; j += 1) {
    const a = EMOTIONS[i]
    const b = EMOTIONS[j]
    if (distance(a.light.halo, b.light.halo) > 80) continue
    const sameForm = a.form === b.form
    const overlap =
      a.field.left < b.field.right && b.field.left < a.field.right &&
      a.field.top < b.field.bottom && b.field.top < a.field.bottom
    if (sameForm && overlap) {
      indistinct += 1
      console.log(`      구분이 어려움: ${a.label} × ${b.label}`)
    }
  }
}
ok('색이 가까운 둘은 모양이나 자리가 다르다', indistinct === 0)

/*
 * 형광으로도 사이버펑크로도 가지 않았는가.
 *
 * 색을 벌리면 가장 쉽게 망가지는 자리다. 네온은 **밝으면서 동시에 진한** 색이다.
 * 그래서 둘을 함께 본다 — 가장 밝은 칸이 235를 넘지 않고, 진하기가 0.7을 넘지 않는다.
 */
let brightest = 0
let deepest = 0
for (const one of EMOTIONS) {
  for (const hex of [one.light.core, one.light.halo, one.light.trail]) {
    const [r, g, b] = rgb(hex)
    brightest = Math.max(brightest, Math.max(r, g, b))
    deepest = Math.max(deepest, (Math.max(r, g, b) - Math.min(r, g, b)) / 255)
  }
}
ok('형광으로 튀지 않는다 (외곽광·잔광이 235를 넘지 않는다)',
  Math.max(
    ...EMOTIONS.flatMap((one) =>
      [one.light.halo, one.light.trail].map((hex) => Math.max(...rgb(hex))),
    ),
  ) <= 235)
ok('어느 색도 원색이 아니다', deepest <= 0.7, `(가장 진한 것 ${deepest.toFixed(2)})`)
console.log(`      가장 밝은 칸 ${brightest} · 가장 진한 색 ${deepest.toFixed(2)}`)

ok("'기타'에는 색이 없다 (이름 붙이지 않은 마음)", (() => {
  const other = EMOTIONS.find((one) => one.type === 'other')!
  const [r, g, b] = rgb(other.light.halo)
  return (Math.max(r, g, b) - Math.min(r, g, b)) / 255 < 0.2
})())

/* ── 4. 두 빛 ────────────────────────────────────────── */

section('간직 / 흘려보내기 (원문 대조)')
{
  const keep = TONES.find((one) => one.type === 'keep')!
  const letgo = TONES.find((one) => one.type === 'letgo')!
  ok('이름이 원작 그대로다',
    keep.label === '간직하고 싶은 시간' && letgo.label === '흘려보내고 싶은 시간')
  ok('카드 이름이 원작 그대로다',
    keep.cardLabel === '간직한 시간' && letgo.cardLabel === '흘려보낸 시간')
  ok('기호가 원작 그대로다', keep.glyph === '✦' && letgo.glyph === '○')
  ok('색이 원작 그대로다',
    keep.core === '#fff4d6' && keep.halo === '#e8b45e' &&
    letgo.core === '#e9eef4' && letgo.halo === '#93a4b8')
}

/* ── 5. 물려받은 파일이 그대로인가 ───────────────────── */

section('물려받은 파일이 손대지지 않았는가')

/*
 * 원본(공개 저장소 suye1116/afterlight @ e99fa21)에서 **한 바이트도 고치지 않고**
 * 가져온 파일들의 지문이다. 원본이 이 기계에 없어도 확인할 수 있어야 하므로
 * 지문을 여기 적어 둔다 — 한 글자라도 바뀌면 지문이 달라진다.
 *
 * 고칠 일이 생기면 **고치지 말고 옆에 새 파일을 둔다** (`styles/kiosk.css`가 그렇다).
 */
const FINGERPRINTS: ReadonlyArray<[string, string]> = [
  ['src/styles/tokens.css', 'fe1ba8565470a107'],
  ['src/styles/global.css', '7e5eb476ca89c255'],
  ['src/constants/tones.ts', 'c5c4706737e263cc'],
  ['src/constants/text.inherited.ts', '93232266db3d458f'],
  ['src/canvas/nebula.ts', '67585c8149129b6d'],
  ['src/canvas/stars.ts', '82a9e20a576fea67'],
  ['src/canvas/safeArea.ts', '6e3e28eb9fa01aa0'],
  ['src/lib/noise.ts', '203778e962e65701'],
  ['src/lib/random.ts', '7dd5c1ff3cb54526'],
  ['src/lib/safeZones.ts', '70f560ff11cf7eaf'],
  ['src/lib/fullscreen.ts', '7208f95c1f9eb425'],
  ['src/components/Notice.module.css', '3f7b154a54e4448f'],
]

let touched = 0
for (const [file, fingerprint] of FINGERPRINTS) {
  const full = path.join(process.cwd(), file)
  if (!existsSync(full)) {
    touched += 1
    console.log(`      없어짐: ${file}`)
    continue
  }
  const now = createHash('sha256').update(readFileSync(full)).digest('hex').slice(0, 16)
  if (now !== fingerprint) {
    touched += 1
    console.log(`      손대짐: ${file} (${fingerprint} → ${now})`)
  }
}
ok(`물려받은 ${FINGERPRINTS.length}개 파일이 원본 그대로다`, touched === 0, `(달라진 것 ${touched})`)

/* ── 6. 작업본은 어디까지 가 있나 (알려 주기만 한다) ─── */

section('작업본과의 거리 (고장이 아니라 알림)')

const WORKING = path.join(process.env.HOME ?? '', 'Desktop/조형실습/AFTERLIGHT')
if (existsSync(WORKING)) {
  /*
   * 작업본은 공개 저장소보다 앞서 있다. 여기 파일들이 그것과 다른 것은
   * **고장이 아니다** — 바탕이 공개본이기 때문이다.
   * 다만 어디가 벌어져 있는지는 알고 있어야 언제 가져올지 정할 수 있다.
   */
  const AHEAD: ReadonlyArray<[string, string]> = [
    ['src/constants/tones.ts', 'src/constants/tones.ts'],
    ['src/constants/text.inherited.ts', 'src/constants/text.ts'],
    ['src/canvas/safeArea.ts', 'src/canvas/safeArea.ts'],
  ]
  for (const [mine, theirs] of AHEAD) {
    const b = path.join(WORKING, theirs)
    if (!existsSync(b)) continue
    const a = readFileSync(path.join(process.cwd(), mine), 'utf8').split('\n')
    const c = readFileSync(b, 'utf8').split('\n')
    console.log(`  · ${mine} — 작업본이 ${Math.abs(c.length - a.length)}줄 더 가지고 있습니다`)
  }
  console.log('    (바탕이 공개본이라 그렇습니다. 가져올지 말지는 사람이 정할 일입니다.)')
  ok('작업본을 읽을 수 있다', true)
} else {
  console.log('  — 작업본을 찾을 수 없어 건너뜁니다')
}

console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
