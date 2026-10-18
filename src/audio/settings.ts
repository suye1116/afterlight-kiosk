import { create } from 'zustand'

/**
 * 소리를 켜고 끄는 일.
 *
 * 배경음악과 효과음을 **따로** 둔다 — 음악은 싫지만 별이 떠나는 소리는
 * 듣고 싶을 수 있고, 그 반대도 있다.
 *
 * 고른 것은 이 브라우저에 남는다. 다음 관람객에게까지 남는 것은
 * 아니지만(전시에서는 늘 같은 기기다), 운영자가 한 번 맞춰 두면
 * 새로고침해도 그대로다.
 */

const KEY = 'afterlight.sound.v1'

export interface SoundSettings {
  /** 전체. 끄면 아무 소리도 나지 않는다. */
  on: boolean
  bgm: boolean
  sfx: boolean
  /** 0~1 */
  bgmVolume: number
  sfxVolume: number
}

export const DEFAULTS: SoundSettings = {
  on: true,
  bgm: true,
  sfx: true,
  // 전시장은 조용하다. 크게 둘 이유가 없다.
  bgmVolume: 0.45,
  sfxVolume: 0.7,
}

function read(): SoundSettings {
  try {
    const raw = globalThis.localStorage?.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const saved = JSON.parse(raw) as Partial<SoundSettings>
    return {
      on: typeof saved.on === 'boolean' ? saved.on : DEFAULTS.on,
      bgm: typeof saved.bgm === 'boolean' ? saved.bgm : DEFAULTS.bgm,
      sfx: typeof saved.sfx === 'boolean' ? saved.sfx : DEFAULTS.sfx,
      bgmVolume: clamp01(saved.bgmVolume ?? DEFAULTS.bgmVolume),
      sfxVolume: clamp01(saved.sfxVolume ?? DEFAULTS.sfxVolume),
    }
  } catch {
    return { ...DEFAULTS }
  }
}

function write(settings: SoundSettings) {
  try {
    globalThis.localStorage?.setItem(KEY, JSON.stringify(settings))
  } catch {
    /* 사생활 보호 모드. 소리는 그래도 난다. */
  }
}

const clamp01 = (value: number) =>
  Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0

/** 지금 실제로 들리는 음량 (0이면 소리가 나지 않는다) */
export function audibleBgm(settings: SoundSettings): number {
  return settings.on && settings.bgm ? settings.bgmVolume : 0
}

export function audibleSfx(settings: SoundSettings): number {
  return settings.on && settings.sfx ? settings.sfxVolume : 0
}

interface SoundState extends SoundSettings {
  /** 브라우저가 소리를 내도 된다고 허락했는가 (사람의 첫 손짓 뒤) */
  unlocked: boolean

  setOn: (on: boolean) => void
  setBgm: (on: boolean) => void
  setSfx: (on: boolean) => void
  setBgmVolume: (volume: number) => void
  setSfxVolume: (volume: number) => void
  setUnlocked: (unlocked: boolean) => void
}

export const useSoundSettings = create<SoundState>((set, get) => {
  const keep = () => {
    const { on, bgm, sfx, bgmVolume, sfxVolume } = get()
    write({ on, bgm, sfx, bgmVolume, sfxVolume })
  }

  return {
    ...read(),
    unlocked: false,

    setOn: (on) => {
      set({ on })
      keep()
    },
    setBgm: (bgm) => {
      set({ bgm })
      keep()
    },
    setSfx: (sfx) => {
      set({ sfx })
      keep()
    },
    setBgmVolume: (bgmVolume) => {
      set({ bgmVolume: clamp01(bgmVolume) })
      keep()
    },
    setSfxVolume: (sfxVolume) => {
      set({ sfxVolume: clamp01(sfxVolume) })
      keep()
    },
    /*
     * **값이 그대로면 알리지 않는다.**
     *
     * 이 한 줄이 없으면 `wake()`가 불릴 때마다 구독자들이 깨어나고,
     * 그중 하나가 다시 `wake()`를 부르면 끝나지 않는다.
     * 실제로 그렇게 되어 화면 전체가 멈췄다.
     */
    setUnlocked: (unlocked) => {
      if (get().unlocked === unlocked) return
      set({ unlocked })
    },
  }
})

/** 지금 설정만 꺼내 본다 (React 밖에서) */
export function currentSettings(): SoundSettings {
  const { on, bgm, sfx, bgmVolume, sfxVolume } = useSoundSettings.getState()
  return { on, bgm, sfx, bgmVolume, sfxVolume }
}
