import { firestoreReady, firestoreStatusNote, getDb } from './firebaseAdmin.js'

/**
 * Firebase 연결이 실제로 되는지 딱 한 번 확인한다.
 *
 * `_setup_check`라는, 실제 기능과 무관한 컬렉션에 글 하나를 썼다가
 * 곧바로 읽고 지운다 — 서비스 계정 키가 진짜로 쓰기 권한을 가졌는지
 * 눈으로 확인하기 위한 것일 뿐, 이 컬렉션은 평소 다리 코드에서 쓰지 않는다.
 *
 *   node server/firebaseAdmin.verify.mjs
 */
console.log(`상태: ${firestoreStatusNote()}`)

if (!firestoreReady()) {
  console.log('✗ Firestore에 연결되지 않았습니다. 위 메시지를 확인하세요.')
  process.exit(1)
}

const db = getDb()
const ref = db.collection('_setup_check').doc('ping')

try {
  await ref.set({ at: Date.now(), from: 'firebaseAdmin.verify.mjs' })
  console.log('✓ 쓰기 성공')

  const snap = await ref.get()
  console.log(snap.exists ? '✓ 읽기 성공' : '✗ 읽었지만 문서가 없습니다')

  await ref.delete()
  console.log('✓ 정리(삭제) 완료 — Firestore에 아무것도 남지 않았습니다')

  console.log('\n전체 통과 — 서버가 실제로 Firestore에 쓰고 지울 수 있습니다.')
} catch (error) {
  console.log(`✗ 실패: ${error.message}`)
  process.exit(1)
}
