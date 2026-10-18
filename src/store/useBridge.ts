import { create } from 'zustand'
import type { BridgeHandle, BridgeStatus, LinkState } from '@/lib/bridge'

/**
 * 다리와의 사이가 지금 어떤가.
 *
 * 다섯 가지를 **따로** 들고 있다. 하나로 묶으면 전시장에서
 * "별이 안 떠요"라는 말을 들었을 때 어디를 고칠지 알 수 없다.
 *
 *   link      웹사이트 ↔ 다리
 *   status.td 다리 ↔ TouchDesigner
 *   arduino   아두이노
 *   printer   영수증 프린터
 *   stars     별이 어디까지 갔는가 (받아들임 · 넘김 · 받음 · 띄움)
 */
interface BridgeState {
  /** 웹사이트와 다리 사이 */
  link: LinkState
  /** 다리가 알려 준 그 너머의 상태. 아직 들은 적이 없으면 null. */
  status: BridgeStatus | null
  /** 다리에 말을 거는 손. 붙지 않았으면 null이어도 화면은 그대로 돈다. */
  handle: BridgeHandle | null
  /** 마지막으로 받은 물리 버튼 */
  lastButton: { button: string; at: number } | null
  /**
   * 손 감지 센서가 마지막으로 알려 온 거리.
   *
   * 실제 센서든(다리를 거쳐) 개발용 시뮬레이션(`SensorPanel`)이든 같은
   * 자리에 쓴다 — "가깝다" 판정과 그 앞뒤 로직(`lib/sensorGate.ts`)은
   * 이 값이 어디서 왔는지 몰라도 된다.
   */
  sensor: { cm: number; at: number } | null

  setLink: (link: LinkState) => void
  setStatus: (status: BridgeStatus) => void
  setHandle: (handle: BridgeHandle | null) => void
  pressed: (button: string) => void
  setSensor: (cm: number) => void
}

export const useBridge = create<BridgeState>((set) => ({
  link: 'idle',
  status: null,
  handle: null,
  lastButton: null,
  sensor: null,

  setLink: (link) => set({ link }),
  setStatus: (status) => set({ status }),
  setHandle: (handle) => set({ handle }),
  pressed: (button) => set({ lastButton: { button, at: Date.now() } }),
  setSensor: (cm) => set({ sensor: { cm, at: Date.now() } }),
}))

/**
 * 다리에 한마디 건넨다.
 *
 * 붙어 있지 않으면 조용히 false를 돌려준다 — **부르는 쪽은 신경 쓰지 않아도 된다.**
 */
export function tellBridge(event: string, body?: Record<string, unknown>): boolean {
  return useBridge.getState().handle?.send(event, body) ?? false
}
