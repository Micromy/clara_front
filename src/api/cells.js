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

// ── 임시 로컬 모드: 사내 API 접근 불가 시 public/data/*.json 사용 ──
// 토글은 프로젝트 루트 .env 파일의 VITE_USE_LOCAL_DATA로 제어.
const USE_LOCAL_DATA = import.meta.env.VITE_USE_LOCAL_DATA === 'true'

// 로컬 JSON의 옛 필드명 → 현재 스키마 매핑
const LOCAL_FIELD_MAP = {
  driveStrength: 'driveStr',
  nanosheet: 'nanoSheet',
  dqWorst: 'dqWst',
  dSetup3SigmaAvg: 'dsetup3sigmaAvg',
  dHoldSohmAvg: 'dholdSohmAvg',
  pDyn: 'pdyn',
  eeckWorst: 'eeckWst',
  eSetup3SigmaAvg: 'esetup3sigmaAvg',
  eHoldSohmAvg: 'eholdSohmAvg'
}
function remapLocalKeys(obj) {
  if (Array.isArray(obj)) return obj.map(remapLocalKeys)
  if (obj && typeof obj === 'object') {
    const out = {}
    for (const [k, v] of Object.entries(obj)) {
      out[LOCAL_FIELD_MAP[k] || k] = v
    }
    return out
  }
  return obj
}

let _localCells = null
let _localSim = null
let _localCfg = null
async function loadLocalCells() {
  if (!_localCells) {
    const r = await fetch(`${import.meta.env.BASE_URL}data/cells.json`)
    _localCells = (await r.json()).map(remapLocalKeys)
  }
  return _localCells
}
async function loadLocalSim() {
  if (!_localSim) {
    const r = await fetch(`${import.meta.env.BASE_URL}data/simulations.json`)
    _localSim = await r.json()
  }
  return _localSim
}
async function loadLocalCfg() {
  if (!_localCfg) {
    const r = await fetch(`${import.meta.env.BASE_URL}data/column-config.json`)
    _localCfg = await r.json()
  }
  return _localCfg
}

// In-memory presets/charts for local mode (lost on reload)
const _localPresets = []
const _localCharts = []
let _localPresetId = 1
let _localChartId = 1

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

function parseLocalPdkString(s) {
  const m = s.match(/^\[(.+?)\]\s*HSPICE:\s*(\S+)\s*\/\s*LVS:\s*(\S+)\s*\/\s*PEX:\s*(\S+)/)
  if (m) return { process: m[1], hspice: m[2], lvs: m[3], pex: m[4] }
  return { process: s, hspice: '', lvs: '', pex: '' }
}

export async function fetchPdks() {
  if (USE_LOCAL_DATA) {
    const cells = await loadLocalCells()
    const uniq = [...new Set(cells.map(c => c.pdk))].filter(Boolean)
    return uniq.map((pdk, i) => ({ id: i + 1, pdk, ...parseLocalPdkString(pdk) }))
  }
  return get('/clara/pdk/')
}

export async function fetchLibraries() {
  if (USE_LOCAL_DATA) {
    const cells = await loadLocalCells()
    const uniq = [...new Set(cells.map(c => c.library))].filter(Boolean)
    return uniq.map((library, i) => ({ id: i + 1, library, lib: library, label: library }))
  }
  return get('/clara/lib/')
}

export async function fetchMetrics() {
  if (USE_LOCAL_DATA) {
    const cfg = await loadLocalCfg()
    const byType = cfg.selectedCellsSimulationColumns || {}
    let id = 1
    const out = []
    for (const [cellType, cols] of Object.entries(byType)) {
      cols.forEach((c, order) => {
        out.push({
          metricId: id++,
          name: c.label,
          cellType,
          formulaType: 'raw',
          op: null,
          field1: c.prop,
          field2: null,
          metricOrder: order
        })
      })
    }
    return out
  }
  const data = await get('/clara/metric/')
  return data.map(normalizeMetric)
}

// ── Cell Metadata ────────────────────────────────────────────────────────

// Map API meta field names to frontend field names
function mapMetaRow(row) {
  const { lib, libId, ...rest } = row
  return { ...rest, library: lib, libId }
}

export async function fetchMeta({ cellType, pdkId, libIds, cellIds }) {
  if (USE_LOCAL_DATA) {
    const cells = await loadLocalCells()
    const pdks = await fetchPdks()
    const libs = await fetchLibraries()
    const pdkById = new Map(pdks.map(p => [p.id, p.pdk]))
    const libIdByName = new Map(libs.map(l => [l.library, l.id]))
    const pdkStr = pdkId ? pdkById.get(pdkId) : null
    const libSet = libIds?.length ? new Set(libIds) : null
    const cellIdSet = cellIds?.length ? new Set(cellIds) : null
    return cells
      .filter(c => {
        if (cellIdSet && !cellIdSet.has(c.id)) return false
        if (cellType && c.cellType !== cellType) return false
        if (pdkStr && c.pdk !== pdkStr) return false
        if (libSet && !libSet.has(libIdByName.get(c.library))) return false
        return true
      })
      .map(c => ({ ...c, libId: libIdByName.get(c.library) }))
  }
  const params = new URLSearchParams()
  if (cellType) params.set('cell_type', cellType)
  if (pdkId) params.set('pdk_id', pdkId)
  if (libIds && libIds.length) params.set('lib_id', libIds.join(','))
  if (cellIds && cellIds.length) params.set('id', cellIds.join(','))
  const data = await get(`/clara/meta/?${params}`)
  return data.map(mapMetaRow)
}

// ── Simulation Data ──────────────────────────────────────────────────────

// Django DecimalField serializes as string; coerce numeric strings to Number
// so downstream diff/ratio math works.
const NUMERIC_RE = /^-?\d+(\.\d+)?(e[+-]?\d+)?$/i
function numerizeRow(row) {
  const out = {}
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === 'string' && NUMERIC_RE.test(v)) out[k] = Number(v)
    else out[k] = v
  }
  return out
}

async function localSimRows(cellIds) {
  const sim = await loadLocalSim()
  return cellIds
    .filter(id => sim[id])
    .map(id => ({ cellId: id, ...remapLocalKeys(sim[id]) }))
}

export async function fetchSimFF(cellIds) {
  if (USE_LOCAL_DATA) return localSimRows(cellIds)
  const data = await get(`/clara/cell/ff?cell_id=${cellIds.join(',')}`)
  return data.map(numerizeRow)
}

export async function fetchSimICG(cellIds) {
  if (USE_LOCAL_DATA) return localSimRows(cellIds)
  const data = await get(`/clara/cell/icg?cell_id=${cellIds.join(',')}`)
  return data.map(numerizeRow)
}

// ── Presets ──────────────────────────────────────────────────────────────

export function fetchPresets() {
  if (USE_LOCAL_DATA) return Promise.resolve([..._localPresets])
  return get('/clara/preset/')
}

export function createPreset(data) {
  if (USE_LOCAL_DATA) {
    const preset = { ...data, presetId: _localPresetId++, createdAt: new Date().toISOString() }
    _localPresets.push(preset)
    return Promise.resolve(preset)
  }
  return post('/clara/preset/', data)
}

export function deletePreset(presetId) {
  if (USE_LOCAL_DATA) {
    const i = _localPresets.findIndex(p => p.presetId === presetId)
    if (i !== -1) _localPresets.splice(i, 1)
    return Promise.resolve()
  }
  return del(`/clara/preset/${presetId}/`)
}

// ── Charts ──────────────────────────────────────────────────────────────

export function fetchCharts() {
  if (USE_LOCAL_DATA) return Promise.resolve([..._localCharts])
  return get('/clara/chart/')
}

export function createChart(data) {
  if (USE_LOCAL_DATA) {
    const chart = { ...data, chartId: _localChartId++, createdAt: new Date().toISOString() }
    _localCharts.push(chart)
    return Promise.resolve(chart)
  }
  return post('/clara/chart/', data)
}

export function deleteChart(chartId) {
  if (USE_LOCAL_DATA) {
    const i = _localCharts.findIndex(c => c.chartId === chartId)
    if (i !== -1) _localCharts.splice(i, 1)
    return Promise.resolve()
  }
  return del(`/clara/chart/${chartId}/`)
}
