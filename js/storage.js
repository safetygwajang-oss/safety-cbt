// 공통 LocalStorage 관리
const Storage = {
  // 시험 진행 상태 저장
  saveExamState(examId, state) {
    localStorage.setItem(`exam_${examId}`, JSON.stringify(state));
  },
  loadExamState(examId) {
    const raw = localStorage.getItem(`exam_${examId}`);
    return raw ? JSON.parse(raw) : null;
  },
  clearExamState(examId) {
    localStorage.removeItem(`exam_${examId}`);
  },

  // 결과 이력
  saveResult(result) {
    const list = this.getResults();
    list.push({ ...result, at: Date.now() });
    localStorage.setItem('results', JSON.stringify(list));
  },
  getResults() {
    return JSON.parse(localStorage.getItem('results') || '[]');
  },

  // 오답 노트
  addWrongNotes(examId, wrongList) {
    const notes = this.getWrongNotes();
    wrongList.forEach(q => {
      notes.push({ examId, ...q, at: Date.now() });
    });
    localStorage.setItem('wrongNotes', JSON.stringify(notes));
  },
  getWrongNotes() {
    return JSON.parse(localStorage.getItem('wrongNotes') || '[]');
  },

  // 최근 결과(결과페이지 전달용)
  setLastResult(data) {
    sessionStorage.setItem('lastResult', JSON.stringify(data));
  },
  getLastResult() {
    return JSON.parse(sessionStorage.getItem('lastResult') || 'null');
  },

  // 테마
  getTheme() { return localStorage.getItem('theme') || 'light'; },
  setTheme(t) {
    localStorage.setItem('theme', t);
    document.documentElement.dataset.theme = t;
  },

  // 스트릭
  updateStreak() {
    const today = new Date().toDateString();
    const last = localStorage.getItem('lastStudyDate');
    let streak = parseInt(localStorage.getItem('streak') || '0');
    
    if (last === today) return streak;
    
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    if (last === yesterday.toDateString()) {
      streak++;
    } else {
      streak = 1;
    }
    localStorage.setItem('streak', streak);
    localStorage.setItem('lastStudyDate', today);
    return streak;
  },
  getStreak() { return parseInt(localStorage.getItem('streak') || '0'); }
};

// 페이지 로드 시 테마 적용
document.documentElement.dataset.theme = Storage.getTheme();
