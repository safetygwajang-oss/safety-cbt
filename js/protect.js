/* ============================================
   안전과장 CBT - 콘텐츠 보호
   protect.js (v2)
   우클릭 / 드래그 / 복사 / 롱탭 / 개발자도구 / 인쇄 차단
   ============================================ */

(function () {
  'use strict';

  /* 입력 가능한 요소인지 판별 (입력창에서는 차단 예외) */
  function isEditable(el) {
    if (!el || !el.tagName) return false;
    if (/^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(el.tagName)) return true;
    if (el.isContentEditable) return true;
    return false;
  }

  /* ============================================
     1. 보호용 CSS 주입
     - 텍스트 선택 / 롱탭 메뉴 / 이미지 드래그 차단
     - 입력창은 정상 동작 유지
     - 인쇄 시 내용 숨김
     ============================================ */
  function injectStyle() {
    const css = [
      'body{',
      '-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none;',
      '-webkit-touch-callout:none;',
      '}',
      'input,textarea,select,[contenteditable="true"]{',
      '-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text;',
      '-webkit-touch-callout:default;',
      '}',
      'img,svg,canvas{',
      '-webkit-user-drag:none;user-drag:none;pointer-events:auto;',
      '}',
      '@media print{',
      'body{display:none !important;}',
      'html::after{content:"인쇄가 제한된 콘텐츠입니다.";display:block;padding:40px;font-size:16px;}',
      '}'
    ].join('');

    const style = document.createElement('style');
    style.setAttribute('data-cbt-protect', '1');
    style.textContent = css;

    if (document.head) {
      document.head.appendChild(style);
    } else {
      document.addEventListener('DOMContentLoaded', function () {
        document.head.appendChild(style);
      });
    }
  }

  injectStyle();

  /* ============================================
     2. 마우스 우클릭 금지
     ============================================ */
  document.addEventListener('contextmenu', function (e) {
    e.preventDefault();
  }, { capture: true });

  /* ============================================
     3. 드래그 / 선택 / 복사 / 잘라내기 금지
     ============================================ */
  document.addEventListener('dragstart', function (e) {
    e.preventDefault();
  }, { capture: true });

  document.addEventListener('selectstart', function (e) {
    if (!isEditable(e.target)) e.preventDefault();
  }, { capture: true });

  document.addEventListener('copy', function (e) {
    if (!isEditable(e.target)) e.preventDefault();
  }, { capture: true });

  document.addEventListener('cut', function (e) {
    if (!isEditable(e.target)) e.preventDefault();
  }, { capture: true });

  /* ============================================
     4. 모바일 롱탭(길게 누르기) 복사 메뉴 차단
     ============================================ */
  let touchTimer = null;

  document.addEventListener('touchstart', function (e) {
    if (isEditable(e.target)) return;
    touchTimer = setTimeout(function () {
      /* 선택 영역 강제 해제 */
      if (window.getSelection) {
        const sel = window.getSelection();
        if (sel && sel.removeAllRanges) sel.removeAllRanges();
      }
    }, 400);
  }, { passive: true });

  document.addEventListener('touchend', function () {
    if (touchTimer) clearTimeout(touchTimer);
  }, { passive: true });

  document.addEventListener('touchmove', function () {
    if (touchTimer) clearTimeout(touchTimer);
  }, { passive: true });

  /* ============================================
     5. 단축키 차단
     F12 / Ctrl+Shift+I,J,C,K,E / Ctrl+U,S,P / Ctrl+C,A
     ============================================ */
  document.addEventListener('keydown', function (e) {
    const k = (e.key || '').toUpperCase();
    const editable = isEditable(e.target);

    /* 개발자도구 */
    if (k === 'F12') {
      e.preventDefault();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
      if (k === 'I' || k === 'J' || k === 'C' || k === 'K' || k === 'E') {
        e.preventDefault();
        return;
      }
    }

    /* 소스보기(U) · 저장(S) · 인쇄(P) */
    if ((e.ctrlKey || e.metaKey) && (k === 'U' || k === 'S' || k === 'P')) {
      e.preventDefault();
      return;
    }

    /* 복사(C) · 전체선택(A) — 입력창은 허용 */
    if ((e.ctrlKey || e.metaKey) && (k === 'C' || k === 'A') && !editable) {
      e.preventDefault();
      return;
    }
  }, { capture: true });

})();
