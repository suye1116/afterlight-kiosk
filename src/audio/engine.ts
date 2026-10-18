import { audibleBgm, audibleSfx, currentSettings, useSoundSettings } from './settings'

/**
 * 소리가 나는 자리.
 *
 * ─── 지키는 것 ─────────────────────────────────────────
 *  **소리가 없어도 작품은 그대로 돈다.** 이 파일의 어떤 함수도 던지지 않는다.
 *  브라우저가 소리를 막았든, 기기에 스피커가 없든, 사람이 꺼 두었든,
 *  화면과 별은 아무 일 없이 움직인다.
 *
 *  **파일을 쓰지 않는다.** 모든 소리는 여기서 만들어진다 — 저작권이
 *  걸릴 것이 하나도 없고, 받아 올 것도 없다.
 *
 *  **AudioContext는 한 번만 만든다.** React가 몇 번을 다시 그리든
 *  이 모듈은 하나뿐이고, 들어온 적 없으면 아예 만들지 않는다
 *  (node에서 검증 스크립트를 돌릴 때 AudioContext가 없어도 괜찮아야 한다).
 * ───────────────────────────────────────────────────────
 *
 * 소리는 세 갈래로 흐른다.
 *
 *   배경음악 ──▶ bgm ──┐
 *   효과음   ──▶ sfx ──┼──▶ master ──▶ 스피커
 *                 └ 잔향(convolver) ─┘
 */

interface Buses {
  ctx: AudioContext
  master: GainNode
  bgm: GainNode
  sfx: GainNode
  /** 잔향으로 보내는 자리. 소리마다 보내는 양이 다르다. */
  reverb: GainNode
}

let buses: Buses | null = null
let unsubscribe: (() => void) | null = null

/** 음량이 바뀔 때 부드럽게 건너간다. 뚝 끊기면 '딱' 소리가 난다. */
const RAMP = 0.12

function AudioCtor(): typeof AudioContext | null {
  const g = globalThis as unknown as {
    AudioContext?: typeof AudioContext
    webkitAudioContext?: typeof AudioContext
  }
  return g.AudioContext ?? g.webkitAudioContext ?? null
}

/** 이 기기에서 소리를 낼 수 있는가 */
export function canSound(): boolean {
  return AudioCtor() !== null
}

/**
 * 잔향의 방.
 *
 * 임펄스 응답 파일을 받아 오지 않는다. 잡음을 지수로 깎아 **직접 만든다** —
 * 넓은 공간과 긴 꼬리를 만드는 데는 이것으로 충분하고, 받아 올 파일이 없다.
 *
 * 좌우를 따로 만들어 아주 조금 다르게 둔다. 그래야 가운데 뭉치지 않고
 * 공간이 옆으로 벌어진다.
 */
function makeRoom(ctx: AudioContext, seconds = 4.2, decay = 2.6): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * seconds))
  const buffer = ctx.createBuffer(2, length, ctx.sampleRate)

  for (let channel = 0; channel < 2; channel += 1) {
    const data = buffer.getChannelData(channel)
    for (let i = 0; i < length; i += 1) {
      const t = i / length
      // 처음을 조금 비워 두면 '방'이 생긴다. 바로 붙으면 그건 잔향이 아니라 울림이다.
      const early = i < ctx.sampleRate * 0.012 ? 0.2 : 1
      data[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay) * early
    }
  }
  return buffer
}

/**
 * 소리를 낼 채비를 한다.
 *
 * **사람의 손짓이 있고 나서** 부른다. 브라우저는 그전에는 소리를 내지 못하게
 * 막아 두고, 막힌 채로 만들어 두면 `suspended`로 남아 아무 소리도 나지 않는다.
 */
export function wake(): boolean {
  const Ctor = AudioCtor()
  if (!Ctor) return false

  if (!buses) {
    let ctx: AudioContext
    try {
      ctx = new Ctor()
    } catch {
      return false
    }

    const master = ctx.createGain()
    const bgm = ctx.createGain()
    const sfx = ctx.createGain()
    const reverb = ctx.createGain()

    const room = ctx.createConvolver()
    try {
      room.buffer = makeRoom(ctx)
    } catch {
      /* 못 만들면 잔향 없이 간다. 소리는 그래도 난다. */
    }

    // 잔향이 너무 앞서면 안개가 된다. 한 걸음 뒤에 둔다.
    const wet = ctx.createGain()
    wet.gain.value = 0.42

    reverb.connect(room)
    room.connect(wet)
    wet.connect(master)

    bgm.connect(master)
    sfx.connect(master)
    master.connect(ctx.destination)

    master.gain.value = 1
    bgm.gain.value = 0
    sfx.gain.value = 0

    buses = { ctx, master, bgm, sfx, reverb }

    // 설정이 바뀌면 음량이 따라온다
    unsubscribe ??= useSoundSettings.subscribe(() => applyVolumes())
  }

  // 막혀 있으면 깨운다. 실패해도 조용히 지나간다.
  if (buses.ctx.state === 'suspended') {
    void buses.ctx.resume().catch(() => {})
  }

  applyVolumes()
  useSoundSettings.getState().setUnlocked(buses.ctx.state !== 'suspended')
  return true
}

/** 지금 소리를 낼 수 있는 자리들. 깨어 있지 않으면 null. */
export function audio(): Buses | null {
  if (!buses) return null
  if (buses.ctx.state === 'closed') return null
  return buses
}

/** 지금이 몇 초인가 */
export function now(): number {
  return buses?.ctx.currentTime ?? 0
}

/** 설정의 음량을 버스에 옮긴다 */
export function applyVolumes(): void {
  if (!buses) return
  const settings = currentSettings()
  const at = buses.ctx.currentTime

  for (const [node, level] of [
    [buses.bgm, audibleBgm(settings)],
    [buses.sfx, audibleSfx(settings)],
  ] as const) {
    try {
      node.gain.cancelScheduledValues(at)
      node.gain.setValueAtTime(node.gain.value, at)
      node.gain.linearRampToValueAtTime(level, at + RAMP)
    } catch {
      node.gain.value = level
    }
  }
}

/** 효과음을 내도 되는가 — 꺼져 있으면 아예 소리를 짓지 않는다 */
export function sfxAllowed(): boolean {
  const settings = currentSettings()
  return Boolean(audio()) && audibleSfx(settings) > 0
}

export function bgmAllowed(): boolean {
  const settings = currentSettings()
  return Boolean(audio()) && audibleBgm(settings) > 0
}

/**
 * 다 쓴 소리를 치운다.
 *
 * 하나하나는 아주 작지만, 전시장에서 하루 종일 켜 두면 쌓인다.
 * 끝난 소리는 반드시 끊어 준다.
 */
export function cleanup(node: AudioScheduledSourceNode, extra: AudioNode[] = []): void {
  node.addEventListener('ended', () => {
    try {
      node.disconnect()
    } catch {
      /* 이미 끊겼다 */
    }
    for (const one of extra) {
      try {
        one.disconnect()
      } catch {
        /* 이미 끊겼다 */
      }
    }
  })
}

/** 전시를 마칠 때. 브라우저를 닫으면 알아서 치워지지만, 명시해 둔다. */
export function shutdown(): void {
  unsubscribe?.()
  unsubscribe = null
  if (!buses) return
  try {
    void buses.ctx.close()
  } catch {
    /* 이미 닫혔다 */
  }
  buses = null
}
