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

function generateIVData(vddBase) {
  const points = []
  for (let v = 0; v <= vddBase; v += 0.05) {
    const voltage = Math.round(v * 100) / 100
    const current = (0.001 + Math.random() * 0.005) * Math.exp(voltage * 3) + (Math.random() * 0.01)
    const currentUA = current * 1000
    points.push({
      voltage: voltage,
      currentMA: Math.round(current * 10000) / 10000,
      currentUA: Math.round(currentUA * 100) / 100
    })
  }
  return points
}

export function generateCellList(count = 100) {
  const cells = []
  for (let i = 0; i < count; i++) {
    const type = pick(CELL_TYPES)
    const drive = pick(DRIVE_STRENGTHS)
    const vdd = pick(VDD_VALUES)
    const gateLength = pick(GATE_LENGTHS)
    const ivData = generateIVData(vdd)
    const iPeakUA = Math.max(...ivData.map(p => p.currentUA))
    const iAvgUA = ivData.reduce((s, p) => s + p.currentUA, 0) / ivData.length
    const delayPs = (50 / iPeakUA) * (gateLength / 7) * 1000
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
      vdd: vdd,
      temp: pick(TEMPERATURES),
      lot: pick(LOT_IDS),
      wafer: pick(WAFER_IDS),
      createTime: new Date(2025, Math.floor(Math.random() * 12), Math.floor(Math.random() * 28) + 1).toISOString().split('T')[0],
      iPeak: Math.round(iPeakUA * 100) / 100,
      iAvg: Math.round(iAvgUA * 100) / 100,
      delay: Math.round(delayPs * 10) / 10,
      ivData
    })
  }
  return cells
}

export const COLUMN_DEFINITIONS = [
  { key: 'cellName', label: 'Cell Name', width: 160 },
  { key: 'cellType', label: 'Cell Type', width: 100 },
  { key: 'evt', label: 'EVT', width: 80 },
  { key: 'driveStrength', label: 'Drive Strength', width: 120 },
  { key: 'nanosheet', label: 'Nanosheet', width: 100 },
  { key: 'library', label: 'Library', width: 140 },
  { key: 'gateLength', label: 'Gate Length', width: 100 },
  { key: 'cpp', label: 'CPP', width: 80 },
  { key: 'cellHeight', label: 'Cell Height', width: 100 },
  { key: 'feolCorner', label: 'FEOL Corner', width: 110 },
  { key: 'beolCorner', label: 'BEOL Corner', width: 110 },
  { key: 'gdsOverlay', label: 'GDS Overlay', width: 110 },
  { key: 'vth', label: 'Vth', width: 80 },
  { key: 'vdd', label: 'VDD', width: 80 },
  { key: 'temp', label: 'Temp', width: 80 },
  { key: 'lot', label: 'Lot', width: 110 },
  { key: 'wafer', label: 'Wafer', width: 80 },
  { key: 'createTime', label: 'Create Time', width: 120 }
]

export const CHART_TYPE_OPTIONS = [
  { value: 'line', label: 'Line Chart' },
  { value: 'scatter', label: 'Scatter Plot' },
  { value: 'bar', label: 'Bar Chart' }
]

export const X_AXIS_OPTIONS = [
  { value: 'voltage', label: 'Voltage (V)' },
  { value: 'temp', label: 'Temperature (°C)' },
  { value: 'vdd', label: 'VDD (V)' }
]

export const Y_AXIS_OPTIONS = [
  { value: 'currentMA', label: 'Current (mA)' },
  { value: 'currentUA', label: 'Current (μA)' },
  { value: 'voltage', label: 'Voltage (V)' }
]

export const GROUPING_OPTIONS = [
  { value: 'alias', label: 'By Alias' },
  { value: 'cellType', label: 'By Cell Type' },
  { value: 'driveStrength', label: 'By Drive Strength' },
  { value: 'library', label: 'By Library' },
  { value: 'feolCorner', label: 'By FEOL Corner' }
]
