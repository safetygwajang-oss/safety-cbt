/* ============================================
   포스코퓨처엠 CBT - 홈 대시보드
   main.js
   ============================================ */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // ⚠️ data/index.json이 없을 때 사용할 fallback 목록
  const FALLBACK_EXAM_IDS = [
    '2022-04-24',
  ];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    renderStats();
    renderBookmarks();
    renderRecent();
    await renderExamList();
    bindEvents();
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

    const displayList = list.slice(0, 12);

    displayList.forEach(bm => {
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

  // ===== 회차 목록 =====
  async function renderExamList() {
    let examIds = [];

    // 1. data/index.json에서 회차 ID 목록 로드
    try {
      const res = await fetch('data/index.json');
      if (res.ok) {
        const data = await res.json();
        examIds = data.exams || [];
      }
    } catch (e) {
      console.log('data/index.json 없음, fallback 사용');
    }

    // 2. fallback
    if (examIds.length === 0) examIds = FALLBACK_EXAM_IDS;

    const container = $('exam-list');

    if (examIds.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; padding:30px; text-align:center; color:var(--gray-500);">
          <p style="margin-bottom:12px;">📂 아직 등록된 회차가 없습니다.</p>
          <p style="font-size:0.85rem;">
            <code>data/index.json</code>의 <code>exams</code> 배열에 회차 ID를 추가하세요.
          </p>
        </div>
      `;
      return;
    }

    // 3. 각 시험 파일에서 메타데이터 병렬 로드
    container.innerHTML = '<p class="loading" style="grid-column:1/-1;">회차 목록을 불러오는 중...</p>';

    const examPromises = examIds.map(async (examId) => {
      try {
        const res = await fetch(`data/${examId}.json`);
        if (!res.ok) return { id: examId, title: examId, error: true };
        const data = await res.json();
        return {
          id: examId,
          title: data.title || examId,
          questionCount: (data.questions || []).length,
          duration: data.duration || null,
          subjects: data.subjects || [],
        };
      } catch (e) {
        return { id: examId, title: examId, error: true };
      }
    });

    const exams = await Promise.all(examPromises);

    // 4. 응시/진행 기록 조회
    const sessions = window.Storage && window.Storage.getAllSessions
      ? window.Storage.getAllSessions()
      : {};
    const attemptedExamIds = new Set(Object.values(sessions).map(s => s.examId));

    const inProgressExamIds = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('exam-progress-') && !key.includes('-wrong-')) {
        const examId = key.replace('exam-progress-', '');
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.answers && Object.keys(data.answers).length > 0) {
            inProgressExamIds.add(examId);
          }
        } catch (e) {}
      }
    }

    // 5. 렌더링
    container.innerHTML = '';

    // 최신 날짜순 정렬 (파일명이 YYYY-MM-DD 형식이라 사전순 = 시간순)
    exams.sort((a, b) => b.id.localeCompare(a.id));

    exams.forEach(exam => {
      const card = document.createElement('div');
      card.className = 'exam-card';

      if (exam.error) {
        card.innerHTML = `
          <h3 style="color:var(--danger);">⚠️ ${escapeHtml(exam.id)}</h3>
          <div class="meta">파일을 불러올 수 없습니다.</div>
          <div style="margin-top:8px;">
            <span class="badge" style="background:#fee2e2; color:#991b1b;">오류</span>
          </div>
        `;
        container.appendChild(card);
        return;
      }

      const attempted = attemptedExamIds.has(exam.id);
      const inProgress = inProgressExamIds.has(exam.id);

      let badges = '';
      if (inProgress) badges += '<span class="badge" style="background:#fef3c7; color:#92400e;">▶ 진행중</span>';
      if (attempted) badges += '<span class="badge done">✅ 응시완료</span>';
      badges += `<span class="badge">${exam.questionCount}문항</span>`;
      if (exam.duration) badges += `<span class="badge">⏱ ${exam.duration}분</span>`;

      // 과목 정보 (간략 표시)
      let subjectsHtml = '';
      if (exam.subjects && exam.subjects.length > 0) {
        const names = exam.subjects.map(s => s.name).join(' · ');
        subjectsHtml = `<div style="font-size:0.8rem; color:var(--gray-500); margin-top:8px; line-height:1.4;">${escapeHtml(names)}</div>`;
      }

      card.innerHTML = `
        <h3>${escapeHtml(exam.title)}</h3>
        <div style="margin-top:8px;">${badges}</div>
        ${subjectsHtml}
      `;
      card.addEventListener('click', () => {
        window.location.href = `exam.html?exam=${encodeURIComponent(exam.id)}`;
      });
      container.appendChild(card);
    });
  }

  // ===== 이벤트 =====
  function bindEvents() {
    $('settings-btn').addEventListener('click', () => {
      $('settings-modal').classList.add('show');
    });

    $('close-settings-btn').addEventListener('click', () => {
      $('settings-modal').classList.remove('show');
    });

    $('settings-modal').addEventListener('click', (e) => {
      if (e.target === $('settings-modal')) {
        $('settings-modal').classList.remove('show');
      }
    });

    $('clear-data-btn').addEventListener('click', () => {
      if (!confirm('⚠️ 모든 응시 기록과 북마크를 삭제합니다.\n\n정말 초기화하시겠습니까?')) return;
      if (!confirm('한 번 더 확인합니다.\n\n정말 모든 데이터를 삭제할까요?')) return;

      if (window.Storage && window.Storage.clearAll) {
        window.Storage.clearAll();
      }
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
