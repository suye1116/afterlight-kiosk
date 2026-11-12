import { motion } from 'framer-motion'
import { FINALE } from '@/constants/text.exhibit'
import { useKiosk } from '@/store/useKiosk'
import { ActionButton } from '@/components/ActionButton'
import { RISE, SCENE } from './motion'
import styles from './scene.module.css'

/**
 * 전시의 마지막 선택.
 *
 * 영수증까지 다 본 뒤, 딱 한 번 묻는다. 우리의 우주로 가는 길은
 * 이제부터는 **여기뿐이다** — 그전(실제 별 소개·영수증)에는 그 길을
 * 열어 두지 않는다. 두 길은 같은 무게다. `SceneDone`의 '묻는 자리'와
 * 같은 결이라, 그 화면이 쓰던 `.invite`·`.choices`를 그대로 가져왔다.
 *
 * "이대로 마치기"는 새 동작이 아니라 `toCardGuide()`를 그대로 쓴다 —
 * 실제 별이 있으면 그 별자리 카드를 한 번 안내하고, 없으면 곧장
 * 처음으로 보낸다. "우리의 우주 보기" 쪽에서 돌아올 때도 같은
 * `toCardGuide()`를 거치므로, 카드 안내는 어느 길을 골라도 **한 번만** 뜬다.
 */
export function SceneFinale() {
  const sent = useKiosk((state) => state.sent)
  const showUniverse = useKiosk((state) => state.showUniverse)
  const toCardGuide = useKiosk((state) => state.toCardGuide)

  if (!sent) return null

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <motion.div className={styles.middle} {...RISE}>
        <p className={styles.invite} data-safe="">
          <span>{FINALE.title}</span>
          <span>{FINALE.desc}</span>
        </p>

        <div className={styles.choices} data-safe="">
          <ActionButton label={FINALE.seeUniverse} onClick={showUniverse} />
          <ActionButton label={FINALE.finish} onClick={toCardGuide} />
        </div>
      </motion.div>
    </motion.div>
  )
}
