import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { centerOf, EMOTIONS } from '@/constants/emotions'
import { UNIVERSE } from '@/constants/text.exhibit'
import { safeAreaFor, toSafe } from '@/canvas/safeArea'
import { useViewport } from '@/lib/viewport'
import { consentedStories } from '@/lib/stories'
import { useKiosk } from '@/store/useKiosk'
import { StarShowcase } from './StarShowcase'
import { EASE, SCENE } from './motion'
import styles from './scene.module.css'
import own from './SceneUniverse.module.css'

/**
 * OUR UNIVERSE — 각자의 시간이 모여 만든 하나의 우주.
 *
 * 문장은 거의 없다. 빛만 있다. 여기서 읽을 것은 아래에 놓인 두 줄과,
 * 별자리마다 하나씩 붙는 이름뿐이다. (원작 SceneOurUniverse의 규칙 그대로)
 *
 * 감정별 별자리의 이름은 꺼 둘 수 있다. 이름이 없을 때의 하늘이
 * 이 작품의 본래 모습이고, 이름은 그것을 읽는 보조 장치이기 때문이다.
 */
export function SceneUniverse() {
  const stats = useKiosk((state) => state.stats)
  const stars = useKiosk((state) => state.stars)
  const sent = useKiosk((state) => state.sent)
  const goHome = useKiosk((state) => state.goHome)

  /*
   * 남의 이야기는 **공개에 동의한 것만** 보여 준다.
   *
   * 지금은 동의를 묻는 걸음이 없으므로 언제나 0개다 — 그래서 이 화면에는
   * 남이 적은 글이 한 줄도 없다. 숨긴 것이 아니라 묻지 않았기 때문이다.
   */
  const stories = consentedStories(stars)

  /*
   * 들여다볼 열 개.
   *
   * 들어설 때 고른 이름들(`viewIds`)로 지금의 별을 다시 찾는다 —
   * 이름만 들고 있으므로, 보는 동안 우주가 자라도 목록은 흔들리지 않는다.
   */
  const viewIds = useKiosk((state) => state.viewIds)
  const viewIndex = useKiosk((state) => state.viewIndex)
  const startViewing = useKiosk((state) => state.startViewing)

  /*
   * 빛이 늦게 도착했을 때.
   *
   * 들어설 때 골랐는데 그때는 우주가 비어 있었을 수 있다 — 저장소를 읽는 중이거나,
   * 다른 탭이 보낸 빛이 막 건너오는 중이거나. 그래도 **오류가 나지 않고**,
   * 빛이 생기면 그제야 고른다. 한 번 고르고 나면 다시 고르지 않는다.
   */
  const arrived = stars.filter((star) => star.status === 'arrived').length
  useEffect(() => {
    if (viewIds.length > 0) return
    if (arrived === 0) return
    startViewing()
  }, [viewIds.length, arrived, startViewing])
  const showcase = viewIds
    .map((id) => stars.find((star) => star.id === id))
    .filter((star): star is NonNullable<typeof star> => star !== undefined)

  /** 하나를 들여다보고 있는 동안에는 별자리의 이름이 물러난다 */
  const watching = viewIndex >= 0 && viewIndex < showcase.length

  const { width, height } = useViewport()
  const area = safeAreaFor(width, height)
  const [names, setNames] = useState(true)

  return (
    <motion.div className={styles.scene} {...SCENE}>
      {/* 별자리의 이름. 하늘 위에 아주 조용히 놓인다. */}
      <AnimatePresence>
        {names && !watching && (
          <motion.div
            key="names"
            className={own.names}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: EASE }}
          >
            {EMOTIONS.map((emotion, index) => {
              const count = stats.byEmotion[emotion.type] ?? 0
              const middle = centerOf(emotion)
              const spot = toSafe(middle.x, middle.y, area)
              return (
                <motion.p
                  key={emotion.type}
                  data-safe=""
                  className={own.name}
                  style={{
                    left: `${spot.x * 100}%`,
                    // 이름은 별자리 위에 놓인다. 별을 가리지 않게 한 뼘 올린다.
                    top: `${spot.y * 100}%`,
                    color: 'var(--light-100)',
                    textShadow: `0 0 22px ${emotion.tint}`,
                    opacity: count > 0 ? 1 : 0.34,
                  }}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: count > 0 ? 1 : 0.34, y: 0 }}
                  transition={{
                    duration: 1.4,
                    delay: 0.3 + index * 0.12,
                    ease: EASE,
                  }}
                >
                  <span className={own.nameText}>{emotion.label}</span>
                  <span className={own.nameCount}>{count}</span>
                </motion.p>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/*
        열 개를 하나씩 들여다보는 자리.
        하늘은 뒤에서 그대로 돈다 — 우주가 살아 있어야 하기 때문이다.
      */}
      <StarShowcase stars={showcase} />

      <div className={styles.middle} />

      <motion.div
        data-safe=""
        className={styles.middle}
        initial={{ opacity: 0 }}
        animate={{ opacity: showcase.length > 0 ? 0 : 1 }}
        transition={{ duration: 2.2, ease: EASE, delay: showcase.length > 0 ? 0 : 1.1 }}
        style={{ gap: '1.3em', pointerEvents: showcase.length > 0 ? 'none' : 'auto' }}
      >
        <p className={styles.verse}>
          {UNIVERSE.words.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </p>

        {/* 개수만 센다. 무엇을 적었는지는 이 화면에 있지도 않다. */}
        <p className={styles.quiet}>
          {stats.total > 0 ? UNIVERSE.count(stats.total) : UNIVERSE.empty}
        </p>

        {sent && <p className={own.mine}>{UNIVERSE.mine}</p>}

        {/* 읽을 수 있는 이야기가 몇인가. 0이면 0이라고 말한다. */}
        <p className={styles.note}>{UNIVERSE.stories(stories.length)}</p>

        <div className={styles.footCenter}>
          <button
            type="button"
            className={`tap ${styles.back}`}
            onClick={() => setNames((on) => !on)}
          >
            {names ? UNIVERSE.hideNames : UNIVERSE.showNames}
          </button>
          <button type="button" className={`tap ${styles.back}`} onClick={goHome}>
            {UNIVERSE.back}
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}
