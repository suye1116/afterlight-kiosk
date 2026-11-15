import type { CSSProperties } from 'react'
import type { AlignmentGuidance } from './useAlignmentGuidance'

/**
 * STEP 5-4-3에서 검증한 좌우 안내(화살표·문구·금빛 효과)를 순수
 * 프레젠테이션으로 뽑아 둔 것 — 상태나 계산을 전혀 하지 않고, 이미
 * 계산된 `guidance`를 그대로 그린다. 카메라 없는 화면과 카메라 배경
 * 화면(STEP 5-4-4)이 이 컴포넌트를 똑같이 써서, 좌우 판정·히스테리시스·
 * 흔들림 감지가 두 화면에서 다르게 보일 일이 구조적으로 없게 한다.
 *
 * 바깥 레이아웃(섹션 제목, 감싸는 박스 스타일)은 쓰는 쪽이 정한다 —
 * 여기서는 "가로일 때", "흔들릴 때", "안내 못 줄 때", "안내 줄 때"
 * 네 가지 중 하나만 그린다.
 */
export function AlignmentDial({ isLandscape, guidance }: { isLandscape: boolean; guidance: AlignmentGuidance }) {
  if (isLandscape) {
    return (
      <p className="alignCaveat">
        가로로 들면 좌우가 반대로 보일 수 있어요 — 세로로 돌려주시면 다시 정확한 안내를 보여드려요.
      </p>
    )
  }

  if (guidance.unstable) {
    return <p className="alignCaveat">센서 값이 흔들리고 있어요 — 휴대폰을 가만히 들고 잠시 기다려 주세요.</p>
  }

  if (!guidance.available) {
    return (
      <p className="alignCaveat">
        이 기기에서는 좌우 안내를 정확히 드릴 수 없어요 — 위 방위각 숫자를 참고해 직접 돌려봐 주세요.
      </p>
    )
  }

  if (guidance.diff === null || !guidance.tier || !guidance.direction) {
    return null
  }

  return (
    <div className="alignDial" style={{ '--closeness': guidance.closeness } as CSSProperties}>
      <div className="alignGlow" />
      <p className="alignArrow" data-direction={guidance.direction} aria-hidden="true">
        {guidance.direction === 'left' && '←'}
        {guidance.direction === 'right' && '→'}
        {guidance.direction === 'centered' && '✦'}
      </p>
      <p className="alignText">
        {guidance.tier === 'near' && '이 방향 근처예요'}
        {guidance.tier === 'slight' && (guidance.direction === 'right' ? '오른쪽으로 조금만' : '왼쪽으로 조금만')}
        {guidance.tier === 'far' && (guidance.direction === 'right' ? '오른쪽으로 돌아보세요' : '왼쪽으로 돌아보세요')}
      </p>
    </div>
  )
}
