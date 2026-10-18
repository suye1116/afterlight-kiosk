import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { UNIVERSE } from '@/constants/text.exhibit'
import {
  contentOf,
  scatterShowcase,
  stepFor,
  TELL_AT,
  VIEWING,
  type ShowcaseSpot,
} from '@/lib/showcase'
import { useKiosk } from '@/store/useKiosk'
import { play } from '@/audio'
import type { UniverseStar } from '@/types'
import { EASE } from './motion'
import styles from './StarShowcase.module.css'

/**
 * 열 개의 별을 하나씩 들여다보는 일.
 *
 * ─── 왜 캔버스가 아니라 글자 층인가 ────────────────────
 *  하늘(캔버스)은 그대로 돈다 — 성운도, 배경별도, 다른 사람들의 빛도
 *  뒤에서 계속 살아 있다. 그 위에 **앞으로 걸어 나온 열 개**를 얹는다.
 *
 *  이 열 개는 글자와 함께 움직여야 한다. 별이 가운데로 오고 그 아래에
 *  그 사람의 시간이 떠오르는 일은, 빛과 글자가 **한 몸으로** 움직이는 일이다.
 *  캔버스와 DOM으로 나누면 둘의 박자가 반드시 어긋난다.
 * ───────────────────────────────────────────────────────
 *
 * 한 별이 지나는 길
 *
 *   흩어져 있다 → 가운데로 온다(2.6초) → 자리를 잡는다 → 그 시간이 떠오른다
 *   → 읽을 만큼 머문다 → 다음 별이 같은 길을 간다
 *
 * 나머지 아홉은 물러나되 **사라지지 않는다.** 우주가 살아 있어야 하기 때문이다.
 */

/**
 * 박자는 전부 `lib/showcase.ts`의 `VIEWING`에 있다.
 * 여기서는 그것을 초로 바꿔 쓰기만 한다 — 고치는 곳이 둘이면 반드시 어긋난다.
 */
const TRAVEL = VIEWING.travelMs / 1000

export function StarShowcase({ stars }: { stars: ReadonlyArray<UniverseStar> }) {
  const index = useKiosk((state) => state.viewIndex)
  const sessionId = useKiosk((state) => state.sessionId)
  const nextStar = useKiosk((state) => state.nextStar)
  const replayViewing = useKiosk((state) => state.replayViewing)
  const goHome = useKiosk((state) => state.goHome)

  const spots = scatterShowcase(stars)
  const centred = index >= 0 && index < stars.length ? stars[index] : null
  const finished = stars.length > 0 && index >= stars.length
  const content = centred ? contentOf(centred, sessionId) : null

  /*
   * 시계와 소리는 **이 둘만** 본다.
   *
   * `centred`와 `content`는 그릴 때마다 새로 만들어지는 값이라,
   * 그것을 보고 있으면 화면이 다시 그려질 때마다 시계가 처음으로 돌아간다.
   */
  const centredId = centred?.id ?? null
  const bodyText = content?.text ?? null

  /*
   * 흩어진 하늘을 잠시 보여 준 뒤에 첫 별이 다가온다.
   * 들어서자마자 하나가 움직이면, 흩어져 있던 모습을 볼 틈이 없다.
   */
  useEffect(() => {
    if (index !== -1 || stars.length === 0) return
    // 공간이 열리는 소리. 흩어진 열 개가 떠오를 때 한 번.
    play('view.open')
    const id = globalThis.setTimeout(nextStar, VIEWING.scatterMs)
    return () => globalThis.clearTimeout(id)
  }, [index, stars.length, nextStar])

  /*
   * 별 하나가 가운데로 올 때, 그리고 그 시간이 떠오를 때.
   *
   * **별이 바뀔 때만** 울린다. 읽는 동안에는 아무 소리도 되풀이되지 않는다 —
   * 읽는 일에 소리가 끼어들면 그건 음악이 아니라 방해다.
   */
  useEffect(() => {
    if (!centredId) return
    // 다가오는 소리
    play('view.center')
    // 글이 배어 나오기 시작하는 바로 그때의 작은 반짝임
    const id = globalThis.setTimeout(() => play('view.tell'), TELL_AT)
    return () => globalThis.clearTimeout(id)
  }, [centredId])

  /*
   * 읽을 만큼 머물렀으면 **스스로** 다음 별로.
   *
   * 이것이 기본이다. 사람이 누르지 않아도 열 개가 차례로 지나간다 —
   * 누군가는 서서 바라보기만 하고, 그래도 되어야 한다.
   *
   * ─── 시계가 다시 걸리는 때 ─────────────────────────────
   *  **별이 바뀔 때만** 다시 건다. 그래서 여기 적힌 것은 `centred.id`와
   *  글의 길이뿐이다 — `content`는 그릴 때마다 새 객체라, 그것을 적어 두면
   *  화면이 다시 그려질 때마다 시계가 처음으로 돌아가 영영 넘어가지 않는다.
   *  (사람이 '다음 별'을 누르면 번호가 바뀌므로 여기도 다시 걸린다 —
   *   그게 "직접 고르면 시계를 초기화한다"는 말이 뜻하는 바다.)
   *
   *  화면을 벗어나면 React가 이 자리를 거두면서 시계도 함께 끊는다.
   * ───────────────────────────────────────────────────────
   */
  useEffect(() => {
    if (!centredId) return
    const id = globalThis.setTimeout(nextStar, stepFor(bodyText))
    return () => globalThis.clearTimeout(id)
  }, [centredId, bodyText, nextStar])

  if (stars.length === 0) return null

  return (
    <div className={styles.stage} aria-live="polite">
      {/* ── 흩어진 별들 ─────────────────────────────── */}
      {stars.map((star, i) => (
        <ShowcaseStar
          key={star.id}
          star={star}
          spot={spots[i]}
          centred={i === index}
          /* 가운데에 하나가 있을 때 나머지는 물러난다. 사라지지는 않는다. */
          receded={index >= 0 && i !== index}
        />
      ))}

      {/* ── 그 사람의 시간 ──────────────────────────── */}
      <AnimatePresence mode="wait">
        {centred && content && (
          <motion.div
            key={centred.id}
            className={styles.telling}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10, filter: 'blur(5px)' }}
            /*
             * 별이 **다 온 뒤에** 배어 나온다. 움직이는 중에 글이 떠오르면
             * 둘 다 놓친다 — 네 토막은 겹치지 않고 차례로 지나간다.
             */
            transition={{
              duration: VIEWING.tellFadeMs / 1000,
              delay: TELL_AT / 1000,
              ease: EASE,
            }}
            data-safe=""
          >
            <p className={styles.marks}>
              <span style={{ color: content.emotion.light.halo }}>{content.emotion.label}</span>
              <span className={styles.dot} aria-hidden="true">·</span>
              <span>{content.how}</span>
              {content.when && (
                <>
                  <span className={styles.dot} aria-hidden="true">·</span>
                  <span>{content.when}</span>
                </>
              )}
            </p>

            {content.text ? (
              <p className={styles.sentence}>{content.text}</p>
            ) : (
              /*
               * 공개에 동의하지 않은 시간.
               * 숨긴 것이 아니라 묻지 않았다는 것을 말해 둔다.
               */
              <p className={styles.sealed}>{UNIVERSE.viewing.private}</p>
            )}

            {content.reason === 'mine' && (
              <p className={styles.mine}>{UNIVERSE.viewing.mine}</p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 아래 단 ─────────────────────────────────── */}
      <div className={styles.foot} data-safe="">
        <AnimatePresence mode="wait">
          {finished ? (
            <motion.div
              key="closing"
              className={styles.choices}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, ease: EASE }}
            >
              <p className={styles.closing}>{UNIVERSE.viewing.closing}</p>
              <span className={styles.links}>
                <button
                  type="button"
                  className={`tap ${styles.link}`}
                  data-sound="ui.forward"
                  onClick={replayViewing}
                >
                  {UNIVERSE.viewing.again}
                </button>
                <button
                  type="button"
                  className={`tap ${styles.link}`}
                  data-sound="ui.back"
                  onClick={goHome}
                >
                  {UNIVERSE.viewing.done}
                </button>
              </span>
            </motion.div>
          ) : centred ? (
            <motion.div
              key="walking"
              className={styles.choices}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.4, delay: TRAVEL, ease: EASE }}
            >
              <p className={styles.nth}>{UNIVERSE.viewing.nth(index + 1, stars.length)}</p>
              {/*
                스스로 넘어가므로 누를 일이 없다. 그래도 둘을 남긴다 —
                먼저 보고 싶은 사람과, 그만 보고 싶은 사람을 위해.
                '다음 별'을 누르면 번호가 바뀌고, 시계는 거기서 다시 걸린다.
              */}
              <span className={styles.links}>
                <button
                  type="button"
                  className={`tap ${styles.link}`}
                  data-sound="ui.forward"
                  onClick={nextStar}
                >
                  {UNIVERSE.viewing.next}
                </button>
                <button
                  type="button"
                  className={`tap ${styles.link}`}
                  data-sound="ui.back"
                  onClick={goHome}
                >
                  {UNIVERSE.viewing.stop}
                </button>
              </span>
            </motion.div>
          ) : (
            <motion.p
              key="opening"
              className={styles.opening}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.8, ease: EASE }}
            >
              {UNIVERSE.viewing.opening}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

/**
 * 별 하나.
 *
 * 세 겹으로 그린다 — 잔광 · 외곽광 · 중심광. 캔버스의 별과 같은 순서이고,
 * 색도 같은 곳(`emotions.ts`)에서 온다.
 *
 * 간직한 빛에는 얇은 갈래가 있고 흘려보낸 빛에는 없다 — 원작의 규칙 그대로다.
 * **색은 마음이 정하고, 이 갈래와 밝기는 간직/흘려보내기가 정한다.**
 */
function ShowcaseStar({
  star,
  spot,
  centred,
  receded,
}: {
  star: UniverseStar
  spot: ShowcaseSpot
  centred: boolean
  receded: boolean
}) {
  const { emotion, how } = contentOf(star, '')
  const keep = star.type === 'keep'
  const light = emotion.light

  // 가운데에서는 커지되, 화면을 삼키지 않는다
  const size = (centred ? 2.5 : 1) * spot.scale

  return (
    <motion.div
      className={styles.star}
      initial={false}
      animate={{
        left: centred ? '50%' : `${spot.x * 100}%`,
        top: centred ? '38%' : `${spot.y * 100}%`,
        scale: size,
        opacity: centred ? 1 : receded ? 0.26 : 0.82,
      }}
      transition={{ duration: TRAVEL, ease: EASE }}
      aria-label={`${emotion.label} · ${how}`}
    >
      {/* 떠 있는 듯한 아주 느린 움직임. 멈춰 있으면 그건 하늘이 아니다. */}
      <motion.span
        className={styles.float}
        animate={{ y: [-spot.sway, spot.sway, -spot.sway] }}
        transition={{
          duration: 11 + spot.phase,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        <span
          className={styles.trail}
          style={{ background: `radial-gradient(circle, ${light.trail} 0%, transparent 68%)` }}
        />
        <span
          className={styles.halo}
          style={{
            background: `radial-gradient(circle, ${light.halo} 0%, transparent 62%)`,
            // 흘려보낸 빛은 번짐이 넓고 핵이 거의 없다 (원작의 두 톤 그대로)
            opacity: keep ? 0.72 : 0.9,
            transform: `scale(${keep ? 1 : 1.22})`,
          }}
        />
        {keep && (
          <svg className={styles.rays} viewBox="-50 -50 100 100" aria-hidden="true">
            <path
              d="M0 -46 L0 46 M-46 0 L46 0"
              stroke={light.core}
              strokeWidth="0.8"
              strokeLinecap="round"
              opacity="0.5"
            />
          </svg>
        )}
        <span
          className={styles.core}
          style={{
            background: light.core,
            boxShadow: `0 0 10px ${light.core}, 0 0 22px ${light.halo}`,
            transform: `scale(${keep ? 1 : 0.5})`,
          }}
        />
      </motion.span>
    </motion.div>
  )
}
