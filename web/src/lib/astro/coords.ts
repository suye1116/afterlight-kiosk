/**
 * `RealStar.astronomy.position`의 적경/적위 문자열을 십진도로 바꾼다.
 *
 * 저장된 형식은 사람이 읽는 시분초/도분초 문자열이다
 * (`src/constants/realStars/types.ts`의 `SkyPosition` 설명 참고) —
 * 예: '05h 55m 10.3s', '+07° 24′ 25″'. 음수 적위에는 일반 하이픈이
 * 아니라 유니코드 마이너스(`−`, U+2212)가 쓰인다 — 데이터를 직접
 * 눈으로 확인하고 맞춘 것이다.
 */

/** '05h 55m 10.3s' → 55.0... (십진도, 0~360) */
export function parseRaDegrees(ra: string): number | null {
  const match = /(\d+(?:\.\d+)?)h\s*(\d+(?:\.\d+)?)m\s*(\d+(?:\.\d+)?)s/.exec(ra)
  if (!match) return null
  const [, h, m, s] = match
  const hours = Number(h) + Number(m) / 60 + Number(s) / 3600
  return hours * 15
}

/** '+07° 24′ 25″' / '−08° 12′ 06″' → 십진도(-90~90) */
export function parseDecDegrees(dec: string): number | null {
  const match = /([+\-−])\s*(\d+(?:\.\d+)?)°\s*(\d+(?:\.\d+)?)′\s*(\d+(?:\.\d+)?)″/.exec(dec)
  if (!match) return null
  const [, sign, d, m, s] = match
  const magnitude = Number(d) + Number(m) / 60 + Number(s) / 3600
  return sign === '+' ? magnitude : -magnitude
}

export interface EquatorialDeg {
  /** 0~360 */
  ra: number
  /** -90~90 */
  dec: number
}

/** 둘 다 한 번에. 하나라도 못 읽으면 `null` — 지어내지 않는다. */
export function parsePosition(position: { raJ2000: string; decJ2000: string }): EquatorialDeg | null {
  const ra = parseRaDegrees(position.raJ2000)
  const dec = parseDecDegrees(position.decJ2000)
  if (ra === null || dec === null) return null
  return { ra, dec }
}
