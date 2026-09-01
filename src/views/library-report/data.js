// Dummy data for the Library Report mockup. Deterministic so values don't shift
// between renders during a client review. Swap for real API calls later.
//
// Process / library / height / user names are deliberately fictional — this
// page is published to a public URL, so only the *shape* of the values (digit
// count, column layout, name format) is meant to match production.

export const PDKS = [
  { id: 'p1', process: 'AX5P', hspice: 'V0.9.0.0', lvs: 'V0.9.0.0', pex: 'V0.9.0.0' },
  { id: 'p2', process: 'AX5P', hspice: 'V1.0.0.0', lvs: 'V0.9.5.0', pex: 'V1.0.0.0' },
  { id: 'p3', process: 'AX5',  hspice: 'V1.2.0.0', lvs: 'V1.2.0.0', pex: 'V1.2.0.0' },
]

export const LIBS = ['LIBA', 'LIBB']
export const HEIGHTS = ['CH120', 'CH150', 'CH180']
export const CK_SLOPES = ['100%', '70%', '40%']

export const CELLS = [
  'INVD1', 'INVD2', 'INVD4', 'INVD8', 'BUFFD2', 'BUFFD4', 'NAND2D1',
  'NAND2D2', 'NOR2D1', 'NOR2D2', 'MUX2D1', 'XOR2D1', 'DFFRPQD1', 'DFFRPQD2',
]

export function findPdk(id) {
  return PDKS.find(p => p.id === id) || PDKS[0]
}

// ── Deterministic pseudo-random, seeded by a string ──
function hash(str) {
  let h = 7
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) % 2147483647
  return h
}
function mk(seed) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646 }
}

// ── Tab 1: Library Info ──
const GDS_VERSIONS = ['V1.0.0.0', 'V0.9.5.0', 'V0.9.5.0']

export function releasePaths(lib) {
  return HEIGHTS.map((height, i) => ({
    height,
    path: `/proj/lib/${lib}/${height.toLowerCase()}/release/r${4 - i}`,
    gds: GDS_VERSIONS[i],
  }))
}

// Only what each Cell Height actually supports is listed — no placeholders.
export const CELL_DESIGN = [
  { height: 'CH120', drives: 'D1 D2 D3 D6 D8 D16', vths: 'rvt lvt slvt vlvt', nanosheet: 'N1 N2 N3 N5' },
  { height: 'CH150', drives: 'D1 D2 D3 D4 D8',     vths: 'rvt lvt slvt',      nanosheet: 'N1 N2 N3' },
  { height: 'CH180', drives: 'D1 D2 D3',           vths: 'rvt lvt slvt mvt',  nanosheet: 'N1 N2 N3 N4' },
]

// ── Tab 2: PPA — sets saved from the PPA page ──
export const SAVED_SETS = [
  { id: 's1', name: 'hd_inv_buf_sweep',      cells: 14, chart: 'Bar',         y: 'Area',    y2: 'None',  derived: 1, saved: '2026-08-30 17:22', owner: 'demo.user' },
  { id: 's2', name: 'flop_area_regression',  cells: 9,  chart: 'Grouped Bar', y: 'Area',    y2: 'Delay', derived: 0, saved: '2026-08-28 11:04', owner: 'demo.user' },
  { id: 's3', name: 'nand_nor_leak_check',   cells: 11, chart: 'Bar',         y: 'Leakage', y2: 'None',  derived: 2, saved: '2026-08-21 09:47', owner: 'qa.user' },
]

export function findSavedSet(id) {
  return SAVED_SETS.find(s => s.id === id) || null
}

export function ppaRows(set, pdkId, lib, refLib) {
  return CELLS.slice(0, set.cells).map(cell => {
    const rnd = mk(hash(cell + pdkId + lib + set.id))
    const area = 0.13 + rnd() * 0.26
    const delay = 6 + rnd() * 16
    const leak = 3 + rnd() * 230
    const cin = 0.9 + rnd() * 6.4
    const rr = mk(hash(cell + pdkId + refLib + set.id))
    const same = refLib === lib
    const ref = (v, spread, bias) => (same ? v : v * (1 + (rr() - bias) * spread))
    const pct = (v, r) => ((v - r) / r) * 100
    return {
      cell, area, delay, leak, cin,
      dArea:  pct(area,  ref(area,  0.09, 0.45)),
      dDelay: pct(delay, ref(delay, 0.11, 0.55)),
      dLeak:  pct(leak,  ref(leak,  0.24, 0.5)),
      dCin:   pct(cin,   ref(cin,   0.07, 0.5)),
    }
  })
}

// ── Tab 3: MW — rows are Cells, columns are voltages grouped by CK Slope ──
const VOLTAGES = ['0p42v', '0p45v', '0p50v', '0p55v', '0p60v']
const MW_BASE = 26      // setup, ps
const MW_HIGH = 44      // over this, render as a warning

export function mwTable(pdkId, lib) {
  const p = findPdk(pdkId)
  const key = `${p.process}|${p.hspice}|${p.lvs}|${p.pex}|${lib}`

  // Not every CK Slope has data at every voltage — column counts differ per group.
  const groups = CK_SLOPES.map((slope, i) => {
    const volts = VOLTAGES.filter((v, vi) => hash(key + slope + v) % 10 > (i === 0 ? 0 : i + 1) || vi < 3 - i)
    return { slope, volts: volts.length ? volts : VOLTAGES.slice(0, 3) }
  })

  const subCols = []
  groups.forEach(g => g.volts.forEach((label, i) => {
    subCols.push({ label, last: i === g.volts.length - 1 })
  }))

  const rnd = mk(hash(key))
  const rows = CELLS.slice(0, 7).map(cell => ({
    cell,
    values: subCols.map((c, i) => {
      const v = MW_BASE * (0.72 + 0.055 * i) * (0.9 + rnd() * 0.25)
      return { v: v.toFixed(2), last: c.last, over: v > MW_HIGH }
    }),
  }))

  return { groups, subCols, rows }
}

// ── Tab 4: Final Report — dummy copy; replaced by an LLM call later ──
export function finalReport({ pdk, lib, savedSet, mwSets }) {
  const tableCount = mwSets.reduce((a, s) => a + s.tables.length, 0)
  return {
    meta: 'generated 2026-08-31 09:42 · Library Info + PPA + MW 3 tabs',
    title: `[${pdk.process}] ${lib} 리포트 요약`,
    body: `Library Info · PPA · MW 세 탭에 담긴 값을 정리했습니다. PPA는 저장 셋 ` +
      `${savedSet ? `"${savedSet.name}"(${savedSet.cells} cells)` : '미선택'}, ` +
      `MW는 ${mwSets.length}개 셋 / ${tableCount}개 테이블을 기준으로 했습니다. ` +
      `아래 항목은 원본 값을 그대로 인용한 것이며 판정이 아닙니다.`,
    sections: [
      {
        source: 'LIBRARY INFO', color: '#8a929c', title: 'PDK 구성과 릴리스 경로',
        body: `PDK는 ${pdk.process} 기준이며 HSPICE ${pdk.hspice} / LVS ${pdk.lvs} / PEX ${pdk.pex}로 ` +
          `구성되어 있습니다. Release Path는 Cell Height 세 종(${HEIGHTS.join(' / ')})에 각각 하나씩 존재하고, rev가 서로 다릅니다.`,
        points: [
          { flag: 'PATH',   text: `${HEIGHTS.join(' / ')} 경로 릴리스`, value: `${HEIGHTS.length}종` },
          { flag: 'GDS',    text: 'Cell Height 간 GDS version 상이 (V1.0.0.0 / V0.9.5.0)', value: '차이 있음' },
          { flag: 'DESIGN', text: 'Cell Height별 Drive Strength / VTH / Nanosheet 지원 범위 상이', value: '확인 필요' },
        ],
      },
      {
        source: 'PPA', color: '#2f6fed', title: '저장 셋 렌더 결과',
        body: savedSet
          ? `"${savedSet.name}" 셋은 ${savedSet.cells}개 Cell을 ${savedSet.chart} 형태로, ` +
            `Cell × ${savedSet.y} 축으로 저장했습니다. Derived Metric ${savedSet.derived}개가 포함되어 있습니다.`
          : 'PPA 탭에서 저장 셋을 아직 불러오지 않았습니다. 셋을 선택하면 그 차트와 표가 이 요약에 반영됩니다.',
        points: savedSet
          ? [
              { flag: 'CELLS', text: '저장된 Cell 수', value: String(savedSet.cells) },
              { flag: 'CHART', text: `${savedSet.chart} · Cell × ${savedSet.y}`, value: savedSet.y2 === 'None' ? '단일 축' : '2축' },
              { flag: 'DERIVED', text: 'Derived Metric', value: savedSet.derived ? String(savedSet.derived) : '—' },
            ]
          : [{ flag: '없음', text: '불러온 저장 셋이 없습니다', value: '—' }],
      },
      {
        source: 'MW', color: '#8a929c', title: '비교 셋 구성',
        body: `각 테이블은 행이 Cell, 열이 CK Slope(${CK_SLOPES.join(' / ')}) 아래 voltage로 구성됩니다. ` +
          `slope마다 데이터가 존재하는 voltage가 달라 테이블 간 열 수가 일치하지 않으므로, ` +
          `비교 시 동일 slope·voltage 열끼리 대응시켜 읽어야 합니다.`,
        points: mwSets.map((s, i) => ({
          flag: `SET ${i + 1}`,
          text: `${s.label || '이름 없음'} · ${s.tables.map(t => `${findPdk(t.pdkId).process}/${t.lib}`).join(' vs ')}`,
          value: `${s.tables.length} tables`,
        })),
      },
    ],
    actions: [
      { sev: 'CHECK', text: 'Cell Height 간 GDS version 차이 — 비교 전 기준 통일', tab: 'Library Info', owner: 'lib.owner' },
      { sev: 'CHECK', text: 'Cell Height별 미지원 Drive Strength / VTH / Nanosheet 확인', tab: 'Library Info', owner: 'lib.design' },
      { sev: 'INFO',  text: savedSet ? '저장 셋의 Derived Metric 정의 확인' : 'PPA 저장 셋 불러오기', tab: 'PPA', owner: 'demo.user' },
      { sev: 'INFO',  text: 'MW 테이블 간 CK Slope·voltage 열 대응 확인', tab: 'MW', owner: 'char.team' },
    ],
    disclaimer: '요약은 위 세 탭에 표시된 값만 인용해 생성되며, 합격·불합격 판정을 하지 않습니다. 근거 값은 각 탭에서 직접 확인하세요.',
  }
}
