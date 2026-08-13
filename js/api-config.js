/* ============================================================
   안전과장 CBT - 공용 API 키 관리
   js/api-config.js  (v1)
   ------------------------------------------------------------
   ※ __GEMINI_API_KEY__ 는 GitHub Actions 가 배포 시 치환합니다.
      저장소에는 실제 키가 저장되지 않습니다.
   ※ 로컬에서 열면 치환이 안 되므로 개인 키 입력 모드로 동작합니다.
   ============================================================ */
(function () {
  'use strict';

  /* ---------- 배포 시 주입되는 공용 키 ---------- */
  var INJECTED = '__GEMINI_API_KEY__';

  /* ---------- 설정 ---------- */
  var DAILY_LIMIT = 20;                 // 공용 키 1인 1일 최대 호출 수
  var OWN_KEY_LS  = 'cbt_gemini_key';   // 개인 키 저장소 (resume-ai.js 와 동일)
  var USAGE_LS    = 'cbt_api_usage';

  /* ---------- 공용 키 ---------- */
  function sharedKey() {
    /* 치환 전 상태면 빈 값 */
    if (!INJECTED || INJECTED.indexOf('__GEMINI') === 0) return '';
    return INJECTED;
  }

  /* ---------- 사용량 ---------- */
  function today() { return new Date().toISOString().slice(0, 10); }

  function usage() {
    try {
      var o = JSON.parse(localStorage.getItem(USAGE_LS) || '{}');
      if (o.date !== today()) o = { date: today(), n: 0 };
      return o;
    } catch (e) { return { date: today(), n: 0 }; }
  }
  function save(o) {
    try { localStorage.setItem(USAGE_LS, JSON.stringify(o)); } catch (e) {}
  }
  function bump(d) {
    var o = usage();
    o.n = Math.max(0, o.n + d);
    save(o);
    return o.n;
  }

  /* ---------- 개인 키 ---------- */
  function ownKey() {
    try { return (localStorage.getItem(OWN_KEY_LS) || '').trim(); }
    catch (e) { return ''; }
  }

  /* ---------- 키 결정 (개인 키 우선) ---------- */
  function peek() {
    var mine = ownKey();
    if (mine) {
      return { usable: true, key: mine, own: true, left: Infinity };
    }

    var sh = sharedKey();
    if (!sh) {
      return { usable: false, key: '', own: false, left: 0, noShared: true,
        error: '이 환경에서는 공용 키를 사용할 수 없습니다.\n' +
               '무료 Gemini API 키를 발급해 등록해 주세요.\n' +
               'https://aistudio.google.com/apikey' };
    }

    var used = usage().n;
    if (used >= DAILY_LIMIT) {
      return { usable: false, key: '', own: false, left: 0, quota: true,
        error: '공용 키의 오늘 사용 한도(' + DAILY_LIMIT + '회)를 모두 사용했습니다.\n' +
               '내일 다시 이용하시거나, 무료 개인 키를 발급해 등록하시면 제한 없이 사용할 수 있습니다.\n' +
               'https://aistudio.google.com/apikey' };
    }

    return { usable: true, key: sh, own: false, left: DAILY_LIMIT - used };
  }

  /* ---------- 실제 호출 직전에 사용 (사용량 1 증가) ---------- */
  function take() {
    var r = peek();
    if (r.usable && !r.own) bump(+1);
    return r;
  }

  /* ---------- 호출이 실패했을 때 사용량 되돌리기 ---------- */
  function refund(info) {
    if (info && info.usable && !info.own) bump(-1);
  }

  window.CBT_API = {
    peek: peek,
    take: take,
    refund: refund,
    hasShared: function () { return !!sharedKey(); },
    hasOwn: function () { return !!ownKey(); },
    remaining: function () {
      return ownKey() ? '무제한' : Math.max(0, DAILY_LIMIT - usage().n);
    },
    saveOwnKey: function (k) {
      try { localStorage.setItem(OWN_KEY_LS, (k || '').trim()); } catch (e) {}
    },
    clearOwnKey: function () {
      try { localStorage.removeItem(OWN_KEY_LS); } catch (e) {}
    },
    OWN_KEY_LS: OWN_KEY_LS,
    DAILY_LIMIT: DAILY_LIMIT
  };
})();
