/* ============================================
   포스코퓨처엠 CBT - 결과 화면 로직
   result.js (v2 - passage-renderer 통합 + Storage 연동)
   ============================================ */

(function () {
  'use strict';

  // ===== DOM 캐싱 =====
  const $ = (id) => document.getElementById(id);
  const els = {};

  // ===== 상태 =====
  let result = null;
  let chartInstance = null;

  // ===== 초기화 =====
  document.addEventListener('DOMContentLoaded', init);

  function init() {
    // DOM
    els.score = $('score');
    els.percent = $('percent');
    els.passStatus = $('pass-status');
    els.elapsed = $('elapsed');
    els.chartCanvas = $('subject-chart');
    els.reviewList = $('review-list');
    els.retryWrong = $('retry-wrong');
    els.tabs = document.querySelectorAll('.tab');

    // 세션 로드
    result = loadResult();
    if (!result) {
      showError('결과 데이터를 찾을 수 없습니다.');
      return;
    }

    // KaTeX 로드 대기 후 렌더 (수식 있을 수 있음)
    ensureKatexReady().then(() => {
      renderSummary();
      renderSubjectChart();
      bindEvents();
      renderReview('all');
    });
  }

  // ===== KaTeX 로드 대기 =====
  function ensureKatexReady() {
    return new Promise(resolve => {
      if (window.katex) return resolve();
      let tries = 0;
      const timer = setInterval(() => {
        tries++;
        if (window.katex || tries > 20) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  }

  // ===== 결과 로드 =====
  function loadResult() {
    // 1순위: URL의 session 파라미터
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session');

    if (sessionId && window.Storage && typeof window.Storage.getSession === 'function') {
      const session = window.Storage.getSession(sessionId);
      if (session) return session;
    }

    // 2순위: fallback (localStorage 직접 조회)
    if (sessionId) {
      try {
        const raw = localStorage.getItem(`result-${sessionId}`);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* ignore */ }
    }

    // 3순위: 구버전 호환 (Storage.getLastResult)
    if (window.Storage && typeof window.Storage.getLastResult === 'function') {
      const last = window.Storage.getLastResult();
      if (last) return last;
    }

    return null;
  }

  function showError(msg) {
    document.body.innerHTML = `
      <div style="max-width:600px;margin:80px auto;padding:32px;text-align:center;font-family:sans-serif;">
        <h1 style="color:#dc2626;">⚠️ ${escapeHtml(msg)}</h1>
        <p style="margin:20px 0;color:#64748b;">시험 결과를 불러올 수 없습니다.</p>
        <a href="index.html" style="display:inline-block;padding:10px 24px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none;">홈으로 돌아가기</a>
      </div>
    `;
  }

  // ===== 요약 렌더 =====
  function renderSummary() {
    const total = result.total || 0;
    const correct = result.correct || 0;
    const percent = result.score != null
      ? result.score
      : (total > 0 ? Math.round((correct / total) * 100) : 0);

    if (els.score) els.score.textContent = correct;
    if (els.percent) els.percent.textContent = percent;

    if (els.passStatus) {
      const passed = percent >= 60;
      els.passStatus.textContent = passed ? '🎉 합격' : '😢 불합격';
      els.passStatus.style.color = passed ? 'var(--success, #16a34a)' : 'var(--danger, #dc2626)';
    }

    if (els.elapsed) {
      const sec = result.elapsedSec || 0;
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      els.elapsed.textContent =
        `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }
  }

  // ===== 과목별 통계 얻기 =====
  function getSubjectStats() {
    // 신규 형식 (subjectStats)
    if (result.subjectStats && typeof result.subjectStats === 'object') {
      return Object.entries(result.subjectStats).map(([name, stat]) => ({
        name,
        correct: stat.correct || 0,
        total: stat.total || 0,
        rate: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
      }));
    }

    // 구버전 형식 (subjects + details)
    if (Array.isArray(result.subjects) && Array.isArray(result.details)) {
      return result.subjects.map(sub => {
        const qs = result.details.filter(d => d.subject === sub.name);
        const c = qs.filter(d => d.isCorrect).length;
        return {
          name: sub.name,
          correct: c,
          total: qs.length,
          rate: qs.length > 0 ? Math.round(c / qs.length * 100) : 0,
        };
      });
    }

    // review에서 집계
    if (Array.isArray(result.review)) {
      const map = {};
      result.review.forEach(r => {
        const s = r.subject || '기타';
        if (!map[s]) map[s] = { correct: 0, total: 0 };
        map[s].total++;
        if (r.correct) map[s].correct++;
      });
      return Object.entries(map).map(([name, stat]) => ({
        name,
        correct: stat.correct,
        total: stat.total,
        rate: stat.total > 0 ? Math.round((stat.correct / stat.total) * 100) : 0,
      }));
    }

    return [];
  }

  // ===== 레이더 차트 =====
  function renderSubjectChart() {
    if (!els.chartCanvas) return;
    if (typeof window.Chart === 'undefined') {
      console.warn('Chart.js가 로드되지 않았습니다. 차트를 표시할 수 없습니다.');
      const wrap = els.chartCanvas.parentNode;
      if (wrap) {
        wrap.innerHTML = '<p style="text-align:center;color:#64748b;padding:20px;">차트 라이브러리를 불러올 수 없습니다.</p>';
      }
      return;
    }

    const stats = getSubjectStats();
    if (!stats.length) return;

    // 이전 차트 파기
    if (chartInstance) {
      try { chartInstance.destroy(); } catch (e) {}
    }

    chartInstance = new window.Chart(els.chartCanvas, {
      type: 'radar',
      data: {
        labels: stats.map(s => s.name),
        datasets: [{
          label: '정답률(%)',
          data: stats.map(s => s.rate),
          backgroundColor: 'rgba(234, 88, 12, 0.2)',
          borderColor: 'rgba(234, 88, 12, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(234, 88, 12, 1)',
          pointRadius: 4,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            max: 100,
            ticks: { stepSize: 20 },
          },
        },
        plugins: {
          legend: { display: true, position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const s = stats[ctx.dataIndex];
                return `${s.name}: ${s.correct}/${s.total} (${s.rate}%)`;
              },
            },
          },
        },
      },
    });
  }

  // ===== 리뷰 데이터 얻기 (신구 스키마 모두 지원) =====
  function getReviewData() {
    if (Array.isArray(result.review)) {
      return result.review.map(r => ({
        no: r.no,
        subject: r.subject || '',
        question: r.question || '',
        passage: r.passage || null,
        choices: r.choices || [],
        answer: r.answer,
        picked: r.picked != null ? r.picked : (r.userAnswer != null ? r.userAnswer : null),
        correct: r.correct != null ? r.correct : r.isCorrect,
        explanation: r.explanation || '',
        bookmarked: !!r.bookmarked,
      }));
    }

    if (Array.isArray(result.details)) {
      return result.details.map(d => ({
        no: d.no,
        subject: d.subject || '',
        question: d.question || '',
        passage: d.passage || null,
        choices: d.choices || [],
        answer: d.answer,
        picked: d.picked != null ? d.picked : d.userAnswer,
        correct: d.correct != null ? d.correct : d.isCorrect,
        explanation: d.explanation || '',
        bookmarked: !!d.bookmarked,
      }));
    }

    return [];
  }

  // ===== 리뷰 렌더 =====
  function renderReview(filter = 'all') {
    if (!els.reviewList) return;

    const all = getReviewData();
    const list = all.filter(d => {
      if (filter === 'wrong') return !d.correct;
      if (filter === 'correct') return d.correct;
      if (filter === 'bookmark') return d.bookmarked;
      return true;
    });

    if (list.length === 0) {
      els.reviewList.innerHTML = `<p style="text-align:center;color:#64748b;padding:40px;">해당하는 문항이 없습니다.</p>`;
      return;
    }

    els.reviewList.innerHTML = list.map(d => buildReviewCardHtml(d)).join('');
  }

  function buildReviewCardHtml(d) {
    const passageHtml = renderPassageSafe(d.passage);
    const choicesHtml = buildChoicesHtml(d);
    const bmIcon = d.bookmarked ? '⭐ ' : '';
    const statusIcon = d.correct ? '✅' : '❌';
    const statusClass = d.correct ? 'correct' : 'wrong';
    const pickedText = d.picked != null ? `${d.picked}번` : '미응답';

    return `
      <div class="review-item ${statusClass}">
        <div class="review-header">
          <strong>${bmIcon}${d.no}. [${escapeHtml(d.subject)}]</strong>
          <span class="review-status">${statusIcon}</span>
        </div>
        <p class="review-question">${escapeHtml(d.question)}</p>
        ${passageHtml ? `<div class="review-passage">${passageHtml}</div>` : ''}
        ${choicesHtml}
        <p class="review-answer-line">
          <small>정답: <strong style="color:#16a34a;">${d.answer}번</strong>
          &nbsp;/&nbsp; 내 답:
          <strong style="color:${d.correct ? '#16a34a' : '#dc2626'};">${pickedText}</strong></small>
        </p>
        ${d.explanation ? `<p class="review-explanation"><strong>💡 해설:</strong> ${escapeHtml(d.explanation)}</p>` : ''}
      </div>
    `;
  }

  function buildChoicesHtml(d) {
    if (!Array.isArray(d.choices) || d.choices.length === 0) return '';

    const items = d.choices.map((text, idx) => {
      const no = idx + 1;
      let cls = 'review-choice';
      if (no === d.answer) cls += ' is-answer';
      if (d.picked && no === d.picked && !d.correct) cls += ' is-picked-wrong';

      const badge = no === d.answer
        ? '<span class="badge-answer">정답</span>'
        : (d.picked === no ? '<span class="badge-picked">내 답</span>' : '');

      return `
        <div class="${cls}">
          <span class="choice-no">${no}</span>
          <span class="choice-text">${escapeHtml(text)}</span>
          ${badge}
        </div>
      `;
    }).join('');

    return `<div class="review-choices">${items}</div>`;
  }

  // passage 렌더 (신규 렌더러 우선, 없으면 텍스트 표시)
  function renderPassageSafe(passage) {
    if (!passage) return '';

    if (window.PassageRenderer && typeof window.PassageRenderer.render === 'function') {
      try {
        return window.PassageRenderer.render(passage);
      } catch (e) {
        console.warn('passage 렌더링 실패:', e);
      }
    }

    // fallback: 문자열/객체를 단순 표시
    if (typeof passage === 'string') {
      return `<div class="passage-block passage-text">${escapeHtml(passage)}</div>`;
    }
    if (Array.isArray(passage)) {
      return passage.map(item => {
        if (item && item.type === 'text') return `<div class="passage-block passage-text">${escapeHtml(item.content || '')}</div>`;
        return '';
      }).join('');
    }
    return '';
  }

  // ===== 이벤트 =====
  function bindEvents() {
    // 탭 필터
    if (els.tabs && els.tabs.length) {
      els.tabs.forEach(tab => {
        tab.addEventListener('click', () => {
          els.tabs.forEach(t => t.classList.remove('active'));
          tab.classList.add('active');
          renderReview(tab.dataset.filter || 'all');
        });
      });
    }

    // 오답 재도전
    if (els.retryWrong) {
      els.retryWrong.addEventListener('click', handleRetryWrong);
    }
  }

  function handleRetryWrong() {
    const all = getReviewData();
    const wrongCount = all.filter(d => !d.correct).length;

    if (wrongCount === 0) {
      alert('🎉 오답이 없습니다! 완벽합니다.');
      return;
    }

    const examId = result.examId;
    const sessionId = result.sessionId;

    if (!examId) {
      alert('시험 정보를 찾을 수 없습니다.');
      return;
    }

    if (!confirm(`❌ 틀린 문제 ${wrongCount}개를 다시 풀어봅니다.\n\n계속하시겠습니까?`)) return;

    // exam.js가 지원하는 파라미터로 이동
    const url = `exam.html?exam=${encodeURIComponent(examId)}&mode=wrong&session=${encodeURIComponent(sessionId || '')}`;
    window.location.href = url;
  }

  // ===== 유틸: HTML 이스케이프 =====
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
