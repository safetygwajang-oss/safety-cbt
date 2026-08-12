/* ============================================
   포스코퓨처엠 CBT - 시험 진행 로직
   exam.js (v4 - 자격증별 시험시간 자동 적용)
   ============================================ */

(function () {
  'use strict';

  // ===== 전역 상태 =====
  const state = {
    examId: null,
    examTitle: '',
    mode: 'exam',
    sessionId: null,
    questions: [],
    answers: {},
    bookmarks: {},
    perPage: 2,
    currentPage: 1,
    totalPages: 1,
    startTime: null,
    timerInterval: null,
    autoSaveInterval: null,
    durationMin: null,
    timeLimit: 150 * 60,
    submitted: false,
  };

  const $ = (id) => document.getElementById(id);
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    els.title = $('exam-title');
    els.timer = $('timer');
    els.modeToggle = $('mode-toggle');
    els.resetBtn = $('reset-btn');
    els.saveBtn = $('save-btn');
    els.homeBtn = $('home-btn');
    els.submitBtn = $('submit-btn');
    els.progressFill = $('progress-fill');
    els.perPage = $('per-page');
    els.jumpBtn = $('jump-input-btn');
    els.answeredCount = $('answered-count');
    els.questionArea = $('question-area');
    els.prevPage = $('prev-page');
    els.nextPage = $('next-page');
    els.pageInfo = $('page-info');

    const params = new URLSearchParams(window.location.search);
    state.examId = params.get('exam');
    state.mode = params.get('mode') || 'exam';
    state.sessionId = params.get('session');

    if (!state.examId) {
      els.questionArea.innerHTML = '<p class="loading">❌ 시험 정보가 없습니다. <a href="index.html">홈으로</a></p>';
      return;
    }

    try {
      await loadExamData();
    } catch (err) {
      console.error('시험 데이터 로드 실패:', err);
      els.questionArea.innerHTML = `<p class="loading">❌ 문제 파일을 불러올 수 없습니다.<br>파일: <code>data/${state.examId}.json</code><br><a href="index.html">홈으로</a></p>`;
      return;
    }

    if (state.mode === 'wrong' && state.sessionId) {
      filterWrongQuestions();
    }

    if (state.questions.length === 0) {
      els.questionArea.innerHTML = '<p class="loading">😅 풀 문제가 없습니다. <a href="index.html">홈으로</a></p>';
      return;
    }

    applyTimeLimit();     // ★ 자격증별 시험시간 결정
    restoreProgress();
    bindEvents();
    updateTitle();

    const jumpTo = params.get('jumpTo');
    if (jumpTo) {
      const targetNo = parseInt(jumpTo, 10);
      const idx = state.questions.findIndex(q => q.no === targetNo);
      if (idx >= 0) {
        state.currentPage = Math.floor(idx / state.perPage) + 1;
      }
    }

    renderPage();
    startTimer();
    startAutoSave();

    ensureKatexReady().then(() => {
      renderPage();
    });

    window.addEventListener('beforeunload', beforeUnloadHandler);
  }

  /* ============================================
     ★ 자격증별 시험시간 자동 결정
     ============================================ */
  function applyTimeLimit() {
    const text = `${state.examId || ''} ${state.examTitle || ''}`;
    const count = state.questions.length;
    let min;

    if (state.durationMin && state.durationMin > 0) {
      // JSON 파일에 duration(분)이 있으면 그것을 우선 사용
      min = state.durationMin;
    } else if (state.mode === 'wrong') {
      min = Math.max(10, Math.ceil(count * 1.5));
    } else if (/중복기출/.test(text)) {
      min = Math.max(30, Math.ceil(count * 1.5));
    } else if (/위험물기능장/.test(text)) {
      min = 60;
    } else if (/산업위생관리기사/.test(text)) {
      min = 150;
    } else {
      min = 150;   // 산업안전기사 · 건설안전기사
    }

    // 오답 재도전은 항상 문항수 기준으로 축소
    if (state.mode === 'wrong') {
      min = Math.max(10, Math.ceil(count * 1.5));
    }

    state.timeLimit = min * 60;
  }

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

  function startAutoSave() {
    state.autoSaveInterval = setInterval(() => {
      if (!state.submitted && Object.keys(state.answers).length > 0) {
        saveProgress();
      }
    }, 30000);
  }

  // ===== 데이터 로드 =====
  async function loadExamData() {
    const res = await fetch(`data/${state.examId}.json`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    state.examTitle = data.title || state.examId;
    state.questions = Array.isArray(data.questions) ? data.questions : [];
    state.durationMin = Number(data.duration || data.timeLimitMin || 0) || null;

    state.questions.forEach((q, i) => {
      if (typeof q.no !== 'number') q.no = i + 1;
    });
  }

  // ===== 오답 필터링 =====
  function filterWrongQuestions() {
    const session = (window.Storage && window.Storage.getSession)
      ? window.Storage.getSession(state.sessionId)
      : null;

    if (!session || !session.answers) {
      alert('원본 세션 정보를 찾을 수 없어 전체 문제로 진행합니다.');
      state.mode = 'exam';
      return;
    }

    const wrongNos = [];
    state.questions.forEach(q => {
      const picked = session.answers[q.no];
      if (picked !== q.answer) wrongNos.push(q.no);
    });

    if (wrongNos.length === 0) {
      alert('🎉 오답이 없습니다! 전체 문제로 진행합니다.');
      state.mode = 'exam';
      return;
    }

    state.questions = state.questions.filter(q => wrongNos.includes(q.no));
    state.examTitle += ` · 오답 재도전 (${state.questions.length}문항)`;
  }

  // ===== 진행상황 복구 =====
  function restoreProgress() {
    const key = getStorageKey();
    try {
      const saved = JSON.parse(localStorage.getItem(key) || '{}');
      state.answers = saved.answers || {};
      state.bookmarks = saved.bookmarks || {};
      state.perPage = saved.perPage || 2;
      state.currentPage = saved.currentPage || 1;
      state.startTime = saved.startTime || Date.now();

      // ★ 저장된 시각이 너무 오래돼 즉시 자동제출되는 것 방지
      const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
      if (elapsed >= state.timeLimit) {
        state.startTime = Date.now();
      }

      if (els.perPage) els.perPage.value = state.perPage;
    } catch (e) {
      state.startTime = Date.now();
    }
    updateTotalPages();
  }

  function saveProgress() {
    const key = getStorageKey();
    const data = {
      answers: state.answers,
      bookmarks: state.bookmarks,
      perPage: state.perPage,
      currentPage: state.currentPage,
      startTime: state.startTime,
      lastSavedAt: Date.now(),
    };
    try {
      localStorage.setItem(key, JSON.stringify(data));
      return true;
    } catch (e) {
      console.warn('저장 실패:', e);
      return false;
    }
  }

  function getStorageKey() {
    const modeSuffix = state.mode === 'wrong' ? `-wrong-${state.sessionId}` : '';
    return `exam-progress-${state.examId}${modeSuffix}`;
  }

  // ===== 이벤트 바인딩 =====
  function bindEvents() {
    els.perPage.addEventListener('change', () => {
      state.perPage = parseInt(els.perPage.value, 10);
      state.currentPage = 1;
      updateTotalPages();
      renderPage();
      saveProgress();
    });

    els.prevPage.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderPage();
        saveProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    els.nextPage.addEventListener('click', () => {
      if (state.currentPage < state.totalPages) {
        state.currentPage++;
        renderPage();
        saveProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    els.jumpBtn.addEventListener('click', () => {
      const total = state.questions.length;
      const input = prompt(`이동할 문제 번호 (1 ~ ${total}):`);
      if (!input) return;
      const target = parseInt(input, 10);
      if (isNaN(target) || target < 1 || target > total) {
        alert('올바른 문제 번호를 입력하세요.');
        return;
      }
      const idx = state.questions.findIndex(q => q.no === target);
      const useIdx = idx >= 0 ? idx : (target - 1);
      state.currentPage = Math.floor(useIdx / state.perPage) + 1;
      renderPage();
      saveProgress();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    els.modeToggle.addEventListener('click', () => {
      if (state.mode === 'wrong') {
        alert('오답 재도전은 실전 모드로만 진행됩니다.');
        return;
      }
      if (state.mode === 'exam') {
        state.mode = 'study';
        els.modeToggle.textContent = '📖 학습모드';
        els.modeToggle.classList.add('btn-primary');
      } else {
        state.mode = 'exam';
        els.modeToggle.textContent = '🎯 실전모드';
        els.modeToggle.classList.remove('btn-primary');
      }
      renderPage();
    });

    els.resetBtn.addEventListener('click', () => {
      if (!confirm('⚠️ 현재 시험의 답안과 진행상황을 모두 지웁니다. 계속할까요?')) return;
      state.answers = {};
      state.bookmarks = {};
      state.currentPage = 1;
      state.startTime = Date.now();
      state.submitted = false;
      saveProgress();
      renderPage();
      showToast('↺ 초기화되었습니다.');
    });

    if (els.saveBtn) {
      els.saveBtn.addEventListener('click', () => {
        const ok = saveProgress();
        const answered = Object.keys(state.answers).length;
        if (ok) {
          showToast(`💾 저장 완료! (${answered}문항 진행 중)`);
        } else {
          showToast('⚠️ 저장에 실패했습니다.', 3000);
        }
      });
    }

    if (els.homeBtn) {
      els.homeBtn.addEventListener('click', () => {
        const answered = Object.keys(state.answers).length;
        const msg = answered > 0
          ? `💾 현재까지 푼 ${answered}문항이 저장됩니다.\n\n나중에 다시 이 시험을 선택하면 이어서 풀 수 있습니다.\n\n홈으로 이동할까요?`
          : '홈으로 이동하시겠습니까?';
        if (!confirm(msg)) return;

        saveProgress();
        clearInterval(state.autoSaveInterval);
        window.removeEventListener('beforeunload', beforeUnloadHandler);
        window.location.href = 'index.html';
      });
    }

    els.submitBtn.addEventListener('click', handleSubmit);
  }

  // ===== 제목 =====
  function updateTitle() {
    const min = Math.round(state.timeLimit / 60);
    els.title.textContent = `${state.examTitle || state.examId} (${state.questions.length}문항 / ${min}분)`;
    if (state.mode === 'wrong') {
      els.modeToggle.style.display = 'none';
    }
  }

  // ===== 페이지 =====
  function updateTotalPages() {
    state.totalPages = Math.max(1, Math.ceil(state.questions.length / state.perPage));
    if (state.currentPage > state.totalPages) state.currentPage = state.totalPages;
  }

  function renderPage() {
    updateTotalPages();
    const start = (state.currentPage - 1) * state.perPage;
    const end = Math.min(start + state.perPage, state.questions.length);
    const pageQuestions = state.questions.slice(start, end);

    els.questionArea.innerHTML = '';
    pageQuestions.forEach(q => {
      els.questionArea.appendChild(renderQuestionCard(q));
    });

    els.pageInfo.textContent = `${state.currentPage} / ${state.totalPages}`;
    els.prevPage.disabled = state.currentPage === 1;
    els.nextPage.disabled = state.currentPage === state.totalPages;

    updateProgress();
  }

  // ===== 문제 카드 =====
  function renderQuestionCard(q) {
    const card = document.createElement('div');
    card.className = 'question-card';
    if (state.bookmarks[q.no]) card.classList.add('bookmarked');
    card.dataset.no = q.no;

    const header = document.createElement('div');
    header.className = 'question-header';
    header.innerHTML = `
      <div>
        <span class="question-no">${q.no}</span>
        ${q.subject ? `<span class="subject-tag">${escapeHtml(q.subject)}</span>` : ''}
      </div>
      <div class="question-actions">
        <button class="btn-icon bookmark-btn" title="북마크" data-no="${q.no}">
          ${state.bookmarks[q.no] ? '⭐' : '☆'}
        </button>
      </div>
    `;
    card.appendChild(header);

    const qText = document.createElement('div');
    qText.className = 'question-text';
    qText.textContent = q.question || '';
    card.appendChild(qText);

    if (q.passage) {
      const passageEl = renderPassage(q.passage);
      if (passageEl) card.appendChild(passageEl);
    }

    const choicesDiv = document.createElement('div');
    choicesDiv.className = 'choices';
    (q.choices || []).forEach((choiceText, idx) => {
      const choiceNo = idx + 1;
      const choice = document.createElement('div');
      choice.className = 'choice';
      choice.dataset.no = q.no;
      choice.dataset.choice = choiceNo;

      const picked = state.answers[q.no];
      if (picked === choiceNo) choice.classList.add('selected');

      if (state.mode === 'study' && picked) {
        if (choiceNo === q.answer) choice.classList.add('correct');
        else if (choiceNo === picked) choice.classList.add('wrong');
      }

      choice.innerHTML = `
        <span class="choice-no">${choiceNo}</span>
        <span class="choice-text">${escapeHtml(choiceText)}</span>
      `;
      choice.addEventListener('click', () => handleChoiceClick(q, choiceNo));
      choicesDiv.appendChild(choice);
    });
    card.appendChild(choicesDiv);

    if (q.explanation) {
      const exp = document.createElement('div');
      exp.className = 'explanation';
      if (state.mode === 'study' && state.answers[q.no]) exp.classList.add('show');
      exp.innerHTML = `<span class="label">💡 해설</span>${escapeHtml(q.explanation)}`;
      card.appendChild(exp);
    }

    const bmBtn = header.querySelector('.bookmark-btn');
    bmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBookmark(q.no);
    });

    return card;
  }

  // ===== passage =====
  function renderPassage(passage) {
    if (window.PassageRenderer && typeof window.PassageRenderer.render === 'function') {
      const html = window.PassageRenderer.render(passage);
      if (html) {
        const wrapper = document.createElement('div');
        wrapper.className = 'passage passage-v2';
        wrapper.innerHTML = html;
        return wrapper;
      }
    }

    const box = document.createElement('div');
    box.className = 'passage';

    if (typeof passage === 'string') {
      box.classList.add('type-text');
      box.textContent = passage;
      return box;
    }

    if (Array.isArray(passage)) {
      box.classList.add('type-mixed');
      box.textContent = JSON.stringify(passage);
      return box;
    }

    const type = passage.type || 'text';
    box.classList.add('type-' + type);

    if (type === 'list') {
      const ul = document.createElement('ul');
      (passage.items || []).forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
      });
      box.appendChild(ul);
    } else if (type === 'table') {
      const table = document.createElement('table');
      if (Array.isArray(passage.headers) && passage.headers.length) {
        const thead = document.createElement('thead');
        const tr = document.createElement('tr');
        passage.headers.forEach(h => {
          const th = document.createElement('th');
          th.textContent = h;
          tr.appendChild(th);
        });
        thead.appendChild(tr);
        table.appendChild(thead);
      }
      const tbody = document.createElement('tbody');
      (passage.rows || []).forEach(row => {
        const tr = document.createElement('tr');
        row.forEach(cell => {
          const td = document.createElement('td');
          td.textContent = cell;
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      table.appendChild(tbody);
      box.appendChild(table);
    } else {
      box.textContent = passage.text || passage.content || '';
    }

    return box;
  }

  function handleChoiceClick(q, choiceNo) {
    if (state.submitted) return;
    state.answers[q.no] = choiceNo;
    saveProgress();
    renderPage();
    updateProgress();
  }

  function toggleBookmark(no) {
    if (state.bookmarks[no]) {
      delete state.bookmarks[no];
    } else {
      state.bookmarks[no] = true;
    }
    saveProgress();

    if (window.Storage && window.Storage.setGlobalBookmark) {
      const q = state.questions.find(qq => qq.no === no);
      if (q) {
        window.Storage.setGlobalBookmark(state.examId, no, !!state.bookmarks[no], q);
      }
    }
    renderPage();
  }

  function updateProgress() {
    const total = state.questions.length;
    const answered = Object.keys(state.answers).length;
    const percent = total > 0 ? Math.round((answered / total) * 100) : 0;
    els.progressFill.style.width = percent + '%';
    els.answeredCount.textContent = `${answered} / ${total} 답변`;
  }

  // ===== 타이머 =====
  function startTimer() {
    if (!state.startTime) state.startTime = Date.now();
    updateTimer();
    state.timerInterval = setInterval(updateTimer, 1000);
  }

  function updateTimer() {
    const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
    const remaining = Math.max(0, state.timeLimit - elapsed);

    els.timer.classList.remove('warning', 'danger');
    if (remaining <= 60) els.timer.classList.add('danger');
    else if (remaining <= 300) els.timer.classList.add('warning');

    els.timer.textContent = formatTime(remaining);

    if (remaining === 0) {
      clearInterval(state.timerInterval);
      alert('⏰ 시험 시간이 종료되었습니다. 자동 제출됩니다.');
      handleSubmit(true);
    }
  }

  function formatTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  // ===== 제출 =====
  function handleSubmit(auto = false) {
    if (state.submitted) return;

    const total = state.questions.length;
    const answered = Object.keys(state.answers).length;

    if (!auto) {
      const unanswered = total - answered;
      const msg = unanswered > 0
        ? `⚠️ ${unanswered}문항을 풀지 않았습니다.\n\n정말 제출하시겠습니까?`
        : `총 ${total}문항 모두 답변했습니다.\n\n제출하시겠습니까?`;
      if (!confirm(msg)) return;
    }

    state.submitted = true;
    clearInterval(state.timerInterval);
    clearInterval(state.autoSaveInterval);

    let correct = 0;
    const subjectStats = {};
    const reviewData = [];

    state.questions.forEach(q => {
      const picked = state.answers[q.no] || null;
      const isCorrect = picked === q.answer;
      if (isCorrect) correct++;

      const subj = q.subject || '전체';
      if (!subjectStats[subj]) subjectStats[subj] = { correct: 0, total: 0 };
      subjectStats[subj].total++;
      if (isCorrect) subjectStats[subj].correct++;

      reviewData.push({
        no: q.no,
        subject: subj,
        question: q.question,
        passage: q.passage || null,
        choices: q.choices,
        answer: q.answer,
        picked: picked,
        correct: isCorrect,
        explanation: q.explanation || '',
        bookmarked: !!state.bookmarks[q.no],
      });
    });

    const elapsedSec = Math.floor((Date.now() - state.startTime) / 1000);
    const sessionId = 'sess-' + Date.now();

    const resultData = {
      sessionId: sessionId,
      examId: state.examId,
      examTitle: state.examTitle,
      mode: state.mode,
      total: total,
      correct: correct,
      score: total > 0 ? Math.round((correct / total) * 100) : 0,
      elapsedSec: elapsedSec,
      timeLimitSec: state.timeLimit,
      subjectStats: subjectStats,
      review: reviewData,
      answers: state.answers,
      bookmarks: state.bookmarks,
      submittedAt: Date.now(),
    };

    if (window.Storage && window.Storage.saveSession) {
      window.Storage.saveSession(sessionId, resultData);
    } else {
      localStorage.setItem(`result-${sessionId}`, JSON.stringify(resultData));
    }

    localStorage.removeItem(getStorageKey());
    window.removeEventListener('beforeunload', beforeUnloadHandler);

    window.location.href = `result.html?session=${sessionId}`;
  }

  function beforeUnloadHandler(e) {
    if (state.submitted) return;
    if (Object.keys(state.answers).length === 0) return;
    saveProgress();
    e.preventDefault();
    e.returnValue = '';
    return '';
  }

  // ===== 토스트 =====
  let toastTimer = null;
  function showToast(message, duration = 2000) {
    let toast = document.getElementById('cbt-toast');
    if (!toast) {
      toast = document.createElement('div');
      toast.id = 'cbt-toast';
      toast.style.cssText = `
        position: fixed; bottom: 30px; left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: rgba(30, 41, 59, 0.95); color: #fff;
        padding: 12px 24px; border-radius: 8px;
        font-size: 0.95rem; font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999; opacity: 0;
        transition: opacity 0.25s ease, transform 0.25s ease;
        pointer-events: none; max-width: 90%; text-align: center;
      `;
      document.body.appendChild(toast);
    }

    toast.textContent = message;

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(20px)';
    }, duration);
  }

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
