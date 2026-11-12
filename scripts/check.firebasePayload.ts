import { SAMPLE_STARS } from '@/constants/realStars/index'
import {
  assignRealStar,
  buildAssignmentReason,
  buildComfortMessage,
  type AssignedStarView,
} from '@/lib/starAssignment/index'

/**
 * "Firebase에 저장하는 정보만으로, 원래 화면에 떴던 '나의 별 이야기'·
 * 위로 문구를 글자 하나 다르지 않게 다시 지을 수 있는가"를 돈다.
 *
 * ─── 왜 이 검사가 필요한가 ──────────────────────────────
 *  영수증이 Firebase(`assignments/{token}`)에 쓰는 것은 기억 원문이
 *  아니라 `receipt.assignment`(`lib/receipt.ts`) — `realStarId`·
 *  `season`·`type`·`emotion`·`meaningTags`·`recordMode`·`promptQuestion`
 *  뿐이다. "나의 별 관측 페이지"는 이 다섯·여섯 칸만 가지고, 키오스크가
 *  쓰던 **같은 순수 함수**(`buildAssignmentReason`·`buildComfortMessage`)
 *  를 다시 돌려 문장을 짓는다.
 *
 *  이 검사는 그 약속이 실제로 지켜지는지를, 서버 코드가 아니라
 *  (서버는 평범한 JS라 이 TS 로직을 직접 부르지 못한다) 이 로직이
 *  실제로 사는 자리에서 직접 확인한다 — `assignRealStar`가 돌려준
 *  화면용 문구와, "Firebase에 저장할 모양 그대로"에서 다시 지은
 *  문구가 **정확히 같은 문자열**인지 본다.
 * ───────────────────────────────────────────────────────
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

/**
 * `lib/receipt.ts`의 `buildReceipt`가 `receipt.assignment`에 넣는 것과
 * 정확히 같은 모양 — 기억 원문이 전혀 없다는 것을 타입으로도 보증한다.
 */
function toFirebasePayload(view: AssignedStarView, type: 'keep' | 'letgo') {
  return {
    realStarId: view.realStarId,
    season: view.season,
    type,
    meaningTags: view.meaningTags,
  }
}

/** Firebase에 저장했을 모양만 가지고, 저장소도 원문도 없이 문장을 다시 짓는다. */
function rebuildFromPayload(
  payload: ReturnType<typeof toFirebasePayload>,
  emotion: string,
  recordMode: 'free' | 'prompt' | undefined,
  promptQuestion: string | undefined,
) {
  const star = SAMPLE_STARS.find((s) => s.id === payload.realStarId)
  if (!star) return null
  const reason = buildAssignmentReason(
    star,
    { season: payload.season, type: payload.type, emotion, recordMode, promptQuestion },
    payload.meaningTags,
  )
  const comfort = buildComfortMessage(star, payload.type)
  return { reason, comfort }
}

section('Firebase 저장값만으로 나의 별 이야기·위로 문구를 재구성한다')

const cases = [
  {
    id: 'fb-check-free-winter',
    text: '겨울에 오래 사귄 애인과 헤어졌어요. 마지막 인사를 나누고 혼자 걷던 밤.',
    emotion: 'sad',
    season: 'winter' as const,
    type: 'letgo' as const,
  },
  {
    id: 'fb-check-free-spring',
    text: '봄바람을 맞으며 아무 이유 없이 그냥 좋았던 산책길.',
    emotion: 'calm',
    season: 'spring' as const,
    type: 'keep' as const,
  },
  {
    /*
     * §PART 2 이후 질문에 답하는 방식은 시간·계절 화면을 거치지 않으므로
     * `season`은 항상 'unknown'이다 — 'autumn' 같은 값은 더 이상 이
     * 방식에서 나올 수 없다. 그 실제 모양 그대로 둔다.
     */
    id: 'fb-check-prompt-unknown-season',
    text: '졸업식 날 부모님이 눈물을 흘리며 축하해주셨던 순간이에요.',
    emotion: 'happy',
    season: 'unknown' as const,
    type: 'keep' as const,
    recordMode: 'prompt' as const,
    promptQuestion: '가장 기억에 남는 순간은 언제였나요?',
  },
  {
    id: 'fb-check-ambiguous',
    text: '그냥 그랬어요.',
    emotion: 'other',
    season: 'summer' as const,
    type: 'letgo' as const,
  },
]

for (const input of cases) {
  const outcome = assignRealStar(input)
  ok(`[${input.id}] 배정 성공`, outcome.ok)
  if (!outcome.ok) continue

  const payload = toFirebasePayload(outcome.view, input.type)

  // 저장될 값 중 어디에도 기억 원문이 없다 — 글자 그대로 들어 있으면 실패.
  const serialized = JSON.stringify(payload)
  ok(`[${input.id}] 저장값에 기억 원문이 섞여 있지 않다`, !serialized.includes(input.text))

  const rebuilt = rebuildFromPayload(payload, input.emotion, input.recordMode, input.promptQuestion)
  ok(`[${input.id}] 저장된 별 id로 별 데이터를 다시 찾았다`, rebuilt !== null)
  if (!rebuilt) continue

  ok(
    `[${input.id}] 재구성한 '나의 별 이야기'가 원래 화면 문구와 글자 단위로 같다`,
    rebuilt.reason === outcome.view.assignmentReason,
    rebuilt.reason === outcome.view.assignmentReason
      ? ''
      : `\n    원래: ${outcome.view.assignmentReason}\n    재구성: ${rebuilt.reason}`,
  )
  ok(
    `[${input.id}] 재구성한 위로 문구가 원래 화면 문구와 글자 단위로 같다`,
    rebuilt.comfort === outcome.view.comfortMessage,
  )
}

section('같은 기억을 두 번 배정해도(멱등) 저장값이 달라지지 않는다')
{
  const first = assignRealStar(cases[0])
  const second = assignRealStar(cases[0])
  ok(
    '두 번째 호출도 같은 realStarId를 돌려준다',
    first.ok && second.ok && first.view.realStarId === second.view.realStarId,
  )
}

console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
