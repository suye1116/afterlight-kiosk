import { useState } from 'react'
import { EMOTIONS } from '@/constants/emotions'
import { TEST } from '@/constants/text.exhibit'
import { statsOf, universe } from '@/data'
import { useKiosk } from '@/store/useKiosk'
import styles from './TestPanel.module.css'

/**
 * 테스트 모드.
 *
 * ─── 전시 빌드에는 나오지 않는다 ───────────────────────
 *  `import.meta.env.DEV`이거나 주소에 `?test=1`이 붙었을 때만 그려진다.
 *  Vite가 프로덕션에서 DEV 분기를 false로 바꾸므로, 평소 빌드에서
 *  이 패널은 화면에 뜨지 않는다. (`?test=1`은 전시 전 현장 점검용이다.)
 * ───────────────────────────────────────────────────────
 *
 * 혼자서는 별자리를 볼 수 없다. 공동 우주는 여러 사람이 모여야 비로소
 * 별자리가 되는데, 혼자 시험하면서 스무 번을 보낼 수는 없다.
 * 그래서 가짜 관람객을 한꺼번에 보내는 길을 둔다.
 */

const SAMPLE_TEXTS = [
  '친구들과 처음 여행 갔던 날',
  '할머니 댁 마당의 여름 저녁',
  '아무 말 없이 걷기만 했던 밤',
  '처음으로 혼자 살게 된 방',
  '비 오는 날의 버스 창가',
  '마지막으로 손을 흔들던 순간',
  '아무도 없는 교실의 오후',
  '첫 월급으로 산 작은 화분',
  '이사 가기 전날의 빈 방',
  '눈이 많이 오던 겨울의 골목',
]

const WHEN = ['얼마 전', '1년쯤 전', '3년쯤 전', '10년쯤 전', '아주 오래전', '기억나지 않음']

export function TestPanel() {
  const syncUniverse = useKiosk((state) => state.syncUniverse)
  const stars = useKiosk((state) => state.stars)
  const [busy, setBusy] = useState(false)

  async function seed(count: number) {
    if (busy) return
    setBusy(true)
    try {
      for (let i = 0; i < count; i += 1) {
        const emotion = EMOTIONS[Math.floor(Math.random() * EMOTIONS.length)]
        // 흘려보낸 빛은 전체의 삼분의 일쯤. 실제 전시의 비율에 가깝다.
        const type = Math.random() < 0.34 ? 'letgo' : 'keep'
        const label = WHEN[Math.floor(Math.random() * WHEN.length)]
        const { star } = await universe.add({
          text: SAMPLE_TEXTS[Math.floor(Math.random() * SAMPLE_TEXTS.length)],
          type,
          emotion,
          timeRef: { kind: 'unknown', label },
          sessionId: `test-${Math.floor(Math.random() * 1e6).toString(36)}`,
          source: 'test',
        })
        // 점검용 빛은 건너가는 연출을 거치지 않는다. 곧바로 닿은 것으로 둔다.
        await universe.markArrived(star.id)
      }
      syncUniverse(await universe.refresh())
    } finally {
      setBusy(false)
    }
  }

  async function clear() {
    if (busy) return
    setBusy(true)
    try {
      // 점검용 통만 비운다. 실제 관람객의 빛은 다른 통에 있어 건드려지지 않는다.
      await universe.eraseTest()
      syncUniverse(await universe.refresh())
    } finally {
      setBusy(false)
    }
  }

  const stats = statsOf(stars)

  return (
    <aside className={styles.panel} aria-label={TEST.title}>
      <p className={styles.title}>{TEST.title}</p>
      <button type="button" disabled={busy} onClick={() => void seed(20)}>
        {TEST.seed}
      </button>
      <button type="button" disabled={busy} onClick={() => void seed(100)}>
        {TEST.seedMany}
      </button>
      <button type="button" disabled={busy} onClick={() => void clear()}>
        {TEST.clear}
      </button>
      <p className={styles.note}>
        실제 {stats.live} · 점검 {stats.test}
      </p>
      <p className={styles.note}>
        간직 {stats.keep} · 흘려보냄 {stats.letgo}
      </p>
      <p className={styles.note}>{TEST.note}</p>
    </aside>
  )
}
