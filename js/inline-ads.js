/* ============================================================
   콘텐츠 사이 인라인 광고 자동 삽입
   사용법: InlineAds.inject('#study-body > .study-sec', 3, 4);
           (선택자, N개마다, 최대 개수)
   ============================================================ */
(function () {
  'use strict';

  var CLIENT = 'ca-pub-9283463208175336';
  var SLOT    = '1373941745';   // ← ★ 반드시 교체

  function makeAd() {
    var box = document.createElement('div');
    box.className = 'ad-inline';
    box.innerHTML =
      '<span class="ad-label">ADVERTISEMENT</span>' +
      '<ins class="adsbygoogle" style="display:block;text-align:center;"' +
      ' data-ad-client="' + CLIENT + '"' +
      ' data-ad-slot="' + SLOT + '"' +
      ' data-ad-format="fluid"' +
      ' data-ad-layout="in-article"></ins>';
    return box;
  }

  function pushAll(scope) {
    (scope || document).querySelectorAll('ins.adsbygoogle').forEach(function (ins) {
      if (ins.getAttribute('data-adsbygoogle-status')) return;   // 이미 처리된 것 제외
      try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch (e) {}
    });
  }

  window.InlineAds = {
    inject: function (selector, every, max) {
      every = every || 3;
      max   = max   || 3;
      var items = document.querySelectorAll(selector);
      if (!items.length) return;

      var placed = 0;
      items.forEach(function (el, i) {
        var n = i + 1;
        if (n % every !== 0) return;          // N개마다
        if (n === items.length) return;       // 마지막 뒤에는 넣지 않음
        if (placed >= max) return;
        el.parentNode.insertBefore(makeAd(), el.nextSibling);
        placed++;
      });
      pushAll();
    },
    push: pushAll
  };
})();
