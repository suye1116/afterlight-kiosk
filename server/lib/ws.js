import { createHash } from 'node:crypto'

/**
 * WebSocket 한 겹.
 *
 * 패키지를 쓰지 않는다. 다리가 하는 일은 한 줄짜리 JSON을 주고받는 것뿐이고,
 * 그걸 위해 의존성을 들이면 전시장 기계에서 `npm install`이 또 한 번 필요해진다.
 * (손님 쪽은 Node에 들어 있는 전역 `WebSocket`을 그대로 쓴다. 서버만 직접 짠다.)
 *
 * 다루는 것: 악수 · 텍스트 프레임 · 조각난 프레임 · ping/pong · close.
 * 다루지 않는 것: 바이너리(받으면 끊는다) · 확장(permessage-deflate 등).
 */

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'

/** 한 마디의 최대 크기. 이보다 큰 것이 오면 연결을 끊는다. */
export const MAX_FRAME = 64 * 1024

/** 악수에 답한다. 맞지 않으면 null. */
export function accept(request) {
  const key = request.headers['sec-websocket-key']
  const version = request.headers['sec-websocket-version']
  const upgrade = String(request.headers.upgrade ?? '').toLowerCase()
  if (!key || upgrade !== 'websocket' || version !== '13') return null
  return createHash('sha1').update(key + GUID).digest('base64')
}

/** 서버가 보내는 프레임은 가리지 않는다(마스크 없음) */
function frame(opcode, payload) {
  const length = payload.length
  let header

  if (length < 126) {
    header = Buffer.alloc(2)
    header[1] = length
  } else if (length < 65536) {
    header = Buffer.alloc(4)
    header[1] = 126
    header.writeUInt16BE(length, 2)
  } else {
    header = Buffer.alloc(10)
    header[1] = 127
    header.writeBigUInt64BE(BigInt(length), 2)
  }

  header[0] = 0x80 | opcode
  return Buffer.concat([header, payload])
}

export const encodeText = (text) => frame(0x1, Buffer.from(text, 'utf8'))
export const encodePing = () => frame(0x9, Buffer.alloc(0))
export const encodePong = (payload) => frame(0xa, payload)

export function encodeClose(code = 1000, reason = '') {
  const body = Buffer.alloc(2 + Buffer.byteLength(reason))
  body.writeUInt16BE(code, 0)
  body.write(reason, 2)
  return frame(0x8, body)
}

/**
 * 들어오는 바이트를 한 마디씩 끊어 읽는다.
 *
 * 손님이 보내는 프레임은 반드시 가려져(masked) 있어야 한다 — 규약이 그렇다.
 * 가리지 않은 프레임을 보내오면 끊는다.
 */
export function createReader({ onText, onPing, onClose, onError }) {
  let buffer = Buffer.alloc(0)
  // 조각나서 오는 마디를 모으는 자리
  let assembling = null

  return function read(chunk) {
    buffer = buffer.length === 0 ? chunk : Buffer.concat([buffer, chunk])

    for (;;) {
      if (buffer.length < 2) return

      const first = buffer[0]
      const second = buffer[1]
      const fin = (first & 0x80) !== 0
      const opcode = first & 0x0f
      const masked = (second & 0x80) !== 0
      let length = second & 0x7f
      let offset = 2

      if (length === 126) {
        if (buffer.length < offset + 2) return
        length = buffer.readUInt16BE(offset)
        offset += 2
      } else if (length === 127) {
        if (buffer.length < offset + 8) return
        const big = buffer.readBigUInt64BE(offset)
        if (big > BigInt(MAX_FRAME)) return onError('한 마디가 너무 큽니다')
        length = Number(big)
        offset += 8
      }

      if (!masked) return onError('가리지 않은 프레임')
      if (length > MAX_FRAME) return onError('한 마디가 너무 큽니다')
      if (buffer.length < offset + 4 + length) return

      const mask = buffer.subarray(offset, offset + 4)
      offset += 4
      const payload = Buffer.from(buffer.subarray(offset, offset + length))
      for (let i = 0; i < payload.length; i += 1) payload[i] ^= mask[i & 3]

      buffer = buffer.subarray(offset + length)

      switch (opcode) {
        case 0x0: {
          // 이어지는 조각
          if (!assembling) return onError('뜬금없는 조각')
          assembling = Buffer.concat([assembling, payload])
          if (assembling.length > MAX_FRAME) return onError('한 마디가 너무 큽니다')
          if (fin) {
            const text = assembling.toString('utf8')
            assembling = null
            onText(text)
          }
          break
        }
        case 0x1: {
          if (!fin) {
            assembling = payload
            break
          }
          onText(payload.toString('utf8'))
          break
        }
        case 0x2:
          return onError('바이너리는 받지 않습니다')
        case 0x8:
          return onClose()
        case 0x9:
          onPing(payload)
          break
        case 0xa:
          break
        default:
          return onError(`모르는 opcode ${opcode}`)
      }
    }
  }
}
