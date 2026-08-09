// 회차 목록 로드
async function loadExamList() {
  try {
    const res = await fetch('data/index.json');
    const list = await res.json();
    const container = document.getElementById('exam-list');
    
    container.innerHTML = list.map(exam => `
      <div class="exam-card" onclick="startExam('${exam.id}')">
        <h4>${exam.title}</h4>
        <p class="meta">📅 ${exam.date}</p>
        <p class="meta">📝 ${exam.questions}문항 · ⏱️ ${exam.duration}분</p>
        <div>
          ${exam.subjects.map(s => `<span class="badge">${s}</span>`).join('')}
        </div>
      </div>
    `).join('');
  } catch (e) {
    console.error(e);
    document.getElementById('exam-list').innerHTML = '<p>회차를 불러오지 못했습니다.</p>';
  }
}

function startExam(id) {
  location.href = `exam.html?id=${id}`;
}

// 통계 표시
function renderStats() {
  const results = Storage.getResults();
  const total = results.reduce((sum, r) => sum + r.total, 0);
  const correct = results.reduce((sum, r) => sum + r.correct, 0);
  const rate = total ? Math.round((correct / total) * 100) : 0;
  
  document.getElementById('stat-total').textContent = total;
  document.getElementById('stat-rate').textContent = rate;
  document.getElementById('stat-streak').textContent = Storage.getStreak();
}

// 테마 토글
document.getElementById('theme-toggle').addEventListener('click', () => {
  const cur = Storage.getTheme();
  const next = cur === 'light' ? 'dark' : 'light';
  Storage.setTheme(next);
  document.getElementById('theme-toggle').textContent = next === 'light' ? '🌙' : '☀️';
});

// 초기화
loadExamList();
renderStats();
document.getElementById('theme-toggle').textContent = Storage.getTheme() === 'light' ? '🌙' : '☀️';
