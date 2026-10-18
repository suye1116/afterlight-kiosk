import { useRef, useState } from 'react'
import { useBridge } from '@/store/useBridge'
import { FAR_CM, NEAR_CM } from '@/lib/sensorGate'
import styles from './SensorPanel.module.css'

/**
 * 손 감지 센서 시뮬레이션.
 *
 * ─── 전시 빌드에는 나오지 않는다 ───────────────────────
 *  `TestPanel`·`BridgePanel`과 같은 자리에서만 그려진다(`isTestMode()`).
 *  실제 아두이노도, 다리조차 없이 `SceneConfirm`의 센서 흐름(`SensorGate`)을
 *  처음부터 끝까지 확인할 수 있어야 한다 — 그래서 다리를 거치지 않고
 *  `useBridge.setSensor()`를 곧바로 부른다. 실제 센서가 다리를 거쳐 쓰는
 *  자리와 같은 자리이므로, `SensorGate`는 둘을 가리지 않는다.
 * ───────────────────────────────────────────────────────
 *
 * 누르고 있는 동안 "가깝다"를 계속 보낸다 — 진짜 센서처럼 쉬지 않고
 * 거리를 올려 보내야 1초 보유 판정이 제대로 걸린다. 떼면 "멀다"로 되돌린다.
 */
const STREAM_MS = 100

export function SensorPanel() {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const [holding, setHolding] = useState(false)

  function start() {
    if (timer.current) return
    setHolding(true)
    useBridge.getState().setSensor(NEAR_CM - 5)
    timer.current = setInterval(() => useBridge.getState().setSensor(NEAR_CM - 5), STREAM_MS)
  }

  function stop() {
    if (timer.current) {
      clearInterval(timer.current)
      timer.current = null
    }
    setHolding(false)
    useBridge.getState().setSensor(FAR_CM + 10)
  }

  return (
    <aside className={styles.panel} aria-label="센서 시뮬레이션">
      <p className={styles.title}>센서 시뮬레이션</p>
      <button
        type="button"
        className={`${styles.hold} ${holding ? styles.holdOn : ''}`}
        onPointerDown={start}
        onPointerUp={stop}
        onPointerLeave={stop}
        onPointerCancel={stop}
      >
        {holding ? '손이 가깝습니다…' : '누르고 있기 (손 가까이)'}
      </button>
      <p className={styles.note}>전시 빌드에는 나오지 않습니다.</p>
    </aside>
  )
}
