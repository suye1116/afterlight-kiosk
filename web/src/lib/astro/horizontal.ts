import type { EquatorialDeg } from './coords'

/**
 * 적경/적위(천구상의 위치) → 지금, 이 자리에서 본 고도/방위각.
 *
 * 외부 API를 쓰지 않는다 — 전부 표준 구면천문학 공식(그레고리력 율리우스일
 * → 그리니치 항성시 → 지방 항성시 → 시간각 → 고도/방위각)이다.
 *
 * ─── 방위각 기준 ───────────────────────────────────────
 *  참북 0°, 동쪽 90°, 남쪽 180°, 서쪽 270°(나침반 기준, 시계방향).
 *  고도는 수평선 0°, 천정 +90°, 지평선 아래는 음수.
 * ───────────────────────────────────────────────────────
 *
 * ─── 일부러 생략한 보정 ─────────────────────────────────
 *  - **세차운동**(J2000 → 지금): 별마다 다르지만 대체로 0.3~0.5° 이내.
 *  - **대기굴절**(지평선 근처에서 최대 +0.5° 더 높아 보임).
 *  - **장동·광행차**: 각초(arcsecond) 단위라 무시해도 되는 크기.
 *  이 셋을 다 더해도 휴대폰 나침반(자기센서)의 전형적 오차(5~15°,
 *  주변 자기장에 따라 20~30°+)에 비하면 소수점 이하로 묻힌다 — 그래서
 *  "정밀한 값"을 만드는 데 들이는 수고보다, 이 함수가 "대략의 방향"만
 *  보장한다는 것을 화면 문구로 분명히 하는 쪽이 더 정직하다.
 * ───────────────────────────────────────────────────────
 */

const DEG = Math.PI / 180

export interface Observer {
  /** 북위 양수, 남위 음수 (도) */
  lat: number
  /** 동경 양수, 서경 음수 (도) — `navigator.geolocation`이 주는 부호 그대로 */
  lon: number
}

export interface HorizontalDeg {
  /** 수평선 0°, 천정 +90°. 지평선 아래면 음수 — 그대로 둔다(지어내지 않는다). */
  altitude: number
  /** 참북 0°, 동쪽 90°, 남쪽 180°, 서쪽 270° */
  azimuth: number
}

/** 0 이상 360 미만으로 접어 넣는다. */
function normalizeDegrees(deg: number): number {
  const wrapped = deg % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/**
 * UTC 기준 `Date` → 율리우스일(JD).
 *
 * 표준 그레고리력 변환식(Jean Meeus, *Astronomical Algorithms*, 7장).
 * 2000-01-01T12:00:00Z가 정확히 2451545.0이 되는 것으로 검증한다
 * (J2000.0의 정의 그 자체라, 외부 참고 자료가 따로 필요 없다).
 */
export function toJulianDate(date: Date): number {
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600 + date.getUTCMilliseconds() / 3_600_000
  const day = date.getUTCDate() + hour / 24

  let year = date.getUTCFullYear()
  let month = date.getUTCMonth() + 1
  if (month <= 2) {
    year -= 1
    month += 12
  }

  const a = Math.floor(year / 100)
  const b = 2 - a + Math.floor(a / 4)

  return Math.floor(365.25 * (year + 4716)) + Math.floor(30.6001 * (month + 1)) + day + b - 1524.5
}

/** 율리우스일 → 그리니치 평균 항성시(도, 0~360). */
export function greenwichMeanSiderealTime(jd: number): number {
  const centuriesSinceJ2000 = (jd - 2451545.0) / 36525
  const t2 = centuriesSinceJ2000 * centuriesSinceJ2000
  const t3 = t2 * centuriesSinceJ2000
  const gmst =
    280.46061837 +
    360.98564736629 * (jd - 2451545.0) +
    0.000387933 * t2 -
    t3 / 38710000
  return normalizeDegrees(gmst)
}

/**
 * 적경/적위를 고도/방위각으로.
 *
 * `eq`는 `parsePosition()`이 돌려주는 그 값(십진도)을 그대로 받는다 —
 * 좌표를 다시 바꾸거나 지어내지 않는다.
 */
export function equatorialToHorizontal(eq: EquatorialDeg, observer: Observer, date: Date): HorizontalDeg {
  const jd = toJulianDate(date)
  const gmst = greenwichMeanSiderealTime(jd)

  // 지방 항성시 = 그리니치 항성시 + 경도(동경 양수). 시간각 = 지방 항성시 − 적경.
  const localSiderealTime = normalizeDegrees(gmst + observer.lon)
  const hourAngle = normalizeDegrees(localSiderealTime - eq.ra)

  const latRad = observer.lat * DEG
  const decRad = eq.dec * DEG
  const hourAngleRad = hourAngle * DEG

  const sinAltitude = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(hourAngleRad)
  // 부동소수점이 아주 드물게 ±1을 살짝 넘겨 asin이 NaN을 내는 것을 막는다.
  const clampedSinAltitude = Math.min(1, Math.max(-1, sinAltitude))
  const altitude = Math.asin(clampedSinAltitude) / DEG

  const azimuthRad = Math.atan2(
    -Math.sin(hourAngleRad),
    Math.tan(decRad) * Math.cos(latRad) - Math.sin(latRad) * Math.cos(hourAngleRad),
  )
  const azimuth = normalizeDegrees(azimuthRad / DEG)

  return { altitude, azimuth }
}

/** 방위각(도) → 여덟 방향 한국어 이름. 안내 문구용일 뿐, 계산에는 안 쓴다. */
export function compassLabel(azimuthDeg: number): string {
  const labels = ['북', '북동', '동', '남동', '남', '남서', '서', '북서']
  const index = Math.round(normalizeDegrees(azimuthDeg) / 45) % 8
  return labels[index]
}

/** 고도(도) → 자연스러운 한국어 표현. 안내 문구용일 뿐, 계산에는 안 쓴다. */
export function altitudeLabel(altitudeDeg: number): string {
  if (altitudeDeg <= 0) return '지평선 아래'
  if (altitudeDeg < 15) return '지평선 가까이'
  if (altitudeDeg < 60) return '하늘 중간 높이'
  return '높은 하늘'
}
