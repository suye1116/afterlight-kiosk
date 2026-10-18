import styles from '@/scenes/scene.module.css'

/**
 * 우주에서 빛 하나를 고르는 모양의 버튼.
 *
 * 원작 SceneCompose의 그것을 그대로 가져왔다. hover에서 버튼은 커지지도,
 * 배경이 채워지지도 않는다 — 가운데 별 하나가 살아날 뿐이다.
 */
export function ActionButton({
  label,
  disabled = false,
  onClick,
  sound = 'ui.forward',
}: {
  label: string
  disabled?: boolean
  onClick: () => void
  /**
   * 어떤 소리를 낼 것인가. `'none'`이면 내지 않는다 —
   * 그 버튼이 제 소리를 따로 가지고 있을 때(별을 보내는 버튼) 겹치지 않게.
   */
  sound?: string
}) {
  return (
    <button
      type="button"
      className={`tap ${styles.action}`}
      disabled={disabled}
      onClick={onClick}
      data-sound={sound}
    >
      <span className={styles.orbit} aria-hidden="true">
        <svg className={styles.star} viewBox="-12 -12 24 24" fill="none">
          <path
            d="M0 -11 L0 11 M-11 0 L11 0"
            stroke="currentColor"
            strokeWidth="1.1"
            strokeLinecap="round"
          />
          <path
            d="M-5.5 -5.5 L5.5 5.5 M5.5 -5.5 L-5.5 5.5"
            stroke="currentColor"
            strokeWidth="0.7"
            strokeLinecap="round"
            opacity="0.45"
          />
          <circle cx="0" cy="0" r="1.9" fill="currentColor" />
        </svg>
      </span>
      <span className={styles.label}>{label}</span>
    </button>
  )
}
