import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * 다리(server/index.js)가 Firestore에 쓸 때 쓰는 자리.
 *
 * ─── 서비스 계정 키로만 연다 ────────────────────────────
 *  `server/firebase-service-account.json`(`.gitignore`에 등록되어 있다 —
 *  절대 커밋되지 않는다)이 없으면 **연결하지 않고 그렇다고 말한다** —
 *  `server/arduino.js`가 장비 없을 때 하는 것과 같은 원칙이다. 이 파일이
 *  없어도 다리는 그대로 돈다 — Firestore 쓰기만 건너뛴다.
 *
 *  브라우저(하늘)는 이 모듈을 import하지 않는다. 관리자 자격은 오직
 *  이 서버 프로세스 안에만 있다.
 * ───────────────────────────────────────────────────────
 */
const HERE = path.dirname(fileURLToPath(import.meta.url))
const KEY_PATH = path.join(HERE, 'firebase-service-account.json')

let db = null
let note = '쓰지 않음'

if (existsSync(KEY_PATH)) {
  try {
    const serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'))
    const app = initializeApp({ credential: cert(serviceAccount) })
    db = getFirestore(app)
    note = `연결됨 (${serviceAccount.project_id})`
  } catch (error) {
    note = `오류: ${error.message}`
  }
} else {
  note = `키 파일 없음 (${KEY_PATH})`
}

/** 지금 Firestore에 쓸 수 있는 상태인가. */
export function firestoreReady() {
  return db !== null
}

/** 연결 상태를 사람이 읽을 말로. 로그·상태 화면에 쓴다. */
export function firestoreStatusNote() {
  return note
}

/** 준비되어 있을 때만 db를 돌려준다. 없으면 null — 부르는 쪽이 "건너뛴다"로 다룬다. */
export function getDb() {
  return db
}
