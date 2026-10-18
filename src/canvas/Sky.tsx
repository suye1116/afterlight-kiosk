import { useEffect, useRef } from 'react'
import { createSky, type DepartureSpec, type SkyHandle, type SkyOptions } from './skyEngine'

/**
 * 엔진을 React에 꽂는 얇은 껍데기.
 *
 * 하늘은 장면 밖에 있다. 장면이 바뀌어도 같은 하늘이어야 하므로,
 * 이 컴포넌트는 App에 한 번만 놓이고 다시 마운트되지 않는다.
 */
export function Sky({
  handleRef,
  departure,
  ...options
}: SkyOptions & {
  handleRef?: { current: SkyHandle | null }
  /** 값이 바뀌는 순간 그 빛이 우리의 우주로 건너간다 */
  departure?: { token: number; spec: DepartureSpec } | null
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const skyRef = useRef<SkyHandle | null>(null)
  const firstOptions = useRef(options)
  const lastToken = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const sky = createSky(canvas, firstOptions.current)
    skyRef.current = sky
    if (handleRef) handleRef.current = sky
    return () => {
      sky.destroy()
      skyRef.current = null
      if (handleRef) handleRef.current = null
    }
  }, [handleRef])

  useEffect(() => {
    skyRef.current?.setOptions(options)
  })

  useEffect(() => {
    if (!departure || departure.token === lastToken.current) return
    lastToken.current = departure.token
    skyRef.current?.playDeparture(departure.spec)
  }, [departure])

  return <canvas ref={canvasRef} className="layer layer--sky" aria-hidden="true" />
}
