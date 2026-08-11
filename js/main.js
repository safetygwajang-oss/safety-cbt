/* ============================================
   안전과장 CBT - 홈 대시보드
   main.js (v2 - 탭 분리 + 중복기출 입장코드)
   ============================================ */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  /* ============================================
     🔑 중복기출 입장코드 — 아래 값만 바꾸세요
     ============================================ */
  const ACCESS_CODE = '1221';

  /* 인증 유지 방식
     sessionStorage → 브라우저 탭을 닫으면 다시 입력
     localStorage   → 계속 기억 (바꾸고 싶으면 아래 단어만 교체) */
  const codeStore = sessionStorage;
  const CODE_KEY = 'dup-access-ok';

  // data/index.json 로드 실패 시 임시 목록
  const FALLBACK_EXAMS = [
    {
      id: '2022-04-24',
      title: '산업안전기사 필기',
      date: '2022년 4월 24일',
      questions: 120,
      duration: 150,
      subjects: ['안전관리론', '인간공학', '기계', '전기', '화학', '건설']
    }
  ];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    renderStats();
    renderBookmarks();
    renderRecent();
    await renderExamList();
    bindEvents();
    bindTabs();
    bindCodeModal();
  }

  /* ===== 중복기출 여부 판별 ===== */
  function isDup(exam) {
    const key = `${exam.id || ''} ${exam.title || ''}`;
    return /중복기출|2021-2026|2021~2026/.test(key);
  }

  function isUnlocked() {
    return codeStore.getItem(CODE_KEY) === '1';
  }

  // ===== 통계 카드 =====
  function renderStats() {
    const stats = window.Storage && window.Storage.getStats
      ? window.Storage.getStats()
      : { totalSessions: 0, avgScore: 0, bookmarkCount: 0 };

    $('stat-sessions').textContent = stats.totalSessions;
    $('stat-avg').innerHTML = `${stats.avgScore}<span style="font-size:1rem;">점</span>`;
    $('stat-bookmarks').textContent = stats.bookmarkCount;
  }

  // ===== 북마크 모아보기 =====
  function renderBookmarks() {
    const list = window.Storage && window.Storage.getBookmarkList
      ? window.Storage.getBookmarkList()
      : [];

    if (list.length === 0) {
      $('bookmark-section').style.display = 'none';
      return;
    }

    $('bookmark-section').style.display = 'block';
    $('bookmark-count').textContent = `(${list.length})`;

    const container = $('bookmark-list');
    container.innerHTML = '';

    list.slice(0, 12).forEach(bm => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.innerHTML = `
        <div class="bm-header">
          <span>📅 ${escapeHtml(bm.examId)} · ${bm.no}번</span>
          <span style="color:var(--gray-400);">${bm.subject ? escapeHtml(bm.subject) : ''}</span>
        </div>
        <div class="bm-text">${escapeHtml((bm.question || '').substring(0, 100))}${(bm.question || '').length > 100 ? '...' : ''}</div>
      `;
      item.addEventListener('click', () => {
        window.location.href = `exam.html?exam=${encodeURIComponent(bm.examId)}&jumpTo=${bm.no}`;
      });
      container.appendChild(item);
    });

    if (list.length > 12) {
      const more = document.createElement('div');
      more.className = 'bookmark-item';
      more.style.background = 'var(--gray-50)';
      more.style.textAlign = 'center';
      more.style.color = 'var(--gray-500)';
      more.innerHTML = `<div style="padding:16px;">외 ${list.length - 12}개 더...</div>`;
      container.appendChild(more);
    }
  }

  // ===== 최근 응시 결과 =====
  function renderRecent() {
    const sessions = window.Storage && window.Storage.getAllSessions
      ? window.Storage.getAllSessions()
      : {};

    const arr = Object.entries(sessions)
      .map(([id, data]) => ({ sessionId: id, ...data }))
      .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0))
      .slice(0, 5);

    if (arr.length === 0) {
      $('recent-section').style.display = 'none';
      return;
    }

    $('recent-section').style.display = 'block';
    const container = $('recent-list');
    container.innerHTML = '';

    arr.forEach(s => {
      const card = document.createElement('div');
      card.className = 'exam-card';

      const date = new Date(s.submittedAt || Date.now()).toLocaleString('ko-KR', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      const scoreColor = s.score >= 60 ? 'var(--success)' : (s.score >= 40 ? 'var(--warning)' : 'var(--danger)');
      const modeText = s.mode === 'wrong' ? '🔁 오답' : (s.mode === 'study' ? '📖 학습' : '🎯 실전');

      card.innerHTML = `
        <h3>${escapeHtml(s.examTitle || s.examId)}</h3>
        <div class="meta">📅 ${date} · ${modeText}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
          <span class="badge">${s.correct} / ${s.total}</span>
          <span style="font-size:1.4rem; font-weight:700; color:${scoreColor};">${s.score}점</span>
        </div>
      `;
      card.addEventListener('click', () => {
        window.location.href = `result.html?session=${encodeURIComponent(s.sessionId)}`;
      });
      container.appendChild(card);
    });
  }

  // ===== 목록 로드 후 두 그룹으로 분리 =====
  async function renderExamList() {
    let exams = [];

    try {
      const res = await fetch('data/index.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          exams = data;
        } else if (data && Array.isArray(data.exams)) {
          exams = data.exams.map(item => (typeof item === 'string' ? { id: item, title: item } : item));
        }
      }
    } catch (e) {
      console.log('data/index.json 로드 실패, fallback 사용:', e);
    }

    if (exams.length === 0) exams = FALLBACK_EXAMS;

    // 응시 기록
    const sessions = window.Storage && window.Storage.getAllSessions
      ? window.Storage.getAllSessions()
      : {};
    const attempted = new Set(Object.values(sessions).map(s => s.examId));

    // 진행중 기록
    const inProgress = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('exam-progress-') && !key.includes('-wrong-')) {
        const examId = key.replace('exam-progress-', '');
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.answers && Object.keys(data.answers).length > 0) inProgress.add(examId);
        } catch (e) {}
      }
    }

    // 그룹 분리
    const dupExams = exams.filter(isDup);
    const roundExams = exams.filter(e => !isDup(e));

    // 회차는 최신순 정렬
    roundExams.sort((a, b) => (b.id || '').localeCompare(a.id || ''));

    paint($('exam-list'), roundExams, attempted, inProgress, '등록된 회차가 없습니다.');
    paint($('dup-list'), dupExams, attempted, inProgress, '등록된 중복기출이 없습니다.');

    if (isUnlocked()) unlockDup();
  }

  function paint(container, list, attempted, inProgress, emptyMsg) {
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1; padding:30px; text-align:center; color:var(--gray-500);">📂 ${emptyMsg}</div>`;
      return;
    }

    list.forEach(exam => {
      const card = document.createElement('div');
      card.className = 'exam-card';

      let badges = '';
      if (inProgress.has(exam.id)) badges += '<span class="badge" style="background:#fef3c7; color:#92400e;">▶ 진행중</span>';
      if (attempted.has(exam.id)) badges += '<span class="badge done">✅ 응시완료</span>';
      if (exam.questions) badges += `<span class="badge">${exam.questions}문항</span>`;
      if (exam.duration) badges += `<span class="badge">⏱ ${exam.duration}분</span>`;

      let subjectsHtml = '';
      if (exam.subjects && exam.subjects.length > 0) {
        const names = exam.subjects.map(s => (typeof s === 'string' ? s : s.name)).join(' · ');
        subjectsHtml = `<div style="font-size:0.8rem; color:var(--gray-500); margin-top:8px; line-height:1.4;">${escapeHtml(names)}</div>`;
      }

      const dateText = exam.date ? `📅 ${escapeHtml(exam.date)}` : '';

      card.innerHTML = `
        <h3>${escapeHtml(exam.title || exam.id)}</h3>
        ${dateText ? `<div class="meta">${dateText}</div>` : ''}
        <div style="margin-top:8px;">${badges}</div>
        ${subjectsHtml}
      `;

      card.addEventListener('click', () => {
        if (isDup(exam) && !isUnlocked()) {
          openCodeModal();
          return;
        }
        window.location.href = `exam.html?exam=${encodeURIComponent(exam.id)}`;
      });

      container.appendChild(card);
    });
  }

  // ===== 탭 전환 =====
  function bindTabs() {
    document.querySelectorAll('.main-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.main-tab').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.tab;
        $('panel-rounds').style.display = (tab === 'rounds') ? 'block' : 'none';
        $('panel-dup').style.display = (tab === 'dup') ? 'block' : 'none';

        if (tab === 'dup' && !isUnlocked()) openCodeModal();
      });
    });
  }

  // ===== 입장코드 =====
  function openCodeModal() {
    $('code-error').style.display = 'none';
    $('code-input').value = '';
    $('code-modal').classList.add('show');
    setTimeout(() => $('code-input').focus(), 50);
  }

  function unlockDup() {
    codeStore.setItem(CODE_KEY, '1');
    $('dup-locked').style.display = 'none';
    $('dup-list').style.display = 'grid';
    const tab = document.querySelector('.main-tab[data-tab="dup"]');
    if (tab) tab.textContent = '🔓 중복기출';
  }

  function bindCodeModal() {
    const submit = () => {
      if ($('code-input').value.trim() === ACCESS_CODE) {
        $('code-modal').classList.remove('show');
        unlockDup();
      } else {
        $('code-error').style.display = 'block';
        $('code-input').select();
      }
    };

    $('code-submit-btn').addEventListener('click', submit);
    $('code-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    $('open-code-btn').addEventListener('click', openCodeModal);
    $('code-cancel-btn').addEventListener('click', () => $('code-modal').classList.remove('show'));
    $('code-modal').addEventListener('click', (e) => {
      if (e.target === $('code-modal')) $('code-modal').classList.remove('show');
    });
  }

  // ===== 설정 =====
  function bindEvents() {
    $('settings-btn').addEventListener('click', () => $('settings-modal').classList.add('show'));
    $('close-settings-btn').addEventListener('click', () => $('settings-modal').classList.remove('show'));
    $('settings-modal').addEventListener('click', (e) => {
      if (e.target === $('settings-modal')) $('settings-modal').classList.remove('show');
    });

    $('clear-data-btn').addEventListener('click', () => {
      if (!confirm('⚠️ 모든 응시 기록과 북마크를 삭제합니다.\n\n정말 초기화하시겠습니까?')) return;
      if (!confirm('한 번 더 확인합니다.\n\n정말 모든 데이터를 삭제할까요?')) return;

      if (window.Storage && window.Storage.clearAll) window.Storage.clearAll();

      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('exam-progress-')) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));

      alert('✅ 모든 데이터가 초기화되었습니다.');
      location.reload();
    });
  }

  // ===== 유틸 =====
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
