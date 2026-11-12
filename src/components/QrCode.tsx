import qrcode from 'qrcode-generator'

/**
 * QR코드 하나를 SVG로 그린다.
 *
 * ─── 왜 직접 그리는가 ──────────────────────────────────
 *  `qrcode-generator`는 모듈(흑백 점) 배치만 계산한다
 *  (`isDark(row, col)`) — 그 모양을 어떻게 그릴지는 이 프로젝트의
 *  다른 아이콘들(`ActionButton`의 별, `SceneCardGuide`의 광채)처럼
 *  직접 SVG로 쓴다. 그래서 라이브러리가 내놓는 그림을 그대로 쓰지
 *  않고 흑백 사각형만 가져와 이 컴포넌트가 그린다.
 *
 *  **색은 늘 흑백이다.** 이 작품은 화면에서는 어두운 배경에 크림빛
 *  글자를 쓰지만, QR코드는 실제로 종이에 찍히는 것이라 인쇄 대비가
 *  먼저다 — 감열 프린터는 어차피 흰 종이에 검정 점만 찍을 수 있고,
 *  화면에서도 반전된(밝은 점) QR은 일부 스캐너가 읽지 못한다.
 * ───────────────────────────────────────────────────────
 */
export function QrCode({
  value,
  size = 96,
  label,
}: {
  /** QR코드가 담을 주소 또는 글자 */
  value: string
  /** 화면에 보이는 한 변의 크기(px) */
  size?: number
  /** 스캐너가 아니라 사람을 위한 설명(접근성) */
  label: string
}) {
  const qr = qrcode(0, 'M')
  qr.addData(value)
  qr.make()
  const count = qr.getModuleCount()

  const modules: string[] = []
  for (let row = 0; row < count; row += 1) {
    for (let col = 0; col < count; col += 1) {
      if (qr.isDark(row, col)) modules.push(`M${col},${row}h1v1h-1z`)
    }
  }

  return (
    <svg
      viewBox={`0 0 ${count} ${count}`}
      width={size}
      height={size}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
    >
      <rect width={count} height={count} fill="#ffffff" />
      <path d={modules.join('')} fill="#111111" />
    </svg>
  )
}
