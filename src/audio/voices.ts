import { audio, cleanup } from './engine'

/**
 * 소리를 짓는 가장 작은 조각들.
 *
 * 파일을 받아 오지 않는다. 사인파 하나를 반복하지도 않는다 —
 * 음색, 떨림, 걸러짐, 잔향을 겹쳐 **악기에 가까운 소리**를 만든다.
 *
 * 모든 조각은 스스로 끝나고 스스로 치운다(`cleanup`).
 * 끝난 소리가 남아 있으면 하루 종일 켜 두는 전시에서 쌓인다.
 */

export interface ToneSpec {
  /** 음높이 (Hz) */
  freq: number
  /** 음색 */
  wave?: OscillatorType
  /** 언제 시작할까 (지금으로부터 초) */
  delay?: number
  /** 올라오는 데 걸리는 시간 */
  attack?: number
  /** 머무는 시간 */
  hold?: number
  /** 사그라드는 데 걸리는 시간 */
  decay?: number
  /** 세기 0~1 */
  gain?: number
  /** 몇 센트 어긋나 있는가. 둘을 조금 어긋내면 소리가 넓어진다. */
  detune?: number
  /** 저역 통과 — 높은 쪽을 깎아 부드럽게 */
  cutoff?: number
  /** 잔향으로 보내는 양 0~1 */
  send?: number
  /** 끝으로 갈수록 음높이가 이만큼 움직인다 (비율). 1이면 그대로. */
  glide?: number
  /** 떨림 (Hz, 세기). 불안한 소리에 쓴다. */
  vibrato?: { rate: number; depth: number }
}

/**
 * 한 음.
 *
 * 켜고 끄는 것이 아니라 **올라왔다 사그라든다.** 뚝 끊으면 '딱' 소리가 나고,
 * 그 순간 이 하늘은 악기가 아니라 기계가 된다.
 */
export function tone(spec: ToneSpec): void {
  const bus = audio()
  if (!bus) return

  const {
    freq,
    wave = 'sine',
    delay = 0,
    attack = 0.02,
    hold = 0,
    decay = 0.6,
    gain = 0.2,
    detune = 0,
    cutoff,
    send = 0,
    glide = 1,
    vibrato,
  } = spec

  const { ctx, sfx, reverb } = bus
  const at = ctx.currentTime + delay
  const end = at + attack + hold + decay

  try {
    const osc = ctx.createOscillator()
    osc.type = wave
    osc.frequency.setValueAtTime(freq, at)
    if (glide !== 1) {
      // 끝으로 갈수록 음이 흐른다. 멀어지는 소리에 쓴다.
      osc.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), end)
    }
    osc.detune.value = detune

    const level = ctx.createGain()
    level.gain.setValueAtTime(0.0001, at)
    level.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), at + attack)
    if (hold > 0) level.gain.setValueAtTime(Math.max(0.0001, gain), at + attack + hold)
    level.gain.exponentialRampToValueAtTime(0.0001, end)

    let tail: AudioNode = level
    const extra: AudioNode[] = [level]

    if (cutoff) {
      const filter = ctx.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.value = cutoff
      filter.Q.value = 0.7
      level.connect(filter)
      tail = filter
      extra.push(filter)
    }

    osc.connect(level)
    tail.connect(sfx)
    if (send > 0) {
      const wet = ctx.createGain()
      wet.gain.value = send
      tail.connect(wet)
      wet.connect(reverb)
      extra.push(wet)
    }

    // 떨림. 불안한 소리가 가만히 있지 않게.
    if (vibrato) {
      const lfo = ctx.createOscillator()
      const depth = ctx.createGain()
      lfo.frequency.value = vibrato.rate
      depth.gain.value = vibrato.depth
      lfo.connect(depth)
      depth.connect(osc.detune)
      lfo.start(at)
      lfo.stop(end)
      cleanup(lfo, [depth])
    }

    osc.start(at)
    osc.stop(end)
    cleanup(osc, extra)
  } catch {
    /* 소리가 없어도 작품은 그대로 돈다 */
  }
}

/**
 * 반짝임.
 *
 * 높은 음 몇 개가 아주 짧게 흩뿌려진다. 별 하나가 생길 때,
 * 그 빛이 눈에 들어오는 순간의 소리다.
 */
export function shimmer({
  base,
  count = 5,
  spread = 0.22,
  gain = 0.055,
  send = 0.5,
  delay = 0,
  wave = 'sine',
}: {
  base: number
  count?: number
  spread?: number
  gain?: number
  send?: number
  delay?: number
  wave?: OscillatorType
}): void {
  // 5도와 옥타브 위로만 올라간다. 아무 음이나 뿌리면 그건 반짝임이 아니라 잡음이다.
  const steps = [1, 1.5, 2, 3, 4, 6]
  for (let i = 0; i < count; i += 1) {
    tone({
      freq: base * steps[i % steps.length] * (1 + (Math.random() - 0.5) * 0.01),
      wave,
      delay: delay + Math.random() * spread,
      attack: 0.004,
      decay: 0.5 + Math.random() * 0.7,
      gain: gain * (0.6 + Math.random() * 0.6),
      send,
    })
  }
}

/**
 * 상승음.
 *
 * 무언가가 다가오고 있다는 소리. 아주 작게 — 눈치채기 전에 지나가야 한다.
 */
export function swell({
  from,
  to,
  seconds = 0.8,
  gain = 0.09,
  delay = 0,
  send = 0.6,
  wave = 'triangle',
}: {
  from: number
  to: number
  seconds?: number
  gain?: number
  delay?: number
  send?: number
  wave?: OscillatorType
}): void {
  const bus = audio()
  if (!bus) return
  const { ctx, sfx, reverb } = bus
  const at = ctx.currentTime + delay
  const end = at + seconds

  try {
    const osc = ctx.createOscillator()
    osc.type = wave
    osc.frequency.setValueAtTime(from, at)
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), end)

    const level = ctx.createGain()
    level.gain.setValueAtTime(0.0001, at)
    level.gain.exponentialRampToValueAtTime(gain, at + seconds * 0.7)
    level.gain.exponentialRampToValueAtTime(0.0001, end)

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.setValueAtTime(600, at)
    filter.frequency.exponentialRampToValueAtTime(3200, end)

    const wet = ctx.createGain()
    wet.gain.value = send

    osc.connect(level)
    level.connect(filter)
    filter.connect(sfx)
    filter.connect(wet)
    wet.connect(reverb)

    osc.start(at)
    osc.stop(end)
    cleanup(osc, [level, filter, wet])
  } catch {
    /* 조용히 지나간다 */
  }
}

/**
 * 종이가 펴지는 소리.
 *
 * 두드리는 소리(`tap`)가 한 번의 '탁'이라면, 이것은 **여러 번의 잔 사각거림**이다.
 * 얇은 종이가 펴질 때 나는 소리는 한 덩어리가 아니라, 아주 작은 알갱이들이
 * 불규칙하게 터지는 것이다. 그래서 잡음에 **알갱이 포락선**을 씌운다.
 *
 * 찢는 소리가 되지 않게 지키는 것:
 *   · 낮은 쪽을 많이 깎는다 (쿵 하는 울림이 없어야 한다)
 *   · 가장 높은 쪽도 깎는다 (쉭 하는 바람 소리가 없어야 한다)
 *   · 알갱이가 고르게 퍼진다 (한곳에 몰리면 '찍' 소리가 된다)
 *   · 끝으로 갈수록 잦아든다 (다 펴지면 조용해진다)
 */
export function rustle({
  seconds = 0.85,
  gain = 0.05,
  delay = 0,
  send = 0.2,
  grains = 16,
}: {
  seconds?: number
  gain?: number
  delay?: number
  send?: number
  grains?: number
} = {}): void {
  const bus = audio()
  if (!bus) return
  const { ctx, sfx, reverb } = bus
  const at = ctx.currentTime + delay

  try {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)

    /*
     * 알갱이들.
     *
     * 저마다 다른 때에, 다른 길이로, 다른 세기로 터진다.
     * 앞쪽이 조금 더 잦다 — 펴지기 시작할 때가 가장 바스락거린다.
     */
    for (let g = 0; g < grains; g += 1) {
      const where = Math.pow(Math.random(), 1.5) * 0.88
      const start = Math.floor(length * where)
      const span = Math.floor(ctx.sampleRate * (0.01 + Math.random() * 0.045))
      const loud = 0.35 + Math.random() * 0.65

      for (let i = 0; i < span && start + i < length; i += 1) {
        const t = i / span
        // 알갱이 하나의 모양 — 빠르게 올랐다 천천히 사그라든다
        const shape = Math.pow(1 - t, 2.4) * Math.min(1, t * 12)
        data[start + i] += (Math.random() * 2 - 1) * shape * loud
      }
    }

    // 전체도 끝으로 갈수록 잦아든다. 다 펴지면 조용해져야 한다.
    for (let i = 0; i < length; i += 1) {
      data[i] *= Math.pow(1 - i / length, 1.3)
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    // 쿵 하는 울림을 없앤다
    const high = ctx.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = 1500

    // 쉭 하는 바람을 없앤다
    const low = ctx.createBiquadFilter()
    low.type = 'lowpass'
    low.frequency.value = 6200
    low.Q.value = 0.5

    const level = ctx.createGain()
    level.gain.value = gain

    const wet = ctx.createGain()
    wet.gain.value = send

    source.connect(high)
    high.connect(low)
    low.connect(level)
    level.connect(sfx)
    level.connect(wet)
    wet.connect(reverb)

    source.start(at)
    source.stop(at + seconds + 0.01)
    cleanup(source, [high, low, level, wet])
  } catch {
    /* 조용히 지나간다 */
  }
}

/**
 * 종이를 두드리는 소리.
 *
 * 음이 아니라 **잡음**이다. 짧게 끊고 높은 쪽을 깎아 두면
 * 전자음이 아니라 마른 나무를 두드리는 소리에 가까워진다.
 */
export function tap({
  gain = 0.07,
  cutoff = 2200,
  seconds = 0.045,
  send = 0.08,
}: {
  gain?: number
  cutoff?: number
  seconds?: number
  send?: number
} = {}): void {
  const bus = audio()
  if (!bus) return
  const { ctx, sfx, reverb } = bus
  const at = ctx.currentTime

  try {
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i += 1) {
      // 앞쪽에 세게, 뒤로 갈수록 빠르게 사그라든다 — 두드리는 소리의 모양
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3.2)
    }

    const source = ctx.createBufferSource()
    source.buffer = buffer

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = cutoff
    filter.Q.value = 0.6

    // 아주 낮은 쪽도 깎는다. 안 깎으면 '퍽' 하고 둔탁해진다.
    const high = ctx.createBiquadFilter()
    high.type = 'highpass'
    high.frequency.value = 420

    const level = ctx.createGain()
    level.gain.value = gain

    const wet = ctx.createGain()
    wet.gain.value = send

    source.connect(high)
    high.connect(filter)
    filter.connect(level)
    level.connect(sfx)
    level.connect(wet)
    wet.connect(reverb)

    source.start(at)
    /*
     * 버퍼가 끝나면 알아서 멎지만, 멈추는 때를 적어 둔다.
     * 적어 두지 않으면 '언제 치워지는가'가 브라우저의 사정이 된다.
     */
    source.stop(at + seconds + 0.01)
    cleanup(source, [high, filter, level, wet])
  } catch {
    /* 조용히 지나간다 */
  }
}
