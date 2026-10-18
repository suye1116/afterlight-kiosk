import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { EMOTIONS } from '@/constants/emotions'
import { EMOTION } from '@/constants/text.exhibit'
import { COMPOSE } from '@/constants/text.inherited'
import { useKiosk } from '@/store/useKiosk'
import { StepDots } from '@/components/StepDots'
import { RISE, SCENE } from './motion'
import styles from './scene.module.css'

/** 빛의 색을 CSS 변수로 넘긴다. 색은 한 곳(emotions.ts)에서만 정의된다. */
function lightVars(core: string, halo: string, rest: number, restHalo: number): CSSProperties {
  return {
    '--core': core,
    '--halo': halo,
    '--rest-opacity': rest,
    '--rest-halo': restHalo,
  } as CSSProperties
}

/**
 * 두 번째 걸음 — 오늘의 마음.
 *
 * 항목을 고르는 게 아니라 우주에 떠 있는 **일곱 개의 작은 빛** 중 하나를 고른다.
 * 아이콘도, 얼굴도, 점수도 없다 — 그런 것이 붙는 순간 이 작품은
 * 기분을 관리하는 도구가 된다. (원작의 규칙 그대로)
 *
 * 고르는 일이 곧 다음 걸음이다. 확인 버튼을 따로 두지 않는다.
 */
export function SceneEmotion() {
  const emotion = useKiosk((state) => state.emotion)
  const chooseEmotion = useKiosk((state) => state.chooseEmotion)
  const back = useKiosk((state) => state.back)


  return (
    <motion.div className={styles.scene} {...SCENE}>
      <motion.div className={styles.middle} {...RISE}>
        <p className={styles.question} data-safe="">
          {EMOTION.question}
        </p>

        <div className={styles.lights}>
          {EMOTIONS.map((one) => (
            <button
              key={one.type}
              type="button"
              className={`tap ${styles.light} ${
                emotion && emotion !== one.type ? styles.dimmed : ''
              }`}
              /*
               * 고르는 자리에서도 그 마음의 빛 그대로다.
               * 여기서 본 색과 하늘에 뜬 색이 다르면, 고른 것이 무엇인지 알 수 없다.
               */
              style={lightVars(one.light.core, one.light.halo, 0.82, 0.5)}
              data-sound="ui.choose"
              onClick={() => chooseEmotion(one.type)}
            >
              <span className={styles.bulb}>
                <span className={styles.dotLight} aria-hidden="true" />
              </span>
              <span className={styles.name}>{one.label}</span>
            </button>
          ))}
        </div>
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
