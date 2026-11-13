import { useEffect, useMemo, useState } from 'react'
import { centerOf, getEmotion } from '@/constants/emotions'
import type { EmotionKey } from '@/types'
import { subscribePublicStars, type PublicStar } from '../lib/universe'
import { SkyCanvas, type FocusRequest } from './universe/SkyCanvas'
import { EmotionLegend } from './universe/EmotionLegend'
import { StarSheet } from './universe/StarSheet'

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; stars: PublicStar[] }

export function UniversePage() {
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selected, setSelected] = useState<PublicStar | null>(null)
  const [focus, setFocus] = useState<FocusRequest | null>(null)

  useEffect(() => {
    const unsubscribe = subscribePublicStars(
      (stars) => setState({ status: 'ready', stars }),
      (error) => setState({ status: 'error', message: error.message }),
    )
    return unsubscribe
  }, [])

  const stars = state.status === 'ready' ? state.stars : []

  const companyCount = useMemo(() => {
    if (!selected) return 0
    return stars.filter((star) => star.constellation === selected.constellation).length
  }, [stars, selected])

  function focusEmotion(type: EmotionKey) {
    const center = centerOf(getEmotion(type))
    setFocus({ x: center.x, y: center.y, token: Date.now() })
  }

  return (
    <main className="universe">
      <header className="universe-header">
        <p className="mark">AFTERLIGHT · 우리의 우주</p>
      </header>

      {state.status === 'loading' && (
        <p className="quiet universe-state">별을 불러오고 있어요…</p>
      )}

      {state.status === 'error' && (
        <p className="quiet universe-state">
          지금은 우주를 불러올 수 없어요. 잠시 뒤 다시 시도해 주세요.
          <br />
          <span className="dim">({state.message})</span>
        </p>
      )}

      {state.status === 'ready' && stars.length === 0 && (
        <p className="quiet universe-state">
          아직 공개된 빛이 없습니다.
          <br />
          누군가 "온라인에도 함께"를 고르면, 그 빛이 여기 처음으로 뜹니다.
        </p>
      )}

      {state.status === 'ready' && stars.length > 0 && (
        <>
          <div className="universe-sky">
            <SkyCanvas stars={stars} onSelect={setSelected} focus={focus} />
          </div>
          <EmotionLegend onPick={focusEmotion} />
        </>
      )}

      <StarSheet star={selected} companyCount={companyCount} onClose={() => setSelected(null)} />
    </main>
  )
}
