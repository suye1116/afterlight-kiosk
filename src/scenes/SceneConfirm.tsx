import { motion } from 'framer-motion'
import type { CSSProperties } from 'react'
import { getEmotion, haloFor } from '@/constants/emotions'
import { getTone } from '@/constants/tones'
import { CONFIRM } from '@/constants/text.exhibit'
import { COMPOSE } from '@/constants/text.inherited'
import { useKiosk } from '@/store/useKiosk'
import { ActionButton } from '@/components/ActionButton'
import { SensorGate } from '@/components/SensorGate'
import { OperatorOverride } from '@/components/OperatorOverride'
import { StepDots } from '@/components/StepDots'
import { isTestMode } from '@/lib/testMode'
import { RISE, SCENE } from './motion'
import styles from './scene.module.css'

function toneVars(core: string, halo: string): CSSProperties {
  return { '--core': core, '--halo': halo, '--rest-opacity': 1, '--rest-halo': 1 } as CSSProperties
}

/**
 * 마지막 걸음 — 무엇을 보내는지 눈으로 확인하고 보낸다.
 *
 * 요약표가 아니다. 적은 문장 하나와 고른 빛 하나가 보일 뿐이다.
 */
export function SceneConfirm() {
  const text = useKiosk((state) => state.text)
  const emotionKey = useKiosk((state) => state.emotion)
  const type = useKiosk((state) => state.type)
  const timeRef = useKiosk((state) => state.timeRef)
  const sending = useKiosk((state) => state.sending)
  const send = useKiosk((state) => state.send)
  const back = useKiosk((state) => state.back)

  const emotion = getEmotion(emotionKey)
  const tone = getTone(type ?? 'keep')

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <motion.div
        className={styles.middle}
        style={toneVars(tone.core, haloFor(emotion, tone.halo))}
        {...RISE}
      >
        <p className={styles.note} data-safe="">
          {CONFIRM.question}
        </p>

        {/* 적은 문장. 이 화면에서 가장 큰 글자다. */}
        <p className={styles.sentence} data-safe="">
          {text}
        </p>

        <div className={styles.summary} data-safe="">
          {timeRef && <span className={styles.summaryItem}>{timeRef.label}</span>}
          <span className={styles.summaryItem}>
            <span aria-hidden="true" className={styles.summaryDot} />
            {emotion.label}
          </span>
          <span className={styles.summaryItem}>
            <span aria-hidden="true" className={styles.summaryGlyph}>
              {tone.glyph}
            </span>
            {tone.cardLabel}
          </span>
        </div>

        {/*
          전시 빌드의 전송은 손 감지 센서가 한다(`SensorGate`) — 터치
          버튼이 아니다. 아래 버튼은 **개발 중에만** 보인다
          (`isTestMode()`): 센서나 다리 없이도 흐름 전체를 계속 확인할 수
          있어야 하기 때문이다. 연타로 같은 별이 둘 생기지 않게, 보내는
          동안에는 꺼 둔다.
        */}
        <SensorGate />
        {isTestMode() && (
          <ActionButton
            label={COMPOSE.send}
            disabled={sending}
            onClick={() => void send()}
            /* 감정의 소리가 따로 울린다. 여기서 또 내면 둘이 겹친다. */
            sound="none"
          />
        )}
      </motion.div>

      <div className={styles.foot}>
        <button type="button" className={`tap ${styles.back}`} data-sound="ui.back" onClick={back} disabled={sending}>
          {COMPOSE.back}
        </button>
        <StepDots step={4} />
      </div>

      {/* 운영자용 — 관객에게는 보이지 않는다. isTestMode()와 무관하게 전시 중에도 있다. */}
      <OperatorOverride />
    </motion.div>
  )
}
