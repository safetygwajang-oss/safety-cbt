/* ============================================================
   안전과장 CBT - 자기소개서 탭 추가
   resume-tab.js
   main.js / toeic.js 가 #main-tabs 를 그린 뒤 탭 1개를 덧붙임
   ============================================================ */
(function () {
  'use strict';

  const LABEL = '📝 자기소개서';
  const BADGE = 'AI';
  const HREF  = 'resume.html';
  const MARK  = 'data-tab-resume';

  let done = false;

  function addTab() {
    if (done) return true;

    const wrap = document.getElementById('main-tabs');
    if (!wrap) return false;
    if (wrap.querySelector('[' + MARK + ']')) { done = true; return true; }

    /* 기존 탭 하나를 샘플로 삼아 클래스를 그대로 복사 */
    const sample = wrap.querySelector('button, a, .main-tab');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute(MARK, '1');
    btn.className = sample
      ? (sample.className || 'main-tab').replace(/\bactive\b/g, '').trim()
      : 'main-tab';

    /* 라벨 + 배지 (기존 탭의 카운트 배지 클래스 재사용) */
    btn.appendChild(document.createTextNode(LABEL));
    const cntSample = sample && sample.querySelector('.tab-cnt, .cnt, span');
    const badge = document.createElement('span');
    badge.className = cntSample ? cntSample.className : 'tab-cnt';
    badge.textContent = BADGE;
    btn.appendChild(badge);

    /* main.js 의 탭 전환 핸들러가 먹지 않도록 캡처 단계에서 가로챔 */
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      location.href = HREF;
    }, true);

    wrap.appendChild(btn);
    done = true;
    return true;
  }

  /* 1) 즉시 시도 */
  if (document.readyState !== 'loading') addTab();
  document.addEventListener('DOMContentLoaded', addTab);

  /* 2) main.js·toeic.js 가 나중에 렌더링하는 경우 감시 */
  function observe() {
    const wrap = document.getElementById('main-tabs');
    if (!wrap || !window.MutationObserver) return;
    const mo = new MutationObserver(function () {
      if (addTab()) mo.disconnect();
    });
    mo.observe(wrap, { childList: true });
    /* 안전장치 : 5초 뒤에도 못 붙었으면 강제 삽입 */
    setTimeout(function () { addTab(); mo.disconnect(); }, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', observe);
  } else {
    observe();
  }
})();
