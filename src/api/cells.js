/**
 * Data access layer. Today this reads static JSON bundled under
 * `public/data/`. When the backend is ready, swap the fetch URLs
 * (or axios / SDK calls) here — stores and components are unaware
 * of the transport.
 *
 * Target REST surface (illustrative):
 *   GET /cells              → cells.json             metadata for every cell
 *   GET /column-config      → column-config.json     table / chart option config
 *   GET /simulations        → simulations.json       bulk { cellId -> {iPeak, iAvg, delay, ivData} }
 *   GET /simulations/:id    → per-cell variant (not used yet — see fetchSimulation)
 */

const BASE = import.meta.env.BASE_URL // '/clara_front/' in prod, '/' in dev

async function getJson(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    throw new Error(`Request failed (${res.status}): ${path}`)
  }
  return res.json()
}

export function fetchCells() {
  return getJson('data/cells.json')
}

export function fetchColumnConfig() {
  return getJson('data/column-config.json')
}

export function fetchSimulations() {
  return getJson('data/simulations.json')
}

// Reserved for a future per-cell endpoint (`GET /simulations/:id`).
// Today we only ship the bulk file above; this exists so that switching
// to lazy-loading later is a one-file change.
export async function fetchSimulation(cellId) {
  const all = await fetchSimulations()
  return all[cellId] ?? null
}
