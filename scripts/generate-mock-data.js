/**
 * Regenerates the mock data files under public/data/:
 *   - cells.json        metadata only (what a /cells endpoint would return)
 *   - simulations.json  per-cell simulation output, keyed by cellId
 *
 * Run with:
 *   npm run generate-mock
 *   node scripts/generate-mock-data.js [count]
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { generateCellList } from '../src/mock/cellData.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(__dirname, '..')

const count = Number(process.argv[2]) || 100
const outDir = resolve(projectRoot, 'public/data')

mkdirSync(outDir, { recursive: true })

// Fields that belong to the simulation payload (kept out of cells.json)
const SIM_KEYS = ['iPeak', 'iAvg', 'delay']

const rawCells = generateCellList(count)

const cells = rawCells.map((c) => {
  const copy = { ...c }
  for (const k of SIM_KEYS) delete copy[k]
  return copy
})

const simulations = {}
for (const c of rawCells) {
  const sim = {}
  for (const k of SIM_KEYS) sim[k] = c[k]
  simulations[c.id] = sim
}

const cellsPath = resolve(outDir, 'cells.json')
const simsPath = resolve(outDir, 'simulations.json')
writeFileSync(cellsPath, JSON.stringify(cells, null, 2))
writeFileSync(simsPath, JSON.stringify(simulations, null, 2))

console.log(`[generate-mock] ${cells.length} cells -> ${cellsPath}`)
console.log(`[generate-mock] ${Object.keys(simulations).length} simulations -> ${simsPath}`)
