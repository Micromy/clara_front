/**
 * Data access layer — CLARA REST API.
 *
 * Endpoints:
 *   GET  /clara/cell/type                셀 타입 ↔ id 매핑
 *   GET  /clara/pdk/                     PDK 목록
 *   GET  /clara/lib/                     Library 목록
 *   GET  /clara/metric/                  Metric(축 후보) 목록
 *   GET  /clara/meta/?params             셀 메타데이터 (필터)
 *   GET  /clara/cell/ff?cell_id=1,2,3    FF 시뮬레이션
 *   GET  /clara/cell/icg?cell_id=1,2,3   ICG 시뮬레이션
 *   GET  /clara/preset/                  Preset 목록
 *   POST /clara/preset/                  Preset 생성
 *   DELETE /clara/preset/:id/            Preset 삭제
 *   GET  /clara/chart/                   Chart 목록
 *   POST /clara/chart/                   Chart 생성
 *   DELETE /clara/chart/:id/             Chart 삭제
 */

import columnConfig from '../config/column-config.json'
import { createClient, toCamelKey } from './client.js'

export { ApiError } from './client.js'

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

const clara = createClient(API_BASE, { camel: true })
const { get, post, del } = clara

// ── Metric field1/field2 값 변환 + NONE → null 정규화 ────────────────────

function normalizeMetric(m) {
  return {
    ...m,
    op: m.op === 'NONE' ? null : m.op,
    field1: m.field1 === 'NONE' ? null : toCamelKey(m.field1),
    field2: m.field2 === 'NONE' ? null : toCamelKey(m.field2)
  }
}

// ── Column config (bundled with the frontend) ────────────────────────────

export function fetchColumnConfig() {
  return Promise.resolve(columnConfig)
}

// ── Cell Type / PDK / Library / Metric ───────────────────────────────────

export function fetchCellTypes() {
  return get('/clara/cell/type')
}

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

export async function fetchMeta({ cellType, pdkId, libIds, cellIds }) {
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

export async function fetchSimFF(cellIds) {
  const data = await get(`/clara/cell/ff?cell_id=${cellIds.join(',')}`)
  return data.map(numerizeRow)
}

export async function fetchSimICG(cellIds) {
  const data = await get(`/clara/cell/icg?cell_id=${cellIds.join(',')}`)
  return data.map(numerizeRow)
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
