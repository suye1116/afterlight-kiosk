import {
  CANDIDATE_STARS,
  DRAFT_CONSTELLATIONS,
  REAL_CONSTELLATION_IDS,
  SAMPLE_STARS,
} from '@/constants/realStars/index'
import type { ObservableSeason, StarComfortDirection } from '@/constants/realStars/types'

/**
 * 실제 별 데이터베이스를 돈다.
 *
 * `scripts/check.logic.ts` 등 기존 검사와 같은 모양이다 — 순수한 데이터를
 * node로 읽어, 사람이 하나씩 세어 보지 않아도 되게 한다. 아직 이 데이터를
 * 읽는 화면이나 배정 로직은 없으므로, 여기서 보는 것은 "데이터베이스 자체가
 * 말이 되는가"뿐이다.
 *
 * 계절은 'spring'·'summer'·'autumn'·'winter' 넷만 센다. 관람객이 "잘
 * 모르겠어요"를 고른 경우(`@/types`의 `Season`에만 있는 값)는 이 데이터의
 * 계절이 아니라 **배정 로직이 계절 필터를 걸지 않는 것**으로 풀어야 한다 —
 * 그래서 여기 네 계절 각각에 충분한 별이 있는지만 확인하고, 그 네 계절을
 * 합친 전체(= "모르겠어요"일 때 쓸 수 있는 풀)는 당연히 늘 충분하다.
 */

let pass = 0
let fail = 0
function ok(name: string, condition: boolean, extra = '') {
  if (condition) {
    pass += 1
    console.log(`  ✓ ${name}`)
  } else {
    fail += 1
    console.log(`  ✗ ${name} ${extra}`)
  }
}
function section(name: string) {
  console.log(`\n${name}`)
}

const SEASONS: readonly ObservableSeason[] = ['spring', 'summer', 'autumn', 'winter']
const DIRECTIONS: readonly StarComfortDirection[] = ['keep', 'letgo', 'either']

/* ── 1. 별 ID 중복 ───────────────────────────────────── */
section('1. 별 ID가 중복되지 않는가')
const ids = SAMPLE_STARS.map((s) => s.id)
ok(
  `${ids.length}개의 별 ID가 모두 고유하다`,
  ids.length === new Set(ids).size,
  `(고유 ${new Set(ids).size}개)`,
)

/* ── 2. 실제 별자리 ID가 12종 중 하나인가 ──────────────── */
section('2. 실제 별자리 ID')
const validConstellationIds = new Set<string>(REAL_CONSTELLATION_IDS)
const badConstellation = SAMPLE_STARS.filter((s) => !validConstellationIds.has(s.constellationId))
ok(
  '모든 별의 constellationId가 승인된 12종 중 하나다',
  badConstellation.length === 0,
  badConstellation.map((s) => `${s.id}→${s.constellationId}`).join(', '),
)
ok('별자리 카드가 정확히 12종이다', DRAFT_CONSTELLATIONS.length === 12, `(${DRAFT_CONSTELLATIONS.length}종)`)
const cardIds = DRAFT_CONSTELLATIONS.map((c) => c.id)
ok('별자리 카드 12종의 ID가 서로 다르다', cardIds.length === new Set(cardIds).size)
const cardNumbers = DRAFT_CONSTELLATIONS.map((c) => c.cardNumber)
ok(
  '카드 번호가 1~12 범위를 모두, 중복 없이 채운다',
  cardNumbers.length === new Set(cardNumbers).size &&
    [...cardNumbers].sort((a, b) => a - b).every((n, i) => n === i + 1),
  `(${[...cardNumbers].sort((a, b) => a - b).join(',')})`,
)
ok(
  '별자리 카드 ID가 모두 승인된 12종 목록 안에 있다',
  DRAFT_CONSTELLATIONS.every((c) => validConstellationIds.has(c.id)),
)
ok('별자리 카드 12종 모두 확정되었다(draft: false)', DRAFT_CONSTELLATIONS.every((c) => c.draft === false))

/* ── 3. 같은 실제 별이 다른 이름으로 중복 등록되지 않았는가 ── */
section('3. 같은 별의 중복 등록')
const designations = SAMPLE_STARS.map((s) => s.name.designation)
ok(
  '바이어/플램스티드 지정법이 중복되지 않는다',
  designations.length === new Set(designations).size,
)
const properNames = SAMPLE_STARS.filter((s) => s.name.properName).map((s) => s.name.properName)
ok('공식 고유명이 중복되지 않는다', properNames.length === new Set(properNames).size)

/* ── 4. 관측 계절 정보 ───────────────────────────────── */
section('4. 관측 계절 정보')
const noSeason = SAMPLE_STARS.filter((s) => s.astronomy.bestSeasonKR.length === 0)
ok(
  '모든 별에 한국에서 보기 좋은 계절 정보가 있다',
  noSeason.length === 0,
  noSeason.map((s) => s.id).join(', '),
)

/* ── 5. 간직/흘려보내기 분류 ─────────────────────────── */
section('5. 간직하기 / 흘려보내기 분류')
const DIRECTION_SET = new Set<string>(DIRECTIONS)
const badDirection = SAMPLE_STARS.filter((s) => !DIRECTION_SET.has(s.poetry.comfortDirection))
ok('모든 별에 간직/흘려보내기 분류가 있다', badDirection.length === 0)
const noQuality = SAMPLE_STARS.filter((s) => s.poetry.qualities.length === 0)
ok('모든 별에 실제 특징(quality)이 하나 이상 있다', noQuality.length === 0)

/* ── 6. 천문학적 사실과 시적 해석의 구분 ────────────────── */
section('6. 사실과 해석의 구분')
const noFacts = SAMPLE_STARS.filter((s) => s.astronomy.facts.length === 0)
ok('모든 별에 확인된 천문학적 사실이 하나 이상 있다', noFacts.length === 0)
const noPoetic = SAMPLE_STARS.filter(
  (s) => !s.poetry.poeticName || !s.poetry.comfortMessage.keep || !s.poetry.comfortMessage.letgo,
)
ok('모든 별에 시적인 이름과 위로 문장(간직·흘려보내기 둘 다)이 있다', noPoetic.length === 0)
const mixedSentence = SAMPLE_STARS.filter((s) =>
  s.astronomy.facts.some(
    (f) =>
      f === s.poetry.comfortMessage.keep || f === s.poetry.comfortMessage.letgo || f === s.poetry.symbolism,
  ),
)
ok('천문학적 사실 문장과 시적 해석 문장이 같은 문장으로 겹치지 않는다', mixedSentence.length === 0)
const poeticNames = SAMPLE_STARS.map((s) => s.poetry.poeticName)
const dupPoeticNames = poeticNames.filter((n, i) => poeticNames.indexOf(n) !== i)
ok(
  '시적인 이름이 서로 구별된다(중복 없음)',
  dupPoeticNames.length === 0,
  `(중복 ${dupPoeticNames.length}건: ${[...new Set(dupPoeticNames)].join(', ')})`,
)
/* 간직·흘려보내기 180개 문장이 서로 겹치지 않는지는 check.starAssignment.ts §12-1이 더 자세히 본다 — 여기서는 기본 중복만 본다. */
const comfortMessages = SAMPLE_STARS.flatMap((s) => [s.poetry.comfortMessage.keep, s.poetry.comfortMessage.letgo])
const dupMessages = comfortMessages.filter((m, i) => comfortMessages.indexOf(m) !== i)
ok(
  '위로 문장(간직·흘려보내기 모두)이 서로 구별된다(중복 없음)',
  dupMessages.length === 0,
  `(중복 ${dupMessages.length}건)`,
)

/* ── 6-1. 이름의 어원 — 지어내지 않고, 불분명하면 null로 둔다 ── */
section('6-1. 별 이름의 어원')
const noEtymologyField = SAMPLE_STARS.filter((s) => s.name.etymology === undefined)
ok('모든 별에 etymology 필드가 있다(없으면 null, 지어내지 않는다)', noEtymologyField.length === 0)

const withEtymology = SAMPLE_STARS.filter((s) => s.name.etymology !== null)
const nullEtymology = SAMPLE_STARS.filter((s) => s.name.etymology === null)
console.log(`  어원이 확인된 별: ${withEtymology.length}개`)
console.log(`  어원이 불분명해 null로 둔 별: ${nullEtymology.length}개`)

const emptyEtymology = withEtymology.filter(
  (s) => !s.name.etymology?.origin.trim() || !s.name.etymology?.meaning.trim(),
)
ok('어원을 적었다면 출처 언어·뜻 둘 다 비어 있지 않다', emptyEtymology.length === 0)

// 고유명이 없는 별(바이어 지정법뿐인 별)은 "이름의 뜻"이 애초에 없다 — null이어야 한다
const noProperNameButHasEtymology = SAMPLE_STARS.filter(
  (s) => s.name.properName === null && s.name.etymology !== null,
)
ok(
  '공식 고유명이 없는 별은 어원을 지어내지 않는다(null)',
  noProperNameButHasEtymology.length === 0,
  `(${noProperNameButHasEtymology.map((s) => s.id).join(', ')})`,
)

// 어원의 '뜻'과 시적 해석('symbolism')이 같은 문장으로 겹치지 않는다 — 사실과 창작을 섞지 않는다
const etymologyMixedWithSymbolism = withEtymology.filter((s) => s.name.etymology?.meaning === s.poetry.symbolism)
ok(
  '어원(사실)과 시적 해석(창작)이 같은 문장으로 섞이지 않는다',
  etymologyMixedWithSymbolism.length === 0,
)

/* ── 7. 확인되지 않은 정보를 verified로 표시하지 않았는가 ── */
section('7. verified 표시의 근거')
const badVerified = SAMPLE_STARS.filter(
  (s) => s.astronomy.verification === 'verified' && s.astronomy.sources.length === 0,
)
ok(
  "verified로 표시된 별은 모두 출처(sources)가 있다",
  badVerified.length === 0,
  badVerified.map((s) => s.id).join(', '),
)
const badCandidateOverlap = CANDIDATE_STARS.filter((c) =>
  SAMPLE_STARS.some((s) => s.name.designation === c.designation),
)
ok(
  '보류 후보(candidates.ts)가 이미 검증된 별(stars.ts)과 겹치지 않는다',
  badCandidateOverlap.length === 0,
)

/* ── 8. 검증 완료된 별의 수 ──────────────────────────── */
section('8. 검증 완료된 별의 수')
const verified = SAMPLE_STARS.filter((s) => s.astronomy.verification === 'verified')
const needsVerification = SAMPLE_STARS.filter((s) => s.astronomy.verification === 'needs-verification')
console.log(`  전체 별: ${SAMPLE_STARS.length}개`)
console.log(`  검증 완료(verified): ${verified.length}개`)
console.log(`  확인 필요(needs-verification): ${needsVerification.length}개`)
console.log(`  보류 후보(candidates.ts, 아직 RealStar 아님): ${CANDIDATE_STARS.length}개`)
ok(
  '검증 완료된 별이 80개 이상이다',
  verified.length >= 80,
  `(현재 ${verified.length}개, 부족분 ${Math.max(0, 80 - verified.length)}개)`,
)

/* ── 9. 계절별 · 별자리별 후보 수 ────────────────────── */
section('9. 계절별 · 별자리별 후보 수')
console.log('  [계절별]')
for (const season of SEASONS) {
  const count = SAMPLE_STARS.filter((s) => s.astronomy.bestSeasonKR.includes(season)).length
  console.log(`    ${season}: ${count}개`)
}
console.log('  [별자리별]')
for (const cid of REAL_CONSTELLATION_IDS) {
  const count = SAMPLE_STARS.filter((s) => s.constellationId === cid).length
  console.log(`    ${cid}: ${count}개`)
  ok(`${cid}에 별이 하나 이상 있다`, count > 0)
}

/* ── 10. 계절 × 간직/흘려보내기 조합이 충분한가 ─────────── */
section('10. 계절 × 간직·흘려보내기 조합')
/*
 * 'either'는 양쪽 모두로 쓸 수 있다(설계상 의도). 그래서 "keep으로 쓸 수
 * 있는 수"는 keep + either, "letgo로 쓸 수 있는 수"는 letgo + either다.
 * 원시 분류(keep/letgo/either 각각의 수)도 함께 찍어, 한쪽에 쏠려 있지는
 * 않은지 눈으로도 볼 수 있게 한다.
 */
let thinCombos = 0
for (const season of SEASONS) {
  const inSeason = SAMPLE_STARS.filter((s) => s.astronomy.bestSeasonKR.includes(season))
  const raw = DIRECTIONS.map(
    (d) => `${d} ${inSeason.filter((s) => s.poetry.comfortDirection === d).length}`,
  ).join(' · ')
  const keepEffective = inSeason.filter(
    (s) => s.poetry.comfortDirection === 'keep' || s.poetry.comfortDirection === 'either',
  ).length
  const letgoEffective = inSeason.filter(
    (s) => s.poetry.comfortDirection === 'letgo' || s.poetry.comfortDirection === 'either',
  ).length
  console.log(`  ${season} (총 ${inSeason.length}개) — ${raw}`)
  console.log(`    간직하기로 쓸 수 있는 수(keep+either): ${keepEffective}`)
  console.log(`    흘려보내기로 쓸 수 있는 수(letgo+either): ${letgoEffective}`)
  if (keepEffective === 0 || letgoEffective === 0) thinCombos += 1
}
ok(
  '네 계절 모두에서 간직하기·흘려보내기 양쪽으로 추천할 별이 하나 이상 있다',
  thinCombos === 0,
  `(부족한 계절 ${thinCombos}곳)`,
)
console.log(
  `  ※ 계절을 '잘 모르겠어요'로 고른 경우는 네 계절을 합친 전체(${SAMPLE_STARS.length}개)에서 고르면 된다 — 이 데이터는 계절 필터를 강제하지 않는다.`,
)

/* ── 결과 ────────────────────────────────────────────── */
console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
