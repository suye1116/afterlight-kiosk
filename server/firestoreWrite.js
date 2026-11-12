import { randomUUID } from 'node:crypto'
import { firestoreReady, getDb } from './firebaseAdmin.js'

/**
 * 다리가 Firestore에 쓰는 자리 — 영수증 하나당 "한 번만" 쓰기 위한 곳.
 *
 * ─── 멱등성 — 서버 재시작·중복 요청에도 안전해야 한다 ──────
 *  메모리(Map, 변수)에만 "이미 처리했다"를 두면 서버를 다시 켜는 순간
 *  사라진다. 그래서 그 표시 자체를 Firestore에 둔다 —
 *  `assignment_index/{memoryId}`가 그 memoryId에 내어 준 토큰을 들고
 *  있고, 이미 있으면 **새로 만들지 않고 그 토큰을 그대로 돌려준다.**
 *
 *  "먼저 읽고 없으면 쓴다"를 따로 하면, 거의 동시에 두 번 요청이 와서
 *  둘 다 "없다"고 보고 토큰을 두 개 만들 수 있다(경쟁 상태). 그래서
 *  `runTransaction`으로 읽기와 쓰기를 한 덩어리로 묶는다 — Firestore가
 *  둘 중 하나만 이기게 해 준다.
 * ───────────────────────────────────────────────────────
 */
const WRITE_TIMEOUT_MS = 4000

/** 네트워크가 끊겼을 때 영수증 인쇄까지 함께 멈추지 않도록, 기다리는 시간을 못박는다. */
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error('Firestore 응답 시간 초과')), ms)
      promise.finally(() => clearTimeout(timer)).catch(() => {})
    }),
  ])
}

/**
 * 개인별 "나의 별 관측 페이지" 문서를 Firestore에 남기고, 그 문서를
 * 가리킬 토큰을 돌려준다.
 *
 * `assignment`는 이미 `sanitize.js`의 `cleanAssignment`를 거친, 기억
 * 원문이 전혀 없는 값이다 — 이 함수는 그 값을 의심하지 않고 그대로 쓴다.
 *
 * 돌려주는 모양: `{ ok: true, token, reused }` 또는 `{ ok: false, reason }`.
 * 실패해도 예외를 던지지 않는다 — 부르는 쪽(`index.js`)이 "그럼 QR1은
 * 기존 주소로 둔다"로 조용히 넘어갈 수 있게 하기 위해서다.
 */
export async function recordAssignment(memoryId, assignment) {
  if (!firestoreReady()) return { ok: false, reason: 'firestore-not-ready' }
  const db = getDb()

  try {
    const { token, reused } = await withTimeout(
      db.runTransaction(async (tx) => {
        const indexRef = db.collection('assignment_index').doc(memoryId)
        const existing = await tx.get(indexRef)
        const already = existing.exists ? existing.data()?.token : null
        if (typeof already === 'string' && already) {
          return { token: already, reused: true }
        }

        // 32자 16진수 — 짧으면서도 추측하기 어렵다. memoryId를 그대로 쓰지 않는다.
        const token = randomUUID().replace(/-/g, '')
        tx.set(db.collection('assignments').doc(token), {
          ...assignment,
          memoryId,
          createdAt: Date.now(),
        })
        tx.set(indexRef, { token, createdAt: Date.now() })
        return { token, reused: false }
      }),
      WRITE_TIMEOUT_MS,
    )
    return { ok: true, token, reused }
  } catch (error) {
    return { ok: false, reason: error.message }
  }
}

/**
 * 공개 "우리의 우주" 컬렉션에 남긴다.
 *
 * **관람객이 명시적으로 "온라인에도 함께"를 골랐을 때만** 부르는
 * 함수다(그 판단은 `index.js`가 한다, 여기서는 다시 묻지 않는다).
 * `publicFields`는 벽(TouchDesigner)으로 넘어가는 것과 **같은
 * 허용 목록**(`sanitize.js`의 `cleanStar`)을 거친 값이다 — 감정·
 * 간직흘려보내기·계절 비슷한 시각 정보뿐, 기억 원문은 이 함수 안에
 * 들어오지도 않는다.
 *
 * 문서 id를 starId(=memoryId)로 두어, 같은 별을 두 번 공유해도
 * 덮어쓰기만 될 뿐 둘로 늘지 않는다 — 이것만으로 멱등하다
 * (transaction이 필요 없다).
 */
export async function shareToUniverse(starId, publicFields) {
  if (!firestoreReady()) return { ok: false, reason: 'firestore-not-ready' }
  const db = getDb()

  try {
    await withTimeout(
      db.collection('universe_stars').doc(starId).set({ ...publicFields, sharedAt: Date.now() }),
      WRITE_TIMEOUT_MS,
    )
    return { ok: true }
  } catch (error) {
    return { ok: false, reason: error.message }
  }
}
