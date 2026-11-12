import type { StoredAssignment } from './types'

/**
 * 배정 결과를 어디에 두는가.
 *
 * ─── 기존 저장소와 다른 통 ─────────────────────────────
 *  `data/universeRepository.ts`의 `afterlight.universe.v1`(관람객의
 *  기억·별)은 건드리지 않는다. **아예 다른 키**를 쓴다 — 기존 통에
 *  필드를 끼워 넣으면 그 파일의 읽기/쓰기(`read`/`write`/`adopt`)를
 *  다시 고쳐야 하고, 그러면 "기존 로직을 수정하지 마"라는 §10을 어기게
 *  된다. 통을 아예 나누면 그럴 일이 없다.
 *
 *  `data/universeRepository.ts`가 쓰는 것과 같은 안전장치(사생활 보호
 *  모드·용량 초과에서 `localStorage` 자체가 던지는 경우)를 그대로 따른다
 *  — 저장이 안 되어도 배정 함수는 죽지 않고, 그 요청 동안만 메모리 위의
 *  값으로 동작한다(§6 "오류를 숨기지 않는다"와는 다른 자리다 — 이건
 *  "배정 실패"가 아니라 "저장 실패"이고, 배정 자체는 성공했으므로
 *  관람객에게는 그대로 보여 줘야 한다. 다만 새로고침하면 다시 뽑힐 수
 *  있다는 한계는 남는다).
 * ───────────────────────────────────────────────────────
 */
const STORAGE_KEY = 'afterlight.starAssignments.v1'

interface AssignmentFile {
  version: 1
  /** memoryId → 그 기억에 배정된 별. */
  byMemoryId: Record<string, StoredAssignment>
}

function safeStorage(): Storage | null {
  try {
    const probe = '__afterlight_star_assignment__'
    globalThis.localStorage.setItem(probe, probe)
    globalThis.localStorage.removeItem(probe)
    return globalThis.localStorage
  } catch {
    return null
  }
}

/** 저장소가 없거나 깨져 있어도 빈 파일로 본다 — 한 줄이 깨졌다고 전체를 잃지 않는다. */
function readFile(storage: Storage): AssignmentFile {
  try {
    const raw = storage.getItem(STORAGE_KEY)
    if (!raw) return { version: 1, byMemoryId: {} }
    const parsed: unknown = JSON.parse(raw)
    const byMemoryId = (parsed as Partial<AssignmentFile>)?.byMemoryId
    if (!byMemoryId || typeof byMemoryId !== 'object') return { version: 1, byMemoryId: {} }
    return { version: 1, byMemoryId: byMemoryId as Record<string, StoredAssignment> }
  } catch {
    return { version: 1, byMemoryId: {} }
  }
}

function writeFile(storage: Storage, file: AssignmentFile): boolean {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(file))
    return true
  } catch {
    return false
  }
}

/*
 * 세션(탭) 안에서는 메모리에도 들고 있는다.
 *
 * localStorage가 없는 환경(검사 스크립트가 node로 돌 때)에서도 "한 번
 * 배정된 별은 유지"를 지키기 위해서다 — node에는 `localStorage`가 없다.
 */
const memoryFallback = new Map<string, StoredAssignment>()

/** 이 기억에 이미 배정된 별이 있으면 돌려주고, 없으면 `null`. */
export function getStoredAssignment(memoryId: string): StoredAssignment | null {
  const storage = safeStorage()
  if (storage) {
    const found = readFile(storage).byMemoryId[memoryId]
    if (found) return found
  }
  return memoryFallback.get(memoryId) ?? null
}

/**
 * 배정 결과를 저장한다.
 *
 * **이미 있으면 덮어쓰지 않는다** — §7 "한 번 배정된 별은 유지"를
 * 저장소 차원에서 한 번 더 지킨다(`assign.ts`도 저장 전에 먼저 확인하지만,
 * 둘이 같은 규칙을 지키면 호출 순서가 꼬여도 안전하다).
 */
export function saveAssignment(record: StoredAssignment): StoredAssignment {
  const existing = getStoredAssignment(record.memoryId)
  if (existing) return existing

  memoryFallback.set(record.memoryId, record)
  const storage = safeStorage()
  if (!storage) return record

  const file = readFile(storage)
  file.byMemoryId[record.memoryId] = record
  writeFile(storage, file)
  return record
}
