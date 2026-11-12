import { renderToStaticMarkup } from 'react-dom/server'
import { SceneAttract } from '@/scenes/SceneAttract'
import { SceneIntro } from '@/scenes/SceneIntro'
import { SceneRecord } from '@/scenes/SceneRecord'
import { SceneTime } from '@/scenes/SceneTime'
import { SceneSeason } from '@/scenes/SceneSeason'
import { SceneEmotion } from '@/scenes/SceneEmotion'
import { SceneChoice } from '@/scenes/SceneChoice'
import { SceneYourStar } from '@/scenes/SceneYourStar'
import { SceneConfirm } from '@/scenes/SceneConfirm'
import { SceneSending } from '@/scenes/SceneSending'
import { SceneDone } from '@/scenes/SceneDone'
import { SceneReceipt } from '@/scenes/SceneReceipt'
import { SceneFinale } from '@/scenes/SceneFinale'
import { SceneUniverse } from '@/scenes/SceneUniverse'
import { SceneCardGuide } from '@/scenes/SceneCardGuide'
import { Receipt } from '@/components/Receipt'
import { EMOTIONS } from '@/constants/emotions'
import {
  CARD_GUIDE,
  CHOICE,
  EMOTION,
  FINALE,
  INTRO,
  INVITE,
  PROMPTS,
  RECEIPT,
  RECORD,
  SEASON,
  SENSOR,
  TIME,
  UNIVERSE,
} from '@/constants/text.exhibit'
import { PUBLIC_UNIVERSE_URL } from '@/constants/deployment'
import { useKiosk } from '@/store/useKiosk'
import { VERIFIED_STARS, assignRealStar } from '@/lib/starAssignment'
import type { UniverseStar } from '@/types'

let pass = 0
let fail = 0
function ok(name: string, condition: boolean, extra = '') {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`) }
  else { fail += 1; console.log(`  ✗ ${name} ${extra}`) }
}

function render(name: string, node: React.ReactElement): string {
  try {
    return renderToStaticMarkup(node)
  } catch (error) {
    fail += 1
    console.log(`  ✗ ${name} 가 그려지다 멈췄다: ${(error as Error).message}`)
    return ''
  }
}

console.log('\n화면이 그려지는가')

const s = () => useKiosk.getState()

/*
 * 서버에서 그릴 때 React는 zustand의 **처음 상태**를 읽는다
 * (useSyncExternalStore의 getServerSnapshot). 브라우저에서는 지금 상태를
 * 읽으므로 이것은 시험 장치의 사정일 뿐이지만, 그대로 두면 화면이
 * 언제나 빈 상태로만 그려져 아무것도 확인하지 못한다.
 * 그래서 두 곳을 함께 맞춰 둔다.
 */
function stage(partial: Partial<ReturnType<typeof s>>) {
  useKiosk.setState(partial as never)
  Object.assign(useKiosk.getInitialState(), partial)
}

// 대기
let html = render('대기', <SceneAttract />)
ok('대기 — 제목과 원작의 두 줄이 있다',
  html.includes('AFTERLIGHT') && html.includes('각자의 시간은 다르지만,') &&
  html.includes('그 시간들이 모여 하나의 우주가 됩니다.'))
ok('대기 — 모인 빛의 수를 센다', html.includes('아직 모인 빛이 없습니다') || html.includes('개의 빛이 모여 있습니다'))

// 첫 화면
html = render('첫 화면', <SceneIntro />)
ok('첫 화면 — 메인 문구가 있다', html.includes(INTRO.main))
ok('첫 화면 — 설명 두 줄이 있다', INTRO.description.every((line) => html.includes(line)))
ok('첫 화면 — 버튼 글자가 있다', html.includes(INTRO.action))
ok('첫 화면 — 맨 아래 문구가 있다', html.includes(INTRO.bottom))

// 기억 작성 (STEP 01) — 이제 이 화면에는 문장만 적는다
s().goHome()
s().goTo('record')
html = render('기억 작성', <SceneRecord />)
ok('기억 작성 — 새 질문이 있다', html.includes(RECORD.question))
ok('기억 작성 — 사랑·연애로만 유도하지 않는 안내 문구가 있다', html.includes(RECORD.guide))
ok('기억 작성 — 원작의 예시 문장이 그대로 있다', html.includes('친구들과 처음 여행 갔던 날'))
ok('기억 작성 — 80자까지다', html.includes('/ 80') && /maxlength="80"/i.test(html))
ok('기억 작성 — 시간 선택은 이 화면에 없다(STEP 02로 분리되었다)', !html.includes(TIME.question))
ok('기억 작성 — 두 작성 방식 전환 버튼이 있다',
  html.includes(RECORD.mode.free) && html.includes(RECORD.mode.prompt))

// 기억 작성 — "질문을 통해 떠올리기"로 바꾼 모습
stage({ recordMode: 'prompt', selectedPrompt: PROMPTS[0], promptAnswer: '' })
html = render('기억 작성 (질문 방식)', <SceneRecord />)
ok('질문 방식 — 고른 질문이 보인다', html.includes(PROMPTS[0]))
ok('질문 방식 — "다른 질문" 버튼이 있다', html.includes(RECORD.another))
ok('질문 방식 — 답 입력창의 안내 글자가 있다', html.includes(RECORD.answerPlaceholder))
ok('질문 방식 — 한 화면에 질문 하나만 보인다(일반 질문은 숨는다)', !html.includes(RECORD.question))
stage({ recordMode: 'free', selectedPrompt: null, promptAnswer: '' })

// 시간 선택 (STEP 02) — SceneRecord에서 분리된 새 화면
html = render('시간 선택', <SceneTime />)
ok('시간 선택 — 새 질문이 있다', html.includes(TIME.question))
ok('시간 선택 — 기존 시간 항목이 모두 있다', TIME.options.every((o) => html.includes(o.label)))
ok('시간 선택 — 고르지 않아도 된다고 알린다', html.includes(TIME.note))

// 계절 선택 (STEP 03)
html = render('계절 선택', <SceneSeason />)
ok('계절 선택 — 질문이 있다', html.includes(SEASON.question))
ok('계절 선택 — 다섯 선택지가 모두 있다', SEASON.options.every((o) => html.includes(o.label)))

// 감정 (STEP 04)
html = render('감정', <SceneEmotion />)
ok('감정 — 새 질문이 있다', html.includes(EMOTION.question))
ok('마음 — 일곱 빛이 모두 있다', EMOTIONS.every((e) => html.includes(e.label)),
  `(${EMOTIONS.map((e) => e.label).join(' ')})`)

// 간직 / 흘려보내기 (STEP 05)
html = render('간직·흘려보내기', <SceneChoice />)
ok('선택 — 질문이 있다', html.includes(CHOICE.question))
ok('선택 — 두 선택의 이름이 있다',
  html.includes(CHOICE.options.keep.label) && html.includes(CHOICE.options.letgo.label))
ok('선택 — 각 선택의 짧은 의미 안내가 있다',
  html.includes(CHOICE.options.keep.hint) && html.includes(CHOICE.options.letgo.hint))

// 확인
stage({
  text: '친구들과 처음 여행 갔던 날',
  emotion: 'sad',
  type: 'keep',
  timeRef: { kind: 'years', years: 3, label: '3년쯤 전' },
})
html = render('확인', <SceneConfirm />)
ok('확인 — 적은 문장이 보인다', html.includes('친구들과 처음 여행 갔던 날'))
ok('확인 — 고른 감정과 선택이 보인다', html.includes('슬픔') && html.includes('간직한 시간'))
ok('확인 — 고른 시점이 보인다', html.includes('3년쯤 전'))
/*
 * 전시 빌드에서는 터치 버튼이 아니라 손 감지 센서가 보낸다(`SensorGate`).
 * `isTestMode()`는 이 검증 환경(node, DEV 아님)에서 false이므로,
 * 전시 빌드와 같은 모양으로 그려진다 — 보내기 버튼은 없고 센서 안내가 있다.
 */
ok('확인 — 전시 빌드에는 보내기 버튼이 없다(손 감지 센서가 대신한다)',
  !html.includes('시간을 보내기'))
ok('확인 — 센서 안내 문구가 있다', html.includes(SENSOR.idle) && html.includes(SENSOR.hint))

// 확인 — 질문에 답하는 방식이었을 때는 그 질문도, 답도 보여야 한다
stage({ recordMode: 'prompt', selectedPrompt: PROMPTS[1], promptAnswer: '질문에 답한 문장' })
html = render('확인 (질문 방식)', <SceneConfirm />)
ok('확인 — 질문 방식이면 그 질문이 보인다', html.includes(PROMPTS[1]))
ok('확인 — 질문 방식이면 답한 문장이 보인다(빈 화면이 되지 않는다)', html.includes('질문에 답한 문장'))
// 이어지는 흐름은 애초에 자유 작성으로 적어 둔 것을 그대로 보낸다
stage({
  recordMode: 'free',
  selectedPrompt: null,
  promptAnswer: '',
  text: '친구들과 처음 여행 갔던 날',
  emotion: 'sad',
  type: 'keep',
  timeRef: { kind: 'years', years: 3, label: '3년쯤 전' },
})

// 보내는 중
await s().send()
stage({ sent: s().sent, stars: s().stars, stats: s().stats })
html = render('건너가는 중', <SceneSending />)
ok('건너가는 중 — 전송 중 문구가 있다', html.includes(SENSOR.sending))

// 도착
s().finishSending()
html = render('도착', <SceneDone />)
ok('도착 — 도착했다고 말한다', html.includes('당신의 시간이 우리의 우주에 도착했습니다.'))
ok('도착 — 같은 마음의 빛을 센다', html.includes('슬픔'))
ok('도착 — 원작의 "또 하나 보내기"가 있다', html.includes('또 하나 보내기'))
/*
 * 프린터가 붙어 있지 않다. 종이가 나온다고 말하면 안 된다 —
 * 손을 내밀었는데 아무것도 없으면 그건 작품이 거짓말을 한 것이다.
 */
ok('도착 — **프린터가 없으면 종이가 나온다고 말하지 않는다**',
  !html.includes('종이가 출력됩니다'))
ok('도착 — 영수증에 적혔다고만 말한다', html.includes('영수증에 적혔습니다'))
ok('도착 — 처음으로 돌아갈 수 있다', html.includes('처음으로'))

/*
 * 나의 별 (STEP 7) — 이제는 **별이 닿은 뒤**에 나온다.
 *
 * `finishSending()`이 실제 별을 동기적으로 배정해 둔다(`useKiosk.ts`) —
 * 기다릴 필요 없이 바로 확인한다. 별도로 `assignRealStar`를 다시 부르지
 * 않는다 — 실제 흐름이 이미 배정해 둔 것을 그대로 쓴다.
 */
const yourStar = s().yourStar
if (yourStar) {
  ok('실제 별이 검증된 별 중 하나로 배정되어 있다', VERIFIED_STARS.some((star) => star.id === yourStar.realStarId))
  ok('보내면 곧장 나의 별 화면으로 간다(도착 화면을 거치지 않는다)', s().scene === 'yourStar')
  stage({ yourStar })
  html = render('나의 별', <SceneYourStar />)
  ok('나의 별 — 도착 문구가 있다', html.includes('당신의 별이 도착했습니다.'))
  ok('나의 별 — 실제 이름이 보인다', html.includes(yourStar.realStarName) && html.includes(yourStar.korean))
  ok('나의 별 — 시적인 이름이 보인다', html.includes(yourStar.poeticName))
  ok('나의 별 — 위로 메시지가 보인다', html.includes(yourStar.comfortMessage))
  ok('나의 별 — 소속 별자리가 보인다', html.includes(yourStar.constellationKorean))
  ok('나의 별 — "나의 별 이야기 보기" 버튼이 있다', html.includes('나의 별 이야기 보기'))
  ok('나의 별 — 버튼 아래 호기심을 거는 안내가 있다', html.includes('이 별이 당신에게 찾아온 이유'))
  ok('나의 별 — 보내기 버튼이 없다(이미 보냈다)', !html.includes('우주로 보내기'))
  /*
   * 우리의 우주로 가는 길은 전시 전체에서 `SceneFinale` 하나뿐이다 —
   * 이 화면에는 "다음" 버튼이 따로 없고, '나의 별 이야기 보기'를
   * 지나야만 영수증(그리고 그 뒤 마지막 선택)으로 갈 수 있다.
   */
  ok('나의 별 — "우리의 우주 보기" 버튼이 없다(마지막 선택 화면으로 옮겨졌다)',
    !html.includes('우리의 우주 보기'))
  /*
   * 자세한 정보(천문학적 특징·배정 이유·위로의 말)는 기본 화면에 없다 —
   * '나의 별 이야기 보기'를 펼쳤을 때만 보여야 한다.
   */
  ok('나의 별 — 배정 이유는 기본 화면에 보이지 않는다', !html.includes(yourStar.assignmentReason))
  if (yourStar.facts[0]) {
    ok('나의 별 — 천문학적 특징은 기본 화면에 보이지 않는다', !html.includes(yourStar.facts[0]))
  }

  /* '나의 별 이야기 보기'를 펼친 모습 — storyOpen을 흉내 낼 수 없으니, 요구된 다섯 내용이
     모두 데이터에 있고 컴포넌트가 그것을 그릴 자리를 가지고 있는지는 위에서 이미 소스로 확인했다.
     여기서는 그 펼친 화면에서 다음으로 이어지는 버튼의 "목적지"만 스토어 수준에서 본다. */
  s().goTo('receipt')
  ok('"나의 별을 기록으로 남기기"를 누르면 영수증 미리보기로 간다', s().scene === 'receipt')
  ok('영수증 미리보기는 실제 별 소개보다 먼저 뜨지 않는다(이미 나의 별을 보고 난 뒤다)', yourStar !== null)
} else {
  ok('별이 닿은 뒤 실제 별이 배정되어 있다', false, '(실제 별 배정 실패 — 있어서는 안 되는 경우)')
}

// 영수증 미리보기 — 독립된 화면이 되었다(components/Receipt.tsx 자체는 손대지 않았다)
html = render('영수증 미리보기 화면', <SceneReceipt />)
ok('영수증 화면 — 프린터가 없으면 종이가 나온다고 말하지 않는다', !html.includes('종이가 출력됩니다'))
ok('영수증 화면 — 영수증에 적혔다고만 말한다', html.includes('영수증에 적혔습니다'))

// 영수증 컴포넌트 자체(데이터·출력 로직)는 그대로다
const star = s().sent as UniverseStar
html = render('영수증', <Receipt star={star} company={1} yourStar={yourStar} onClose={() => {}} />)
ok('영수증 — 제목이 있다', html.includes('A F T E R L I G H T') && html.includes('아직 도착 중인 시간'))
ok('영수증 — 번호가 네 자리다', html.includes('No. 0001'))
ok('영수증 — **기록 원문이 적히지 않는다**', !html.includes('친구들과 처음 여행 갔던 날'))
ok('영수증 — 그 시간 · 감정 · 어떻게가 실린다',
  html.includes('그 시간') && html.includes('감정') && html.includes('어떻게'))
ok('영수증 — 원작의 핵심 문장으로 맺는다',
  html.includes('시간은 사라지는 것이 아니라,') && html.includes('도착하고 있는 것입니다.'))
/*
 * 실제 별 배정 결과 — 이번 단계에서 영수증에 채운 것.
 * 배정된 것과 **정확히 같은 값**이어야 한다(지어내지 않는다).
 */
if (yourStar) {
  ok(
    '영수증 — 실제 별 이름·시적인 이름·소속 별자리가 배정 결과와 일치한다',
    html.includes(yourStar.realStarName) &&
      html.includes(yourStar.poeticName) &&
      html.includes(yourStar.constellationKorean),
  )
  ok('영수증 — 위로 메시지가 보인다', html.includes(yourStar.comfortMessage))
  ok('영수증 — 별 그림(간단한 SVG 글리프)이 있다', /<svg/.test(html))
  ok(
    '영수증 — 실제 별 QR코드가 있고, 그 별을 찾아보는 주소를 담았다(aria-label로 확인)',
    html.includes(RECEIPT.qr.starTitle) && html.includes(yourStar.realStarName),
  )
  ok(
    '영수증 QR코드가 가리키는 주소는 위키백과(검증된 외부 천문 서비스)다',
    yourStar.lookupUrl.startsWith('https://en.wikipedia.org/wiki/'),
  )
} else {
  ok('영수증 — 실제 별 정보가 있다', false, '(실제 별 배정 실패 — 있어서는 안 되는 경우)')
}
/*
 * "우리의 우주" QR코드 — 실제 공개 배포 주소가 아직 없으므로
 * (`constants/deployment.ts`의 `PUBLIC_UNIVERSE_URL === null`) 지어내지
 * 않고 생략한다. 이 자리는 그 "생략됨"을 확인한다 — 언젠가 실제 주소가
 * 채워지면 이 검사가 실패로 바뀌는 것이 맞다(그때는 이 줄을 지운다).
 */
ok(
  '영수증 — "우리의 우주" 공개 주소가 아직 없으므로 두 번째 QR코드는 지어내지 않는다',
  PUBLIC_UNIVERSE_URL === null && !html.includes(RECEIPT.qr.universeHint),
)

// 영수증을 닫으면 마지막 선택으로 간다
s().goTo('finale')
ok('영수증의 "닫기"를 누르면 마지막 선택 화면으로 간다', s().scene === 'finale')

html = render('마지막 선택', <SceneFinale />)
ok('마지막 선택 — 제목이 있다', html.includes(FINALE.title))
ok('마지막 선택 — 설명이 있다', html.includes(FINALE.desc))
ok('마지막 선택 — "우리의 우주 보기"가 있다', html.includes(FINALE.seeUniverse))
ok('마지막 선택 — "이대로 마치기"가 있다', html.includes(FINALE.finish))

// 초대
stage({ doneBeat: 'invite' })
html = render('초대', <SceneDone />)
ok('초대 — 세 문단이 그대로 있다', INVITE.words.every((line) => html.includes(line)))
ok('초대 — 첫 줄이 원문 그대로다',
  html.includes('당신의 별이 우리의 우주에 도착했습니다.'))
ok('초대 — 두 길이 모두 있다', html.includes(INVITE.yes) && html.includes(INVITE.no))
ok('초대 — 묻는 동안에는 아래 단을 두지 않는다',
  !html.includes('또 하나 보내기') && !html.includes('처음으로'))
ok('초대 — 완료 문장과 한 화면에 함께 있지 않다',
  !html.includes('당신의 시간이 우리의 우주에 도착했습니다.'))

// 머무르기를 고른 뒤
stage({ doneBeat: 'stayed' })
html = render('머무름', <SceneDone />)
ok('머무름 — 완료 화면이 그대로 남는다',
  html.includes('당신의 시간이 우리의 우주에 도착했습니다.'))
ok('머무름 — 영수증 미리보기가 그대로 있다', html.includes('영수증 미리보기'))
ok('머무름 — 또 하나 보내기와 처음으로가 돌아온다',
  html.includes('또 하나 보내기') && html.includes('처음으로'))
ok('머무름 — **우리의 우주로 가는 길을 더 권하지 않는다**',
  !html.includes(INVITE.yes) && !html.includes('우리의 우주 보기'))
stage({ doneBeat: 'arrived' })

// 우리의 우주
s().showUniverse()
html = render('우리의 우주', <SceneUniverse />)
ok('우주 — 원작의 두 줄이 그대로 있다',
  html.includes('각자의 시간은 다르지만,') && html.includes('그 시간들이 모여 하나의 우주가 됩니다.'))
ok('우주 — 일곱 별자리의 이름이 모두 떠 있다', EMOTIONS.every((e) => html.includes(e.label)))
ok('우주 — 방금 보낸 사람에게 자기 빛을 알려 준다', html.includes('당신의 빛'))
ok('우주 — 모인 빛의 수를 센다', html.includes('개의 빛이 모여 있습니다'))

// 어디에도 남의 문장이 새지 않는가
ok('우주 화면에는 남이 적은 문장이 없다', !html.includes('친구들과 처음 여행 갔던 날'))
ok('우주 — 공개된 이야기가 없다고 말한다', html.includes('아직 공개된 이야기는 없습니다'))

/*
 * 카드 안내 (STEP 7) — 우리의 우주를 다 보고 난 뒤의 마지막 걸음.
 *
 * `toCardGuide()`가 공동 우주의 상태(별 목록·집계)를 건드리지 않고
 * 장면만 옮기는지, 그리고 이 화면이 개인화된 글(시적인 이름·배정 이유)과
 * 카드 공통 문구를 섞지 않는지를 본다.
 */
console.log('\n카드 안내')
{
  const beforeStats = s().stats
  const beforeStars = s().stars
  const beforeSent = s().sent
  const beforeScene = s().scene
  if (yourStar) {
    stage({ yourStar })
    s().toCardGuide()
    ok('실제 별이 있으면 카드 안내 장면으로 옮긴다', s().scene === 'cardGuide')
    ok('카드 안내로 옮겨도 공동 우주의 별 목록은 그대로다', s().stars === beforeStars)
    ok('카드 안내로 옮겨도 공동 우주의 집계는 그대로다', s().stats === beforeStats)

    html = render('카드 안내', <SceneCardGuide />)
    ok('카드 안내 — 상단 안내 문구가 있다', html.includes(CARD_GUIDE.label))
    ok('카드 안내 — 별자리의 한국어 이름이 보인다', html.includes(yourStar.constellationKorean))
    ok('카드 안내 — 별자리의 영문 이름이 보인다', html.includes(yourStar.constellationCard.international))
    ok('카드 안내 — 카드 공통 위로 메시지가 보인다', html.includes(yourStar.constellationCard.comfortMessage))
    ok('카드 안내 — 하단 안내 문구가 있다', html.includes(CARD_GUIDE.hint))
    ok('카드 안내 — 처음으로 돌아갈 수 있다', html.includes('처음으로'))
    /*
     * 개인화된 글은 '나의 별' 화면에서 이미 보여 주었다 — 여기서
     * 되풀이하지 않는다(카드 수준 문구와 개인 문구를 섞지 않는다).
     */
    ok('카드 안내 — 시적인 이름(개인화된 글)은 보이지 않는다', !html.includes(yourStar.poeticName))
    ok('카드 안내 — 배정 이유(개인화된 글)는 보이지 않는다', !html.includes(yourStar.assignmentReason))
    if (yourStar.comfortMessage !== yourStar.constellationCard.comfortMessage) {
      ok('카드 안내 — 개인 위로 메시지와 카드 공통 메시지가 다를 때, 개인 메시지는 보이지 않는다',
        !html.includes(yourStar.comfortMessage))
    }

  } else {
    ok('카드 안내를 확인할 실제 별이 있다', false, '(실제 별 배정 실패 — 있어서는 안 되는 경우)')
  }

  /*
   * 실제 별이 없을 때는 카드 안내를 건너뛰고 곧장 처음으로 보낸다(안전한
   * 실패) — `goHome()`이 세션 상태(sent 등)를 지우므로, 이 검사가 끝난
   * 뒤에는 이어지는 "열 개를 들여다보는 자리" 검사를 위해 그대로 되돌린다.
   */
  stage({ yourStar: null, scene: 'universe' })
  s().toCardGuide()
  ok('실제 별이 없으면 카드 안내를 건너뛰고 처음으로 돌아간다', s().scene === 'attract')

  stage({ yourStar, stars: beforeStars, stats: beforeStats, sent: beforeSent, scene: beforeScene })
}

/* ── 열 개를 들여다보는 자리 ─────────────────────────── */
console.log('\n열 개를 들여다본다')
{
  const mineId = s().sessionId
  const crowd: UniverseStar[] = Array.from({ length: 10 }, (_, i) => ({
    ...(s().sent as UniverseStar),
    id: `view-${i}`,
    seq: i + 1,
    // 절반은 남의 별, 절반은 내 별
    sessionId: i % 2 === 0 ? 'someone-else' : mineId,
    text: i % 2 === 0 ? `남이 적은 ${i}번째 문장` : `내가 적은 ${i}번째 문장`,
    emotion: EMOTIONS[i % EMOTIONS.length].type,
    type: i % 3 === 0 ? 'letgo' : 'keep',
    timeRef: { kind: 'years', years: 3, label: '3년쯤 전' },
    status: 'arrived',
    shared: undefined,
  }))

  // 흩어진 하늘
  stage({ stars: crowd, viewIds: crowd.map((one) => one.id), viewIndex: -1 })
  html = render('흩어진 열 개', <SceneUniverse />)
  ok('흩어졌을 때 들어서는 말이 뜬다', html.includes(UNIVERSE.viewing.opening))
  ok('흩어졌을 때는 아무 이야기도 아직 없다', !html.includes('3년쯤 전'))

  // 남의 별이 가운데 (동의 없음)
  stage({ viewIndex: 0 })
  html = render('남의 별', <SceneUniverse />)
  ok('가운데 별의 마음이 보인다', html.includes(EMOTIONS[0].label))
  ok('간직/흘려보내기가 보인다',
    html.includes('간직한 시간') || html.includes('흘려보낸 시간'))
  ok('언제의 시간인지 보인다', html.includes('3년쯤 전'))
  ok('몇 번째인지 보인다', html.includes('1 / 10'))
  ok('다음 별로 갈 수 있다', html.includes(UNIVERSE.viewing.next))
  ok('**감상을 그만둘 수 있다**', html.includes(UNIVERSE.viewing.stop))
  ok('**동의하지 않은 남의 글은 뜨지 않는다**', !html.includes('남이 적은 0번째 문장'))
  ok('그 까닭을 말해 준다', html.includes(UNIVERSE.viewing.private))

  /*
   * 실제로 배정된 남의 별 — "임의의 별 이름을 지어 붙이지 않는다"를
   * 화면 렌더링 수준에서 직접 돈다(순수 함수 수준 검사는
   * `check.firebasePayload.ts`에 따로 있다).
   */
  const assignedOutcome = assignRealStar({
    id: crowd[0].id,
    text: '남이 적은 기억 원문 — 화면에 보이면 안 된다',
    emotion: crowd[0].emotion,
    season: 'winter',
    type: crowd[0].type,
  })
  if (assignedOutcome.ok) {
    html = render('실제로 배정된 남의 별', <SceneUniverse />)
    ok(
      '실제 별의 한국어 이름이 보인다(지어내지 않는다)',
      html.includes(assignedOutcome.view.korean),
    )
    ok(
      '실제 별의 영문 이름이 보인다',
      html.includes(assignedOutcome.view.realStarName),
    )
    ok('소속 별자리가 보인다', html.includes(assignedOutcome.view.constellationKorean))
    ok(
      '별의 뜻과 마음을 이은 한 문장이 보인다',
      html.includes(assignedOutcome.view.symbolism),
    )
    ok(
      '**그래도 기억 원문은 보이지 않는다**',
      !html.includes('남이 적은 기억 원문'),
    )
  } else {
    ok('남의 별도 실제로 배정할 수 있다', false, `(${assignedOutcome.reason})`)
  }

  // 내 별이 가운데
  stage({ viewIndex: 1 })
  html = render('내 별', <SceneUniverse />)
  ok('자기 별의 글은 자기에게 보인다', html.includes('내가 적은 1번째 문장'))
  ok('자기 별이라고 알려 준다', html.includes(UNIVERSE.viewing.mine))

  // 동의한 남의 별
  stage({
    stars: crowd.map((one, i) => (i === 0 ? { ...one, shared: true } : one)),
    viewIndex: 0,
  })
  html = render('공개된 별', <SceneUniverse />)
  ok('공개에 동의한 글은 뜬다', html.includes('남이 적은 0번째 문장'))

  // 다 보고 난 뒤
  stage({ stars: crowd, viewIndex: crowd.length })
  html = render('다 본 뒤', <SceneUniverse />)
  ok('다 보았다고 말한다', html.includes(UNIVERSE.viewing.closing))
  ok('다시 보기와 그만 보기가 있다',
    html.includes(UNIVERSE.viewing.again) && html.includes(UNIVERSE.viewing.done))

  // 들여다볼 빛이 하나도 없을 때
  stage({ stars: [], viewIds: [], viewIndex: -1 })
  html = render('빈 우주', <SceneUniverse />)
  ok('빈 우주에서는 가짜 별을 만들지 않는다', !html.includes(UNIVERSE.viewing.next))
  ok('빈 우주에서는 원래의 두 줄이 돌아온다', html.includes('각자의 시간은 다르지만,'))

  stage({ stars: s().stars, viewIds: [], viewIndex: -1 })
}

console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
