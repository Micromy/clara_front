/**
 * Regenerates public/data/cells.json using the generator in
 * src/mock/cellData.js. Run with:
 *   npm run generate-mock
 * or:
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
const outFile = resolve(outDir, 'cells.json')

mkdirSync(outDir, { recursive: true })
const cells = generateCellList(count)
writeFileSync(outFile, JSON.stringify(cells, null, 2))

console.log(`[generate-mock] wrote ${cells.length} cells -> ${outFile}`)
