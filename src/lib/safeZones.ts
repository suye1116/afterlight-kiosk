import { useEffect, useState } from 'react'

/**
 * 글자가 있는 자리.
 *
 * 별자리 선과 판면의 안내선은 캔버스(가장 아래층)에 그려지므로 글자 **위**로
 * 올라오는 일은 없다. 그런데도 읽기 어려운 것은, 글자가 투명한 바탕 위에
 * 놓여 있어서 그 뒤로 밝은 선이 지나가면 대비가 무너지기 때문이다.
 *
 * 그래서 글자가 놓인 자리를 하늘에 알려 준다. 하늘은 그 자리에서 선을
 * 긋지 않는다 — 선이 글자 뒤에서 끊겨, 마치 글자가 선을 가린 것처럼 보인다.
 *
 * 자리를 알리고 싶은 요소에 `data-safe`만 붙이면 된다.
 * 어느 화면이든, 어떤 요소든 같은 방법이다.
 */

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

/**
 * 글자 둘레에 더 두는 여백.
 *
 * 글자에 딱 맞춰 끊으면 획 바로 옆에서 선이 다시 시작해 오히려 어지럽다.
 * 한 뼘 더 비워 두어야 '그 자리는 글자의 자리'로 읽힌다.
 */
const PAD = 10
/** 좁은 화면에서는 선과 글자가 더 쉽게 붙으므로 더 넓게 */
const PAD_NARROW = 14

function measure(): Rect[] {
  const doc = globalThis.document
  if (!doc) return []

  const pad = (globalThis.innerWidth || 1024) < 640 ? PAD_NARROW : PAD
  const zones: Rect[] = []

  for (const node of doc.querySelectorAll('[data-safe]')) {
    const box = node.getBoundingClientRect()
    // 아직 뜨지 않았거나 접힌 것은 자리를 차지하지 않는다
    if (box.width <= 0 || box.height <= 0) continue

    /*
     * 거의 투명한 글자는 비켜 줄 필요가 없다.
     * 물러나 있는 동안(재생 중의 NOW / THEN 같은)까지 하늘에 구멍을 내면,
     * 정작 보여야 할 별자리가 이유 없이 끊긴다.
     */
    const seen = Number(globalThis.getComputedStyle(node).opacity)
    if (Number.isFinite(seen) && seen < 0.3) continue

    zones.push({
      x: box.left - pad,
      y: box.top - pad,
      w: box.width + pad * 2,
      h: box.height + pad * 2,
    })
  }

  return zones
}

function same(a: Rect[], b: Rect[]): boolean {
  if (a.length !== b.length) return false
  return a.every((one, i) => {
    const other = b[i]
    // 1px 아래의 떨림은 같은 자리로 본다. 그래야 매번 다시 그리지 않는다.
    return (
      Math.abs(one.x - other.x) < 1 &&
      Math.abs(one.y - other.y) < 1 &&
      Math.abs(one.w - other.w) < 1 &&
      Math.abs(one.h - other.h) < 1
    )
  })
}

/**
 * 지금 화면에서 글자가 차지한 자리들.
 *
 * 글자는 장면이 바뀔 때마다 나타나고 물러나고 자리를 옮긴다. 그 모든
 * 경우를 일일이 알려 주는 대신, 짧은 간격으로 다시 재고 달라졌을 때만
 * 새 값을 낸다 — 요소 몇 개를 재는 일이라 값이 거의 들지 않는다.
 */
export function useSafeZones(): Rect[] {
  const [zones, setZones] = useState<Rect[]>([])

  useEffect(() => {
    const look = () => setZones((was) => {
      const now = measure()
      return same(was, now) ? was : now
    })

    look()
    const timer = globalThis.setInterval(look, 300)
    globalThis.addEventListener('resize', look)
    globalThis.visualViewport?.addEventListener('resize', look)
    return () => {
      globalThis.clearInterval(timer)
      globalThis.removeEventListener('resize', look)
      globalThis.visualViewport?.removeEventListener('resize', look)
    }
  }, [])

  return zones
}
