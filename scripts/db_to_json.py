"""
Pulls cells + simulation data from the Oracle DB and writes the two JSON
files the frontend consumes:

  public/data/cells.json
  public/data/simulations.json

Usage:
  pip install oracledb
  cp .env.example .env   # then fill in the values — .env is gitignored
  python3 scripts/db_to_json.py

Env vars (DB_USER / DB_PASSWORD / DB_DSN / ORACLE_CLIENT_LIB) override
values from .env when present.
"""
import argparse
import json
import os
import sys
from pathlib import Path

try:
    import oracledb
except ImportError:
    sys.exit('Missing dependency: pip install oracledb')

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'public' / 'data'
ENV_FILE = ROOT / '.env'


def load_env_file(path: Path) -> dict:
    """Minimal KEY=VALUE parser — no python-dotenv dependency needed."""
    if not path.is_file():
        return {}
    out = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        v = v.strip()
        if len(v) >= 2 and v[0] == v[-1] and v[0] in ('"', "'"):
            v = v[1:-1]
        out[k.strip()] = v
    return out

META_TABLE = 'at9.arias_cell_meta'
FF_TABLE   = 'at9.spil_cell_ff'
ICG_TABLE  = 'at9.spil_cell_icg'

# DB column (uppercase) -> JSON prop name
META_MAP = {
    'ID':             'id',
    'CELL_TYPE':      'cellType',
    'PDK':            'pdk',
    'VENDOR':         'vendor',
    'CELL_NAME':      'cellName',
    'CELL':           'cell',
    'VERSION':        'version',
    'DRIVE_STRENGTH': 'driveStrength',
    'NANOSHEET':      'nanosheet',
    'GATE_LENGTH':    'gateLength',
    'CELL_HEIGHT':    'cellHeight',
    'CPP':            'cpp',
    'FEOL':           'feol',
    'BEOL':           'beol',
    'GDS_OVERLAY':    'gdsOverlay',
    'LIBRARY':        'library',
    'VTH':            'vth',
    'VDD':            'vdd',
    'TEMPERATURE':    'temperature',
    'CHARAC_TOOL':    'characTool',
}

FF_SIM_MAP = {
    'DQ_WST':            'dqWorst',
    'DQ_AVG':            'dqAvg',
    'CQ_DELAY_AVG':      'cqDelayAvg',
    'DSETUP_3SIGMA_AVG': 'dSetup3SigmaAvg',
    'DHOLD_SOHM_AVG':    'dHoldSohmAvg',
    'AREA':              'area',
    'CK_CAP':            'ckCap',
    'P_LEAKAGE':         'pLeakage',
    'PDYN':              'pDyn',
    'PDP_AVG':           'pdpAvg',
}

ICG_SIM_MAP = {
    'EECK_WST':            'eeckWorst',
    'EECK_AVG':            'eeckAvg',
    'CQ_DELAY_AVG':        'cqDelayAvg',
    'ESETUP_3SIGMA_AVG':   'eSetup3SigmaAvg',
    'EHOLD_SOHM_AVG':      'eHoldSohmAvg',
    'DELAY_TRAN_RF_RATIO': 'delayTranRfRatio',
    'AREA':                'area',
    'CK_CAP':              'ckCap',
    'P_LEAKAGE':           'pLeakage',
    'PDYN':                'pDyn',
    'PDP_AVG':             'pdpAvg',
}


def coerce(v):
    """DB drivers may return Decimal/datetime; JSON needs primitives."""
    if v is None:
        return None
    if isinstance(v, (int, float, str, bool)):
        return v
    try:
        return float(v)
    except (TypeError, ValueError):
        return str(v)


def fetch(cursor, table, mapping, order_by=None, where='', suffix=''):
    sql = f'SELECT {", ".join(mapping.keys())} FROM {table}'
    if where:
        sql += where
    if order_by:
        sql += f' ORDER BY {order_by} ASC'
    if suffix:
        sql += suffix
    print(f'[SQL] {sql}')
    cursor.execute(sql)
    col_order = [mapping[c[0]] for c in cursor.description]
    return [dict(zip(col_order, (coerce(v) for v in row))) for row in cursor]


def main():
    parser = argparse.ArgumentParser(description='Export Oracle DB → cells.json + simulations.json')
    parser.add_argument('--limit', type=int, default=0,
                        help='Max rows to fetch from arias_cell_meta (0 = all). '
                             'Only matching simulations are exported.')
    parser.add_argument('--where', type=str, default='',
                        help='SQL WHERE clause (without WHERE keyword). '
                             'e.g. --where "CELL_NAME LIKE \'MHSDFF%%\' OR VENDOR = \'ARM\'"')
    args = parser.parse_args()

    env = load_env_file(ENV_FILE)

    def get(key):
        return os.environ.get(key) or env.get(key) or ''

    user     = get('DB_USER')
    password = get('DB_PASSWORD')
    dsn      = get('DB_DSN')
    if not (user and password and dsn):
        sys.exit(f'DB_USER / DB_PASSWORD / DB_DSN must be set in {ENV_FILE} or as env vars.')

    lib_dir = get('ORACLE_CLIENT_LIB') or None
    oracledb.init_oracle_client(lib_dir=lib_dir)  # thick mode

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    where_clause = f' WHERE {args.where}' if args.where else ''
    limit_clause = f' FETCH FIRST {args.limit} ROWS ONLY' if args.limit else ''

    with oracledb.connect(user=user, password=password, dsn=dsn) as conn:
        with conn.cursor() as cur:
            cells = fetch(cur, META_TABLE, META_MAP, order_by='ID', where=where_clause, suffix=limit_clause)
            cell_ids = {c['id'] for c in cells}
            ff_rows  = fetch(cur, FF_TABLE,  {**FF_SIM_MAP,  'CELL_ID': 'cellId'})
            icg_rows = fetch(cur, ICG_TABLE, {**ICG_SIM_MAP, 'CELL_ID': 'cellId'})

    # Filter simulations to only include cells we fetched
    if args.limit or args.where:
        ff_rows  = [r for r in ff_rows  if r.get('cellId') in cell_ids]
        icg_rows = [r for r in icg_rows if r.get('cellId') in cell_ids]

    cells.sort(key=lambda c: c['id'])

    bad = [c['id'] for c in cells if c['cellType'] not in ('FF', 'ICG')]
    if bad:
        print(f'WARN: {len(bad)} cells have cellType not in (FF, ICG): {bad[:5]}...', file=sys.stderr)

    # Merge FF + ICG sim rows, sort by cell id so keys end up in ascending order
    # regardless of which table each row came from.
    def sim_key(cid):
        return str(int(cid)) if isinstance(cid, float) and cid.is_integer() else str(cid)

    merged = []
    for r in ff_rows + icg_rows:
        cid = r.pop('cellId', None)
        if cid is None:
            continue
        merged.append((int(cid), sim_key(cid), r))
    merged.sort(key=lambda t: t[0])

    sims = {key: row for _, key, row in merged}

    (OUT_DIR / 'cells.json').write_text(json.dumps(cells, indent=2, ensure_ascii=False))
    (OUT_DIR / 'simulations.json').write_text(json.dumps(sims, indent=2, ensure_ascii=False))

    print(f'Wrote {len(cells)} cells and {len(sims)} simulations to {OUT_DIR}')


if __name__ == '__main__':
    main()
