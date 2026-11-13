import { useEffect, useRef } from 'react'
import { getEmotion } from '@/constants/emotions'
import { formFor } from '@/canvas/starForm'
import { remainingLight } from '@/lib/starMath'
import type { PublicStar } from '../../lib/universe'

/** 화면 안으로 떠 있는 것처럼 보이는 가장 낮은 밝기. 완전히 꺼지지는 않는다. */
const MIN_ALPHA = 0.14
/** 손을 떼고 이만큼 가만히 있으면 하늘이 스스로 아주 느리게 흐른다. */
const IDLE_DELAY_MS = 2600
/** 탭으로 인정하는 손가락 이동 한계(px) */
const TAP_SLOP = 8
/** 별 하나를 짚었다고 볼 화면 반경(px) — 실제로 그려지는 점보다 넉넉하다 */
const HIT_RADIUS = 20

interface Camera {
  offsetX: number
  offsetY: number
  scale: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export interface FocusRequest {
  /** `centerOf(emotion)` 같은, 저장된 별과 같은 0~1 좌표계의 한 점 */
  x: number
  y: number
  /** 값이 바뀔 때만 새 요청으로 본다(같은 감정을 두 번 눌러도 다시 날아가야 하므로) */
  token: number
}

export function SkyCanvas({
  stars,
  onSelect,
  focus,
}: {
  stars: readonly PublicStar[]
  onSelect: (star: PublicStar) => void
  focus?: FocusRequest | null
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  // 화면이 다시 그려져도(React 리렌더) 카메라와 애니메이션 상태는 이어져야 한다 — ref로 들고 있는다.
  const starsRef = useRef(stars)
  starsRef.current = stars
  const cameraRef = useRef<Camera>({ offsetX: 0, offsetY: 0, scale: 1 })
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 })
  const driftRef = useRef(0)
  const lastInteractionRef = useRef(0)
  const flyTargetRef = useRef<{ x: number; y: number; scale: number } | null>(null)
  const focusTokenRef = useRef<number | null>(null)

  useEffect(() => {
    const canvasEl = canvasRef.current
    if (!canvasEl) return
    const canvas: HTMLCanvasElement = canvasEl
    const ctx2d = canvas.getContext('2d')
    if (!ctx2d) return
    const ctx: CanvasRenderingContext2D = ctx2d

    const resize = () => {
      const parent = canvas.parentElement
      if (!parent) return
      const { width, height } = parent.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      sizeRef.current = { width, height, dpr }
      canvas.width = width * dpr
      canvas.height = height * dpr
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
    }
    resize()
    window.addEventListener('resize', resize)

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    /** 저장된 0~1 좌표를 지금 화면의 "세상" 좌표로. */
    function worldOf(star: PublicStar) {
      const { width, height } = sizeRef.current
      return { x: star.x * width, y: star.y * height }
    }

    /** 세상 좌표를 지금 카메라로 본 화면 좌표로. */
    function screenOf(wx: number, wy: number) {
      const camera = cameraRef.current
      return { x: camera.offsetX + camera.scale * wx, y: camera.offsetY + camera.scale * wy }
    }

    let frame = 0
    function draw(now: number) {
      const { width, height, dpr } = sizeRef.current
      if (width === 0 || height === 0) {
        frame = requestAnimationFrame(draw)
        return
      }

      const idleFor = now - lastInteractionRef.current
      const idleTarget = idleFor > IDLE_DELAY_MS && !reducedMotion ? 1 : 0
      driftRef.current += (idleTarget - driftRef.current) * 0.04
      const drift = driftRef.current

      const fly = flyTargetRef.current
      if (fly) {
        const camera = cameraRef.current
        camera.scale += (fly.scale - camera.scale) * 0.08
        camera.offsetX = width / 2 - camera.scale * fly.x
        camera.offsetY = height / 2 - camera.scale * fly.y
        if (Math.abs(camera.scale - fly.scale) < 0.004) {
          flyTargetRef.current = null
          lastInteractionRef.current = now
        }
      }

      ctx.save()
      ctx.scale(dpr, dpr)
      ctx.clearRect(0, 0, width, height)

      const camera = cameraRef.current
      const driftX = drift * Math.sin(now * 0.00005) * 10
      const driftY = drift * Math.cos(now * 0.00004) * 7

      for (const star of starsRef.current) {
        const world = worldOf(star)
        const screen = screenOf(world.x + driftX, world.y + driftY)
        if (
          screen.x < -40 ||
          screen.y < -40 ||
          screen.x > width + 40 ||
          screen.y > height + 40
        ) {
          continue
        }

        const emotion = getEmotion(star.emotion)
        const form = formFor(emotion, star.seed)
        const phase = ((star.seed % 2000) / 2000) * Math.PI * 2
        const twinkle = reducedMotion ? 1 : 0.78 + 0.22 * Math.sin(now * 0.0012 + phase)
        const alpha = Math.max(star.brightness * twinkle * remainingLight(star, Date.now()), MIN_ALPHA)
        const scale = camera.scale

        const coreR = (2.1 + form.core * 3.4) * scale
        const haloR = coreR * (1 + form.halo * 2.1)

        ctx.globalAlpha = alpha * Math.min(1, form.haloAlpha + 0.4)
        const halo = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, haloR)
        halo.addColorStop(0, emotion.light.halo)
        halo.addColorStop(1, 'transparent')
        ctx.fillStyle = halo
        ctx.beginPath()
        ctx.arc(screen.x, screen.y, haloR, 0, Math.PI * 2)
        ctx.fill()

        if (form.spike > 0) {
          const reach = haloR * form.spikeReach
          ctx.globalAlpha = alpha * form.spike * 0.6
          ctx.strokeStyle = emotion.light.trail
          ctx.lineWidth = Math.max(0.6, scale * 0.5)
          ctx.beginPath()
          ctx.moveTo(screen.x - reach, screen.y)
          ctx.lineTo(screen.x + reach, screen.y)
          ctx.moveTo(screen.x, screen.y - reach)
          ctx.lineTo(screen.x, screen.y + reach)
          ctx.stroke()
        }

        ctx.globalAlpha = alpha
        const core = ctx.createRadialGradient(screen.x, screen.y, 0, screen.x, screen.y, coreR)
        core.addColorStop(0, emotion.light.core)
        core.addColorStop(1, 'transparent')
        ctx.fillStyle = core
        ctx.beginPath()
        ctx.arc(screen.x, screen.y, coreR, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.globalAlpha = 1
      ctx.restore()
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)

    /* ── 손가락(또는 마우스) ──────────────────────────── */
    const pointers = new Map<number, { x: number; y: number }>()
    let pinchStartDistance = 0
    let pinchStartScale = 1
    let dragStart: { x: number; y: number; offsetX: number; offsetY: number } | null = null
    let moved = 0
    let tapPointerId: number | null = null

    function midpoint() {
      const pts = [...pointers.values()]
      if (pts.length < 2) return pts[0] ?? { x: 0, y: 0 }
      return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }
    }
    function distance() {
      const pts = [...pointers.values()]
      if (pts.length < 2) return 0
      return Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
    }

    function onPointerDown(event: PointerEvent) {
      lastInteractionRef.current = performance.now()
      canvas.setPointerCapture(event.pointerId)
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      moved = 0
      if (pointers.size === 1) {
        tapPointerId = event.pointerId
        const camera = cameraRef.current
        dragStart = { x: event.clientX, y: event.clientY, offsetX: camera.offsetX, offsetY: camera.offsetY }
      } else {
        tapPointerId = null
        dragStart = null
        pinchStartDistance = distance()
        pinchStartScale = cameraRef.current.scale
      }
    }

    function onPointerMove(event: PointerEvent) {
      if (!pointers.has(event.pointerId)) return
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      lastInteractionRef.current = performance.now()

      if (pointers.size >= 2) {
        const d = distance()
        if (pinchStartDistance > 0) {
          const nextScale = clamp(pinchStartScale * (d / pinchStartDistance), 1, 4)
          const focal = midpoint()
          const camera = cameraRef.current
          const worldFocalX = (focal.x - camera.offsetX) / camera.scale
          const worldFocalY = (focal.y - camera.offsetY) / camera.scale
          camera.scale = nextScale
          camera.offsetX = focal.x - nextScale * worldFocalX
          camera.offsetY = focal.y - nextScale * worldFocalY
        }
        return
      }

      if (dragStart) {
        const dx = event.clientX - dragStart.x
        const dy = event.clientY - dragStart.y
        moved = Math.max(moved, Math.hypot(dx, dy))
        cameraRef.current.offsetX = dragStart.offsetX + dx
        cameraRef.current.offsetY = dragStart.offsetY + dy
      }
    }

    function onPointerUp(event: PointerEvent) {
      const wasTap = tapPointerId === event.pointerId && moved < TAP_SLOP && pointers.size === 1
      pointers.delete(event.pointerId)
      dragStart = null
      if (pointers.size < 2) pinchStartDistance = 0

      if (wasTap) {
        const hit = hitTest(event.clientX, event.clientY)
        if (hit) onSelect(hit)
      }
      tapPointerId = null
    }

    function hitTest(clientX: number, clientY: number): PublicStar | null {
      const rect = canvas.getBoundingClientRect()
      const sx = clientX - rect.left
      const sy = clientY - rect.top
      let closest: PublicStar | null = null
      let closestDistance = HIT_RADIUS
      for (const star of starsRef.current) {
        const world = worldOf(star)
        const screen = screenOf(world.x, world.y)
        const d = Math.hypot(screen.x - sx, screen.y - sy)
        if (d <= closestDistance) {
          closestDistance = d
          closest = star
        }
      }
      return closest
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
  }, [onSelect])

  useEffect(() => {
    if (!focus || focus.token === focusTokenRef.current) return
    focusTokenRef.current = focus.token
    const { width, height } = sizeRef.current
    if (width === 0 || height === 0) return
    flyTargetRef.current = { x: focus.x * width, y: focus.y * height, scale: 1.7 }
  }, [focus])

  return <canvas ref={canvasRef} className="sky-canvas" />
}
