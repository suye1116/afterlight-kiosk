/**
 * 소리를 쓰는 창구.
 *
 * 화면은 여기만 알면 된다. 어떻게 만들어지는지는 몰라도 된다.
 */
export { play, forgetGaps, voiceCount, SOUND_NAMES, type SoundName } from './catalogue'
export { playSend, voiceOf, EMOTION_VOICES, type EmotionVoice } from './emotionVoices'
export { startAmbient, stopAmbient, isAmbientPlaying, watchSettings } from './ambient'
export { listenToButtons } from './buttons'
export { soundForKey, mayListen, type KeyLike } from './typewriter'
export { wake, canSound, shutdown, sfxAllowed, bgmAllowed, applyVolumes } from './engine'
export {
  useSoundSettings,
  currentSettings,
  audibleBgm,
  audibleSfx,
  DEFAULTS,
  type SoundSettings,
} from './settings'
