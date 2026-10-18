import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

/**
 * 전시장마다 달라지는 값 — MacBook의 실제 주소, 아두이노 포트 등.
 *
 * **코드에 고정하지 않는다.** `server/config.local.json`이 있으면 그걸
 * 읽고, 없으면 `server/config.example.json`(모두 이 기계 안,
 * `127.0.0.1`)으로 돈다 — 그래야 이 파일을 처음 받아도 바로 띄울 수 있다.
 *
 * `config.local.json`은 전시장마다 다르므로 저장소에 커밋하지 않는다
 * (`.gitignore`). 전시 전날, 그 자리의 Wi-Fi에서 MacBook이 받은 IP를
 * `host`에 적고 `lan: true`로 켠다 — 그 한 곳만 고치면 된다.
 *
 * 여기서 읽은 값은 **기본값일 뿐이다.** CLI 플래그(`--port` 등)를 주면
 * 그 플래그가 이긴다 — 현장에서 급하게 한 번만 다른 값으로 띄워야 할 때
 * 파일을 고치지 않고도 되게 하기 위해서다.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url))
const LOCAL = path.join(HERE, 'config.local.json')
const EXAMPLE = path.join(HERE, 'config.example.json')

function load() {
  const file = existsSync(LOCAL) ? LOCAL : EXAMPLE
  try {
    const raw = JSON.parse(readFileSync(file, 'utf8'))
    // "_설명" 같은 안내용 칸은 설정값이 아니다
    const { _설명, ...rest } = raw
    return { source: file, values: rest }
  } catch (error) {
    return { source: file, values: {}, error: error.message }
  }
}

export const CONFIG = load()
