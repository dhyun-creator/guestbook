const BASE = process.env.BASE_URL || 'https://guestbook-nine-nu.vercel.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

function assert(cond, msg) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  console.log(`OK: ${msg}`);
}

async function main() {
  const form = new FormData();
  form.set('nickname', '프로덕션테스터');
  form.set('password', 'pw1234');
  form.set('passwordConfirm', 'pw1234');
  form.set('content', 'Vercel 배포 확인용 글입니다');
  let res = await fetch(`${BASE}/api/posts`, { method: 'POST', body: form });
  let post = await res.json();
  assert(res.status === 201, `글 작성 성공 (got ${res.status}, body=${JSON.stringify(post)})`);
  const postId = post.id;

  res = await fetch(`${BASE}/api/posts`);
  let list = await res.json();
  assert(list.posts.some((p) => p.id === postId), '방금 쓴 글이 목록에 보임 (DB 영속성 확인)');

  res = await fetch(`${BASE}/api/posts/${postId}/comments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nickname: '답글러', password: 'rp1234', passwordConfirm: 'rp1234', content: '프로덕션 답글 테스트' }),
  });
  const comment = await res.json();
  assert(res.status === 201, `답글 작성 성공 (got ${res.status})`);

  res = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASSWORD }),
  });
  assert(res.status === 200, `관리자 로그인 성공 (got ${res.status})`);
  const setCookie = res.headers.get('set-cookie');
  const sessionCookie = setCookie.split(';')[0];

  res = await fetch(`${BASE}/api/admin/comments/${comment.id}`, {
    method: 'DELETE',
    headers: { Cookie: sessionCookie },
  });
  assert(res.status === 204, `관리자 답글 강제 삭제 성공 (got ${res.status})`);

  res = await fetch(`${BASE}/api/admin/posts/${postId}`, {
    method: 'DELETE',
    headers: { Cookie: sessionCookie },
  });
  assert(res.status === 204, `관리자 글 강제 삭제(테스트 데이터 정리) 성공 (got ${res.status})`);

  console.log('\n프로덕션 스모크 테스트 전부 통과');
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
