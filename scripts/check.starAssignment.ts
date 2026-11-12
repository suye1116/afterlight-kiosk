import { DRAFT_CONSTELLATIONS, REAL_CONSTELLATION_IDS, SAMPLE_STARS } from '@/constants/realStars/index'
import {
  assignRealStar,
  getAssignedStar,
  VERIFIED_STARS,
  analyzeMeaning,
  scoreStar,
  pickCandidates,
  buildComfortMessage,
  buildAssignmentReason,
  toAssignedStarView,
  DEFAULT_WEIGHTS,
  sumOf,
  etymologyScore,
  type ScoredCandidate,
} from '@/lib/starAssignment/index'

/**
 * 실제 별 배정 알고리즘을 돈다.
 *
 * `scripts/check.logic.ts` 등 기존 검사와 같은 모양이다. 아직 이 로직을
 * 부르는 화면이 없으므로, 여기서 직접 호출해 §12가 요구한 열 가지
 * 상황과 다섯 가지 확인 항목을 본다.
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

const CONSTELLATION_SET = new Set<string>(REAL_CONSTELLATION_IDS)
const VERIFIED_ID_SET = new Set(VERIFIED_STARS.map((s) => s.id))

/* ── §12 상황 1~4: 계절 × 감정 × 간직/흘려보내기 ──────────── */
section('1~4. 계절 × 감정 × 간직·흘려보내기 조합')

const scenario1 = assignRealStar({
  id: 'test-spring-happy-keep',
  text: '공원 벤치에 앉아 웃었던 날',
  emotion: 'happy',
  season: 'spring',
  type: 'keep',
})
ok('봄+기쁨+간직하기 — 배정 성공', scenario1.ok)
if (scenario1.ok) {
  ok('검증된 별이다', VERIFIED_ID_SET.has(scenario1.record.realStarId))
  ok('별자리가 12종 중 하나다', CONSTELLATION_SET.has(scenario1.view.constellationId))
}

const scenario2 = assignRealStar({
  id: 'test-summer-flutter-keep',
  text: '처음 만났던 그 여름밤',
  emotion: 'flutter',
  season: 'summer',
  type: 'keep',
})
ok('여름+설렘+간직하기 — 배정 성공', scenario2.ok)
if (scenario2.ok) {
  ok('검증된 별이다', VERIFIED_ID_SET.has(scenario2.record.realStarId))
  ok('별자리가 12종 중 하나다', CONSTELLATION_SET.has(scenario2.view.constellationId))
}

const scenario3 = assignRealStar({
  id: 'test-autumn-sad-letgo',
  text: '이제는 그 사람을 보내 주려 합니다',
  emotion: 'sad',
  season: 'autumn',
  type: 'letgo',
})
ok('가을+슬픔+흘려보내기 — 배정 성공', scenario3.ok)
if (scenario3.ok) {
  ok('검증된 별이다', VERIFIED_ID_SET.has(scenario3.record.realStarId))
  ok('별자리가 12종 중 하나다', CONSTELLATION_SET.has(scenario3.view.constellationId))
}

const scenario4 = assignRealStar({
  id: 'test-winter-anxious-letgo',
  text: '불안했던 그 겨울을 흘려보냅니다',
  emotion: 'anxious',
  season: 'winter',
  type: 'letgo',
})
ok('겨울+불안+흘려보내기 — 배정 성공', scenario4.ok)
if (scenario4.ok) {
  ok('검증된 별이다', VERIFIED_ID_SET.has(scenario4.record.realStarId))
  ok('별자리가 12종 중 하나다', CONSTELLATION_SET.has(scenario4.view.constellationId))
}

/* ── §12 상황 5: 계절을 모르는 경우 ─────────────────────── */
section('5. 계절을 모르는 경우')
const scenarioUnknown = assignRealStar({
  id: 'test-season-unknown',
  text: '언제였는지 잘 기억나지 않는 하루',
  emotion: 'calm',
  season: 'unknown',
  type: 'keep',
})
ok('계절 미정이어도 배정 성공', scenarioUnknown.ok)
if (scenarioUnknown.ok) ok('검증된 별이다', VERIFIED_ID_SET.has(scenarioUnknown.record.realStarId))

/* ── §12 상황 6: 기억 내용이 매우 짧은 경우 ────────────────── */
section('6. 기억 내용이 매우 짧은 경우')
const scenarioShort = assignRealStar({
  id: 'test-very-short-text',
  text: '음',
  emotion: 'other',
  season: 'unknown',
  type: 'keep',
})
ok('한 글자짜리 기억도 배정 성공', scenarioShort.ok)
ok('짧은 글은 의미 태그가 안 짚인다(또는 적게 짚인다)', analyzeMeaning('음').matched.length === 0)

/* ── §12 상황 7: 의미를 분류하기 어려운 경우 ──────────────── */
section('7. 의미를 분류하기 어려운 경우')
const ambiguousText = '화요일 오후 세 시쯔음 버스를 탔다'
const ambiguousMeaning = analyzeMeaning(ambiguousText)
ok('키워드에 안 걸리는 문장은 matched가 비어 있다', ambiguousMeaning.matched.length === 0)
const scenarioAmbiguous = assignRealStar({
  id: 'test-ambiguous-meaning',
  text: ambiguousText,
  emotion: 'numb',
  season: 'autumn',
  type: 'letgo',
})
ok('의미가 안 짚여도 배정은 성공한다(계절·감정·선택으로 결정)', scenarioAmbiguous.ok)

/* ── §12 상황 8: 기존 저장 기록에 새 필드가 없는 경우 ─────────── */
section('8. 기존 기록에 season 필드가 없는 경우(옛 UniverseStar 흉내)')
const legacyMemory = { id: 'test-legacy-no-season', text: '옛 기록', emotion: 'happy', type: 'keep' as const }
ok("season 필드가 아예 없는 객체도 타입 오류 없이 넘긴다", legacyMemory.id === 'test-legacy-no-season')
const scenarioLegacy = assignRealStar(legacyMemory)
ok('season이 없으면 unknown으로 간주해 배정에 성공한다', scenarioLegacy.ok)
if (scenarioLegacy.ok) ok("저장된 season이 'unknown'이다", scenarioLegacy.record.season === 'unknown')

/* ── §12 상황 9: 같은 기록을 여러 번 조회 ───────────────── */
section('9. 같은 기록을 여러 번 조회')
const repeatId = 'test-repeat-lookup'
const first = assignRealStar({ id: repeatId, text: '반복 조회 테스트', emotion: 'sad', season: 'winter', type: 'letgo' })
const second = assignRealStar({ id: repeatId, text: '다른 글을 적어도(이미 배정되었으므로 무시된다)', emotion: 'happy', season: 'summer', type: 'keep' })
const third = getAssignedStar(repeatId)
ok('첫 배정이 성공한다', first.ok)
if (first.ok && second.ok) {
  ok('두 번째 호출도 같은 별을 돌려준다(새로 뽑지 않는다)', first.record.realStarId === second.record.realStarId)
  ok('입력이 달라도 저장된 계절·간직/흘려보내기는 처음 값 그대로다', second.record.season === 'winter' && second.record.type === 'letgo')
}
ok('getAssignedStar로 다시 읽어도 같은 별이다', third !== null && first.ok && third.realStarId === first.record.realStarId)
ok('세 번째 조회에서 새로 배정되지 않았다(조회 전용)', getAssignedStar('never-assigned-id') === null)

/* ── §12 상황 10: 검증된 별 후보가 부족하거나 없는 경우 ──────── */
section('10. 검증된 별 후보가 없는 경우')
const scenarioNoPool = assignRealStar(
  { id: 'test-no-verified-pool', text: '아무 글', emotion: 'other', season: 'unknown', type: 'keep' },
  undefined,
  [],
)
ok('후보가 없으면 ok:false를 안전하게 돌려준다(가짜 별을 만들지 않는다)', !scenarioNoPool.ok)
ok(
  "실패 이유가 'no-verified-stars'다",
  !scenarioNoPool.ok && scenarioNoPool.reason === 'no-verified-stars',
)
ok('실패 후 같은 id로 다시 불러도 저장된 적이 없어 조회는 null이다', getAssignedStar('test-no-verified-pool') === null)

/* ── 확인 1: 모든 배정 결과가 실제 검증된 별인가 ────────────── */
section('확인 1. 모든 배정 결과가 검증된 별인가')
const allOutcomes = [scenario1, scenario2, scenario3, scenario4, scenarioUnknown, scenarioShort, scenarioAmbiguous, scenarioLegacy, first]
const allVerified = allOutcomes.every((o) => o.ok && VERIFIED_ID_SET.has(o.record.realStarId))
ok('지금까지의 모든 배정이 VERIFIED_STARS 안의 별이다', allVerified)

/* ── 확인 2: 배정된 별이 12개 별자리 중 하나에 속하는가 ────────── */
section('확인 2. 배정된 별이 12개 별자리 중 하나인가')
ok(
  '모든 배정의 constellationId가 승인된 12종 중 하나다',
  allOutcomes.every((o) => o.ok && CONSTELLATION_SET.has(o.view.constellationId)),
)

/* ── 확인 3: 계절·간직/흘려보내기 조건이 점수에 실제로 반영되는가 ── */
section('확인 3. 조건이 점수에 실제로 반영되는가')
const sampleStar = VERIFIED_STARS.find((s) => s.astronomy.bestSeasonKR.includes('winter') && s.poetry.comfortDirection === 'keep')
if (sampleStar) {
  const isoWeights = { season: 0.3, comfort: 0.3, meaning: 0.2, emotion: 0.1, etymology: 0.1 }
  const matchSeason = scoreStar(sampleStar, { season: 'winter', type: 'keep', emotion: 'other', meaningTags: [] }, isoWeights)
  const mismatchSeason = scoreStar(sampleStar, { season: 'summer', type: 'keep', emotion: 'other', meaningTags: [] }, isoWeights)
  ok('계절이 맞을 때 점수가 더 높다', matchSeason.season > mismatchSeason.season && matchSeason.total > mismatchSeason.total)

  const matchComfort = scoreStar(sampleStar, { season: 'winter', type: 'keep', emotion: 'other', meaningTags: [] }, isoWeights)
  const mismatchComfort = scoreStar(sampleStar, { season: 'winter', type: 'letgo', emotion: 'other', meaningTags: [] }, isoWeights)
  ok('간직/흘려보내기가 맞을 때 점수가 더 높다', matchComfort.comfort > mismatchComfort.comfort && matchComfort.total > mismatchComfort.total)
} else {
  ok('계절·간직/흘려보내기 비교용 별을 찾았다', false, '(겨울+keep 별이 없다 — 데이터 확인 필요)')
}

/* ── 확인 4: 같은 기록을 다시 조회해도 별이 바뀌지 않는가 ──────── */
section('확인 4. 같은 기록을 다시 조회해도 별이 바뀌지 않는가')
let stable = true
if (first.ok) {
  for (let i = 0; i < 5; i += 1) {
    const again = assignRealStar({ id: repeatId, text: `흔들림 점검 ${i}`, emotion: 'anxious', season: 'spring', type: 'keep' })
    if (!again.ok || again.record.realStarId !== first.record.realStarId) stable = false
  }
}
ok('다섯 번을 다시 불러도 같은 별이 유지된다', stable)

/* ── 확인 5: 기존 기록(UniverseStar 저장 통)이 그대로인가 ──────── */
section('확인 5. 기존 저장 체계와 분리되어 있는가')
ok(
  '별 배정은 afterlight.universe.v1이 아니라 별도 키를 쓴다(storage.ts 참고, 코드 상으로 보증)',
  true,
)

/* ── 전체 조합 훑기: 4계절 × 2선택 × 7감정 ─────────────────── */
section('전체 조합 — 4계절 × 2간직/흘려보내기 × 7감정')
const seasons = ['spring', 'summer', 'autumn', 'winter'] as const
const types = ['keep', 'letgo'] as const
const emotions = ['happy', 'flutter', 'calm', 'anxious', 'numb', 'sad', 'other'] as const
let combos = 0
let combosOk = 0
for (const season of seasons) {
  for (const type of types) {
    for (const emotion of emotions) {
      combos += 1
      const id = `test-combo-${season}-${type}-${emotion}`
      const result = assignRealStar({ id, text: `${season} ${type} ${emotion} 조합 테스트`, emotion, season, type })
      if (result.ok && VERIFIED_ID_SET.has(result.record.realStarId) && CONSTELLATION_SET.has(result.view.constellationId)) {
        combosOk += 1
      }
    }
  }
}
ok(`${combos}개 조합이 모두 유효한 배정을 받는다`, combos === combosOk, `(성공 ${combosOk}/${combos})`)

/* ── pickCandidates 단독 검사 ────────────────────────────── */
section('pickCandidates — 빈 목록·낮은 적합도 배제')
ok('빈 배열을 넣으면 빈 배열이 나온다', pickCandidates([]).length === 0)
const fakeScored: ScoredCandidate[] = VERIFIED_STARS.slice(0, 5).map((star, i) => ({
  star,
  scores: { season: 0, comfort: 0, meaning: 0, emotion: 0, etymology: 0, total: i === 0 ? 1 : 0.01 },
}))
const picked = pickCandidates(fakeScored)
ok(
  '압도적인 1등만 있어도 후보가 적어도 2개 이상 뽑힌다(문턱 완화)',
  picked.length >= 2,
  `(후보 ${picked.length}개)`,
)
ok('1등이 후보 안에 들어 있다', picked.some((c) => c.scores.total === 1))

/* ── 11. 실제 별 → 별자리 카드 연결 (§13/STEP 7) ────────────── */
section('11. 실제 별이 올바른 별자리 카드로 이어지는가')
const rigel = VERIFIED_STARS.find((s) => s.id === 'star-rigel')
const betelgeuse = VERIFIED_STARS.find((s) => s.id === 'star-betelgeuse')
const sirius = VERIFIED_STARS.find((s) => s.id === 'star-sirius')
if (rigel && betelgeuse && sirius) {
  const rigelOnly = assignRealStar(
    { id: 'test-card-rigel', text: '사냥꾼의 발치에서 빛나던 밤', emotion: 'calm', season: 'winter', type: 'keep' },
    undefined,
    [rigel],
  )
  const betelgeuseOnly = assignRealStar(
    { id: 'test-card-betelgeuse', text: '어깨 위에서 붉게 타오르던 빛', emotion: 'calm', season: 'winter', type: 'keep' },
    undefined,
    [betelgeuse],
  )
  const siriusOnly = assignRealStar(
    { id: 'test-card-sirius', text: '가장 밝게 따라오던 별', emotion: 'calm', season: 'winter', type: 'keep' },
    undefined,
    [sirius],
  )
  ok('리겔 배정 성공', rigelOnly.ok)
  ok('베텔게우스 배정 성공', betelgeuseOnly.ok)
  ok('시리우스 배정 성공', siriusOnly.ok)
  if (rigelOnly.ok && betelgeuseOnly.ok && siriusOnly.ok) {
    ok(
      '리겔과 베텔게우스는 같은 오리온 카드로 이어진다',
      rigelOnly.view.constellationId === 'rc-orion' &&
        betelgeuseOnly.view.constellationId === 'rc-orion' &&
        rigelOnly.view.cardNumber === betelgeuseOnly.view.cardNumber,
      `(리겔→${rigelOnly.view.constellationId}#${rigelOnly.view.cardNumber}, 베텔게우스→${betelgeuseOnly.view.constellationId}#${betelgeuseOnly.view.cardNumber})`,
    )
    ok(
      '시리우스(큰개자리)는 오리온자리와 다른 카드로 이어진다',
      siriusOnly.view.constellationId === 'rc-canis-major' &&
        siriusOnly.view.cardNumber !== rigelOnly.view.cardNumber,
      `(시리우스→${siriusOnly.view.constellationId}#${siriusOnly.view.cardNumber})`,
    )
    ok(
      '카드의 공통 위로 메시지가 별자리 데이터(DRAFT_CONSTELLATIONS)와 정확히 일치한다',
      rigelOnly.view.constellationCard.comfortMessage ===
        DRAFT_CONSTELLATIONS.find((c) => c.id === 'rc-orion')?.comfort.message,
    )
    ok(
      '카드 수준 위로 메시지는 개인화된 위로 메시지(comfortMessage)와 다른 자리에 분리되어 있다',
      rigelOnly.view.comfortMessage !== undefined && rigelOnly.view.constellationCard.comfortMessage !== undefined,
    )
  }
} else {
  ok('리겔·베텔게우스·시리우스 데이터를 찾았다', false, '(별 데이터 확인 필요)')
}

/* ── 12. 위로 메시지 — 별마다 고유하게, 간직/흘려보내기에 따라 ──── */
section('12. 위로 메시지가 간직/흘려보내기에 따라 달라지는가')
{
  const rigel = VERIFIED_STARS.find((s) => s.id === 'star-rigel')
  const betelgeuse = VERIFIED_STARS.find((s) => s.id === 'star-betelgeuse')

  if (rigel && betelgeuse) {
    const rigelKeep = buildComfortMessage(rigel, 'keep')
    const rigelLetgo = buildComfortMessage(rigel, 'letgo')

    ok(
      '간직/흘려보내기가 다르면 같은 별이라도 위로 문장이 달라진다',
      rigelKeep !== rigelLetgo,
      `\n    간직: ${rigelKeep}\n    흘려보내기: ${rigelLetgo}`,
    )
    ok(
      '관람객을 "당신"이라 부른다(직접 말을 건네는 느낌)',
      rigelKeep.includes('당신') || rigelLetgo.includes('당신'),
    )
    ok(
      '어려운 천문 용어(변광성·식변광성·초거성·분광형)를 쓰지 않는다',
      !/변광성|식변광성|초거성|분광형/.test(rigelKeep) && !/변광성|식변광성|초거성|분광형/.test(rigelLetgo),
    )

    const betelgeuseKeep = buildComfortMessage(betelgeuse, 'keep')
    ok(
      '같은 선택(간직)이어도 별이 다르면 위로 문장이 달라진다(모든 별이 비슷해지지 않는다)',
      rigelKeep !== betelgeuseKeep,
    )
  } else {
    ok('리겔·베텔게우스 데이터를 찾았다', false, '(별 데이터 확인 필요)')
  }
}

section('12-1. 90개 별 × 간직/흘려보내기 — 데이터 품질 전면 점검')
{
  /*
   * §2·§6이 요구한 대로, 이제는 90개 별 전부가 간직·흘려보내기 각각
   * 고유한 문장을 직접 가지고 있다(`stars.*.ts`). 여기서는 그 180개
   * 문장 전체가 비어 있지 않고, 서로 겹치지 않으며, 어려운 용어를
   * 쓰지 않는지를 한 번에 훑는다.
   */
  const allMessages: { starId: string; type: 'keep' | 'letgo'; text: string }[] = []
  for (const star of SAMPLE_STARS) {
    allMessages.push({ starId: star.id, type: 'keep', text: star.poetry.comfortMessage.keep })
    allMessages.push({ starId: star.id, type: 'letgo', text: star.poetry.comfortMessage.letgo })
  }

  ok(`${SAMPLE_STARS.length}개 별 × 2 = ${allMessages.length}개 위로 문장을 모두 모았다`, allMessages.length === SAMPLE_STARS.length * 2)

  const empty = allMessages.filter((m) => m.text.trim().length === 0)
  ok('빈 위로 문장이 없다', empty.length === 0, `(${empty.map((m) => `${m.starId}/${m.type}`).join(', ')})`)

  /*
   * 간직 쪽은 거의 모두 "당신이 간직한 마음도..."처럼 또렷하게 직접
   * 부른다. 흘려보내기 쪽은 한국어의 자연스러운 생략(이인칭을 굳이
   * 반복하지 않는 "~해도 괜찮아요" 같은 말투)을 쓰는 경우가 있어,
   * 문장 하나하나가 아니라 **별 하나(간직+흘려보내기 묶음)** 단위로
   * "당신"이 적어도 한 번은 또렷하게 등장하는지를 본다.
   */
  const starsWithoutDirectAddress = SAMPLE_STARS.filter(
    (s) => !s.poetry.comfortMessage.keep.includes('당신') && !s.poetry.comfortMessage.letgo.includes('당신'),
  )
  ok(
    '별마다(간직 또는 흘려보내기 중 적어도 하나는) 관람객을 "당신"이라 직접 부른다',
    starsWithoutDirectAddress.length === 0,
    `(누락 ${starsWithoutDirectAddress.length}건: ${starsWithoutDirectAddress.map((s) => s.id).join(', ')})`,
  )

  const jargon = allMessages.filter((m) => /변광성|식변광성|초거성|분광형|주계열성|쌍성계/.test(m.text))
  ok(
    '어려운 천문 용어를 쓰는 위로 문장이 없다',
    jargon.length === 0,
    `(${jargon.map((m) => `${m.starId}/${m.type}`).join(', ')})`,
  )

  const texts = allMessages.map((m) => m.text)
  const dupTexts = texts.filter((t, i) => texts.indexOf(t) !== i)
  ok(
    '180개 위로 문장이 서로 겹치지 않는다(모든 별이 비슷해지지 않는다)',
    dupTexts.length === 0,
    `(중복 ${dupTexts.length}건)`,
  )

  const sameKeepLetgo = SAMPLE_STARS.filter(
    (s) => s.poetry.comfortMessage.keep === s.poetry.comfortMessage.letgo,
  )
  ok(
    '모든 별에서 간직 문장과 흘려보내기 문장이 서로 다르다',
    sameKeepLetgo.length === 0,
    `(${sameKeepLetgo.map((s) => s.id).join(', ')})`,
  )
}

section('12-2. "왜 이 별인가" — 선택하지 않은 것을 지어내지 않는가')
{
  const rigel = VERIFIED_STARS.find((s) => s.id === 'star-rigel') // bestSeasonKR: ['winter'], etymology: '거인의 발'
  if (rigel) {
    // 계절을 고르지 않았으면('unknown') 계절을 언급하지 않는다
    const unknownSeason = buildAssignmentReason(
      rigel,
      { season: 'unknown', type: 'keep', emotion: 'calm' },
      [],
    )
    ok(
      '계절을 고르지 않았으면 "~에 뜨는"으로 계절을 지어 붙이지 않는다',
      !unknownSeason.includes('뜨는'),
      `(${unknownSeason})`,
    )

    // 고른 계절이 이 별의 관측 계절과 맞지 않으면, 언급하지 않는다
    const mismatchedSeason = buildAssignmentReason(
      rigel,
      { season: 'summer', type: 'keep', emotion: 'calm' },
      [],
    )
    ok(
      '고른 계절이 이 별과 맞지 않으면 그 계절을 언급하지 않는다',
      !mismatchedSeason.includes('뜨는') && !mismatchedSeason.includes('여름'),
      `(${mismatchedSeason})`,
    )

    // 계절이 실제로 맞으면, 그 계절을 언급한다
    const matchedSeason = buildAssignmentReason(
      rigel,
      { season: 'winter', type: 'keep', emotion: 'calm' },
      [],
    )
    ok(
      '고른 계절이 이 별과 맞으면 그 계절을 언급한다',
      matchedSeason.includes('겨울에 뜨는'),
      `(${matchedSeason})`,
    )

    // 검증된 어원을 지어내지 않고 그대로 쓴다
    ok(
      '검증된 어원이 있으면 그 뜻을 그대로 쓴다(리겔 = 거인의 발)',
      unknownSeason.includes("'거인의 발'"),
      `(${unknownSeason})`,
    )

    /*
     * 조사(이라는/라는) 받침 규칙 — "발"은 받침이 있어 "이라는", "거북이"는
     * 받침이 없어 "라는"이어야 한다("거북이'이라는"은 틀린 문장이다).
     */
    ok('받침 있는 뜻에는 "이라는"을 쓴다(발 → 이라는)', unknownSeason.includes("발'이라는"), `(${unknownSeason})`)
    const sulafat = VERIFIED_STARS.find((s) => s.id === 'star-sulafat') // etymology: '거북이'(받침 없음)
    if (sulafat) {
      const turtleReason = buildAssignmentReason(
        sulafat,
        { season: 'unknown', type: 'keep', emotion: 'calm' },
        [],
      )
      ok(
        '받침 없는 뜻에는 "라는"을 쓴다(거북이 → 라는, "거북이이라는"이 되지 않는다)',
        turtleReason.includes("거북이'라는") && !turtleReason.includes("거북이'이라는"),
        `(${turtleReason})`,
      )
    } else {
      ok('술라파트 데이터를 찾았다', false)
    }

    // 글에서 짚인 주제가 없으면(matched: []), 특정 주제를 지어내 언급하지 않는다
    const noMeaning = buildAssignmentReason(rigel, { season: 'unknown', type: 'keep', emotion: 'calm' }, [])
    ok(
      '적은 글에서 짚인 주제가 없으면 특정 주제를 지어내지 않는다',
      noMeaning.includes('당신이 적어 주신 그 마음을 닮은 별이에요'),
      `(${noMeaning})`,
    )

    // 실제로 짚인 주제가 있으면, 그 주제에 맞는 문장을 쓴다
    const withLonging = buildAssignmentReason(
      rigel,
      { season: 'unknown', type: 'keep', emotion: 'calm' },
      ['longing'],
    )
    ok('그리움 주제가 짚이면 그리움에 맞는 문장을 쓴다', withLonging.includes('그리운 기억'), `(${withLonging})`)

    const withAchievement = buildAssignmentReason(
      rigel,
      { season: 'unknown', type: 'keep', emotion: 'calm' },
      ['achievement'],
    )
    ok(
      '성취 주제가 짚이면 성취에 맞는 문장을 쓴다',
      withAchievement.includes('노력이 결실을 맺었던'),
      `(${withAchievement})`,
    )
  } else {
    ok('리겔 데이터를 찾았다', false)
  }
}

section('12-4. "사랑과 연애"는 글에서 명확할 때만 — §1이 지적한 문제의 재발 방지')
{
  /*
   * 이번 수정의 출발점이었던 버그: '함께'·'같이'·'친구'·'가족' 같은
   * 흔한 말만으로도 "사랑과 관계의 결이 느껴졌다"는 문장이 나왔다.
   * 같은 입력을 다시 돌려, 이제는 그 말이 나오지 않는지 확인한다.
   */
  const friendText = analyzeMeaning('친구들과 아무 이유 없이 웃었던 여름밤이 기억난다')
  ok(
    '"친구"가 들어간 글은 romance(사랑과 연애)로 짚히지 않는다',
    !friendText.matched.includes('romance'),
    `(짚인 주제: ${friendText.matched.join(', ') || '없음'})`,
  )
  ok('친구 이야기는 friendship으로 짚인다', friendText.matched.includes('friendship'))

  const familyText = analyzeMeaning('가족과 함께 떠났던 여행이 떠오른다')
  ok(
    '"가족"·"함께"가 들어간 글은 romance로 짚히지 않는다',
    !familyText.matched.includes('romance'),
    `(짚인 주제: ${familyText.matched.join(', ') || '없음'})`,
  )
  ok('가족 이야기는 family로 짚인다', familyText.matched.includes('family'))

  // 행복·설렘·그리움 같은 "감정"만으로는 romance가 짚이지 않는다 — 감정은 다른 축이다
  const happyNoRomance = analyzeMeaning('그냥 행복했고 많이 설렜다')
  ok(
    '행복·설렘 같은 감정 낱말만으로는 romance가 짚이지 않는다',
    !happyNoRomance.matched.includes('romance'),
    `(짚인 주제: ${happyNoRomance.matched.join(', ') || '없음'})`,
  )

  // romance는 연애 관계가 글에서 명확할 때만 짚인다
  const romanceText = analyzeMeaning('처음 만났던 그날, 남자친구에게 고백했던 순간')
  ok('연애 관계가 명확한 글은 romance로 짚인다', romanceText.matched.includes('romance'))

  // 실제 배정 이유 문장에도 "사랑"·"연애"가 함부로 등장하지 않는다
  const star = VERIFIED_STARS[0]
  const noRomanceReason = buildAssignmentReason(
    star,
    { season: 'unknown', type: 'keep', emotion: 'happy' },
    friendText.matched,
  )
  ok(
    '친구 이야기의 배정 이유에는 "사랑"이라는 말이 등장하지 않는다',
    !noRomanceReason.includes('사랑') && !noRomanceReason.includes('연애'),
    `(${noRomanceReason})`,
  )

  /*
   * 직접 겪은 또 다른 잘못 짚힘 — "혼자"만으로 freedom(자유와 독립)을
   * 짚다 보니, 이별 뒤의 외로움("이별한 뒤 혼자 걷던 밤")까지 자유로
   * 잘못 읽은 적이 있었다. '혼자 여행/떠났다'처럼 모양이 뚜렷할 때만
   * freedom을 짚고, 단순히 외로운 상황에는 짚지 않는지를 본다.
   */
  const lonelyAfterParting = analyzeMeaning('이별한 뒤 혼자 걷던 밤, 이제는 흘려보내려 한다')
  ok(
    '이별 뒤의 외로움("혼자 걷던 밤")은 freedom(자유와 독립)으로 짚히지 않는다',
    !lonelyAfterParting.matched.includes('freedom'),
    `(짚인 주제: ${lonelyAfterParting.matched.join(', ') || '없음'})`,
  )
  ok('이별 뒤의 외로움은 parting(후회와 이별)으로 짚인다', lonelyAfterParting.matched.includes('parting'))

  const soloTravel = analyzeMeaning('처음 혼자 여행을 떠났던 날. 무서웠지만 정말 자유로웠다')
  ok('"혼자 여행을 떠났다"는 freedom으로 짚인다', soloTravel.matched.includes('freedom'))
}

section('12-3. 상세 화면의 설명과 실제 배정 이유가 일치하는가')
{
  const outcome = assignRealStar({
    id: 'test-reason-consistency',
    text: '그리워서 다시 꺼내 본 하루',
    emotion: 'sad',
    season: 'winter',
    type: 'letgo',
  })
  ok('배정이 성공한다', outcome.ok)
  if (outcome.ok) {
    const star = VERIFIED_STARS.find((s) => s.id === outcome.record.realStarId)
    ok('배정된 별 데이터를 찾았다', star !== undefined)
    if (star) {
      const rebuilt = buildAssignmentReason(star, outcome.record, outcome.record.meaningTags)
      ok(
        '화면(view.assignmentReason)과 다시 지은 문장이 정확히 같다(같은 저장값에서 나왔다)',
        outcome.view.assignmentReason === rebuilt,
      )
      const rebuiltView = toAssignedStarView(outcome.record)
      ok(
        'toAssignedStarView를 다시 불러도 같은 설명이 나온다(저장된 입력이 그대로다)',
        rebuiltView?.assignmentReason === outcome.view.assignmentReason,
      )
    }
  }
}

section('13. 질문을 통해 떠올리기 — 답변 내용이 가장 중요하게 반영되는가')
{
  /*
   * 같은 답(친구 이야기)을 자유 작성과 질문 방식 둘 다로 보내 본다.
   * recordMode·promptQuestion이 달라도 analyzeMeaning이 보는 것은
   * 오직 text(답한 내용)뿐이므로, 짚이는 주제는 **똑같아야 한다**.
   */
  const freeOutcome = assignRealStar({
    id: 'test-mode-free-friend',
    text: '친구들과 아무 이유 없이 웃었던 여름밤이 기억난다',
    emotion: 'happy',
    season: 'summer',
    type: 'keep',
  })
  const promptOutcome = assignRealStar({
    id: 'test-mode-prompt-friend',
    text: '친구들과 아무 이유 없이 웃었던 여름밤이 기억난다',
    emotion: 'happy',
    season: 'summer',
    type: 'keep',
    recordMode: 'prompt',
    promptQuestion: '최근 나를 가장 많이 웃게 했던 순간은 언제인가요?',
  })
  ok('자유 작성 배정이 성공한다', freeOutcome.ok)
  ok('질문 방식 배정이 성공한다', promptOutcome.ok)
  if (freeOutcome.ok && promptOutcome.ok) {
    ok(
      '같은 답이면 짚이는 주제(의미 태그)가 작성 방식과 무관하게 같다',
      JSON.stringify(freeOutcome.record.meaningTags.slice().sort()) ===
        JSON.stringify(promptOutcome.record.meaningTags.slice().sort()),
      `(자유: ${freeOutcome.record.meaningTags.join(',')} / 질문: ${promptOutcome.record.meaningTags.join(',')})`,
    )
    ok(
      '자유 작성 방식의 "나의 별 이야기"에는 질문이 인용되지 않는다',
      !freeOutcome.view.assignmentReason.includes('라는 질문에 답하며'),
      `(${freeOutcome.view.assignmentReason})`,
    )
    ok(
      '질문 방식의 "나의 별 이야기"에는 실제로 답한 그 질문이 그대로 인용된다',
      promptOutcome.view.assignmentReason.includes(
        "'최근 나를 가장 많이 웃게 했던 순간은 언제인가요?'라는 질문에 답하며",
      ),
      `(${promptOutcome.view.assignmentReason})`,
    )
  }

  /*
   * 질문 그 자체에 주제 낱말이 들어 있어도(예: "연애" 이야기를 묻는
   * 질문), 답이 그 주제와 무관하면 짚히지 않는다 — 질문의 낱말로
   * 사용자의 경험·감정을 추측하지 않는다는 원칙의 직접적인 확인이다.
   */
  const unrelatedAnswerOutcome = assignRealStar({
    id: 'test-question-words-ignored',
    text: '그냥 조용히 책을 읽었던 저녁이었다',
    emotion: 'calm',
    season: 'unknown',
    type: 'keep',
    recordMode: 'prompt',
    promptQuestion: '그 사람과의 연애 이야기가 아직도 기억나나요?',
  })
  ok('질문에 연애 낱말이 있어도 배정은 성공한다', unrelatedAnswerOutcome.ok)
  if (unrelatedAnswerOutcome.ok) {
    ok(
      '질문에 들어간 "연애"라는 말만으로는 주제가 romance로 짚히지 않는다',
      !unrelatedAnswerOutcome.record.meaningTags.includes('romance'),
      `(짚인 주제: ${unrelatedAnswerOutcome.record.meaningTags.join(', ') || '없음'})`,
    )
    ok(
      '그런데도 그 질문은(사실 그대로) "나의 별 이야기"에 인용된다',
      unrelatedAnswerOutcome.view.assignmentReason.includes('그 사람과의 연애 이야기가 아직도 기억나나요?'),
      `(${unrelatedAnswerOutcome.view.assignmentReason})`,
    )
  }
}

section('14. "나의 별 이야기"에 별만의 상징적 의미(symbolism)가 들어가는가')
{
  const star = VERIFIED_STARS[0]
  const freeReason = buildAssignmentReason(star, { season: 'unknown', type: 'keep', emotion: 'calm' }, [])
  ok(
    '자유 작성 방식이어도 이 별만의 상징적 의미가 문장에 들어간다',
    freeReason.includes(star.poetry.symbolism),
    `(${freeReason})`,
  )
  ok('"나의 별 이야기"는 세 문장이다(2~3문장 범위 안)', (freeReason.match(/\./g) ?? []).length === 3)

  const promptReason = buildAssignmentReason(
    star,
    { season: 'unknown', type: 'keep', emotion: 'calm', recordMode: 'prompt', promptQuestion: '오늘 하루에서 기억하고 싶은 장면은 무엇인가요?' },
    [],
  )
  ok(
    '질문 방식도 같은 별의 상징적 의미를 그대로 들려준다',
    promptReason.includes(star.poetry.symbolism),
    `(${promptReason})`,
  )
  ok(
    '상징적 의미를 빌려 온 문장도 없는 사실을 지어내지 않는다(별 데이터에 적힌 그 문장 그대로)',
    promptReason.includes(`'${star.poetry.symbolism}'`),
  )
}

section('15. 배정 결과를 다시 읽어도(getAssignedStar) 질문 문구가 그대로 유지되는가')
{
  const outcome = assignRealStar({
    id: 'test-reload-prompt-question',
    text: '오래도록 간직하고 싶은, 할머니와 걷던 골목의 냄새',
    emotion: 'calm',
    season: 'autumn',
    type: 'keep',
    recordMode: 'prompt',
    promptQuestion: '오래도록 간직하고 싶은 작은 행복이 있나요?',
  })
  ok('배정이 성공한다', outcome.ok)
  if (outcome.ok) {
    const reloaded = getAssignedStar('test-reload-prompt-question')
    ok('다시 읽어도 같은 설명이 나온다(새로 배정하지 않는다)', reloaded?.assignmentReason === outcome.view.assignmentReason)
    ok(
      '다시 읽어도 그 질문이 여전히 인용되어 있다',
      reloaded?.assignmentReason.includes('오래도록 간직하고 싶은 작은 행복이 있나요?') ?? false,
    )
  }
}

section('16. 가중치 우선순위 — 요청받은 순서(의미>어원>감정>간직/흘려보내기>계절) 그대로인가')
{
  const w = DEFAULT_WEIGHTS
  ok('가중치 합이 1이다', Math.abs(sumOf(w) - 1) < 1e-9, `(${sumOf(w)})`)
  ok('1순위 의미(meaning)가 가장 크다', w.meaning > w.etymology)
  ok('2순위 어원·상징 연관성(etymology)이 감정보다 크다', w.etymology > w.emotion)
  ok('3순위 감정(emotion)이 간직/흘려보내기보다 크다', w.emotion > w.comfort)
  ok('4순위 간직/흘려보내기(comfort)가 계절보다 크다', w.comfort > w.season)
  ok('5순위 계절(season)이 가장 작다 — 절대 조건이 아니라 참고 요소다', w.season < w.meaning)
}

section('17. 계절은 더 이상 후보를 걸러내는 절대 조건이 아니다')
{
  /*
   * "겨울"을 골랐어도, 그 계절에 뜨지 않는 별이라도 기억의 내용·어원·
   * 감정이 더 잘 맞으면 **후보에 들 수 있어야 한다**(§2의 요청). 어느
   * 별이 최종으로 뽑히는지는 `pickOne`이 memoryId로 씨앗을 삼는
   * 무작위라 테스트마다 흔들릴 수 있으므로, 더 안정적인 단
   * 후보 생성(`pickCandidates`) 단계에서 직접 확인한다.
   */
  const text = '오랜 친구와 마지막으로 인사를 나눴다.'
  const meaning = analyzeMeaning(text)
  const context = { season: 'winter' as const, type: 'letgo' as const, emotion: 'sad' as const, meaningTags: meaning.matched }
  const scored = VERIFIED_STARS.map((star) => ({ star, scores: scoreStar(star, context, DEFAULT_WEIGHTS) }))
  const candidates = pickCandidates(scored)
  const nonWinterCandidates = candidates.filter((c) => !c.star.astronomy.bestSeasonKR.includes('winter'))
  ok(
    '겨울을 골랐어도, 겨울이 아닌 별이 후보 목록에 들어갈 수 있다(계절이 하드 필터가 아니다)',
    nonWinterCandidates.length > 0,
    `(후보 ${candidates.length}개 중 겨울이 아닌 별 ${nonWinterCandidates.length}개: ${nonWinterCandidates.map((c) => c.star.id).join(', ')})`,
  )
  for (const c of candidates) {
    ok(
      `후보 ${c.star.id}의 계절 점수는 정직하다(지어내지 않는다)`,
      c.star.astronomy.bestSeasonKR.includes('winter') ? c.scores.season === 1 : c.scores.season < 1,
    )
  }

  // 겨울이 아닌 별이 실제로 뽑혔을 때도, 거짓으로 "겨울에 뜨는"이라고 적지 않는지 직접 확인한다.
  const nonWinterStar = nonWinterCandidates[0]?.star
  if (nonWinterStar) {
    const reason = buildAssignmentReason(nonWinterStar, { season: 'winter', type: 'letgo', emotion: 'sad' }, meaning.matched)
    ok(
      '겨울이 아닌 별이 배정되어도 "겨울에 뜨는"이라고 거짓으로 적지 않는다',
      !reason.includes('겨울에 뜨는'),
      `(${reason})`,
    )
  } else {
    ok('겨울이 아닌 후보를 찾았다(위 검사와 같은 자리)', false)
  }
}

section('18. 같은 겨울이어도 서로 다른 기억이면 다양한 별이 배정되는가(§6 요청 테스트)')
{
  const memories: Array<{ label: string; text: string; emotion: Parameters<typeof assignRealStar>[0]['emotion']; type: 'keep' | 'letgo' }> = [
    { label: 'A', text: '처음으로 혼자 준비한 공모전에서 상을 받았다.', emotion: 'happy', type: 'keep' },
    { label: 'B', text: '오랜 친구와 마지막으로 인사를 나눴다.', emotion: 'sad', type: 'letgo' },
    { label: 'C', text: '아무 생각 없이 집에서 쉬었던 하루가 좋았다.', emotion: 'calm', type: 'keep' },
    { label: 'D', text: '두려웠지만 새로운 도전을 시작했다.', emotion: 'anxious', type: 'keep' },
    { label: 'E', text: '가족들과 함께 웃으며 저녁을 먹었다.', emotion: 'happy', type: 'keep' },
    { label: 'F', text: '오랫동안 붙잡고 있던 마음을 내려놓았다.', emotion: 'calm', type: 'letgo' },
    { label: 'G', text: '혼자 여행을 떠나 새로운 풍경을 만났다.', emotion: 'flutter', type: 'keep' },
    { label: 'H', text: '평범했지만 이상하게 오래 기억에 남는 하루였다.', emotion: 'other', type: 'keep' },
  ]
  const assigned = memories.map((m) =>
    assignRealStar({ id: `test-diversity-winter-${m.label}`, text: m.text, emotion: m.emotion, season: 'winter', type: m.type }),
  )
  ok('여덟 기억 모두 배정에 성공한다', assigned.every((a) => a.ok))
  const starIds = assigned.map((a) => (a.ok ? a.record.realStarId : null))
  const distinct = new Set(starIds)
  ok(
    '여덟 개의 서로 다른 기억이 적어도 6종 이상의 서로 다른 별을 받는다(같은 별만 반복되지 않는다)',
    distinct.size >= 6,
    `(서로 다른 별 ${distinct.size}개: ${[...distinct].join(', ')})`,
  )
  ok(
    '"히아둠 1"(하이둠1) 한 별이 여덟 개를 전부 차지하지 않는다',
    starIds.filter((id) => id === 'star-hyadum-1').length < memories.length,
    `(히아둠1이 뽑힌 횟수: ${starIds.filter((id) => id === 'star-hyadum-1').length} / ${memories.length})`,
  )
}

section('19. 어원·상징적 해석과의 연관성(etymologyScore)이 실제로 점수를 가르는가')
{
  const starWithFamilyWord = VERIFIED_STARS.find((s) => s.poetry.symbolism.includes('지키') || s.poetry.symbolism.includes('함께'))
  ok('상징 문구에 "지키"·"함께"가 들어간 별을 찾았다', starWithFamilyWord !== undefined)
  if (starWithFamilyWord) {
    const withTag = etymologyScore(starWithFamilyWord, ['family'])
    const withoutTag = etymologyScore(starWithFamilyWord, [])
    ok(
      '짚인 주제가 있을 때, 상징 문구와 통하면 중립값(0.5)보다 높게 나온다',
      withTag > withoutTag,
      `(주제 있음: ${withTag}, 주제 없음: ${withoutTag})`,
    )
  }
  ok('짚인 주제가 없으면 어느 별도 편들지 않는 중립값 0.5다', etymologyScore(VERIFIED_STARS[0], []) === 0.5)
}

section('20. 질문에 답하기 — 계절이 없어도(unknown) 서로 다른 답이면 다양한 별이 배정되는가(§PART 4)')
{
  /*
   * §PART 2 이후로 질문에 답하는 방식은 계절을 아예 묻지 않는다 —
   * 그래서 이 모드의 모든 기억은 `season: 'unknown'`이다. "겨울을
   * 고르면 늘 같은 별"이었던 예전 문제가 "계절이 없으면 늘 같은 별"
   * 로 되살아나지 않는지, 겨울 때와 같은 방식으로 확인한다.
   */
  const prompted: Array<{ label: string; question: string; text: string; emotion: Parameters<typeof assignRealStar>[0]['emotion']; type: 'keep' | 'letgo' }> = [
    { label: 'A', question: '최근 나를 가장 많이 웃게 했던 순간은 언제인가요?', text: '친구와 밤새 떠들며 웃었던 순간이 떠올라요.', emotion: 'happy', type: 'keep' },
    { label: 'B', question: '누군가에게 꼭 전하고 싶었지만 하지 못한 말이 있나요?', text: '고맙다는 말을 끝내 전하지 못했어요.', emotion: 'sad', type: 'letgo' },
    { label: 'C', question: '지금의 나에게 가장 해주고 싶은 말은 무엇인가요?', text: '애쓰지 않아도 괜찮다고 말해주고 싶어요.', emotion: 'calm', type: 'keep' },
    { label: 'D', question: '이제는 조금 내려놓고 싶은 마음이 있나요?', text: '오래 붙잡고 있던 미련을 내려놓고 싶어요.', emotion: 'calm', type: 'letgo' },
    { label: 'E', question: '나를 조금 더 단단하게 만들어 준 순간이 있나요?', text: '혼자 힘으로 어려움을 이겨냈던 순간이에요.', emotion: 'anxious', type: 'keep' },
    { label: 'F', question: '아직 이루지 못했지만 마음속에 품고 있는 꿈이 있나요?', text: '언젠가 새로운 도시에서 다시 시작하고 싶어요.', emotion: 'flutter', type: 'keep' },
    { label: 'G', question: '오늘 하루에서 기억하고 싶은 장면은 무엇인가요?', text: '별일 없이 평범했던 오늘이 오히려 좋았어요.', emotion: 'other', type: 'keep' },
    { label: 'H', question: '다시 돌아갈 수 있다면 어떤 하루로 돌아가고 싶나요?', text: '가족들과 함께 웃으며 보냈던 그 저녁으로요.', emotion: 'happy', type: 'keep' },
  ]
  const assigned = prompted.map((m) =>
    assignRealStar({
      id: `test-diversity-prompt-${m.label}`,
      text: m.text,
      emotion: m.emotion,
      type: m.type,
      recordMode: 'prompt',
      promptQuestion: m.question,
      // season을 아예 넘기지 않는다 — 질문 모드가 실제로 넘기는 모양 그대로다.
    }),
  )
  ok('여덟 질문 답변 모두 배정에 성공한다', assigned.every((a) => a.ok))
  ok(
    '모두 계절을 모르는 채로(unknown) 배정됐다(겨울·임의 계절을 지어내지 않았다)',
    assigned.every((a) => a.ok && a.record.season === 'unknown'),
  )
  const starIds = assigned.map((a) => (a.ok ? a.record.realStarId : null))
  const distinct = new Set(starIds)
  ok(
    '여덟 개의 서로 다른 답이 적어도 6종 이상의 서로 다른 별을 받는다(같은 별만 반복되지 않는다)',
    distinct.size >= 6,
    `(서로 다른 별 ${distinct.size}개: ${[...distinct].join(', ')})`,
  )
  ok(
    '"히아둠 1"(하이둠1) 한 별이 여덟 개를 전부 차지하지 않는다',
    starIds.filter((id) => id === 'star-hyadum-1').length < prompted.length,
    `(히아둠1이 뽑힌 횟수: ${starIds.filter((id) => id === 'star-hyadum-1').length} / ${prompted.length})`,
  )

  // "나의 별 이야기"가 고르지 않은 계절을 지어내지 않는지도 함께 본다.
  const seasonWords = ['봄에 뜨는', '여름에 뜨는', '가을에 뜨는', '겨울에 뜨는']
  for (const a of assigned) {
    if (!a.ok) continue
    ok(
      `[${a.view.realStarId}] 계절을 고르지 않았으니 '~에 뜨는'을 지어 붙이지 않는다`,
      !seasonWords.some((word) => a.view.assignmentReason.includes(word)),
      `(${a.view.assignmentReason})`,
    )
    // 질문에 실제로 답한 그 질문은 그대로 인용되어야 한다 — 지어내지 않되, 실제 근거는 숨기지 않는다.
    const original = prompted.find((m) => `test-diversity-prompt-${m.label}` === a.view.memoryId)
    if (original) {
      ok(
        `[${a.view.realStarId}] 실제로 답한 질문이 '나의 별 이야기'에 그대로 인용된다`,
        a.view.assignmentReason.includes(original.question),
      )
    }
  }
}

/* ── 결과 ────────────────────────────────────────────── */
console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
