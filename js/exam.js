/* ============================================
   포스코퓨처엠 CBT - 시험 진행 로직
   exam.js
   ============================================ */

(function () {
  'use strict';

  // ===== 전역 상태 =====
  const state = {
    examId: null,          // URL의 exam 파라미터 (예: 2022-04-24)
    examTitle: '',         // 표시용 제목
    mode: 'exam',          // 'exam' (실전) | 'study' (학습) | 'wrong' (오답재도전)
    sessionId: null,       // 오답 재도전 시 원본 세션 ID
    questions: [],         // 현재 시험의 문제 배열
    answers: {},           // { 문제번호: 선택한번호(1~4) }
    bookmarks: {},         // { 문제번호: true }
    perPage: 2,            // 페이지당 문제 수
    currentPage: 1,
    totalPages: 1,
    startTime: null,       // 시험 시작 시각 (ms)
    timerInterval: null,
    timeLimit: 3 * 60 * 60, // 3시간 (초)
    submitted: false,
  };

  // ===== DOM 요소 =====
  const $ = (id) => document.getElementById(id);
  const els = {};

  // ===== 초기화 =====
  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    // DOM 캐싱
    els.title = $('exam-title');
    els.timer = $('timer');
    els.modeToggle = $('mode-toggle');
    els.resetBtn = $('reset-btn');
    els.submitBtn = $('submit-btn');
    els.progressFill = $('progress-fill');
    els.perPage = $('per-page');
    els.jumpBtn = $('jump-input-btn');
    els.answeredCount = $('answered-count');
    els.questionArea = $('question-area');
    els.prevPage = $('prev-page');
    els.nextPage = $('next-page');
    els.pageInfo = $('page-info');

    // URL 파라미터 파싱
    const params = new URLSearchParams(window.location.search);
    state.examId = params.get('exam');
    state.mode = params.get('mode') || 'exam';
    state.sessionId = params.get('session'); // 오답모드일 때 원본 세션

    if (!state.examId) {
      els.questionArea.innerHTML = '<p class="loading">❌ 시험 정보가 없습니다. <a href="index.html">홈으로</a></p>';
      return;
    }

    // 데이터 로드
    try {
      await loadExamData();
    } catch (err) {
      console.error('시험 데이터 로드 실패:', err);
      els.questionArea.innerHTML = `<p class="loading">❌ 문제 파일을 불러올 수 없습니다.<br>파일: <code>data/${state.examId}.json</code><br><a href="index.html">홈으로</a></p>`;
      return;
    }

    // 오답 모드면 문제 필터링
    if (state.mode === 'wrong' && state.sessionId) {
      filterWrongQuestions();
    }

    if (state.questions.length === 0) {
      els.questionArea.innerHTML = '<p class="loading">😅 풀 문제가 없습니다. <a href="index.html">홈으로</a></p>';
      return;
    }

    // 저장된 진행상황 복구
    restoreProgress();

    // 이벤트 바인딩
    bindEvents();

    // 렌더링
    updateTitle();
    renderPage();
    startTimer();

    // 이탈 방지
    window.addEventListener('beforeunload', beforeUnloadHandler);
  }

  // ===== 데이터 로드 =====
  async function loadExamData() {
    const res = await fetch(`data/${state.examId}.json`);
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();

    state.examTitle = data.title || state.examId;
    state.questions = Array.isArray(data.questions) ? data.questions : [];

    // 문제에 no가 없으면 자동 부여
    state.questions.forEach((q, i) => {
      if (typeof q.no !== 'number') q.no = i + 1;
    });
  }

  // ===== 오답 필터링 =====
  function filterWrongQuestions() {
    // storage.js의 getSession 사용
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
    };
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
      console.warn('저장 실패:', e);
    }
  }

  function getStorageKey() {
    const modeSuffix = state.mode === 'wrong' ? `-wrong-${state.sessionId}` : '';
    return `exam-progress-${state.examId}${modeSuffix}`;
  }

  // ===== 이벤트 바인딩 =====
  function bindEvents() {
    // 페이지당 문제 수
    els.perPage.addEventListener('change', () => {
      state.perPage = parseInt(els.perPage.value, 10);
      state.currentPage = 1;
      updateTotalPages();
      renderPage();
      saveProgress();
    });

    // 이전/다음 페이지
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

    // 문제 번호 점프
    els.jumpBtn.addEventListener('click', () => {
      const total = state.questions.length;
      const input = prompt(`이동할 문제 번호 (1 ~ ${total}):`);
      if (!input) return;
      const target = parseInt(input, 10);
      if (isNaN(target) || target < 1 || target > total) {
        alert('올바른 문제 번호를 입력하세요.');
        return;
      }
      // 해당 문제가 있는 페이지로 이동
      const idx = state.questions.findIndex(q => q.no === target);
      const useIdx = idx >= 0 ? idx : (target - 1);
      state.currentPage = Math.floor(useIdx / state.perPage) + 1;
      renderPage();
      saveProgress();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    // 모드 토글 (실전 ↔ 학습)
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

    // 초기화
    els.resetBtn.addEventListener('click', () => {
      if (!confirm('⚠️ 현재 시험의 답안과 진행상황을 모두 지웁니다. 계속할까요?')) return;
      state.answers = {};
      state.bookmarks = {};
      state.currentPage = 1;
      state.startTime = Date.now();
      state.submitted = false;
      saveProgress();
      renderPage();
      alert('초기화되었습니다.');
    });

    // 제출
    els.submitBtn.addEventListener('click', handleSubmit);
  }

  // ===== 렌더링: 제목 & 헤더 =====
  function updateTitle() {
    els.title.textContent = state.examTitle || state.examId;
    if (state.mode === 'wrong') {
      els.modeToggle.style.display = 'none';
    }
  }

  // ===== 렌더링: 페이지 =====
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

    // 페이지 정보
    els.pageInfo.textContent = `${state.currentPage} / ${state.totalPages}`;
    els.prevPage.disabled = state.currentPage === 1;
    els.nextPage.disabled = state.currentPage === state.totalPages;

    updateProgress();
  }

  // ===== 렌더링: 문제 카드 =====
  function renderQuestionCard(q) {
    const card = document.createElement('div');
    card.className = 'question-card';
    if (state.bookmarks[q.no]) card.classList.add('bookmarked');
    card.dataset.no = q.no;

    // 헤더 (번호 + 과목 + 북마크)
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

    // 문제 텍스트
    const qText = document.createElement('div');
    qText.className = 'question-text';
    qText.textContent = q.question || '';
    card.appendChild(qText);

    // passage (지문/보기박스/표)
    if (q.passage) {
      card.appendChild(renderPassage(q.passage));
    }

    // 선택지
    const choicesDiv = document.createElement('div');
    choicesDiv.className = 'choices';
    (q.choices || []).forEach((choiceText, idx) => {
      const choiceNo = idx + 1;
      const choice = document.createElement('div');
      choice.className = 'choice';
      choice.dataset.no = q.no;
      choice.dataset.choice = choiceNo;

      // 선택 상태 반영
      const picked = state.answers[q.no];
      if (picked === choiceNo) choice.classList.add('selected');

      // 학습 모드에서 이미 선택했으면 정답/오답 표시
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

    // 해설 (학습 모드 + 답 선택 시)
    if (q.explanation) {
      const exp = document.createElement('div');
      exp.className = 'explanation';
      if (state.mode === 'study' && state.answers[q.no]) exp.classList.add('show');
      exp.innerHTML = `<span class="label">💡 해설</span>${escapeHtml(q.explanation)}`;
      card.appendChild(exp);
    }

    // 북마크 버튼 이벤트
    const bmBtn = header.querySelector('.bookmark-btn');
    bmBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleBookmark(q.no);
    });

    return card;
  }

  // ===== 렌더링: passage (표/보기/지문) =====
  function renderPassage(passage) {
    const box = document.createElement('div');
    box.className = 'passage';

    // 문자열이면 기본 텍스트로
    if (typeof passage === 'string') {
      box.classList.add('type-text');
      box.textContent = passage;
      return box;
    }

    const type = passage.type || 'text';
    box.classList.add('type-' + type);

    if (type === 'list') {
      // ㄱ, ㄴ, ㄷ 형태 리스트
      const ul = document.createElement('ul');
      (passage.items || []).forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        ul.appendChild(li);
      });
      box.appendChild(ul);
    } else if (type === 'table') {
      // 표 (headers + rows)
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
      // 일반 텍스트
      box.textContent = passage.text || '';
    }

    return box;
  }

  // ===== 선택지 클릭 =====
  function handleChoiceClick(q, choiceNo) {
    if (state.submitted) return;

    state.answers[q.no] = choiceNo;
    saveProgress();
    renderPage();
    updateProgress();
  }

  // ===== 북마크 토글 =====
  function toggleBookmark(no) {
    if (state.bookmarks[no]) {
      delete state.bookmarks[no];
    } else {
      state.bookmarks[no] = true;
    }
    saveProgress();

    // 전역 북마크 저장 (홈 화면에서 모아보기용)
    if (window.Storage && window.Storage.setGlobalBookmark) {
      const q = state.questions.find(qq => qq.no === no);
      if (q) {
        window.Storage.setGlobalBookmark(state.examId, no, !!state.bookmarks[no], q);
      }
    }

    renderPage();
  }

  // ===== 진행률 업데이트 =====
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

    // 시간 색상 경고
    els.timer.classList.remove('warning', 'danger');
    if (remaining <= 60) els.timer.classList.add('danger');
    else if (remaining <= 300) els.timer.classList.add('warning');

    // 표시 (남은 시간)
    els.timer.textContent = formatTime(remaining);

    // 시간 종료
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

    // 채점
    let correct = 0;
    const subjectStats = {}; // { 과목: { correct, total } }
    const reviewData = [];

    state.questions.forEach(q => {
      const picked = state.answers[q.no] || null;
      const isCorrect = picked === q.answer;
      if (isCorrect) correct++;

      const subj = q.subject || '기타';
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
      subjectStats: subjectStats,
      review: reviewData,
      answers: state.answers,
      bookmarks: state.bookmarks,
      submittedAt: Date.now(),
    };

    // 결과 저장
    if (window.Storage && window.Storage.saveSession) {
      window.Storage.saveSession(sessionId, resultData);
    } else {
      // fallback
      localStorage.setItem(`result-${sessionId}`, JSON.stringify(resultData));
    }

    // 진행상황 삭제 (제출 완료)
    localStorage.removeItem(getStorageKey());

    // 이탈 방지 해제
    window.removeEventListener('beforeunload', beforeUnloadHandler);

    // 결과 페이지로 이동
    window.location.href = `result.html?session=${sessionId}`;
  }

  // ===== 이탈 방지 =====
  function beforeUnloadHandler(e) {
    if (state.submitted) return;
    if (Object.keys(state.answers).length === 0) return;
    e.preventDefault();
    e.returnValue = '';
    return '';
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
