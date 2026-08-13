/* 토익스피킹 탭 - 카드 목록 렌더 */
(function () {
  var TOEIC = [
    { id: 'toeic-part1', part: 'PART 1', title: '문장 읽기', en: 'Read a text aloud',
      q: 'Q1~2', prep: '준비 45초', ans: '답변 45초',
      desc: '끊어읽기 · 강세 · 억양 · 연음 · 속도 완전정리' },
    { id: 'toeic-part2', part: 'PART 2', title: '사진 묘사', en: 'Describe a picture',
      q: 'Q3~4', prep: '준비 45초', ans: '답변 30초',
      desc: '서론 → 전체요약 → 인물묘사 → 사물·배경 → 마무리 템플릿' },
    { id: 'toeic-part3', part: 'PART 3', title: '듣고 질문에 답하기', en: 'Respond to questions',
      q: 'Q5~7', prep: '준비 3초', ans: '답변 15/15/30초',
      desc: '이유 만능문장 · 답변 공식 · 시간 채우기 전략' },
    { id: 'toeic-part4', part: 'PART 4', title: '제공된 정보로 답하기', en: 'Respond using information',
      q: 'Q8~10', prep: '표 읽기 45초', ans: '답변 15/15/30초',
      desc: '일정표·이력서·수업표 패턴 문장 총정리' },
    { id: 'toeic-part5', part: 'PART 5', title: '의견 제시하기', en: 'Express an opinion',
      q: 'Q11', prep: '준비 30초', ans: '답변 60초',
      desc: '서론-본론2-결론 템플릿 + 이유 만능문장' }
  ];

  function render() {
    var box = document.getElementById('toeic-list');
    if (!box) return;
    box.innerHTML = TOEIC.map(function (t) {
      return '' +
      '<a class="exam-card" href="study.html?id=' + t.id + '" style="text-decoration:none; display:block;">' +
        '<div style="font-size:0.7rem;font-weight:800;letter-spacing:.06em;color:#fff;background:var(--primary);display:inline-block;padding:3px 9px;border-radius:20px;margin-bottom:8px;">' + t.part + '</div>' +
        '<h3>' + t.title + '</h3>' +
        '<div style="font-size:0.78rem;color:var(--gray-400);margin:2px 0 8px;">' + t.en + ' · ' + t.q + '</div>' +
        '<div class="exam-tags">' +
          '<span class="tag">' + t.prep + '</span>' +
          '<span class="tag">' + t.ans + '</span>' +
        '</div>' +
        '<div class="exam-subjects">' + t.desc + '</div>' +
      '</a>';
    }).join('');
  }

  /* 탭 전환: main.js가 처리하지 않는 경우를 대비한 안전장치 */
  function bindTabs() {
    var tabs = document.querySelectorAll('.main-tab');
    if (!tabs.length) return;
    tabs.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.dataset.tab;
        tabs.forEach(function (b) { b.classList.toggle('active', b === btn); });
        ['rounds', 'dup', 'toeic'].forEach(function (k) {
          var p = document.getElementById('panel-' + k);
          if (p) p.style.display = (k === key) ? '' : 'none';
        });
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    render();
    bindTabs();
    if (location.hash === '#toeic') {
      var t = document.querySelector('.main-tab[data-tab="toeic"]');
      if (t) t.click();
    }
  });
})();
