import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { RECEIPT } from '@/constants/text.exhibit'
import { buildReceipt } from '@/lib/receipt'
import { play } from '@/audio'
import { formatStamp } from '@/lib/starMath'
import type { UniverseStar } from '@/types'
import { EASE } from '@/scenes/motion'
import styles from './Receipt.module.css'

/**
 * 영수증.
 *
 * ─── 종이와 화면이 같아야 한다 ─────────────────────────
 *  **아직 실제 프린터는 연결하지 않았다.** 다리(`server/printer.js`)가
 *  기본으로 파일에 쌓는다.
 *
 *  적히는 것은 `lib/receipt.ts` **한 곳**에서 나온다. 화면과 종이가 따로
 *  있으면 언젠가 어긋나고, 그때 사람이 보는 것과 손에 쥐는 것이 달라진다.
 *
 *  **기록 원문은 적지 않는다.** 종이는 전시장에 남고, 사진으로 찍히고,
 *  누군가의 손을 거친다. 적히는 것은 그 사람이 '고른' 것들뿐이다.
 * ───────────────────────────────────────────────────────
 *
 * 흰 종이를 그리지 않는다. 이 작품에 흰 문서 페이지는 없다.
 * 어두운 하늘 위에 크림빛 글자와 점선만 놓여, 종이의 '구성'만 보여 준다.
 */
export function Receipt({ star, company, onClose }: {
  star: UniverseStar
  /** 같은 감정의 빛이 몇 개인가 */
  company: number
  onClose: () => void
}) {
  const receipt = buildReceipt(star, company)

  /*
   * 종이가 펴지는 소리.
   *
   * **펼쳐지기 시작하는 그 순간**에 한 번. 이 자리는 영수증이 열릴 때
   * 새로 생기고 닫힐 때 거두어지므로, 한 번 펼칠 때 한 번만 울리고
   * 닫았다 다시 펼치면 다시 울린다 — 더 셈할 것이 없다.
   *
   * 이것은 **화면의 종이**가 펴지는 소리다. 프린터가 종이를 내보내는
   * 소리가 아니다 — 그 둘은 다른 일이고, 프린터는 아직 연결되지 않았다.
   */
  useEffect(() => {
    play('receipt.open')
  }, [])

  return (
    <motion.div
      className={styles.sheet}
      initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
      animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
      exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
      transition={{ duration: 0.9, ease: EASE }}
      role="dialog"
      aria-label={RECEIPT.subtitle}
      data-safe=""
    >
      <p className={styles.wordmark}>{RECEIPT.wordmark}</p>
      <p className={styles.subtitle}>{RECEIPT.subtitle}</p>

      <span className={styles.rule} />

      <p className={styles.meta}>
        <span>{RECEIPT.no(receipt.seq)}</span>
        <span>{formatStamp(receipt.at)}</span>
      </p>

      <span className={styles.rule} />

      <dl className={styles.rows}>
        <div className={styles.row}>
          <dt>{RECEIPT.labels.when}</dt>
          <dd>{receipt.when}</dd>
        </div>
        <div className={styles.row}>
          <dt>{RECEIPT.labels.emotion}</dt>
          <dd>{receipt.emotion}</dd>
        </div>
        <div className={styles.row}>
          <dt>{RECEIPT.labels.how}</dt>
          <dd>{receipt.how}</dd>
        </div>
      </dl>

      {/* 기본으로는 없다. `lib/receipt.ts`에서 켰을 때만 적힌다. */}
      {receipt.text && <p className={styles.quote}>“{receipt.text}”</p>}

      <span className={styles.rule} />

      <p className={styles.company}>
        당신의 빛은 우리의 우주에서
        <br />
        같은 {receipt.emotion}의 빛 {receipt.company}개와
        <br />
        함께 머물고 있습니다.
      </p>

      {/* 원작의 핵심 문장. 고치지 않는다. */}
      <p className={styles.closing}>
        {RECEIPT.closing.map((line) => (
          <span key={line}>{line}</span>
        ))}
      </p>

      <button type="button" className={`tap ${styles.close}`} data-sound="ui.back" onClick={onClose}>
        {RECEIPT.close}
      </button>
    </motion.div>
  )
}
