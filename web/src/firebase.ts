import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'
import raw from '../firebase-config.json'

/**
 * 이 설정값은 비밀이 아니다 — 공개되어도 안전하게 설계된 값이다.
 * 실제 접근 제어는 Firestore 보안 규칙(`firestore.rules`)이 한다.
 *
 * `raw`에는 사람이 읽을 안내용 칸(`_설명`)이 섞여 있어, Firebase SDK가
 * 아는 칸만 가려 뽑는다 — 모르는 칸을 그대로 넘겨 봤자 SDK가 더 잘
 * 해 주는 건 없고, 안내문이 설정값처럼 보이는 혼란만 남는다.
 */
const firebaseConfig = {
  apiKey: raw.apiKey,
  authDomain: raw.authDomain,
  projectId: raw.projectId,
  storageBucket: raw.storageBucket,
  messagingSenderId: raw.messagingSenderId,
  appId: raw.appId,
}

export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
