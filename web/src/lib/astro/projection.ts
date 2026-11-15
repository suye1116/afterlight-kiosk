import type { EquatorialDeg } from './coords'

/**
 * 적경/적위(구면) 점들을, 서로의 상대 위치가 심하게 왜곡되지 않게
 * 평면에 투영한다.
 *
 * **방법: 정사 접평면(gnomonic) 투영**, 별자리 전체의 평균 위치를
 * 중심으로 둔다. 천문 소프트웨어(Stellarium 등)가 좁은 영역(이
 * 프로젝트의 별자리는 전부 30° 안쪽)을 그릴 때 쓰는 표준 방식과
 * 같다 — 중심에서 멀어질수록 왜곡이 커지지만, 별자리 하나만큼의
 * 각크기에서는 눈에 거의 안 띈다.
 */

const DEG = Math.PI / 180

/**
 * 여러 점의 "평균 위치"(중심). 적경을 산술평균하면 0h/24h 경계를
 * 넘는 별자리(페가수스·안드로메다·카시오페이아 등)에서 완전히
 * 틀린 값이 나온다(359°와 1°의 평균이 180°가 되어 버린다) —
 * 그래서 단위벡터의 평균(원형 평균)으로 구한다.
 */
export function circularMean(points: ReadonlyArray<EquatorialDeg>): EquatorialDeg {
  let x = 0
  let y = 0
  let z = 0
  for (const p of points) {
    const ra = p.ra * DEG
    const dec = p.dec * DEG
    x += Math.cos(dec) * Math.cos(ra)
    y += Math.cos(dec) * Math.sin(ra)
    z += Math.sin(dec)
  }
  const ra = Math.atan2(y, x) / DEG
  const hyp = Math.hypot(x, y)
  const dec = Math.atan2(z, hyp) / DEG
  return { ra: ra < 0 ? ra + 360 : ra, dec }
}

export interface PlanePoint {
  x: number
  y: number
}

/**
 * 중심(`center`) 기준 접평면 좌표. 단위는 라디안과 같은 크기지만
 * 그 자체로 "거리"는 아니다 — 호출하는 쪽이 보기 좋은 크기로
 * 다시 스케일한다(`fitToUnitSquare` 참고).
 *
 * `x`는 적경이 커지는(동쪽) 방향, `y`는 적위가 커지는(북쪽) 방향이다.
 * 화면에 그릴 때 캔버스의 y축은 아래로 커지므로, 그릴 때 y를
 * 뒤집어야 "위가 북쪽"으로 보인다(이 모듈은 그 뒤집기를 하지 않는다
 * — 화면 좌표 변환은 그리는 쪽의 책임).
 */
export function gnomonic(point: EquatorialDeg, center: EquatorialDeg): PlanePoint {
  const ra = point.ra * DEG
  const dec = point.dec * DEG
  const ra0 = center.ra * DEG
  const dec0 = center.dec * DEG

  const dRa = ra - ra0
  const cosc = Math.sin(dec0) * Math.sin(dec) + Math.cos(dec0) * Math.cos(dec) * Math.cos(dRa)
  // cosc가 0에 가까우면(90°만큼 떨어진 점) 투영이 무한대로 날아간다.
  // 이 프로젝트의 별자리는 전부 한 자리에 모여 있어 실제로는 일어나지 않지만,
  // 방어적으로 아주 작은 값은 걷어낸다.
  const safeCosc = Math.abs(cosc) < 1e-6 ? 1e-6 : cosc

  const x = (Math.cos(dec) * Math.sin(dRa)) / safeCosc
  const y = (Math.cos(dec0) * Math.sin(dec) - Math.sin(dec0) * Math.cos(dec) * Math.cos(dRa)) / safeCosc
  return { x, y }
}

/**
 * 투영된 점들을 -1~1 정사각형 안에 맞춘다(한쪽만 꽉 차고 다른 쪽은
 * 가운데 정렬). 그 다음은 화면 쪽에서 원하는 픽셀 크기로 곱하기만
 * 하면 된다.
 */
export function fitToUnitSquare(points: ReadonlyArray<PlanePoint>): ReadonlyArray<PlanePoint> {
  if (points.length === 0) return points
  let maxAbs = 0
  for (const p of points) {
    maxAbs = Math.max(maxAbs, Math.abs(p.x), Math.abs(p.y))
  }
  const scale = maxAbs > 1e-9 ? 1 / maxAbs : 1
  return points.map((p) => ({ x: p.x * scale, y: p.y * scale }))
}
