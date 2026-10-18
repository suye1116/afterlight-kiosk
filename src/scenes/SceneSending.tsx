import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { SENSOR } from '@/constants/text.exhibit'
import { DEPARTURE_SECONDS } from '@/canvas/skyEngine'
import { useKiosk } from '@/store/useKiosk'
import { useBridge } from '@/store/useBridge'
import { EASE, SCENE } from './motion'
import styles from './scene.module.css'

/**
 * 건너가는 동안.
 *
 * 원작의 '도착'을 뒤집은 장면이다. 거기서는 먼 곳의 빛이 내 하늘로
 * 내려앉았고, 여기서는 내 앞의 빛이 멀어지며 작아진다.
 *
 * ─── LED와 같은 시계 ────────────────────────────────────
 *  아두이노의 LED 다섯 개가 전송 진행을 보여준다. 화면의 점 다섯과
 *  LED가 "동기화"되려면 같은 시계를 봐야 한다 — 그래서 **이 화면이
 *  기준 시계**다. `DEPARTURE_SECONDS`를 다섯 단계로 나눠, 단계가 바뀔
 *  때마다 화면의 점을 채우는 동시에 `led.set`을 다리로 보낸다.
 *  (아두이노가 없어도, 다리가 없어도 이 화면의 시간은 그대로 간다.)
 * ───────────────────────────────────────────────────────
 *
 * ─── 완료 조건 ──────────────────────────────────────────
 *  다섯 단계가 다 끝난 **뒤에도**, 벽(TouchDesigner)이 "띄웠다"고
 *  확인해 줄 때까지 "도착했어요"를 보여주지 않는다 — 단, 벽이나 다리가
 *  없는 경우를 위해 넉넉한 폴백 시간을 둔다. "다리가 없어도 작품은
 *  그대로 돈다"는 이 작품의 원칙을 그대로 지킨다.
 * ───────────────────────────────────────────────────────
 */

const LED_COUNT = 5
/** LED 한 칸이 켜지기까지의 간격(ms). 2.6초를 다섯으로 나눈다. */
const STEP_MS = (DEPARTURE_SECONDS * 1000) / LED_COUNT
/** LED가 다 켜진 뒤, 벽의 확인이 없어도 넘어가는 시간(ms) */
const WALL_CONFIRM_FALLBACK_MS = 6000
/** "도착했어요"가 눈에 머무는 시간(ms) */
const ARRIVED_HOLD_MS = 900
/** 시계를 다시 보는 간격(ms) */
const TICK_MS = 80

export function SceneSending() {
  const sent = useKiosk((state) => state.sent)
  const finishSending = useKiosk((state) => state.finishSending)

  const [step, setStep] = useState(0)
  const [phase, setPhase] = useState<'sending' | 'arrived'>('sending')

  const startedAt = useRef(Date.now())
  const ledDoneAt = useRef<number | null>(null)
  const settled = useRef(false)

  useEffect(() => {
    if (!sent) return

    let appliedStep = 0
    const id = globalThis.setInterval(() => {
      const elapsed = Date.now() - startedAt.current
      const target = Math.min(LED_COUNT, Math.floor(elapsed / STEP_MS))

      if (target !== appliedStep) {
        appliedStep = target
        setStep(target)
        useBridge.getState().handle?.led(target)
        if (target === LED_COUNT) ledDoneAt.current = Date.now()
      }

      if (settled.current || ledDoneAt.current === null) return

      const shown = useKiosk.getState().lastShownStarId === sent.id
      const fellBack = Date.now() - ledDoneAt.current >= WALL_CONFIRM_FALLBACK_MS
      if (shown || fellBack) {
        settled.current = true
        setPhase('arrived')
        globalThis.setTimeout(finishSending, ARRIVED_HOLD_MS)
      }
    }, TICK_MS)

    return () => globalThis.clearInterval(id)
  }, [sent, finishSending])

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <div className={styles.middle} />

      <motion.div
        className={styles.middle}
        data-safe=""
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, ease: EASE, delay: 1.1 }}
      >
        <p className={styles.quiet}>{phase === 'arrived' ? SENSOR.arrived : SENSOR.sending}</p>

        {/* LED 진행 — 아두이노의 LED 다섯과 같은 시계로 채워진다 */}
        <span className={styles.dots} aria-hidden="true">
          {Array.from({ length: LED_COUNT }, (_, index) => (
            <span key={index} className={`${styles.dot} ${index < step ? styles.dotOn : ''}`} />
          ))}
        </span>
      </motion.div>
    </motion.div>
  )
}
