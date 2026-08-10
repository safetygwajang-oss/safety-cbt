/* ============================================
   포스코퓨처엠 CBT - 홈 대시보드
   main.js
   ============================================ */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  // ⚠️ data/index.json이 없을 때 사용할 fallback 목록
  // 여기에 실제 사용 중인 JSON 파일명을 추가하세요.
  const FALLBACK_EXAMS = [
    // 예시: 실제 파일명에 맞게 수정
    // { id: '2022-04-24', title: '2022년 4월 24일 산업안전기사', questions: 120 },
    // { id: '2022-09-14', title: '2022년 9월 14일 산업안전기사', questions: 120 },
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

    // 최대 12개만 표시 (많으면 스크롤/더보기)
    const displayList = list.slice(0, 12);

    displayList.forEach(bm => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.innerHTML = `
        <div class="bm-header">
          <span>📅 ${escapeHtml(bm.examId)} · ${bm.no}번</span>
          <span style="color:var(--gray-400);">${bm.subject ? escapeHtml(bm.subject) : ''}</span>
        </div>
        <div class="bm-text">${escapeHtml(bm.question || '').substring(0, 100)}${(bm.question || '').length > 100 ? '...' : ''}</div>
      `;
      item.addEventListener('click', () => {
        // 해당 시험의 그 문제로 이동
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
      .slice(0, 5); // 최근 5개

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
    let exams = [];

    // 1. data/index.json 시도
    try {
      const res = await fetch('data/index.json');
      if (res.ok) {
        const data = await res.json();
        exams = data.exams || [];
      }
    } catch (e) {
      console.log('data/index.json 없음, fallback 사용');
    }

    // 2. fallback
    if (exams.length === 0) exams = FALLBACK_EXAMS;

    const container = $('exam-list');
    container.innerHTML = '';

    if (exams.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; padding:30px; text-align:center; color:var(--gray-500);">
          <p style="margin-bottom:12px;">📂 아직 등록된 회차가 없습니다.</p>
          <p style="font-size:0.85rem;">
            <code>data/index.json</code> 파일을 만들거나<br>
            <code>js/main.js</code>의 <code>FALLBACK_EXAMS</code>에 회차를 추가하세요.
          </p>
        </div>
      `;
      return;
    }

    // 응시 기록 확인용
    const sessions = window.Storage && window.Storage.getAllSessions
      ? window.Storage.getAllSessions()
      : {};
    const attemptedExamIds = new Set(Object.values(sessions).map(s => s.examId));

    // 진행 중인 시험(답 저장된 것) 확인
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

    exams.forEach(exam => {
      const card = document.createElement('div');
      card.className = 'exam-card';

      const attempted = attemptedExamIds.has(exam.id);
      const inProgress = inProgressExamIds.has(exam.id);

      let badges = '';
      if (inProgress) badges += '<span class="badge" style="background:#fef3c7; color:#92400e;">▶ 진행중</span>';
      if (attempted) badges += '<span class="badge done">✅ 응시완료</span>';
      if (exam.questions) badges += `<span class="badge">${exam.questions}문항</span>`;

      card.innerHTML = `
        <h3>${escapeHtml(exam.title || exam.id)}</h3>
        <div class="meta">${exam.date ? '📅 ' + escapeHtml(exam.date) : ''}</div>
        <div style="margin-top:8px;">${badges}</div>
      `;
      card.addEventListener('click', () => {
        window.location.href = `exam.html?exam=${encodeURIComponent(exam.id)}`;
      });
      container.appendChild(card);
    });
  }

  // ===== 이벤트 =====
  function bindEvents() {
    // 설정 모달
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
      // 모든 진행상황도 삭제
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
