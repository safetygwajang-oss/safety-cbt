/* ============================================================
   안전과장 CBT - 공용 API 키 관리
   js/api-config.js  (v2 · 자기진단 내장)
   ------------------------------------------------------------
   __GEMINI_API_KEY__ 는 GitHub Actions 가 배포 시 치환합니다.
   치환이 안 되면 CBT_API.debug() 가 원인을 알려줍니다.
   ============================================================ */
(function () {
  'use strict';

  /* 문자열을 쪼개 두면 Actions 치환 후에도 판별 로직이 오작동하지 않습니다 */
  var INJECTED = '__GEMINI_API_KEY__';
  var TOKEN    = '__' + 'GEMINI_API_KEY' + '__';

  var DAILY_LIMIT = 20;
  var OWN_KEY_LS  = 'cbt_gemini_key';
  var USAGE_LS    = 'cbt_api_usage';

  /* ---------- 주입 상태 판정 ---------- */
  function injectState() {
    if (!INJECTED)                return 'empty';       /* 값이 비었음 */
    if (INJECTED === TOKEN)       return 'not_injected'; /* 치환 안 됨 */
    if (INJECTED.length < 20)     return 'too_short';    /* 잘못된 값 */
    return 'ok';
  }

  function sharedKey() {
    return injectState() === 'ok' ? INJECTED : '';
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

  /* ---------- 키 결정 ---------- */
  function peek() {
    var mine = ownKey();
    if (mine) return { usable: true, key: mine, own: true, left: Infinity, state: 'own' };

    var sh = sharedKey();
    if (!sh) {
      var st = injectState();
      var isLocal = location.protocol === 'file:' ||
                    /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
      return {
        usable: false, key: '', own: false, left: 0,
        noShared: true, state: st,
        error: isLocal
          ? '로컬 환경에서는 공용 키가 적용되지 않습니다.\n' +
            '무료 Gemini API 키를 발급해 아래에 등록하면 바로 사용할 수 있습니다.\n' +
            'https://aistudio.google.com/apikey'
          : '공용 키가 아직 서버에 적용되지 않았습니다.\n' +
            '무료 Gemini API 키를 발급해 등록하시면 바로 사용할 수 있습니다.\n' +
            'https://aistudio.google.com/apikey'
      };
    }

    var used = usage().n;
    if (used >= DAILY_LIMIT) {
      return {
        usable: false, key: '', own: false, left: 0, quota: true, state: 'quota',
        error: '공용 키의 오늘 사용 한도(' + DAILY_LIMIT + '회)를 모두 사용했습니다.\n' +
               '내일 다시 이용하시거나, 무료 개인 키를 등록하면 제한 없이 사용할 수 있습니다.\n' +
               'https://aistudio.google.com/apikey'
      };
    }

    return { usable: true, key: sh, own: false, left: DAILY_LIMIT - used, state: 'shared' };
  }

  function take() {
    var r = peek();
    if (r.usable && !r.own) bump(+1);
    return r;
  }
  function refund(info) {
    if (info && info.usable && !info.own) bump(-1);
  }

  window.CBT_API = {
    peek: peek,
    take: take,
    refund: refund,
    hasShared: function () { return !!sharedKey(); },
    hasOwn: function () { return !!ownKey(); },
    injectState: injectState,
    remaining: function () {
      return ownKey() ? '무제한' : Math.max(0, DAILY_LIMIT - usage().n);
    },
    saveOwnKey: function (k) {
      try { localStorage.setItem(OWN_KEY_LS, (k || '').trim()); } catch (e) {}
    },
    clearOwnKey: function () {
      try { localStorage.removeItem(OWN_KEY_LS); } catch (e) {}
    },

    /* ---------- 콘솔 진단 : CBT_API.debug() ---------- */
    debug: function () {
      var st = injectState();
      var msg = {
        ok:            '✅ 공용 키 정상 주입',
        not_injected:  '❌ 치환 안 됨 → Settings > Pages > Source 를 [GitHub Actions] 로 바꾸고, Actions 탭에서 워크플로 성공(✅) 확인',
        empty:         '❌ 주입값이 비어 있음 → Secret 값이 비었는지 확인',
        too_short:     '❌ 주입값이 비정상(20자 미만) → Secret 값 재등록'
      }[st];
      console.log('%c[CBT_API 진단]', 'font-weight:bold;color:#2563eb');
      console.log(' 상태        :', st, '-', msg);
      console.log(' 공용키 사용 :', !!sharedKey());
      console.log(' 개인키 등록 :', !!ownKey());
      console.log(' 남은 횟수   :', this.remaining());
      console.log(' 현재 주소   :', location.href);
      return st;
    },

    OWN_KEY_LS: OWN_KEY_LS,
    DAILY_LIMIT: DAILY_LIMIT
  };

  /* 배포 환경에서 주입 실패 시 콘솔 경고 */
  if (injectState() !== 'ok' &&
      location.protocol !== 'file:' &&
      !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
    console.warn('[CBT_API] 공용 키 주입 실패 — CBT_API.debug() 를 실행해 원인을 확인하세요.');
  }
})();
