import type { Emotion, EmotionKey } from '@/types'

/**
 * 오늘의 마음 일곱.
 *
 * ─── 어디서 왔는가 ─────────────────────────────────────
 *  이름 · 색 · 번짐에 섞이는 정도(0.34) · `blends` · `mixColor` · `emotionHalo`는
 *  모두 원작 작업본(`src/constants/emotions.ts`)에서 그대로 가져왔다.
 *  **한 글자도 바꾸지 않았다.**
 *
 *  더한 것은 둘뿐이다.
 *    `form`   이 마음의 별이 타고나는 생김새
 *    `field`  공동 우주에서 이 별자리가 차지하는 하늘의 조각
 *  둘 다 원작에는 없던 것이다 — 원작의 하늘은 한 사람의 것이라
 *  별자리를 감정으로 나눌 일이 없었기 때문이다.
 * ───────────────────────────────────────────────────────
 *
 * 감정을 고르는 일이지만, 화면에 놓이는 것은 목록이 아니라 **일곱 개의 작은 빛**이다.
 * 색이 조금씩 다르고, 그 아래에 이름 하나가 있다. 아이콘도, 얼굴도, 점수도 없다 —
 * 그런 것이 붙는 순간 이 작품은 기분을 관리하는 도구가 된다.
 *
 * 색은 tokens.css의 밤과 빛 사이에서 골랐다. 어느 것도 원색이 아니고,
 * 어느 것도 차갑게 튀지 않는다. 별의 금빛 곁에 놓았을 때 '다른 빛'이 아니라
 * '같은 하늘의 다른 온도'로 읽혀야 한다.
 *
 * ## 하늘을 나누는 법
 *
 *   위 칸 (y 0.100~0.392)  행복 · 설렘 · 평온            셋 — 넓고 낮다
 *   아래 칸 (y 0.472~0.880)  불안 · 무기력 · 슬픔 · 기타   넷 — 좁고 높다
 *
 * 위가 셋, 아래가 넷이라 칸의 너비가 다르다. 높이로 그 차이를 메워
 * **일곱 조각의 넓이를 고르게** 맞췄다 — 한 조각만 먼저 차면
 * 그 마음의 별자리만 뭉개져 보이기 때문이다.
 *
 * 칸 사이에는 **고랑**을 둔다(세로 0.08). 맞붙여 놓으면 두 별자리의 빛이
 * 경계에서 나란히 앉아, 이어지지 않은 채 한 덩어리로 보인다.
 *
 * 조각은 자라지 않는다. 사람이 모이면 **그 안에서 촘촘해질 뿐이다**
 * (`lib/starMath.ts`의 `separationFor`). 어느 두 조각도 겹치지 않아야 하고,
 * 모두 FIELD(0.06~0.94 × 0.10~0.88) 안에 있어야 한다 — 검증 스크립트가 지킨다.
 */
export const EMOTIONS: readonly Emotion[] = [
  // 따뜻한 노란빛. 이 하늘의 기본 금빛에서 가장 가깝다.
  {
    type: 'happy',
    label: '행복',
    tint: '#f2d49a',
    blends: true,
    // 깊은 금빛. 이 하늘의 기본 금빛에서 가장 멀지 않다.
    light: { core: '#ffeec6', halo: '#e0a63a', trail: '#a8761f' },
    form: 'cross',
    field: { left: 0.06, right: 0.32, top: 0.1, bottom: 0.392 },
  },
  // 은은한 살구빛. 성운 근접 사진의 살구색에서 가져왔다.
  {
    type: 'flutter',
    label: '설렘',
    tint: '#eeb79f',
    blends: true,
    // 가라앉은 산호빛. 설렘은 붉되 튀지 않는다.
    light: { core: '#ffd9c8', halo: '#d9634e', trail: '#9e4132' },
    form: 'ember',
    field: { left: 0.37, right: 0.63, top: 0.1, bottom: 0.392 },
  },
  // 부드러운 청백색. 차갑게 가지 않도록 흰빛을 더 많이 섞었다.
  {
    type: 'calm',
    label: '평온',
    tint: '#cddde2',
    blends: true,
    // 깊은 청록. 차갑게 가지 않도록 녹색을 더 섞었다.
    light: { core: '#d2efe8', halo: '#38a08c', trail: '#246b5d' },
    form: 'soft',
    field: { left: 0.68, right: 0.94, top: 0.1, bottom: 0.392 },
  },
  // 차분한 보랏빛. 이 작품에서 푸른빛은 그림자에만 있으므로 채도를 낮췄다.
  {
    type: 'anxious',
    label: '불안',
    tint: '#b3a4cd',
    blends: true,
    // 보랏빛. 원작이 그림자에만 허락하던 색을 빛으로 올렸다.
    light: { core: '#e3d9f4', halo: '#8064c2', trail: '#574190' },
    form: 'halo',
    field: { left: 0.06, right: 0.246, top: 0.472, bottom: 0.88 },
  },
  // 낮은 채도의 회청색. 색을 거의 잃은 빛.
  {
    type: 'numb',
    label: '무기력',
    tint: '#98a3ad',
    blends: true,
    // 색을 거의 잃은 잿빛 초록. 일곱 중 가장 채도가 낮다.
    light: { core: '#e0e5dc', halo: '#76876f', trail: '#4f5c4a' },
    form: 'halo',
    field: { left: 0.291, right: 0.477, top: 0.472, bottom: 0.88 },
  },
  // 은은한 블루. 슬픔은 어둡지 않다. 다만 조금 멀다.
  {
    type: 'sad',
    label: '슬픔',
    tint: '#9fb2d0',
    blends: true,
    // 깊은 남색. 슬픔은 어둡지 않다. 다만 조금 멀다.
    light: { core: '#d4e0f6', halo: '#3d63b2', trail: '#27447c' },
    form: 'soft',
    field: { left: 0.522, right: 0.708, top: 0.472, bottom: 0.88 },
  },
  /*
   * 기타 — 이름 붙이지 않은 마음.
   *
   * 번짐에 섞지 않는다(`blends: false`). 마음에 이름을 붙이지 않았다면
   * 그 빛도 기본 별빛 그대로여야 한다. 색은 화면의 작은 빛 하나를
   * 물들이는 데만 쓰인다.
   */
  {
    type: 'other',
    label: '기타',
    tint: '#e8b45e',
    blends: false,
    // 색이 없다. 이름 붙이지 않은 마음에 색을 주지 않는다.
    light: { core: '#f5efe4', halo: '#a99c89', trail: '#756a5b' },
    form: 'ember',
    field: { left: 0.753, right: 0.94, top: 0.472, bottom: 0.88 },
  },
] as const

const BY_TYPE = new Map<EmotionKey, Emotion>(EMOTIONS.map((one) => [one.type, one]))

/**
 * 저장된 값이 깨져 있어도 하늘은 계속 떠 있어야 한다.
 *
 * 원작은 모르는 마음에 `null`을 돌려준다 — 거기서는 마음을 고르지 않고도
 * 별을 보낼 수 있기 때문이다. 여기서는 마음이 곧 별자리라서 자리가 없으면
 * 그 빛을 하늘에 놓을 수 없으므로, 마지막 칸('기타')으로 받는다.
 */
export function getEmotion(type: EmotionKey | string | null | undefined): Emotion {
  return (type && BY_TYPE.get(type as EmotionKey)) || EMOTIONS[EMOTIONS.length - 1]
}

export function isEmotionKey(key: unknown): key is EmotionKey {
  return typeof key === 'string' && BY_TYPE.has(key)
}

/** 그 별자리의 이름이 놓이는 자리 — 조각의 한가운데 */
export function centerOf(emotion: Emotion): { x: number; y: number } {
  return {
    x: (emotion.field.left + emotion.field.right) / 2,
    y: (emotion.field.top + emotion.field.bottom) / 2,
  }
}

/**
 * 번짐에 마음의 색이 섞이는 정도.
 *
 * **별 전체의 색을 바꾸지 않는다.** 핵은 언제나 원래의 크림빛이고,
 * 회절 십자도 그대로다. 달라지는 것은 그 바깥으로 번지는 빛뿐이다.
 *
 * 0.34는 나란히 두었을 때 '조금 다른 온도'로는 읽히고
 * '다른 색의 별'로는 읽히지 않는 선이다. 더 올리면 하늘이 알록달록해진다.
 */
export const EMOTION_TINT = 0.34

/** #rgb · #rrggbb 를 세 숫자로. 알 수 없으면 null. */
function parseHex(color: string): [number, number, number] | null {
  const hex = color.trim().replace('#', '')
  const full =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex
  if (full.length !== 6) return null
  const value = Number.parseInt(full, 16)
  if (!Number.isFinite(value)) return null
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255]
}

const two = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0')

/** 두 색 사이의 한 점. amount가 0이면 base 그대로. */
export function mixColor(base: string, other: string, amount: number): string {
  const a = parseHex(base)
  const b = parseHex(other)
  if (!a || !b || amount <= 0) return base
  const t = Math.min(1, amount)
  return `#${two(a[0] + (b[0] - a[0]) * t)}${two(a[1] + (b[1] - a[1]) * t)}${two(
    a[2] + (b[2] - a[2]) * t,
  )}`
}

/**
 * 이 빛의 번짐은 어떤 색인가.
 *
 * 마음의 색이 적혀 있지 않으면(옛 기억, 또는 이름 붙이지 않은 마음)
 * 원래의 번짐 색을 그대로 돌려준다 — 그래서 옛 별은 어제와 똑같이 떠 있다.
 */
export function emotionHalo(baseHalo: string, emotionColor?: string | null): string {
  return emotionColor ? mixColor(baseHalo, emotionColor, EMOTION_TINT) : baseHalo
}

/** 이 마음의 빛이 가지는 번짐 색 (간직/흘려보내기의 번짐에 섞은 것) */
export function haloFor(emotion: Emotion, baseHalo: string): string {
  return emotionHalo(baseHalo, emotion.blends ? emotion.tint : null)
}
