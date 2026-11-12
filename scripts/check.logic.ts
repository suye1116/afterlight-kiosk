import { EMOTIONS, getEmotion } from '@/constants/emotions'
import { TONES, getTone } from '@/constants/tones'
import { fieldOf, remainingLight, separationFor, LETGO_FADE_MS } from '@/lib/starMath'
import { createLocalUniverse, statsOf, toWallLight } from '@/data/universeRepository'
import { universe } from '@/data'
import { growLinks, type LinkNode } from '@/lib/constellationLinks'
import {
  dimmestAlpha,
  drawnCoreRadius,
  drawnHaloRadius,
  MIN_CORE_R,
  MIN_HALO_R,
  MIN_STAR_ALPHA,
} from '@/canvas/skyEngine'
import { formFor } from '@/canvas/starForm'
import { letgoDriftRatio, constellationIdFor, LETGO_DRIFT_MS } from '@/lib/starMath'
import { DONE_HOLD_MS, IDLE_MS, INVITE_HOLD_MS, useKiosk } from '@/store/useKiosk'
import { resetGuardForTest } from '@/lib/inputGuard'
import { consentedStories } from '@/lib/stories'
import {
  contentOf, holdFor, pickShowcase, scatterShowcase, stepFor,
  SHOWCASE_SIZE, STEP_TARGET_MS, TELL_AT, VIEWING,
} from '@/lib/showcase'
import { INVITE, PROMPTS } from '@/constants/text.exhibit'
import { VERIFIED_STARS, getAssignedStar } from '@/lib/starAssignment'
import { buildReceipt } from '@/lib/receipt'
import type { UniverseStar } from '@/types'

let pass = 0
let fail = 0
function ok(name: string, condition: boolean, extra = '') {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`) }
  else { fail += 1; console.log(`  ✗ ${name} ${extra}`) }
}
function section(name: string) { console.log(`\n${name}`) }

const X_SQUEEZE = 0.62
/** 아무리 붐벼도 이보다 붙지 않아야 한다 (starMath.ts의 MIN_SEPARATION_FLOOR) */
const FLOOR = 0.012
const gap = (a: {x:number;y:number}, b: {x:number;y:number}) =>
  Math.hypot((a.x - b.x) * X_SQUEEZE, a.y - b.y)

/* ── 1. 감정 영역이 서로 겹치지 않는가 ───────────────── */
section('감정 영역')
let overlap = 0
for (let i = 0; i < EMOTIONS.length; i += 1) {
  for (let j = i + 1; j < EMOTIONS.length; j += 1) {
    const a = fieldOf(EMOTIONS[i])
    const b = fieldOf(EMOTIONS[j])
    const hit = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom
    if (hit) { overlap += 1; console.log(`      겹침: ${EMOTIONS[i].name} × ${EMOTIONS[j].name}`) }
  }
}
ok('일곱 별자리의 영역이 서로 겹치지 않는다', overlap === 0)
ok('모든 영역이 FIELD(0.06~0.94 × 0.10~0.88) 안에 있다',
  EMOTIONS.every((e) => {
    const f = fieldOf(e)
    return f.left >= 0.06 - 1e-9 && f.right <= 0.94 + 1e-9 && f.top >= 0.10 - 1e-9 && f.bottom <= 0.88 + 1e-9
  }))

/* ── 2. 보낸 별이 제 별자리 안에 앉는가 ──────────────── */
section('별의 자리 (200개를 보낸다)')
const repo = createLocalUniverse()
const sent: UniverseStar[] = []
for (let i = 0; i < 200; i += 1) {
  const emotion = EMOTIONS[i % EMOTIONS.length]
  const { star } = await repo.add({
    text: `시험 ${i}`,
    type: i % 3 === 0 ? 'letgo' : 'keep',
    emotion,
    timeRef: { kind: 'unknown', label: '기억나지 않음' },
    sessionId: 'check',
  })
  await repo.markArrived(star.id)
  sent.push(star)
}
ok('200개가 모두 더해졌다', sent.length === 200)

let outside = 0
for (const star of sent) {
  const f = fieldOf(getEmotion(star.emotion))
  if (star.x < f.left - 1e-6 || star.x > f.right + 1e-6 || star.y < f.top - 1e-6 || star.y > f.bottom + 1e-6) outside += 1
}
ok('모든 별이 자기 감정의 영역 안에 앉았다', outside === 0, `(벗어남 ${outside})`)

function closest(list: ReadonlyArray<UniverseStar>): number {
  let min = Infinity
  for (const emotion of EMOTIONS) {
    const group = list.filter((s) => s.emotion === emotion.type)
    for (let i = 0; i < group.length; i += 1)
      for (let j = i + 1; j < group.length; j += 1)
        min = Math.min(min, gap(group[i], group[j]))
  }
  return min
}
const near200 = closest(sent)
ok('어떤 두 별도 바닥 간격보다 붙지 않는다', near200 >= FLOOR - 1e-9,
  `(가장 가까운 둘 ${near200.toFixed(4)})`)
ok('그 별자리에 모인 수에 맞는 간격을 지킨다', near200 >= separationFor(28) - 1e-9,
  `(가장 가까운 둘 ${near200.toFixed(4)} / 요구 ${separationFor(28).toFixed(4)})`)
console.log(`      별자리마다 29개일 때 가장 가까운 둘: ${near200.toFixed(4)}`)

const seqs = sent.map((s) => s.seq)
ok('전시 통산 번호가 1부터 빠짐없이 올라간다',
  seqs.every((n, i) => n === i + 1), `(${seqs[0]}…${seqs[seqs.length - 1]})`)

/* ── 2-2. 전시 규모 (별자리마다 100개) ───────────────── */
section('전시 규모 (700개를 보낸다 — 별자리마다 100개)')
const big = createLocalUniverse()
const many: UniverseStar[] = []
for (let i = 0; i < 700; i += 1) {
  const emotion = EMOTIONS[i % EMOTIONS.length]
  const { star } = await big.add({
    text: `부하 ${i}`,
    type: i % 3 === 0 ? 'letgo' : 'keep',
    emotion,
    timeRef: { kind: 'unknown', label: '기억나지 않음' },
    sessionId: 'load',
  })
  many.push(star)
}
let strayed = 0
for (const star of many) {
  const f = fieldOf(getEmotion(star.emotion))
  if (star.x < f.left - 1e-6 || star.x > f.right + 1e-6 || star.y < f.top - 1e-6 || star.y > f.bottom + 1e-6) strayed += 1
}
ok('700개가 모두 제 별자리 안에 머문다', strayed === 0, `(벗어남 ${strayed})`)
const near500 = closest(many)
ok('붐벼도 두 별이 한 점이 되지는 않는다', near500 >= FLOOR - 1e-9,
  `(가장 가까운 둘 ${near500.toFixed(4)})`)
console.log(`      별자리마다 100개일 때 가장 가까운 둘: ${near500.toFixed(4)}`)

/* ── 3. 집계 ─────────────────────────────────────────── */
section('집계')
const stats = statsOf(sent)
ok('전체 수가 맞는다', stats.total === 200)
ok('감정별 합이 전체와 같다',
  EMOTIONS.reduce((sum, e) => sum + stats.byEmotion[e.type], 0) === 200)
ok('간직 + 흘려보냄이 전체와 같다', stats.keep + stats.letgo === 200)

/* ── 4. 벽으로 문장이 건너가지 않는가 ────────────────── */
section('벽으로 건너가는 것')
const wall = toWallLight(sent[0]) as Record<string, unknown>
ok('문장(text)이 실리지 않는다', !('text' in wall))
ok('시간 정보(timeRef)가 실리지 않는다', !('timeRef' in wall))
ok('누가 보냈는지(sessionId)가 실리지 않는다', !('sessionId' in wall))
ok('별을 그릴 것은 다 있다',
  ['id', 'emotion', 'type', 'x', 'y', 'brightness', 'seed'].every((k) => k in wall))

/* ── 5. 흘려보낸 빛은 사라지지 않는다 ────────────────── */
section('흘려보낸 빛')
const letgo = { type: 'letgo' as const, createdAt: 0, brightness: 0.5 }
const now0 = remainingLight(letgo, 0)
const far = remainingLight(letgo, LETGO_FADE_MS * 4)
ok('처음에는 제 밝기 그대로다', Math.abs(now0 - 1) < 1e-6)
ok('아무리 지나도 0이 되지 않는다', far > 0, `(남은 빛 ${(far * 0.5).toFixed(3)})`)
ok('간직한 빛은 옅어지지 않는다', remainingLight({ type: 'keep', createdAt: 0, brightness: 1 }, 1e12) === 1)

/* ── 6. 두 톤의 수치가 원작 그대로인가 ───────────────── */
section('간직 / 흘려보내기')
const keep = getTone('keep')
const go = getTone('letgo')
ok('이름이 원작 그대로다',
  keep.label === '간직하고 싶은 시간' && go.label === '흘려보내고 싶은 시간')
ok('카드 이름이 원작 그대로다',
  keep.cardLabel === '간직한 시간' && go.cardLabel === '흘려보낸 시간')
ok('색이 원작 그대로다',
  keep.core === '#fff4d6' && keep.halo === '#e8b45e' && go.core === '#e9eef4' && go.halo === '#93a4b8')
ok('밝기 범위가 원작 그대로다',
  keep.brightness[0] === 0.78 && keep.brightness[1] === 1 &&
  go.brightness[0] === 0.42 && go.brightness[1] === 0.62)
ok('두 빛뿐이다', TONES.length === 2)

/* ── 7. 키오스크의 걸음 ──────────────────────────────── */
section('키오스크의 걸음')
const s = () => useKiosk.getState()

s().goHome()
ok('처음은 대기 화면이다', s().scene === 'attract')
s().begin()
ok('누르면 인트로로 간다', s().scene === 'intro')

s().goTo('record')
s().setText('   ')
s().toEmotion()
ok('빈 문장으로는 다음으로 가지 않는다', s().scene === 'record')
ok('안내가 뜬다', s().notice?.text === '한 문장을 적어야 빛이 출발할 수 있습니다.')

s().setText('친구들과 처음 여행 갔던 날')
s().toEmotion()
ok('문장이 있으면 감정으로 간다', s().scene === 'emotion')

s().chooseEmotion(EMOTIONS[2].type)
ok('감정을 고르는 일이 곧 다음 걸음이다', s().scene === 'choice')
s().chooseType('keep')
ok('간직을 고르면 확인으로 간다', s().scene === 'confirm')

const before = s().stars.length
resetGuardForTest(); await s().send()
ok('보내면 건너가는 장면이 된다', s().scene === 'sending')
ok('빛이 하나 늘었다', s().stars.length === before + 1)
const once = s().stars.length

// 연타
await Promise.all([s().send(), s().send(), s().send()])
ok('연타해도 별이 더 생기지 않는다', s().stars.length === once, `(${s().stars.length})`)

s().finishSending()
ok('건너간 뒤에는 곧장 나의 별 화면이다(도착 화면을 거치지 않는다)', s().scene === 'yourStar')
ok('방금 보낸 빛을 알고 있다', s().sent !== null)
ok('보낸 빛에 내가 고른 감정이 담겨 있다', s().sent?.emotion === EMOTIONS[2].type)
ok('보낸 빛에 내가 고른 선택이 담겨 있다', s().sent?.type === 'keep')

// 실제 별 배정은 finishSending() 안에서 동기적으로 끝난다 — 기다릴 필요가 없다.
ok('별이 닿은 뒤 실제 별이 배정되어 있다(STEP 7)', s().yourStar !== null)
ok(
  '배정된 실제 별이 검증된 별이다(STEP 7)',
  VERIFIED_STARS.some((star) => star.id === s().yourStar?.realStarId),
)

// '나의 별 이야기 보기' → '나의 별을 기록으로 남기기' → 영수증 → '닫기' → 마지막 선택
s().goTo('receipt')
ok('별 이야기를 지나야 영수증으로 간다', s().scene === 'receipt')
s().goTo('finale')
ok('영수증을 닫으면 마지막 선택 화면이다', s().scene === 'finale')

s().showUniverse()
ok('"우리의 우주 보기"를 고르면 공동 우주로 건너갈 수 있다', s().scene === 'universe')

const kept = s().stars.length
s().goHome()
ok('처음으로 돌아간다', s().scene === 'attract')
ok('적던 것은 지워진다', s().text === '' && s().emotion === null && s().type === null && s().sent === null)
ok('보낸 빛은 지워지지 않는다', s().stars.length === kept)

/* ── 7-1. 분리된 기억 걸음 (기억 → 시간 → 계절) ───────── */
section('분리된 기억 걸음 — 뒤로 가도 입력이 지워지지 않는가')
{
  const k = () => useKiosk.getState()
  k().goHome()
  k().goTo('record')
  k().setText('골목에서 마주친 그 고양이')
  k().toTime()
  ok('기억을 적으면 시간 선택으로 간다', k().scene === 'time')

  k().chooseTime({ kind: 'years', years: 3, label: '3년쯤 전' })
  k().toSeason()
  ok('시간을 고르면 계절 선택으로 간다', k().scene === 'season')

  k().chooseSeason('autumn')
  k().toEmotion()
  ok('계절을 고르면 감정 선택으로 간다', k().scene === 'emotion')

  k().back()
  ok('뒤로 가면 계절 선택으로 돌아온다', k().scene === 'season')
  ok('계절은 고른 그대로 남아 있다', k().season === 'autumn')

  k().back()
  ok('한 번 더 뒤로 가면 시간 선택으로 돌아온다', k().scene === 'time')
  ok('시간은 고른 그대로 남아 있다', k().timeRef?.label === '3년쯤 전')

  k().back()
  ok('한 번 더 뒤로 가면 기억 작성으로 돌아온다', k().scene === 'record')
  ok('적은 문장은 지워지지 않는다', k().text === '골목에서 마주친 그 고양이')

  // 다시 앞으로 — 뒤로 갔다 와도 고른 값이 그대로 다음 화면까지 이어지는가
  k().toTime()
  k().toSeason()
  k().toEmotion()
  ok('다시 진행해도 시간이 그대로 이어진다', k().timeRef?.label === '3년쯤 전')
  ok('다시 진행해도 계절이 그대로 이어진다', k().season === 'autumn')

  k().chooseEmotion('calm')
  k().chooseType('keep')
  ok('실제 별 배정에 전달될 입력이 모두 모였다',
    k().text === '골목에서 마주친 그 고양이' &&
    k().timeRef?.label === '3년쯤 전' &&
    k().season === 'autumn' &&
    k().emotion === 'calm' &&
    k().type === 'keep')

  k().goHome()
}

/* ── 7-1-1. 부적절한 입력은 다음 단계로 못 간다(§PART 1) ── */
section('부적절한 입력 — 다음 단계로 넘어가지 못하고, 고치면 진행된다')
{
  const k = () => useKiosk.getState()

  // 직접 작성 — 욕설을 적으면 막힌다
  k().goHome()
  k().goTo('record')
  k().setText('진짜 개새끼 같은 하루였다')
  k().toTime()
  ok('욕설을 적으면 다음(시간 선택)으로 못 간다', k().scene === 'record')
  ok('적은 글은 지워지지 않는다(고칠 수 있다)', k().text === '진짜 개새끼 같은 하루였다')

  // 고치면 — 같은 자리에서 다시 검사하고 통과하면 진행된다
  k().setText('정말 속상했던 하루였다')
  k().toTime()
  ok('고쳐 적으면 정상적으로 다음 단계로 간다', k().scene === 'time')
  k().back()

  // Enter 키로도 우회할 수 없다(§1) — onKeyDown도 같은 toTime()을 부른다
  k().setText('진짜 씨발 같은 하루였다')
  k().toTime() // SceneRecord의 Enter 핸들러가 부르는 것과 같은 함수다
  ok('Enter로 넘어가려 해도(같은 toTime()) 막힌다', k().scene === 'record')

  k().setRecordMode('free')
  k().setText('')

  // 질문에 답하기 — 답에 욕설이 있으면 똑같이 막힌다
  k().goTo('record')
  k().setRecordMode('prompt')
  k().setPromptAnswer('씨발 진짜 최악이었다')
  k().toTime()
  ok('질문 답변에 욕설이 있으면 감정 화면으로 못 간다', k().scene === 'record')
  ok('적은 답은 지워지지 않는다', k().promptAnswer === '씨발 진짜 최악이었다')

  k().setPromptAnswer('정말 속상한 하루였다')
  k().toTime()
  ok('답을 고치면 정상적으로 감정 화면(시간·계절 건너뛰고)으로 간다', k().scene === 'emotion')

  // 뒤로 간 다음 다시 고쳐도(§1 "다른 전환 경로") 매번 다시 검사된다
  k().back()
  ok('감정 화면에서 뒤로 가면 기록 화면이다', k().scene === 'record')
  k().setPromptAnswer('씨발 다시 이상한 말을 넣어본다')
  k().toTime()
  ok('뒤로 갔다 다시 나쁜 말을 넣으면 또 막힌다(우회할 수 없다)', k().scene === 'record')

  k().goHome()
}

/* ── 7-2. 질문을 통해 기억 떠올리기 ────────────────────── */
section('질문을 통해 떠올리기 — 전환해도 적던 것이 사라지지 않는가')
{
  const k = () => useKiosk.getState()
  k().goHome()
  k().goTo('record')

  ok('기본은 직접 작성 방식이다', k().recordMode === 'free')

  k().setText('직접 적은 문장')
  k().setRecordMode('prompt')
  ok('질문 방식으로 바꾸면 질문이 하나 뽑혀 있다', typeof k().selectedPrompt === 'string')
  ok('질문 방식으로 바꿔도 직접 적던 문장은 지워지지 않는다', k().text === '직접 적은 문장')
  ok('질문 방식의 답은 아직 비어 있다', k().promptAnswer === '')

  k().setPromptAnswer('질문에 답한 문장')
  k().setRecordMode('free')
  ok('직접 작성으로 되돌아가도 적던 문장이 그대로다', k().text === '직접 적은 문장')
  k().setRecordMode('prompt')
  ok('질문 방식으로 다시 바꿔도 답한 문장이 그대로다', k().promptAnswer === '질문에 답한 문장')

  const firstPrompt = k().selectedPrompt
  k().pickPrompt()
  ok('"다른 질문"을 누르면 질문이 바뀐다(열 개 중 하나이므로 보통 달라진다)',
    k().selectedPrompt !== firstPrompt || PROMPTS.length === 1)
  ok('"다른 질문"을 누르면 그 질문에 대한 답은 새로 적어야 한다(지워진다)',
    k().promptAnswer === '')

  // 직전 질문과 다른 질문이 나오는가 — 여러 번 뽑아 통계로 본다
  let repeats = 0
  for (let i = 0; i < 60; i += 1) {
    const before = k().selectedPrompt
    k().pickPrompt()
    if (k().selectedPrompt === before) repeats += 1
  }
  ok('가능하면 직전 질문과 다른 질문이 나온다(60번 중 반복이 적다)',
    repeats <= 6, `(반복 ${repeats}/60)`)

  // 질문에 답하는 방식으로 끝까지 — 그 답이 실제 별 배정까지 그대로 가는가
  k().goHome()
  k().goTo('record')
  k().setRecordMode('prompt')
  const question = k().selectedPrompt
  k().setPromptAnswer('질문에 답하며 떠올린 하루')
  /*
   * §PART 2 전면 수정 — 질문에 답하는 방식은 "언제·어떤 계절이었는지"를
   * 묻는 것이 어색하므로, 이제 `time`·`season` 화면을 **거치지 않고**
   * 곧장 감정 화면으로 간다.
   */
  k().toTime()
  ok('질문에 답하면 시간·계절 화면을 건너뛰고 곧장 감정 화면으로 간다', k().scene === 'emotion')

  // 되돌아갈 곳도 건너뛴 화면이 아니라 기록 화면이어야 한다
  k().back()
  ok('감정 화면에서 뒤로 가면(질문 방식) 시간·계절이 아니라 기록 화면으로 돌아간다', k().scene === 'record')
  ok('뒤로 가도 적은 답은 그대로 남아 있다', k().promptAnswer === '질문에 답하며 떠올린 하루')
  k().toTime()
  ok('다시 다음으로 가도 여전히 감정 화면으로 간다', k().scene === 'emotion')

  k().chooseEmotion('happy')
  k().chooseType('keep')
  resetGuardForTest(); await k().send()
  k().finishSending()

  const sent = k().sent
  ok('보낸 빛의 문장은 질문에 답한 내용이다(원문과 동일한 자리를 쓴다)',
    sent?.text === '질문에 답하며 떠올린 하루')
  ok('보낸 빛에 작성 방식이 "질문에 답하기"로 실려 있다', sent?.recordMode === 'prompt')
  ok('보낸 빛에 그 질문의 원문이 실려 있다', sent?.promptQuestion === question)
  ok('시간을 고르지 않았으므로 기억나지 않음으로 들어간다', sent?.timeRef.kind === 'unknown')
  ok('계절을 고르지 않았으므로 unknown으로 들어간다', sent?.season === 'unknown')
  ok('질문에 답한 내용도 실제 별 배정에 그대로 쓰인다(배정이 성공한다)', k().yourStar !== null)

  k().goHome()
  ok('다음 관람객을 위해 작성 방식도 처음으로 돌아간다', k().recordMode === 'free')
  ok('질문과 답도 비워진다', k().selectedPrompt === null && k().promptAnswer === '')
}

/* ── 7-3. 영수증의 질문·답 — 기존 원문 출력 정책을 그대로 따른다 ── */
section('영수증의 질문·답')
{
  const promptStar: UniverseStar = {
    ...many[0],
    text: '질문에 답한 문장',
    recordMode: 'prompt',
    promptQuestion: '최근 나를 가장 많이 웃게 했던 순간은 언제인가요?',
  }
  const freeStar: UniverseStar = { ...many[0], text: '직접 적은 문장' }

  const defaultReceipt = buildReceipt(promptStar, 1, null)
  ok('기본으로는(원문 정책이 꺼져 있으면) 질문도 답도 찍지 않는다',
    defaultReceipt.text === undefined && defaultReceipt.prompt === undefined)

  const promptReceipt = buildReceipt(promptStar, 1, null, { includeText: true })
  ok('원문 정책을 켜면 질문 방식일 때는 질문과 답이 함께 실린다',
    promptReceipt.prompt?.question === promptStar.promptQuestion &&
    promptReceipt.prompt?.answer === promptStar.text)
  ok('질문 방식일 때는 text 칸을 따로 채우지 않는다(같은 자리를 두 번 쓰지 않는다)',
    promptReceipt.text === undefined)

  const freeReceipt = buildReceipt(freeStar, 1, null, { includeText: true })
  ok('직접 작성 방식은 그대로 text에 실린다(기존과 같다)',
    freeReceipt.text === '직접 적은 문장' && freeReceipt.prompt === undefined)
}

/* ── 8. 별 데이터 ────────────────────────────────────── */
section('별 데이터')
ok('이름이 하나도 겹치지 않는다', new Set(many.map((s) => s.id)).size === many.length)
ok('모두 별자리 이름을 가지고 있다',
  many.every((star) => star.constellation === `con-${star.emotion}`))
ok('별자리 이름은 그 마음에서 나온다',
  EMOTIONS.every((e) => constellationIdFor(e) === `con-${e.type}`))
ok('시간 기록이 그대로 실려 있다',
  many.every((star) => typeof star.text === 'string' && typeof star.timeRef.label === 'string'))
ok('마음과 간직/흘려보내기가 따로 실려 있다',
  many.every((star) => EMOTIONS.some((e) => e.type === star.emotion)) &&
  many.every((star) => star.type === 'keep' || star.type === 'letgo'))
ok('보낸 때를 알고 있다', many.every((star) => typeof star.createdAt === 'number'))

/* ── 9. 전송 상태 ────────────────────────────────────── */
section('전송 상태')
const live = createLocalUniverse(true)
const { star: one } = await live.add({
  text: '처음 보내는 시간',
  type: 'keep',
  emotion: EMOTIONS[0],
  timeRef: { kind: 'recent', label: '얼마 전' },
  sessionId: 'status',
})
ok('보낸 직후에는 아직 건너가는 중이다', one.status === 'sending')
ok('건너가는 중에는 닿은 때가 없다', one.arrivedAt === undefined)
const afterArrival = await live.markArrived(one.id)
const landed = afterArrival.find((s) => s.id === one.id)
ok('닿았다고 표시된다', landed?.status === 'arrived')
ok('닿은 때가 적힌다', typeof landed?.arrivedAt === 'number')
await live.markArrived(one.id)
ok('두 번 닿아도 빛이 둘이 되지 않는다',
  live.snapshot().filter((s) => s.id === one.id).length === 1)

/* ── 10. 테스트 데이터는 따로 둔다 ───────────────────── */
section('테스트 데이터')
for (let i = 0; i < 12; i += 1) {
  const { star } = await live.add({
    text: `점검 ${i}`,
    type: 'keep',
    emotion: EMOTIONS[i % EMOTIONS.length],
    timeRef: { kind: 'unknown', label: '기억나지 않음' },
    sessionId: 'test',
    source: 'test',
  })
  await live.markArrived(star.id)
}
const mixed = statsOf(live.snapshot())
ok('실제의 빛과 점검용 빛을 따로 센다', mixed.live === 1 && mixed.test === 12, `(실제 ${mixed.live} · 점검 ${mixed.test})`)
ok('둘이 한 우주에 함께 떠 있다', mixed.total === 13)
ok('번호를 따로 센다 — 점검 때문에 첫 관람객이 13번이 되지 않는다',
  live.snapshot().filter((s) => s.source === 'live')[0].seq === 1)

await live.eraseTest()
const after = statsOf(live.snapshot())
ok('점검용 빛만 지운다', after.test === 0)
ok('**실제 관람객의 빛은 지워지지 않는다**', after.live === 1)
ok('실제의 빛을 지우는 길은 아예 없다', !('eraseAll' in live))

const sealed = createLocalUniverse(false)
ok('전시 빌드는 점검용 통을 열지도 않는다', sealed.testing === false)

/* ── 11. 흘려보낸 빛은 멀어지되 사라지지 않는다 ──────── */
section('간직하기 / 흘려보내기')
const keeper = { type: 'keep' as const, createdAt: 0, arrivedAt: 0 }
const goer = { type: 'letgo' as const, createdAt: 0, arrivedAt: 0 }
ok('간직한 빛은 자리를 옮기지 않는다', letgoDriftRatio(keeper, LETGO_DRIFT_MS * 10) === 0)
ok('흘려보낸 빛은 처음에는 제자리다', letgoDriftRatio(goer, 0) === 0)
ok('흘려보낸 빛은 조금씩 멀어진다',
  letgoDriftRatio(goer, LETGO_DRIFT_MS * 0.5) > 0.2 &&
  letgoDriftRatio(goer, LETGO_DRIFT_MS * 0.5) < 0.8)
ok('다 멀어지면 그 자리에 머문다',
  letgoDriftRatio(goer, LETGO_DRIFT_MS) === 1 &&
  letgoDriftRatio(goer, LETGO_DRIFT_MS * 100) === 1)
ok('멀어진 뒤에도 빛이 남아 있다', remainingLight({ ...goer, brightness: 0.5 }, LETGO_DRIFT_MS * 100) > 0)

/* ── 11-2. 보이지 않는 빛은 없다 ─────────────────────── */
section('보이는 크기와 밝기')

let faintest = Infinity
let smallestCore = Infinity
let smallestHalo = Infinity
// 모든 마음 × 두 빛 × 밝기 범위의 양 끝을, 다 옅어진 뒤의 상태로 재 본다
for (const emotion of EMOTIONS) {
  for (const type of ['keep', 'letgo'] as const) {
    const tone = getTone(type)
    for (const brightness of [tone.brightness[0], tone.brightness[1]]) {
      for (let seed = 0; seed < 40; seed += 1) {
        const shape = formFor(emotion, seed * 7919)
        faintest = Math.min(
          faintest,
          dimmestAlpha({ type, brightness, createdAt: 0 }, LETGO_FADE_MS * 10),
        )
        smallestCore = Math.min(smallestCore, drawnCoreRadius(brightness, tone.coreScale, shape))
        smallestHalo = Math.min(smallestHalo, drawnHaloRadius(brightness, tone.haloScale, shape))
      }
    }
  }
}
ok('가장 희미한 빛도 바닥 밝기를 지킨다', faintest >= MIN_STAR_ALPHA - 1e-9,
  `(가장 어두운 순간 ${faintest.toFixed(3)})`)
ok('가장 작은 핵도 바닥 크기를 지킨다', smallestCore >= MIN_CORE_R - 1e-9,
  `(${smallestCore.toFixed(2)}px)`)
ok('가장 작은 번짐도 바닥 크기를 지킨다', smallestHalo >= MIN_HALO_R - 1e-9,
  `(${smallestHalo.toFixed(2)}px)`)
console.log(`      가장 어두운 순간 ${faintest.toFixed(3)} · 핵 ${smallestCore.toFixed(1)}px · 번짐 ${smallestHalo.toFixed(1)}px`)

/* ── 11-3. 마음과 간직/흘려보내기는 나란한 두 축이다 ── */
section('마음 × 간직/흘려보내기 (일곱 × 둘)')
{
  const pairs = createLocalUniverse(true)
  const made: UniverseStar[] = []
  for (const emotion of EMOTIONS) {
    for (const type of ['keep', 'letgo'] as const) {
      const { star } = await pairs.add({
        text: `${emotion.label} · ${type}`,
        type,
        emotion,
        timeRef: { kind: 'unknown', label: '기억나지 않음' },
        sessionId: 'axes',
      })
      await pairs.markArrived(star.id)
      made.push(star)
    }
  }
  ok('일곱 × 둘, 열네 가지가 모두 만들어진다', made.length === 14)
  ok('고른 마음이 그대로 실린다',
    EMOTIONS.every((e) => made.filter((s) => s.emotion === e.type).length === 2))
  ok('고른 선택이 그대로 실린다',
    made.filter((s) => s.type === 'keep').length === 7 &&
    made.filter((s) => s.type === 'letgo').length === 7)
  ok('**간직한 빛과 흘려보낸 빛이 같은 별자리에 함께 있다**',
    EMOTIONS.every((e) => {
      const group = made.filter((s) => s.emotion === e.type)
      return group.length === 2 && group[0].constellation === group[1].constellation
    }))
  ok('선택이 마음을 바꾸지 않는다',
    made.every((s) => EMOTIONS.some((e) => e.type === s.emotion)))
  ok('마음이 선택을 바꾸지 않는다',
    made.every((s) => s.type === 'keep' || s.type === 'letgo'))

  // 걸음에서도 둘이 따로 움직이는가
  const k = () => useKiosk.getState()
  k().goHome()
  k().setText('두 축을 따로 고른다')
  k().chooseEmotion('anxious')
  ok('마음을 고르면 다음 걸음으로 간다', k().scene === 'choice' && k().emotion === 'anxious')
  k().chooseType('letgo')
  ok('선택을 골라도 마음은 그대로다', k().emotion === 'anxious' && k().type === 'letgo')
  k().back()
  k().chooseEmotion('calm')
  ok('마음을 다시 골라도 선택은 그대로다', k().emotion === 'calm' && k().type === 'letgo')
  k().goHome()
}

/* ── 11-4. 잘못될 때 ─────────────────────────────────── */
section('잘못될 때')
{
  const k = () => useKiosk.getState()

  // 저장소가 막혀 있어도 (사생활 보호 모드 · 용량 초과 · node)
  const blocked = createLocalUniverse(false)
  const { star } = await blocked.add({
    text: '저장소가 막혀 있어도',
    type: 'keep',
    emotion: EMOTIONS[0],
    timeRef: { kind: 'unknown', label: '기억나지 않음' },
    sessionId: 'blocked',
  })
  ok('localStorage가 없어도 빛은 만들어진다', star.id.length > 0)
  ok('그 자리에서는 우주에 남아 있다', blocked.snapshot().length === 1)

  // 저장소가 던질 때
  const original = universe.add
  ;(universe as { add: unknown }).add = async () => {
    throw new Error('저장소가 거절했습니다')
  }
  k().goHome()
  k().setText('보내다 실패하는 시간')
  k().chooseEmotion('sad')
  k().chooseType('keep')
  resetGuardForTest(); await k().send()
  ok('**보내지 못하면 확인 화면으로 돌아온다**', k().scene === 'confirm', `(${k().scene})`)
  ok('빗장이 풀려 다시 시도할 수 있다', k().sending === false)
  ok('무슨 일인지 알려 준다', (k().notice?.text ?? '').includes('다시'))
  ok('적던 것은 지워지지 않는다', k().text === '보내다 실패하는 시간')
  ;(universe as { add: unknown }).add = original

  // 다시 보내면 된다
  resetGuardForTest(); await k().send()
  ok('다시 보내면 간다', k().sent !== null && k().scene === 'sending')
  k().finishSending()
  k().goHome()
}

/* ── 11-5. 다음 관람객을 위해 ────────────────────────── */
section('다음 관람객을 위해')
{
  ok('아무도 손대지 않으면 45초 뒤에 처음으로 돌아간다', IDLE_MS === 45_000, `(${IDLE_MS}ms)`)
  ok('도착 화면은 20초만 머문다', DONE_HOLD_MS === 20_000, `(${DONE_HOLD_MS}ms)`)
}

/* ── 11-6. 보내고 난 뒤, 나의 별로 → 영수증 → 마지막 선택 (화면 순서 재배치) ──── */
section('보내고 난 뒤, 나의 별로')
{
  const k = () => useKiosk.getState()

  /** 한 사람이 처음부터 끝까지 보내는 길 */
  async function sendOne(text: string, emotion: string, type: 'keep' | 'letgo') {
    k().goHome()
    k().setText(text)
    k().chooseEmotion(emotion)
    k().chooseType(type)
    resetGuardForTest(); await k().send()
    k().finishSending()
  }

  await sendOne('초대를 받아 보는 시간', 'happy', 'keep')
  ok('보내면 곧장 나의 별 화면이다 (도착 화면을 거치지 않는다)', k().scene === 'yourStar')
  ok('이 화면이 스스로 도착을 알리므로 doneBeat는 arrived로 남는다', k().doneBeat === 'arrived')
  ok('그 사이 실제 별이 이미 배정되어 있다(동기적으로)', k().yourStar !== null)

  // '나의 별 이야기 보기'를 눌러 이야기를 연 뒤, '나의 별을 기록으로 남기기'를 누른다
  k().goTo('receipt')
  ok('별 이야기를 거쳐야 영수증으로 간다', k().scene === 'receipt')
  ok('영수증으로 가기 전에는 실제 별 소개보다 먼저 뜨지 않는다', k().yourStar !== null)

  // 영수증의 "닫기"를 누른다
  k().goTo('finale')
  ok('영수증을 닫으면 마지막 선택 화면이다', k().scene === 'finale')
  ok('보낸 빛은 그대로 남아 있다', k().sent !== null)

  k().showUniverse()
  ok('"우리의 우주 보기"를 고르면 공동 우주로 간다', k().scene === 'universe')

  // 연타해도 나의 별이 다시 뽑히지 않는다 / 별이 하나만 늘어난다
  const had = k().stars.length
  await sendOne('두 번째로 보내는 시간', 'sad', 'letgo')
  const firstStarId = k().yourStar?.realStarId
  ok('다시 보내도 곧장 나의 별 화면이다', k().scene === 'yourStar' && k().yourStar?.realStarId === firstStarId)
  ok('별이 하나만 늘었다', k().stars.length === had + 1, `(${had} → ${k().stars.length})`)

  // 영수증은 그대로
  const mine = k().sent!
  ok('영수증을 만들 수 있다', mine.seq > 0 && mine.timeRef.label.length > 0)
  ok('영수증에 적힐 것이 다 있다', mine.status === 'arrived' && typeof mine.arrivedAt === 'number')

  // "이대로 마치기" 경로 — 공동 우주를 거치지 않는다
  k().goTo('receipt')
  k().goTo('finale')
  const sentId = mine.id
  k().toCardGuide()
  ok(
    '"이대로 마치기"는 실제 별이 있으면 카드 안내로 간다(공동 우주를 거치지 않는다)',
    k().scene === 'cardGuide',
  )
  k().goHome()
  ok(
    '"이대로 마치기" 뒤에도 보낸 별 기록은 그대로 남는다',
    universe.snapshot().some((one) => one.id === sentId),
  )
  ok('"이대로 마치기" 뒤에도 실제 별 배정 기록은 그대로 남는다', getAssignedStar(sentId) !== null)

  // 처음으로 돌아가면 나의 별도 다음 사람을 위해 지워진다(세션 상태만. 기록은 위에서 확인했듯 남는다)
  const before = k().stars.length
  k().goHome()
  ok('처음으로 돌아가면 박자도 처음으로', k().doneBeat === 'arrived')
  ok('처음으로 돌아가면 나의 별 정보가 지워진다(다음 사람은 새로 배정받는다)', k().yourStar === null)
  ok('적던 것은 지워진다', k().text === '' && k().sent === null)
  ok('보낸 빛은 지워지지 않는다', k().stars.length === before)

  // 물리 버튼도 같은 길을 밟는다 (App이 쓰는 것과 같은 갈림길을 여기서도 밟아 본다)
  function physicalNext() {
    const state = k()
    if (state.scene === 'receipt') state.goTo('finale')
    else if (state.scene === 'finale') state.showUniverse()
    else if (state.scene === 'done') {
      if (state.doneBeat === 'arrived') state.invite()
      else if (state.doneBeat === 'invite') state.showUniverse()
      else state.goHome()
    }
  }

  await sendOne('물리 버튼으로 고르는 시간', 'calm', 'keep')
  ok('보내면 물리 버튼 없이도 바로 나의 별 화면이다', k().scene === 'yourStar')
  k().goTo('receipt')
  physicalNext()
  ok('영수증에서 물리 버튼을 누르면 마지막 선택으로 간다', k().scene === 'finale')
  physicalNext()
  ok('마지막 선택에서 물리 버튼을 누르면 우리의 우주로 간다(묻기 둘 중 긍정 쪽과 같은 자리)', k().scene === 'universe')
  k().goHome()

  // 읽을 시간 — 폴백 경로(아래)에서 여전히 쓰인다
  ok('묻는 동안에는 더 오래 기다린다(폴백 경로에서 쓴다)', INVITE_HOLD_MS > DONE_HOLD_MS,
    `(${INVITE_HOLD_MS}ms vs ${DONE_HOLD_MS}ms)`)
  ok('완료 문장이 머문 뒤에 묻는다 (4초 넘게)', INVITE.afterMs >= 4000, `(${INVITE.afterMs}ms)`)
}

/* ── 11-6-1-2. "우리의 우주 보기" 경로도 같은 카드 안내로 끝난다 ──── */
section('우리의 우주 보기 → 관람 종료 → 카드 안내 (경로 B)')
{
  const k = () => useKiosk.getState()

  k().goHome()
  k().setText('우리의 우주를 보고 가는 시간')
  k().chooseEmotion('calm')
  k().chooseType('keep')
  resetGuardForTest(); await k().send()
  k().finishSending()
  ok('보내면 곧장 나의 별 화면이다', k().scene === 'yourStar')
  const assignedConstellation = k().yourStar?.constellationKorean
  const assignedStarId = k().yourStar?.realStarId
  const sentId = k().sent!.id
  const starsBeforeUniverse = k().stars.length

  k().goTo('receipt')
  k().goTo('finale')
  k().showUniverse()
  ok('"우리의 우주 보기"를 고르면 공동 우주로 간다', k().scene === 'universe')
  ok('공동 우주로 가도 배정된 실제 별 정보가 지워지지 않는다', k().yourStar?.realStarId === assignedStarId)

  /*
   * 공동 우주를 보는 동안에는 별 전송(send)이나 실제 별 배정
   * (assignRealStar)이 다시 일어날 일이 없다 — 관람은 이미 있는
   * `stars`를 읽기만 한다. 별의 수와 나의 별이 그대로인 것으로
   * 이것을 확인한다.
   */
  ok(
    '공동 우주를 보는 동안 별이 다시 생기지 않는다(전송이 중복 실행되지 않는다)',
    k().stars.length === starsBeforeUniverse,
  )

  /*
   * "그만 보기"(다 본 뒤)·"감상 종료"(보는 중) 버튼은 이제 `goHome`이
   * 아니라 `toCardGuide`를 직접 부른다(`StarShowcase.tsx`) — 버튼을
   * 누르는 일 자체는 시뮬레이션할 수 없으므로, 그 버튼이 실제로 부르는
   * 액션을 여기서 직접 불러 같은 효과를 확인한다.
   */
  k().toCardGuide()
  ok('공동 우주 관람을 마치면(그만 보기/감상 종료) 곧바로 처음으로 가지 않고 카드 안내로 간다', k().scene === 'cardGuide')
  ok(
    '카드 안내에는 이번에 실제로 배정된 별자리가 그대로 보인다',
    k().yourStar?.constellationKorean === assignedConstellation,
  )

  // 카드 안내의 "처음으로"
  k().goHome()
  ok('카드 안내를 보고 처음으로 돌아갈 수 있다', k().scene === 'attract')
  ok('"우리의 우주 보기" 경로를 다 거쳐도 보낸 별 기록은 남는다', universe.snapshot().some((one) => one.id === sentId))
  ok('"우리의 우주 보기" 경로를 다 거쳐도 실제 별 배정 기록은 남는다', getAssignedStar(sentId) !== null)
}

/* ── 11-6-2. 폴백 — 실제 별 배정이 안 되어 있으면 옛 초대 흐름으로 ──── */
section('폴백 — 실제 별이 없을 때')
{
  const k = () => useKiosk.getState()

  /*
   * 검증된 별이 하나도 없는, 있어서는 안 되는 경우를 흉내 낸다 —
   * `finishSending()`이 정상적으로 배정한 뒤, 그 결과만 지운다.
   * §1이 요구한 "전송 실패나 타임아웃 시 기존 폴백 정책을 따르기"를
   * 그대로 확인한다 — 새 폴백을 만들지 않고 원래 있던 초대 흐름을 쓴다.
   */
  k().goHome()
  k().setText('배정 실패를 흉내내는 시간')
  k().chooseEmotion('calm')
  k().chooseType('keep')
  resetGuardForTest(); await k().send()
  k().finishSending()
  // markArrived().then(...)이 sent.status를 'arrived'로 바꾸는 것까지 기다린다.
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
  ok('정상적으로는 나의 별이 배정되어 있다', k().yourStar !== null)
  ok('정상 경로에서는 곧장 나의 별 화면으로 간다', k().scene === 'yourStar')
  /*
   * 검증된 별이 하나도 없는, 있어서는 안 되는 경우를 흉내 낸다 —
   * `finishSending()`의 else 분기가 실제로 만드는 상태(yourStar: null,
   * scene: 'done')로 그대로 되돌린다.
   */
  useKiosk.setState({ yourStar: null, scene: 'done' })
  ok('이제 나의 별이 없는 상태를 흉내 냈다', k().yourStar === null && k().scene === 'done')

  k().invite()
  ok('실제 별이 없으면 옛 묻는 자리(doneBeat invite)로 돌아간다', k().doneBeat === 'invite')
  ok('**나의 별 화면으로 건너가지 않는다**', k().scene === 'done')

  k().showUniverse()
  ok('그 자리에서도 예를 고르면 우리의 우주로 간다', k().scene === 'universe')

  // 아니요
  k().goHome()
  k().setText('아니요를 고르는 시간')
  k().chooseEmotion('sad')
  k().chooseType('letgo')
  resetGuardForTest(); await k().send()
  k().finishSending()
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0))
  useKiosk.setState({ yourStar: null, scene: 'done' })
  k().invite()
  k().declineUniverse()
  ok('아니요를 고르면 머문다(폴백 경로)', k().doneBeat === 'stayed' && k().scene === 'done')
  ok('보낸 일은 끝난 그대로다', k().sent !== null && k().sent?.status === 'arrived')

  k().invite()
  ok('보지 않겠다고 한 사람에게 다시 묻지 않는다', k().doneBeat === 'stayed')

  k().goHome()
}

/* ── 11-7. 남의 이야기는 동의한 것만 ─────────────────── */
section('남의 이야기')
{
  // `sent`는 닿은 것으로 표시된 빛들이다 (`many`는 아직 건너가는 중이라 쓰지 않는다)
  const sample = sent.slice(0, 20)
  ok('**지금은 공개된 이야기가 하나도 없다**', consentedStories(sample).length === 0)
  ok('동의가 적혀 있지 않으면 보여 주지 않는다',
    consentedStories(sample.map((s) => ({ ...s, shared: undefined }))).length === 0)
  ok('동의하지 않았다고 적혀 있으면 보여 주지 않는다',
    consentedStories(sample.map((s) => ({ ...s, shared: false }))).length === 0)
  const three = consentedStories(sample.map((s, i) => ({ ...s, shared: i < 3, status: 'arrived' as const })))
  ok('동의한 것만 보여 준다', three.length === 3, `(${three.length}개)`)
  ok('아직 닿지 않은 빛은 동의했어도 보여 주지 않는다',
    consentedStories(sample.map((s) => ({ ...s, shared: true, status: 'sending' as const }))).length === 0)
  ok('깨진 값은 동의로 보지 않는다',
    consentedStories(sample.map((s) => ({ ...s, shared: 'yes' as unknown as boolean }))).length === 0)
}

/* ── 11-8. 열 개를 고른다 ────────────────────────────── */
section('들여다볼 열 개를 고른다')
{
  const pool = sent.map((star) => ({ ...star, status: 'arrived' as const }))

  const ten = pickShowcase(pool, { seed: 1234 })
  ok('열 개를 고른다', ten.length === SHOWCASE_SIZE, `(${ten.length}개)`)
  ok('**같은 별이 두 번 뽑히지 않는다**', new Set(ten.map((s) => s.id)).size === ten.length)
  ok('**없는 별을 지어내지 않는다**', ten.every((s) => pool.some((p) => p.id === s.id)))
  ok('닿은 빛만 고른다', ten.every((s) => s.status === 'arrived'))

  // 여러 번 뽑아도 언제나 중복이 없다
  let duplicated = 0
  for (let seed = 0; seed < 200; seed += 1) {
    const draw = pickShowcase(pool, { seed })
    if (new Set(draw.map((s) => s.id)).size !== draw.length) duplicated += 1
  }
  ok('200번 뽑아도 한 번도 겹치지 않는다', duplicated === 0, `(겹친 횟수 ${duplicated})`)

  // 무작위인가 — 씨앗이 다르면 다른 열 개가 나온다
  const a = pickShowcase(pool, { seed: 1 }).map((s) => s.id).join(',')
  const b = pickShowcase(pool, { seed: 2 }).map((s) => s.id).join(',')
  ok('무작위로 고른다', a !== b)

  // 열보다 적을 때
  const few = pool.slice(0, 4)
  const picked = pickShowcase(few, { seed: 7 })
  ok('열보다 적으면 있는 만큼만 보여 준다', picked.length === 4, `(${picked.length}개)`)
  ok('모자란 자리를 가짜로 채우지 않는다', picked.every((s) => few.some((f) => f.id === s.id)))
  ok('하나도 없으면 빈 채로 둔다', pickShowcase([], { seed: 1 }).length === 0)

  // 아직 건너가는 중인 빛은 넣지 않는다
  const flying = pool.map((s) => ({ ...s, status: 'sending' as const }))
  ok('건너가는 중인 빛은 고르지 않는다', pickShowcase(flying, { seed: 3 }).length === 0)

  // 흩어진 자리
  const spots = scatterShowcase(ten)
  ok('열 개 모두 자리를 받는다', spots.length === ten.length)
  ok('모두 화면 안에 있다',
    spots.every((spot) => spot.x > 0.02 && spot.x < 0.98 && spot.y > 0.02 && spot.y < 0.98))
  ok('크기가 조금씩 다르다', new Set(spots.map((s) => s.scale.toFixed(3))).size > 1)
  ok('떠 있는 움직임의 폭이 조금씩 다르다', new Set(spots.map((s) => s.sway.toFixed(2))).size > 1)
  function tightest(list: ReadonlyArray<{ x: number; y: number }>): number {
    let min = Infinity
    for (let i = 0; i < list.length; i += 1)
      for (let j = i + 1; j < list.length; j += 1)
        min = Math.min(min, Math.hypot(list[i].x - list[j].x, list[i].y - list[j].y))
    return min
  }
  ok('한 자리에 둘이 겹치지 않는다', tightest(spots) >= 0.1,
    `(가장 가까운 둘 ${tightest(spots).toFixed(3)})`)
  ok('가운데는 비워 둔다 (곧 별 하나가 올 자리)',
    spots.every((spot) => Math.hypot(spot.x - 0.5, spot.y - 0.46) >= 0.135))

  // 여러 벌을 뽑아도 언제나 풀린다
  let crowded = 0
  let worst = Infinity
  for (let seed = 0; seed < 300; seed += 1) {
    const draw = scatterShowcase(pickShowcase(pool, { seed }))
    const near = tightest(draw)
    worst = Math.min(worst, near)
    if (near < 0.1) crowded += 1
  }
  ok('300벌을 뽑아도 한 번도 겹치지 않는다', crowded === 0,
    `(겹친 벌 ${crowded} · 가장 가까웠던 둘 ${worst.toFixed(3)})`)
  console.log(`      300벌 중 가장 가까웠던 두 별: ${worst.toFixed(3)}`)

  // 같은 별은 언제 보아도 같은 자리에 선다
  const again = scatterShowcase(ten)
  ok('같은 별은 같은 자리에 선다',
    spots.every((spot, i) => spot.x === again[i].x && spot.y === again[i].y))
}

/* ── 11-9. 별에 담긴 내용 ────────────────────────────── */
section('별에 담긴 내용')
{
  const one = { ...sent[0], text: '남이 적은 한 문장', sessionId: 'someone', status: 'arrived' as const }

  const stranger = contentOf(one, 'me')
  ok('**동의하지 않은 남의 글은 보여 주지 않는다**', stranger.text === null)
  ok('그 까닭을 알고 있다', stranger.reason === 'private')
  ok('고른 항목은 보여 준다',
    stranger.emotion.label.length > 0 && stranger.how.length > 0 && stranger.when.length > 0)
  ok('마음과 간직/흘려보내기가 함께 보인다',
    EMOTIONS.some((e) => e.label === stranger.emotion.label) &&
    ['간직한 시간', '흘려보낸 시간'].includes(stranger.how))
  ok('번호는 보여 준다', stranger.seq === one.seq)

  const shared = contentOf({ ...one, shared: true }, 'me')
  ok('공개에 동의한 글은 보여 준다', shared.text === '남이 적은 한 문장')
  ok('그 까닭도 알고 있다', shared.reason === 'shared')

  const mine = contentOf(one, 'someone')
  ok('자기 별의 글은 자기에게 보인다', mine.text === '남이 적은 한 문장')
  ok('자기 별이라고 알려 준다', mine.reason === 'mine')

  ok('이름도 연락처도 애초에 담기지 않는다',
    !('name' in stranger) && !('sessionId' in stranger) && !('contact' in stranger))
}

/* ── 11-10. 열 개를 하나씩 들여다보는 흐름 ──────────── */
section('열 개를 하나씩 들여다본다')
{
  const k = () => useKiosk.getState()
  k().goHome()
  // 이 검증은 store의 우주를 쓴다. 비어 있지 않은지부터 본다.
  const have = k().stars.filter((s) => s.status === 'arrived').length
  ok('우주에 들여다볼 빛이 있다', have > 0, `(${have}개)`)

  k().showUniverse()
  ok('우리의 우주로 간다', k().scene === 'universe')
  ok('들어서면 열 개를 고른다', k().viewIds.length === Math.min(SHOWCASE_SIZE, have),
    `(${k().viewIds.length}개)`)
  ok('고른 열 개가 겹치지 않는다', new Set(k().viewIds).size === k().viewIds.length)
  ok('**처음에는 흩어져 있다**', k().viewIndex === -1)

  const ids = [...k().viewIds]
  k().nextStar()
  ok('첫 별이 가운데로 온다', k().viewIndex === 0)
  k().nextStar()
  ok('그다음 별로 이어진다', k().viewIndex === 1)

  // 끝까지
  while (k().viewIndex < ids.length) k().nextStar()
  ok('마지막까지 한 번씩 지나간다', k().viewIndex === ids.length)
  ok('목록은 보는 동안 바뀌지 않는다', k().viewIds.join(',') === ids.join(','))

  k().nextStar()
  ok('다 본 뒤에는 더 가지 않는다', k().viewIndex === ids.length)

  k().replayViewing()
  ok('다시 보기를 고르면 흩어진 하늘로 돌아간다', k().viewIndex === -1)
  ok('같은 열 개를 다시 본다', k().viewIds.join(',') === ids.join(','))

  k().goHome()
  ok('그만 보면 처음으로 돌아간다', k().scene === 'attract')
  ok('들여다보던 것도 함께 지워진다', k().viewIds.length === 0 && k().viewIndex === -1)
  ok('보낸 빛은 지워지지 않는다', k().stars.length === have || k().stars.length > 0)
}

/* ── 11-11. 스스로 넘어가는 박자 ─────────────────────── */
section('스스로 넘어가는 박자')
{
  /*
   * **한 별에 8초**가 기준이다.
   *
   * 처음에는 12.6~16.6초였다. 서서 보기에 너무 느렸다 —
   * 별이 넘어가기를 기다리게 되면 그건 감상이 아니라 대기다.
   */
  ok('한 별의 기준이 8초다', STEP_TARGET_MS === 8000, `(${STEP_TARGET_MS}ms)`)
  ok('**짧은 글에서는 정확히 8초다**', stepFor(null) === STEP_TARGET_MS,
    `(${stepFor(null)}ms)`)

  const short = holdFor('짧은 기록')
  const long = holdFor('가'.repeat(80))
  ok('공개되지 않은 별도 읽는 만큼은 머문다', holdFor(null) === VIEWING.readMinMs)
  ok('글이 비어 있어도 마찬가지', holdFor('') === VIEWING.readMinMs)
  ok('긴 글은 조금 더 머문다', long === VIEWING.readMaxMs, `(${long}ms)`)
  ok('**긴 글이 짧은 글보다 오래 머문다**', long > short, `(${short} → ${long})`)
  ok('아무리 길어도 더 늘어나지는 않는다', holdFor('가'.repeat(500)) === VIEWING.readMaxMs)

  // 고르게 늘어나는가
  let rises = true
  let was = 0
  for (let n = 0; n <= 80; n += 8) {
    const hold = holdFor('가'.repeat(n))
    if (hold < was) rises = false
    was = hold
  }
  ok('글자 수에 따라 고르게 늘어난다', rises)

  /*
   * 네 토막이 겹치지 않는가.
   * 다가옴 → 자리잡음 → 떠오름 → 읽음, 이 차례가 지켜져야 한다.
   */
  ok('글은 별이 다 온 뒤에 떠오른다', TELL_AT >= VIEWING.travelMs,
    `(별 ${VIEWING.travelMs}ms · 글 ${TELL_AT}ms)`)
  ok('읽는 시간은 글이 다 떠오른 뒤부터다',
    stepFor('가') - holdFor('가') === TELL_AT + VIEWING.tellFadeMs)

  const quick = stepFor(null)
  const slow = stepFor('가'.repeat(80))
  ok('**가장 긴 글이어도 9.5초를 넘지 않는다**', slow <= 9_500, `(${slow}ms)`)
  ok('그래도 너무 빨리 넘기지는 않는다', quick >= 7_000, `(${quick}ms)`)
  ok('긴 글이 짧은 글보다 오래 머문다 (앞서 확인한 것과 같다)', slow > quick)
  console.log(`      한 별: ${(quick / 1000).toFixed(1)}~${(slow / 1000).toFixed(1)}초 · 열 개: ${((quick * 10) / 1000).toFixed(0)}~${((slow * 10) / 1000).toFixed(0)}초`)

  ok('박자를 고치는 곳이 한곳이다',
    typeof VIEWING.travelMs === 'number' && typeof VIEWING.readMinMs === 'number')
}

/* ── 11-12. 빛이 늦게 와도 ───────────────────────────── */
section('빛이 늦게 와도')
{
  const k = () => useKiosk.getState()

  // 아직 아무것도 닿지 않았을 때
  const flying = sent.slice(0, 5).map((one) => ({ ...one, status: 'sending' as const }))
  k().syncUniverse(flying)
  k().startViewing()
  ok('닿은 빛이 없으면 아무것도 고르지 않는다', k().viewIds.length === 0)
  ok('그래도 오류가 나지 않는다', true)
  ok('흩어진 자리에 머문다', k().viewIndex === -1)

  k().nextStar()
  ok('**고른 것이 없으면 넘어가지도 않는다**', k().viewIndex === -1)

  // 빛이 뒤늦게 닿았다
  k().syncUniverse(sent.slice(0, 5).map((one) => ({ ...one, status: 'arrived' as const })))
  k().startViewing()
  ok('뒤늦게 닿은 빛으로 고른다', k().viewIds.length === 5, `(${k().viewIds.length}개)`)

  // 열보다 적어도 끝까지 간다
  while (k().viewIndex < k().viewIds.length) k().nextStar()
  ok('다섯 개뿐이어도 끝까지 간다', k().viewIndex === 5)

  k().goHome()
  ok('나가면 고른 것도 지워진다', k().viewIds.length === 0 && k().viewIndex === -1)
}

/* ── 12. 별자리의 선 ─────────────────────────────────── */
section('별자리의 선')

function nodesFrom(list: ReadonlyArray<UniverseStar>, w = 1280, h = 800): LinkNode[] {
  return list.map((star) => ({
    id: star.id,
    x: star.x * w,
    y: star.y * h,
    type: star.type,
    constellation: star.constellation,
    radius: 6,
    links: [],
    degree: 0,
  }))
}

const web = nodesFrom(many)
growLinks(web, { radius: Math.min(1280, 800) * 0.34, linkMax: 2 })
const byId = new Map(web.map((n) => [n.id, n]))

ok('한 별이 이은 선은 둘을 넘지 않는다', web.every((n) => n.degree <= 2),
  `(가장 많은 별 ${Math.max(...web.map((n) => n.degree))}개)`)
ok('다른 별자리끼리는 잇지 않는다',
  web.every((n) => n.links.every((id) => byId.get(id)!.constellation === n.constellation)))
ok('흘려보낸 빛은 선을 받지 않는다',
  web.every((n) => (n.type === 'letgo' ? n.links.length === 0 : true)) &&
  web.every((n) => n.links.every((id) => byId.get(id)!.type === 'keep')))
ok('선이 하나도 없지는 않다', web.some((n) => n.links.length > 0),
  `(선 ${web.reduce((sum, n) => sum + n.links.length, 0)}개)`)

// 이미 그어진 선은 지워지지 않는다 — 빛을 더 넣고 다시 자라게 해 본다
const drawnBefore = web.map((n) => ({ id: n.id, links: [...n.links] }))
const grown = [...web, ...nodesFrom(sent.slice(0, 40))]
growLinks(grown, { radius: Math.min(1280, 800) * 0.34, linkMax: 2 })
const nowById = new Map(grown.map((n) => [n.id, n]))
ok('새 빛이 와도 이미 그어진 선은 그대로다',
  drawnBefore.every((was) => was.links.every((id) => nowById.get(was.id)!.links.includes(id))))
ok('새 빛이 오면 별자리가 자란다',
  grown.reduce((sum, n) => sum + n.links.length, 0) >
    web.reduce((sum, n) => sum + n.links.length, 0))

/* ── 결과 ────────────────────────────────────────────── */
console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
