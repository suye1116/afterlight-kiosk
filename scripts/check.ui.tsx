import { renderToStaticMarkup } from 'react-dom/server'
import { SceneAttract } from '@/scenes/SceneAttract'
import { SceneIntro } from '@/scenes/SceneIntro'
import { SceneRecord } from '@/scenes/SceneRecord'
import { SceneEmotion } from '@/scenes/SceneEmotion'
import { SceneChoice } from '@/scenes/SceneChoice'
import { SceneConfirm } from '@/scenes/SceneConfirm'
import { SceneSending } from '@/scenes/SceneSending'
import { SceneDone } from '@/scenes/SceneDone'
import { SceneUniverse } from '@/scenes/SceneUniverse'
import { Receipt } from '@/components/Receipt'
import { EMOTIONS } from '@/constants/emotions'
import { INVITE, SENSOR, UNIVERSE } from '@/constants/text.exhibit'
import { useKiosk } from '@/store/useKiosk'
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

// 인트로
html = render('인트로', <SceneIntro />)
ok('인트로 — 원작의 두 줄이 그대로 있다',
  html.includes('지금 당신이 보고 있는 빛은,') && html.includes('이미 지나간 시간입니다.'))
ok('인트로 — 원작의 물음이 그대로 있다', html.includes('당신에게도 아직 도착 중인 시간이 있나요?'))
ok('인트로 — 원작의 버튼 글자가 그대로 있다', html.includes('나의 시간을 보내기'))

// 기록
s().goHome()
s().goTo('record')
html = render('기록', <SceneRecord />)
ok('기록 — 원작의 질문이 그대로 있다', html.includes('지금 떠오르는 시간이 있나요?'))
ok('기록 — 원작의 예시 문장이 그대로 있다', html.includes('친구들과 처음 여행 갔던 날'))
ok('기록 — 80자까지다', html.includes('/ 80') && /maxlength="80"/i.test(html))
ok('기록 — 그 시간이 언제였는지 묻는다', html.includes('그 시간은 언제였나요?'))
ok('기록 — 고르지 않아도 된다고 알린다', html.includes('고르지 않아도 보낼 수 있습니다.'))

// 감정
html = render('감정', <SceneEmotion />)
ok('마음 — 일곱 빛이 모두 있다', EMOTIONS.every((e) => html.includes(e.label)),
  `(${EMOTIONS.map((e) => e.label).join(' ')})`)

// 간직 / 흘려보내기
html = render('간직·흘려보내기', <SceneChoice />)
ok('선택 — 원작의 두 이름이 그대로 있다',
  html.includes('간직하고 싶은 시간') && html.includes('흘려보내고 싶은 시간'))

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

// 영수증
const star = s().sent as UniverseStar
html = render('영수증', <Receipt star={star} company={1} onClose={() => {}} />)
ok('영수증 — 제목이 있다', html.includes('A F T E R L I G H T') && html.includes('아직 도착 중인 시간'))
ok('영수증 — 번호가 네 자리다', html.includes('No. 0001'))
ok('영수증 — **기록 원문이 적히지 않는다**', !html.includes('친구들과 처음 여행 갔던 날'))
ok('영수증 — 그 시간 · 감정 · 어떻게가 실린다',
  html.includes('그 시간') && html.includes('감정') && html.includes('어떻게'))
ok('영수증 — 원작의 핵심 문장으로 맺는다',
  html.includes('시간은 사라지는 것이 아니라,') && html.includes('도착하고 있는 것입니다.'))

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
