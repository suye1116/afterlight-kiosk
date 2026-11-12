import { DRAFT_CONSTELLATIONS, SAMPLE_STARS } from '@/constants/realStars'
import { buildAssignmentReason } from './reason'
import { buildComfortMessage } from './comfort'
import { starLookupUrl } from '@/lib/starLookup'
import type { AssignedStarView, StoredAssignment } from './types'

/**
 * 저장된 작은 기록을 화면이 쓸 모양으로 다시 짓는다.
 *
 * §8 "데이터 중복을 최소화" — `StoredAssignment`에는 `realStarId` 하나만
 * 있고, 별 이름·특징·위로 메시지·별자리 카드 번호는 모두 여기서
 * `constants/realStars`를 다시 찾아본 값이다. 저장된 적도, 중복으로
 * 들고 있는 값도 없다.
 *
 * 별 데이터나 별자리 카드가 사라졌을 리는 없지만(둘 다 고정된 참조
 * 데이터다), 혹시 못 찾으면 `null`을 돌려준다 — 없는 값을 지어내
 * 채우지 않는다.
 */
export function toAssignedStarView(record: StoredAssignment): AssignedStarView | null {
  const star = SAMPLE_STARS.find((s) => s.id === record.realStarId)
  if (!star) return null

  const card = DRAFT_CONSTELLATIONS.find((c) => c.id === star.constellationId)
  if (!card) return null

  return {
    memoryId: record.memoryId,
    realStarId: star.id,
    realStarName: star.name.properName ?? star.name.designation,
    korean: star.name.korean,
    poeticName: star.poetry.poeticName,
    symbolism: star.poetry.symbolism,
    constellationId: card.id,
    constellationKorean: card.name.korean,
    cardNumber: card.cardNumber,
    meaningTags: record.meaningTags,
    colorDescription: star.astronomy.colorDescription,
    facts: star.astronomy.facts,
    lookupUrl: starLookupUrl(star),
    comfortMessage: buildComfortMessage(star, record.type),
    assignmentReason: buildAssignmentReason(star, record, record.meaningTags),
    season: record.season,
    type: record.type,
    constellationCard: {
      international: card.name.international,
      bestSeasonKR: card.bestSeasonKR,
      comfortMessage: card.comfort.message,
      theme: card.comfort.theme,
    },
  }
}
