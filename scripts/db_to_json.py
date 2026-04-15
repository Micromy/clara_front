"""
Pulls cells + simulation data from the Oracle DB and writes the two JSON
files the frontend consumes:

  public/data/cells.json
  public/data/simulations.json

Usage:
  pip install oracledb
  python3 scripts/db_to_json.py

Fill in DB_USER / DB_PASSWORD / DB_DSN below, or export them as env vars
(env vars take precedence). Oracle thick mode needs the Instant Client;
set ORACLE_CLIENT_LIB if it isn't on the default library path.

DO NOT commit real credentials. Add this file (or a credentials.py split
off from it) to .gitignore if you hardcode secrets.
"""
import json
import os
import sys
from pathlib import Path

# ── Fill these in, or leave blank and use env vars ─────────────────────────
DB_USER     = ''
DB_PASSWORD = ''
DB_DSN      = ''  # TNS descriptor, e.g. '(DESCRIPTION=(LOAD_BALANCE=...)...)'
ORACLE_CLIENT_LIB = ''  # path to instantclient; blank → use system default
# ────────────────────────────────────────────────────────────────────────────

try:
    import oracledb
except ImportError:
    sys.exit('Missing dependency: pip install oracledb')

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / 'public' / 'data'

META_TABLE = 'at9.arias_cell_meta'
FF_TABLE   = 'at9.spil_cell_ff'
ICG_TABLE  = 'at9.spil_cell_icg'

# DB column (uppercase) -> JSON prop name
META_MAP = {
    'ID':             'id',
    'CELL_TYPE':      'cellType',
    'PDK':            'pdk',
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


def fetch(cursor, table, mapping):
    cursor.execute(f'SELECT {", ".join(mapping.keys())} FROM {table}')
    col_order = [mapping[c[0]] for c in cursor.description]
    return [dict(zip(col_order, (coerce(v) for v in row))) for row in cursor]


def main():
    user     = os.environ.get('DB_USER')     or DB_USER
    password = os.environ.get('DB_PASSWORD') or DB_PASSWORD
    dsn      = os.environ.get('DB_DSN')      or DB_DSN
    if not (user and password and dsn):
        sys.exit('DB_USER / DB_PASSWORD / DB_DSN must be set (in this file or as env vars).')

    lib_dir = os.environ.get('ORACLE_CLIENT_LIB') or ORACLE_CLIENT_LIB or None
    oracledb.init_oracle_client(lib_dir=lib_dir)  # thick mode

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    with oracledb.connect(user=user, password=password, dsn=dsn) as conn:
        with conn.cursor() as cur:
            cells = fetch(cur, META_TABLE, META_MAP)
            ff_rows  = fetch(cur, FF_TABLE,  {**FF_SIM_MAP,  'CELL_ID': 'cellId'})
            icg_rows = fetch(cur, ICG_TABLE, {**ICG_SIM_MAP, 'CELL_ID': 'cellId'})

    bad = [c['id'] for c in cells if c['cellType'] not in ('FF', 'ICG')]
    if bad:
        print(f'WARN: {len(bad)} cells have cellType not in (FF, ICG): {bad[:5]}...', file=sys.stderr)

    sims = {}
    for r in ff_rows + icg_rows:
        cid = r.pop('cellId', None)
        if cid is None:
            continue
        key = str(int(cid)) if isinstance(cid, float) and cid.is_integer() else str(cid)
        sims[key] = r

    (OUT_DIR / 'cells.json').write_text(json.dumps(cells, indent=2, ensure_ascii=False))
    (OUT_DIR / 'simulations.json').write_text(json.dumps(sims, indent=2, ensure_ascii=False))

    print(f'Wrote {len(cells)} cells and {len(sims)} simulations to {OUT_DIR}')


if __name__ == '__main__':
    main()
