import { useEffect, useRef, useState } from 'react'
import { nextAlignmentTier, shortestAngleDiff, type AlignmentDirection, type AlignmentTier } from '../../../lib/astro/angle'
import type { HeadingState } from './useDeviceHeading'

export interface AlignmentGuidance {
  /**
   * 좌우 안내(화살표·문구·금빛 효과)를 보여줘도 되는가.
   * **참북 기준(`true-north`)일 때만** 켠다 — 자북 추정(Android)이나
   * 기준을 모르는 값으로는 "정렬됐다"는 인상을 주는 안내를 하지 않는다.
   * 흔들림이 심할 때도 꺼진다.
   */
  available: boolean
  /** 센서 값이 최근 들어 비정상적으로 자주, 크게 튀는가. */
  unstable: boolean
  /** 스무딩한 헤딩 기준 최단 각도차(-180~180). 양수면 오른쪽. */
  diff: number | null
  tier: AlignmentTier | null
  direction: AlignmentDirection | null
  /** 0(멀다)~1(거의 정면) — 금빛 후광 강도를 부드럽게 올리는 데 쓴다. */
  closeness: number
}

const IDLE: AlignmentGuidance = { available: false, unstable: false, diff: null, tier: null, direction: null, closeness: 0 }

/** 나침반 흔들림을 누그러뜨리는 정도(0~1, 클수록 새 값에 더 민감). */
const SMOOTHING_FACTOR = 0.25
/** 연속된 원시 값 사이의 튐 크기를 지수평활한 값이 이보다 크면 "흔들림"으로 본다. */
const JITTER_UNSTABLE_THRESHOLD_DEG = 20
const JITTER_DECAY = 0.8

function normalize(deg: number): number {
  const wrapped = deg % 360
  return wrapped < 0 ? wrapped + 360 : wrapped
}

/**
 * 계산된 목표 방위각과 지금 기기가 가리키는 방향을 실시간으로 비교해
 * "왼쪽/오른쪽/이 근처" 안내를 만든다.
 *
 * - **스무딩**: 원시 헤딩을 그대로 쓰지 않고, 매번 "지금 스무딩값→새 원시값"의
 *   최단 각도차만큼만 조금씩 옮긴다 — 뺄셈이 아니라 최단 각도차를 쓰기
 *   때문에 0°/360° 경계를 건너도 안전하다.
 * - **히스테리시스**: 단계 전환은 `nextAlignmentTier`(순수 함수, 단위 테스트
 *   있음)에 맡긴다 — 경계에서 안내가 깜빡이지 않는다.
 * - **흔들림 감지**: 원시 값이 연속으로 크게 튀면(`unstable`) 안내를
 *   꺼서, 자릿수만 맞는 거짓 정렬감을 주지 않는다.
 */
export function useAlignmentGuidance(headingState: HeadingState, targetAzimuth: number | null): AlignmentGuidance {
  const smoothedRef = useRef<number | null>(null)
  const lastRawRef = useRef<number | null>(null)
  const jitterRef = useRef(0)
  const tierRef = useRef<AlignmentTier | null>(null)

  const [result, setResult] = useState<AlignmentGuidance>(IDLE)

  const rawHeading = headingState.status === 'active' ? headingState.heading : null
  const reference = headingState.status === 'active' ? headingState.reference : null

  useEffect(() => {
    if (rawHeading === null || targetAzimuth === null) {
      smoothedRef.current = null
      lastRawRef.current = null
      jitterRef.current = 0
      tierRef.current = null
      setResult(IDLE)
      return
    }

    if (lastRawRef.current !== null) {
      const jump = Math.abs(shortestAngleDiff(rawHeading, lastRawRef.current))
      jitterRef.current = jitterRef.current * JITTER_DECAY + jump * (1 - JITTER_DECAY)
    }
    lastRawRef.current = rawHeading

    smoothedRef.current =
      smoothedRef.current === null
        ? rawHeading
        : normalize(smoothedRef.current + shortestAngleDiff(rawHeading, smoothedRef.current) * SMOOTHING_FACTOR)

    const unstable = jitterRef.current > JITTER_UNSTABLE_THRESHOLD_DEG
    const diff = shortestAngleDiff(targetAzimuth, smoothedRef.current)
    const tier = nextAlignmentTier(tierRef.current, diff)
    tierRef.current = tier
    const direction: AlignmentDirection = tier === 'near' ? 'centered' : diff > 0 ? 'right' : 'left'
    const closeness = Math.max(0, Math.min(1, 1 - Math.abs(diff) / 45))
    const available = reference === 'true-north' && !unstable

    setResult({ available, unstable, diff, tier, direction, closeness })
  }, [rawHeading, reference, targetAzimuth])

  return result
}
