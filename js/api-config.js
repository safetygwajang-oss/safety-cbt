/* ============================================================
   js/api-config.js
   ※ __GEMINI_API_KEY__ 는 GitHub Actions 가 배포 시 치환합니다.
     저장소에는 실제 키가 절대 저장되지 않습니다.
   ============================================================ */
(function () {
  'use strict';

  var INJECTED = '__GEMINI_API_KEY__';          // ← Actions 가 교체
  var DAILY_LIMIT = 20;
  var LS_KEY = 'cbt_api_usage';

  function sharedKey() {
    /* 치환이 안 된 상태(로컬 개발)면 빈 값 반환 */
    return INJECTED.indexOf('__GEMINI') === 0 ? '' : INJECTED;
  }

  function today() { return new Date().toISOString().slice(0, 10); }
  function usage() {
    try {
      var o = JSON.parse(localStorage.getItem(LS_KEY) || '{}');
      if (o.date !== today()) o = { date: today(), n: 0 };
      return o;
    } catch (e) { return { date: today(), n: 0 }; }
  }
  function bump() {
    var o = usage(); o.n++;
    try { localStorage.setItem(LS_KEY, JSON.stringify(o)); } catch (e) {}
  }
  function myKey() {
    try { return (localStorage.getItem('gemini_api_key') || '').trim(); }
    catch (e) { return ''; }
  }

  function getKey() {
    var mine = myKey();
    if (mine) return { key: mine, own: true, left: Infinity };

    var shared = sharedKey();
    if (!shared) {
      return { key: '', own: false, left: 0,
        error: '공용 키를 사용할 수 없는 환경입니다.\n' +
               '무료 개인 키를 발급해 등록해 주세요.\nhttps://aistudio.google.com/apikey' };
    }
    var used = usage().n;
    if (used >= DAILY_LIMIT) {
      return { key: '', own: false, left: 0,
        error: '공용 키의 오늘 사용 한도(' + DAILY_LIMIT + '회)를 모두 사용했습니다.\n' +
               '내일 다시 이용하시거나 무료 개인 키를 등록해 주세요.\n' +
               'https://aistudio.google.com/apikey' };
    }
    return { key: shared, own: false, left: DAILY_LIMIT - used };
  }

  window.CBT_API = {
    take: function () {
      var r = getKey();
      if (r.key && !r.own) bump();
      return r;
    },
    peek: getKey,
    remaining: function () {
      return myKey() ? '∞' : Math.max(0, DAILY_LIMIT - usage().n);
    },
    saveOwnKey: function (k) {
      try { localStorage.setItem('gemini_api_key', (k || '').trim()); } catch (e) {}
    },
    clearOwnKey: function () {
      try { localStorage.removeItem('gemini_api_key'); } catch (e) {}
    },
    DAILY_LIMIT: DAILY_LIMIT
  };
})();
