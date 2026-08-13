/* ============================================================
   안전과장 CBT - API 접속 설정
   js/api-config.js  (v3 · Groq)
   ------------------------------------------------------------
   우선순위 : ① 프록시(Worker)  ② 개인 Groq 키  ③ 공용 주입 키
   ============================================================ */
(function () {
  'use strict';

  /* ============================================================
     ★★ 여기만 수정하세요 ★★
     Cloudflare Worker 주소 (권장 · 키가 노출되지 않습니다)
     예) 'https://cbt-groq.내계정.workers.dev'
     ============================================================ */
  var PROXY_URL = '';

  /* 프록시를 못 쓸 때만 사용하는 공용 키 (GitHub Actions 주입)
     ⚠️ Groq 키는 도메인 제한이 불가하므로 가급적 프록시를 쓰세요. */
  var INJECTED = '__GROQ_API_KEY__';
  var TOKEN    = '__' + 'GROQ_API_KEY' + '__';

  var DAILY_LIMIT = 20;                /* 공용 키 1인 1일 한도 */
  var OWN_KEY_LS  = 'cbt_groq_key';
  var USAGE_LS    = 'cbt_api_usage';

  function injectState() {
    if (!INJECTED)            return 'empty';
    if (INJECTED === TOKEN)   return 'not_injected';
    if (INJECTED.length < 20) return 'too_short';
    return 'ok';
  }
  function sharedKey() { return injectState() === 'ok' ? INJECTED : ''; }

  function today() { return new Date().toISOString().slice(0, 10); }
  function usage() {
    try {
      var o = JSON.parse(localStorage.getItem(USAGE_LS) || '{}');
      if (o.date !== today()) o = { date: today(), n: 0 };
      return o;
    } catch (e) { return { date: today(), n: 0 }; }
  }
  function bump(d) {
    var o = usage();
    o.n = Math.max(0, o.n + d);
    try { localStorage.setItem(USAGE_LS, JSON.stringify(o)); } catch (e) {}
    return o.n;
  }
  function ownKey() {
    try { return (localStorage.getItem(OWN_KEY_LS) || '').trim(); }
    catch (e) { return ''; }
  }

  /* ---------- 접속 방식 결정 ---------- */
  function peek() {
    /* ① 프록시 : 키 불필요 */
    if (PROXY_URL) {
      return { usable: true, mode: 'proxy', proxy: PROXY_URL,
               key: '', own: false, left: Infinity, state: 'proxy' };
    }

    /* ② 개인 키 */
    var mine = ownKey();
    if (mine) {
      return { usable: true, mode: 'own', key: mine, own: true,
               left: Infinity, state: 'own' };
    }

    /* ③ 공용 주입 키 */
    var sh = sharedKey();
    if (!sh) {
      var isLocal = location.protocol === 'file:' ||
                    /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
      return {
        usable: false, mode: 'none', key: '', own: false, left: 0,
        state: injectState(),
        error: (isLocal ? '로컬 환경에서는 공용 키가 적용되지 않습니다.\n'
                        : '공용 AI 키가 아직 적용되지 않았습니다.\n') +
               'Groq 무료 API 키를 발급해 등록하시면 바로 사용할 수 있습니다.\n' +
               'https://console.groq.com/keys'
      };
    }

    var used = usage().n;
    if (used >= DAILY_LIMIT) {
      return {
        usable: false, mode: 'shared', key: '', own: false, left: 0,
        quota: true, state: 'quota',
        error: '공용 키의 오늘 사용 한도(' + DAILY_LIMIT + '회)를 모두 사용했습니다.\n' +
               '내일 다시 이용하시거나, 무료 개인 키를 등록하면 제한 없이 사용할 수 있습니다.\n' +
               'https://console.groq.com/keys'
      };
    }
    return { usable: true, mode: 'shared', key: sh, own: false,
             left: DAILY_LIMIT - used, state: 'shared' };
  }

  function take() {
    var r = peek();
    if (r.usable && r.mode === 'shared') bump(+1);
    return r;
  }
  function refund(info) {
    if (info && info.usable && info.mode === 'shared') bump(-1);
  }

  window.CBT_API = {
    peek: peek,
    take: take,
    refund: refund,
    proxyUrl: function () { return PROXY_URL; },
    hasProxy: function () { return !!PROXY_URL; },
    hasShared: function () { return !!sharedKey(); },
    hasOwn: function () { return !!ownKey(); },
    injectState: injectState,
    remaining: function () {
      if (PROXY_URL || ownKey()) return '무제한';
      return Math.max(0, DAILY_LIMIT - usage().n);
    },
    saveOwnKey: function (k) {
      try { localStorage.setItem(OWN_KEY_LS, (k || '').trim()); } catch (e) {}
    },
    clearOwnKey: function () {
      try { localStorage.removeItem(OWN_KEY_LS); } catch (e) {}
    },
    debug: function () {
      var i = peek();
      console.log('%c[CBT_API 진단 · Groq]', 'font-weight:bold;color:#f55036');
      console.log(' 접속 방식  :', i.mode, '(proxy > own > shared)');
      console.log(' 프록시 URL :', PROXY_URL || '(미설정)');
      console.log(' 주입 상태  :', injectState());
      console.log(' 개인키 등록:', !!ownKey());
      console.log(' 남은 횟수  :', this.remaining());
      console.log(' 사용 가능  :', i.usable, i.error || '');
      return i.mode;
    },
    OWN_KEY_LS: OWN_KEY_LS,
    DAILY_LIMIT: DAILY_LIMIT
  };
})();
