import { useCallback, useEffect, useRef, useState } from 'react'

/**
 *   true-north          iOS의 `webkitCompassHeading` — 이미 참북 기준으로 보정되어 있다
 *   magnetic-estimated   절대 방향 이벤트는 왔지만(대개 Android) 자북 기준으로 보이는 값 —
 *                        한국 기준 자기편차 추정치로 한 번 보정했지만 "추정"일 뿐이다
 *   unreliable           절대 방향인지조차 알 수 없는 값(기기를 기준으로 한 상대값일 수 있다) —
 *                        나침반으로 쓰면 안 된다
 */
export type HeadingReference = 'true-north' | 'magnetic-estimated' | 'unreliable'

export type HeadingState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'denied' }
  | { status: 'unsupported' }
  /** 권한은 됐지만 아직 센서 값이 한 번도 안 왔다 */
  | { status: 'waiting-for-data' }
  /** 기다려도 값이 안 온다 — 권한과 "실제로 데이터가 오는가"는 다른 문제다 */
  | { status: 'no-data' }
  | { status: 'active'; heading: number; reference: HeadingReference }
  | { status: 'error'; message: string }

/**
 * 한국(서울 근방) 자기편각 추정치, 2026년 WMM 기준 — 서쪽으로 약 8°.
 * **Android의 절대 방향 이벤트가 자북 기준이라고 알려져 있을 때만** 쓴다.
 * 공식 스펙이 보장하는 값이 아니라 커뮤니티에서 관찰된 동작이라, 이 보정을
 * 적용한 값은 "추정"(`magnetic-estimated`)으로만 표시한다 — 참북처럼
 * 단정하지 않는다.
 */
const KOREA_MAGNETIC_DECLINATION_WEST_DEG = 8

const NO_DATA_TIMEOUT_MS = 4000

/**
 * 센서 이벤트는 기기에 따라 초당 수십 번씩 올 수 있다 — 다음 단계(실시간
 * 좌우 안내)에서 이 값마다 화면을 다시 그리면 가벼운 텍스트도 불필요하게
 * 자주 리렌더된다. 값 자체는 버리지 않고, 화면에 반영하는 빈도만 줄인다.
 */
const EMIT_THROTTLE_MS = 80

type DeviceOrientationEventCtor = typeof DeviceOrientationEvent & {
  requestPermission?: () => Promise<'granted' | 'denied'>
}

type CompassEvent = DeviceOrientationEvent & {
  webkitCompassHeading?: number
  absolute?: boolean
}

function normalize(deg: number): number {
  const wrapped = deg % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/**
 * 방향 센서 — iOS Safari의 권한 요청과 Android의 "절대 방향" 이벤트를
 * 하나로 묶는다. **플랫폼으로 분기하지 않는다** — `requestPermission`
 * 함수가 있는지(기능 감지)로만 판단한다. 2026년 8월(Chrome 151)부터
 * Android Chrome에도 이 함수가 생길 수 있기 때문이다.
 *
 * 이 값으로 "정밀하게 정렬됐다"고 주장하지 않는다 — 그 판단과 화면
 * 효과는 다음 단계(실시간 좌우 안내)의 몫이고, 이 훅은 "센서가 실제로
 * 쓸 수 있는 값을 주는가"까지만 책임진다.
 */
export function useDeviceHeading() {
  const [state, setState] = useState<HeadingState>({ status: 'idle' })
  const cleanupRef = useRef<(() => void) | null>(null)

  const attach = useCallback(() => {
    let noDataTimer: ReturnType<typeof setTimeout> | null = null
    let lastEmitAt = 0

    function clearNoDataTimer() {
      if (noDataTimer) {
        clearTimeout(noDataTimer)
        noDataTimer = null
      }
    }

    function emit(next: HeadingState) {
      const now = Date.now()
      if (now - lastEmitAt < EMIT_THROTTLE_MS) return
      lastEmitAt = now
      setState(next)
    }

    function handle(event: Event) {
      const e = event as CompassEvent

      // iOS — 이미 참북 기준으로 보정된 값을 그대로 쓴다.
      if (typeof e.webkitCompassHeading === 'number' && Number.isFinite(e.webkitCompassHeading)) {
        clearNoDataTimer()
        emit({ status: 'active', heading: normalize(e.webkitCompassHeading), reference: 'true-north' })
        return
      }

      // 값이 없는 이벤트(기기가 아직 센서를 못 읽었을 때 등)는 "데이터 없음"과 구분해 그냥 무시한다.
      if (e.alpha === null || e.alpha === undefined || !Number.isFinite(e.alpha)) return

      clearNoDataTimer()
      const isAbsolute = event.type === 'deviceorientationabsolute' || e.absolute === true
      const magneticHeading = normalize(360 - e.alpha)

      if (isAbsolute) {
        const estimatedTrueHeading = normalize(magneticHeading - KOREA_MAGNETIC_DECLINATION_WEST_DEG)
        emit({ status: 'active', heading: estimatedTrueHeading, reference: 'magnetic-estimated' })
      } else {
        // 절대 방향인지 알 수 없다 — 기기 전원을 켤 때의 자세 등 임의의
        // 기준일 수 있어, 참북도 자북도 아니라고 본다.
        emit({ status: 'active', heading: magneticHeading, reference: 'unreliable' })
      }
    }

    window.addEventListener('deviceorientationabsolute', handle)
    window.addEventListener('deviceorientation', handle)

    noDataTimer = setTimeout(() => {
      setState((prev) => (prev.status === 'waiting-for-data' ? { status: 'no-data' } : prev))
    }, NO_DATA_TIMEOUT_MS)

    cleanupRef.current = () => {
      window.removeEventListener('deviceorientationabsolute', handle)
      window.removeEventListener('deviceorientation', handle)
      clearNoDataTimer()
    }
  }, [])

  const request = useCallback(() => {
    const ctor = (window as unknown as { DeviceOrientationEvent?: DeviceOrientationEventCtor }).DeviceOrientationEvent
    if (typeof ctor === 'undefined') {
      setState({ status: 'unsupported' })
      return
    }

    if (typeof ctor.requestPermission === 'function') {
      setState({ status: 'requesting' })
      /*
       * 이 호출은 지금, 사용자가 버튼을 누른 바로 그 동작 안에서
       * 동기적으로 일어난다 — 이 함수 앞에 다른 작업을 `await`로
       * 기다리게 하면 iOS Safari가 "사용자 동작이 아니다"로 보고
       * 조용히 거부할 수 있다(그래서 `FindStarMode.tsx`도 위치 요청을
       * 먼저 기다리지 않고 이 요청과 동시에 시작한다).
       */
      ctor
        .requestPermission()
        .then((result) => {
          if (result === 'granted') {
            setState({ status: 'waiting-for-data' })
            attach()
          } else {
            setState({ status: 'denied' })
          }
        })
        .catch((error: unknown) => {
          setState({ status: 'error', message: error instanceof Error ? error.message : '권한 요청에 실패했어요.' })
        })
      return
    }

    // 권한 API 자체가 없는 환경 — 묻지 않고 바로 구독한다.
    setState({ status: 'waiting-for-data' })
    attach()
  }, [attach])

  useEffect(() => () => cleanupRef.current?.(), [])

  return { state, request }
}
