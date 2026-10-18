import { makeRandom } from './random'

/**
 * 성운을 만드는 재료.
 *
 * 성운을 원형 그라디언트 몇 개로 겹치면 아무리 흐려도 '원'이 보인다.
 * 레퍼런스의 오래된 천체사진에는 원이 없다. 밀도가 불규칙하게 뭉치고 끊긴다.
 * 그 불규칙함은 잡음에서 나온다.
 */

const SIZE = 256
const MASK = SIZE - 1

/** 값 잡음. 격자에 난수를 깔고 부드럽게 보간한다. */
export function makeNoise2D(seed: number): (x: number, y: number) => number {
  const random = makeRandom(seed)
  const grid = new Float32Array(SIZE * SIZE)
  for (let i = 0; i < grid.length; i += 1) grid[i] = random()

  return (x, y) => {
    const xi = Math.floor(x)
    const yi = Math.floor(y)
    const xf = x - xi
    const yf = y - yi

    // 격자를 넘어가면 되감는다. 덕분에 좌표가 아무리 커도 끊기지 않는다.
    const x0 = xi & MASK
    const y0 = yi & MASK
    const x1 = (x0 + 1) & MASK
    const y1 = (y0 + 1) & MASK

    // smoothstep. 선형 보간만 쓰면 격자 자국이 남는다.
    const u = xf * xf * (3 - 2 * xf)
    const v = yf * yf * (3 - 2 * yf)

    const a = grid[y0 * SIZE + x0]
    const b = grid[y0 * SIZE + x1]
    const c = grid[y1 * SIZE + x0]
    const d = grid[y1 * SIZE + x1]

    const top = a + (b - a) * u
    const bottom = c + (d - c) * u
    return top + (bottom - top) * v
  }
}

/**
 * 프랙탈 잡음. 같은 잡음을 크기를 줄여 가며 겹친다.
 * 큰 덩어리와 잔가지가 한 번에 생겨 구름처럼 보인다.
 */
export function makeFbm(
  seed: number,
  octaves = 4,
  gain = 0.5,
  lacunarity = 2.07,
): (x: number, y: number) => number {
  const noise = makeNoise2D(seed)

  return (x, y) => {
    let sum = 0
    let amplitude = 1
    let frequency = 1
    let total = 0

    for (let i = 0; i < octaves; i += 1) {
      sum += noise(x * frequency, y * frequency) * amplitude
      total += amplitude
      amplitude *= gain
      // 2의 배수를 그대로 쓰면 옥타브가 겹쳐 격자가 보인다. 살짝 어긋낸다.
      frequency *= lacunarity
    }

    return sum / total
  }
}

/**
 * 화면을 비스듬히 가로지르는 띠.
 *
 * 은하수처럼, 빛의 밀도가 한가운데가 아니라 한쪽 대각선을 따라 높아진다.
 * 중앙을 밝히는 전형적인 우주 배경을 피하는 장치다.
 */
export function bandWeight(x: number, y: number): number {
  // 좌하 → 우상으로 지나는 선에서 얼마나 떨어져 있는가
  const distance = Math.abs(y - (0.88 - 0.64 * x)) / 0.4
  return Math.exp(-distance * distance * 2.1)
}
