# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

로그인 없이 이름/별명 + 비밀번호로 글을 남기고 답글을 달 수 있는 방명록 웹앱. 요구사항은 `docs/requirements.md`, API 스펙은 `docs/api.md`에 문서화되어 있음.

## 명령어

```bash
npm install       # 의존성 설치
npm start          # 서버 실행 (http://localhost:3000)
npm run dev         # --watch 모드로 실행 (파일 변경 시 자동 재시작)
npm test            # test/smoke-test.js 실행 (서버가 먼저 떠 있어야 함)
```

- 최초 실행 전 `.env.example`을 `.env`로 복사하고 `ADMIN_PASSWORD`, `SESSION_SECRET`, `DATABASE_URL`(Postgres), `BLOB_READ_WRITE_TOKEN`(Vercel Blob)을 설정해야 함. **로컬 개발도 실제 Postgres/Blob 자격증명이 있어야 동작함** — sqlite 같은 로컬 파일 fallback 없음(`vercel env pull .env`로 Vercel에 연결된 값을 그대로 받아쓰는 게 표준 흐름).
- 단위 테스트 프레임워크는 없고, `test/smoke-test.js`가 실행 중인 서버에 대해 Node `fetch`로 전체 API 흐름(글/답글 CRUD, 비밀번호 검증, 관리자 강제삭제, cascade 삭제, 글자수 제한)을 순서대로 검증하는 통합 테스트임. 개별 케이스만 돌리는 기능은 없으므로 전체를 실행해서 확인.

## 배포

Vercel 서버리스 배포를 전제로 설계됨(`vercel.json`이 모든 요청을 `api/index.js` 서버리스 함수로 라우팅 → 내부에서 `src/app.js`의 Express 앱이 정적 파일/API를 모두 처리). 로컬 실행은 `server.js`가 같은 `src/app.js`를 `app.listen()`으로 띄우는 방식. **서버리스 파일시스템은 요청마다 초기화되므로 로컬 디스크에 상태를 쓰면 안 됨** — 이 제약 때문에 DB(Postgres)와 이미지 저장소(Vercel Blob)를 외부 서비스로 분리해둔 것이 지금 구조의 핵심 전제. 새 기능에서 파일시스템에 뭔가 쓰는 코드를 추가하지 말 것.

## 아키텍처

**스택**: 프론트엔드는 프레임워크 없는 순수 HTML/CSS/JS(`public/`), 백엔드는 Express(`src/app.js` + `src/`), DB는 `pg`(node-postgres)로 접속하는 Postgres(Neon, Vercel Postgres 통합). 과거에는 `node:sqlite` 로컬 파일 DB였으나 Vercel 서버리스 배포를 위해 마이그레이션됨 — 서버리스 함수는 로컬 파일에 영구적으로 쓸 수 없기 때문에 파일 기반 DB로 되돌리지 말 것.

**요청 흐름**: `public/app.js`가 `/api/*`를 `fetch`로 호출 → `src/app.js`가 라우터로 위임 → `src/routes/*.js`가 `src/db.js`의 `pool.query()`(비동기)로 Postgres 쿼리 실행 → 응답 전 항상 `password_hash` 제거 후 JSON 반환. `src/db.js`의 `ensureInit()`은 최초 요청 시 1회만 테이블을 생성하고 이후에는 캐시된 Promise를 재사용(요청마다 `CREATE TABLE` 재실행 방지).

**인증 모델 (두 가지가 공존)**
1. **글/답글 작성자**: 로그인 없음. 작성 시 `bcryptjs`(`src/hash.js`)로 해시된 비밀번호를 저장하고, 수정/삭제 요청마다 평문 비밀번호를 받아 매번 대조. 세션이나 토큰 없음.
2. **관리자**: `src/adminToken.js`가 `SESSION_SECRET`으로 서명한 무상태(stateless) 토큰을 `admin_token` 쿠키에 저장(`timestamp.HMAC서명` 형식, 2시간 만료). `POST /api/admin/login`이 `.env`의 `ADMIN_PASSWORD`와 대조 후 토큰 발급. `src/middleware/adminAuth.js`가 쿠키를 검증하며, 관리자는 작성자 비밀번호 없이 강제 삭제 가능. **`express-session`을 쓰지 않는 것이 의도적 결정** — 서버리스 함수는 인스턴스마다 메모리가 초기화되어 세션 스토어가 안 맞음. 세션으로 되돌리려면 최소한 DB 기반 세션 스토어가 필요함.

**데이터 모델**: `posts` ↔ `comments`는 1:N, `comments.post_id`에 `ON DELETE CASCADE` 외래키 설정(`src/db.js`) — 글 삭제 시 답글은 애플리케이션 코드가 아니라 DB 제약으로 자동 삭제됨. 답글은 단일 계층만 지원(답글에 대한 답글 없음).

**이미지 업로드**: `src/middleware/upload.js`가 `multer.memoryStorage()`로 파일을 메모리에 받아 `@vercel/blob`의 `put()`으로 업로드하고 공개 URL을 `image_url`에 저장(로컬 디스크에 쓰지 않음). 확장자 화이트리스트(jpg/jpeg/png/gif/webp)와 5MB 제한. 글마다 이미지 1장만 허용, 답글에는 이미지 없음. 글 삭제/수정 시 기존 이미지를 `deleteBlobIfExists()`로 정리하므로, 삭제 로직을 건드릴 때는 Blob 정리 코드도 같이 확인할 것.

**프론트엔드 렌더링 패턴** (`public/app.js`): 별도 프레임워크 없이 전역 `state` 객체(현재 페이지, 수정 중인 글/답글 id Set, 펼쳐진 답글 Set)를 두고, 상태가 바뀔 때마다 `#postList` 전체를 문자열 템플릿으로 다시 그리는 방식(`render()`). 개별 DOM 조작이 아니라 매번 전체 리렌더 + 이벤트 위임(postList에 클릭/서밋 리스너 하나씩)이므로, 새 인터랙션을 추가할 때도 이 패턴(상태 Set 추가 → 렌더 함수에서 분기 → 위임 리스너에 액션 분기 추가)을 따를 것. 사용자 입력은 `escapeHtml()`을 거쳐야 XSS를 막을 수 있음 — innerHTML에 새 필드를 넣을 때 빠뜨리지 말 것.

**비밀번호 확인 모달**: 삭제(글/답글)와 관리자 로그인은 `public/index.html`의 공용 `#modalRoot`를 `showPasswordModal()`(Promise 기반)로 재사용. 반면 글/답글 **수정**은 별도 모달 없이 인라인 편집 폼 안에 비밀번호 입력칸을 같이 두고 한 번에 제출하는 방식 — 두 흐름이 다르므로 새로 수정/삭제 기능을 추가할 때 어떤 패턴을 따를지 구분할 것.
