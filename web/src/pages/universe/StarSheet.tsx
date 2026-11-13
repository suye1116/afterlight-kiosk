import { getEmotion } from '@/constants/emotions'
import { getTone } from '@/constants/tones'
import { formatDate } from '@/lib/starMath'
import type { PublicStar } from '../../lib/universe'

/**
 * 별 하나를 짚었을 때 올라오는 패널.
 *
 * 보여주는 것은 `universe_stars`에 실제로 있는 값뿐이다 — 감정 ·
 * 간직/흘려보냄 · 도착한 날 · 같은 마음의 빛 개수. 기억 원문이나
 * 실제 별 이름은 이 컬렉션에 없으므로 지어내지 않는다.
 */
export function StarSheet({
  star,
  companyCount,
  onClose,
}: {
  star: PublicStar | null
  companyCount: number
  onClose: () => void
}) {
  if (!star) return null

  const emotion = getEmotion(star.emotion)
  const tone = getTone(star.type)

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" onClick={(event) => event.stopPropagation()}>
        <span className="sheet-grip" />
        <p className="label poetry">{emotion.label}의 빛</p>
        <p className="sheet-tone" style={{ color: tone.core }}>
          {tone.glyph} {tone.cardLabel}
        </p>
        <dl className="rows">
          <div className="row">
            <dt>우리의 우주에 닿은 날</dt>
            <dd>{formatDate(star.createdAt)}</dd>
          </div>
          <div className="row">
            <dt>같은 마음의 빛</dt>
            <dd>{companyCount}개</dd>
          </div>
        </dl>
        <p className="quiet dim sheet-note">
          이 빛을 보낸 사람이 적은 글은 공개되지 않습니다 — 감정과 자리만 함께 보입니다.
        </p>
      </div>
    </div>
  )
}
