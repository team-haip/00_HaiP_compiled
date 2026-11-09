# Self-Maintaining GEO Agent (MVP)

AI 검색(OpenAI·Gemini API)에서 브랜드가 어떻게 보이는지 모니터링하고, 인용 출처를 분석하고, 기존 페이지의 개선 HTML 을 생성하는 GEO(Generative Engine Optimization) 유지보수 에이전트.

워크플로: **Monitor → Analyze → Optimize → Deploy(검토용 HTML 산출) → Verify → Repeat**

> 모든 가시성 수치는 **API-based AI Search Visibility** 다. ChatGPT·Gemini 소비자 앱의 실제 노출 데이터가 아니다. 생성된 HTML 은 검토용 제안이며 고객 사이트에 자동 배포하지 않는다.

## 설치

```bash
npm install
cp .env.example .env        # 키 입력
npx prisma migrate dev      # SQLite dev.db 생성
npm run dev                 # http://localhost:3000
```

`npm run build` 로 프로덕션 빌드 확인.

## API 키 설정 (`.env`)

| 변수 | 용도 |
|---|---|
| `OPENAI_API_KEY` | Responses API `web_search` 도구로 검색 모니터링, 구조화 출력(브랜드 추출·콘텐츠 분석·최적화) |
| `GEMINI_API_KEY` | `@google/genai` `generateContent` + `googleSearch` 그라운딩. OpenAI 키가 없으면 LLM 작업도 Gemini 가 맡는다 |
| `OPENAI_MODEL` / `GEMINI_MODEL` | 기본 `gpt-6-astra` / `gemini-3.8-flash` (작성 시점 공식 문서 기준). 계정에 없으면 바꾼다 |
| `CRON_SECRET` | `POST /api/cron/weekly` 보호용 Bearer 토큰 |
| `DEMO_MODE=1` | 강제 데모 모드 |

키가 둘 다 없으면 자동으로 **데모 모드**: 모니터링은 `[DEMO MODE]` 라벨이 붙은 고정 문장을 저장하고(인용 없음, model=`demo`), 콘텐츠 분석은 휴리스틱 검사만, 최적화 생성은 비활성. 화면 상단에 데모 배너가 뜬다. 키를 넣고 재시작하면 실제 API 호출로 바뀐다.

## 화면

| 경로 | 내용 |
|---|---|
| `/onboarding` | 회사·브랜드·사이트·경쟁사·프롬프트 등록 → `/dashboard` 로 이동 |
| `/dashboard` | KPI(언급률·인용률·프롬프트 수·페이지 수), 추이·제공자 비교·경쟁사 비교·인용 도메인 차트, 활동 로그 |
| `/visibility` | Run Monitoring. Mention Rate(언급 답변 ÷ 평가 답변) 와 Share of Mentions(브랜드 언급 ÷ 추적 브랜드 전체 언급) 구분, 프롬프트별 결과·원문 |
| `/citations` | 상위 인용 도메인(수·비중·전 회차 대비 Δ), 인용률 추이, 인용 상세(URL·프롬프트·제공자·시각·답변) |
| `/optimization` | URL → Analyze Content → Generate Optimization → 원본/최적화 split 미리보기·소스·리포트, 복사·다운로드, 이력 |
| `/agents` | Run Agents Now, 실행 이력·단계·오류·주간 요약 |
| `/settings` | 프로젝트 수정, 프롬프트 추가·삭제·비활성, 주간 스케줄(DB 저장) |

## API

```
GET/POST/PUT /api/projects      GET /api/projects/:id
POST/PATCH/DELETE /api/prompts
POST /api/monitor/run           GET /api/monitor/results[?runId=]
GET  /api/citations
POST /api/content/analyze       POST /api/content/optimize       GET /api/content/history[?id=]
POST /api/agents/run            GET /api/agents/history
POST /api/cron/weekly           (Authorization: Bearer $CRON_SECRET)
PUT  /api/schedule              GET /api/dashboard
```

## 주간 자동화

- 기본 스케줄 `0 9 * * 1` Asia/Seoul 이 `Schedule` 테이블에 저장된다. **앱 자체는 타이머를 돌리지 않는다.** 외부 스케줄러가 엔드포인트를 호출해야 실제로 주간 실행된다.
- 로컬에서는 Agent Runs 의 **Run Agents Now** 버튼 또는:
  ```bash
  curl -X POST http://localhost:3000/api/cron/weekly -H "Authorization: Bearer $CRON_SECRET"
  ```
- 외부 스케줄러 예: crontab `0 9 * * 1 curl -X POST https://<host>/api/cron/weekly -H "Authorization: Bearer <secret>"`, 또는 Vercel Cron(`vercel.json` 의 `crons`, 요청 헤더에 CRON_SECRET), GitHub Actions `schedule`.
- 멱등성: cron 트리거는 프로젝트별 ISO 주(`periodKey`, 예 `2026-W46`) 당 1회만 실행하고 재호출엔 `duplicate: true` 를 돌려준다. 수동 실행은 횟수 제한 없음. 같은 프로젝트에 동시 실행은 거부.
- 이전 성공 회차가 없으면 baseline 리포트. 지표 차이가 10%p 미만이면 "within noise" 로 표시하고 악화로 단정하지 않는다.

## 구현 메모

- 브랜드 언급 판정: LLM 구조화 추출(별칭·도메인 포함) + 결정적 문자열 매칭 교차검증. 둘이 어긋나거나 confidence=low 면 `uncertain`.
- 인용: OpenAI `url_citation` 어노테이션, Gemini `groundingMetadata.groundingChunks[].web` 만 집계. 답변 본문의 URL 은 인용으로 세지 않는다. Gemini 의 vertexaisearch 리다이렉트 URL 은 HEAD 요청으로 실제 URL 을 복원한다.
- 페이지 수집: 공개 http/https 만, DNS 해석 뒤 사설 IP 차단, 15초 타임아웃, 2MB 상한, 403/429 는 "차단됨" 메시지. 크롤한 본문·AI 답변은 `<<<UNTRUSTED>>>` 로 감싸 지시로 해석하지 않게 한다.
- 최적화 프롬프트 규칙: 원문 사실 보존, 수치·가격·후기 생성 금지, 원문에서 Q/A 2개 이상 확보될 때만 FAQ, 의료·금융·법률은 regulated claim 추가 금지, 순위 상승 약속 금지.
- 구조화 서버 로그: `console.log(JSON)` 한 줄 형식(event, ts, …).

## 검증 상태 (2026-11-09)

- `npm install`, `npx prisma migrate dev`, `npm run lint`, `npm run build`, `npm run dev` 통과.
- 데모 모드(키 없음)로 온보딩 → 모니터링 → 페이지 분석 → 에이전트 실행 → cron 멱등성 → 대시보드까지 API 로 확인. 데이터는 `prisma/dev.db` 에 남아 재시작 후 유지된다.
- 실제 키(`gpt-6-astra`, `gemini-3.8-flash`)로 모니터링 3프롬프트×2제공자 6/6 성공, 인용 22건(Gemini 리다이렉트 → 실제 도메인 복원 확인), 위키백과 「Dental implant」 분석(medical 판정)·최적화 HTML 생성, 주간 에이전트 전 단계 완료까지 확인(2026-11-09, 로컬 dev.db).
- 키를 넣기 전 데모 실행은 실제 모드 추이에서 제외된다(`RunMetrics.demo`).
- 원본 HTML 은 200k자, 최적화 입력은 60k자에서 자른다. 위키백과처럼 긴 페이지는 앞부분만 재작성되며 리포트의 preserved_facts_note 에 그 사실이 적힌다.

## 미완성·축소

- 단일 프로젝트(첫 프로젝트만 사용). 다중 프로젝트·인증 없음.
- 중복 실행 방지는 프로세스 내 메모리 락 + AgentRun `running` 상태 확인. 다중 인스턴스 배포면 DB 락 필요.
- 주간 에이전트의 Optimize 단계는 등록된 페이지 최대 3개만 재분석·재생성(비용 상한).
- 실패 재시도는 2회 고정, 지수 백오프 단순.
- 인용 변화 비교는 상위 15개 도메인 기준.
