import styles from '@/scenes/scene.module.css'

/** 네 걸음 중 어디쯤인가. 숫자를 쓰지 않는다 — 계기판이 되기 때문이다. */
export function StepDots({ step }: { step: 1 | 2 | 3 | 4 }) {
  return (
    <span className={styles.dots} aria-label={`${step} / 4`}>
      {[1, 2, 3, 4].map((index) => (
        <span
          key={index}
          className={`${styles.dot} ${
            index === step ? styles.dotOn : index < step ? styles.dotPast : ''
          }`}
        />
      ))}
    </span>
  )
}
