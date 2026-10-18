import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SOUND } from '@/constants/text.exhibit'
import { useSoundSettings, wake, canSound } from '@/audio'
import { EASE } from '@/scenes/motion'
import styles from './SoundControl.module.css'

/**
 * 소리 설정.
 *
 * 화면 구석에 아주 조용히 놓인다. 작품 위에 계기판이 떠 있으면 그건
 * 작품이 아니므로, 평소에는 **기호 하나**뿐이고 누르면 그때 펼쳐진다.
 *
 * 판도 테두리도 없다. 어두운 하늘이 조금 짙어질 뿐이다.
 */
export function SoundControl() {
  const on = useSoundSettings((state) => state.on)
  const bgm = useSoundSettings((state) => state.bgm)
  const sfx = useSoundSettings((state) => state.sfx)
  const bgmVolume = useSoundSettings((state) => state.bgmVolume)
  const sfxVolume = useSoundSettings((state) => state.sfxVolume)

  const setOn = useSoundSettings((state) => state.setOn)
  const setBgm = useSoundSettings((state) => state.setBgm)
  const setSfx = useSoundSettings((state) => state.setSfx)
  const setBgmVolume = useSoundSettings((state) => state.setBgmVolume)
  const setSfxVolume = useSoundSettings((state) => state.setSfxVolume)

  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  /* 바깥을 누르면 닫힌다. 닫는 버튼을 하나 더 두지 않기 위해서다. */
  useEffect(() => {
    if (!open) return
    const away = (event: PointerEvent) => {
      if (!box.current?.contains(event.target as Node)) setOpen(false)
    }
    globalThis.addEventListener('pointerdown', away)
    return () => globalThis.removeEventListener('pointerdown', away)
  }, [open])

  // 소리를 낼 수 없는 기기라면 아예 두지 않는다
  if (!canSound()) return null

  return (
    <div className={styles.corner} ref={box}>
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.panel}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <p className={styles.title}>{SOUND.title}</p>

            <Switch label={SOUND.all} value={on} onChange={(next) => {
              setOn(next)
              if (next) wake()
            }} />

            {/* 배경음악과 효과음은 따로 켜고 끈다 */}
            <Switch label={SOUND.bgm} value={bgm} onChange={setBgm} muted={!on} />
            <Slider
              label={SOUND.bgmVolume}
              value={bgmVolume}
              onChange={setBgmVolume}
              muted={!on || !bgm}
            />

            <Switch label={SOUND.sfx} value={sfx} onChange={setSfx} muted={!on} />
            <Slider
              label={SOUND.sfxVolume}
              value={sfxVolume}
              onChange={setSfxVolume}
              muted={!on || !sfx}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        className={`tap ${styles.knob} ${on ? '' : styles.off}`}
        /* 이 버튼이 제 소리를 내면 설정을 만지는 내내 울린다 */
        data-sound="none"
        aria-label={SOUND.title}
        aria-expanded={open}
        onClick={() => {
          wake()
          setOpen((was) => !was)
        }}
      >
        <span aria-hidden="true">{on ? SOUND.glyphOn : SOUND.glyphOff}</span>
      </button>
    </div>
  )
}

function Switch({
  label,
  value,
  onChange,
  muted = false,
}: {
  label: string
  value: boolean
  onChange: (next: boolean) => void
  muted?: boolean
}) {
  return (
    <button
      type="button"
      className={`tap ${styles.row} ${muted ? styles.dim : ''}`}
      data-sound="none"
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
    >
      <span className={styles.label}>{label}</span>
      <span className={`${styles.mark} ${value ? styles.markOn : ''}`} aria-hidden="true" />
    </button>
  )
}

function Slider({
  label,
  value,
  onChange,
  muted = false,
}: {
  label: string
  value: number
  onChange: (next: number) => void
  muted?: boolean
}) {
  return (
    <label className={`${styles.row} ${styles.sliderRow} ${muted ? styles.dim : ''}`}>
      <span className={styles.label}>{label}</span>
      <input
        className={styles.slider}
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
        aria-label={label}
      />
    </label>
  )
}
