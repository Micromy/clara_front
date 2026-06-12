/**
 * HTTP transport — shared by all CLARA API clients.
 *
 * createClient(baseUrl, { camel, credentials }) → { get, post, put, del }.
 * Domain modules (cells.js, auth.js, …) layer their endpoints on top.
 */

// ── snake_case ↔ camelCase 변환 ──────────────────────────────────────────

export function toCamelKey(str) {
  if (typeof str !== 'string') return str
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
}

function toSnakeKey(str) {
  if (typeof str !== 'string') return str
  return str.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)
}

export function toCamel(obj) {
  if (Array.isArray(obj)) return obj.map(toCamel)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toCamelKey(k), toCamel(v)])
    )
  }
  return obj
}

export function toSnake(obj) {
  if (Array.isArray(obj)) return obj.map(toSnake)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toSnakeKey(k), toSnake(v)])
    )
  }
  return obj
}

// ── Errors ───────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor({ kind, method, path, status = null, body = null }) {
    super(formatApiMessage({ kind, method, path, status, body }))
    this.name = 'ApiError'
    this.kind = kind          // 'network' | 'http' | 'parse'
    this.method = method
    this.path = path
    this.status = status
    this.body = body
  }
}

function formatApiMessage({ kind, method, path, status, body }) {
  if (kind === 'network') return `네트워크 오류: ${method} ${path} 응답 없음. API 주소/네트워크 확인 필요`
  if (kind === 'parse')   return `응답 파싱 실패: ${method} ${path}. 서버가 JSON이 아닌 응답을 보냄`
  // http
  const detail = typeof body === 'object' && body
    ? (body.detail || body.error || JSON.stringify(body))
    : (typeof body === 'string' ? body : null)
  return `${method} ${path} ${status}${detail ? ` — ${detail}` : ''}`
}

// ── Client factory ─────────────────────────────────────────────────────────

// camel:       request body → snake_case, response → camelCase (CLARA API).
// credentials: fetch credentials mode. Default mirrors the fetch default
//              ('same-origin'); set 'include' for cross-origin cookie auth (SSO).
export function createClient(baseUrl, { camel = false, credentials = 'same-origin' } = {}) {
  async function request(method, path, body) {
    const url = path.startsWith('http') ? path : `${baseUrl}${path}`
    let res
    try {
      res = await fetch(url, {
        method,
        credentials,
        headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
        body: body !== undefined
          ? JSON.stringify(camel ? toSnake(body) : body)
          : undefined
      })
    } catch {
      throw new ApiError({ kind: 'network', method, path })
    }

    if (method === 'DELETE' && (res.ok || res.status === 204)) return

    if (!res.ok) {
      let errBody = null
      try { errBody = await res.json() } catch {
        try { errBody = await res.text() } catch {}
      }
      throw new ApiError({ kind: 'http', method, path, status: res.status, body: errBody })
    }

    try {
      const data = await res.json()
      return camel ? toCamel(data) : data
    } catch {
      throw new ApiError({ kind: 'parse', method, path, status: res.status })
    }
  }

  return {
    get:  (path)       => request('GET', path),
    post: (path, body) => request('POST', path, body),
    put:  (path, body) => request('PUT', path, body),
    del:  (path)       => request('DELETE', path)
  }
}
