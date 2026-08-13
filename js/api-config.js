/* ============================================================
   안전과장 CBT - AI 접속 설정
   js/api-config.js  (v4 · Cloudflare Pages Functions)
   우선순위 : ① 서버 프록시(/api/ai)  ② 개인 Groq 키
   ============================================================ */
(function () {
  'use strict';

  var PROXY_PATH  = '/api/ai';        /* Pages Functions 경로 */
  var OWN_KEY_LS  = 'cbt_groq_key';
  var USAGE_LS    = 'cbt_api_usage';
  var DAILY_LIMIT = 30;               /* 프록시 사용 시 1인 1일 권장 한도 */

  var health = null;                  /* null=미확인, true/false */
  var healthMsg = '';

  function ownKey() {
    try { return (localStorage.getItem(OWN_KEY_LS) || '').trim(); }
    catch (e) { return ''; }
  }
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

  /* ---------- 서버 상태 점검 ---------- */
  function checkHealth() {
    return fetch(PROXY_PATH, { method: 'GET', cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (j) {
        if (j && j.ok && j.keyConfigured) { health = true; healthMsg = ''; }
        else if (j && j.ok)               { health = false; healthMsg = '서버에 GROQ_API_KEY 환경변수가 없습니다.'; }
        else                              { health = false; healthMsg = '서버 응답이 올바르지 않습니다.'; }
        return health;
      })
      .catch(function (e) {
        health = false;
        healthMsg = '/api/ai 경로를 찾을 수 없습니다 (' + e.message + '). Pages Functions 배포를 확인하세요.';
        return false;
      });
  }

  function peek() {
    var mine = ownKey();

    /* 서버가 정상이면 프록시 우선 */
    if (health === true) {
      var used = usage().n;
      if (!mine && used >= DAILY_LIMIT) {
        return { usable: false, mode: 'shared', quota: true, left: 0, own: false, key: '',
          error: '오늘 사용 한도(' + DAILY_LIMIT + '회)를 모두 사용했습니다.\n' +
                 '내일 다시 이용하시거나, 무료 Groq 개인 키를 등록하면 제한 없이 사용할 수 있습니다.\n' +
                 'https://console.groq.com/keys' };
      }
      return { usable: true, mode: 'proxy', proxy: PROXY_PATH, own: !!mine, key: '',
               left: mine ? Infinity : DAILY_LIMIT - used };
    }

    /* 서버 불가 → 개인 키 */
    if (mine) return { usable: true, mode: 'own', key: mine, own: true, left: Infinity };

    if (health === null) {
      return { usable: false, mode: 'checking', own: false, key: '', left: 0,
               checking: true, error: '서버 연결을 확인하는 중입니다. 잠시 후 다시 시도해 주세요.' };
    }
    return { usable: false, mode: 'none', own: false, key: '', left: 0,
      serverDown: true, serverMsg: healthMsg,
      error: '서버 AI 연결을 사용할 수 없습니다.\n' +
             'Groq 무료 API 키를 발급해 등록하시면 바로 사용할 수 있습니다.\n' +
             'https://console.groq.com/keys' };
  }

  function take() {
    var r = peek();
    if (r.usable && r.mode === 'proxy' && !r.own) bump(+1);
    return r;
  }
  function refund(info) {
    if (info && info.usable && info.mode === 'proxy' && !info.own) bump(-1);
  }

  window.CBT_API = {
    peek: peek, take: take, refund: refund,
    health: function () { return health; },
    healthMsg: function () { return healthMsg; },
    ready: checkHealth,                     /* Promise */
    hasOwn: function () { return !!ownKey(); },
    remaining: function () {
      if (ownKey()) return '무제한';
      return Math.max(0, DAILY_LIMIT - usage().n);
    },
    saveOwnKey: function (k) { try { localStorage.setItem(OWN_KEY_LS, (k || '').trim()); } catch (e) {} },
    clearOwnKey: function () { try { localStorage.removeItem(OWN_KEY_LS); } catch (e) {} },
    debug: function () {
      console.log('%c[CBT_API 진단]', 'font-weight:bold;color:#f55036');
      console.log(' 서버 상태 :', health, healthMsg || 'OK');
      console.log(' 개인키    :', !!ownKey());
      console.log(' 남은 횟수 :', this.remaining());
      console.log(' peek()    :', peek());
      return peek().mode;
    },
    OWN_KEY_LS: OWN_KEY_LS,
    DAILY_LIMIT: DAILY_LIMIT
  };

  checkHealth();   /* 즉시 점검 시작 */
})();
