import { useCallback, useEffect, useRef, useState } from 'react'

export type CameraState =
  | { status: 'idle' }
  | { status: 'requesting' }
  | { status: 'ready' }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string }

/**
 * 카메라 스트림의 생명주기.
 *
 * **이 화면에 있을 때만 켜고, 떠나면 반드시 끈다** — `stop()`을
 * 부르거나 컴포넌트가 사라질 때(`useEffect`의 정리 함수) 트랙을
 * 멈춘다. 서버로 아무것도 보내지 않는다 — 이 훅이 다루는 것은
 * 브라우저 안의 `MediaStream`뿐이다.
 */
export function useCameraStream() {
  const [state, setState] = useState<CameraState>({ status: 'idle' })
  const streamRef = useRef<MediaStream | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)
  // visibilitychange 핸들러는 한 번만 붙고(아래 effect) 그 뒤로도 "지금" 상태를
  // 봐야 하니, 클로저에 갇히는 state 대신 항상 최신값인 ref로 읽는다.
  const statusRef = useRef<CameraState['status']>('idle')
  statusRef.current = state.status

  // 트랙만 멈추고 상태는 건드리지 않는다 — `start()` 내부에서 "이전
  // 스트림 정리"처럼 상태를 바꾸면 안 되는 자리에 쓴다.
  const stopTracks = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  /*
   * 지금까지는 이 훅을 쓰는 화면이 전부 "떠날 때만" 이걸 불렀기 때문에
   * (언마운트 뒤에는 상태가 무엇이든 상관없었다) 상태를 되돌리지 않아도
   * 문제가 없었다. 이제 "카메라 끄기" 버튼처럼 화면에 머문 채로 끄는
   * 경우가 생겨서, 꺼진 뒤에는 항상 `'idle'`로 되돌린다 — 언마운트
   * 중에 불려도 그 setState는 그냥 버려질 뿐 해가 없다.
   */
  const stop = useCallback(() => {
    stopTracks()
    setState({ status: 'idle' })
  }, [stopTracks])

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState({ status: 'unsupported' })
      return
    }
    setState({ status: 'requesting' })
    try {
      // 후면 카메라를 "요청"할 뿐 보장은 아니다 — 없는 기기는 아무 카메라나 준다.
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      stopTracks() // 기존 스트림(있었다면) 정리 — 'requesting' 상태는 그대로 유지
      streamRef.current = stream
      /*
       * 트랙이 끝나는 경우 — 다른 앱이 카메라를 가져가거나, OS가 강제로
       * 끊거나, 하드웨어 문제가 생기는 경우를 포함한다. 새 상태값을
       * 만들지 않고 이미 있는 'error' 모양 그대로 알린다 — 이 훅을 함께
       * 쓰는 화면이 이미 'error' 분기를 갖고 있으면 고칠 게 없다.
       */
      stream.getTracks().forEach((track) => {
        track.addEventListener('ended', () => {
          stopTracks()
          setState({ status: 'error', message: '카메라 연결이 끊어졌어요 — 다른 앱이 카메라를 쓰고 있을 수 있어요.' })
        })
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play().catch(() => {
          /* 자동재생이 막혀도 play() 버튼 없이 이미 사용자 동작(탭) 다음이라 보통 통과한다 */
        })
      }
      setState({ status: 'ready' })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        setState({ status: 'denied' })
      } else if (
        error instanceof DOMException &&
        (error.name === 'NotFoundError' || error.name === 'OverconstrainedError')
      ) {
        setState({ status: 'unsupported' })
      } else {
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : '알 수 없는 오류',
        })
      }
    }
  }, [stopTracks])

  // Safari에서 탭을 벗어났다 돌아오면 비디오가 멈춰 있을 수 있다 — 이미
  // 재생 중이면 다시 불러도 아무 효과가 없는 안전한 재시도일 뿐이다.
  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible' && statusRef.current === 'ready') {
        videoRef.current?.play().catch(() => {})
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  /*
   * `<video>`를 "카메라가 켜진 뒤에야" 화면에 올리는 구조(이 상태가
   * `'ready'`가 될 때 비로소 그 엘리먼트가 새로 생기는 레이아웃)에서는,
   * `start()` 안의 대입 시점에 `videoRef.current`가 아직 null이라 그
   * 대입이 조용히 건너뛰어진다 — 그래서 `'ready'`가 될 때마다(그리고
   * 그 직후의 렌더가 끝난 뒤) 한 번 더 연결을 보장한다. 이미 재생 중인
   * 비디오에는 그냥 같은 값을 다시 대입하는 것뿐이라 안전하다.
   */
  useEffect(() => {
    if (state.status === 'ready' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [state.status])

  return { state, videoRef, start, stop }
}
