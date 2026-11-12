import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { YOUR_STAR } from '@/constants/text.exhibit'
import { useKiosk } from '@/store/useKiosk'
import { ActionButton } from '@/components/ActionButton'
import { play } from '@/audio'
import { colorFromDescription } from '@/lib/starVisual'
import { EASE, SCENE } from './motion'
import styles from './scene.module.css'
import own from './SceneYourStar.module.css'

/**
 * 나의 별 — 별이 우리의 우주에 닿은 뒤, **곧장** 들어서는 자리.
 *
 * ─── 순서가 또 한 번 바뀌었다 ──────────────────────────
 *  `useKiosk.finishSending`이 별을 배정하고(`state.yourStar`), 성공하면
 *  이제는 '도착' 화면을 거치지 않고 바로 이 화면으로 온다 — 그래서 이
 *  화면 자신이 ③ 토막에서 "당신의 별이 도착했습니다"를 보여 준다.
 *  전송은 이미 끝났다 — 여기서는 더 보낼 것이 없다.
 *
 *  `state.yourStar`가 비어 있으면(검증된 별이 하나도 없는, 있어서는 안 되는
 *  경우) store가 이 장면으로 오지도 않는다(그 폴백은 `SceneDone`이 맡는다) —
 *  그래도 방어적으로, 비어 있으면 아무것도 그리지 않는다.
 * ───────────────────────────────────────────────────────
 *
 * ─── 기본 화면은 아주 적게만 말한다 ─────────────────────
 *  실제 이름(가장 크게) · 시적인 이름(그 아래) · 위로 한 문장 · 소속
 *  별자리(작게) — 이 레이아웃·글자 크기·여백·배경·버튼 위치·애니메이션은
 *  건드리지 않는다.
 *
 *  '나의 별 이야기 보기'를 펼치면, "왜 하필 이 별인가"에 답하는 세
 *  문단(이유 → 이 별의 실제 특징 → 그 특징이 기억과 닿는 의미)이 보인다
 *  — `YOUR_STAR.story`, 내용은 `state.yourStar`에서 그대로 꺼내 쓴다.
 *
 *  **이 화면에는 "다음" 버튼이 따로 없다.** 영수증으로 가는 유일한 길은
 *  '나의 별 이야기 보기'를 지나는 것이다 — 그래서 그 버튼을 기본 화면의
 *  주요 행동으로 두고, 지나치기 어렵게 강조한다(`own.storyButtonPrimary`).
 * ───────────────────────────────────────────────────────
 *
 * 여섯 토막, 3.8초. SceneIntro와 같은 결의 박자다.
 *
 *   ① 0.3초  작은 빛 하나가 맺힌다
 *   ② 0.9초  번져 하나의 별이 된다 — 발견의 소리
 *   ③ 1.7초  "당신의 별이 도착했습니다."
 *   ④ 2.4초  실제 이름 — 소리가 한 번 더
 *   ⑤ 3.1초  시적인 이름
 *   ⑥ 3.8초  위로 한 문장 · 소속 별자리 · 아래 단
 *
 * '나의 별 이야기'를 열고 닫아도 이 박자는 되풀이되지 않는다 — beat는
 * 이 컴포넌트가 처음 설 때 한 번만 움직이고, 펼침 상태는 그와 별개다.
 */
const BEATS = [300, 900, 1700, 2400, 3100, 3800] as const

export function SceneYourStar() {
  const yourStar = useKiosk((state) => state.yourStar)
  const goTo = useKiosk((state) => state.goTo)

  const [beat, setBeat] = useState(0)
  const [storyOpen, setStoryOpen] = useState(false)

  useEffect(() => {
    const timers = BEATS.map((at, index) => globalThis.setTimeout(() => setBeat(index + 1), at))
    return () => timers.forEach((id) => globalThis.clearTimeout(id))
  }, [])

  useEffect(() => {
    if (beat === 2) play('star.born')
    if (beat === 4) play('view.tell')
  }, [beat])

  if (!yourStar) return null

  const light = colorFromDescription(yourStar.colorDescription)
  const keep = yourStar.type === 'keep'
  const slow = { duration: 1.2, ease: EASE }
  const rise = (step: number) => ({
    opacity: beat >= step ? 1 : 0,
    y: beat >= step ? 0 : 8,
    filter: beat >= step ? 'blur(0px)' : 'blur(6px)',
  })

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <AnimatePresence mode="wait">
        {storyOpen ? (
          <motion.div
            key="story"
            className={styles.middle}
            initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
            transition={{ duration: 0.8, ease: EASE }}
          >
            <div className={own.story} data-safe="">
              <p className={own.storyTitle}>{YOUR_STAR.story.title}</p>

              {/*
                세 가지(당신이 남긴 시간 · 이 별만의 실제 이야기 · 그래서
                이 별이 가지는 의미)를 라벨 붙은 목록으로 나란히 두지 않고,
                `buildAssignmentReason`이 이미 하나의 글로 이어 지어 둔 것을
                그대로 보여 준다(`yourStar.assignmentReason`).
              */}
              <p className={own.storyValue}>{yourStar.assignmentReason}</p>
            </div>
          </motion.div>
        ) : (
          <div key="main" className={styles.middle}>
            {/* ① ② 작은 빛 하나가 맺혔다가, 하나의 별로 번진다 */}
            <motion.div
              className={own.starStage}
              data-safe=""
              initial={{ opacity: 0, scale: 0.55 }}
              animate={{ opacity: beat >= 1 ? 1 : 0, scale: beat >= 2 ? 1 : 0.55 }}
              transition={{ duration: 1.2, ease: EASE }}
            >
              <span
                className={own.trail}
                aria-hidden="true"
                style={{ background: `radial-gradient(circle, ${light.trail} 0%, transparent 70%)` }}
              />
              {/*
                간직/흘려보내기는 여기서만 갈린다 — 별의 색(light)은 그대로다.
                간직: 따뜻하게 자리를 잡고 머문다. 흘려보내기: 아주 천천히
                번지고 가라앉기를 되풀이한다 — 놓아주는 가벼움.
              */}
              <motion.span
                className={own.halo}
                aria-hidden="true"
                style={{ background: `radial-gradient(circle, ${light.halo} 0%, transparent 64%)` }}
                animate={
                  keep
                    ? { opacity: 0.85, scale: 1 }
                    : { opacity: [0.5, 0.75, 0.5], scale: [1, 1.1, 1] }
                }
                transition={
                  keep
                    ? { duration: 2, ease: EASE }
                    : { duration: 5.5, ease: 'easeInOut', repeat: Infinity }
                }
              />
              <span
                className={own.core}
                aria-hidden="true"
                style={{ background: light.core, boxShadow: `0 0 14px ${light.core}, 0 0 30px ${light.halo}` }}
              />
            </motion.div>

            {/* ③ 도착을 알리는 한 줄 */}
            <motion.p className={own.arrived} data-safe="" animate={rise(3)} transition={slow}>
              {YOUR_STAR.arrived}
            </motion.p>

            {/* ④ 실제 이름 — 가장 크게 */}
            <motion.p className={own.realName} data-safe="" animate={rise(4)} transition={slow}>
              {yourStar.realStarName} ({yourStar.korean})
            </motion.p>

            {/* ⑤ 시적인 이름 — 바로 아래, 한 단계 작게 */}
            <motion.p className={own.poeticName} data-safe="" animate={rise(5)} transition={slow}>
              {yourStar.poeticName}
            </motion.p>

            {/* ⑥ 위로 한 문장 + 소속 별자리 */}
            <motion.div
              data-safe=""
              animate={rise(6)}
              transition={slow}
              style={{ display: 'grid', gap: '1em', justifyItems: 'center' }}
            >
              <p className={own.comfort}>{yourStar.comfortMessage}</p>
              <p className={own.constellation}>{yourStar.constellationKorean}</p>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className={styles.footCenter}>
        {storyOpen ? (
          <>
            <button
              type="button"
              className={`tap ${styles.back}`}
              data-sound="ui.back"
              onClick={() => setStoryOpen(false)}
            >
              {YOUR_STAR.storyClose}
            </button>
            <ActionButton
              label={YOUR_STAR.story.recordButton}
              onClick={() => goTo('receipt')}
            />
          </>
        ) : (
          <div className={own.storyPrompt} data-safe="">
            <button
              type="button"
              className={`tap ${own.storyButtonPrimary}`}
              data-sound="ui.tap"
              onClick={() => setStoryOpen(true)}
            >
              <span className={own.storyIcon} aria-hidden="true">
                <svg viewBox="-12 -12 24 24" fill="none">
                  <path
                    d="M0 -11 L0 11 M-11 0 L11 0"
                    stroke="currentColor"
                    strokeWidth="1.1"
                    strokeLinecap="round"
                  />
                  <circle cx="0" cy="0" r="1.9" fill="currentColor" />
                </svg>
              </span>
              <span>{YOUR_STAR.storyButton}</span>
            </button>
            <p className={own.storyHint}>{YOUR_STAR.storyHint}</p>
          </div>
        )}
      </div>
    </motion.div>
  )
}
