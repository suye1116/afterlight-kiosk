/**
 * 씨앗이 같으면 언제나 같은 값이 나오는 난수.
 *
 * 하늘은 새로고침할 때마다 다시 그려지지만,
 * 어제 본 내 별은 어제 그 자리에 있어야 한다. 그래서 난수를 고정한다.
 */

/** mulberry32 — 짧고, 빠르고, 분포가 고르다 */
export function makeRandom(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** 문자열을 씨앗으로 (FNV-1a) */
export function hashString(value: string): number {
  let h = 2166136261
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function randomSeed(): number {
  const buffer = new Uint32Array(1)
  globalThis.crypto.getRandomValues(buffer)
  return buffer[0]
}

export const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

export const clamp01 = (value: number): number => clamp(value, 0, 1)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** 도착의 가속. 멀리서 오는 빛은 마지막에 갑자기 밝아진다. */
export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)

export const easeInOutSine = (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2
