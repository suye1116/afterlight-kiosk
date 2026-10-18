/**
 * 손 감지 센서의 거리를 "보냈다"로 바꾸는 순수한 셈.
 *
 * ─── 왜 여기 있는가 ─────────────────────────────────────
 *  아두이노와 다리는 거리값만 나른다(`server/arduino.js`,
 *  `server/protocol.js`의 `sensor.proximity`). "가깝다"의 판정, 1초를
 *  보유해야 보내지는지, 손을 떼야 다음 전송이 다시 열리는지 —
 *  이 모두는 **하늘의 일**이고, 그 일이 전부 이 파일에 있다.
 *
 *  캔버스도 네트워크도 없는 순수 함수다. `scripts/check.sensor.ts`가
 *  node로 그대로 돌려 확인한다(`lib/starMath.ts`·`lib/constellationLinks.ts`와
 *  같은 결).
 * ───────────────────────────────────────────────────────
 */

/** 이 거리(cm) 안이면 "가깝다"로 본다 */
export const NEAR_CM = 15
/**
 * 이 거리를 넘어야 "멀다"로 돌아간다.
 *
 * `NEAR_CM`보다 큰 값을 둔다(히스테리시스) — 손이 경계에서 떨릴 때
 * 가깝다/멀다가 매 순간 뒤집히며 보유 시간이 계속 끊기지 않게 한다.
 */
export const FAR_CM = 20
/** 이만큼 가깝게 유지해야 전송이 시작된다(ms) */
export const HOLD_MS = 1000
/** 이보다 오래 새 거리가 오지 않으면 센서가 끊긴 것으로 본다(ms) */
export const STALE_MS = 1500
/**
 * "멀어졌다"로 확정하기 전에 두는 유예(ms).
 *
 * HC-SR04는 가끔 에코를 놓쳐 거리를 한 번씩 튀게 읽는다(초음파가 흡수되거나
 * 비껴가는 각도일 때 흔하다). 손이 그대로 있는데 **단 한 번의 튄 값** 때문에
 * 1초 보유가 처음부터 다시 시작되면, 실제로는 멀쩡한 손짓도 좀처럼
 * 전송되지 않는다. 그래서 "멀다"가 이 시간만큼 **이어져야** 진짜로
 * 떠난 것으로 본다. "가깝다"로 들어올 때는 유예를 두지 않는다 —
 * 반응이 늦어 보이면 안 되는 쪽은 그쪽이 아니다.
 */
export const LEAVE_GRACE_MS = 250

export interface SensorGateState {
  /** 지금 손이 가까운가 (히스테리시스 + 유예로 판정한 값) */
  near: boolean
  /** 가까워지기 시작한 때(ms). 가깝지 않으면 null. */
  nearSince: number | null
  /** 가까운 상태에서 "멀다"가 보이기 시작한 때(ms). 아니면 null. */
  farSince: number | null
  /** 이번 보유에서 이미 한 번 트리거했는가 — 한 보유에 두 번 보내지 않는다 */
  firedThisHold: boolean
  /** 손을 뗀 뒤에만 다음 전송이 다시 열린다 */
  armed: boolean
}

export const INITIAL_GATE_STATE: SensorGateState = {
  near: false,
  nearSince: null,
  farSince: null,
  firedThisHold: false,
  armed: true,
}

export interface GateResult {
  state: SensorGateState
  /** 0(멀다)~1(다 보유했다). 화면의 밝기 등에 그대로 쓸 수 있다. */
  progress: number
  /** 이번 호출에서 막 트리거되었는가 — true는 한 번만 온다 */
  triggered: boolean
}

/**
 * 거리 하나를 적용해 다음 상태를 얻는다.
 *
 * 매번 전체 상태를 돌려준다(리듀서와 같은 모양) — 호출하는 쪽이
 * 들고 있던 상태를 그대로 다음 호출에 넘기면 된다.
 */
export function applyDistance(state: SensorGateState, cm: number, now: number): GateResult {
  const wasNear = state.near
  let near = state.near
  let farSince = state.farSince

  if (!near) {
    // 가까워지는 데는 유예를 두지 않는다 — 늦게 반응하면 안 되는 쪽은 이쪽이다
    if (cm <= NEAR_CM) {
      near = true
      farSince = null
    }
  } else if (cm > FAR_CM) {
    // "멀다"가 LEAVE_GRACE_MS만큼 이어져야 진짜로 떠난 것으로 본다
    farSince ??= now
    if (now - farSince >= LEAVE_GRACE_MS) near = false
  } else {
    // 다시 가까워졌다 — 튄 값이었다. 유예를 지운다
    farSince = null
  }

  let nearSince = state.nearSince
  let armed = state.armed
  let firedThisHold = state.firedThisHold

  if (near && !wasNear) {
    // 막 가까워졌다 — 이 보유의 시작
    nearSince = now
    firedThisHold = false
  }
  if (!near) {
    // 멀어졌다(또는 아직 한 번도 가까웠던 적이 없다) — 다음 보유를 다시 연다
    nearSince = null
    farSince = null
    firedThisHold = false
    armed = true
  }

  const heldMs = near && nearSince !== null ? now - nearSince : 0
  const progress = near ? Math.min(1, heldMs / HOLD_MS) : 0

  let triggered = false
  if (near && armed && !firedThisHold && heldMs >= HOLD_MS) {
    triggered = true
    firedThisHold = true
    // 트리거한 뒤에는 손을 떼기 전까지 다시 트리거하지 않는다
    armed = false
  }

  return { state: { near, nearSince, farSince, firedThisHold, armed }, progress, triggered }
}

/** 센서가 마지막으로 알려 온 거리 한 장. */
export interface SensorReading {
  cm: number
  /** 받은 때(ms, epoch) */
  at: number
}

/**
 * 끊겼다고 볼 것인가.
 *
 * **한 번도 받은 적이 없는 것은 "끊겼다"가 아니다.** 다리·아두이노가
 * 아직 하나도 없을 때도(예: 그냥 `npm run dev`로 열어 봤을 때) 이 판정이
 * `true`가 되면, 평소의 "손을 가까이 가져가 주세요" 안내가 뜨지 않고
 * 대신 "연결이 끊겼습니다"만 보이게 된다 — 전시 장비 없이 웹사이트를
 * 열었을 때 안내문이 안 보인다는 혼란이 바로 이 지점에서 생긴다.
 *
 * 받던 신호가 `STALE_MS`보다 오래 멈췄을 때만 끊긴 것으로 본다 —
 * 실제 전시 중 아두이노가 빠지거나 다리가 죽는 경우를 알리기 위한 것이다.
 */
export function isDisconnected(sensor: SensorReading | null, now: number): boolean {
  return sensor !== null && now - sensor.at > STALE_MS
}
