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

// ── Family ↔ Library ──
// GET /clara/family/ 응답 shape을 mock으로 재현 (API.md §11).
// family는 library 테이블의 컬럼이라 자체 id가 없다 — 이름 문자열이 곧 키.
// 배열 순서 = 표시 순서 (PPA 열 그룹 / Library Info 행 그룹 / MW 테이블 순서).
export const FAMILIES = [
  { family: 'FAMA', libraries: [{ id: 1, library: 'LIBA' }, { id: 2, library: 'LIBB' }] },
  { family: 'FAMB', libraries: [{ id: 3, library: 'LIBC' }, { id: 4, library: 'LIBD' }, { id: 5, library: 'LIBE' }] },
  { family: 'FAMC', libraries: [{ id: 6, library: 'LIBF' }] },
]

export const HEIGHTS = ['CH120', 'CH150', 'CH180']
export const CK_SLOPES = ['100%', '70%', '40%']
// mw_type 목록 — 실제로는 DB(PDK/Library 조합별 mw_type 목록) 조회 API로 대체 예정
export const MW_TYPES = ['MWD', 'MWS']

export const CELLS = [
  'INVD1', 'INVD2', 'INVD4', 'INVD8', 'BUFFD2', 'BUFFD4', 'NAND2D1',
  'NAND2D2', 'NOR2D1', 'NOR2D2', 'MUX2D1', 'XOR2D1', 'DFFRPQD1', 'DFFRPQD2',
]

export function findPdk(id) {
  return PDKS.find(p => p.id === id) || PDKS[0]
}

export function findFamily(name) {
  return FAMILIES.find(f => f.family === name) || FAMILIES[0]
}

// Mock signed-in user — no auth in this mockup; the Final Report uses it as the
// author/reviewer identity.
export const CURRENT_USER = 'demo.user'

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

// 인자는 library 이름 1개 — 호출부는 libraryInfo()(집계)와 libBlock()(Final Report) 둘.
export function releasePaths(library) {
  return HEIGHTS.map((height, i) => ({
    height,
    path: `/proj/lib/${library}/${height.toLowerCase()}/release/r${4 - i}`,
    gds: GDS_VERSIONS[i],
  }))
}

// Full axes — the mini tables render every value and grey out the unsupported
// ones, so a Cell Height's support shows as a fixed-position pattern.
export const VTH_ALL = ['rvt', 'lvt', 'slvt', 'mvt', 'vlvt']
export const NANOSHEET_ALL = ['N1', 'N2', 'N3', 'N4', 'N5']

// Cell Design은 library마다 지원 범위가 다를 수 있다. 기준 행(BASE)에서
// library 이름으로 시드한 결정적 규칙으로 일부 축을 빼고 cell 수를 흔든다.
// 각 축의 첫 항목은 항상 남겨 빈 mini-table이 생기지 않게 한다.
const CELL_DESIGN_BASE = [
  { height: 'CH120', drives: 'D1 D2 D3 D6 D8 D16', vths: ['rvt', 'lvt', 'slvt', 'vlvt'], nanosheet: ['N1', 'N2', 'N3', 'N5'], cells: 512 },
  { height: 'CH150', drives: 'D1 D2 D3 D4 D8',     vths: ['rvt', 'lvt', 'slvt'],         nanosheet: ['N1', 'N2', 'N3'],       cells: 374 },
  { height: 'CH180', drives: 'D1 D2 D3',           vths: ['rvt', 'lvt', 'slvt', 'mvt'],  nanosheet: ['N1', 'N2', 'N3', 'N4'], cells: 268 },
]

export function cellDesign(library) {
  return CELL_DESIGN_BASE.map(base => {
    const keep = (axis, v, i) => i === 0 || hash(`${library}|${base.height}|${axis}|${v}`) % 8 !== 0
    const rnd = mk(hash(`${library}|${base.height}|cells`))
    return {
      library,
      height: base.height,
      drives: base.drives,
      vths: base.vths.filter((v, i) => keep('vth', v, i)),
      nanosheet: base.nanosheet.filter((v, i) => keep('ns', v, i)),
      cells: Math.round(base.cells * (0.92 + rnd() * 0.16)),
    }
  })
}

// ── Library Info 집계 ──
// GET /clara/library-info/?pdk_id=&family= 응답 shape을 mock으로 재현 (API.md §12).
// releasePaths(library)/cellDesign(library)는 library 단위로 남겨두고(libBlock이 쓴다),
// 이 함수가 family 멤버 전체로 합친다 — 실제 연동 시 이 함수 1개가 API 호출 1회로 대체된다.
// 반환은 와이어 shape이므로 snake_case (Final Report mock과 같은 예외).
// pdkIdInt()/heightId()는 파일 하단 Final Report 섹션 선언 — 함수 hoisting으로 호출한다.
export function libraryInfo(pdkId, family) {
  return {
    family: family.family,
    pdk_id: pdkIdInt(pdkId),
    libraries: family.libraries.map(l => ({
      id: l.id,
      library: l.library,
      release_paths: releasePaths(l.library).map(r => ({
        cell_height_id: heightId(r.height),
        height: r.height,
        path: r.path,
        gds_version: r.gds,
      })),
      cell_design: cellDesign(l.library).map(r => ({
        cell_height_id: heightId(r.height),
        height: r.height,
        drives: r.drives,
        vths: r.vths,
        nanosheet: r.nanosheet,
        cell_count: r.cells,
      })),
    })),
  }
}

// ── Tab 2: PPA — sets saved from the PPA page ──
export const SAVED_SETS = [
  { id: 's1', name: 'hd_inv_buf_sweep',      cells: 14, chart: 'Bar',         y: 'Area',    y2: 'None',  derived: 1, saved: '2026-08-30 17:22', owner: 'demo.user' },
  { id: 's2', name: 'flop_area_regression',  cells: 9,  chart: 'Grouped Bar', y: 'Area',    y2: 'Delay', derived: 0, saved: '2026-08-28 11:04', owner: 'demo.user' },
  { id: 's3', name: 'nand_nor_leak_check',   cells: 11, chart: 'Bar',         y: 'Leakage', y2: 'None',  derived: 2, saved: '2026-08-21 09:47', owner: 'qa.user' },
]

export function findSavedSet(id) {
  return SAVED_SETS.find(s => s.id === id) || null
}

export const PPA_METRICS = [
  { key: 'area',  dkey: 'dArea',  raw: 'AREA (µm²)', diff: 'Δ AREA',  digits: 4 },
  { key: 'delay', dkey: 'dDelay', raw: 'DELAY (ps)', diff: 'Δ DELAY', digits: 2 },
  { key: 'leak',  dkey: 'dLeak',  raw: 'LEAK (nA)',  diff: 'Δ LEAK',  digits: 1 },
  { key: 'cin',   dkey: 'dCin',   raw: 'CIN (fF)',   diff: 'Δ CIN',   digits: 2 },
]

// 열은 library × metric, 행은 family 전체 cell 합집합.
// libraries: family 멤버 배열(응답 순서 유지), refLibrary: 기준 library 이름.
// diff는 pseudo-random 참조가 아니라 refLibrary의 실측 행에서 계산한다.
export function ppaTable(set, pdkId, libraries, refLibrary) {
  const cells = CELLS.slice(0, set.cells)
  // library마다 일부 cell이 빠질 수 있다 — 결정적으로 구멍을 만든다.
  const has = (lib, cell) => hash(`${lib}|${cell}|${set.id}`) % 9 !== 0

  const raw = {}
  libraries.forEach(l => {
    raw[l.library] = {}
    cells.forEach(cell => {
      if (!has(l.library, cell)) return
      // seed 구성은 기존 ppaRows와 동일 — LIBA/LIBB의 숫자가 바뀌지 않는다.
      const rnd = mk(hash(cell + pdkId + l.library + set.id))
      raw[l.library][cell] = {
        area: 0.13 + rnd() * 0.26,
        delay: 6 + rnd() * 16,
        leak: 3 + rnd() * 230,
        cin: 0.9 + rnd() * 6.4,
      }
    })
  })

  const pct = (v, r) => ((v - r) / r) * 100
  const rows = cells.map(cell => {
    const byLib = {}
    libraries.forEach(l => {
      const v = raw[l.library][cell]
      if (!v) { byLib[l.library] = null; return }
      const r = l.library === refLibrary ? null : raw[refLibrary]?.[cell]
      byLib[l.library] = {
        ...v,
        dArea:  r ? pct(v.area,  r.area)  : null,
        dDelay: r ? pct(v.delay, r.delay) : null,
        dLeak:  r ? pct(v.leak,  r.leak)  : null,
        dCin:   r ? pct(v.cin,   r.cin)   : null,
      }
    })
    return { cell, byLib }
  })

  return {
    groups: libraries.map(l => ({ library: l.library, ref: l.library === refLibrary })),
    metrics: PPA_METRICS,
    rows,
  }
}

// ── Tab 3: MW — rows are Cells, columns are voltages grouped by CK Slope ──
const VOLTAGES = ['0p42v', '0p45v', '0p50v', '0p55v', '0p60v']
const MW_BASE = 26      // setup, ps
const MW_HIGH = 44      // over this, render as a warning

export function mwTable(pdkId, lib, height, mwType) {
  const p = findPdk(pdkId)
  const key = `${p.process}|${p.hspice}|${p.lvs}|${p.pex}|${lib}|${height}|${mwType}`

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

// ── Tab 4: Final Report ──
// 백엔드 GET /clara/report/ response shape을 mock으로 재현 (docs/final-report-design.md 7장).
// 저장은 참조형이지만 응답 시점에 원본을 조인해 현재 값을 block.data에 inline 확장한 형태.

// MW 임계값 — 시스템 상수 (설계 3-4). 프론트/백엔드가 각자 하드코딩.
export const MW_THRESHOLD = { MWD: 44, MWS: 40 }

const GEN_AT = '2026-08-31T09:42:00'

function pdkIdInt(pdkId) {
  return Number(String(pdkId).replace(/\D/g, '')) || 1
}
function heightId(height) {
  return HEIGHTS.indexOf(height) + 1
}
function voltageValue(label) {
  return Number(label.replace('p', '.').replace('v', ''))
}

// slope 40 고정 + fail_count >= 시스템상수[mw_type] 필터 → MW block data (7-5).
export function mwFlaggedCells(pdkId, lib, height, mwType) {
  const p = findPdk(pdkId)
  const threshold = MW_THRESHOLD[mwType] ?? 44
  const key = `${p.process}|${lib}|${height}|${mwType}|slope40`
  const base = { cell_height_id: heightId(height), height, mw_type: mwType, threshold }

  // 일부 조합엔 slope 40 데이터가 없음.
  if (hash(key) % 5 === 0) return { ...base, slope_present: false, cells: [] }

  const rnd = mk(hash(key))
  const volts = ['0p42v', '0p45v', '0p50v']
  const cells = []
  CELLS.forEach(cell => {
    const hits = []
    volts.forEach(v => {
      const fc = Math.floor(rnd() * 80)
      if (fc >= threshold) hits.push({ voltage_label: v, voltage_value: voltageValue(v), fail_count: fc })
    })
    if (hits.length) cells.push({ cell_name: cell, hits })
  })
  return { ...base, slope_present: true, cells }
}

// LIB / MW 블록은 library 스코프 — library 하나를 맡으므로 data 내부 구조는 그대로다.
// library = { id, library }. block_id는 호출부(finalReport)에서 seq와 함께 부여한다.
function libBlock(pdk, library) {
  const rp = releasePaths(library.library)
  const gdsSet = [...new Set(rp.map(r => r.gds))]
  const prose =
    `PDK는 ${pdk.process} 기준이며 HSPICE ${pdk.hspice} / LVS ${pdk.lvs} / PEX ${pdk.pex}로 구성됩니다. ` +
    `Release Path는 Cell Height ${rp.length}종에 각각 하나씩 존재하고, GDS version은 ` +
    `${gdsSet.length > 1 ? '서로 다릅니다' : '동일합니다'}.`
  return {
    block_type: 'LIB', title: `${library.library} · PDK 구성과 릴리스 경로`,
    ai_draft: prose, body: prose, ai_generated_at: GEN_AT,
    chart_id: null, library_id: library.id, cell_height_id: null, mw_type: null,
    stale: false, source_saved_at: GEN_AT, source_current_at: GEN_AT,
    data: {
      library: library.library,
      pdk: { process: pdk.process, hspice: pdk.hspice, lvs: pdk.lvs, pex: pdk.pex },
      release_paths: rp.map((r, i) => ({
        cell_height_id: i + 1, height: r.height, path: r.path, gds_version: r.gds, gds_desc: '',
      })),
      cell_design: cellDesign(library.library).map((r, i) => ({
        cell_height_id: i + 1, height: r.height, drives: r.drives,
        vths: r.vths, nanosheet: r.nanosheet, cell_count: r.cells,
      })),
      vth_all: VTH_ALL, nanosheet_all: NANOSHEET_ALL,
    },
  }
}

// PPA 블록은 family 스코프 — chart는 library에 종속되지 않으므로 블록이 쪼개지지 않는다.
function ppaBlock(set, libraries) {
  const chartId = Number(String(set.id).replace(/\D/g, ''))
  const prose =
    `"${set.name}" 셋은 ${set.cells}개 Cell을 ${set.chart} 형태로, Cell × ${set.y} 축으로 저장했습니다. ` +
    `Derived Metric ${set.derived}개가 포함되어 있고, family 내 library ${libraries.length}종을 비교합니다.`
  return {
    block_type: 'PPA', title: '저장 셋 렌더 결과',
    ai_draft: prose, body: prose, ai_generated_at: GEN_AT,
    chart_id: chartId, library_id: null, cell_height_id: null, mw_type: null,
    stale: false, source_saved_at: GEN_AT, source_current_at: GEN_AT,
    data: {
      chart_id: chartId, chart_name: set.name, chart_type: set.chart.toLowerCase(),
      cell_type: 1, x_metric: 'Cell', y1_metric: set.y, y2_metric: set.y2 === 'None' ? null : set.y2,
      cell_count: set.cells, derived_count: set.derived, saved_at: set.saved, owner: set.owner,
      libraries: libraries.map(l => l.library), library_count: libraries.length,
    },
  }
}

function mwBlock(pdkId, library, height, mwType) {
  const data = mwFlaggedCells(pdkId, library.library, height, mwType)
  const prose = data.slope_present
    ? `${height} / ${mwType}에서 CK Slope 40 기준 fail_count ${data.threshold} 이상인 셀이 ${data.cells.length}개 있습니다.`
    : `${height} / ${mwType}에는 CK Slope 40 데이터가 없어 해당 없음입니다.`
  return {
    block_type: 'MW', title: `${library.library} · ${height} · ${mwType} 경고 셀`,
    ai_draft: prose, body: prose, ai_generated_at: GEN_AT,
    chart_id: null, library_id: library.id, cell_height_id: data.cell_height_id, mw_type: mwType,
    stale: false, source_saved_at: GEN_AT, source_current_at: GEN_AT,
    data: { library: library.library, ...data },
  }
}

// 리포트 스코프는 (PDK, family) 1건. family는 리포트의 UNIQUE 키다.
export function finalReport({ pdkId, family, savedSetId }) {
  const pdk = findPdk(pdkId)
  const set = findSavedSet(savedSetId) || SAVED_SETS[0]
  const libs = family.libraries

  // library 스코프 블록(LIB/MW)을 library마다, family 스코프 블록(PPA)을 맨 뒤에.
  const blocks = [
    ...libs.flatMap(l => [
      libBlock(pdk, l),
      mwBlock(pdkId, l, 'CH120', 'MWD'),
      mwBlock(pdkId, l, 'CH150', 'MWS'),
    ]),
    ppaBlock(set, libs),
  ].map((b, i) => ({ ...b, seq: i, block_id: 101 + i }))

  return {
    report_id: 12,
    pdk_id: pdkIdInt(pdkId),
    family: family.family,
    libraries: libs.map(l => ({ id: l.id, library: l.library })),
    title: `[${pdk.process}] ${family.family} 리포트 요약`,
    lead_body:
      `Library Info · PPA · MW 세 탭에 담긴 값을 정리했습니다. family ${family.family}의 ` +
      `library ${libs.length}종이 대상이며, 아래 각 영역은 원본을 그대로 인용한 것이고 합격·불합격 판정이 아닙니다.`,
    status: 'DRAFT',
    generated_at: GEN_AT,
    finalized_at: null, finalized_by: null,
    locked: false, editable_until: null,
    created_by: CURRENT_USER, created_at: GEN_AT,
    updated_by: CURRENT_USER, updated_at: GEN_AT,
    release_paths: libs.flatMap(l =>
      releasePaths(l.library).map((r, i) => ({
        library_id: l.id, library: l.library, cell_height_id: i + 1, height: r.height, path: r.path, gds_desc: '',
      })),
    ),
    release_updated_at: GEN_AT,
    // family에 새 library가 추가되면 백엔드가 채운다. mock은 stale과 같은 이유로 항상 빈 배열.
    unreported_libraries: [],
    blocks,
    comment_count: 0,
  }
}
