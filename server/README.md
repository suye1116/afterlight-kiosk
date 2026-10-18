# 하늘과 벽 사이의 다리

```
        ┌──────────────┐                    ┌──────────────────┐
        │  웹사이트     │ ws://…/sky         │  TouchDesigner   │
        │  (키오스크)   │ ───────┐   ┌─────▶ │  네 면의 프로젝션 │
        └──────────────┘        │   │        └──────────────────┘
                                ▼   │  ws://…/td
                         ┌─────────────────┐
                         │  server/index.js │
                         └──┬───────────┬──┘
                            │           │
                  시리얼 ◀──┘           └──▶ 영수증 프린터
                 (Arduino)                  (파일 / TCP 9100)
```

**아무것도 저장하지 않는다.** 관람객의 시간은 브라우저에 있고, 이 서버는
지나가는 말을 한 번 보고 흘려보낼 뿐이다. 서버를 끄면 남는 것이 없다.

**패키지를 쓰지 않는다.** WebSocket 서버를 직접 짰다(`lib/ws.js`).
`npm install`을 한 번 더 하지 않아도 된다.
(아두이노를 **실제로 꽂을 때만** `npm i serialport`가 필요해진다.)

> **포트는 9981이다.** 작업본(`~/Desktop/조형실습/AFTERLIGHT/bridge/`)의 다리가
> 9980을 쓰므로, 둘을 함께 띄워도 부딪히지 않게 한 칸 옆으로 두었다.
> 그 저장소는 건드리지 않았다.

---

## 띄우기

### 전시장 설정 (MacBook 주소 등)

코드에는 아무 주소도 적혀 있지 않다. `config.example.json`을 복사해
`config.local.json`을 만들고 그 안의 값을 고친다 — 이 파일은 전시장마다
달라서 저장소에 올라가지 않는다(`.gitignore`).

```bash
cp server/config.example.json server/config.local.json
```

여기서 고친 값은 **기본값**이 된다. 아래 CLI 플래그를 주면 그게 다시
이 값을 덮는다(현장에서 한 번만 다르게 띄울 때 파일을 안 고쳐도 되게).
자세한 순서는 [`docs/03-전시-설치-운영-가이드.md`](../docs/03-전시-설치-운영-가이드.md)
2단계.

```bash
npm run bridge        # ws://127.0.0.1:9981  (이 기계 안)
npm run bridge:lan    # 같은 공유기의 태블릿도 붙을 수 있게
npm run bridge:sim    # 버튼 대역이 붙을 수 있게 (--sim --verbose)
npm run bridge:test   # 처음부터 끝까지 시험한다 (76곳)
```

장비 없이 전부 돌려 보려면 창 넷.

```bash
npm run bridge:sim    # 1 — 다리
npm run wall          # 2 — TouchDesigner 자리 (대역)
npm run sensor        # 3 — HC-SR04 손 감지 자리 (대역). h 가까이 · l 멀리
npm run dev           # 4 — 하늘
```

(버튼만 시험하려면 `npm run button` — s · n · r 키.)

브라우저 왼쪽 아래에 테스트 판, 오른쪽 아래에 **연결 상태 판**이 뜬다.

### 옵션

```
--port, -p <번호>      기본 9981
--host <주소>          기본 127.0.0.1
--lan                  같은 공유기에서도 붙을 수 있게 (사설 대역만 받는다)
--sim                  버튼 대역이 붙는 길(/sim)을 연다. 전시 중에는 켜지 않는다
--arduino <포트>       예: /dev/tty.usbmodem1101
--baud <숫자>          기본 115200
--printer none|file|tcp     기본 file
--printer-path <파일>  기본 receipts.txt
--printer-host <주소>  tcp일 때
--printer-port <번호>  기본 9100
--receipt-text         영수증에 기록 원문을 적는다 (기본은 적지 않는다)
--verbose, -v          지나가는 신호를 한 줄씩
--quiet, -q            조용히
```

---

## 붙는 자리

| 누가 | 어디로 |
| --- | --- |
| 하늘 (브라우저) | `ws://127.0.0.1:9981/sky` 또는 `/` |
| 벽 (TouchDesigner) | `ws://127.0.0.1:9981/td` |
| 버튼·센서 대역 | `ws://127.0.0.1:9981/sim` — `--sim`일 때만 |

다른 자리로는 붙을 수 없다. **사설 대역이 아닌 곳에서 오는 연결은 거절한다.**
공유기에 포트 포워딩을 걸지 말 것 — 그 순간 전시장의 다리가 인터넷에 열린다.

---

## 오가는 말

한 마디는 JSON 한 줄이고, 봉투는 언제나 같다.

```json
{ "v": 1, "id": "…", "event": "star.requested", "at": 1760432481000, "origin": "live" }
```

| 칸 | 뜻 |
| --- | --- |
| `v` | 규약의 판. 지금은 1 |
| `id` | **이 마디 하나의 이름. 같은 id는 두 번 처리하지 않는다** |
| `event` | 아래 일곱 중 하나 |
| `at` | 보낸 때 |
| `origin` | `live`(사람이 겪은 일) · `stage`(점검하려고 낸 것) |

### 일곱 가지 말

| 이벤트 | 누가 → 누가 | 무엇이 실려 있나 |
| --- | --- | --- |
| `star.requested` | 하늘 → 다리 → 벽 | `star`, `travelSeconds` |
| `star.accepted` | 다리 → 하늘 | `starId`, `ok` — **받아들였다는 말이지 벽에 떴다는 말이 아니다** |
| `star.arrived` | 하늘 → 다리 → 벽 | `star` |
| `constellation.updated` | 하늘 → 다리 → 벽 | `constellation { id, emotion, size }` |
| `universe.state` | 하늘 → 다리 → 벽 | `universe { total, keep, letgo, byConstellation }` |
| `button.pressed` | 아두이노/대역 → 다리 → 하늘 | `button`, `down` |
| `receipt.requested` | 하늘 → 다리 → 프린터 | `receipt` |

그 밖에 다리가 제 사정을 알리는 둘: `bridge.status` · `receipt.result`.

### 장치 사이드채널 — 손 감지 센서 · LED

**일곱 가지 말에 넣지 않는다.** `bridge.status`처럼 다리와 장치 사이의
사정을 나르는 말이고, 별·별자리·우주 같은 작품의 뜻을 싣지 않는다.

| 이벤트 | 누가 → 누가 | 무엇이 실려 있나 |
| --- | --- | --- |
| `sensor.proximity` | 아두이노(또는 `/sim`) → 다리 → **하늘만** | `cm` — 지금 거리 |
| `star.shown` | 다리 → 하늘 | `starId` — 벽이 띄웠다고 알려 온 그 별 |
| `led.set` | 하늘 → 다리 → 아두이노(시리얼) | `step`(0~5 또는 `'off'`) |

`sensor.proximity`는 **"가깝다"의 판정을 하지 않는다** — 거리값 그대로
하늘에 흘려보낸다. 1초를 보유해야 보내지는지, 손을 떼야 다음 전송이
열리는지는 전부 하늘(`src/lib/sensorGate.ts`)이 정한다. 그래야 전시 중에
임계값 하나를 바꾸자고 보드에 새 펌웨어를 올리지 않아도 된다.

`led.set`은 **하늘이 기준 시계를 쥔다** — `SceneSending`이 전송 진행을
다섯 단계로 나눠 매 단계마다 이 말을 보낸다. 아두이노는 받은 개수만큼
LED를 켜는 단순 실행기일 뿐이다. 벽(TD)으로는 가지 않는다.

### 벽이 다리에게 거는 말

```json
{ "command": "hello",  "wall": "north" }
{ "command": "ack",    "starId": "…" }
{ "command": "shown",  "starId": "…" }
{ "command": "resend" }
```

---

## 별 하나가 지나는 다섯 단계

**이 다섯을 절대로 한 가지로 묶지 않는다.** 전시장에서 "별이 안 떠요"라는 말을
들었을 때, 어디까지 갔는지 알아야 어디를 고칠지 알 수 있다.

| 단계 | 뜻 | 여기서 멈춰 있다면 |
| --- | --- | --- |
| `requested` | 하늘이 보냈다 | — |
| `accepted` | 다리가 받아들였다 (검증 통과) | 데이터가 잘못됐다 |
| `relayed` | 다리가 벽으로 넘겼다 | **벽이 꺼져 있다** (넘길 곳이 없으면 이 수는 늘지 않는다) |
| `received` | 벽이 받았다고 알려 왔다 (`ack`) | TD가 받고 있지 않다 |
| `shown` | 벽이 화면에 띄웠다고 한다 (`shown`) | **TD가 받았지만 못 띄우고 있다** |

연결 상태 판이 이 넷을 따로 적는다.

---

## 넘어가지 않는 것

**사람이 쓴 글은 벽으로 가지 않는다.**

브라우저가 이미 막고 있다 — `toWallLight()`가 문장을 떼어 내므로 애초에 여기까지
오지 않는다. 그런데도 한 번 더 막는 것은, **사람의 기록을 스위치 하나에
걸어 두지 않기 위해서다.** 누군가 하늘 쪽 코드를 고쳐 문장을 실어 보내도
다리가 떨어낸다(`sanitize.js`).

방식은 '지우기'가 아니라 **허용 목록**이다. 목록에 없는 칸은 전부 떨어진다.

| | 벽으로 | 영수증으로 |
| --- | --- | --- |
| 기억의 한 문장 (`text`) | 가지 않는다 | **가지 않는다** (`--receipt-text`로만) |
| 그 시간이 언제였나 (`timeRef`) | 가지 않는다 | 고른 항목의 **이름만** (`3년쯤 전`) |
| 누가 보냈나 (`sessionId`) | 가지 않는다 | 가지 않는다 |
| 별 id · 마음 · 별자리 · 자리 · 밝기 · 씨앗 | 간다 | 번호(`seq`)만 |

받지 않는 말: JSON이 아닌 것 · 객체가 아닌 것 · `v`가 1이 아닌 것 · 모르는 이벤트 ·
`id`나 `at`이 없는 것 · 별을 그릴 만큼 적혀 있지 않은 것 · 64KB를 넘는 한 마디(끊는다).
`NaN`과 `Infinity`는 조용히 떨어지고, `x`·`y`가 0~1을 벗어나면 가장자리로 묶는다.

---

## TouchDesigner 쪽

**네 면의 화면은 TD가 맡는다.** 다리도 웹사이트도 프로젝션 매핑에 손대지 않고,
**0~1 사이의 자리**만 건넨다. 해상도와 배치가 정해지지 않았으므로
**아무것도 가정하지 않는다** (`walls.example.json` 참고).

**WebSocket DAT** 하나를 놓고,

| 칸 | 값 |
| --- | --- |
| Network Address | `127.0.0.1` |
| Network Port | `9981` |
| Request Url | `/td` |
| Active | On |

```python
import json

def onConnect(dat):
    dat.sendText(json.dumps({'command': 'hello', 'wall': 'north'}))
    dat.sendText(json.dumps({'command': 'resend'}))
    return

def onReceiveText(dat, rowIndex, message):
    signal = json.loads(message)

    # 점검용 신호는 벽에 띄우지 않는다.
    # 전시 중에 점검 신호가 관람자의 빛과 섞이면, 그건 그 사람의 시간이 아니다.
    if signal.get('origin') == 'stage':
        return

    event = signal.get('event')
    star = signal.get('star')

    if event == 'star.requested':
        # star['transferId']는 이 전송 한 건을 가리키는 이름이다 (지금은 star['id']와 같다).
        # 완료 응답을 보낼 때(reportShown) 바로 이 값을 그대로 돌려주면 된다.
        op('stars').appendRow([
            star['transferId'], star['emotion'], star['type'], star['constellation'],
            star['x'], star['y'], star.get('brightness', 0.6), star.get('seed', 0),
            signal.get('travelSeconds', 2.6),
        ])
    elif event == 'star.arrived':
        pass  # 날아오던 빛이 자리에 앉는다
    elif event == 'constellation.updated':
        c = signal['constellation']
        op('constellations')[c['id'], 'size'] = c['size']
    elif event == 'universe.state':
        op('universe').par.value0 = signal['universe']['total']

    # 받았다고 알린다
    dat.sendText(json.dumps({'command': 'ack', 'starId': (star or {}).get('id')}))
    return

# 그리고 **실제로 화면에 띄운 뒤에** 한 번 더 알린다. 이 둘은 다른 일이다.
def reportShown(star_id):
    op('bridge').sendText(json.dumps({'command': 'shown', 'starId': star_id}))
```

---

## 끊겼을 때

- **하늘은 멈추지 않는다.** 다리가 없어도 작품은 지금과 똑같이 돈다
- 브라우저가 혼자 다시 잇는다 (0.9 → 1.8 → 3.6 → 8 → 30초)
- **지나간 신호를 쌓아 두지 않는다.** 다시 이어졌을 때 밀린 순간들이 한꺼번에
  쏟아지면 그건 도착이 아니라 알림이 된다. 빛은 그때 그 순간의 것이다
- 다만 **우주의 상태 한 장**(`universe.state`)은 다르다. 이어질 때마다 한 번 보내고,
  다리도 마지막 한 장만 들고 있어 늦게 켠 벽에 건넨다
- 프린터가 죽어도 별은 간다. **출력 실패가 전송을 막지 않는다**

---

## 아직 안 된 것

- **TouchDesigner 실제 연결은 검증되지 않았다.** `stand-in/wall.js`(대역)로만 확인했다
- **아두이노(버튼·센서·LED)는 꽂혀 있지 않다.** 시리얼을 읽고 쓰는 길은 있지만
  `serialport`를 들이지 않았고, `--arduino` 없이는 포트를 열지도 않는다.
  펌웨어(`firmware/afterlight_sensor/`)도 실물 HC-SR04·LED로는 아직 확인하지 못했다
- **영수증 프린터는 연결되지 않았다.** 기본은 파일에 쌓는 것이고,
  TCP(9100)로 보내는 길은 **실물로 확인하지 않았다**
- 네 면의 해상도·배치·매핑은 정해지지 않았다

## 파일

```
server/
  index.js            다리 (실행하는 것)
  config.js           전시장 설정을 읽는다 (config.local.json 없으면 example로)
  config.example.json 설정 서식 — 복사해 config.local.json을 만든다 (커밋 안 됨)
  protocol.js         봉투 · 일곱 가지 말 + 장치 사이드채널 · 이벤트 id · 중복 거르기
  sanitize.js         걸러내는 자리 — 허용 목록
  hub.js              지금 무엇이 어디까지 왔는가
  printer.js          영수증 (none | file | tcp)
  arduino.js          시리얼 — 버튼 읽기 · 센서 읽기 · LED 쓰기. serialport는 장비가 올 때
  lib/ws.js           WebSocket 한 겹 (악수 + 프레임)
  lib/address.js      사설 대역인가
  stand-in/wall.js    TouchDesigner 자리에 서는 대역
  stand-in/button.js  Arduino 버튼 자리에 서는 대역
  stand-in/sensor.js  HC-SR04 손 감지 센서 자리에 서는 대역
  firmware/afterlight_sensor/afterlight_sensor.ino   아두이노 펌웨어 (HC-SR04 + LED 5개)
  test.js             처음부터 끝까지 (76곳 + 장치 사이드채널)
  walls.example.json  네 면의 빈 서식 — 값은 아직 채우지 않는다
```
