const result = Storage.getLastResult();

if (!result) {
  alert('결과 데이터가 없습니다.');
  location.href = 'index.html';
}

// ===== 요약 =====
const percent = Math.round((result.correct / result.total) * 100);
document.getElementById('score').textContent = result.correct;
document.getElementById('percent').textContent = percent;
document.getElementById('pass-status').textContent = percent >= 60 ? '🎉 합격' : '😢 불합격';
document.getElementById('pass-status').style.color = percent >= 60 ? 'var(--success)' : 'var(--danger)';

const h = Math.floor(result.elapsedSec / 3600);
const m = Math.floor((result.elapsedSec % 3600) / 60);
const s = result.elapsedSec % 60;
document.getElementById('elapsed').textContent = 
  `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;

// ===== 과목별 차트 =====
const subjectStats = result.subjects.map(sub => {
  const qs = result.details.filter(d => d.subject === sub.name);
  const c = qs.filter(d => d.isCorrect).length;
  return { name: sub.name, correct: c, total: qs.length, rate: Math.round(c/qs.length*100) };
});

new Chart(document.getElementById('subject-chart'), {
  type: 'radar',
  data: {
    labels: subjectStats.map(s => s.name),
    datasets: [{
      label: '정답률(%)',
      data: subjectStats.map(s => s.rate),
      backgroundColor: 'rgba(234, 88, 12, 0.2)',
      borderColor: 'rgba(234, 88, 12, 1)',
      borderWidth: 2
    }]
  },
  options: {
    scales: { r: { beginAtZero: true, max: 100 } }
  }
});

// ===== 리뷰 리스트 =====
function renderReview(filter = 'all') {
  const list = result.details.filter(d => {
    if (filter === 'wrong') return !d.isCorrect;
    if (filter === 'correct') return d.isCorrect;
    return true;
  });
  
  document.getElementById('review-list').innerHTML = list.map(d => `
    <div class="review-item ${d.isCorrect ? 'correct' : 'wrong'}">
      <strong>${d.no}. [${d.subject}]</strong> ${d.isCorrect ? '✅' : '❌'}
      <p>${d.question}</p>
      <p><small>정답: ${d.answer}번 ${d.userAnswer ? `/ 내 답: ${d.userAnswer}번` : '/ 미응답'}</small></p>
      <p style="margin-top:8px;color:var(--text-sub);"><strong>💡 해설:</strong> ${d.explanation || '-'}</p>
    </div>
  `).join('') || '<p>해당하는 문항이 없습니다.</p>';
}

// 탭 이벤트
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    renderReview(tab.dataset.filter);
  });
});

renderReview('all');

// 오답만 다시 풀기 (다음 단계 구현)
document.getElementById('retry-wrong').addEventListener('click', () => {
  alert('오답 재도전 기능은 다음 업데이트 예정입니다!');
});
