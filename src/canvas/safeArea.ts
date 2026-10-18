import { FIELD } from '@/lib/starMath'
import { lerp } from '@/lib/random'

/**
 * 안전 영역.
 *
 * 별이 화면 가장자리에 붙거나 내비게이션·안내문 아래로 들어가면
 * 보이지도 않고 누를 수도 없다. 그래서 그릴 때 한 번 더 안으로 들인다.
 *
 * 저장된 좌표를 자르지(clamp) 않고 **다시 매핑한다.** 자르면 바깥에 있던
 * 별들이 경계선에 한 줄로 늘어서지만, 매핑하면 서로의 간격이 유지된다.
 * 그래서 예전에 저장한 기억도 자기 별자리 모양을 잃지 않는다.
 */

export interface SafeArea {
  left: number
  right: number
  top: number
  bottom: number
}

/** 좁은 화면에서는 더 많이 들인다. 손가락이 가장자리에 닿기 어렵기 때문이다. */
const NARROW = 640

export function safeAreaFor(width: number, height: number): SafeArea {
  const narrow = width < NARROW

  // 가로: 요구대로 데스크톱 8.5vw, 모바일 12vw
  const side = narrow ? 0.12 : 0.085

  /*
   * 세로: 위에는 내비게이션과 작품 문장이, 아래에는 개수·잔광 보기·보내기가 있다.
   * 그 아래로 별이 들어가면 글자에 묻힌다.
   * 화면이 낮을수록(가로로 눕힌 휴대폰) 글자가 차지하는 비율이 커지므로 더 들인다.
   */
  const short = height < 560
  const top = narrow ? 0.26 : short ? 0.28 : 0.21
  const bottom = narrow ? 0.24 : short ? 0.26 : 0.19

  return { left: side, right: 1 - side, top, bottom: 1 - bottom }
}

/** 저장된 자리를 이 화면의 안전 영역 안으로 옮긴다 */
export function toSafe(x: number, y: number, area: SafeArea): { x: number; y: number } {
  const tx = (x - FIELD.left) / (FIELD.right - FIELD.left)
  const ty = (y - FIELD.top) / (FIELD.bottom - FIELD.top)
  return {
    // 저장 범위 밖의 옛 값이 들어와도 안전 영역을 벗어나지 않게 한 번 묶는다
    x: lerp(area.left, area.right, Math.min(1, Math.max(0, tx))),
    y: lerp(area.top, area.bottom, Math.min(1, Math.max(0, ty))),
  }
}
