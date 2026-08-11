/* 우클릭 / 복사 / 드래그 / 개발자도구 단축키 차단 */
(function () {
  'use strict';

  const isInput = (el) => el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName);

  document.addEventListener('contextmenu', e => e.preventDefault());
  document.addEventListener('dragstart', e => e.preventDefault());

  document.addEventListener('selectstart', e => {
    if (!isInput(e.target)) e.preventDefault();
  });

  document.addEventListener('copy', e => {
    if (!isInput(e.target)) e.preventDefault();
  });

  document.addEventListener('keydown', e => {
    const k = (e.key || '').toUpperCase();
    if (k === 'F12') { e.preventDefault(); return; }
    if (e.ctrlKey && e.shiftKey && ['I', 'J', 'C'].includes(k)) { e.preventDefault(); return; }
    if (e.ctrlKey && ['U', 'S', 'P'].includes(k)) { e.preventDefault(); return; }
    if (e.ctrlKey && k === 'C' && !isInput(e.target)) e.preventDefault();
  });
})();
