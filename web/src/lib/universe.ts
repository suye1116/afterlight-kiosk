import { collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { isEmotionKey } from '@/constants/emotions'
import type { ConstellationId, EmotionKey, MemoryType } from '@/types'

/**
 * `universe_stars/{id}` 문서의 모양 — `server/sanitize.js`의 `STAR_FIELDS`
 * 허용 목록 그대로다. 기억 원문·실제 별 이름은 애초에 이 컬렉션에 없다.
 */
export interface PublicStar {
  id: string
  emotion: EmotionKey
  type: MemoryType
  constellation: ConstellationId
  x: number
  y: number
  brightness: number
  seed: number
  createdAt: number
}

const TYPES = new Set<MemoryType>(['keep', 'letgo'])

function isPublicStar(value: unknown): value is PublicStar {
  if (typeof value !== 'object' || value === null) return false
  const s = value as Record<string, unknown>
  return (
    typeof s.id === 'string' &&
    isEmotionKey(s.emotion) &&
    TYPES.has(s.type as MemoryType) &&
    typeof s.constellation === 'string' &&
    typeof s.x === 'number' &&
    typeof s.y === 'number' &&
    typeof s.brightness === 'number' &&
    typeof s.seed === 'number' &&
    typeof s.createdAt === 'number'
  )
}

/**
 * 공개 우주에 실시간으로 귀를 기울인다.
 *
 * 전시 중에 누군가 "온라인에도 함께"를 고르면 그 순간 이 화면에도
 * 별이 늘어난다. 깨진 문서 하나가 우주 전체를 지우지 않도록
 * 걸러서 받는다(`isPublicStar`).
 */
export function subscribePublicStars(
  onChange: (stars: PublicStar[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    collection(db, 'universe_stars'),
    (snapshot) => {
      const stars = snapshot.docs
        .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
        .filter(isPublicStar)
      onChange(stars)
    },
    (error) => onError(error),
  )
}
