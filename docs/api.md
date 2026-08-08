# 방명록 CRUD API 문서

- 문서 버전: 1.0
- 작성일: 2026-08-08
- 대상 코드: `server.js`, `src/routes/posts.js`, `src/routes/comments.js`, `src/routes/admin.js`

---

## 1. 개요

### 1.1 Base URL

```
http://localhost:3000/api
```

### 1.2 인증 방식

- **일반 글/답글**: 별도 로그인 없음. 작성 시 설정한 **비밀번호**를 수정/삭제 요청 본문에 함께 보내 서버가 대조(bcrypt)하는 방식.
- **관리자**: `POST /api/admin/login` 으로 로그인하면 세션 쿠키(`connect.sid`, httpOnly)가 발급된다. 이후 관리자 전용 API는 이 쿠키를 함께 전송해야 한다. (요청 시 `credentials: 'include'` 또는 쿠키 자동 전송 필요)

### 1.3 공통 응답 형식

- 성공 시: 리소스 JSON 또는 목록 JSON 반환 (204 No Content인 경우 본문 없음)
- 실패 시: 아래 형식의 JSON과 함께 4xx 상태 코드 반환

```json
{ "error": "에러 메시지" }
```

### 1.4 공통 상태 코드

| 상태 코드 | 의미 |
|---|---|
| 200 | 조회/수정 성공 |
| 201 | 생성 성공 |
| 204 | 삭제 성공 (응답 본문 없음) |
| 400 | 필수값 누락, 글자 수 초과, 비밀번호 확인 불일치 등 유효성 오류 |
| 401 | 관리자 인증 필요 (세션 없음/만료) 또는 관리자 로그인 비밀번호 불일치 |
| 403 | 작성자 비밀번호 불일치 (수정/삭제 시도) |
| 404 | 대상 글/답글이 존재하지 않음 |

### 1.5 공통 글자 수 제한

| 필드 | 제한 |
|---|---|
| 닉네임(글/답글 공통) | 최대 20자 |
| 글 본문(content) | 최대 500자 |
| 답글 본문(content) | 최대 300자 |
| 첨부 이미지 | 1장, jpg/jpeg/png/gif/webp, 최대 5MB |

### 1.6 응답에서 항상 제외되는 필드

- `password_hash`는 어떤 응답에도 절대 포함되지 않는다(서버에서 항상 제거 후 응답).

---

## 2. 글(Posts) API

### 2.1 글 목록 조회

```
GET /api/posts?page={page}
```

- `page`: 1부터 시작하는 페이지 번호 (기본값 1, 페이지당 10개)
- 최신 작성글이 먼저 오도록 정렬(`created_at DESC`)되며, 각 글에는 해당 글의 답글 목록이 함께 포함된다.

**응답 200**

```json
{
  "posts": [
    {
      "id": 1,
      "nickname": "홍길동",
      "content": "안녕하세요! 방명록 테스트입니다.",
      "image_url": "/uploads/1735-abcd1234.png",
      "created_at": "2026-08-08 09:30:00",
      "updated_at": null,
      "comments": [
        {
          "id": 5,
          "post_id": 1,
          "nickname": "방문객",
          "content": "좋은 방명록이네요!",
          "created_at": "2026-08-08 09:31:00",
          "updated_at": null
        }
      ]
    }
  ],
  "page": 1,
  "totalPages": 3,
  "total": 25
}
```

---

### 2.2 글 작성

```
POST /api/posts
Content-Type: multipart/form-data
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| nickname | string | O | 이름/별명, 최대 20자 |
| password | string | O | 비밀번호 |
| passwordConfirm | string | O | 비밀번호 확인 (password와 일치해야 함) |
| content | string | O | 본문, 최대 500자 |
| image | file | X | 첨부 이미지 1장 (jpg/jpeg/png/gif/webp, 5MB 이하) |

**응답 201**

```json
{
  "id": 12,
  "nickname": "홍길동",
  "content": "첫 방명록 글입니다",
  "image_url": null,
  "created_at": "2026-08-08 10:00:00",
  "updated_at": null,
  "comments": []
}
```

**에러 예시 (400)**

```json
{ "error": "비밀번호가 일치하지 않습니다." }
```

가능한 400 오류: 닉네임 누락/20자 초과, 본문 누락/500자 초과, 비밀번호 누락, 비밀번호 확인 불일치, 이미지 형식/용량 초과(`이미지 용량은 최대 5MB까지 업로드 가능합니다.`)

---

### 2.3 글 수정

```
PUT /api/posts/:id
Content-Type: multipart/form-data
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| nickname | string | O | 수정할 이름/별명 |
| password | string | O | 작성 시 설정한 비밀번호 (본인 확인용) |
| content | string | O | 수정할 본문 |
| image | file | X | 새 이미지로 교체 (전송 시 기존 이미지 파일은 삭제됨) |
| removeImage | string("true") | X | 기존 이미지를 삭제하고 첨부 없음 상태로 변경 (image 필드 미전송 시에만 적용) |

**응답 200**: 수정된 글 객체 + `comments` 배열 (2.1과 동일한 형태), `updated_at`에 수정 시각이 채워짐

**에러**

| 상태 | 상황 |
|---|---|
| 404 | `{ "error": "글을 찾을 수 없습니다." }` |
| 403 | `{ "error": "비밀번호가 일치하지 않습니다." }` |
| 400 | 닉네임/본문 유효성 오류 |

---

### 2.4 글 삭제

```
DELETE /api/posts/:id
Content-Type: application/json
```

```json
{ "password": "작성 시 설정한 비밀번호" }
```

- 삭제 시 첨부 이미지 파일도 함께 삭제된다.
- 해당 글에 달린 **모든 답글도 함께 삭제**된다(DB 외래키 `ON DELETE CASCADE`).

**응답**: 204 (본문 없음)

**에러**: 404(글 없음), 403(비밀번호 불일치)

---

## 3. 답글(Comments) API

답글은 단일 계층 구조이며, 답글에 대한 답글(대댓글)은 지원하지 않는다.

### 3.1 답글 작성

```
POST /api/posts/:postId/comments
Content-Type: application/json
```

```json
{
  "nickname": "방문객",
  "password": "abcd1234",
  "passwordConfirm": "abcd1234",
  "content": "좋은 글 감사합니다!"
}
```

| 필드 | 필수 | 설명 |
|---|---|---|
| nickname | O | 최대 20자 |
| password | O | 비밀번호 |
| passwordConfirm | O | password와 일치해야 함 |
| content | O | 최대 300자 |

**응답 201**

```json
{
  "id": 8,
  "post_id": 12,
  "nickname": "방문객",
  "content": "좋은 글 감사합니다!",
  "created_at": "2026-08-08 10:05:00",
  "updated_at": null
}
```

**에러**: 404(원글 없음), 400(유효성 오류/비밀번호 확인 불일치)

---

### 3.2 답글 수정

```
PUT /api/comments/:id
Content-Type: application/json
```

```json
{
  "nickname": "방문객",
  "password": "abcd1234",
  "content": "수정된 답글 내용"
}
```

**응답 200**: 수정된 답글 객체 (3.1 응답과 동일한 형태), `updated_at`에 수정 시각 반영

**에러**: 404(답글 없음), 403(비밀번호 불일치), 400(유효성 오류)

---

### 3.3 답글 삭제

```
DELETE /api/comments/:id
Content-Type: application/json
```

```json
{ "password": "abcd1234" }
```

**응답**: 204 (본문 없음)

**에러**: 404(답글 없음), 403(비밀번호 불일치)

---

## 4. 관리자(Admin) API

관리자는 비밀번호 분실 또는 부적절한 글을 처리하기 위해 작성자 비밀번호 없이 모든 글/답글을 강제 삭제할 수 있다.

### 4.1 관리자 로그인

```
POST /api/admin/login
Content-Type: application/json
```

```json
{ "password": "환경변수 ADMIN_PASSWORD 값" }
```

**응답 200**: `{ "isAdmin": true }` (세션 쿠키 발급, 유효기간 2시간)

**에러 401**: `{ "error": "관리자 비밀번호가 올바르지 않습니다." }`

---

### 4.2 관리자 로그아웃

```
POST /api/admin/logout
```

**응답 200**: `{ "isAdmin": false }`

---

### 4.3 관리자 세션 확인

```
GET /api/admin/session
```

**응답 200**: `{ "isAdmin": true }` 또는 `{ "isAdmin": false }` — 페이지 로드 시 관리자 UI 노출 여부 판단에 사용

---

### 4.4 글 강제 삭제 (관리자)

```
DELETE /api/admin/posts/:id
```

- 관리자 세션 쿠키 필요
- 작성자 비밀번호 없이 즉시 삭제, 첨부 이미지 파일과 하위 답글도 함께 삭제됨

**응답**: 204

**에러**: 401(관리자 미인증, `{ "error": "관리자 인증이 필요합니다." }`), 404(글 없음)

---

### 4.5 답글 강제 삭제 (관리자)

```
DELETE /api/admin/comments/:id
```

- 관리자 세션 쿠키 필요, 비밀번호 불필요

**응답**: 204

**에러**: 401(관리자 미인증), 404(답글 없음)

---

## 5. 엔드포인트 요약

| 기능 | Method | URL | 인증 |
|---|---|---|---|
| 글 목록 조회 | GET | `/api/posts?page=1` | 없음 |
| 글 작성 | POST | `/api/posts` | 없음 |
| 글 수정 | PUT | `/api/posts/:id` | 작성자 비밀번호 |
| 글 삭제 | DELETE | `/api/posts/:id` | 작성자 비밀번호 |
| 답글 작성 | POST | `/api/posts/:postId/comments` | 없음 |
| 답글 수정 | PUT | `/api/comments/:id` | 작성자 비밀번호 |
| 답글 삭제 | DELETE | `/api/comments/:id` | 작성자 비밀번호 |
| 관리자 로그인 | POST | `/api/admin/login` | 관리자 비밀번호 |
| 관리자 로그아웃 | POST | `/api/admin/logout` | 세션 |
| 관리자 세션 확인 | GET | `/api/admin/session` | 없음 |
| 글 강제 삭제 | DELETE | `/api/admin/posts/:id` | 관리자 세션 |
| 답글 강제 삭제 | DELETE | `/api/admin/comments/:id` | 관리자 세션 |

---

## 6. 데이터 모델

`docs/requirements.md` §5 데이터 모델 초안과 동일하며, API 응답에서는 `password_hash` 필드가 제외된 형태로 노출된다.

### Post

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 글 ID |
| nickname | string | 이름/별명 |
| content | string | 본문 |
| image_url | string \| null | 첨부 이미지 경로 (`/uploads/...`) |
| created_at | string | 작성일시 (`YYYY-MM-DD HH:mm:ss`) |
| updated_at | string \| null | 수정일시, 수정 이력 없으면 null |
| comments | Comment[] | 목록 조회(2.1) 및 글 수정(2.3) 응답에만 포함 |

### Comment

| 필드 | 타입 | 설명 |
|---|---|---|
| id | number | 답글 ID |
| post_id | number | 원글 ID |
| nickname | string | 이름/별명 |
| content | string | 답글 본문 |
| created_at | string | 작성일시 |
| updated_at | string \| null | 수정일시 |
