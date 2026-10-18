/*
 * AFTERLIGHT — 손 감지 센서(HC-SR04) + 전송 LED 5개.
 *
 * ─── 이 펌웨어가 하지 않는 일 ──────────────────────────────
 *  "가깝다"의 판정, 1초를 보유해야 보내지는지, 중복 전송 방지 — 전부
 *  여기서 하지 않는다. 이 보드는 거리를 재서 올려 보내고, LED 명령을
 *  받으면 그대로 켤 뿐이다. 판정과 타이밍은 하늘(웹사이트)이 한다.
 *  그래야 전시 중에 임계값 하나를 바꾸자고 보드에 새 펌웨어를 올리지
 *  않아도 된다.
 * ────────────────────────────────────────────────────────────
 *
 * 시리얼(기본 115200bps)로 한 줄 JSON을 올려 보낸다 (약 10Hz):
 *
 *   {"sensor":"distance","cm":12.3}
 *
 * 그리고 같은 시리얼로 한 줄 JSON을 받는다 (다리 `server/arduino.js`가 보낸다):
 *
 *   {"led":0}      다섯 중 0개를 켠다 (전부 끈다)
 *   {"led":3}      다섯 중 3개를 켠다
 *   {"led":"off"}  전부 끈다
 *
 * ─── 핀 배선 ──────────────────────────────────────────────
 *   HC-SR04   VCC → 5V · GND → GND · TRIG → 9 · ECHO → 10
 *   LED 5개   2 · 3 · 4 · 5 · 6  (각각 저항을 거쳐 GND로)
 * ────────────────────────────────────────────────────────────
 */

const int TRIG_PIN = 9;
const int ECHO_PIN = 10;
const int LED_PINS[5] = {2, 3, 4, 5, 6};
const int LED_COUNT = 5;

/** 거리를 재는 간격(ms). 10Hz. */
const unsigned long SENSE_INTERVAL_MS = 100;
/** 이보다 멀면(또는 에코가 없으면) 센서가 보지 못한 것으로 본다 */
const float MAX_CM = 400.0;

/** 들어오는 한 줄이 이보다 길면 버린다 — 노이즈 보호 */
const int MAX_LINE = 64;
char inbox[MAX_LINE];
int inboxLen = 0;

unsigned long lastSense = 0;

void setLeds(int count) {
  if (count < 0) count = 0;
  if (count > LED_COUNT) count = LED_COUNT;
  for (int i = 0; i < LED_COUNT; i += 1) {
    digitalWrite(LED_PINS[i], i < count ? HIGH : LOW);
  }
}

/** HC-SR04 한 번 측정. 못 쓸 값이면 -1을 돌려준다. */
float measureCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // 30ms 안에 에코가 없으면 못 본 것으로 둔다 (약 5m 거리에 해당)
  unsigned long duration = pulseIn(ECHO_PIN, HIGH, 30000UL);
  if (duration == 0) return -1;

  float cm = duration * 0.0343 / 2.0;
  if (cm > MAX_CM) return -1;
  return cm;
}

/**
 * 들어온 한 줄에서 `{"led":N}` 또는 `{"led":"off"}`를 읽는다.
 *
 * 라이브러리를 들이지 않는다 — 다리가 보내는 모양이 이 두 가지뿐이므로
 * JSON 파서 전체가 필요하지 않다.
 */
void handleLine(char *line) {
  char *key = strstr(line, "\"led\"");
  if (key == NULL) return;
  char *colon = strchr(key, ':');
  if (colon == NULL) return;
  colon += 1;
  while (*colon == ' ') colon += 1;

  if (*colon == '"') {
    // "off" 같은 문자열. 전부 끈다.
    setLeds(0);
    return;
  }
  int value = atoi(colon);
  setLeds(value);
}

void setup() {
  Serial.begin(115200);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  for (int i = 0; i < LED_COUNT; i += 1) {
    pinMode(LED_PINS[i], OUTPUT);
    digitalWrite(LED_PINS[i], LOW);
  }
}

void loop() {
  unsigned long now = millis();
  if (now - lastSense >= SENSE_INTERVAL_MS) {
    lastSense = now;
    float cm = measureCm();
    if (cm >= 0) {
      Serial.print("{\"sensor\":\"distance\",\"cm\":");
      Serial.print(cm, 1);
      Serial.println("}");
    }
  }

  while (Serial.available() > 0) {
    char ch = (char)Serial.read();
    if (ch == '\n') {
      inbox[inboxLen] = '\0';
      handleLine(inbox);
      inboxLen = 0;
    } else if (ch != '\r' && inboxLen < MAX_LINE - 1) {
      inbox[inboxLen] = ch;
      inboxLen += 1;
    }
  }
}
