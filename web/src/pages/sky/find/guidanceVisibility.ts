/**
 * "지평선 아래에서는 좌우 안내·금빛 효과를 절대 보여주지 않는다"는 규칙을
 * 순수 함수로 뽑아 둔다. `FindStarMode.tsx`가 이 두 함수를 실제로
 * 그대로 써서 렌더링 여부를 정한다 — 그래서 이 파일을 테스트하면
 * 화면에 실제로 적용되는 조건을 그대로 검증한 것이다(복사해서 따로
 * 흉내 내는 게 아니다).
 */

/**
 * 좌우 안내(`useAlignmentGuidance`)에 넘길 목표 방위각.
 * 고도가 지평선 위(> 0)일 때만 실제 방위각을 넘기고, 그 외에는 `null`을
 * 넘겨 안내 훅 스스로도 "정렬"을 계산하지 않게 한다.
 */
export function targetAzimuthFor(altitude: number, azimuth: number): number | null {
  return altitude > 0 ? azimuth : null
}

/**
 * "실시간 방향 안내" 섹션 자체를 그릴지. 방향 센서가 실제로 값을 주고
 * 있고, 고도가 지평선 위일 때만 그린다 — 이 조건이 거짓이면 화살표도
 * "이 방향 근처예요" 문구도 금빛 효과도 전혀 렌더링되지 않는다.
 */
export function shouldRenderGuidanceSection(altitude: number, headingStatus: string): boolean {
  return altitude > 0 && headingStatus === 'active'
}
