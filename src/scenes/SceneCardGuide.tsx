import { motion } from 'framer-motion'
import { CARD_GUIDE, DONE } from '@/constants/text.exhibit'
import { useKiosk } from '@/store/useKiosk'
import { ActionButton } from '@/components/ActionButton'
import { RISE, SCENE } from './motion'
import styles from './scene.module.css'
import own from './SceneCardGuide.module.css'

/**
 * 카드 안내 — 전시의 마지막 걸음.
 *
 * ─── 언제 여기 서는가 ──────────────────────────────────
 *  우리의 우주를 다 보고 "처음으로"를 누른 **바로 뒤**다
 *  (`SceneUniverse`의 버튼이 이제 `goHome` 대신 `toCardGuide`를 부른다).
 *  우리의 우주 화면 자체는 한 글자도 바꾸지 않았다 — 그 화면이 끝나는
 *  방식(관람객이 스스로 "처음으로"를 누르는 것)은 그대로이고, 그
 *  버튼이 데려가는 **다음 자리**만 하나 늘었다. 실제 별이 없으면
 *  (있어서는 안 되는 경우) `toCardGuide`가 이 화면을 건너뛰고 곧장
 *  처음으로 보낸다 — 그래서 `useKiosk.yourStar`가 비어 있을 때 이
 *  컴포넌트는 그려지지 않는다.
 * ───────────────────────────────────────────────────────
 *
 * ─── 개인화된 위로와 섞지 않는다 ───────────────────────
 *  여기 적히는 위로 메시지(`constellationCard.comfortMessage`)는
 *  **같은 별자리를 받은 모든 관람객에게 똑같이** 적히는 말이다.
 *  관람객 한 사람, 그 기억 하나만을 위한 시적인 이름·위로는 이미
 *  '나의 별' 화면에서 보여 주었다 — 여기서 되풀이하지 않는다.
 * ───────────────────────────────────────────────────────
 *
 * ─── 별자리 그림을 그리지 않는다 ───────────────────────
 *  `constants/realStars`에는 각 별의 검증된 적경·적위는 있지만,
 *  "이 별과 이 별을 어떤 선으로 잇는가"(전통적인 별자리 그림의 토폴로지)
 *  는 공인 자료로 다시 확인한 적이 없다 — 틀린 모양을 진짜처럼 보여
 *  주는 것보다, 이름과 메시지만 또렷이 보여 주는 쪽이 안전하다.
 *  그래서 중앙에는 특정 별자리의 모양을 흉내 내지 않는, 조용한 빛
 *  하나(`own.emblem`)만 둔다. 실제 모양이 필요해지면 이 자리를
 *  바꾸면 된다 — 무엇이 더 필요한지는 보고서에 남겨 둔다.
 * ───────────────────────────────────────────────────────
 */
export function SceneCardGuide() {
  const yourStar = useKiosk((state) => state.yourStar)
  const goHome = useKiosk((state) => state.goHome)

  if (!yourStar) return null

  const card = yourStar.constellationCard

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <motion.div className={styles.middle} {...RISE}>
        <p className={own.label} data-safe="">
          {CARD_GUIDE.label}
        </p>

        <p className={own.name} data-safe="">
          {yourStar.constellationKorean}
        </p>
        <p className={own.international} data-safe="">
          {card.international}
        </p>

        <div className={own.emblem} aria-hidden="true">
          <span className={own.emblemHalo} />
          <span className={own.emblemCore} />
        </div>

        <p className={own.comfort} data-safe="">
          {card.comfortMessage}
        </p>

        <p className={own.hint} data-safe="">
          {CARD_GUIDE.hint}
        </p>
      </motion.div>

      <div className={styles.footCenter}>
        <ActionButton label={DONE.home} onClick={goHome} />
      </div>
    </motion.div>
  )
}
