import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getEmotion } from '@/constants/emotions'
import { DONE, INVITE } from '@/constants/text.exhibit'
import { COMPOSE } from '@/constants/text.inherited'
import { Receipt } from '@/components/Receipt'
import { ActionButton } from '@/components/ActionButton'
import { useKiosk } from '@/store/useKiosk'
import { useBridge } from '@/store/useBridge'
import { EASE, RISE, SCENE } from './motion'
import styles from './scene.module.css'

/**
 * 도착.
 *
 * '저장했습니다'가 아니다. 한 사람의 시간이 모두의 우주에 닿은 것이다.
 *
 * ─── 세 박자 ───────────────────────────────────────────
 *   arrived  닿았다는 말이 머문다 (원작의 완료 연출 그대로)
 *   invite   남의 별들을 만나 보겠냐고 **묻는다**
 *   stayed   보지 않겠다고 했다. 완료 화면이 그대로 남는다
 *
 *  둘을 한 화면에 함께 두지 않는다 — '도착했다'와 '보시겠어요'가 나란히
 *  있으면 둘 다 안내문이 되고, 어느 쪽도 들리지 않는다.
 *
 *  **스스로 우리의 우주로 건너가는 일은 없다.** 묻기만 하고, 고르지 않으면
 *  그대로 머문다. 하늘은 그동안에도 잔잔히 떠 있다(dim 0.42 · 자기 빛이 비친다).
 * ───────────────────────────────────────────────────────
 */
export function SceneDone() {
  const sent = useKiosk((state) => state.sent)
  const stats = useKiosk((state) => state.stats)
  const beat = useKiosk((state) => state.doneBeat)
  const invite = useKiosk((state) => state.invite)
  const declineUniverse = useKiosk((state) => state.declineUniverse)
  const showUniverse = useKiosk((state) => state.showUniverse)
  const reset = useKiosk((state) => state.reset)
  const goTo = useKiosk((state) => state.goTo)
  const goHome = useKiosk((state) => state.goHome)

  const [receipt, setReceipt] = useState(false)

  /*
   * 종이가 정말 나오는가.
   *
   * 다리가 붙어 있고, 그 다리에 **진짜 프린터**가 달려 있을 때만 그렇게 말한다.
   * 파일로 쌓는 중(`file`)이면 종이는 나오지 않으므로 그렇게 말하지 않는다.
   */
  const printing = useBridge(
    (state) => state.link === 'open' && state.status?.printerMode === 'tcp',
  )

  /*
   * 완료 문장이 머물 만큼 머문 뒤에 묻는다.
   *
   * 영수증을 펼쳐 보고 있는 동안에는 묻지 않는다 — 읽고 있는 것 위로
   * 다른 말이 올라오면 둘 다 읽히지 않는다.
   */
  useEffect(() => {
    if (beat !== 'arrived' || receipt) return
    const id = globalThis.setTimeout(invite, INVITE.afterMs)
    return () => globalThis.clearTimeout(id)
  }, [beat, receipt, invite])

  if (!sent) return null

  const emotion = getEmotion(sent.emotion)
  const company = stats.byEmotion[sent.emotion] ?? 1

  const again = () => {
    reset()
    goTo('record')
  }

  /** 완료 화면 — 닿았다는 말과 영수증. 원작의 문구를 그대로 둔다. */
  const arrived = (
    <motion.div
      key="arrived"
      className={styles.middle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(6px)' }}
      transition={{ duration: 1.1, ease: EASE }}
    >
      <p className={styles.verse} data-safe="">
        <span>{DONE.line}</span>
      </p>

      <p className={styles.quiet} data-safe="">
        {DONE.company(emotion.label, company)}
      </p>

      <motion.div
        data-safe=""
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.6, delay: 1.2, ease: EASE }}
        style={{ display: 'grid', gap: '1.1em', justifyItems: 'center' }}
      >
        <p className={styles.note}>{printing ? DONE.receiptPrinting : DONE.receipt}</p>
        <button type="button" className={`tap ${styles.back}`} onClick={() => setReceipt(true)}>
          {DONE.receiptPreview}
        </button>
      </motion.div>
    </motion.div>
  )

  /**
   * 묻는 자리.
   *
   * 아주 천천히 배어 나온다(2.2초). 움직임도, 밝아지는 효과도 없다 —
   * 빛은 이미 거기 있고, 글자만 뒤늦게 닿는다.
   */
  const asking = (
    <motion.div
      key="invite"
      className={styles.middle}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(6px)' }}
      transition={{ duration: 2.2, ease: EASE }}
      style={{ gap: 'clamp(34px, 5.5vh, 64px)' }}
    >
      <p className={styles.invite} data-safe="">
        {INVITE.words.map((line, index) => (
          <motion.span
            key={line}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            // 한 문단씩 뒤늦게 닿는다. 세 번째 줄(물음)이 가장 나중이다.
            transition={{ duration: 1.8, delay: 0.6 + index * 1.1, ease: EASE }}
          >
            {line}
          </motion.span>
        ))}
      </p>

      {/*
        두 길은 같은 무게다. 어느 쪽도 크거나 밝지 않다 —
        보지 않겠다는 것도 하나의 답이기 때문이다.
      */}
      <motion.div
        className={styles.choices}
        data-safe=""
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.8, delay: 3.2, ease: EASE }}
      >
        <ActionButton label={INVITE.yes} onClick={showUniverse} />
        <ActionButton label={INVITE.no} onClick={declineUniverse} />
      </motion.div>
    </motion.div>
  )

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <motion.div className={styles.middle} {...RISE}>
        <AnimatePresence mode="wait">
          {receipt ? (
            <Receipt
              key="receipt"
              star={sent}
              company={company}
              onClose={() => setReceipt(false)}
            />
          ) : beat === 'invite' ? (
            asking
          ) : (
            arrived
          )}
        </AnimatePresence>
      </motion.div>

      {/*
        아래 단.

        묻고 있는 동안에는 두지 않는다 — 고를 것이 둘인데 아래에 또 길이
        셋이면, 묻는 일이 아니라 메뉴가 된다.
      */}
      <AnimatePresence>
        {beat !== 'invite' && (
          <motion.div
            key="foot"
            className={styles.footCenter}
            data-safe=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.6, delay: beat === 'stayed' ? 0.4 : 1.8, ease: EASE }}
          >
            <button type="button" className={`tap ${styles.back}`} onClick={again}>
              {COMPOSE.again}
            </button>
            <button type="button" className={`tap ${styles.back}`} onClick={goHome}>
              {DONE.home}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
