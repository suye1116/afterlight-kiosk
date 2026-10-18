import { useBridge } from '@/store/useBridge'
import { useKiosk } from '@/store/useKiosk'
import { bridgeUrl } from '@/lib/bridge'
import styles from './BridgePanel.module.css'

/**
 * 연결 상태 판.
 *
 * ─── 전시 빌드에는 나오지 않는다 ───────────────────────
 *  `TestPanel`과 같은 자리에서만 그려진다(`isTestMode`).
 *  작품 위에 계기판이 떠 있으면 그건 작품이 아니다.
 * ───────────────────────────────────────────────────────
 *
 * 다섯 가지를 **따로** 적는다. 하나로 묶으면 "별이 안 떠요"라는 말을 들었을 때
 * 어디를 고칠지 알 수 없다.
 *
 *   하늘↔다리 · 다리↔벽 · 아두이노 · 프린터 · 별이 어디까지 갔나
 *
 * 그리고 **아직 붙지 않은 것을 붙었다고 적지 않는다.**
 */

const LINK_NAME: Record<string, string> = {
  idle: '쉬는 중',
  connecting: '붙는 중…',
  open: '붙음',
  closed: '끊김',
}

const DEVICE_NAME: Record<string, string> = {
  off: '안 씀',
  opening: '여는 중…',
  open: '붙음',
  ready: '준비됨',
  error: '문제',
}

function Dot({ on }: { on: 'yes' | 'no' | 'warn' }) {
  return <span className={`${styles.dot} ${styles[on]}`} aria-hidden="true" />
}

export function BridgePanel() {
  const link = useBridge((state) => state.link)
  const status = useBridge((state) => state.status)
  const lastButton = useBridge((state) => state.lastButton)
  const sent = useKiosk((state) => state.sent)

  const linked = link === 'open'

  return (
    <aside className={styles.panel} aria-label="연결 상태">
      <p className={styles.title}>연결 상태</p>

      <p className={styles.row}>
        <Dot on={linked ? 'yes' : 'no'} />
        하늘 ↔ 다리 · {LINK_NAME[link] ?? link}
      </p>
      {!linked && <p className={styles.note}>{bridgeUrl()}</p>}
      {!linked && <p className={styles.note}>다리 없이도 체험은 그대로 됩니다</p>}

      {linked && status && (
        <>
          <p className={styles.row}>
            <Dot on={status.td > 0 ? 'yes' : 'no'} />
            다리 ↔ TouchDesigner · {status.td > 0 ? `${status.td}대` : '없음'}
          </p>
          {status.walls.length > 0 && (
            <p className={styles.note}>면: {status.walls.join(' · ')}</p>
          )}

          <p className={styles.row}>
            <Dot on={status.arduino === 'open' ? 'yes' : status.arduino === 'error' ? 'warn' : 'no'} />
            아두이노 · {DEVICE_NAME[status.arduino] ?? status.arduino}
          </p>
          {status.arduinoNote && <p className={styles.note}>{status.arduinoNote}</p>}

          <p className={styles.row}>
            <Dot on={status.printer === 'ready' ? 'yes' : status.printer === 'error' ? 'warn' : 'no'} />
            프린터 · {DEVICE_NAME[status.printer] ?? status.printer}
          </p>
          {status.printerNote && <p className={styles.note}>{status.printerNote}</p>}

          {/*
            넘긴 것 · 받은 것 · 띄운 것은 서로 다른 일이다.
            벽이 꺼져 있으면 넘김에서 멈추고, 받고도 못 띄우면 받음에서 멈춘다.
          */}
          <p className={styles.row}>
            <Dot on={status.stars.shown > 0 ? 'yes' : 'no'} />별
          </p>
          <p className={styles.note}>
            받아들임 {status.stars.accepted} · 넘김 {status.stars.relayed} · 벽이 받음{' '}
            {status.stars.received} · 벽에 띄움 {status.stars.shown}
          </p>
          {(status.rejected > 0 || status.duplicate > 0 || status.stripped > 0) && (
            <p className={styles.note}>
              거절 {status.rejected} · 중복 {status.duplicate} · 떨어낸 칸 {status.stripped}
            </p>
          )}
        </>
      )}

      {sent && <p className={styles.note}>방금 보낸 빛 {sent.id.slice(0, 10)}… · {sent.status}</p>}
      {lastButton && <p className={styles.note}>버튼 {lastButton.button}</p>}
    </aside>
  )
}
