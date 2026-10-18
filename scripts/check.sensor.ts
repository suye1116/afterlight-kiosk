/**
 * 손 감지 센서의 순수한 셈이 맞게 도는가.
 *
 * 캔버스도 네트워크도 아두이노도 없이, node로 바로 돌려 본다.
 * (`src/lib/sensorGate.ts`)
 */
import {
  applyDistance,
  FAR_CM,
  HOLD_MS,
  INITIAL_GATE_STATE,
  isDisconnected,
  LEAVE_GRACE_MS,
  NEAR_CM,
  STALE_MS,
  type SensorGateState,
} from '@/lib/sensorGate'

let pass = 0
let fail = 0
function ok(name: string, condition: boolean, extra = '') {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`) }
  else { fail += 1; console.log(`  ✗ ${name} ${extra}`) }
}
function section(name: string) { console.log(`\n${name}`) }

/** 거리 하나를 밀어 넣고 결과를 돌려주는 작은 도구 */
function feed(state: SensorGateState, cm: number, now: number) {
  return applyDistance(state, cm, now)
}

section('멀리 있을 때')
{
  const far = feed(INITIAL_GATE_STATE, 80, 0)
  ok('가깝지 않다', far.state.near === false)
  ok('보유 진행률이 0이다', far.progress === 0)
  ok('트리거되지 않는다', far.triggered === false)
}

section('가까워지지만 1초을 채우지 못하면')
{
  let state = INITIAL_GATE_STATE
  const near = feed(state, NEAR_CM - 1, 1000)
  state = near.state
  ok('가까워졌다고 본다', state.near === true)
  ok('이 순간 보유 진행률은 0에 가깝다', near.progress < 0.1)

  const soon = feed(state, NEAR_CM - 1, 1000 + HOLD_MS - 50)
  ok('아직 보유하지 못했다', soon.triggered === false)
  ok('진행률이 1보다 작다', soon.progress < 1)
}

section('1초을 채우면 트리거된다')
{
  let state = INITIAL_GATE_STATE
  state = feed(state, NEAR_CM - 1, 1000).state
  const full = feed(state, NEAR_CM - 1, 1000 + HOLD_MS)
  ok('딱 1초가 되면 트리거된다', full.triggered === true)
  ok('진행률이 1이다', full.progress === 1)
}

section('한 보유에서는 두 번 트리거하지 않는다')
{
  let state = INITIAL_GATE_STATE
  state = feed(state, NEAR_CM - 1, 1000).state
  const first = feed(state, NEAR_CM - 1, 1000 + HOLD_MS)
  state = first.state
  ok('처음엔 트리거된다', first.triggered === true)

  const again = feed(state, NEAR_CM - 1, 1000 + HOLD_MS + 500)
  ok('계속 가까워도 다시 트리거하지 않는다', again.triggered === false)
}

section('손을 떼야 다음 전송이 다시 열린다')
{
  let state = INITIAL_GATE_STATE
  state = feed(state, NEAR_CM - 1, 1000).state
  state = feed(state, NEAR_CM - 1, 1000 + HOLD_MS).state
  ok('무장이 풀렸다', state.armed === false)

  // 경계 안(FAR_CM 이하)에서는 아직 멀어진 것으로 보지 않는다 (히스테리시스)
  const stillClose = feed(state, FAR_CM, 2200)
  ok('경계 안에서는 가까운 채로 남는다', stillClose.state.near === true)
  ok('그래도 다시 트리거하지 않는다', stillClose.triggered === false)

  // 경계를 넘어도 LEAVE_GRACE_MS가 지나야 "진짜로 떠난 것"으로 본다
  const justLeft = feed(stillClose.state, FAR_CM + 1, 2300)
  ok('경계를 넘은 순간에는 아직 유예 중이다', justLeft.state.near === true)
  const left = feed(justLeft.state, FAR_CM + 1, 2300 + LEAVE_GRACE_MS + 10)
  ok('유예가 끝나면 멀어진 것으로 본다', left.state.near === false)
  ok('무장이 다시 걸린다', left.state.armed === true)

  const resumeAt = 2300 + LEAVE_GRACE_MS + 50
  const again = feed(left.state, NEAR_CM - 1, resumeAt)
  const full = feed(again.state, NEAR_CM - 1, resumeAt + HOLD_MS)
  ok('다시 1초를 채우면 또 트리거된다', full.triggered === true)
}

section('히스테리시스 — 경계에서 떨려도 보유가 끊기지 않는다')
{
  let state = INITIAL_GATE_STATE
  state = feed(state, NEAR_CM - 1, 0).state
  // NEAR_CM과 FAR_CM 사이를 오가도(결코 FAR_CM을 넘지 않는다) 계속 가깝다
  let triggeredDuring = false
  for (let t = 100; t <= HOLD_MS; t += 100) {
    const cm = t % 200 === 0 ? NEAR_CM + 2 : NEAR_CM - 3
    const result = feed(state, cm, t)
    state = result.state
    if (result.triggered) triggeredDuring = true
  }
  ok('경계에서 떨려도 보유가 끊기지 않아 결국 트리거된다', triggeredDuring === true)
}

section('단 한 번 튄 값 — HC-SR04가 가끔 에코를 놓쳐도 보유가 끊기지 않는다')
{
  let state = INITIAL_GATE_STATE
  state = feed(state, NEAR_CM - 1, 0).state
  // 보유 중간에 딱 한 번, 유예 시간보다 짧게 멀리 읽힌다
  const blip = feed(state, FAR_CM + 50, 500)
  ok('튄 값 한 번으로는 즉시 멀어진 것으로 보지 않는다', blip.state.near === true)
  state = blip.state
  // 곧바로 다시 가까운 값이 온다 — 진짜로 떠난 게 아니었다
  state = feed(state, NEAR_CM - 1, 500 + Math.floor(LEAVE_GRACE_MS / 2)).state
  const full = feed(state, NEAR_CM - 1, HOLD_MS + 10)
  ok('보유 시계가 처음부터 다시 시작되지 않고 결국 트리거된다', full.triggered === true)
}

section('정말로 멀어진 것은 유예가 끝나면 인정한다')
{
  let state = INITIAL_GATE_STATE
  state = feed(state, NEAR_CM - 1, 0).state
  state = feed(state, FAR_CM + 50, 500).state
  // 유예 시간을 넘길 때까지 계속 멀다 — 이번엔 진짜다
  const left = feed(state, FAR_CM + 50, 500 + LEAVE_GRACE_MS + 10)
  ok('유예를 넘겨 계속 멀면 진짜로 떠난 것으로 본다', left.state.near === false)
  ok('무장이 다시 걸린다', left.state.armed === true)
}

section('끊김 판정 — 한 번도 못 받은 것은 끊긴 것이 아니다')
{
  ok('아예 받은 적이 없으면 끊긴 것으로 보지 않는다 (다리·아두이노 없이 열어 봤을 때)',
    isDisconnected(null, 0) === false)
  ok('방금 받았으면 끊긴 것이 아니다',
    isDisconnected({ cm: 10, at: 1000 }, 1000) === false)
  ok('STALE_MS 안이면 아직 끊긴 것이 아니다',
    isDisconnected({ cm: 10, at: 1000 }, 1000 + STALE_MS - 1) === false)
  ok('STALE_MS를 넘기면 끊긴 것으로 본다 — 한 번은 받았는데 멈췄다',
    isDisconnected({ cm: 10, at: 1000 }, 1000 + STALE_MS + 1) === true)
}

console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
