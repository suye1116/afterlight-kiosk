import { audio, bgmAllowed, cleanup, wake } from './engine'
import { useSoundSettings } from './settings'

/**
 * 몽환적인 배경음악.
 *
 * ─── 루프가 없다 ───────────────────────────────────────
 *  반복되는 토막을 이어 붙이지 않는다. **계속 자라는 소리**다 —
 *  느린 패드가 깔려 있고, 그 위에서 화음이 20~34초마다 조용히 옮겨 가고,
 *  이따금 유리 같은 한 음이 떨어진다.
 *
 *  그래서 **이어 붙는 자리가 아예 없다.** 루프 경계가 튀는 문제는
 *  경계를 잘 만들어 푸는 것이 아니라, 경계를 두지 않아 푼다.
 * ───────────────────────────────────────────────────────
 *
 * 화면이 바뀌어도 다시 시작하지 않는다. 이 모듈은 하나뿐이고,
 * 한 번 흐르기 시작하면 사람이 끄기 전까지 그대로 흐른다.
 */

/** 패드의 목소리 수. 많으면 두꺼워지고, 두꺼우면 하늘이 좁아진다. */
const VOICES = 4

/**
 * 머무는 화음들.
 *
 * 세 번째 음이 없거나 아주 멀리 있다 — 밝지도 어둡지도 않아야
 * 어느 장면 밑에 깔려도 그 장면의 말을 가리지 않는다.
 * (A 에올리안 언저리. 비율은 A2=110Hz에 대한 것이다.)
 */
const CHORDS: ReadonlyArray<readonly number[]> = [
  [1, 1.5, 2, 3],        // A  E  A  E
  [1.1892, 1.7818, 2.3784, 3.5637], // C  G  C  G
  [0.8909, 1.3348, 2, 2.6697], // G  D  G  D
  [1.3348, 2, 2.6697, 4],      // D  A  D  A
  [1, 1.5, 2.2449, 3],         // A  E  B  E  (9도)
]

const ROOT = 110 // A2

/** 화음이 머무는 시간 */
const CHORD_MIN = 20
const CHORD_MAX = 34

/** 유리 같은 한 음이 떨어지는 간격 */
const GLASS_MIN = 9
const GLASS_MAX = 21

interface Running {
  /** 패드의 목소리들 */
  voices: Array<{ osc: OscillatorNode; level: GainNode; filter: BiquadFilterNode }>
  /**
   * 호흡과 결을 만드는 느린 진동자들.
   *
   * **반드시 함께 멈춘다.** 들리지 않는다고 두면, 사람이 음악을 껐다 켤
   * 때마다 여덟씩 쌓인다 — 하루 종일 켜 두는 전시에서는 그게 쌓인다.
   */
  movers: OscillatorNode[]
  /** 패드 전체의 음량 */
  bed: GainNode
  timers: Array<ReturnType<typeof setTimeout>>
  chord: number
}

let running: Running | null = null
let watching: (() => void) | null = null

/**
 * 지금 흐르기 시작하는 중인가.
 *
 * `running`은 다 차려 놓은 **뒤에야** 채워진다. 그 사이에 `wake()`가
 * 설정을 건드리고, 그 설정을 듣던 쪽이 다시 여기로 들어오면,
 * `running`이 아직 비어 있으므로 끝없이 되풀이된다.
 * 실제로 그렇게 되어 화면 전체가 멈췄다. 그래서 문을 먼저 닫는다.
 */
let starting = false

const between = (low: number, high: number) => low + Math.random() * (high - low)

/**
 * 흐르기 시작한다.
 *
 * **사람의 손짓이 있고 나서** 부른다. 이미 흐르고 있으면 아무 일도 하지 않는다 —
 * 장면이 바뀔 때마다 처음부터 다시 시작하면 그건 음악이 아니라 알림음이다.
 */
export function startAmbient(): void {
  if (running || starting) return
  starting = true

  try {
    begin()
  } finally {
    starting = false
  }
}

function begin(): void {
  if (!wake()) return
  if (!bgmAllowed()) return

  const bus = audio()
  if (!bus) return
  const { ctx, bgm, reverb } = bus
  const at = ctx.currentTime

  try {
    const bed = ctx.createGain()
    bed.gain.setValueAtTime(0.0001, at)
    // 부드럽게 떠오른다. 6초에 걸쳐 — 켜졌다는 것을 눈치채기 어려울 만큼.
    bed.gain.exponentialRampToValueAtTime(0.16, at + 6)
    bed.connect(bgm)

    const wet = ctx.createGain()
    wet.gain.value = 0.85
    bed.connect(wet)
    wet.connect(reverb)

    const chord = CHORDS[0]
    const voices: Running['voices'] = []
    const movers: OscillatorNode[] = []

    for (let i = 0; i < VOICES; i += 1) {
      const osc = ctx.createOscillator()
      // 두 가지 파형을 섞는다. 하나만 쓰면 '신호'로 들린다.
      osc.type = i % 2 === 0 ? 'sine' : 'triangle'
      osc.frequency.value = ROOT * chord[i % chord.length]
      // 아주 조금씩 어긋나 있다. 이 어긋남이 소리를 넓힌다.
      osc.detune.value = (i - VOICES / 2) * 6

      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = 520 + i * 180
      filter.Q.value = 0.5

      const level = ctx.createGain()
      level.gain.value = 0.26 / VOICES

      /*
       * 목소리마다 다른 호흡.
       *
       * 주기가 서로 나누어떨어지지 않아, 넷이 같은 자리로 돌아오는 일이 없다.
       * 그래서 들을 때마다 조금씩 다른 소리가 된다.
       */
      const breath = ctx.createOscillator()
      breath.type = 'sine'
      breath.frequency.value = 0.021 + i * 0.013
      const depth = ctx.createGain()
      depth.gain.value = 0.11 / VOICES
      breath.connect(depth)
      depth.connect(level.gain)
      breath.start(at)
      movers.push(breath)

      // 걸러지는 자리도 아주 느리게 오르내린다 — 빛이 밝아졌다 어두워지듯
      const sweep = ctx.createOscillator()
      sweep.type = 'sine'
      sweep.frequency.value = 0.013 + i * 0.007
      const sweepDepth = ctx.createGain()
      sweepDepth.gain.value = 180
      sweep.connect(sweepDepth)
      sweepDepth.connect(filter.frequency)
      sweep.start(at)
      movers.push(sweep)

      osc.connect(filter)
      filter.connect(level)
      level.connect(bed)
      osc.start(at)

      cleanup(breath, [depth])
      cleanup(sweep, [sweepDepth])
      voices.push({ osc, level, filter })
    }

    running = { voices, movers, bed, timers: [], chord: 0 }

    moveChord()
    dropGlass()
  } catch {
    running = null
  }
}

/** 화음이 조용히 옮겨 간다. 끊기지 않고 **미끄러진다.** */
function moveChord(): void {
  if (!running) return
  const bus = audio()
  if (!bus) return

  const wait = between(CHORD_MIN, CHORD_MAX)
  running.timers.push(
    globalThis.setTimeout(() => {
      if (!running) return
      const bus2 = audio()
      if (!bus2) return

      // 같은 화음으로 가지 않는다
      let next = running.chord
      while (next === running.chord) next = Math.floor(Math.random() * CHORDS.length)
      running.chord = next
      const chord = CHORDS[next]

      const at = bus2.ctx.currentTime
      running.voices.forEach((voice, i) => {
        try {
          const target = ROOT * chord[i % chord.length]
          voice.osc.frequency.cancelScheduledValues(at)
          voice.osc.frequency.setValueAtTime(voice.osc.frequency.value, at)
          // 8초에 걸쳐 미끄러진다. 끊어 옮기면 그건 화음 전환이 아니라 사고다.
          voice.osc.frequency.exponentialRampToValueAtTime(target, at + 8)
        } catch {
          /* 조용히 지나간다 */
        }
      })

      moveChord()
    }, wait * 1000),
  )
}

/**
 * 유리 같은 한 음.
 *
 * 이따금 하나씩 떨어져 길게 남는다. 피아노도 종도 아닌, 맑은 공명음이다.
 * 이 한 음이 있어야 패드가 '소리'가 아니라 '음악'으로 들린다.
 */
function dropGlass(): void {
  if (!running) return

  const wait = between(GLASS_MIN, GLASS_MAX)
  running.timers.push(
    globalThis.setTimeout(() => {
      if (!running) return
      const bus = audio()
      if (!bus || !bgmAllowed()) {
        dropGlass()
        return
      }

      const { ctx, bgm, reverb } = bus
      const at = ctx.currentTime
      const chord = CHORDS[running.chord]
      // 지금 화음 안의 음 하나를 두세 옥타브 위에서
      const step = chord[Math.floor(Math.random() * chord.length)]
      const freq = ROOT * step * (Math.random() < 0.5 ? 4 : 8)

      try {
        const osc = ctx.createOscillator()
        osc.type = 'sine'
        osc.frequency.value = freq

        /*
         * 배음 하나를 아주 작게 얹는다.
         * 사인파 하나만으로는 '삐' 소리이고, 배음이 얹히면 유리가 된다.
         */
        const bell = ctx.createOscillator()
        bell.type = 'sine'
        bell.frequency.value = freq * 2.76
        const bellLevel = ctx.createGain()
        bellLevel.gain.value = 0.16

        const level = ctx.createGain()
        level.gain.setValueAtTime(0.0001, at)
        level.gain.exponentialRampToValueAtTime(0.055, at + 0.012)
        level.gain.exponentialRampToValueAtTime(0.0001, at + 5.5)

        const wet = ctx.createGain()
        wet.gain.value = 0.9

        osc.connect(level)
        bell.connect(bellLevel)
        bellLevel.connect(level)
        level.connect(bgm)
        level.connect(wet)
        wet.connect(reverb)

        osc.start(at)
        osc.stop(at + 5.6)
        bell.start(at)
        bell.stop(at + 5.6)
        cleanup(osc, [level, wet])
        cleanup(bell, [bellLevel])
      } catch {
        /* 조용히 지나간다 */
      }

      dropGlass()
    }, wait * 1000),
  )
}

/** 멈춘다. 뚝 끊지 않고 3초에 걸쳐 사그라든다. */
export function stopAmbient(): void {
  if (!running) return
  const bus = audio()
  const { voices, movers, bed, timers } = running
  running = null

  for (const timer of timers) globalThis.clearTimeout(timer)

  if (!bus) return
  const at = bus.ctx.currentTime
  try {
    bed.gain.cancelScheduledValues(at)
    bed.gain.setValueAtTime(bed.gain.value, at)
    bed.gain.exponentialRampToValueAtTime(0.0001, at + 3)
  } catch {
    /* 조용히 */
  }
  for (const voice of voices) {
    try {
      voice.osc.stop(at + 3.1)
      cleanup(voice.osc, [voice.level, voice.filter])
    } catch {
      /* 이미 멈췄다 */
    }
  }

  // 호흡과 결도 함께 멈춘다. 들리지 않는다고 두면 쌓인다.
  for (const mover of movers) {
    try {
      mover.stop(at + 3.1)
      cleanup(mover)
    } catch {
      /* 이미 멈췄다 */
    }
  }
}

export function isAmbientPlaying(): boolean {
  return running !== null
}

/**
 * 설정을 지켜본다.
 *
 * 사람이 배경음악만 끄면 패드가 사그라들고, 다시 켜면 다시 떠오른다.
 * 효과음은 그대로다 — 둘은 따로 움직인다.
 */
export function watchSettings(): () => void {
  if (watching) return watching

  /*
   * **배경음악에 관한 것만 본다.**
   *
   * 설정에는 '브라우저가 소리를 허락했는가(`unlocked`)'도 들어 있다.
   * 그것까지 듣고 음악을 켜려 들면, 음악을 켜는 일이 다시 그 값을 건드려
   * 되풀이된다. 달라진 것이 음악에 관한 것일 때만 움직인다.
   */
  let was: boolean | null = null

  const stop = useSoundSettings.subscribe((state) => {
    const wanted = state.on && state.bgm && state.bgmVolume > 0
    if (wanted === was) return
    was = wanted

    if (wanted && !running) startAmbient()
    else if (!wanted && running) stopAmbient()
  })

  watching = () => {
    stop()
    watching = null
  }
  return watching
}
