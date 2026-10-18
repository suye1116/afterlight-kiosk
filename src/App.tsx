import { useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, MotionConfig } from 'framer-motion'
import { Sky } from '@/canvas/Sky'
import type { SkyHandle } from '@/canvas/skyEngine'
import { Notice } from '@/components/Notice'
import { TestPanel } from '@/components/TestPanel'
import { getEmotion } from '@/constants/emotions'
import { universe } from '@/data'
import { useSafeZones } from '@/lib/safeZones'
import { isTestMode } from '@/lib/testMode'
import { createBridge } from '@/lib/bridge'
import { BridgePanel } from '@/components/BridgePanel'
import { SensorPanel } from '@/components/SensorPanel'
import { SoundControl } from '@/components/SoundControl'
import { listenToButtons, play, watchSettings } from '@/audio'
import { useBridge } from '@/store/useBridge'
import { SceneAttract } from '@/scenes/SceneAttract'
import { SceneIntro } from '@/scenes/SceneIntro'
import { SceneRecord } from '@/scenes/SceneRecord'
import { SceneEmotion } from '@/scenes/SceneEmotion'
import { SceneChoice } from '@/scenes/SceneChoice'
import { SceneConfirm } from '@/scenes/SceneConfirm'
import { SceneSending } from '@/scenes/SceneSending'
import { SceneDone } from '@/scenes/SceneDone'
import { SceneUniverse } from '@/scenes/SceneUniverse'
import { DONE_HOLD_MS, IDLE_MS, INVITE_HOLD_MS, useKiosk } from '@/store/useKiosk'
import type { Scene } from '@/types'

/**
 * 우주가 얼마나 물러나 있는가.
 *
 * 걸음을 옮길 때 페이지를 옮기지 않는다. 같은 하늘 위에서 우주가 한 걸음
 * 뒤로 물러나고, 그 자리에 글자가 떠오른다. 보내고 나면 다시 돌아온다 —
 * 그때는 하늘이 주인공이기 때문이다. (원작 DIM_BY_SCENE과 같은 결)
 */
const DIM_BY_SCENE: Record<Scene, number> = {
  attract: 0,
  // 인트로는 하늘이 스스로 밝아 온다. 여기서 더 물리지 않는다.
  intro: 0,
  record: 0.62,
  emotion: 0.62,
  choice: 0.62,
  confirm: 0.62,
  // 건너가는 동안에는 우주가 반쯤 물러나 있다.
  // 멀어지는 작은 점이 주변 별에 묻히지 않아야 하기 때문이다.
  sending: 0.42,
  done: 0.42,
  universe: 0,
}

function CurrentScene({ scene }: { scene: Scene }) {
  switch (scene) {
    case 'intro':
      return <SceneIntro />
    case 'record':
      return <SceneRecord />
    case 'emotion':
      return <SceneEmotion />
    case 'choice':
      return <SceneChoice />
    case 'confirm':
      return <SceneConfirm />
    case 'sending':
      return <SceneSending />
    case 'done':
      return <SceneDone />
    case 'universe':
      return <SceneUniverse />
    default:
      return <SceneAttract />
  }
}

export default function App() {
  const scene = useKiosk((state) => state.scene)
  const stars = useKiosk((state) => state.stars)
  const sent = useKiosk((state) => state.sent)
  const departureToken = useKiosk((state) => state.departureToken)
  const goHome = useKiosk((state) => state.goHome)
  const syncUniverse = useKiosk((state) => state.syncUniverse)

  const skyRef = useRef<SkyHandle | null>(null)

  /*
   * 소리.
   *
   * 귀를 **하나만** 둔다. 버튼마다 달면 언젠가 빠뜨리고 언젠가 두 번 달린다.
   * 브라우저는 사람의 첫 손짓이 있기 전에는 소리를 내지 못하게 막아 두므로,
   * 그 손짓(아무 버튼이나 누름)에서 깨어난다.
   */
  useEffect(() => {
    const stopButtons = listenToButtons()
    const stopWatching = watchSettings()
    return () => {
      stopButtons()
      stopWatching()
    }
  }, [])

  /*
   * 화면이 바뀔 때의 아주 작은 전환음.
   *
   * 건너가는 중(`sending`)과 닿은 뒤(`done`)에는 두지 않는다 —
   * 그 둘은 제 소리를 따로 가지고 있고, 겹치면 둘 다 뭉개진다.
   */
  const firstScene = useRef(true)
  useEffect(() => {
    if (firstScene.current) {
      firstScene.current = false
      return
    }
    if (scene === 'sending' || scene === 'done') return
    play('scene')
  }, [scene])

  /*
   * 다리.
   *
   * 한 번만 세운다. 붙지 않아도 작품은 그대로 돈다 — 이 자리의 어떤 것도
   * 화면을 막지 않는다. 물리 버튼(아두이노)이 눌리면 화면을 만진 것과
   * **똑같은 일**이 일어나야 한다. 둘 중 하나만 되는 순간이 있으면 관람객이 멈춘다.
   */
  useEffect(() => {
    const kiosk = useKiosk.getState
    const bridge = createBridge({
      onLink: useBridge.getState().setLink,
      onStatus: useBridge.getState().setStatus,
      onOpen: () => {
        // 이어질 때마다 '지금 우주가 이렇다'를 한 장 보낸다
        kiosk().reportUniverse()
      },
      onSensor: (cm) => {
        useBridge.getState().setSensor(cm)
      },
      onShown: (starId) => {
        kiosk().noteWallShown(starId)
      },
      onButton: (button, down) => {
        if (!down) return
        useBridge.getState().pressed(button)
        const state = kiosk()
        switch (button) {
          case 'send':
          case 'next':
            // 지금 걸음에서 '다음'에 해당하는 일을 한다
            if (state.scene === 'attract') state.begin()
            else if (state.scene === 'intro') state.goTo('record')
            else if (state.scene === 'record') state.toEmotion()
            else if (state.scene === 'confirm') void state.send()
            else if (state.scene === 'done') {
              /*
               * 도착 화면에서는 **묻는 자리를 건너뛰지 않는다.**
               *
               *   완료 문장이 머무는 중 → 기다리지 않고 바로 묻는다
               *   묻고 있는 중         → 그 누름이 '예'다
               *   머물겠다고 한 뒤     → 처음으로
               *
               * 물리 버튼 하나로는 '아니요'를 고를 수 없다. 그건 화면을
               * 만져서 고르거나, 아무것도 누르지 않으면 된다 —
               * 가만히 두면 스스로 처음으로 돌아가고, 그건 불이익이 아니다.
               */
              if (state.doneBeat === 'arrived') state.invite()
              else if (state.doneBeat === 'invite') state.showUniverse()
              else state.goHome()
            }
            break
          case 'reset':
            state.goHome()
            break
          default:
            break
        }
      },
    })
    useBridge.getState().setHandle(bridge)
    return () => {
      bridge.close()
      useBridge.getState().setHandle(null)
    }
  }, [])

  /*
   * 다른 곳에서 빛이 더해지면 이 화면의 하늘에도 떠야 한다.
   *
   * 지금은 같은 브라우저의 다른 탭까지다. 허브가 붙으면 같은 구독 자리에
   * 다른 기기의 빛이 들어온다 — 화면은 손대지 않아도 된다.
   */
  useEffect(() => {
    void universe.refresh().then(syncUniverse)
    return universe.subscribe(syncUniverse)
  }, [syncUniverse])

  /*
   * 글자가 놓인 자리.
   *
   * `data-safe`가 붙은 요소를 훑어 하늘에 알려 준다. 하늘은 그 자리에서
   * 선을 긋지 않으므로, 선이 글자 뒤에서 끊겨 글자가 먼저 읽힌다.
   */
  const safeZones = useSafeZones()

  /*
   * 아무도 손대지 않으면 처음으로 돌아간다.
   *
   * 전시장에서 가장 흔한 일은 관람객이 중간에 그냥 가 버리는 것이다.
   * 다음 사람이 남의 문장이 적힌 화면을 마주하면 안 된다.
   * 대기 화면에서는 돌아갈 곳이 없으므로 시계를 걸지 않는다.
   */
  const doneBeat = useKiosk((state) => state.doneBeat)
  /*
   * 별 하나를 들여다볼 때마다 바뀐다.
   *
   * 이 값이 시계를 다시 건다 — 열 개를 보는 동안 사람이 화면을 만지지
   * 않아도 중간에 끊기지 않게. 다 보고 나면 더는 바뀌지 않으므로,
   * 그때부터는 평소처럼 기다렸다 처음으로 돌아간다.
   */
  const viewIndex = useKiosk((state) => state.viewIndex)

  useEffect(() => {
    if (scene === 'attract') return
    // 건너가는 중에는 끊지 않는다. 그 장면은 끝나야 끝나는 것이다.
    if (scene === 'sending') return

    /*
     * 묻는 자리에서는 더 오래 기다린다.
     *
     * 읽을 것이 세 문단이고 고르는 일이 남아 있다. 20초로는 읽다가 끊긴다 —
     * 그건 재촉이지 초대가 아니다.
     */
    const wait =
      scene === 'done'
        ? doneBeat === 'invite'
          ? INVITE_HOLD_MS
          : DONE_HOLD_MS
        : IDLE_MS
    let timer = globalThis.setTimeout(goHome, wait)

    const again = () => {
      globalThis.clearTimeout(timer)
      timer = globalThis.setTimeout(goHome, wait)
    }

    globalThis.addEventListener('pointerdown', again)
    globalThis.addEventListener('keydown', again)
    return () => {
      globalThis.clearTimeout(timer)
      globalThis.removeEventListener('pointerdown', again)
      globalThis.removeEventListener('keydown', again)
    }
  }, [scene, doneBeat, viewIndex, goHome])

  /** 빛 하나가 우리의 우주로 건너가는 연출. 보낸 그 빛의 모습 그대로. */
  const departure = useMemo(() => {
    if (!sent || departureToken === 0) return null
    return {
      token: departureToken,
      spec: {
        emotion: getEmotion(sent.emotion),
        type: sent.type,
        seed: sent.seed,
        brightness: sent.brightness,
      },
    }
  }, [sent, departureToken])

  return (
    // reducedMotion="user"로 두면 움직임을 줄인 환경에서 framer가 알아서 멈춘다
    <MotionConfig reducedMotion="user">
      {/* 하늘은 장면 밖에 있다. 장면이 바뀌어도 같은 하늘이어야 하므로. */}
      <Sky
        handleRef={skyRef}
        /*
         * 하늘은 **언제나** 모두의 빛을 들고 있다.
         *
         * 걸음마다 별을 비웠다 채우면, 돌아올 때마다 하늘이 통째로 다시
         * 지어져 한 번 깜박인다. 글자가 주인공인 걸음에서는 별을 치우는
         * 대신 하늘을 한 걸음 물린다(`DIM_BY_SCENE`) — 원작이 그렇게 했다.
         */
        stars={stars}
        constellation
        dim={DIM_BY_SCENE[scene]}
        intro
        safeZones={safeZones}
        /* 방금 보낸 사람이 자기 빛을 찾을 수 있게 한동안 또렷하게 비춘다 */
        focusedId={scene === 'done' || scene === 'universe' ? (sent?.id ?? null) : null}
        departure={departure}
      />
      <div className="layer layer--veil" />
      {/* 필름 입자. 글자(무대)보다 아래에 있어 가독성을 건드리지 않는다. */}
      <div className="layer layer--grain" />

      <main className="layer layer--stage">
        {/* 장면 사이는 잘리지 않고 겹쳐서 넘어간다 */}
        <AnimatePresence mode="wait">
          <CurrentScene key={scene} scene={scene} />
        </AnimatePresence>
      </main>

      {/* 눌렀는데 아무 일도 없는 것처럼 느껴지지 않게 */}
      <Notice />

      {/* 소리 설정. 평소에는 기호 하나뿐이다. */}
      <SoundControl />

      {isTestMode() && <TestPanel />}
      {isTestMode() && <BridgePanel />}
      {isTestMode() && <SensorPanel />}
    </MotionConfig>
  )
}
