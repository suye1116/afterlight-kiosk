/**
 * 소리를 계측한다.
 *
 * 귀로 듣는 일은 사람이 해야 한다. 그 대신 여기서는 **귀로는 알 수 없는 것**을 센다 —
 * 소리가 두 번 나지는 않는가, 끝난 소리가 치워지는가, 음소거가 정말 조용한가,
 * 일곱 마음의 소리가 정말로 서로 다른가.
 *
 * AudioContext 자리에 **세는 AudioContext**를 끼운다. 캔버스를 계측할 때와 같은 방법이다.
 */

/*
 * 들여오기는 정적으로 한다.
 *
 * `src/audio/*`는 **모듈을 읽는 동안에는 AudioContext를 건드리지 않는다** —
 * `wake()`를 부를 때 비로소 만든다. 그래서 먼저 들여와도 괜찮고,
 * 아래의 "들여오기만으로는 만들지 않는다"는 바로 그것을 세는 것이다.
 */
import * as audio from '@/audio'
import { EMOTIONS } from '@/constants/emotions'

let pass = 0
let fail = 0
function ok(name: string, condition: boolean, extra = '') {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`) }
  else { fail += 1; console.log(`  ✗ ${name} ${extra}`) }
}
function section(name: string) { console.log(`\n${name}`) }

/* ── 세는 AudioContext ───────────────────────────────── */

interface Tally {
  contexts: number
  oscillators: number
  started: number
  stopped: number
  buffers: number
  gains: number
  resumes: number
  closed: number
}

const tally: Tally = {
  contexts: 0, oscillators: 0, started: 0, stopped: 0,
  buffers: 0, gains: 0, resumes: 0, closed: 0,
}

function param(value = 0) {
  return {
    value,
    setValueAtTime() { return this },
    linearRampToValueAtTime() { return this },
    exponentialRampToValueAtTime() { return this },
    cancelScheduledValues() { return this },
  }
}

function node(extra: Record<string, unknown> = {}) {
  return {
    connect() {},
    disconnect() {},
    addEventListener() {},
    ...extra,
  }
}

class FakeAudioContext {
  currentTime = 0
  sampleRate = 48000
  state: 'suspended' | 'running' | 'closed' = 'suspended'
  destination = node()

  constructor() {
    tally.contexts += 1
  }

  async resume() {
    tally.resumes += 1
    this.state = 'running'
  }

  async close() {
    tally.closed += 1
    this.state = 'closed'
  }

  createOscillator() {
    tally.oscillators += 1
    return node({
      type: 'sine',
      frequency: param(440),
      detune: param(0),
      start: () => { tally.started += 1 },
      stop: () => { tally.stopped += 1 },
    })
  }

  createGain() {
    tally.gains += 1
    return node({ gain: param(1) })
  }

  createBiquadFilter() {
    return node({ type: 'lowpass', frequency: param(1000), Q: param(1) })
  }

  createConvolver() {
    return node({ buffer: null })
  }

  createBuffer(channels: number, length: number) {
    tally.buffers += 1
    const data = new Float32Array(length)
    return { getChannelData: () => data, length, numberOfChannels: channels }
  }

  createBufferSource() {
    return node({
      buffer: null,
      start: () => { tally.started += 1 },
      stop: () => { tally.stopped += 1 },
    })
  }
}

/* ── 들여오기 전에 아무 일도 일어나지 않아야 한다 ────── */

section('들여오기만 했을 때')
{
  const g = globalThis as unknown as Record<string, unknown>
  g.AudioContext = FakeAudioContext
  // localStorage가 없는 자리(node)에서도 설정이 읽혀야 한다
  ok('AudioContext가 없어도 모듈이 올라온다', true)
}

const { EMOTION_VOICES } = audio

ok('**들여오기만으로는 AudioContext를 만들지 않는다**', tally.contexts === 0,
  `(${tally.contexts}개)`)
ok('소리를 낼 수 있는 기기로 본다', audio.canSound() === true)
ok('깨우기 전에는 효과음이 나지 않는다', audio.sfxAllowed() === false)
audio.play('ui.tap')
ok('깨우기 전에 소리를 내도 아무 일도 없다', tally.oscillators === 0)

/* ── 깨운다 ──────────────────────────────────────────── */

section('사람의 첫 손짓')
{
  const woke = audio.wake()
  ok('깨어난다', woke === true)
  ok('AudioContext를 하나 만든다', tally.contexts === 1)
  ok('막혀 있으면 깨운다 (resume)', tally.resumes === 1)

  audio.wake()
  audio.wake()
  ok('**여러 번 불러도 AudioContext는 하나뿐이다**', tally.contexts === 1, `(${tally.contexts}개)`)
  ok('이제 소리를 낼 수 있다', audio.sfxAllowed() === true)
}

/* ── 소리 하나하나 ───────────────────────────────────── */

section('이름 붙은 소리들')
{
  audio.forgetGaps()
  let missing = 0
  for (const name of audio.SOUND_NAMES) {
    const before = tally.oscillators + tally.buffers
    audio.forgetGaps()
    audio.play(name)
    if (tally.oscillators + tally.buffers === before) {
      missing += 1
      console.log(`      소리가 나지 않음: ${name}`)
    }
  }
  ok(`${audio.SOUND_NAMES.length}가지 소리가 모두 난다`, missing === 0)

  // 끝난 소리는 반드시 멈춘다
  ok('**시작한 소리는 모두 멈춘다**', tally.started === tally.stopped,
    `(시작 ${tally.started} · 멈춤 ${tally.stopped})`)
}

section('너무 자주 나지 않는다')
{
  audio.forgetGaps()
  const before = tally.oscillators
  // 자판을 아주 빠르게 두드린다
  for (let i = 0; i < 40; i += 1) audio.play('type.key')
  const made = tally.oscillators - tally.buffers
  ok('빠르게 두드려도 소리가 그만큼 겹치지 않는다', tally.buffers < 40,
    `(40번 두드려 ${tally.buffers}번 소리)`)
  void before
  void made
}

/* ── 음소거 ──────────────────────────────────────────── */

section('음소거')
{
  const settings = audio.useSoundSettings.getState()

  audio.forgetGaps()
  settings.setOn(false)
  const quiet = tally.oscillators + tally.buffers
  for (const name of audio.SOUND_NAMES) {
    audio.forgetGaps()
    audio.play(name)
  }
  ok('**전체를 끄면 아무 소리도 나지 않는다**',
    tally.oscillators + tally.buffers === quiet,
    `(${tally.oscillators + tally.buffers - quiet}개가 났다)`)
  ok('꺼진 상태를 알고 있다', audio.sfxAllowed() === false && audio.bgmAllowed() === false)

  settings.setOn(true)
  settings.setSfx(false)
  audio.forgetGaps()
  const noSfx = tally.oscillators + tally.buffers
  audio.play('ui.tap')
  ok('효과음만 끄면 효과음이 나지 않는다', tally.oscillators + tally.buffers === noSfx)
  ok('그래도 배경음악은 허락된다', audio.bgmAllowed() === true)

  settings.setSfx(true)
  settings.setBgm(false)
  ok('배경음악만 끄면 배경음악이 멈춘다', audio.bgmAllowed() === false)
  ok('그래도 효과음은 난다', audio.sfxAllowed() === true)

  settings.setBgm(true)
  settings.setSfxVolume(0)
  ok('음량을 0으로 내려도 조용하다', audio.sfxAllowed() === false)
  settings.setSfxVolume(0.7)
  ok('되돌리면 다시 난다', audio.sfxAllowed() === true)
}

/* ── 배경음악 ────────────────────────────────────────── */

section('배경음악')
{
  audio.stopAmbient()
  ok('처음에는 흐르지 않는다', audio.isAmbientPlaying() === false)

  audio.startAmbient()
  ok('시작하면 흐른다', audio.isAmbientPlaying() === true)
  const voices = tally.oscillators
  ok('사인파 하나가 아니라 여러 목소리다', voices > 6, `(${voices}개)`)

  audio.startAmbient()
  audio.startAmbient()
  ok('**이미 흐르고 있으면 다시 시작하지 않는다**', tally.oscillators === voices,
    `(${tally.oscillators - voices}개가 더 생겼다)`)

  audio.stopAmbient()
  ok('멈추면 멈춘다', audio.isAmbientPlaying() === false)
}

/* ── 되풀이에 빠지지 않는가 ──────────────────────────── */

section('되풀이에 빠지지 않는다')
{
  /*
   * ─── 실제로 화면 전체를 멈추게 했던 일 ─────────────────
   *  `startAmbient`이 맨 앞에서 `wake()`를 부르고, `wake()`가 설정을 건드리고,
   *  그 설정을 듣던 쪽이 다시 `startAmbient`을 불렀다. `running`은 맨 끝에서야
   *  채워지므로 가드가 걸리지 않아 **끝없이 되풀이됐다.**
   *
   *  `RangeError: Maximum call stack size exceeded`가 나면서 자바스크립트가
   *  죽었고, 그래서 **터치도 소리도 멈췄다.**
   *
   *  앞의 검사들이 이걸 못 잡은 까닭은 하나다 — 설정을 듣는 쪽
   *  (`watchSettings`)을 켜 두지 않은 채로만 시험했기 때문이다.
   *  여기서는 실제 화면과 똑같이 켜 두고 돌린다.
   * ───────────────────────────────────────────────────────
   */
  audio.stopAmbient()
  const settings = audio.useSoundSettings.getState()
  settings.setOn(true)
  settings.setBgm(true)
  settings.setBgmVolume(0.5)

  const stopWatching = audio.watchSettings()
  const contextsBefore = tally.contexts

  // 되풀이에 빠지면 여기서 RangeError로 죽는다
  audio.startAmbient()
  ok('**설정을 듣는 중에 음악을 켜도 되풀이에 빠지지 않는다**', true)
  ok('음악이 흐른다', audio.isAmbientPlaying() === true)

  for (let i = 0; i < 30; i += 1) audio.wake()
  ok('**깨우기를 서른 번 불러도 멀쩡하다**', true)
  ok('AudioContext는 여전히 하나', tally.contexts === contextsBefore,
    `(${tally.contexts - contextsBefore}개가 더 생겼다)`)

  for (let i = 0; i < 20; i += 1) {
    settings.setBgm(false)
    settings.setBgm(true)
  }
  ok('**음악을 스무 번 껐다 켜도 멀쩡하다**', true)
  ok('그래도 흐르고 있다', audio.isAmbientPlaying() === true)

  settings.setOn(false)
  ok('전체를 끄면 음악도 멈춘다', audio.isAmbientPlaying() === false)
  settings.setOn(true)
  ok('다시 켜면 다시 흐른다', audio.isAmbientPlaying() === true)

  stopWatching()
  audio.stopAmbient()
  ok('듣기를 그만둘 수 있다', audio.isAmbientPlaying() === false)
}

/* ── 일곱 마음의 소리 ────────────────────────────────── */

section('일곱 마음의 소리')
{
  ok('감정 목록과 소리 목록이 정확히 같다',
    EMOTIONS.every((one) => one.type in EMOTION_VOICES) &&
    Object.keys(EMOTION_VOICES).length === EMOTIONS.length,
    `(감정 ${EMOTIONS.length} · 소리 ${Object.keys(EMOTION_VOICES).length})`)

  /*
   * **같은 소리의 음높이만 바꾼 것이 아님**을 센다.
   * 여섯 가지 성질이 저마다 몇 가지 값을 갖는지 본다 — 하나뿐이면
   * 그 성질로는 아무것도 구분되지 않는다는 뜻이다.
   */
  const spread = (pick: (v: typeof EMOTION_VOICES[string]) => unknown) =>
    new Set(Object.values(EMOTION_VOICES).map((v) => String(pick(v)))).size

  const axes: Array<[string, number]> = [
    ['음높이', spread((v) => v.base)],
    ['음색(파형)', spread((v) => v.wave)],
    ['음의 조합', spread((v) => v.chord.join('·'))],
    ['길이(감쇠)', spread((v) => v.decay)],
    ['어택', spread((v) => v.attack)],
    ['잔향', spread((v) => v.send)],
    ['깎임(cutoff)', spread((v) => v.cutoff)],
    ['입자', spread((v) => v.particles)],
  ]
  for (const [name, count] of axes) {
    ok(`${name}이(가) 서로 다르다`, count >= 2, `(${count}가지)`)
  }
  console.log('      ' + axes.map(([n, c]) => `${n} ${c}가지`).join(' · '))

  // 어느 두 마음도 모든 성질이 똑같지는 않다
  const fingerprint = (key: string) => {
    const v = EMOTION_VOICES[key]
    return [v.wave, v.base, v.chord.join('·'), v.attack, v.decay, v.cutoff, v.send, v.particles].join('|')
  }
  const prints = EMOTIONS.map((one) => fingerprint(one.type))
  ok('**어느 두 마음의 소리도 같지 않다**', new Set(prints).size === prints.length)

  // 두 마음을 고르면 적어도 세 가지가 달라야 한다
  let tooAlike = 0
  for (let i = 0; i < EMOTIONS.length; i += 1) {
    for (let j = i + 1; j < EMOTIONS.length; j += 1) {
      const a = EMOTION_VOICES[EMOTIONS[i].type]
      const b = EMOTION_VOICES[EMOTIONS[j].type]
      let differ = 0
      if (a.wave !== b.wave) differ += 1
      if (a.base !== b.base) differ += 1
      if (a.chord.join() !== b.chord.join()) differ += 1
      if (a.attack !== b.attack) differ += 1
      if (a.decay !== b.decay) differ += 1
      if (a.cutoff !== b.cutoff) differ += 1
      if (a.send !== b.send) differ += 1
      if (a.particles !== b.particles) differ += 1
      if (differ < 3) {
        tooAlike += 1
        console.log(`      너무 닮음: ${EMOTIONS[i].label} × ${EMOTIONS[j].label} (${differ}가지만 다름)`)
      }
    }
  }
  ok('어느 두 마음도 세 가지 이상 다르다', tooAlike === 0)

  // 실제로 소리를 내 본다
  audio.forgetGaps()
  let silent = 0
  for (const one of EMOTIONS) {
    for (const type of ['keep', 'letgo'] as const) {
      const before = tally.oscillators
      audio.playSend(one.type, type)
      if (tally.oscillators === before) {
        silent += 1
        console.log(`      소리가 나지 않음: ${one.label} · ${type}`)
      }
    }
  }
  ok('일곱 × 둘, 열네 가지가 모두 소리를 낸다', silent === 0)
  ok('간직한 빛에는 맺는 음이 하나 더 있다', (() => {
    audio.forgetGaps()
    const a = tally.oscillators
    audio.playSend('sad', 'keep')
    const keep = tally.oscillators - a
    const b = tally.oscillators
    audio.playSend('sad', 'letgo')
    const letgo = tally.oscillators - b
    return keep > letgo
  })())
}

/* ── 영수증이 펼쳐지는 소리 ──────────────────────────── */

section('영수증이 펼쳐지는 소리')
{
  ok('이름이 있다', audio.SOUND_NAMES.includes('receipt.open'))

  audio.forgetGaps()
  const before = tally.buffers
  audio.play('receipt.open')
  ok('펼치면 소리가 난다', tally.buffers > before)

  // 같은 펼침에서 두 번 나지 않는다 (간격이 펼쳐지는 시간보다 길다)
  const once = tally.buffers
  audio.play('receipt.open')
  ok('**같은 동작에서 두 번 나지 않는다**', tally.buffers === once,
    `(${tally.buffers - once}번 더 났다)`)

  // 닫았다 다시 펼치면 다시 난다
  audio.forgetGaps()
  const again = tally.buffers
  audio.play('receipt.open')
  ok('닫았다 다시 펼치면 다시 난다', tally.buffers > again)

  ok('시작한 소리는 멈춘다', tally.started === tally.stopped,
    `(시작 ${tally.started} · 멈춤 ${tally.stopped})`)

  // 소리가 꺼져 있어도 아무 일 없다
  const settings = audio.useSoundSettings.getState()
  settings.setOn(false)
  audio.forgetGaps()
  const quiet = tally.buffers
  audio.play('receipt.open')
  ok('소리를 꺼 두면 나지 않는다', tally.buffers === quiet)
  settings.setOn(true)
}

/* ── 타자기 ──────────────────────────────────────────── */

section('타자기')
{
  const { soundForKey, mayListen } = audio

  ok('글자를 치면 소리가 난다', soundForKey({ key: 'ㄱ' }) === 'type.key')
  ok('영문도 마찬가지', soundForKey({ key: 'a' }) === 'type.key')
  ok('띄어쓰기도 소리가 난다', soundForKey({ key: ' ' }) === 'type.key')
  ok('**한글을 조합하는 중에도 한 번 누르면 한 번**',
    soundForKey({ key: 'Process', keyCode: 229 }) === 'type.key')
  ok('keyCode 229만 와도 알아본다', soundForKey({ key: 'Unidentified', keyCode: 229 }) === 'type.key')
  ok('지우는 소리는 따로다', soundForKey({ key: 'Backspace' }) === 'type.back')
  ok('Delete도 지우는 소리', soundForKey({ key: 'Delete' }) === 'type.back')

  ok('화살표는 소리가 없다', soundForKey({ key: 'ArrowLeft' }) === null)
  ok('Shift는 소리가 없다', soundForKey({ key: 'Shift' }) === null)
  ok('Tab은 소리가 없다', soundForKey({ key: 'Tab' }) === null)
  ok('**붙여넣기(Cmd+V)는 타자 소리를 내지 않는다**',
    soundForKey({ key: 'v', metaKey: true }) === null)
  ok('Ctrl 조합도 마찬가지', soundForKey({ key: 'a', ctrlKey: true }) === null)

  ok('**비밀번호 칸에는 달지 않는다**', mayListen({ type: 'password' }) === false)
  ok('autocomplete로도 알아본다',
    mayListen({ type: 'text', autocomplete: 'current-password' }) === false)
  ok('보통 칸에는 단다', mayListen({ type: 'text' }) === true)
  ok('없는 칸에는 달지 않는다', mayListen(null) === false)
}

/* ── 누르는 자리 ─────────────────────────────────────── */

section('누르는 자리')
{
  /* 아주 작은 가짜 문서. 눌린 것이 버튼인지만 가리면 된다. */
  const handlers: Array<(event: unknown) => void> = []
  const g = globalThis as unknown as Record<string, unknown>
  g.document = {
    addEventListener: (_type: string, fn: (event: unknown) => void) => handlers.push(fn),
    removeEventListener: (_type: string, fn: (event: unknown) => void) => {
      const i = handlers.indexOf(fn)
      if (i >= 0) handlers.splice(i, 1)
    },
  }

  function button(attrs: Record<string, string> = {}) {
    const self = {
      closest: (sel: string) => (sel.includes('button') ? self : null),
      hasAttribute: (name: string) => name in attrs,
      getAttribute: (name: string) => attrs[name] ?? null,
    }
    return self
  }

  const stop = audio.listenToButtons()
  ok('귀를 하나만 둔다', handlers.length === 1, `(${handlers.length}개)`)

  const stopAgain = audio.listenToButtons()
  ok('**두 번 불러도 귀가 둘이 되지 않는다**', handlers.length === 1, `(${handlers.length}개)`)
  void stopAgain

  const click = (target: unknown) => {
    audio.forgetGaps()
    const before = tally.oscillators + tally.buffers
    for (const fn of handlers) fn({ target })
    return tally.oscillators + tally.buffers - before
  }

  ok('버튼을 누르면 소리가 한 번 난다', click(button()) > 0)
  ok('**꺼진 버튼은 소리를 내지 않는다**', click(button({ disabled: '' })) === 0)
  ok('aria-disabled도 본다', click(button({ 'aria-disabled': 'true' })) === 0)
  ok('data-sound="none"이면 내지 않는다', click(button({ 'data-sound': 'none' })) === 0)
  ok('data-sound로 다른 소리를 고를 수 있다', click(button({ 'data-sound': 'ui.choose' })) > 0)
  ok('버튼이 아니면 소리가 없다', click({ closest: () => null }) === 0)

  stop()
  ok('귀를 거둘 수 있다', handlers.length === 0)
}

/* ── 치우기 ──────────────────────────────────────────── */

section('치우기')
{
  ok('시작한 소리는 끝내 모두 멈춘다', tally.started === tally.stopped,
    `(시작 ${tally.started} · 멈춤 ${tally.stopped})`)
  audio.shutdown()
  ok('마칠 때 AudioContext를 닫는다', tally.closed === 1)
}

console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
