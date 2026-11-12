import { motion } from 'framer-motion'
import type { Season } from '@/types'
import { SEASON } from '@/constants/text.exhibit'
import { COMPOSE } from '@/constants/text.inherited'
import { useKiosk } from '@/store/useKiosk'
import { ActionButton } from '@/components/ActionButton'
import { StepDots } from '@/components/StepDots'
import { RISE, SCENE } from './motion'
import styles from './scene.module.css'

/**
 * 한 걸음 반 — 그때는 어떤 계절이었나.
 *
 * `SceneRecord`에서 분리된 자리다. 적은 문장과 고른 시간은 이미 store에
 * 있으므로, 이 화면을 오가거나 뒤로 가도 지워지지 않는다(`useKiosk`는
 * 장면이 아니라 걸음 전체의 상태를 들고 있다).
 *
 * 시간(얼마나 먼 곳에서 오는가)과는 다른 축이라 따로 묻는다. 고르지 않아도
 * 다음으로 갈 수 있다 — 그때는 'unknown'으로 보낸다(`useKiosk.send`).
 */
export function SceneSeason() {
  const season = useKiosk((state) => state.season)
  const chooseSeason = useKiosk((state) => state.chooseSeason)
  const toEmotion = useKiosk((state) => state.toEmotion)
  const back = useKiosk((state) => state.back)

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <motion.div className={styles.middle} {...RISE}>
        <p className={styles.question} data-safe="">
          {SEASON.question}
        </p>

        <div className={styles.seasons} data-safe="">
          {SEASON.options.map((option) => {
            const chosen = season === option.key
            return (
              <button
                key={option.key}
                type="button"
                className={`tap ${styles.season} ${chosen ? styles.seasonOn : ''}`}
                aria-pressed={chosen}
                onClick={() => chooseSeason(chosen ? null : option.key)}
              >
                <SeasonIcon season={option.key} className={styles.seasonIcon} />
                <span>{option.label}</span>
              </button>
            )
          })}
        </div>

        <p className={styles.note} data-safe="">
          {SEASON.note}
        </p>

        <ActionButton label={COMPOSE.next} onClick={toEmotion} />
      </motion.div>

      <div className={styles.foot}>
        <button type="button" className={`tap ${styles.back}`} data-sound="ui.back" onClick={back}>
          {COMPOSE.back}
        </button>
        <StepDots step={3} />
      </div>
    </motion.div>
  )
}

/**
 * 계절의 선.
 *
 * 컬러 이모지 대신 얇은 선으로 그린다. 색은 여기서 정하지 않는다 —
 * `stroke="currentColor"`로 두어 쉬고 있을 때는 버튼의 은은한 아이보리
 * (`--light-400`), 고른 뒤에는 밝아진 색(`--light-100`)과 테두리 빛을
 * 그대로 물려받는다(`.seasonOn`, `scene.module.css`). 아이콘 자체에는
 * 그 밖의 발광이나 애니메이션을 더하지 않는다.
 *
 * 네 모양 모두 같은 24×24 칸, 같은 굵기(1.3)로 그렸다. '잘 모르겠어요'는
 * 계절이 아니므로 아이콘을 두지 않는다(원작의 일곱 마음이 아이콘 없이
 * 이름만 갖듯).
 */
const STROKE = {
  stroke: 'currentColor',
  fill: 'none',
  strokeWidth: 1.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

function SeasonIcon({ season, className }: { season: Season; className: string }) {
  switch (season) {
    case 'spring':
      // 작은 꽃 — 가운데 점을 두르는 다섯 꽃잎
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <g {...STROKE}>
            <ellipse cx="12" cy="7.6" rx="1.7" ry="3.2" />
            <ellipse cx="12" cy="7.6" rx="1.7" ry="3.2" transform="rotate(72 12 12)" />
            <ellipse cx="12" cy="7.6" rx="1.7" ry="3.2" transform="rotate(144 12 12)" />
            <ellipse cx="12" cy="7.6" rx="1.7" ry="3.2" transform="rotate(216 12 12)" />
            <ellipse cx="12" cy="7.6" rx="1.7" ry="3.2" transform="rotate(288 12 12)" />
            <circle cx="12" cy="12" r="1.3" />
          </g>
        </svg>
      )
    case 'summer':
      // 해 — 원 하나와 여덟 갈래 빛
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <g {...STROKE}>
            <circle cx="12" cy="12" r="4.3" />
            <line x1="18.3" y1="12" x2="20.8" y2="12" />
            <line x1="5.7" y1="12" x2="3.2" y2="12" />
            <line x1="12" y1="5.7" x2="12" y2="3.2" />
            <line x1="12" y1="18.3" x2="12" y2="20.8" />
            <line x1="16.46" y1="7.54" x2="18.22" y2="5.78" />
            <line x1="7.54" y1="7.54" x2="5.78" y2="5.78" />
            <line x1="16.46" y1="16.46" x2="18.22" y2="18.22" />
            <line x1="7.54" y1="16.46" x2="5.78" y2="18.22" />
          </g>
        </svg>
      )
    case 'autumn':
      // 나뭇잎 — 두 활꼴이 맺는 한 장의 잎과 가운데 잎맥
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <g {...STROKE} transform="rotate(18 12 12)">
            <path d="M12 5 A9 9 0 0 1 12 19 A9 9 0 0 0 12 5 Z" />
            <line x1="12" y1="6.4" x2="12" y2="17.6" />
            <line x1="12" y1="5" x2="11.1" y2="2.9" />
          </g>
        </svg>
      )
    case 'winter':
      // 눈송이 — 세 축이 만나는 가운데와 여섯 끝의 작은 가지
      return (
        <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
          <g {...STROKE}>
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="7.5" y1="19.79" x2="16.5" y2="4.21" />
            <line x1="7.5" y1="4.21" x2="16.5" y2="19.79" />
            <line x1="19.8" y1="10.7" x2="19.8" y2="13.3" />
            <line x1="4.2" y1="10.7" x2="4.2" y2="13.3" />
            <line x1="14.77" y1="19.41" x2="17.03" y2="18.11" />
            <line x1="6.97" y1="18.11" x2="9.23" y2="19.41" />
            <line x1="9.23" y1="4.6" x2="6.97" y2="5.9" />
            <line x1="17.03" y1="5.9" x2="14.77" y2="4.6" />
          </g>
        </svg>
      )
    default:
      // 잘 모르겠어요 — 계절이 아니므로 그릴 모양이 없다
      return null
  }
}
