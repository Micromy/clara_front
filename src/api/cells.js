/**
 * Data access layer — CLARA REST API.
 *
 * Endpoints:
 *   GET  /clara/pdk/                     PDK 목록
 *   GET  /clara/lib/                     Library 목록
 *   GET  /clara/metric/                  Metric(축 후보) 목록
 *   GET  /clara/meta/?params             셀 메타데이터 (필터)
 *   GET  /clara/cell/ff/?cell_id=1,2,3   FF 시뮬레이션
 *   GET  /clara/cell/icg/?cell_id=1,2,3  ICG 시뮬레이션
 *   GET  /clara/preset/                  Preset 목록
 *   POST /clara/preset/                  Preset 생성
 *   DELETE /clara/preset/:id/            Preset 삭제
 *   GET  /clara/chart/                   Chart 목록
 *   POST /clara/chart/                   Chart 생성
 *   DELETE /clara/chart/:id/             Chart 삭제
 */

const API_BASE = 'http://at-django--at-backend-django-dev.khdevpb01.apps.dks.samsungds.net'

// ── snake_case ↔ camelCase 변환 ──────────────────────────────────────────

function toCamelKey(str) {
  if (typeof str !== 'string') return str
  return str.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase())
}

function toSnakeKey(str) {
  if (typeof str !== 'string') return str
  return str.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`)
}

function toCamel(obj) {
  if (Array.isArray(obj)) return obj.map(toCamel)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toCamelKey(k), toCamel(v)])
    )
  }
  return obj
}

function toSnake(obj) {
  if (Array.isArray(obj)) return obj.map(toSnake)
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj).map(([k, v]) => [toSnakeKey(k), toSnake(v)])
    )
  }
  return obj
}

// ── Metric field1/field2 값 변환 + NONE → null 정규화 ────────────────────

function normalizeMetric(m) {
  return {
    ...m,
    op: m.op === 'NONE' ? null : m.op,
    field1: m.field1 === 'NONE' ? null : toCamelKey(m.field1),
    field2: m.field2 === 'NONE' ? null : toCamelKey(m.field2)
  }
}

// ── HTTP helpers ─────────────────────────────────────────────────────────

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`GET ${path} failed (${res.status})`)
  return toCamel(await res.json())
}

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(toSnake(body))
  })
  if (!res.ok) throw new Error(`POST ${path} failed (${res.status})`)
  return toCamel(await res.json())
}

async function del(path) {
  const res = await fetch(`${API_BASE}${path}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 204) throw new Error(`DELETE ${path} failed (${res.status})`)
}

// ── column-config (static JSON, 유지) ────────────────────────────────────

const BASE = import.meta.env.BASE_URL

export function fetchColumnConfig() {
  return fetch(`${BASE}data/column-config.json`).then(r => r.json())
}

// ── PDK / Library / Metric ───────────────────────────────────────────────

export function fetchPdks() {
  return get('/clara/pdk/')
}

export function fetchLibraries() {
  return get('/clara/lib/')
}

export async function fetchMetrics() {
  const data = await get('/clara/metric/')
  return data.map(normalizeMetric)
}

// ── Cell Metadata ────────────────────────────────────────────────────────

// Map API meta field names to frontend field names
function mapMetaRow(row) {
  const { lib, libId, ...rest } = row
  return { ...rest, library: lib, libId }
}

export async function fetchMeta({ cellType, pdkId, libIds }) {
  const params = new URLSearchParams()
  if (cellType) params.set('cell_type', cellType)
  if (pdkId) params.set('pdk_id', pdkId)
  if (libIds && libIds.length) params.set('lib_id', libIds.join(','))
  const data = await get(`/clara/meta/?${params}`)
  return data.map(mapMetaRow)
}

// ── Simulation Data ──────────────────────────────────────────────────────

export function fetchSimFF(cellIds) {
  return get(`/clara/cell/ff/?cell_id=${cellIds.join(',')}`)
}

export function fetchSimICG(cellIds) {
  return get(`/clara/cell/icg/?cell_id=${cellIds.join(',')}`)
}

// ── Presets ──────────────────────────────────────────────────────────────

export function fetchPresets() {
  return get('/clara/preset/')
}

export function createPreset(data) {
  return post('/clara/preset/', data)
}

export function deletePreset(presetId) {
  return del(`/clara/preset/${presetId}/`)
}

// ── Charts ──────────────────────────────────────────────────────────────

export function fetchCharts() {
  return get('/clara/chart/')
}

export function createChart(data) {
  return post('/clara/chart/', data)
}

export function deleteChart(chartId) {
  return del(`/clara/chart/${chartId}/`)
}
