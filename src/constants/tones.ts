import type { MemoryType, Tone } from '@/types'

/**
 * 두 개의 빛.
 *
 * 카드가 아니라 빛이다. 사용자는 항목을 고르는 게 아니라
 * 우주에 떠 있는 두 빛 중 하나를 고른다.
 *
 * 색은 레퍼런스 성운 사진에서 가져왔다. 간직하는 빛은 금빛으로 또렷하고,
 * 흘려보내는 빛은 회백에 아주 옅은 푸른기가 돈다 — 멀어지는 빛의 색이다.
 */
export const TONES: readonly Tone[] = [
  {
    type: 'keep',
    label: '간직하고 싶은 시간',
    glyph: '✦',
    core: '#fff4d6',
    halo: '#e8b45e',
    // 또렷하게 남는다
    brightness: [0.78, 1],
    coreScale: 1,
    haloScale: 1,
    spikes: true,
    cardLabel: '간직한 시간',
    hoverGain: 0.5,
    /*
     * 잔광 보기에서는 물러난다. 사라지지는 않는다 — 여전히 거기 있는 하늘이다.
     *
     * 0.6에서는 여전히 이쪽이 더 밝았다. 잔광을 보러 들어와 놓고
     * 간직한 빛을 먼저 보게 되면 그 모드는 제 일을 못 한 것이다.
     * 평소 밝기의 삼분의 일 언저리까지 내린다 — 눌리는 것은 그대로다.
     */
    afterglowAlpha: 0.32,
    // 어두워지기만 하는 것이 아니라 조금 작아진다. 멀어지는 빛이 그렇다.
    afterglowGrow: -0.24,
    // 채도를 덜어 낸 금빛. 색까지 물러나야 배경으로 읽힌다.
    afterglowHalo: '#b4a488',
    // 번짐을 거의 잃는다. 남는 것은 조용한 점 하나다.
    afterglowHaloGain: 0.4,
  },
  {
    type: 'letgo',
    label: '흘려보내고 싶은 시간',
    glyph: '○',
    core: '#e9eef4',
    halo: '#93a4b8',
    /*
     * 희미하게 흩어진다.
     *
     * 밝기를 더 낮추는 대신 핵을 줄이고 번짐을 넓혔다.
     * 어둡게만 만들면 못 찾게 되지만, 핵이 없고 번지기만 하면
     * '빛을 거의 잃었는데 아직 거기 있는' 느낌이 난다.
     */
    brightness: [0.42, 0.62],
    coreScale: 0.42,
    cardLabel: '흘려보낸 시간',
    // 0.12짜리 잔광은 같은 비율로 올리면 달라진 줄 모른다
    hoverGain: 1.5,
    /*
     * 잔광 보기에서는 확실히 보여야 한다.
     * 다만 간직한 빛(0.52)보다 밝되, 눈을 찌르지는 않는 선.
     */
    afterglowAlpha: 0.95,
    // 핵이 2px이라 밝기만 올려서는 못 찾는다. 크기로 함께 푼다.
    afterglowGrow: 1.05,
    /*
     * 핵보다는 넓지만 간직한 빛보다는 작다.
     * 핵이 거의 없으니 번짐이 상대적으로 커 보이되, 전체 덩치는 더 작아야
     * '물러난 빛'으로 읽힌다. 1.25로 두면 오히려 더 커 보였다.
     */
    haloScale: 0.92,
    spikes: false,
    /*
     * 조금 더 멀어진 빛의 색.
     *
     * 평소의 회백(#93a4b8)에서 푸른기를 덜고 아주 옅은 보랏빛을 얹었다.
     * 간직한 빛의 금빛과 나란히 두었을 때 '같은 빛의 흐린 것'이 아니라
     * '다른 데서 온 빛'으로 읽혀야 한다.
     */
    afterglowHalo: '#aeb4d2',
    // 번짐이 넓어지고 짙어진다. 잔광의 몸은 핵이 아니라 이 번짐이다.
    afterglowHaloGain: 1.5,
  },
] as const

const BY_TYPE = new Map<MemoryType, Tone>(TONES.map((tone) => [tone.type, tone]))

/** 저장된 값이 깨져 있어도 하늘은 계속 떠 있어야 한다. 그래서 기본값을 둔다. */
export function getTone(type: MemoryType | string | undefined): Tone {
  return (type && BY_TYPE.get(type as MemoryType)) || TONES[0]
}
