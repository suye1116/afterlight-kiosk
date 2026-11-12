import { motion } from 'framer-motion'
import { TIME } from '@/constants/text.exhibit'
import { COMPOSE } from '@/constants/text.inherited'
import { useKiosk } from '@/store/useKiosk'
import { ActionButton } from '@/components/ActionButton'
import { StepDots } from '@/components/StepDots'
import { RISE, SCENE } from './motion'
import styles from './scene.module.css'

/**
 * 두 번째 걸음 — 그 순간은 얼마나 오래전인가.
 *
 * `SceneRecord`에서 분리된 자리다. 적은 문장은 이미 store에 있으므로
 * 이 화면을 오가거나 뒤로 가도 지워지지 않는다(`useKiosk`는 장면이
 * 아니라 걸음 전체의 상태를 들고 있다).
 *
 * 달력을 띄우지 않는다. 고른 값은 빛이 건너온 거리로만 쓰인다.
 * 고르지 않아도 다음으로 갈 수 있다 — 묻는 것과 시키는 것은 다르다.
 */
export function SceneTime() {
  const timeRef = useKiosk((state) => state.timeRef)
  const chooseTime = useKiosk((state) => state.chooseTime)
  const toSeason = useKiosk((state) => state.toSeason)
  const back = useKiosk((state) => state.back)

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <motion.div className={styles.middle} {...RISE}>
        <p className={styles.question} data-safe="">
          {TIME.question}
        </p>

        <div className={styles.chips} data-safe="">
          {TIME.options.map((option) => {
            const chosen = timeRef?.label === option.label && timeRef?.kind === option.kind
            return (
              <button
                key={option.label}
                type="button"
                className={`tap ${styles.chip} ${chosen ? styles.chipOn : ''}`}
                aria-pressed={chosen}
                onClick={() =>
                  chooseTime(
                    chosen
                      ? null
                      : {
                          kind: option.kind,
                          years: 'years' in option ? option.years : undefined,
                          label: option.label,
                        },
                  )
                }
              >
                {option.label}
              </button>
            )
          })}
        </div>

        <p className={styles.note} data-safe="">
          {TIME.note}
        </p>

        <ActionButton label={COMPOSE.next} onClick={toSeason} />
      </motion.div>

      <div className={styles.foot}>
        <button type="button" className={`tap ${styles.back}`} data-sound="ui.back" onClick={back}>
          {COMPOSE.back}
        </button>
        <StepDots step={2} />
      </div>
    </motion.div>
  )
}
