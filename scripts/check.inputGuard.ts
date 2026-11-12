import { canSendNow, checkMemoryText, markSent, resetGuardForTest } from '@/lib/inputGuard'

/**
 * 부적절한 입력 제한(`lib/inputGuard.ts`)을 돈다.
 *
 * 가장 중요한 절반은 "막아야 할 것을 막는가"가 아니라 **"막으면 안 되는
 * 것을 막지 않는가"**다 — 슬픔·분노·불안·후회, 'ㅋㅋㅋ' 같은 자연스러운
 * 한국어 표현, 한두 글자짜리 짧은 기록. 이 셋을 지키지 못하면 §1·§2·§3을
 * 어기는 것이다.
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

section('1. 절대 막지 않아야 하는 것 — 힘든 감정')
{
  const cases = [
    '오늘 정말 슬펐다. 눈물이 멈추지 않았어요.',
    '그 사람 때문에 너무 화가 났다. 분노가 가라앉지 않는다.',
    '불안해서 잠을 못 잤어요. 계속 걱정만 됩니다.',
    '그때 그렇게 하지 않은 걸 아직도 후회해요.',
    '힘들었다. 그냥 다 그만두고 싶었던 날이었어요.',
    '죽고 싶을 만큼 괴로웠던 시기가 있었어요.',
    '우울해서 아무것도 하기 싫었던 그 겨울.',
  ]
  for (const text of cases) {
    const result = checkMemoryText(text)
    ok(`"${text.slice(0, 18)}…" 는 막히지 않는다`, result.ok, JSON.stringify(result))
  }
}

section('2. 절대 막지 않아야 하는 것 — 자연스러운 한국어 반복 표현')
{
  const cases = [
    'ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ 그때 진짜 웃겼어요',
    '너무 좋아서 계속 웃었어요 ㅎㅎㅎㅎㅎㅎㅎㅎ',
    '보고 싶어서 울었어요 ㅠㅠㅠㅠㅠㅠㅠㅠㅠ',
    '정말요?!?!?!?!?!?!?!?!',
  ]
  for (const text of cases) {
    const result = checkMemoryText(text)
    ok(`"${text}" 는 막히지 않는다(자연스러운 반복)`, result.ok, JSON.stringify(result))
  }
}

section('3. 절대 막지 않아야 하는 것 — 아주 짧은 기록')
{
  // §2: "최소 2자 제한을 무조건 적용하지 말고" — 한 글자도 뜻이 있을 수 있다.
  ok('한 글자("ㅁ")도 막히지 않는다', checkMemoryText('ㅁ').ok)
  ok('두 글자("응.")도 막히지 않는다', checkMemoryText('응.').ok)
}

section('4. 명백한 욕설·혐오 표현은 막는다')
{
  ok('욕설이 섞인 글은 막힌다', !checkMemoryText('진짜 개새끼 같은 하루였다').ok)
  const result = checkMemoryText('씨발 진짜 최악이었다')
  ok('그 이유는 profanity다', !result.ok && result.reason === 'profanity')
}

section('4-1. 흔한 우회 표현도 잡는다(§1) — 띄어쓰기 · 특수문자 · 숫자 · 글자 늘여 쓰기')
{
  ok('띄어쓰기로 떼어 적어도 막힌다', !checkMemoryText('진짜 씨 발 같은 하루였다').ok)
  ok('특수문자를 끼워 넣어도 막힌다', !checkMemoryText('진짜 씨.발.같은 하루였다').ok)
  ok('숫자를 끼워 넣어도 막힌다', !checkMemoryText('진짜 씨1발 같은 하루였다').ok)
  ok('어간의 한 글자를 늘여 써도 막힌다', !checkMemoryText('진짜 개새새새끼 같은 하루였다').ok)
  ok(
    '여러 겹으로 섞어도(띄어쓰기+특수문자+숫자) 막힌다',
    !checkMemoryText('진짜 씨.1 발 같은 하루였다').ok,
  )
}

section('4-2. 멀쩡한 낱말과 겹치는 오탐은 막지 않는다(§1 "오탐 최소화") — "병신" 예시')
{
  ok('"병 신발을 샀다"는 막히지 않는다(병 + 신발)', checkMemoryText('겨울이라 병 신발을 샀다').ok)
  ok('"그 병 신다가 깨졌다"도 막히지 않는다(병 + 신다)', checkMemoryText('그 병 신다가 깨졌다').ok)
  ok('붙여서 적은 실제 욕설은 그대로 막힌다', !checkMemoryText('진짜 병신 같은 하루였다').ok)
}

section('5. 개인정보처럼 보이는 글은 막고, 이유를 알 수 있다')
{
  const phone = checkMemoryText('연락은 010-1234-5678 로 주세요')
  ok('전화번호 모양은 막힌다', !phone.ok && phone.reason === 'personal-info')
  const email = checkMemoryText('메일은 someone@example.com 입니다')
  ok('이메일 모양은 막힌다', !email.ok && email.reason === 'personal-info')
  ok('그냥 숫자가 섞인 평범한 기록은 안 막힌다', checkMemoryText('3년 전 겨울, 그날 23살이었어요').ok)
}

section('6. 뜻 없는 반복(스팸)은 막는다')
{
  const result = checkMemoryText('ㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁㅁ')
  ok('같은 뜻 없는 글자 반복은 막힌다', !result.ok && result.reason === 'spam')
  ok('같은 숫자 반복도 막힌다', !checkMemoryText('11111111111111111').ok)
}

section('7. 짧은 시간 반복 제출 — 쿨다운')
{
  resetGuardForTest()
  const t0 = 1_000_000
  ok('처음 보내는 것은 허용된다', canSendNow(t0))
  markSent(t0)
  ok('바로 다음 순간은 막힌다', !canSendNow(t0 + 500))
  ok('14.9초 뒤에도 아직 막힌다', !canSendNow(t0 + 14_900))
  ok('15초가 지나면 다시 허용된다', canSendNow(t0 + 15_000))

  /*
   * §5: "관람객의 개별 체험 단위로 적용 — 공용 키오스크에서 이전
   * 관람객 때문에 다음 관람객이 제한되지 않도록." 창이 15초로
   * 아주 짧다는 것 자체가 그 답이다 — 실제 관람객 한 명이 기록을
   * 적고 시간·계절·감정·간직을 고르는 데는 15초보다 훨씬 오래
   * 걸리므로, 다음 관람객은 자연히 이 창을 넘긴 뒤에 보낸다.
   */
  resetGuardForTest()
}

console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
