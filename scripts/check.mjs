/**
 * 브라우저 없이 확인한다.
 *
 * 전시장에서 켜 보기 전에, 하늘과 걸음이 제 일을 하는지 여기서 먼저 본다.
 * 원작이 쓰던 방식과 같다 — 순수한 함수를 뽑아 node로 돌린다.
 *
 *   check.logic.ts   별의 자리 · 별자리 · 집계 · 걸음 · 빗장 · 테스트 데이터
 *   check.ui.tsx     아홉 화면이 그려지는가, 원작의 문구가 그대로 있는가
 *   check.sky.ts     세는 캔버스로 하늘을 돌려 본다 —
 *                    빛이 더해져도 하늘이 다시 지어지지 않는가
 *   check.link.ts    하늘 쪽 손이 **진짜 다리**에 붙는가. 끊겼다 다시 붙는가
 *   check.fidelity.ts 원작의 문구와 일곱 마음이 한 글자도 다르지 않은가
 *   check.sound.ts   세는 AudioContext로 소리를 돌려 본다 —
 *                    두 번 나지 않는가, 치워지는가, 음소거가 정말 조용한가
 *   check.sensor.ts  손 감지 센서의 셈 — 가깝다 판정 · 1초 보유 ·
 *                    손을 떼야 다시 열리는가 · 히스테리시스
 *   check.realStars.ts 실제 별 데이터베이스 — ID 중복 · 별자리 12종 ·
 *                    중복 등록 · verified 근거 · 계절×간직/흘려보내기
 *   check.starAssignment.ts 실제 별 배정 알고리즘 — 조건별 점수 ·
 *                    간직/흘려보내기 · 멱등성 · 검증 안 된 별 배제
 *   check.firebasePayload.ts Firebase에 저장할 모양만으로 '나의 별
 *                    이야기'·위로 문구를 글자 단위로 다시 지을 수 있는가 ·
 *                    저장값에 기억 원문이 섞여 있지 않은가
 *
 *   npm run check
 */
import { rolldown } from 'rolldown'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'
import path from 'node:path'
import fs from 'node:fs'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const OUT = path.join(ROOT, 'node_modules', '.afterlight-check')

/** CSS는 node에서 쓸 일이 없다. 클래스 이름만 돌려주는 가짜로 바꾼다. */
const cssStub = {
  name: 'css-stub',
  resolveId(id, importer) {
    if (!id.endsWith('.css')) return null
    // 가짜의 이름이 .css로 끝나면 번들러가 여전히 CSS로 읽는다
    return { id: `stub:${path.resolve(path.dirname(importer ?? ROOT), id)}.mjs` }
  },
  load(id) {
    if (!id.startsWith('stub:')) return null
    return 'export default new Proxy({}, { get: (_, k) => String(k) })'
  },
}

async function bundle(entry, out) {
  const built = await rolldown({
    input: path.join(ROOT, 'scripts', entry),
    platform: 'node',
    resolve: { alias: { '@': path.join(ROOT, 'src') } },
    plugins: [cssStub],
    // 이 셋은 번들에 넣지 않는다. 프로젝트의 node_modules에서 그대로 쓴다.
    external: ['react', 'react-dom', 'react-dom/server', 'react/jsx-runtime', 'framer-motion'],
  })
  await built.write({ file: path.join(OUT, out), format: 'esm' })
}

fs.mkdirSync(OUT, { recursive: true })
await bundle('check.logic.ts', 'logic.mjs')
await bundle('check.ui.tsx', 'ui.mjs')
await bundle('check.sky.ts', 'sky.mjs')
await bundle('check.link.ts', 'link.mjs')
await bundle('check.fidelity.ts', 'fidelity.mjs')
await bundle('check.sound.ts', 'sound.mjs')
await bundle('check.sensor.ts', 'sensor.mjs')
await bundle('check.realStars.ts', 'realStars.mjs')
await bundle('check.starAssignment.ts', 'starAssignment.mjs')
await bundle('check.firebasePayload.ts', 'firebasePayload.mjs')
await bundle('check.inputGuard.ts', 'inputGuard.mjs')

let failed = 0
for (const file of [
  'fidelity.mjs',
  'logic.mjs',
  'ui.mjs',
  'sky.mjs',
  'link.mjs',
  'sound.mjs',
  'sensor.mjs',
  'realStars.mjs',
  'starAssignment.mjs',
  'firebasePayload.mjs',
  'inputGuard.mjs',
]) {
  const run = spawnSync(process.execPath, [path.join(OUT, file)], { stdio: 'inherit', cwd: ROOT })
  if (run.status !== 0) failed += 1
}

process.exit(failed === 0 ? 0 : 1)
