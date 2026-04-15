const CELL_TYPES = ['INV', 'NAND', 'NOR', 'BUF', 'DFF', 'MUX', 'AOI', 'OAI', 'XOR', 'XNOR']
const DRIVE_STRENGTHS = ['X1', 'X2', 'X4', 'X8', 'X12', 'X16']
const NANOSHEETS = ['NS3', 'NS4', 'NS5']
const LIBRARIES = ['stdcell_hvt', 'stdcell_svt', 'stdcell_lvt', 'stdcell_ulvt']
const GATE_LENGTHS = [5, 7, 12, 14]
const CPP_VALUES = [48, 51, 54, 57]
const CELL_HEIGHTS = [5.0, 6.0, 6.5, 7.5]
const FEOL_CORNERS = ['TT', 'FF', 'SS', 'FS', 'SF']
const BEOL_CORNERS = ['Cmax', 'Cmin', 'Cnom']
const GDS_OVERLAYS = ['nom', 'max', 'min']
const VTH_VALUES = [0.25, 0.30, 0.35, 0.40, 0.45]
const VDD_VALUES = [0.65, 0.70, 0.75, 0.80, 0.85]
const TEMPERATURES = [-40, 0, 25, 85, 125]
const LOT_IDS = ['LOT-A001', 'LOT-A002', 'LOT-B001', 'LOT-B002', 'LOT-C001']
const WAFER_IDS = ['W01', 'W02', 'W03', 'W04', 'W05', 'W06']

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function generateCellName(type, drive) {
  return `${type}${drive}_${pick(['A', 'B', 'C'])}${Math.floor(Math.random() * 10)}`
}

export function generateCellList(count = 100) {
  const cells = []
  for (let i = 0; i < count; i++) {
    const type = pick(CELL_TYPES)
    const drive = pick(DRIVE_STRENGTHS)
    const vdd = pick(VDD_VALUES)
    const gateLength = pick(GATE_LENGTHS)

    // Drive strength number (X1→1, X4→4, etc.) scales peak current
    const dsNum = parseInt(drive.replace('X', ''))
    // iPeak (μA): larger drive + shorter gate = more current
    const iPeak = Math.round((15 + Math.random() * 25) * dsNum * (14 / gateLength) * 10) / 10
    const iAvg = Math.round(iPeak * (0.4 + Math.random() * 0.2) * 10) / 10
    const delay = Math.round(500 / iPeak * gateLength * 100 * (0.8 + Math.random() * 0.4) * 10) / 10

    cells.push({
      id: i + 1,
      cellName: generateCellName(type, drive),
      cellType: type,
      evt: `EVT${Math.floor(Math.random() * 3) + 1}`,
      driveStrength: drive,
      nanosheet: pick(NANOSHEETS),
      library: pick(LIBRARIES),
      gateLength,
      cpp: pick(CPP_VALUES),
      cellHeight: pick(CELL_HEIGHTS),
      feolCorner: pick(FEOL_CORNERS),
      beolCorner: pick(BEOL_CORNERS),
      gdsOverlay: pick(GDS_OVERLAYS),
      vth: pick(VTH_VALUES),
      vdd,
      temp: pick(TEMPERATURES),
      lot: pick(LOT_IDS),
      wafer: pick(WAFER_IDS),
      createTime: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      iPeak,
      iAvg,
      delay
    })
  }
  return cells
}

// Column definitions and chart options now live in
// public/data/column-config.json and are served by src/api/cells.js.
