import { useCallback, useState } from 'react'

export type GeoState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'granted'; lat: number; lon: number }
  | { status: 'denied' }
  | { status: 'timeout' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string }

/**
 * 위치 권한 — `navigator.geolocation` 그대로.
 *
 * **아무것도 저장하지 않는다.** 이 훅이 들고 있는 위도/경도는 React
 * state(메모리)뿐이고, 화면을 벗어나면 사라진다. 서버·Firebase로
 * 보내는 코드는 이 파일에 없다.
 */
export function useGeolocation() {
  const [state, setState] = useState<GeoState>({ status: 'idle' })

  const request = useCallback(() => {
    if (!navigator.geolocation) {
      setState({ status: 'unsupported' })
      return
    }
    setState({ status: 'requesting' })
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setState({ status: 'granted', lat: position.coords.latitude, lon: position.coords.longitude })
      },
      (error) => {
        if (error.code === error.PERMISSION_DENIED) {
          setState({ status: 'denied' })
        } else if (error.code === error.TIMEOUT) {
          setState({ status: 'timeout' })
        } else {
          setState({ status: 'error', message: error.message })
        }
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    )
  }, [])

  return { state, request }
}
