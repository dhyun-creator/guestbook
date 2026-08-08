const BASE = 'http://localhost:3000';

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  // 1. 글 작성
  const form = new FormData();
  form.set('nickname', '테스터');
  form.set('password', '1234');
  form.set('passwordConfirm', '1234');
  form.set('content', '첫 방명록 글입니다');
  let res = await fetch(`${BASE}/api/posts`, { method: 'POST', body: form });
  let post = await res.json();
  assert(res.status === 201, `글 작성 status 201 (got ${res.status})`);
  assert(post.nickname === '테스터', `닉네임 한글 인코딩 정상 (got ${post.nickname})`);
  assert(post.content === '첫 방명록 글입니다', `본문 한글 인코딩 정상 (got ${post.content})`);
  const postId = post.id;

  // 2. 목록 조회
  res = await fetch(`${BASE}/api/posts`);
  let list = await res.json();
  assert(list.posts.length === 1, '목록에 글 1개 존재');
  assert(list.posts[0].password_hash === undefined, 'password_hash가 응답에 노출되지 않음');

  // 3. 잘못된 비밀번호로 수정 시도 -> 403
  const badEdit = new FormData();
  badEdit.set('nickname', '테스터');
  badEdit.set('password', 'wrong');
  badEdit.set('content', '수정시도');
  res = await fetch(`${BASE}/api/posts/${postId}`, { method: 'PUT', body: badEdit });
  assert(res.status === 403, `잘못된 비밀번호 수정 거부 (got ${res.status})`);

  // 4. 올바른 비밀번호로 수정
  const editForm = new FormData();
  editForm.set('nickname', '테스터-수정');
  editForm.set('password', '1234');
  editForm.set('content', '수정된 방명록 내용');
  res = await fetch(`${BASE}/api/posts/${postId}`, { method: 'PUT', body: editForm });
  let updated = await res.json();
  assert(res.status === 200, `글 수정 성공 (got ${res.status})`);
  assert(updated.nickname === '테스터-수정', '수정된 닉네임 반영');
  assert(updated.updated_at !== null, '수정일시 기록됨');

  // 5. 답글 작성
  res = await fetch(`${BASE}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: '답글러', password: 'abcd', passwordConfirm: 'abcd', content: '답글입니다' }),
  });
  let comment = await res.json();
  assert(res.status === 201, `답글 작성 성공 (got ${res.status})`);
  assert(comment.content === '답글입니다', '답글 내용 정상');
  const commentId = comment.id;

  // 6. 답글 잘못된 비밀번호 삭제 시도
  res = await fetch(`${BASE}/api/comments/${commentId}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong' }),
  });
  assert(res.status === 403, `답글 잘못된 비밀번호 삭제 거부 (got ${res.status})`);

  // 7. 답글 수정
  res = await fetch(`${BASE}/api/comments/${commentId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: '답글러', password: 'abcd', content: '수정된 답글' }),
  });
  let updatedComment = await res.json();
  assert(res.status === 200, `답글 수정 성공 (got ${res.status})`);
  assert(updatedComment.content === '수정된 답글', '답글 내용 수정 반영');

  // 8. 관리자 로그인 실패 (틀린 비번)
  res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong-admin-pw' }),
  });
  assert(res.status === 401, `관리자 로그인 실패 처리 (got ${res.status})`);

  // 9. 관리자 로그인 성공 (세션 쿠키 필요 -> fetch는 기본적으로 쿠키 저장 안 함, 수동 처리)
  res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'change-me-please' }),
  });
  assert(res.status === 200, `관리자 로그인 성공 (got ${res.status})`);
  const setCookie = res.headers.get('set-cookie');
  assert(!!setCookie, '관리자 세션 쿠키 발급됨');
  const sessionCookie = setCookie.split(';')[0];

  // 10. 세션 쿠키 없이 관리자 삭제 시도 -> 401
  res = await fetch(`${BASE}/api/admin/comments/${commentId}`, { method: 'DELETE' });
  assert(res.status === 401, `세션 없이 관리자 삭제 거부 (got ${res.status})`);

  // 11. 세션 쿠키로 답글 강제 삭제 (비밀번호 없이)
  res = await fetch(`${BASE}/api/admin/comments/${commentId}`, {
    method: 'DELETE',
    headers: { Cookie: sessionCookie },
  });
  assert(res.status === 204, `관리자 답글 강제 삭제 성공 (got ${res.status})`);

  // 12. 원글 삭제 시 답글도 cascade 삭제되는지 확인용 답글 재생성
  res = await fetch(`${BASE}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: '답글러2', password: 'abcd', passwordConfirm: 'abcd', content: '캐스케이드 테스트' }),
  });
  const comment2 = await res.json();

  res = await fetch(`${BASE}/api/admin/posts/${postId}`, {
    method: 'DELETE',
    headers: { Cookie: sessionCookie },
  });
  assert(res.status === 204, `관리자 글 강제 삭제 성공 (got ${res.status})`);

  res = await fetch(`${BASE}/api/comments/${comment2.id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'abcd' }),
  });
  assert(res.status === 404, `원글 삭제 시 답글 cascade 삭제 확인 (got ${res.status}, expected 404)`);

  // 13. 관리자 로그아웃
  res = await fetch(`${BASE}/api/admin/logout`, {
    method: 'POST',
    headers: { Cookie: sessionCookie },
  });
  assert(res.status === 200, `관리자 로그아웃 성공 (got ${res.status})`);

  // 14. 글자수 제한 검증 (닉네임 20자 초과)
  const longForm = new FormData();
  longForm.set('nickname', 'a'.repeat(21));
  longForm.set('password', '1234');
  longForm.set('passwordConfirm', '1234');
  longForm.set('content', 'test');
  res = await fetch(`${BASE}/api/posts`, { method: 'POST', body: longForm });
  assert(res.status === 400, `닉네임 20자 초과 시 거부 (got ${res.status})`);

  console.log('\n모든 스모크 테스트 통과');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
