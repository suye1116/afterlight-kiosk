import { useRef } from 'react'
import { useKiosk } from '@/store/useKiosk'
import styles from './OperatorOverride.module.css'

/**
 * 운영자용 수동 전송.
 *
 * ─── 관객에게는 보이지 않는다 ──────────────────────────
 *  `isTestMode()`로 가리지 않는다 — 이건 개발용이 아니라 **전시 중**에
 *  운영자가 쓰는 길이다. 다만 화면에 아무런 자국도 남기지 않는다(투명,
 *  안내 없음, `aria-hidden`) — 센서가 먼지·각도·배터리 문제로 오작동할 때,
 *  관객의 기록을 놓치지 않고 운영자가 대신 보낼 수 있는 자리다.
 * ───────────────────────────────────────────────────────
 *
 * 화면 오른쪽 위 구석을 **1.5초 길게 눌러야** 동작한다 — 실수로 스친
 * 손가락이나 화면을 닦는 손길로는 걸리지 않을 만큼 길게 둔다.
 * `SensorGate`와 똑같이 `useKiosk.send()`를 그대로 부르므로, 별을
 * 만들고 장면을 옮기는 일은 센서로 보낼 때와 완전히 같다.
 */
const HOLD_MS = 1500

export function OperatorOverride() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  function start() {
    if (timer.current) return
    timer.current = setTimeout(() => {
      timer.current = null
      if (!useKiosk.getState().sending) void useKiosk.getState().send()
    }, HOLD_MS)
  }

  function cancel() {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
  }

  return (
    <button
      type="button"
      className={styles.hidden}
      aria-hidden="true"
      tabIndex={-1}
      onPointerDown={start}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onContextMenu={(event) => event.preventDefault()}
    />
  )
}
