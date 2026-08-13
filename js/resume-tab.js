/* ============================================================
   자기소개서 탭 자동 삽입 (main.js 수정 불필요)
   - toeic.js 와 동일 구조 / 상호 충돌 없음
   ============================================================ */
(function () {
  'use strict';

  var LIST = [
    { href:'resume.html', badge:'AI 작성', title:'AI 자기소개서 작성',
      en:'Gemini 2.5 · 실시간 회사 리서치', tags:['전략서','초안','교정'],
      desc:'채용공고 + 내 경력 붙여넣기 → 전략서 → 초안 → 맞춤법 교정' },
    { href:'study.html?id=resume-guide', badge:'GUIDE', title:'자기소개서 작성 가이드',
      en:'STAR 구조 · 항목별 공략 · 체크리스트', tags:['4단계','템플릿'],
      desc:'서류 채점 기준 / STAR 분량 비율 / 제출 전 최종 점검표' }
  ];

  var BTN_ID   = 'resume-tab-btn';
  var PANEL_ID = 'panel-resume';
  var HIDE_CLS = 'resume-hidden';
  var active = false;

  var st = document.createElement('style');
  st.textContent = '.' + HIDE_CLS + '{display:none !important;}' +
                   '#' + PANEL_ID + '{margin-top:4px;}';
  document.head.appendChild(st);

  /* ---------- 탭 바 찾기 ---------- */
  function tabsBar() {
    return document.querySelector('#main-tabs') ||
           document.querySelector('.main-tabs') ||
           document.querySelector('.exam-tabs') ||
           document.querySelector('.tabs');
  }

  /* ---------- 카드 HTML ---------- */
  function cardsHTML() {
    return LIST.map(function (t) {
      return '<a class="exam-card" href="' + t.href + '" style="text-decoration:none;display:block;">' +
        '<div style="font-size:.7rem;font-weight:800;letter-spacing:.06em;color:#fff;background:var(--primary,#2563eb);display:inline-block;padding:3px 9px;border-radius:20px;margin-bottom:8px;">' + t.badge + '</div>' +
        '<h3>' + t.title + '</h3>' +
        '<div style="font-size:.78rem;color:var(--gray-400,#9ca3af);margin:2px 0 8px;">' + t.en + '</div>' +
        '<div class="exam-tags">' + t.tags.map(function (g) {
          return '<span class="tag">' + g + '</span>';
        }).join('') + '</div>' +
        '<div class="exam-subjects">' + t.desc + '</div>' +
      '</a>';
    }).join('');
  }

  /* ---------- 패널 생성 ---------- */
  function ensurePanel() {
    var p = document.getElementById(PANEL_ID);
    if (p) return p;
    var bar = tabsBar();
    if (!bar) return null;

    p = document.createElement('div');
    p.id = PANEL_ID;
    p.style.display = 'none';
    p.innerHTML =
      '<div class="study-intro"><b>AI 자기소개서</b> · 채용공고 분석 → 경력 매칭 → 초안 생성 → 맞춤법 교정<br>' +
      '<b>전략서를 먼저 생성</b>한 뒤 초안을 만들면 완성도가 크게 올라갑니다.</div>' +
      '<div class="exam-grid" id="resume-list">' + cardsHTML() + '</div>';

    bar.parentNode.insertBefore(p, bar.nextSibling);
    return p;
  }

  /* ---------- 다른 콘텐츠 숨기기 / 되돌리기 ---------- */
  function hideOthers() {
    var sel = '.tab-panel, #exam-list, #dup-list, #dup-locked, .lock-box,' +
              '.exam-grid, .subject-grid, .round-grid, #panel-toeic';
    document.querySelectorAll(sel).forEach(function (el) {
      if (el.id === PANEL_ID) return;
      if (el.closest('#' + PANEL_ID)) return;
      if (el.id === 'recent-list' || el.closest('#recent-section')) return;
      if (el.closest('.bookmark-section')) return;
      el.classList.add(HIDE_CLS);
    });
  }
  function showOthers() {
    document.querySelectorAll('.' + HIDE_CLS).forEach(function (el) {
      el.classList.remove(HIDE_CLS);
    });
  }

  /* ---------- 활성 / 비활성 ---------- */
  function activate() {
    var p = ensurePanel();
    if (!p) return;
    active = true;
    hideOthers();

    /* toeic.js 가 남긴 숨김 클래스가 내 패널에 걸려 있으면 해제 */
    p.classList.remove('toeic-hidden', HIDE_CLS);
    p.querySelectorAll('.toeic-hidden, .' + HIDE_CLS).forEach(function (el) {
      el.classList.remove('toeic-hidden');
      el.classList.remove(HIDE_CLS);
    });

    p.style.display = '';
    var bar = tabsBar();
    if (bar) {
      bar.querySelectorAll('button, a, .main-tab, .tab').forEach(function (b) {
        b.classList.remove('active');
      });
    }
    var btn = document.getElementById(BTN_ID);
    if (btn) btn.classList.add('active');
    try { history.replaceState(null, '', '#resume'); } catch (e) {}
  }
  function deactivate() {
    active = false;
    var p = document.getElementById(PANEL_ID);
    if (p) p.style.display = 'none';
    var btn = document.getElementById(BTN_ID);
    if (btn) btn.classList.remove('active');
    showOthers();
  }

  /* ---------- 탭 버튼 삽입 ---------- */
  function ensureButton() {
    var bar = tabsBar();
    if (!bar) return false;
    if (document.getElementById(BTN_ID)) return true;

    var sample = bar.querySelector('button, a');
    var btn = document.createElement('button');
    btn.id = BTN_ID;
    btn.type = 'button';
    btn.className = sample ? sample.className.replace(/\bactive\b/g, '').trim() : 'main-tab';
    if (!btn.className) btn.className = 'main-tab';
    btn.innerHTML = '📝 자기소개서 <span class="tab-cnt">AI</span>';

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      activate();
    });

    bar.appendChild(btn);
    console.log('[resume-tab] 탭 삽입 완료');
    return true;
  }

  /* ---------- 다른 탭 클릭 시 패널 닫기 ---------- */
  function bindBar() {
    var bar = tabsBar();
    if (!bar || bar.dataset.resumeBound === '1') return;
    bar.dataset.resumeBound = '1';
    bar.addEventListener('click', function (e) {
      var hit = e.target.closest('#' + BTN_ID);
      if (!hit && active) deactivate();
    }, true);
  }

  /* ---------- 탭 바가 다시 그려져도 재삽입 ---------- */
  function watch() {
    var bar = tabsBar();
    if (!bar) return;
    new MutationObserver(function () {
      if (!document.getElementById(BTN_ID)) {
        ensureButton();
        if (active) activate();
      }
    }).observe(bar, { childList: true, subtree: true });
  }

  /* ---------- 최대 10초 대기 ---------- */
  function boot() {
    var tries = 0;
    var timer = setInterval(function () {
      tries++;
      if (ensureButton()) {
        bindBar();
        watch();
        clearInterval(timer);
        if (location.hash === '#resume') setTimeout(activate, 200);
      }
      if (tries > 100) {
        clearInterval(timer);
        console.warn('[resume-tab] 탭 바를 찾지 못했습니다');
      }
    }, 100);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
