import { makeRandom } from '@/lib/random'
import { bandWeight } from '@/lib/noise'

/**
 * 주변 별을 만든다. 캔버스와 무관한 순수 함수다.
 *
 * 별의 네 가지 표현:
 *   point — 아주 작은 점. 하늘의 대부분이다.
 *   soft  — 작은 핵에 옅은 테두리
 *   bloom — 핵 없이 흐릿하게 번지는 잔광
 *   spike — 십자로 터지는 빛. 아주 드물다.
 */
export type StarKind = 'point' | 'soft' | 'bloom' | 'spike'

export interface AmbientStar {
  x: number // 0~1
  y: number // 0~1
  size: number
  alpha: number
  color: string
  kind: StarKind
  /** 0(멀다) ~ 1(가깝다). 시차 이동량을 정한다. */
  depth: number
  /** 숨 쉬는 별인가. 대부분은 아니다. */
  breathes: boolean
  speed: number
  phase: number
  amplitude: number
}

/**
 * 별의 색.
 *
 * 흰색과 크림색이 절반을 넘고, 금빛과 앰버가 그 뒤를 받친다.
 * 살구빛과 붉은빛은 양념이고, 푸른빛은 전체의 6%뿐이다.
 * 이 비율이 무너지면 곧바로 SF 우주가 된다.
 */
export const STAR_PALETTE: ReadonlyArray<{ color: string; weight: number }> = [
  { color: '#fffdf7', weight: 28 }, // 흰빛
  { color: '#fff3dd', weight: 24 }, // 크림
  { color: '#ffe3b8', weight: 17 }, // 금빛
  { color: '#f8c98f', weight: 13 }, // 앰버
  { color: '#eeab7d', weight: 8 },  // 옅은 주황
  { color: '#dd9184', weight: 4 },  // 살구·붉은빛
  { color: '#c6cfee', weight: 6 },  // 극소량의 청보라
]

const PALETTE_TOTAL = STAR_PALETTE.reduce((sum, entry) => sum + entry.weight, 0)

function pickColor(roll: number): string {
  let threshold = roll * PALETTE_TOTAL
  for (const entry of STAR_PALETTE) {
    threshold -= entry.weight
    if (threshold <= 0) return entry.color
  }
  return STAR_PALETTE[0].color
}

function pickKind(roll: number): StarKind {
  if (roll < 0.63) return 'point'
  if (roll < 0.85) return 'soft'
  if (roll < 0.94) return 'bloom'
  return 'spike'
}

export function buildAmbient(count: number, seed: number): AmbientStar[] {
  const random = makeRandom(seed)
  const stars: AmbientStar[] = []

  for (let i = 0; i < count; i += 1) {
    // 띠를 따라 별이 더 모이게 한다. 균일하게 뿌리면 벽지가 된다.
    let x = random()
    let y = random()
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const accept = 0.34 + 0.66 * bandWeight(x, y)
      if (random() < accept) break
      x = random()
      y = random()
    }

    const depth = random()
    const kind = pickKind(random())
    const color = pickColor(random())

    // 숨 쉬는 별은 넷 중 하나뿐이다. 나머지는 정지해 있다.
    const breathes = random() < 0.26

    stars.push({
      x,
      y,
      /*
       * 배경 별은 장식이다. 더 작고 더 어둡게, 더 멀리 있는 것처럼 둔다.
       *
       * 사용자가 만든 별이 눈에 띄어야 하는데, 화면 전체를 밝히는 방식으로는
       * 안 된다. 그래서 반대로 간다 — 배경을 뒤로 물려 자리를 내준다.
       */
      size: kind === 'point' ? 0.5 + random() * 0.5 : 0.62 + depth * depth * 1.3,
      alpha:
        kind === 'point'
          ? 0.2 + random() * 0.36
          : kind === 'bloom'
            ? 0.1 + random() * 0.18
            : 0.22 + random() * 0.32,
      color,
      kind,
      depth,
      breathes,
      // 주기 35초 ~ 130초. 쳐다보고 있어야 겨우 알아챌 만큼 느리다.
      speed: 0.048 + random() * 0.132,
      phase: random() * Math.PI * 2,
      amplitude: 0.1 + random() * 0.14,
    })
  }

  return stars
}
