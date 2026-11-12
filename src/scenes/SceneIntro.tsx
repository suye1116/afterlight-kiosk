import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { INTRO } from '@/constants/text.exhibit'
import { TITLE } from '@/constants/text.inherited'
import { useKiosk } from '@/store/useKiosk'
import { ActionButton } from '@/components/ActionButton'
import { EASE, SCENE } from './motion'
import styles from './scene.module.css'

/**
 * 첫 화면.
 *
 * 들어오자마자 설명을 늘어놓지 않는다. 처음에는 거의 어두운 우주뿐이고,
 * 문장은 빛이 도착하듯 하나씩 뒤늦게 닿는다. 박자(ms)는 원작의 것을
 * 그대로 쓴다 — 마지막까지 5.4초.
 *
 * 문구는 전시만을 위해 새로 썼다(`text.exhibit.ts`의 `INTRO`) — 제목과
 * 부제(`TITLE`)만 원작에서 그대로 가져온다. 순서는 한 가지만 가장
 * 또렷하게 보이도록 둔다: 메인 문구(가장 크게) → 설명(작지만 충분히
 * 읽히게) → 버튼(은은하게) → 맨 아래 한 줄(가장 조용하게).
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

        {/* 메인 문구 — 가장 중요하게, 가장 크게 */}
        <p className={styles.verse} data-safe="">
          <motion.span animate={rise(0)} transition={slow}>
            {INTRO.main}
          </motion.span>
        </p>

        {/* 설명 — 작지만 충분히 읽히도록 */}
        <p className={styles.description} data-safe="">
          {INTRO.description.map((line, index) => (
            <motion.span key={line} animate={rise(1 + index)} transition={slow}>
              {line}
            </motion.span>
          ))}
        </p>

        <motion.div animate={rise(3)} transition={slow} style={{ pointerEvents: beat > 3 ? 'auto' : 'none' }}>
          <ActionButton label={INTRO.action} onClick={() => goTo('record')} />
        </motion.div>
      </div>

      {/* 맨 아래 — 가장 조용하게, 가장 늦게 */}
      <motion.p
        className={styles.note}
        data-safe=""
        animate={rise(4)}
        transition={slow}
        style={{ textAlign: 'center' }}
      >
        {INTRO.bottom}
      </motion.p>
    </motion.div>
  )
}
