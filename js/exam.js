// URL에서 examId 파싱
const params = new URLSearchParams(location.search);
const examId = params.get('id');

let examData = null;
let answers = {};        // {문제번호: 선택번호}
let bookmarks = new Set();
let currentPage = 0;
let perPage = 2;
let studyMode = false;   // false=실전, true=학습(즉시해설)
let timerInterval = null;
let remainingSec = 0;
let startTime = Date.now();

// ===== 초기화 =====
async function init() {
  try {
    const res = await fetch(`data/${examId}.json`);
    examData = await res.json();
    
    document.getElementById('exam-title').textContent = examData.title;
    remainingSec = examData.duration * 60;
    
    // 진행 중이던 시험 복원
    const saved = Storage.loadExamState(examId);
    if (saved && confirm('이전 진행 상황이 있습니다. 이어서 하시겠습니까?')) {
      answers = saved.answers || {};
      bookmarks = new Set(saved.bookmarks || []);
      remainingSec = saved.remainingSec || remainingSec;
      currentPage = saved.currentPage || 0;
    }
    
    render();
    renderOMR();
    startTimer();
    bindEvents();
  } catch (e) {
    alert('문제를 불러오지 못했습니다.');
    console.error(e);
  }
}

// ===== 문제 렌더링 =====
function render() {
  const start = currentPage * perPage;
  const end = Math.min(start + perPage, examData.questions.length);
  const area = document.getElementById('question-area');
  
  area.innerHTML = examData.questions.slice(start, end).map(q => {
    const selected = answers[q.no];
    const showAns = studyMode && selected !== undefined;
    
    return `
      <div class="question-card" data-no="${q.no}">
        <div class="question-header">
          <div>
            <span class="question-no">${q.no}</span>
            <span class="subject-tag">${q.subject}</span>
          </div>
          <div class="question-actions">
            <button class="btn-icon" onclick="toggleBookmark(${q.no})" title="북마크">
              ${bookmarks.has(q.no) ? '⭐' : '☆'}
            </button>
          </div>
        </div>
        <div class="question-text">${q.question}</div>
        <div class="choices">
          ${q.choices.map((c, i) => {
            const num = i + 1;
            let cls = 'choice';
            if (selected === num) cls += ' selected';
            if (showAns) {
              if (num === q.answer) cls += ' correct';
              else if (selected === num) cls += ' wrong';
            }
            return `
              <div class="${cls}" onclick="selectAnswer(${q.no}, ${num})">
                <span class="choice-no">${num}</span>
                <span>${c}</span>
              </div>
            `;
          }).join('')}
        </div>
        <div class="explanation ${showAns ? 'show' : ''}">
          <span class="label">💡 해설</span>${q.explanation || '해설이 준비 중입니다.'}
        </div>
      </div>
    `;
  }).join('');
  
  // 페이지 정보 & 진행바
  const totalPages = Math.ceil(examData.questions.length / perPage);
  document.getElementById('page-info').textContent = `${currentPage + 1} / ${totalPages}`;
  
  const answered = Object.keys(answers).length;
  const progressPct = (answered / examData.questions.length) * 100;
  document.getElementById('progress-fill').style.width = progressPct + '%';
}

// ===== OMR 답안지 =====
function renderOMR() {
  const list = document.getElementById('omr-list');
  list.innerHTML = examData.questions.map(q => `
    <div class="omr-row">
      <span class="no">${q.no}</span>
      ${[1,2,3,4].map(n => `
        <div class="omr-cell ${answers[q.no] === n ? 'marked' : ''}" 
             onclick="selectAnswer(${q.no}, ${n}); jumpTo(${q.no})">${n}</div>
      `).join('')}
    </div>
  `).join('');
}

// ===== 답안 선택 =====
function selectAnswer(no, choice) {
  answers[no] = choice;
  save();
  render();
  renderOMR();
}

// ===== 북마크 =====
function toggleBookmark(no) {
  if (bookmarks.has(no)) bookmarks.delete(no);
  else bookmarks.add(no);
  save();
  render();
}

// ===== 문제로 점프 =====
function jumpTo(no) {
  currentPage = Math.floor((no - 1) / perPage);
  render();
}

// ===== 타이머 =====
function startTimer() {
  updateTimer();
  timerInterval = setInterval(() => {
    remainingSec--;
    if (remainingSec <= 0) {
      clearInterval(timerInterval);
      alert('시험 시간이 종료되었습니다.');
      submitExam();
    }
    updateTimer();
    if (remainingSec % 10 === 0) save();  // 10초마다 저장
  }, 1000);
}
function updTwo(n) { return String(n).padStart(2, '0'); }
function updateTimer() {
  const h = Math.floor(remainingSec / 3600);
  const m = Math.floor((remainingSec % 3600) / 60);
  const s = remainingSec % 60;
  document.getElementById('timer').textContent = `${updTwo(h)}:${updTwo(m)}:${updTwo(s)}`;
}

// ===== 저장 =====
function save() {
  Storage.saveExamState(examId, {
    answers,
    bookmarks: [...bookmarks],
    remainingSec,
    currentPage
  });
}

// ===== 제출 =====
function submitExam() {
  const unanswered = examData.questions.length - Object.keys(answers).length;
  if (unanswered > 0 && !confirm(`아직 ${unanswered}문항 미응답입니다. 제출하시겠습니까?`)) return;
  
  clearInterval(timerInterval);
  
  // 채점
  let correct = 0;
  const details = examData.questions.map(q => {
    const user = answers[q.no];
    const isCorrect = user === q.answer;
    if (isCorrect) correct++;
    return { ...q, userAnswer: user, isCorrect };
  });
  
  const elapsedSec = examData.duration * 60 - remainingSec;
  
  const result = {
    examId,
    title: examData.title,
    total: examData.questions.length,
    correct,
    elapsedSec,
    details,
    subjects: examData.subjects
  };
  
  // 저장
  Storage.setLastResult(result);
  Storage.saveResult({
    examId,
    title: examData.title,
    total: result.total,
    correct: result.correct,
    at: Date.now()
  });
  Storage.addWrongNotes(examId, details.filter(d => !d.isCorrect));
  Storage.updateStreak();
  Storage.clearExamState(examId);
  
  location.href = 'result.html';
}

// ===== 이벤트 =====
function bindEvents() {
  document.getElementById('submit-btn').addEventListener('click', submitExam);
  document.getElementById('reset-btn').addEventListener('click', () => {
    if (confirm('답안을 모두 초기화하시겠습니까?')) {
      answers = {};
      save();
      render();
      renderOMR();
    }
  });
  document.getElementById('prev-page').addEventListener('click', () => {
    if (currentPage > 0) { currentPage--; render(); }
  });
  document.getElementById('next-page').addEventListener('click', () => {
    const total = Math.ceil(examData.questions.length / perPage);
    if (currentPage < total - 1) { currentPage++; render(); }
  });
  document.getElementById('per-page').addEventListener('change', (e) => {
    perPage = parseInt(e.target.value);
    currentPage = 0;
    render();
  });
  document.getElementById('mode-toggle').addEventListener('click', (e) => {
    studyMode = !studyMode;
    e.target.textContent = studyMode ? '🎯 실전모드' : '📖 학습모드';
    render();
  });
  
  // 키보드 단축키
  document.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
    if (e.key === 'ArrowLeft') document.getElementById('prev-page').click();
    if (e.key === 'ArrowRight') document.getElementById('next-page').click();
  });
}

init();
