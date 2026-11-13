import { EMOTIONS } from '@/constants/emotions'
import type { EmotionKey } from '@/types'

/** 하늘 아래 떠 있는 7개의 감정 칩 — 누르면 그 별자리로 날아간다. */
export function EmotionLegend({ onPick }: { onPick: (type: EmotionKey) => void }) {
  return (
    <div className="legend">
      {EMOTIONS.map((emotion) => (
        <button
          key={emotion.type}
          type="button"
          className="legend-chip"
          onClick={() => onPick(emotion.type)}
        >
          <span className="legend-dot" style={{ background: emotion.light.core }} />
          {emotion.label}
        </button>
      ))}
    </div>
  )
}
