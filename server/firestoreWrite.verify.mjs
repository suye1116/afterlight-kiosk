import { recordAssignment, shareToUniverse } from './firestoreWrite.js'
import { firestoreReady, getDb } from './firebaseAdmin.js'

/**
 * `firestoreWrite.js`가 실제 Firestore를 상대로도 약속대로 도는지 본다.
 *
 * `npm run bridge:test`(장비 없이 도는 쪽)에는 일부러 넣지 않았다 —
 * 그 시험은 네트워크·실제 클라우드 프로젝트 없이도 항상 똑같이
 * 끝나야 하기 때문이다. 이건 그 반대 — **진짜로 붙어서** 확인한다.
 *
 *   node server/firestoreWrite.verify.mjs
 */
let pass = 0
let fail = 0
function ok(name, condition, extra = '') {
  if (condition) { pass += 1; console.log(`  ✓ ${name}`) }
  else { fail += 1; console.log(`  ✗ ${name} ${extra}`) }
}

if (!firestoreReady()) {
  console.log('✗ Firestore에 연결되지 않았습니다.')
  process.exit(1)
}

const memoryId = `verify-${Date.now()}`
const assignment = {
  realStarId: 'star-betelgeuse',
  season: 'winter',
  type: 'letgo',
  emotion: 'sad',
  meaningTags: ['parting'],
}

console.log('\n중복 요청·서버 재시작에도 같은 토큰을 받는가')
const first = await recordAssignment(memoryId, assignment)
ok('첫 요청이 성공한다', first.ok, JSON.stringify(first))
ok('첫 요청은 새로 만든 것이다(reused:false)', first.ok && first.reused === false)

// "서버가 재시작됐다"를 메모리가 아니라 Firestore로만 재현한다 —
// 이 프로세스는 처음 쓸 때 메모리에 아무것도 남기지 않으므로,
// 다시 부르는 것 자체가 "다른 요청(또는 재시작 후 첫 요청)"과 같다.
const second = await recordAssignment(memoryId, assignment)
ok('두 번째 요청도 성공한다', second.ok, JSON.stringify(second))
ok('두 번째 요청은 재사용이다(reused:true)', second.ok && second.reused === true)
ok(
  '두 요청이 정확히 같은 토큰을 받는다 — 중복 기록이 생기지 않는다',
  first.ok && second.ok && first.token === second.token,
  `(${first.token} vs ${second.token})`,
)

console.log('\n동시에 들어온 중복 요청도 토큰 하나로 묶이는가(경쟁 상태)')
const concurrentMemoryId = `verify-concurrent-${Date.now()}`
const [a, b, c] = await Promise.all([
  recordAssignment(concurrentMemoryId, assignment),
  recordAssignment(concurrentMemoryId, assignment),
  recordAssignment(concurrentMemoryId, assignment),
])
const tokens = new Set([a.token, b.token, c.token])
ok('세 동시 요청 모두 성공한다', a.ok && b.ok && c.ok)
ok('그런데도 토큰은 하나뿐이다(트랜잭션이 경쟁을 막았다)', tokens.size === 1, `(${[...tokens]})`)

console.log('\n공개 universe_stars 쓰기')
const starId = `verify-star-${Date.now()}`
const shared = await shareToUniverse(starId, {
  emotion: 'sad',
  type: 'letgo',
  constellation: 'c-sad',
  x: 0.5,
  y: 0.5,
  brightness: 0.6,
  seed: 1,
})
ok('공개 컬렉션 쓰기가 성공한다', shared.ok, JSON.stringify(shared))

// 시험 자국을 지운다 — 이 스크립트가 실제 데이터처럼 보이는 걸 남기지 않는다.
console.log('\n시험에 쓴 문서를 정리한다')
const db = getDb()
await db.collection('assignment_index').doc(memoryId).delete()
await db.collection('assignments').doc(first.token).delete()
await db.collection('assignment_index').doc(concurrentMemoryId).delete()
await db.collection('assignments').doc(a.token).delete()
await db.collection('universe_stars').doc(starId).delete()
console.log('  ✓ 정리 완료')

console.log(`\n${pass}곳 통과, ${fail}곳 실패`)
process.exit(fail === 0 ? 0 : 1)
