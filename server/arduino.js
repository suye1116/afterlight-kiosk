/**
 * 아두이노.
 *
 * ─── 아직 꽂혀 있지 않다 ───────────────────────────────
 *  **실제 아두이노는 연결하지 않았다.** 기본은 `off` — 다리는 시리얼 포트를
 *  열지 않고, `arduino: 'off'`라고만 알린다.
 *
 *  장비가 오면 `--arduino /dev/tty.usbmodem1101`로 켠다. 그때 Node에는
 *  시리얼을 읽는 길이 없으므로 **패키지 하나가 필요해진다** —
 *  `npm i serialport`. 그전까지는 들이지 않는다.
 *
 *  펌웨어는 한 줄 JSON만 올려 보내는 가장 단순한 것으로 둔다.
 *  디바운스는 아두이노 쪽에서 처리한다.
 *
 *      {"btn":"send","v":1}
 *
 *  손 감지 센서(HC-SR04)가 오면 같은 시리얼로 거리도 올라온다 — 다른 줄이다.
 *
 *      {"sensor":"distance","cm":12.3}
 *
 *  **"가깝다"의 판정과 몇 초를 보유해야 보내지는지는 이 파일이 정하지
 *  않는다.** 다리는 거리값을 그대로 하늘에 흘려보낼 뿐이고, 판정은
 *  하늘(`src/lib/sensorGate.ts`)이 한다 — 여기서 정하면 전시 중에
 *  임계값 하나 바꾸자고 보드에 새 펌웨어를 올려야 한다.
 *
 *  LED 다섯 개는 반대 방향이다 — 하늘이 진행 단계를 정해 다리에 말하면,
 *  다리가 시리얼로 그대로 적어 보낸다.
 *
 *      {"led":3}      다섯 중 세 개를 켠다
 *      {"led":"off"}  전부 끈다
 *
 *  **태블릿이 iPad나 안드로이드면 Web Serial을 쓸 수 없다.** 그래서
 *  아두이노는 언제나 이 다리를 띄운 기계에 꽂고, 버튼·센서·LED 모두
 *  다리를 거쳐 WebSocket으로 하늘과 오간다.
 * ───────────────────────────────────────────────────────
 */

/** 한 줄이 이보다 길면 버린다. 노이즈가 섞여 들어올 수 있다. */
const MAX_LINE = 256

/** 같은 버튼이 이 시간 안에 또 오면 한 번으로 본다 (ms) */
const DEBOUNCE_MS = 80

/**
 * 시리얼에서 올라온 한 줄을 버튼 입력으로 읽는다.
 *
 * 캔버스도 포트도 없이 확인할 수 있도록 떼어 두었다.
 * 모르는 줄은 조용히 버린다 — 부팅 메시지나 노이즈가 섞여 들어오기 때문이다.
 */
export function readLine(line) {
  if (typeof line !== 'string') return null
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_LINE) return null
  if (!trimmed.startsWith('{')) return null

  let parsed
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null

  const button = typeof parsed.btn === 'string' ? parsed.btn.slice(0, 32) : ''
  if (!button) return null

  return { button, down: parsed.v !== 0 }
}

/**
 * 시리얼에서 올라온 한 줄을 손 감지 센서의 거리로 읽는다.
 *
 * 버튼과 같은 자리(시리얼)로 오지만 모양이 다르다 — `{"sensor":"distance","cm":…}`.
 * 모르는 줄은 조용히 버린다. 거리의 "가깝다" 판정은 여기서 하지 않는다 —
 * 그 값 그대로 하늘에 흘려보내고, 판정은 하늘이 한다.
 */
export function readSensorLine(line) {
  if (typeof line !== 'string') return null
  const trimmed = line.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_LINE) return null
  if (!trimmed.startsWith('{')) return null

  let parsed
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return null
  }
  if (typeof parsed !== 'object' || parsed === null) return null
  if (parsed.sensor !== 'distance') return null
  if (!Number.isFinite(parsed.cm)) return null

  return { cm: parsed.cm }
}

/**
 * LED 명령을 시리얼 한 줄로 적는다.
 *
 * `step`은 0~5의 정수(몇 개를 켤 것인가)이거나 `'off'`(전부 끈다)다.
 * 범위를 벗어나면 적지 않는다 — 다리가 아두이노에게 이상한 말을 보내지 않게.
 */
export function encodeLedCommand(step) {
  if (step === 'off') return '{"led":"off"}\n'
  if (!Number.isInteger(step) || step < 0 || step > 5) return null
  return `{"led":${step}}\n`
}

/** 너무 빠르게 되풀이되는 입력을 한 번으로 본다 */
export function createDebounce(windowMs = DEBOUNCE_MS) {
  const last = new Map()
  return (button, now = Date.now()) => {
    const was = last.get(button) ?? 0
    if (now - was < windowMs) return false
    last.set(button, now)
    return true
  }
}

/**
 * 시리얼을 연다.
 *
 * `serialport`가 깔려 있지 않으면 **열지 않고 그렇다고 말한다.**
 * 없는 장비를 연결된 것처럼 꾸미지 않는다.
 *
 * 돌려주는 핸들의 `send(step)`은 LED 명령을 적는다 — 포트가 열려 있지
 * 않으면(off · error) 조용히 아무 일도 하지 않는다. 부르는 쪽이
 * 매번 "지금 열려 있나"를 묻지 않아도 되게 한다.
 */
export async function openArduino({ path, baud = 115200, onButton, onDistance, onStatus }) {
  if (!path) {
    onStatus('off', '쓰지 않음')
    return { close() {}, send() {} }
  }

  let SerialPort
  try {
    ;({ SerialPort } = await import('serialport'))
  } catch {
    onStatus('error', "serialport가 없습니다 — 'npm i serialport' 뒤에 다시 띄우세요")
    return { close() {}, send() {} }
  }

  onStatus('opening', path)

  const port = new SerialPort({ path, baudRate: baud })
  const allow = createDebounce()
  let buffer = ''
  let open = false

  port.on('open', () => {
    open = true
    onStatus('open', `${path} @ ${baud}`)
  })
  port.on('error', (error) => onStatus('error', error.message))
  port.on('close', () => {
    open = false
    onStatus('off', '끊김')
  })

  port.on('data', (chunk) => {
    buffer += chunk.toString('utf8')
    if (buffer.length > MAX_LINE * 8) buffer = buffer.slice(-MAX_LINE)
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const press = readLine(line)
      if (press) {
        if (allow(press.button)) onButton(press)
        continue
      }
      const distance = readSensorLine(line)
      if (distance) onDistance?.(distance)
    }
  })

  return {
    close() {
      try {
        port.close()
      } catch {
        /* 닫다가 나는 소리는 무시한다 */
      }
    },
    send(step) {
      if (!open) return
      const line = encodeLedCommand(step)
      if (!line) return
      try {
        port.write(line)
      } catch {
        /* 쓰다가 나는 소리는 무시한다. 다리는 멈추지 않는다. */
      }
    },
  }
}
