import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { TONES } from '@/constants/tones'
import { CHOICE } from '@/constants/text.exhibit'
import { COMPOSE } from '@/constants/text.inherited'
import { useKiosk } from '@/store/useKiosk'
import { StepDots } from '@/components/StepDots'
import { RISE, SCENE } from './motion'
import styles from './scene.module.css'

function toneVars(core: string, halo: string, rest: number, restHalo: number): CSSProperties {
  return {
    '--core': core,
    '--halo': halo,
    '--rest-opacity': rest,
    '--rest-halo': restHalo,
  } as CSSProperties
}

/**
 * 세 번째 걸음 — 간직할 것인가, 흘려보낼 것인가.
 *
 * 원작에서는 이것이 유일한 선택이었다. 여기서는 감정과 **나란한 다른 축**이다.
 * 같은 그리움이라도 간직한 것과 흘려보낸 것이 있다.
 *
 * 두 빛의 이름과 색과 밝기는 원작 `constants/tones.ts` 그대로다.
 */
export function SceneChoice() {
  const type = useKiosk((state) => state.type)
  const chooseType = useKiosk((state) => state.chooseType)
  const back = useKiosk((state) => state.back)

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <motion.div className={styles.middle} {...RISE}>
        <p className={styles.question} data-safe="">
          {CHOICE.question}
        </p>

        <div className={styles.lights}>
          {TONES.map((tone) => (
            <button
              key={tone.type}
              type="button"
              className={`tap ${styles.light} ${
                type && type !== tone.type ? styles.dimmed : ''
              }`}
              style={toneVars(
                tone.core,
                tone.halo,
                // 간직하는 빛은 처음부터 조금 더 선명하고,
                // 흘려보내는 빛은 처음부터 조금 더 희미하다.
                tone.type === 'keep' ? 0.82 : 0.5,
                tone.type === 'keep' ? 0.42 : 0.24,
              )}
              data-sound="ui.choose"
              onClick={() => chooseType(tone.type)}
            >
              <span className={styles.bulb}>
                <span className={styles.glyph} aria-hidden="true">
                  {tone.glyph}
                </span>
              </span>
              <span className={styles.name}>{tone.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      <div className={styles.foot}>
        <button type="button" className={`tap ${styles.back}`} data-sound="ui.back" onClick={back}>
          {COMPOSE.back}
        </button>
        <StepDots step={3} />
      </div>
    </motion.div>
  )
}
