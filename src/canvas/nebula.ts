import { clamp01, lerp } from '@/lib/random'
import { bandWeight, makeFbm } from '@/lib/noise'

/**
 * 성운의 픽셀을 계산한다.
 *
 * 캔버스에서 떼어낸 순수 함수다. 화면 없이도 결과를 확인할 수 있어야
 * '은은한가', '한곳에 몰리지 않는가'를 눈이 아니라 값으로도 볼 수 있다.
 *
 * RGB에 세기를 미리 곱해 둔다. 이 이미지는 'lighter'로 합성되므로
 * 어두운 곳은 0에 가까워 배경을 건드리지 않는다.
 */
export function paintNebulaPixels(data: Uint8ClampedArray, nw: number, nh: number): void {
  const shape = makeFbm(0x9e3a17, 5)
  const warmth = makeFbm(0x1c7742, 3)
  const cool = makeFbm(0x55b109, 2)
  // 성운을 가로지르는 어두운 먼지 길. 이게 없으면 한 덩어리 연기가 된다.
  const lane = makeFbm(0x3f21a4, 3)
  // 잔결. 매끈한 구름이 아니라 입자가 뭉친 것처럼 보이게 한다.
  const grit = makeFbm(0x77c1e6, 3)

  for (let j = 0; j < nh; j += 1) {
    for (let i = 0; i < nw; i += 1) {
      const u = i / nw
      const v = j / nh
      const p = (j * nw + i) * 4
      data[p + 3] = 255

      // 띠를 따라 두꺼워지되, 잡음이 가장자리를 헤쳐 놓는다
      const band = 0.2 + 0.8 * bandWeight(u, v)
      let d = shape(u * 3.4, v * 3.4) * band

      // 아래를 넉넉히 잘라 낸다. 빈 하늘이 있어야 성운이 성운으로 보인다.
      d = clamp01((d - 0.34) / 0.5)
      d = Math.pow(d, 2.2)

      // 먼지 길이 성운을 끊어 놓는다
      const laneValue = clamp01((lane(u * 4.6, v * 4.6) - 0.44) / 0.32)
      d *= 1 - laneValue * 0.74

      // 잔결
      d *= 0.62 + 0.38 * grit(u * 10.5, v * 10.5)

      if (d <= 0.004) continue

      // 러스트에서 앰버로. 두 색 사이를 잡음이 오간다.
      const w = warmth(u * 2.15, v * 2.15)
      let r = lerp(134, 214, w)
      let g = lerp(52, 124, w)
      let b = lerp(26, 54, w)

      // 그림자에만 청보라를 아주 조금.
      // 이 값이 0.2를 넘으면 곧바로 회보라 안개가 되어 따뜻함이 사라진다.
      const c = clamp01((cool(u * 1.72, v * 1.72) - 0.62) / 0.26)
      const coolMix = c * 0.2 * (1 - d)
      r = lerp(r, 56, coolMix)
      g = lerp(g, 62, coolMix)
      b = lerp(b, 116, coolMix)

      // 가장 두꺼운 곳에만 살구빛이 올라온다
      const hot = clamp01((d - 0.58) / 0.42)
      r = lerp(r, 236, hot * 0.62)
      g = lerp(g, 178, hot * 0.62)
      b = lerp(b, 130, hot * 0.62)

      // 전체 세기. 이 값 하나가 '은은함'과 '연기'를 가른다.
      const k = d * 0.42
      data[p] = r * k
      data[p + 1] = g * k
      data[p + 2] = b * k
    }
  }
}

/** 성운 위에 얹는 큰 결. 중심이 아니라 어긋난 세 곳에 둔다. */
export const NEBULA_DRIFTS: ReadonlyArray<{
  x: number
  y: number
  r: number
  color: string
  a: number
}> = [
  { x: 0.19, y: 0.73, r: 0.52, color: '#9a5024', a: 0.1 },
  { x: 0.76, y: 0.25, r: 0.44, color: '#b8752e', a: 0.09 },
  { x: 0.54, y: 0.9, r: 0.36, color: '#3a2f58', a: 0.035 },
]
