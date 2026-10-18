import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { COMPOSE } from '@/constants/text.inherited'
import { RECORD } from '@/constants/text.exhibit'
import { TEXT_LIMIT, useKiosk } from '@/store/useKiosk'
import { ActionButton } from '@/components/ActionButton'
import { StepDots } from '@/components/StepDots'
import { mayListen, play, soundForKey, wake } from '@/audio'
import { RISE, SCENE } from './motion'
import styles from './scene.module.css'

/**
 * 첫 걸음 — 적는다.
 *
 * 질문과 입력은 원작의 것 그대로다. 그 아래에 '그 시간은 언제였나요?'
 * 한 줄만 더 둔다. 전시에서는 그 시간이 얼마나 먼 곳에서 오는지가
 * 빛의 거리가 되기 때문이다. 고르지 않아도 보낼 수 있다 —
 * 묻는 것과 시키는 것은 다르다.
 */
export function SceneRecord() {
  const text = useKiosk((state) => state.text)
  const setText = useKiosk((state) => state.setText)
  const timeRef = useKiosk((state) => state.timeRef)
  const chooseTime = useKiosk((state) => state.chooseTime)
  const toEmotion = useKiosk((state) => state.toEmotion)
  const back = useKiosk((state) => state.back)

  const inputRef = useRef<HTMLInputElement>(null)
  const ready = text.trim().length > 0

  // 커서가 이미 문장 자리에 있어야 한다. 무엇을 해야 하는지 말로 설명하지 않기 위해서다.
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <motion.div className={styles.middle} {...RISE}>
        <p className={styles.question} data-safe="">
          {COMPOSE.steps[0].question}
        </p>

        <div className={styles.field} data-safe="">
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={(event) => {
              /*
               * 타자기.
               *
               * **실제로 자판을 누를 때만** 난다. 한글을 조합하는 중에도
               * 한 번 누르면 한 번이다 — IME가 keydown을 229로 보내 주므로,
               * 조합이 바뀔 때마다 울리는 `input` 대신 이쪽을 듣는다.
               */
              if (mayListen(event.currentTarget)) {
                wake()
                const sound = soundForKey(event)
                if (sound) play(sound)
              }

              // 엔터가 곧 다음 걸음이다
              if (event.key === 'Enter' && ready) toEmotion()
            }}
            /* 붙여넣기는 글자 수와 상관없이 한 번만 */
            onPaste={() => {
              if (mayListen(inputRef.current)) play('type.paste')
            }}
            placeholder={COMPOSE.placeholder}
            maxLength={TEXT_LIMIT}
            autoComplete="off"
            spellCheck={false}
            aria-label={COMPOSE.steps[0].question}
          />
          <span className={styles.line} />
          <p
            className={`${styles.count} ${text.length >= TEXT_LIMIT - 10 ? styles.countNear : ''}`}
          >
            {text.length} / {TEXT_LIMIT}
          </p>
        </div>

        <div data-safe="" style={{ display: 'grid', gap: '1.1em', justifyItems: 'center' }}>
          <p className={styles.quiet}>{RECORD.when}</p>

          <div className={styles.chips}>
            {RECORD.options.map((option) => {
              const chosen =
                timeRef?.label === option.label && timeRef?.kind === option.kind
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

          <p className={styles.note}>{RECORD.whenNote}</p>
        </div>

        <ActionButton label={COMPOSE.next} disabled={!ready} onClick={toEmotion} />
      </motion.div>

      <div className={styles.foot}>
        <button type="button" className={`tap ${styles.back}`} data-sound="ui.back" onClick={back}>
          {COMPOSE.back}
        </button>
        <StepDots step={1} />
      </div>
    </motion.div>
  )
}
