import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useKiosk } from '@/store/useKiosk'
import { EASE } from '@/scenes/motion'
import styles from './Notice.module.css'

/** 문구가 머무는 시간 */
const HOLD_MS = 3200

/**
 * 상태 문구.
 *
 * 눌렀는데 아무 변화가 없는 것처럼 느껴지지 않도록 짧게 한 줄을 띄운다.
 * 조용히 나타났다 조용히 사라진다 — 알림이 아니라 속삭임에 가깝게.
 */
export function Notice() {
  const notice = useKiosk((state) => state.notice)
  const clearNotice = useKiosk((state) => state.clearNotice)

  useEffect(() => {
    if (!notice) return
    const id = globalThis.setTimeout(clearNotice, HOLD_MS)
    return () => globalThis.clearTimeout(id)
  }, [notice, clearNotice])

  return (
    <AnimatePresence>
      {notice && (
        <motion.p
          key={notice.id}
          className={styles.notice}
          role="status"
          initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -4, filter: 'blur(5px)' }}
          transition={{ duration: 0.85, ease: EASE }}
        >
          {notice.text}
        </motion.p>
      )}
    </AnimatePresence>
  )
}
