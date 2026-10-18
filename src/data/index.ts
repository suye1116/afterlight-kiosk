import { isTestMode } from '@/lib/testMode'
import { createLocalUniverse, type UniverseRepository } from './universeRepository'

/**
 * 지금 쓰는 저장소.
 *
 * 허브(서버)를 붙일 때 바꾸는 곳은 이 한 줄이다.
 *
 *   export const universe: UniverseRepository = createHubUniverse('ws://…')
 *
 * 화면과 store는 `universe`만 알고 있으므로 다른 파일은 손대지 않아도 된다.
 */
export const universe: UniverseRepository = createLocalUniverse(isTestMode())

export type { UniverseRepository, StarDraft } from './universeRepository'
export { statsOf, toWallLight } from './universeRepository'
