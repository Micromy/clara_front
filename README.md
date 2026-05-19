# CLARA Front

Vue 3 + Element Plus + ECharts로 만든 반도체 셀 라이브러리 분석 프론트엔드.
사내 Django REST API와 연동.

## Quickstart

```bash
npm install
npm run dev       # http://localhost:5173/
npm run build     # 프로덕션 빌드 (dist/)
npm run preview   # 빌드 결과 로컬 확인
```

## 환경 변수

프로젝트 루트에 `.env` 파일 (gitignored):

```ini
VITE_API_BASE_URL=http://...-prod...samsungds.net
```

빌드 타임에 inline됨. 사내 배포는 ConfigMap → BuildConfig env로 같은 값을 주입.
샘플은 `.env.example` 참고. 값 바꾼 뒤엔 dev server 재시작.

## 배포

- 사내 Docker 환경. `Dockerfile`에서 `npm run build` → nginx 컨테이너로 정적 자산 서빙
- SPA fallback은 `nginx.conf`의 `try_files $uri $uri/ /index.html;`로 처리

## 문서

- [API.md](API.md) — 백엔드 REST 계약 (현재 모델)
- [PROGRESS.md](PROGRESS.md) — 기능/아키텍처 스냅샷
- [CLAUDE.md](CLAUDE.md) — 코딩 가이드라인
- [docs/](docs/) — 초기 설계 / 구현 회고 (역사적 자료)

## 디렉토리

```
src/
├── api/           REST 호출 (snake/camel 변환 포함)
├── config/        column-config.json (UI 메타)
├── stores/        Pinia store
├── views/         AppView, BuilderView, ChartView
├── components/    builder / chart 하위 컴포넌트
├── composables/   드래그 선택, 팝업 윈도우
└── layouts/       AppLayout
```
