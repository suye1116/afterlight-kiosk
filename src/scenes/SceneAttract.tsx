import { motion } from 'framer-motion'
import { ATTRACT } from '@/constants/text.exhibit'
import { TITLE } from '@/constants/text.inherited'
import { useKiosk } from '@/store/useKiosk'
import { enterFullscreen } from '@/lib/fullscreen'
import { startAmbient, wake } from '@/audio'
import { EASE, SCENE } from './motion'
import styles from './scene.module.css'

/**
 * 대기.
 *
 * 전시장에서 가장 오래 켜져 있는 화면이다. 그러므로 이 화면 자체가
 * 작품이어야 한다. 안내판을 세우지 않는다 — 지금까지 모인 빛들이
 * 조용히 떠 있고, 아래에 두 줄과 한 줄만 놓인다.
 *
 * 화면 어디를 눌러도 시작된다. 어디를 눌러야 하는지 찾게 만들지 않는다.
 */
export function SceneAttract() {
  const begin = useKiosk((state) => state.begin)
  const total = useKiosk((state) => state.stats.total)

  const start = () => {
    /*
     * 사람의 첫 손짓.
     *
     * 전체화면도, 소리도 여기서 시작한다 — 브라우저는 둘 다 손짓이
     * 있고 나서만 허락한다. 둘 중 무엇이 막혀도 작품은 그대로 돈다.
     */
    void enterFullscreen()
    wake()
    startAmbient()
    begin()
  }

  return (
    <motion.div
      className={styles.scene}
      {...SCENE}
      onClick={start}
      // 물리 버튼이 없을 때를 위해 키보드로도 시작할 수 있다
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') start()
      }}
      role="button"
      tabIndex={0}
      aria-label={ATTRACT.invite}
      // .scene은 하늘을 가리지 않으려고 pointer-events를 끈다.
      // 대기 화면만은 어디를 눌러도 시작되어야 하므로 다시 켠다.
      style={{ cursor: 'pointer', pointerEvents: 'auto' }}
    >
      <div className={styles.middle}>
        <motion.div
          data-safe=""
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 2.4, ease: EASE, delay: 0.6 }}
          style={{ display: 'grid', gap: '1.1em', justifyItems: 'center' }}
        >
          <h1 className={styles.wordmark}>{TITLE.wordmark}</h1>
          <p className={styles.subtitle}>{TITLE.subtitle}</p>
        </motion.div>
      </div>

      <motion.div
        data-safe=""
        className={styles.middle}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2.2, ease: EASE, delay: 1.8 }}
        style={{ gap: '1.6em' }}
      >
        <p className={styles.verse}>
          {ATTRACT.words.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>

        {/* 개수만 센다. 무엇을 적었는지는 여기 있지도 않다. */}
        <p className={styles.quiet}>{total > 0 ? ATTRACT.count(total) : ATTRACT.empty}</p>

        <motion.p
          className={styles.note}
          animate={{ opacity: [0.32, 0.72, 0.32] }}
          transition={{ duration: 5.2, repeat: Infinity, ease: 'easeInOut' }}
        >
          {ATTRACT.invite}
        </motion.p>
      </motion.div>
    </motion.div>
  )
}
