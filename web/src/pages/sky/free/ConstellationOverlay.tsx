import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import type { EquatorialDeg } from '../../../lib/astro/coords'
import { circularMean, fitToUnitSquare, gnomonic } from '../../../lib/astro/projection'

export interface OverlayStar {
  id: string
  name: string
  position: EquatorialDeg
  /** 이 관람객에게 배정된 그 별인가 — 더 밝게 강조한다 */
  mine: boolean
}

export interface OverlayHandle {
  /** 위치·크기·회전을 처음 자리로 */
  reset: () => void
  /** 지금 그려진 것을 그대로 — 사진 합성에 쓴다(투명 배경, 카메라 화면과 같은 픽셀 크기) */
  getCanvas: () => HTMLCanvasElement | null
}

/**
 *   none  별과 선만(이름 없음)
 *   mine  배정받은 별 이름만(기본값)
 *   all   전체 별 이름 — 겹치면 나의 별이 먼저 자리를 차지하고,
 *         보조 라벨은 자리가 없으면 그리지 않는다(지어내지 않는다 —
 *         겹쳐서 읽을 수 없는 글자를 억지로 찍지 않는다는 뜻)
 */
export type NameMode = 'none' | 'mine' | 'all'

const MIN_ALPHA = 0.22
const MIN_SCALE = 0.4
const MAX_SCALE = 3.5

interface Transform {
  panX: number
  panY: number
  scale: number
  rotation: number
}

function identityTransform(): Transform {
  return { panX: 0, panY: 0, scale: 1, rotation: 0 }
}

/**
 * 카메라 화면 위에 겹치는 별자리 — 점(필수)과 선(승인된 것이 있을 때만).
 *
 * **실제 하늘과 정렬되는 AR이 아니다.** 사용자가 손가락으로 옮기고
 * 돌리고 키우는, 사용자가 배치하는 그래픽이다 — 그 안내는 화면 쪽
 * (`FreeCaptureMode.tsx`)의 문구가 맡는다. 이 컴포넌트는 "어떻게
 * 그리는가"만 맡는다.
 */
export const ConstellationOverlay = forwardRef<
  OverlayHandle,
  {
    stars: readonly OverlayStar[]
    lines: ReadonlyArray<readonly [string, string]>
    visible: boolean
    nameMode: NameMode
  }
>(function ConstellationOverlay({ stars, lines, visible, nameMode }, ref) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const transformRef = useRef<Transform>(identityTransform())
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })

  useImperativeHandle(ref, () => ({
    reset: () => {
      transformRef.current = identityTransform()
    },
    getCanvas: () => canvasRef.current,
  }))

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const canvas: HTMLCanvasElement = canvasEl
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    const ctx: CanvasRenderingContext2D = ctx2d

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const { width, height } = parent.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sizeRef.current = { width, height, dpr }
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    resize()
    window.addEventListener('resize', resize)

    /*
     * 별자리 전체를 -1~1 정사각형에 맞춘 "도안 좌표"를 한 번만 계산한다.
     * 이후 손가락 조작은 이 도안 좌표 위에 평행이동·배율·회전만 더한다.
     */
    const positions = stars.map((s) => s.position)
    const center = positions.length > 0 ? circularMean(positions) : { ra: 0, dec: 0 }
    const projected = stars.map((s) => gnomonic(s.position, center))
    const fitted = fitToUnitSquare(projected)
    const layout = new Map(stars.map((s, i) => [s.id, fitted[i]]))

    let frame = 0
    function draw(now: number) {
      const { width, height, dpr } = sizeRef.current
      if (width === 0 || height === 0) {
        frame = requestAnimationFrame(draw)
        return
      }
      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      if (visible) {
        const t = transformRef.current
        // 도안 좌표(-1~1) → 화면 픽셀. 화면의 짧은 변의 38%를 기준 반지름으로.
        const baseRadius = Math.min(width, height) * 0.38 * t.scale
        const cos = Math.cos(t.rotation)
        const sin = Math.sin(t.rotation)
        const centerX = width / 2 + t.panX
        const centerY = height / 2 + t.panY

        const screenOf = (id: string) => {
          const p = layout.get(id)
          if (!p) return null
          // y를 뒤집어 "위가 북쪽"으로, 그리고 회전/이동을 더한다.
          const px = p.x * baseRadius
          const py = -p.y * baseRadius
          const rx = px * cos - py * sin
          const ry = px * sin + py * cos
          return { x: centerX + rx, y: centerY + ry }
        }

        if (lines.length > 0) {
          const segments: Array<{ a: { x: number; y: number }; b: { x: number; y: number } }> = []
          for (const [fromId, toId] of lines) {
            const a = screenOf(fromId)
            const b = screenOf(toId)
            if (!a || !b) continue
            segments.push({ a, b })
          }

          /*
           * 두 겹으로 그린다 — 바깥의 아주 약한 번짐(빛으로 잇는 느낌)과
           * 가운데의 얇고 또렷한 선. 별보다는 눈에 덜 띄도록 알파를
           * 낮게 둔다(별의 핵 알파보다 항상 아래).
           */
          ctx.lineWidth = 3
          ctx.strokeStyle = 'rgba(157, 179, 224, 0.12)'
          ctx.shadowColor = 'rgba(157, 179, 224, 0.3)'
          ctx.shadowBlur = 7
          for (const { a, b } of segments) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
          ctx.shadowBlur = 0

          ctx.lineWidth = 1
          ctx.strokeStyle = 'rgba(157, 179, 224, 0.55)'
          for (const { a, b } of segments) {
            ctx.beginPath()
            ctx.moveTo(a.x, a.y)
            ctx.lineTo(b.x, b.y)
            ctx.stroke()
          }
        }

        const drawn: Array<{ star: OverlayStar; x: number; y: number; r: number }> = []
        const zoomFactor = Math.min(2, Math.max(0.6, t.scale))

        for (const star of stars) {
          const screen = screenOf(star.id)
          if (!screen) continue

          /*
           * 별마다 크기·밝기가 조금씩 다르게 — 실제 밤하늘처럼. 별 id로만
           * 정하므로(난수를 새로 뽑지 않는다) 다시 그려도 늘 같은 모습이다.
           * 나의 별만 느리고 은은하게 반짝인다 — 나머지는 고정된 밝기라
           * 애니메이션 부담이 없다(아이폰에서 가볍게 돈다).
           */
          const seed = hashSeed(star.id)
          const sizeJitter = 0.78 + ((seed % 1000) / 1000) * 0.5
          const r = (star.mine ? 7.5 : 2.6 + ((Math.floor(seed / 7) % 1000) / 1000) * 2.1) * zoomFactor * (star.mine ? 1 : sizeJitter)

          let alpha: number
          if (star.mine) {
            const phase = (seed % 2000) / 2000 * Math.PI * 2
            alpha = reducedMotion ? 1 : 0.86 + 0.14 * Math.sin(now * 0.0008 + phase)
          } else {
            alpha = Math.max(MIN_ALPHA, 0.5 + ((Math.floor(seed / 13) % 1000) / 1000) * 0.45)
          }
          drawn.push({ star, x: screen.x, y: screen.y, r })

          // 부드러운 후광 — 과하지 않게, 풍경이 비쳐 보일 정도로만.
          ctx.globalAlpha = alpha * (star.mine ? 0.5 : 0.36)
          const halo = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, r * (star.mine ? 3.2 : 2.3))
          halo.addColorStop(0, star.mine ? 'rgba(239, 193, 136, 0.9)' : 'rgba(214, 198, 176, 0.6)')
          halo.addColorStop(1, 'transparent')
          ctx.fillStyle = halo
          ctx.beginPath()
          ctx.arc(screen.x, screen.y, r * (star.mine ? 3.2 : 2.3), 0, Math.PI * 2)
          ctx.fill()

          // 매우 섬세한 빛살 — 후광보다 먼저, 핵보다는 나중에 보이도록 핵 바로 아래 겹에 둔다.
          drawSpike(ctx, screen.x, screen.y, r * (star.mine ? 3 : 1.7), alpha * (star.mine ? 0.32 : 0.16))

          // 밝은 중심핵.
          ctx.globalAlpha = Math.min(1, alpha + 0.08)
          const core = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, r)
          core.addColorStop(0, star.mine ? '#fffaf0' : '#fff7e6')
          core.addColorStop(1, 'transparent')
          ctx.fillStyle = core
          ctx.beginPath()
          ctx.arc(screen.x, screen.y, r, 0, Math.PI * 2)
          ctx.fill()
        }
        ctx.globalAlpha = 1

        /*
         * 별 이름 — "이름 없이"면 아예 안 그린다. "나의 별만"이면 배정받은
         * 별 하나만(나의 별 이름·별자리 이름은 화면 상단에도 있지만, 별
         * 옆에도 바로 보이면 어느 점인지 한눈에 알 수 있다). "모든 별"은
         * 나의 별을 먼저 놓아 자리를 보장하고, 나머지는 가까이 모인 별
         * (황소자리 플레이아데스·전갈자리 집게처럼)끼리 겹치지 않는 자리를
         * 찾되, 끝내 못 찾으면 그 보조 라벨은 그리지 않는다.
         */
        if (nameMode !== 'none') {
          ctx.font = '13px "Noto Sans KR", sans-serif'
          const placed: Array<{ x: number; y: number; w: number; h: number }> = []
          const candidates: Array<[number, number, CanvasTextAlign]> = [
            [0, -1, 'center'],
            [0, 1, 'center'],
            [-1, -1, 'right'],
            [1, -1, 'left'],
            [-1, 1, 'right'],
            [1, 1, 'left'],
          ]
          const ordered =
            nameMode === 'all'
              ? [...drawn].sort((a, b) => Number(b.star.mine) - Number(a.star.mine))
              : drawn.filter((d) => d.star.mine)
          for (const { star, x, y, r } of ordered) {
            const w = ctx.measureText(star.name).width
            const gap = r + 10
            let chosen: [number, number, CanvasTextAlign] | null = null
            for (const cand of candidates) {
              const lx = x + cand[0] * gap - (cand[2] === 'center' ? w / 2 : cand[2] === 'left' ? 0 : w)
              const ly = y + cand[1] * gap - 10
              const overlaps = placed.some(
                (b) => lx < b.x + b.w && lx + w > b.x && ly < b.y + b.h && ly + 14 > b.y,
              )
              if (!overlaps) {
                chosen = cand
                placed.push({ x: lx, y: ly, w, h: 14 })
                break
              }
            }
            // 나의 별은 자리가 없어도 생략하지 않는다 — 보조 라벨만 생략한다.
            if (!chosen) {
              if (!star.mine) continue
              chosen = candidates[0]
            }
            ctx.fillStyle = star.mine ? 'rgba(255, 238, 198, 0.96)' : 'rgba(243, 234, 217, 0.85)'
            ctx.textAlign = chosen[2]
            ctx.fillText(star.name, x + chosen[0] * gap, y + chosen[1] * gap)
          }
        }
      }

      ctx.restore()
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    /* ── 손가락 조작: 한 손가락 이동, 두 손가락 핀치·회전 ──────── */
    const pointers = new Map<number, { x: number; y: number }>()
    let dragStart: { x: number; y: number; panX: number; panY: number } | null = null
    let pinchStart: { distance: number; angle: number; scale: number; rotation: number } | null = null

    function pts() {
      return [...pointers.values()]
    }
    function distanceOf(a: { x: number; y: number }, b: { x: number; y: number }) {
      return Math.hypot(a.x - b.x, a.y - b.y)
    }
    function angleOf(a: { x: number; y: number }, b: { x: number; y: number }) {
      return Math.atan2(b.y - a.y, b.x - a.x)
    }

    function onPointerDown(event: PointerEvent) {
      canvas.setPointerCapture(event.pointerId)
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pointers.size === 1) {
        const t = transformRef.current
        dragStart = { x: event.clientX, y: event.clientY, panX: t.panX, panY: t.panY }
      } else if (pointers.size === 2) {
        dragStart = null
        const [a, b] = pts()
        const t = transformRef.current
        pinchStart = { distance: distanceOf(a, b), angle: angleOf(a, b), scale: t.scale, rotation: t.rotation }
      }
    }

    function onPointerMove(event: PointerEvent) {
      if (!pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })

      if (pointers.size >= 2 && pinchStart) {
        const [a, b] = pts()
        const distance = distanceOf(a, b)
        const angle = angleOf(a, b)
        const t = transformRef.current
        t.scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, pinchStart.scale * (distance / pinchStart.distance)))
        t.rotation = pinchStart.rotation + (angle - pinchStart.angle)
        return
      }

      if (dragStart && pointers.size === 1) {
        const dx = event.clientX - dragStart.x
        const dy = event.clientY - dragStart.y
        const t = transformRef.current
        t.panX = dragStart.panX + dx
        t.panY = dragStart.panY + dy
      }
    }

    function onPointerUp(event: PointerEvent) {
      pointers.delete(event.pointerId)
      if (pointers.size < 2) pinchStart = null
      if (pointers.size === 0) dragStart = null
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }, [stars, lines, visible, nameMode])

  return <canvas ref={canvasRef} className="sky-overlay-canvas" />
})

/** 별 id 문자열을 깜빡임 위상·크기·밝기 차이로 쓸 숫자로. 암호학적 용도가 아니다. */
function hashSeed(id: string): number {
  let hash = 0
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * 아주 섬세한 빛살 — 십자로 가늘게, 중심에서 바깥으로 갈수록 옅어진다.
 * 후광(둥근 번짐)과 달리 "별빛이 반짝인다"는 느낌을 단순한 원보다
 * 더 또렷이 준다. 화면에 보이는 풍경을 가리지 않도록 아주 얇고 옅게만.
 */
function drawSpike(ctx: CanvasRenderingContext2D, x: number, y: number, reach: number, alpha: number) {
  if (reach <= 0 || alpha <= 0) return
  ctx.globalAlpha = 1
  ctx.lineWidth = 0.7

  const horizontal = ctx.createLinearGradient(x - reach, y, x + reach, y)
  horizontal.addColorStop(0, 'transparent')
  horizontal.addColorStop(0.5, `rgba(255, 247, 230, ${alpha})`)
  horizontal.addColorStop(1, 'transparent')
  ctx.strokeStyle = horizontal
  ctx.beginPath()
  ctx.moveTo(x - reach, y)
  ctx.lineTo(x + reach, y)
  ctx.stroke()

  const vertical = ctx.createLinearGradient(x, y - reach, x, y + reach)
  vertical.addColorStop(0, 'transparent')
  vertical.addColorStop(0.5, `rgba(255, 247, 230, ${alpha})`)
  vertical.addColorStop(1, 'transparent')
  ctx.strokeStyle = vertical
  ctx.beginPath()
  ctx.moveTo(x, y - reach)
  ctx.lineTo(x, y + reach)
  ctx.stroke()
}
