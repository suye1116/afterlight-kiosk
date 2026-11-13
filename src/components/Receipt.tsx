import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { RECEIPT } from '@/constants/text.exhibit'
import { buildReceipt } from '@/lib/receipt'
import { play } from '@/audio'
import { formatStamp } from '@/lib/starMath'
import type { AssignedStarView } from '@/lib/starAssignment'
import type { UniverseStar } from '@/types'
import { EASE } from '@/scenes/motion'
import { QrCode } from './QrCode'
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
 * (QR코드만은 예외다 — 실제로 종이에 찍혀 스캔되어야 하므로, 늘
 * 흑백으로 그린다. `components/QrCode.tsx` 참고.)
 *
 * ─── 실제 별 정보는 있을 때만 보여 준다 ────────────────
 *  `yourStar`가 없으면(검증된 별이 하나도 없는, 있어서는 안 되는
 *  경우) 그 블록과 첫 번째 QR코드를 통째로 그리지 않는다 — 없는
 *  별 정보를 지어내 보여 주지 않는다. 기존에 있던 항목(언제·감정·
 *  어떻게·함께 머무는 수·맺음 문장)은 그대로다.
 */
export function Receipt({ star, company, yourStar, qr1, onClose }: {
  star: UniverseStar
  /** 같은 감정의 빛이 몇 개인가 */
  company: number
  /** 이번에 실제로 배정된 별. 배정에 실패했으면 `null`. */
  yourStar: AssignedStarView | null
  /**
   * 서버가 확정한 QR1 주소의 상태. `yourStar`가 있어도 이게 `ready`가
   * 아니면 QR1을 그리지 않는다 — 모르는 주소를 지어내 보여 주지 않는다.
   */
  qr1: { status: 'pending' | 'ready' | 'unavailable'; url: string | null } | null
  onClose: () => void
}) {
  const receipt = buildReceipt(star, company, yourStar)
  /*
   * QR1을 실제로 그릴 수 있는가.
   *
   * `receipt.star`(화면에 보일 이름·시적 표현)는 즉시 있지만, 그 QR이
   * 가리킬 **실제 주소**는 서버가 Firebase에 적은 뒤에야 안다
   * (`store/useKiosk.ts`의 `applyReceiptLookup`). 그 전에는
   * `lib/starLookup.ts`의 임시 주소(위키백과)가 들어 있는데, 그걸 그대로
   * QR로 찍으면 '나의 별 이야기'가 아닌 곳으로 보낸다 — 그래서 여기서는
   * `receipt.star.lookupUrl`을 아예 쓰지 않고, 서버가 확정해 준
   * `qr1.url`만 믿는다.
   */
  const qr1Url = qr1?.status === 'ready' ? qr1.url : null
  const qr1Ready = Boolean(receipt.star) && Boolean(qr1Url)
  const qr1Pending = Boolean(receipt.star) && qr1?.status === 'pending'
  const showQr1Block = qr1Ready || qr1Pending

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

      {/*
        질문에 답하는 방식으로 적었을 때만(`receipt.text`와 같은 자리,
        같은 조건). 질문도 함께 보여야 그 답이 무엇에 대한 답인지 읽힌다.
      */}
      {receipt.prompt && (
        <div data-safe="" style={{ display: 'grid', gap: '0.4em', justifyItems: 'center' }}>
          <p className={styles.promptQuestion}>{receipt.prompt.question}</p>
          <p className={styles.quote}>“{receipt.prompt.answer}”</p>
        </div>
      )}

      {/*
        실제 별 배정 결과. `yourStar`가 없으면(있어서는 안 되는 경우)
        이 블록 전체를 그리지 않는다 — 없는 별을 지어내지 않는다.
      */}
      {receipt.star && (
        <>
          <span className={styles.rule} />
          <span className={styles.starGlyph} aria-hidden="true">
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
          <dl className={styles.rows}>
            <div className={styles.row}>
              <dt>{RECEIPT.star.realLabel}</dt>
              <dd>
                {receipt.star.realName} ({receipt.star.korean})
              </dd>
            </div>
            <div className={styles.row}>
              <dt>{RECEIPT.star.poeticLabel}</dt>
              <dd>{receipt.star.poeticName}</dd>
            </div>
            <div className={styles.row}>
              <dt>{RECEIPT.star.constellationLabel}</dt>
              <dd>{receipt.star.constellationKorean}</dd>
            </div>
          </dl>
          <p className={styles.quote}>{receipt.star.comfortMessage}</p>
        </>
      )}

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

      {/*
        두 QR코드 — 위아래로 쌓는다(58mm 감열지는 가로로 나란히 두면
        하나당 너무 작아져 스캔이 어려워진다). 각각 제목 한 줄 + 짧은
        설명 한 줄을 붙인다.
          ① 실제 하늘에서 나의 별 찾기 — `yourStar`가 있고, 서버가 그 주소를
             확정(`qr1.status === 'ready'`)했을 때만(지어내지 않는다).
             확정 전에는 "확인하는 중" 자리만 비워 둔다 — 임시 주소를
             QR처럼 찍지 않는다. 끝내 확정하지 못했으면(`unavailable`)
             이 자리 자체를 그리지 않는다.
          ② 우리의 우주 다시 만나기 — 실제 공개 주소가 있을 때만
             (`constants/deployment.ts`의 `PUBLIC_UNIVERSE_URL`).
             지금은 둘 다 없을 수도, 하나만 있을 수도 있다.
      */}
      {(showQr1Block || receipt.universeUrl) && (
        <>
          <span className={styles.rule} />
          <div className={styles.qrColumn}>
            {qr1Ready && receipt.star && qr1Url && (
              <div className={styles.qrItem}>
                <p className={styles.qrTitle}>{RECEIPT.qr.starTitle}</p>
                <QrCode
                  value={qr1Url}
                  size={132}
                  label={`${receipt.star.realName} — ${RECEIPT.qr.starTitle}`}
                />
                <p className={styles.qrHint}>{RECEIPT.qr.starHint}</p>
              </div>
            )}
            {qr1Pending && (
              <div className={styles.qrItem}>
                <p className={styles.qrTitle}>{RECEIPT.qr.starTitle}</p>
                <div className={styles.qrPending} aria-hidden="true" />
                <p className={styles.qrHint}>{RECEIPT.qr.starPending}</p>
              </div>
            )}
            {receipt.universeUrl && (
              <div className={styles.qrItem}>
                <p className={styles.qrTitle}>{RECEIPT.qr.universeTitle}</p>
                <QrCode value={receipt.universeUrl} size={132} label={RECEIPT.qr.universeTitle} />
                <p className={styles.qrHint}>{RECEIPT.qr.universeHint}</p>
              </div>
            )}
          </div>
        </>
      )}

      <button type="button" className={`tap ${styles.close}`} data-sound="ui.back" onClick={onClose}>
        {RECEIPT.close}
      </button>
    </motion.div>
  )
}
