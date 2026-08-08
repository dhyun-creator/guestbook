(() => {
  const state = {
    page: 1,
    totalPages: 1,
    posts: [],
    isAdmin: false,
    editingPosts: new Set(),
    editingComments: new Set(),
    openComments: new Set(),
  };

  const postListEl = document.getElementById('postList');
  const paginationEl = document.getElementById('pagination');
  const postForm = document.getElementById('postForm');
  const adminLoginBtn = document.getElementById('adminLoginBtn');
  const adminLogoutBtn = document.getElementById('adminLogoutBtn');
  const adminBadge = document.getElementById('adminBadge');

  const modalRoot = document.getElementById('modalRoot');
  const modalMessage = document.getElementById('modalMessage');
  const modalPasswordInput = document.getElementById('modalPasswordInput');
  const modalError = document.getElementById('modalError');
  const modalCancelBtn = document.getElementById('modalCancelBtn');
  const modalConfirmBtn = document.getElementById('modalConfirmBtn');

  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(str) {
    if (!str) return '';
    return str.replace('T', ' ').slice(0, 16);
  }

  // ---------- 비밀번호 확인 모달 ----------
  function showPasswordModal(message) {
    modalMessage.textContent = message;
    modalPasswordInput.value = '';
    modalError.textContent = '';
    modalRoot.classList.remove('hidden');
    modalPasswordInput.focus();

    return new Promise((resolve) => {
      function cleanup(result) {
        modalRoot.classList.add('hidden');
        modalConfirmBtn.removeEventListener('click', onConfirm);
        modalCancelBtn.removeEventListener('click', onCancel);
        modalPasswordInput.removeEventListener('keydown', onKeydown);
        resolve(result);
      }
      function onConfirm() {
        const val = modalPasswordInput.value;
        if (!val) {
          modalError.textContent = '비밀번호를 입력해주세요.';
          return;
        }
        cleanup(val);
      }
      function onCancel() {
        cleanup(null);
      }
      function onKeydown(e) {
        if (e.key === 'Enter') onConfirm();
        if (e.key === 'Escape') onCancel();
      }
      modalConfirmBtn.addEventListener('click', onConfirm);
      modalCancelBtn.addEventListener('click', onCancel);
      modalPasswordInput.addEventListener('keydown', onKeydown);
    });
  }

  // ---------- API 호출 ----------
  async function apiFetch(url, options = {}) {
    const res = await fetch(url, options);
    let data = null;
    try {
      data = await res.json();
    } catch (e) {
      data = null;
    }
    if (!res.ok) {
      const message = (data && data.error) || '요청 처리 중 오류가 발생했습니다.';
      throw new Error(message);
    }
    return data;
  }

  async function fetchPosts(page) {
    const data = await apiFetch(`/api/posts?page=${page}`);
    state.posts = data.posts;
    state.page = data.page;
    state.totalPages = data.totalPages;
  }

  async function refresh(page = state.page) {
    await fetchPosts(page);
    render();
  }

  async function checkAdminSession() {
    const data = await apiFetch('/api/admin/session');
    state.isAdmin = data.isAdmin;
    renderAdminUI();
  }

  // ---------- 렌더링 ----------
  function renderAdminUI() {
    adminLoginBtn.classList.toggle('hidden', state.isAdmin);
    adminLogoutBtn.classList.toggle('hidden', !state.isAdmin);
    adminBadge.classList.toggle('hidden', !state.isAdmin);
  }

  function renderPagination() {
    paginationEl.innerHTML = '';
    for (let p = 1; p <= state.totalPages; p += 1) {
      const btn = document.createElement('button');
      btn.textContent = String(p);
      btn.dataset.page = String(p);
      if (p === state.page) btn.classList.add('active');
      paginationEl.appendChild(btn);
    }
  }

  function renderCommentItem(postId, comment) {
    const isEditing = state.editingComments.has(comment.id);
    if (isEditing) {
      return `
        <div class="comment-item">
          <form class="edit-form" data-role="edit-comment-form" data-id="${comment.id}">
            <div class="form-row">
              <input type="text" name="nickname" value="${escapeHtml(comment.nickname)}" maxlength="20" required />
              <input type="password" name="password" placeholder="비밀번호 확인" required />
            </div>
            <textarea name="content" maxlength="300" required>${escapeHtml(comment.content)}</textarea>
            <p class="form-error" data-role="error"></p>
            <div class="modal-actions">
              <button type="button" class="btn btn-ghost btn-sm" data-action="cancel-edit-comment">취소</button>
              <button type="submit" class="btn btn-primary btn-sm">저장</button>
            </div>
          </form>
        </div>
      `;
    }

    return `
      <div class="comment-item">
        <div class="comment-head">
          <span><strong>${escapeHtml(comment.nickname)}</strong> <span class="post-date">${formatDate(comment.created_at)}${comment.updated_at ? ' <span class=\"edited-tag\">(수정됨)</span>' : ''}</span></span>
        </div>
        <p class="comment-content">${escapeHtml(comment.content)}</p>
        <div class="comment-actions">
          <button class="btn btn-ghost btn-sm" data-action="edit-comment" data-id="${comment.id}">수정</button>
          <button class="btn btn-ghost btn-sm" data-action="delete-comment" data-id="${comment.id}">삭제</button>
          ${state.isAdmin ? `<button class="btn btn-danger btn-sm" data-action="admin-delete-comment" data-id="${comment.id}">관리자 삭제</button>` : ''}
        </div>
      </div>
    `;
  }

  function renderCommentsSection(post) {
    const isOpen = state.openComments.has(post.id);
    const count = post.comments.length;

    const commentsHtml = isOpen
      ? `
        <div class="comment-list">
          ${post.comments.map((c) => renderCommentItem(post.id, c)).join('') || '<p class="edited-tag">아직 답글이 없습니다.</p>'}
        </div>
        <form class="comment-form" data-role="comment-form" data-post-id="${post.id}">
          <div class="form-row">
            <input type="text" name="nickname" placeholder="이름/별명" maxlength="20" required />
            <input type="password" name="password" placeholder="비밀번호" required />
            <input type="password" name="passwordConfirm" placeholder="비밀번호 확인" required />
          </div>
          <textarea name="content" placeholder="답글을 남겨주세요 (최대 300자)" maxlength="300" required></textarea>
          <p class="form-error" data-role="error"></p>
          <div class="modal-actions">
            <button type="submit" class="btn btn-primary btn-sm">답글 등록</button>
          </div>
        </form>
      `
      : '';

    return `
      <div class="comments-section">
        <button class="comments-toggle" data-action="toggle-comments" data-id="${post.id}">
          ${isOpen ? '답글 접기' : `답글 ${count}개 보기`}
        </button>
        ${commentsHtml}
      </div>
    `;
  }

  function renderPostEditForm(post) {
    return `
      <form class="edit-form" data-role="edit-post-form" data-id="${post.id}">
        <div class="form-row">
          <input type="text" name="nickname" value="${escapeHtml(post.nickname)}" maxlength="20" required />
          <input type="password" name="password" placeholder="비밀번호 확인" required />
        </div>
        <textarea name="content" maxlength="500" required>${escapeHtml(post.content)}</textarea>
        <div class="form-row">
          <input type="file" name="image" accept="image/png,image/jpeg,image/gif,image/webp" />
          ${post.image_url ? `
            <label style="font-size:13px; display:flex; align-items:center; gap:4px;">
              <input type="checkbox" name="removeImage" /> 기존 이미지 삭제
            </label>` : ''}
        </div>
        <p class="form-error" data-role="error"></p>
        <div class="modal-actions">
          <button type="button" class="btn btn-ghost btn-sm" data-action="cancel-edit-post">취소</button>
          <button type="submit" class="btn btn-primary btn-sm">저장</button>
        </div>
      </form>
    `;
  }

  function renderPost(post) {
    const isEditing = state.editingPosts.has(post.id);

    const body = isEditing
      ? renderPostEditForm(post)
      : `
        <p class="post-content">${escapeHtml(post.content)}</p>
        ${post.image_url ? `<img class="post-image" src="${post.image_url}" alt="첨부 이미지" />` : ''}
        <div class="post-actions">
          <button class="btn btn-ghost btn-sm" data-action="edit-post" data-id="${post.id}">수정</button>
          <button class="btn btn-ghost btn-sm" data-action="delete-post" data-id="${post.id}">삭제</button>
          ${state.isAdmin ? `<button class="btn btn-danger btn-sm" data-action="admin-delete-post" data-id="${post.id}">관리자 삭제</button>` : ''}
        </div>
      `;

    return `
      <article class="post-card" data-post-card="${post.id}">
        <div class="post-card-head">
          <span class="post-nickname">${escapeHtml(post.nickname)}</span>
          <span class="post-date">${formatDate(post.created_at)}${post.updated_at ? ' <span class="edited-tag">(수정됨)</span>' : ''}</span>
        </div>
        ${body}
        ${renderCommentsSection(post)}
      </article>
    `;
  }

  function render() {
    renderAdminUI();
    if (state.posts.length === 0) {
      postListEl.innerHTML = '<p class="empty-state">아직 작성된 방명록이 없습니다. 첫 글을 남겨보세요!</p>';
    } else {
      postListEl.innerHTML = state.posts.map(renderPost).join('');
    }
    renderPagination();
  }

  // ---------- 글쓰기 폼 ----------
  postForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errorEl = postForm.querySelector('[data-role="error"]');
    errorEl.textContent = '';

    const formData = new FormData(postForm);
    if (formData.get('password') !== formData.get('passwordConfirm')) {
      errorEl.textContent = '비밀번호가 일치하지 않습니다.';
      return;
    }

    try {
      await apiFetch('/api/posts', { method: 'POST', body: formData });
      postForm.reset();
      await refresh(1);
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });

  // ---------- 목록 영역 이벤트 위임 ----------
  postListEl.addEventListener('click', async (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const { action, id } = btn.dataset;

    if (action === 'edit-post') {
      state.editingPosts.add(Number(id));
      render();
    } else if (action === 'cancel-edit-post') {
      const card = btn.closest('[data-post-card]');
      state.editingPosts.delete(Number(card.dataset.postCard));
      render();
    } else if (action === 'delete-post') {
      const password = await showPasswordModal('글을 삭제하려면 비밀번호를 입력해주세요. 답글도 함께 삭제됩니다.');
      if (password === null) return;
      try {
        await apiFetch(`/api/posts/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        await refresh();
      } catch (err) {
        alert(err.message);
      }
    } else if (action === 'admin-delete-post') {
      if (!confirm('[관리자] 이 글과 답글을 모두 삭제하시겠습니까?')) return;
      try {
        await apiFetch(`/api/admin/posts/${id}`, { method: 'DELETE' });
        await refresh();
      } catch (err) {
        alert(err.message);
      }
    } else if (action === 'toggle-comments') {
      const postId = Number(id);
      if (state.openComments.has(postId)) {
        state.openComments.delete(postId);
      } else {
        state.openComments.add(postId);
      }
      render();
    } else if (action === 'edit-comment') {
      state.editingComments.add(Number(id));
      render();
    } else if (action === 'cancel-edit-comment') {
      const item = btn.closest('.comment-item');
      const form = item.querySelector('form[data-role="edit-comment-form"]');
      if (form) state.editingComments.delete(Number(form.dataset.id));
      render();
    } else if (action === 'delete-comment') {
      const password = await showPasswordModal('답글을 삭제하려면 비밀번호를 입력해주세요.');
      if (password === null) return;
      try {
        await apiFetch(`/api/comments/${id}`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });
        await refresh();
      } catch (err) {
        alert(err.message);
      }
    } else if (action === 'admin-delete-comment') {
      if (!confirm('[관리자] 이 답글을 삭제하시겠습니까?')) return;
      try {
        await apiFetch(`/api/admin/comments/${id}`, { method: 'DELETE' });
        await refresh();
      } catch (err) {
        alert(err.message);
      }
    }
  });

  postListEl.addEventListener('submit', async (e) => {
    const form = e.target;

    if (form.dataset.role === 'edit-post-form') {
      e.preventDefault();
      const errorEl = form.querySelector('[data-role="error"]');
      errorEl.textContent = '';
      const formData = new FormData(form);
      formData.set('removeImage', form.removeImage && form.removeImage.checked ? 'true' : 'false');
      try {
        await apiFetch(`/api/posts/${form.dataset.id}`, { method: 'PUT', body: formData });
        state.editingPosts.delete(Number(form.dataset.id));
        await refresh();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    } else if (form.dataset.role === 'edit-comment-form') {
      e.preventDefault();
      const errorEl = form.querySelector('[data-role="error"]');
      errorEl.textContent = '';
      const formData = new FormData(form);
      const payload = Object.fromEntries(formData.entries());
      try {
        await apiFetch(`/api/comments/${form.dataset.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        state.editingComments.delete(Number(form.dataset.id));
        await refresh();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    } else if (form.dataset.role === 'comment-form') {
      e.preventDefault();
      const errorEl = form.querySelector('[data-role="error"]');
      errorEl.textContent = '';
      const formData = new FormData(form);
      if (formData.get('password') !== formData.get('passwordConfirm')) {
        errorEl.textContent = '비밀번호가 일치하지 않습니다.';
        return;
      }
      const payload = Object.fromEntries(formData.entries());
      const postId = form.dataset.postId;
      try {
        await apiFetch(`/api/posts/${postId}/comments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        state.openComments.add(Number(postId));
        await refresh();
      } catch (err) {
        errorEl.textContent = err.message;
      }
    }
  });

  // ---------- 페이지네이션 ----------
  paginationEl.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-page]');
    if (!btn) return;
    refresh(Number(btn.dataset.page));
  });

  // ---------- 관리자 로그인/로그아웃 ----------
  adminLoginBtn.addEventListener('click', async () => {
    const password = await showPasswordModal('관리자 비밀번호를 입력해주세요.');
    if (password === null) return;
    try {
      await apiFetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      state.isAdmin = true;
      render();
    } catch (err) {
      alert(err.message);
    }
  });

  adminLogoutBtn.addEventListener('click', async () => {
    await apiFetch('/api/admin/logout', { method: 'POST' });
    state.isAdmin = false;
    render();
  });

  // ---------- 초기화 ----------
  (async function init() {
    await checkAdminSession();
    await refresh(1);
  })();
})();
