# ARIAS Front Mockup — 진행 상황

> 마지막 업데이트: 2026-04-13
> 현재 작업 브랜치: `claude/arias-rebrand-and-features`
> 리포: `Micromy/clara_front`

---

## 1. 프로젝트 개요

**ARIAS** — 반도체 셀 라이브러리 분석 프론트엔드 목업. 셀 메타데이터와 시뮬레이션(V-I 특성) 데이터를 검색·선택하고 차트로 시각화하는 Vue 3 SPA. 추후 백엔드 REST API와 연동 예정.

원본 리포 `park-sungil/clara-front-mockup` 를 `Micromy/clara_front`로 복사한 뒤 리브랜딩 및 기능 확장 중.

---

## 2. 기술 스택

| 영역 | 선택 |
|---|---|
| 프레임워크 | Vue 3 (Composition API, `<script setup>`) |
| 빌드 | Vite **4.5.5** |
| Vue 플러그인 | `@vitejs/plugin-vue` **4.6.2** |
| UI 라이브러리 | Element Plus 2.13 (+ `@element-plus/icons-vue`) |
| 상태 관리 | Pinia 3 |
| 라우팅 | Vue Router 4 (Hash history — GH Pages 호환) |
| 차트 | ECharts 6 + vue-echarts |
| 패키지 매니저 | npm (Node 20+) |
| 배포 | GitHub Pages (GitHub Actions) |

---

## 3. 지금까지 완료된 작업

### 3-1. 프로젝트 복사 + 배포 환경 구축
- 원본 리포에서 소스 전체 복사 (`7c5d6cf`)
- Vite / plugin-vue 다운그레이드 (4.5.5 / 4.6.2) (`7920a25`)
- GitHub Actions 기반 GH Pages 배포 워크플로 추가 (`a95765c`, `3b31092`)
  - `base: '/clara_front/'` 설정, 해시 라우팅 채택
  - 배포 URL: `https://micromy.github.io/clara_front/`
  - 현재 환경 보호 룰에서 허용 브랜치 수동 추가 필요

### 3-2. ARIAS 리브랜딩 + 기능 5종 (`1ff2bec`)
- `CLARA` → `ARIAS` 변경, 부제 삭제
- Selected Cells 패널에 **Metadata ↔ Simulation 토글** (el-switch, 컬럼 세트 교체)
- Simulation 모드에서 **Diff / Ratio 비교 연산** (el-segmented + alias 드롭다운으로 reference 선택)
- ChartView에 **클릭 토글 스플리터** (기본 7:3 ↔ 클릭 시 3:7)
- ChartDisplay에 `ResizeObserver` 추가 → 스플리터 변경 시 ECharts 자동 리사이즈
- ChartConfigPanel의 Generate/Save 버튼을 `el-form-item`으로 감싸 정렬 보정

### 3-3. Mock 데이터 파일화 + API 레이어 (`78238f1`)
- `public/data/cells.json`, `public/data/column-config.json` 파일 기반으로 전환
- `src/api/cells.js` 추상화 레이어 (`fetchCells`, `fetchColumnConfig`)
- `builderStore.init()` 비동기 초기화, loading/error 상태 노출
- 모든 컬럼·차트 옵션을 JSON에서 로드
- `scripts/generate-mock-data.js` + `npm run generate-mock` 으로 mock 재생성

### 3-4. 메타 / 시뮬 엔드포인트 분리 (`0001a76`)
- `cells.json` (메타, 43KB) + `simulations.json` (시뮬 결과, 159KB) 두 파일로 분리
- `fetchSimulations()` 추가 (+ future-proofing용 `fetchSimulation(cellId)`)
- `store.selectedCells` computed가 `simulations[cellId]`를 자동 merge → 컴포넌트 코드 무변경
- 실제 백엔드 `GET /cells` / `GET /simulations` 엔드포인트 구조에 대응

---

## 4. 데이터 아키텍처

### 4-1. 파일 구조
```
public/data/
  ├── cells.json              메타데이터 (18개 필드 × 100개 셀)
  ├── simulations.json        시뮬레이션 결과 (per-cell dict)
  └── column-config.json      컬럼/차트 옵션 정의

src/
  ├── api/
  │   └── cells.js            fetch 추상화 (백엔드 전환 시 이 파일만 수정)
  ├── mock/
  │   └── cellData.js         generator 유틸 (scripts에서만 사용)
  └── stores/
      └── builderStore.js     Pinia store — init(), allCells, simulations, config

scripts/
  └── generate-mock-data.js   mock JSON 재생성 스크립트
```

### 4-2. `cells.json` 스키마 (메타데이터)

배열 형태, 각 셀:
```json
{
  "id": 1,
  "cellName": "DFFX8_A7",
  "cellType": "DFF",          // INV | NAND | NOR | BUF | DFF | MUX | AOI | OAI | XOR | XNOR
  "evt": "EVT1",
  "driveStrength": "X8",      // X1 | X2 | X4 | X8 | X12 | X16
  "nanosheet": "NS4",         // NS3 | NS4 | NS5
  "library": "stdcell_svt",
  "gateLength": 14,
  "cpp": 48,
  "cellHeight": 6.5,
  "feolCorner": "FF",         // TT | FF | SS | FS | SF
  "beolCorner": "Cmin",       // Cmax | Cmin | Cnom
  "gdsOverlay": "nom",
  "vth": 0.35,
  "vdd": 0.75,
  "temp": 25,
  "lot": "LOT-A001",
  "wafer": "W03",
  "createTime": "2025-04-13"
}
```

### 4-3. `simulations.json` 스키마 (시뮬 결과)

`cellId(string)` → 시뮬 객체:
```json
{
  "1": {
    "iPeak": 33.47,           // μA — ivData의 max currentUA
    "iAvg": 16.06,            // μA — ivData의 평균 currentUA
    "delay": 2987.8,          // ps — (50/iPeak) * (gateLength/7) * 1000 (mock 공식)
    "ivData": [
      { "voltage": 0,    "currentMA": 0.0103, "currentUA": 10.32 },
      { "voltage": 0.05, "currentMA": 0.0070, "currentUA": 7.04 },
      ...                     // 0 ~ vdd, 0.05 스텝 (약 15개 포인트)
    ]
  },
  "2": { ... }
}
```

### 4-4. `column-config.json` 스키마

- `searchTableColumns[]` — CellSearchTable의 18개 컬럼
- `selectedCellsMetadataColumns[]` — Selected Cells 메타 모드 컬럼
- `selectedCellsSimulationColumns[]` — Selected Cells 시뮬 모드 컬럼 (numeric 플래그로 Diff/Ratio 대상 지정)
- `chartOptions.{chartTypes,xAxisOptions,yAxisOptions,groupingOptions}` — ChartConfigPanel 드롭다운 옵션

### 4-5. 데이터 흐름

```
앱 시작
  └─ App.vue onMounted → store.init()
       └─ Promise.all([
            fetchCells()         GET /data/cells.json
            fetchColumnConfig()  GET /data/column-config.json
            fetchSimulations()   GET /data/simulations.json
          ])

셀 선택 / 차트 생성 시
  └─ store.selectedCells (computed)
       └─ allCells.filter(id∈selected).map(c => ({ ...c, ...simulations[c.id] }))
                                                    ↑ 메타 + 시뮬 자동 merge
  └─ SelectedCellsPanel:  row.iPeak / row.iAvg / row.delay 로 접근
  └─ ChartDisplay:        cell.ivData 로 접근
```

---

## 5. 주요 화면 / 컴포넌트

### 5-1. Builder 탭 (`/builder/:id`)
- **CellSearchTable** — 100개 셀 페이징·검색. `store.searchTableColumns`로 18컬럼 렌더
- **SelectedCellsPanel** — 체크한 셀 목록, alias 편집, Metadata/Simulation 토글, Diff/Ratio 비교
- **ChartConfigPanel** — 차트 타입/축/그룹핑 드롭다운 + Generate Chart / Save Preset 버튼

### 5-2. Chart 탭 (`/chart/:builderId`)
- **ChartDisplay** — ECharts 기반 V-I 곡선. ResizeObserver로 자동 리사이즈
- **SourceDataTable** — 차트에 포함된 셀의 데이터 포인트 수 목록
- **Splitter** — 두 영역 경계 클릭 시 7:3 ↔ 3:7 토글

---

## 6. 로컬 개발

### 6-1. 설치 및 실행
```bash
npm install
npm run dev         # http://localhost:5173/clara_front/
```

### 6-2. 프로덕션 빌드
```bash
npm run build       # dist/ 생성
npm run preview     # dist/ 서빙 (검증용)
```

### 6-3. Mock 데이터 재생성
```bash
npm run generate-mock           # 기본 100개
npm run generate-mock 50        # 개수 지정
```
→ `public/data/cells.json` + `public/data/simulations.json` 두 파일 덮어쓰기

### 6-4. Mock 직접 편집
- `public/data/*.json` 을 손으로 편집해도 OK (`npm run dev` 에서 즉시 반영, 빌드 불필요)
- 컬럼 추가·제거는 `public/data/column-config.json` 편집만으로 가능

---

## 7. 배포

### 7-1. GitHub Pages 설정
- 워크플로: `.github/workflows/deploy.yml` (push 트리거: `main`, `claude/copy-clara-mockup-6dqyU`, `claude/arias-rebrand-and-features`)
- `actions/configure-pages@v5` with `enablement: true` — Pages 자동 활성화
- 배포 URL: **https://micromy.github.io/clara_front/**

### 7-2. 현재 블로커
GitHub `github-pages` 환경의 **Deployment branches 보호 룰**이 걸려 있어 feature 브랜치 배포가 차단됨. 해결 방법:

1. `https://github.com/Micromy/clara_front/settings/environments` → `github-pages` 선택
2. **Deployment branches** → **Add deployment branch rule** → `claude/arias-rebrand-and-features` 추가
3. Actions 탭에서 Re-run

※ 최종적으로는 `main`에 머지하여 main만 트리거로 남기는 것을 권장.

---

## 8. 알려진 이슈 / 향후 개선점

### 8-1. Chart X축 옵션과 `ivData` 포맷 미스매치
`column-config.json` 의 `xAxisOptions` 에는 `voltage`, `temp`, `vdd` 3개가 있지만, `ivData` 포인트는 `voltage`/`currentMA`/`currentUA` 키만 있음.

- 사용자가 X축으로 `temp`/`vdd`를 선택하면 `point.temp` / `point.vdd` 가 `undefined` → 차트가 빈 선으로 그려짐
- **수정 방향 예시:**
  - 시뮬 구조를 sweep 기반으로 확장: `cell.sweeps = [{ temp, vdd, points: [{v,i}] }, ...]`
  - 또는 xAxisOptions를 `voltage` 하나로 축소하고, 스칼라 시뮬값 비교용 bar chart 모드를 별도 추가

### 8-2. ECharts 번들 사이즈
- `dist/assets/index-*.js` ≈ 1.17MB (gzip 377KB)
- Vite가 500KB 경고 출력 중
- 향후 개선: `import { LineChart } from 'echarts/charts'` 형태의 **tree-shakable import**로 전환 + 코드 스플리팅

### 8-3. Comparison 모드 시 NumericFormatter 세밀도
Ratio 모드 값이 소수 4자리로 고정. 매우 작은 차이가 잘 안 보일 수 있음 — 사용자 피드백에 따라 조정 가능.

### 8-4. Selected Cells 패널의 "+ Add Derived Metric"
버튼만 존재, 클릭 시 동작 없음 (원본 mockup에서 미구현 상태 유지).

---

## 9. 백엔드 전환 계획

실제 API가 준비되면 **`src/api/cells.js` 한 파일만** 수정하면 됩니다. 스토어·컴포넌트 전부 무변경.

### 9-1. 직접 교체 (bulk 엔드포인트 있을 때)
```js
// src/api/cells.js
export async function fetchCells() {
  const res = await fetch('https://api.micromy.com/v1/cells', {
    headers: { Authorization: `Bearer ${token}` }
  })
  if (!res.ok) throw new Error(`Request failed: ${res.status}`)
  return res.json()
}

export async function fetchSimulations() {
  const res = await fetch('https://api.micromy.com/v1/simulations', {
    headers: { Authorization: `Bearer ${token}` }
  })
  return res.json()   // { cellId: {...} } 포맷 유지
}
```

### 9-2. Lazy fetch (per-cell 엔드포인트만 있을 때)
페이로드 큰 경우, 선택된 셀의 시뮬만 요청하도록 전환:

1. `src/api/cells.js` 에서 `fetchSimulation(cellId)` 를 per-cell 엔드포인트로 변경 (예약된 자리 이미 있음)
2. `builderStore`:
   - `simulations` 를 Map으로 유지 (이미 dict)
   - `watch(selectedCellIds, async (ids) => { for (const id of ids) if (!simulations[id]) simulations[id] = await fetchSimulation(id) })` 패턴 추가
3. `selectedCells` computed 의 merge 로직은 그대로 동작

### 9-3. 예상 백엔드 REST 인터페이스

| 메서드 | 경로 | 응답 |
|---|---|---|
| GET | `/api/cells` | 메타 배열 (`cells.json`과 동일 구조) |
| GET | `/api/cells/:id` | 단일 셀 메타 |
| GET | `/api/simulations` | `{ cellId: {iPeak,iAvg,delay,ivData} }` |
| GET | `/api/simulations/:cellId` | 단일 셀 시뮬 |
| GET | `/api/column-config` | 컬럼/차트 옵션 config |

---

## 10. 커밋 히스토리 (요약)

| Hash | 요약 |
|---|---|
| `0001a76` | 메타/시뮬 JSON 엔드포인트 분리 |
| `78238f1` | cells + column config를 public/data JSON + API 레이어로 리팩터 |
| `1ff2bec` | ARIAS 리브랜딩, 시뮬 토글, 차트 스플리터 (기능 5종) |
| `3b31092` | GH Pages auto-enable (configure-pages enablement) |
| `a95765c` | GH Pages 배포 워크플로 추가 |
| `7920a25` | Vite 4.5.5 + plugin-vue 4.6.2 다운그레이드 |
| `7c5d6cf` | park-sungil/clara-front-mockup에서 프로젝트 복사 |

---

## 11. 다음에 할 수 있는 것들

- [ ] `main`에 머지 + 환경 보호 룰 정리 → 공식 배포 URL 안정화
- [ ] X축 옵션 / `ivData` 포맷 미스매치 해결 (위 8-1 참고)
- [ ] Scalar 시뮬 값(`iPeak`/`iAvg`/`delay`)을 bar chart로 시각화하는 모드 추가
- [ ] 실제 백엔드 연동 — `src/api/cells.js` 에서 fetch URL 교체
- [ ] ECharts tree-shaking + 코드 스플리팅으로 번들 다이어트
- [ ] Save Preset / Add Derived Metric 버튼 실동작 구현
- [ ] 로딩 스피너 스타일 다듬기 / skeleton UI
- [ ] 반응형 (모바일/태블릿 레이아웃) 검토
