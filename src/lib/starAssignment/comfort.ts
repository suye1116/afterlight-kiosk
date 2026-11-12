import type { MemoryType } from '@/types'
import type { RealStar } from '@/constants/realStars'

/**
 * 별 소개 화면의 위로 메시지.
 *
 * ─── 전면 개선(2차) ────────────────────────────────────
 *  이전 단계에서는 별의 실제 특징(`StarQuality`, 9가지)을 9개의 공용
 *  문장으로 묶어 감정·간직흘려보내기와 조합했다 — 그래서 같은 질을 가진
 *  여러 별이 "위로의 둘째 문장"을 그대로 공유했다. 관람객이 느끼기엔
 *  "별이 달라도 비슷한 위로가 반복된다"는 문제였다.
 *
 *  이제는 `RealStar.poetry.comfortMessage`가 **별 하나당, 간직/흘려보내기
 *  둘 다** 직접 써 둔 문장을 담고 있다(`constants/realStars/stars.*.ts`).
 *  90개 별 모두 서로 다른 고유한 문장이고, 이 함수는 그중 하나를
 *  골라 돌려줄 뿐 — 더 이상 조합하지 않는다. "모든 별에 비슷한 위로
 *  문장을 자동으로 조합하는 방식을 피하라"는 요청을 이렇게 지킨다.
 * ───────────────────────────────────────────────────────
 */
export function buildComfortMessage(star: RealStar, type: MemoryType): string {
  return star.poetry.comfortMessage[type]
}
