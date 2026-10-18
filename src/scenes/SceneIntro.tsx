import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { INTRO, TITLE } from '@/constants/text.inherited'
import { useKiosk } from '@/store/useKiosk'
import { ActionButton } from '@/components/ActionButton'
import { EASE, SCENE } from './motion'
import styles from './scene.module.css'

/**
 * 인트로.
 *
 * 들어오자마자 설명을 늘어놓지 않는다. 처음에는 거의 어두운 우주뿐이고,
 * 문장은 빛이 도착하듯 하나씩 뒤늦게 닿는다.
 * 박자(ms)는 원작의 것을 그대로 쓴다 — 마지막까지 5.4초.
 */
export function SceneIntro() {
  const goTo = useKiosk((state) => state.goTo)
  const [beat, setBeat] = useState(0)

  useEffect(() => {
    const timers = INTRO.beats.map((at, index) =>
      globalThis.setTimeout(() => setBeat(index + 1), at),
    )
    return () => timers.forEach((id) => globalThis.clearTimeout(id))
  }, [])

  const shown = (index: number) => (beat > index ? 1 : 0)
  const rise = (index: number) => ({
    opacity: shown(index),
    y: beat > index ? 0 : 10,
    filter: beat > index ? 'blur(0px)' : 'blur(7px)',
  })
  const slow = { duration: 1.4, ease: EASE }

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <div className={styles.middle}>
        <motion.div
          data-safe=""
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2.4, ease: EASE }}
          style={{ display: 'grid', gap: '1.1em', justifyItems: 'center' }}
        >
          <h1 className={styles.wordmark}>{TITLE.wordmark}</h1>
          <p className={styles.subtitle}>{TITLE.subtitle}</p>
        </motion.div>

        <p className={styles.verse} data-safe="">
          {INTRO.verse.map((line, index) => (
            <motion.span key={line} animate={rise(index)} transition={slow}>
              {line}
            </motion.span>
          ))}
        </p>

        <motion.p className={styles.question} data-safe="" animate={rise(2)} transition={slow}>
          {INTRO.question}
        </motion.p>

        <motion.div animate={rise(3)} transition={slow} style={{ pointerEvents: beat > 3 ? 'auto' : 'none' }}>
          <ActionButton label={INTRO.action} onClick={() => goTo('record')} />
        </motion.div>
      </div>

      <div />
    </motion.div>
  )
}
