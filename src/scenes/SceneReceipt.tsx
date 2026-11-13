import { motion } from 'framer-motion'
import { DONE } from '@/constants/text.exhibit'
import { Receipt } from '@/components/Receipt'
import { useKiosk } from '@/store/useKiosk'
import { useBridge } from '@/store/useBridge'
import { RISE, SCENE } from './motion'
import styles from './scene.module.css'

/**
 * 영수증 미리보기 — '나의 별 이야기'를 다 읽은 뒤의 자리.
 *
 * ─── 바뀐 것은 자리뿐이다 ───────────────────────────────
 *  영수증의 디자인·데이터·"닫기" — 전부 `components/Receipt.tsx` 한
 *  곳에서 나오고, **이 파일은 그 컴포넌트를 한 글자도 고치지 않았다.**
 *  예전에는 '도착' 화면 안에서 눌러야 펼쳐지는 것이었는데, 이제는
 *  전시 순서상 그 자체가 독립된 한 걸음이 되었을 뿐이다.
 * ───────────────────────────────────────────────────────
 *
 * ─── 출력은 여기서 청하지 않는다 ───────────────────────
 *  진짜 프린터로 보내는 일은 `useKiosk.finishSending`의
 *  `markArrived().then()` 안에서, 도착이 확인된 뒤 **이미 한 번** 일어난다.
 *  이 화면은 그 결과를 보여 주기만 하므로, 여기서 다시 청하면 두 번
 *  찍히는 일이 생긴다 — 그래서 손대지 않았다. 프린터가 없거나 꺼져
 *  있어도 이 화면은 그대로 뜨고, 문구만 "영수증에 적혔습니다"로
 *  조용히 갈린다(`printing` 분기, `SceneDone`과 같은 규칙).
 * ───────────────────────────────────────────────────────
 */
export function SceneReceipt() {
  const sent = useKiosk((state) => state.sent)
  const stats = useKiosk((state) => state.stats)
  const yourStar = useKiosk((state) => state.yourStar)
  const receiptLookup = useKiosk((state) => state.receiptLookup)
  const goTo = useKiosk((state) => state.goTo)

  const printing = useBridge(
    (state) => state.link === 'open' && state.status?.printerMode === 'tcp',
  )

  if (!sent) return null

  const company = stats.byEmotion[sent.emotion] ?? 1
  // 지금 이 영수증(sent)을 기다리는 응답이 아니면(다른 별의 늦은 응답이면) 쓰지 않는다.
  const qr1 = receiptLookup && receiptLookup.starId === sent.id ? receiptLookup : null

  return (
    <motion.div className={styles.scene} {...SCENE}>
      <motion.div className={styles.middle} {...RISE}>
        <p className={styles.note} data-safe="">
          {printing ? DONE.receiptPrinting : DONE.receipt}
        </p>
        <Receipt
          star={sent}
          company={company}
          yourStar={yourStar}
          qr1={qr1}
          onClose={() => goTo('finale')}
        />
      </motion.div>
    </motion.div>
  )
}
