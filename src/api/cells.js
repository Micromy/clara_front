/**
 * Data access layer. Today this reads static JSON bundled under
 * `public/data/`. When the backend is ready, swap the fetch URLs
 * (or axios / SDK calls) here — store and components are unaware
 * of the transport.
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
