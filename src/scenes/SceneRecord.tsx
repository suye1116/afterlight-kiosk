import { useEffect, useRef } from 'react'
import type { KeyboardEvent } from 'react'
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
 * 첫 걸음 — 기억을 적는다.
 *
 * 기억이 바로 떠오르지 않는 관람객도 참여할 수 있도록, 적는 방식을
 * 둘로 나눈다.
 *
 *   free   — 기존처럼 자유롭게 한 문장을 적는다
 *   prompt — 질문 하나를 보고 그 질문에 답한다
 *
 * 둘은 언제든 서로 오갈 수 있고, 오간다고 해서 이미 적던 것이 사라지지
 * 않는다 — `text`와 `promptAnswer`를 store가 각자 따로 간직한다
 * (`useKiosk.setRecordMode`). 한 화면에는 **질문 하나만** 보인다 —
 * 질문 방식일 때는 위의 일반 질문(`RECORD.question`) 대신 고른
 * 질문이 그 자리를 대신한다.
 */
export function SceneRecord() {
  const recordMode = useKiosk((state) => state.recordMode)
  const setRecordMode = useKiosk((state) => state.setRecordMode)
  const text = useKiosk((state) => state.text)
  const setText = useKiosk((state) => state.setText)
  const promptAnswer = useKiosk((state) => state.promptAnswer)
  const setPromptAnswer = useKiosk((state) => state.setPromptAnswer)
  const selectedPrompt = useKiosk((state) => state.selectedPrompt)
  const pickPrompt = useKiosk((state) => state.pickPrompt)
  const toTime = useKiosk((state) => state.toTime)
  const back = useKiosk((state) => state.back)

  const inputRef = useRef<HTMLInputElement>(null)
  const isPrompt = recordMode === 'prompt'
  const value = isPrompt ? promptAnswer : text
  const ready = value.trim().length > 0

  // 커서가 이미 답 자리에 있어야 한다. 무엇을 해야 하는지 말로 설명하지 않기 위해서다.
  useEffect(() => {
    inputRef.current?.focus()
  }, [recordMode, selectedPrompt])

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
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
    if (event.key === 'Enter' && ready) toTime()
  }

  const onPaste = () => {
    /* 붙여넣기는 글자 수와 상관없이 한 번만 */
    if (mayListen(inputRef.current)) play('type.paste')
  }

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <motion.div className={styles.middle} {...RISE}>
        {/* 두 작성 방식 — 전환해도 서로의 내용을 지우지 않는다 */}
        <div className={styles.chips} data-safe="">
          <button
            type="button"
            className={`tap ${styles.chip} ${!isPrompt ? styles.chipOn : ''}`}
            aria-pressed={!isPrompt}
            onClick={() => setRecordMode('free')}
          >
            {RECORD.mode.free}
          </button>
          <button
            type="button"
            className={`tap ${styles.chip} ${isPrompt ? styles.chipOn : ''}`}
            aria-pressed={isPrompt}
            onClick={() => setRecordMode('prompt')}
          >
            {RECORD.mode.prompt}
          </button>
        </div>

        {isPrompt ? (
          <div data-safe="" style={{ display: 'grid', gap: '0.9em', justifyItems: 'center' }}>
            <p className={styles.question}>{selectedPrompt}</p>
            <button type="button" className={`tap ${styles.back}`} onClick={pickPrompt}>
              {RECORD.another}
            </button>
          </div>
        ) : (
          <div data-safe="" style={{ display: 'grid', gap: '0.9em', justifyItems: 'center' }}>
            <p className={styles.question}>{RECORD.question}</p>
            <p className={styles.quiet}>{RECORD.guide}</p>
          </div>
        )}

        <div className={styles.field} data-safe="">
          <input
            ref={inputRef}
            className={styles.input}
            type="text"
            value={value}
            onChange={(event) =>
              isPrompt ? setPromptAnswer(event.target.value) : setText(event.target.value)
            }
            onKeyDown={onKeyDown}
            onPaste={onPaste}
            placeholder={isPrompt ? RECORD.answerPlaceholder : COMPOSE.placeholder}
            maxLength={TEXT_LIMIT}
            autoComplete="off"
            spellCheck={false}
            aria-label={isPrompt ? (selectedPrompt ?? RECORD.question) : RECORD.question}
          />
          <span className={styles.line} />
          <p className={`${styles.count} ${value.length >= TEXT_LIMIT - 10 ? styles.countNear : ''}`}>
            {value.length} / {TEXT_LIMIT}
          </p>
        </div>

        <ActionButton label={COMPOSE.next} disabled={!ready} onClick={toTime} />
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
