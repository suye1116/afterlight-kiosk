import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useBridge } from '@/store/useBridge'
import { useKiosk } from '@/store/useKiosk'
import { SENSOR } from '@/constants/text.exhibit'
import {
  applyDistance,
  FAR_CM,
  INITIAL_GATE_STATE,
  isDisconnected,
  type SensorGateState,
} from '@/lib/sensorGate'
import styles from './SensorGate.module.css'

/**
 * 손 감지 센서로 별을 보내는 자리.
 *
 * `SceneConfirm`에만 꽂힌다 — **그 장면에 있을 때만 이 컴포넌트가 떠 있고**,
 * 그래서 다른 장면에 있는 동안 센서가 손을 보더라도 아무 일도 일어나지
 * 않는다(§2의 요구). 거리의 판정(가깝다 · 1초 보유 · 손을 떼야 재무장)은
 * 전부 `lib/sensorGate.ts`의 순수한 셈에 맡긴다 — 이 컴포넌트는 그 셈을
 * 일정한 틱으로 돌리고, 결과를 글과 빛으로 보여줄 뿐이다.
 *
 * 트리거되면 기존 `useKiosk.send()`를 그대로 부른다 — 별을 만들고 장면을
 * 옮기는 일은 바뀌지 않는다. 연타 방지는 `lib/sensorGate.ts`의
 * `armed`/`firedThisHold`(한 보유에 한 번, 손을 떼야 재무장)와 store의
 * `sending` 빗장, 두 겹이다.
 *
 * **"한 번 트리거하면 이 컴포넌트가 살아 있는 동안 다시는 안 된다" 식의
 * 별도 래치를 두지 않는다.** 전송이 실패하면(`send()`가 잡아서 다시
 * `confirm` 장면으로 돌려보낸다 — 장면이 안 바뀌므로 이 컴포넌트는
 * 그대로 남아 있다) 관객이 손을 뗐다 다시 가져가는 것만으로 재시도할 수
 * 있어야 한다(§7 "전송 실패 시 재시도"). 게이트 자체의 무장 해제/재무장이
 * 이미 그 일을 하므로, 그 위에 또 막아 버리면 재시도 길이 막힌다.
 */

/** 거리를 다시 보는 간격(ms). 눈에는 매끄럽게, CPU에는 가볍게. */
const TICK_MS = 80

export function SensorGate() {
  const gateRef = useRef<SensorGateState>(INITIAL_GATE_STATE)

  const [progress, setProgress] = useState(0)
  const [near, setNear] = useState(false)
  const [disconnected, setDisconnected] = useState(false)

  useEffect(() => {
    const id = globalThis.setInterval(() => {
      const sensor = useBridge.getState().sensor
      const now = Date.now()
      const broken = isDisconnected(sensor, now)

      // 끊긴 동안에는 멀어진 것으로 본다 — 다시 붙었을 때 느닷없이
      // "다 보유했다"로 시작하는 일이 없게.
      const cm = broken || sensor === null ? FAR_CM + 1 : sensor.cm
      const result = applyDistance(gateRef.current, cm, now)
      gateRef.current = result.state

      setDisconnected(broken)
      setNear(result.state.near)
      setProgress(result.progress)

      if (result.triggered && !useKiosk.getState().sending) {
        void useKiosk.getState().send()
      }
    }, TICK_MS)
    return () => globalThis.clearInterval(id)
  }, [])

  return (
    <div className={styles.panel} data-safe="">
      {disconnected ? (
        <p className={styles.notice}>{SENSOR.disconnected}</p>
      ) : (
        <>
          <p className={styles.prompt}>{near ? SENSOR.awake : SENSOR.idle}</p>
          {!near && <p className={styles.hint}>{SENSOR.hint}</p>}
          <span
            className={styles.glow}
            aria-hidden="true"
            style={{ '--gate-opacity': 0.22 + progress * 0.68 } as CSSProperties}
          >
            <span className={styles.dot} />
          </span>
        </>
      )}
    </div>
  )
}
