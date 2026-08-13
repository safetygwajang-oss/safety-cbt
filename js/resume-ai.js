/* ============================================================
   안전과장 CBT - 자기소개서 AI 엔진
   resume-ai.js (v2 · 공용키 / 개인키 / 프록시 3중 지원)
   Gemini API + Google Search 그라운딩
   ------------------------------------------------------------
   키 우선순위 : ① PROXY_URL 설정 시 프록시  ② 개인 키  ③ 공용 키
   ============================================================ */
(function () {
  'use strict';

  /* ============================================
     설정
     ============================================ */
  const CONFIG = {
    MODEL: 'gemini-2.5-flash',

    /* Cloudflare Worker 등 프록시를 쓸 경우에만 주소 입력.
       비워두면 브라우저에서 직접 호출(공용키/개인키)합니다. */
    PROXY_URL: '',

    LS_KEY: 'cbt_gemini_key'      // 개인 키 저장소 (api-config.js 와 동일)
  };

  const API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models/';

  /* ============================================
     개인 API 키 관리
     ============================================ */
  function getKey() {
    try { return localStorage.getItem(CONFIG.LS_KEY) || ''; } catch (e) { return ''; }
  }
  function setKey(v) {
    try {
      v ? localStorage.setItem(CONFIG.LS_KEY, v)
        : localStorage.removeItem(CONFIG.LS_KEY);
    } catch (e) {}
  }

  /* ============================================
     사용 가능 여부 조회 (사용량 증가 없음)
     ============================================ */
  function keyInfo() {
    if (CONFIG.PROXY_URL) {
      return { usable: true, mode: 'proxy', own: false, left: Infinity };
    }
    if (window.CBT_API) {
      var r = window.CBT_API.peek();
      r.mode = r.own ? 'own' : 'shared';
      return r;
    }
    var k = getKey();
    return k
      ? { usable: true, mode: 'own', own: true, key: k, left: Infinity }
      : { usable: false, mode: 'none', own: false, left: 0,
          error: 'API 키가 설정되지 않았습니다.' };
  }

  function remaining() {
    if (CONFIG.PROXY_URL) return '무제한';
    if (window.CBT_API) return window.CBT_API.remaining();
    return getKey() ? '무제한' : 0;
  }

  /* ============================================
     Gemini 호출
     ============================================ */
  async function callGemini(prompt, opt) {
    opt = opt || {};

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: opt.temp != null ? opt.temp : 0.75,
        topP: 0.95,
        maxOutputTokens: opt.maxTokens || 8192
      }
    };

    /* 회사 정보 실시간 검색 (그라운딩) */
    if (opt.search) body.tools = [{ google_search: {} }];

    let url;
    let headers = { 'Content-Type': 'application/json' };
    let taken = null;                       // 공용키 사용량 환불용

    if (CONFIG.PROXY_URL) {
      /* ---------- 프록시 모드 : 키를 보내지 않음 ---------- */
      url = CONFIG.PROXY_URL +
            (CONFIG.PROXY_URL.indexOf('?') >= 0 ? '&' : '?') +
            'model=' + encodeURIComponent(CONFIG.MODEL);
    } else {
      /* ---------- 직접 호출 : 개인키 > 공용키 ---------- */
      let picked;
      if (window.CBT_API) {
        picked = window.CBT_API.take();
        taken = picked;
      } else {
        const k = getKey();
        picked = k ? { usable: true, key: k, own: true }
                   : { usable: false, error: 'NO_KEY' };
      }

      if (!picked.usable || !picked.key) {
        throw new Error(picked.error || 'NO_KEY');
      }

      url = API_BASE + CONFIG.MODEL + ':generateContent';
      /* 키를 URL 대신 헤더로 전송 (주소창·로그 노출 방지) */
      headers['x-goog-api-key'] = picked.key;
    }

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body)
      });
    } catch (e) {
      if (taken && window.CBT_API) window.CBT_API.refund(taken);
      throw new Error('네트워크 연결을 확인해 주세요.');
    }

    if (!res.ok) {
      if (taken && window.CBT_API) window.CBT_API.refund(taken);

      let msg = 'HTTP ' + res.status;
      try {
        const j = await res.json();
        if (j.error && j.error.message) msg = j.error.message;
      } catch (e) {}

      if (res.status === 400 && /API key|api_key/i.test(msg)) throw new Error('BAD_KEY');
      if (res.status === 403) {
        throw new Error(
          '이 도메인에서는 키 사용이 허용되지 않았습니다.\n' +
          '(공용 키는 지정된 사이트에서만 동작합니다. 개인 키를 등록해 이용해 주세요.)'
        );
      }
      if (res.status === 429) {
        throw new Error(
          '요청이 많아 잠시 제한되었습니다. 1~2분 후 다시 시도하거나,\n' +
          '개인 API 키를 등록하면 바로 이용할 수 있습니다.'
        );
      }
      if (res.status >= 500) throw new Error('AI 서버가 일시적으로 불안정합니다. 다시 시도해 주세요.');
      throw new Error(msg);
    }

    const data = await res.json();
    const cand = (data.candidates || [])[0];
    if (!cand) throw new Error('응답이 비어 있습니다. 입력을 조금 줄여서 다시 시도해 주세요.');

    const text = ((cand.content && cand.content.parts) || [])
      .map(function (p) { return p.text || ''; }).join('');

    /* 검색 출처 수집 */
    const src = [];
    const gm = cand.groundingMetadata;
    if (gm && gm.groundingChunks) {
      gm.groundingChunks.forEach(function (c) {
        if (c.web && c.web.uri) src.push({ title: c.web.title || c.web.uri, uri: c.web.uri });
      });
    }

    return { text: text.trim(), sources: src };
  }

  /* ============================================
     프롬프트 빌더
     ============================================ */

  /* 1) 회사·직무 리서치 + 작성 전략 */
  function promptStrategy(v) {
    return [
      '당신은 국내 대기업 인사팀에서 12년간 서류 심사를 담당한 채용 전문가입니다.',
      '아래 정보를 바탕으로 지원자 맞춤 "자기소개서 작성 전략서"를 작성하세요.',
      '',
      '■ 1단계 : 회사 리서치 (Google 검색 활용)',
      '- 회사명 : ' + (v.company || '(공고에서 추출)'),
      '- 최신 사업 방향, 주력 제품/서비스, 인재상, 핵심가치, 최근 1년 내 주요 뉴스(투자·수주·신사업·조직개편)를 검색해 확인하세요.',
      '- 확인되지 않은 사실은 절대 단정하지 말고 "확인 필요"로 표기하세요.',
      '',
      '■ 2단계 : 채용공고 해독',
      '- 공고에서 "필수요건 / 우대사항 / 담당업무"를 분리하고, 평가 키워드를 우선순위대로 8개 이내로 뽑으세요.',
      '',
      '■ 3단계 : 경력 매칭',
      '- 지원자 경력에서 각 키워드에 대응되는 근거를 찾아 [키워드 → 근거 경험 → 정량 성과] 형태의 매칭표를 만드세요.',
      '- 근거가 약한 키워드는 "보완 필요"로 표시하고 보완 방법을 제시하세요.',
      '',
      '■ 4단계 : 항목별 전략',
      '- 각 항목마다 ① 핵심 메시지 1문장 ② 사용할 경험 ③ 소제목 예시 2개 ④ 첫 문장 예시 ⑤ 피해야 할 표현을 제시하세요.',
      '',
      '■ 5단계 : 제출 전 리스크',
      '- 이 지원자가 탈락할 가능성이 높은 지점 3개와 대응책을 쓰세요.',
      '',
      '=== 채용공고 ===',
      v.jd || '(미입력)',
      '',
      '=== 작성 항목 ===',
      v.items || '(미입력)',
      '',
      '=== 지원자 경력·경험 ===',
      v.career || '(미입력)',
      '',
      '출력 형식 : 마크다운. ## 대제목, ### 소제목, 표는 마크다운 표. 한국어. 군더더기 인사말 금지.'
    ].join('\n');
  }

  /* 2) 항목별 초안 작성 */
  function promptDraft(v) {
    return [
      '당신은 자기소개서 첨삭 15년 경력의 전문 컨설턴트입니다.',
      '아래 정보로 각 항목의 자기소개서 초안을 완성하세요.',
      '',
      '■ 절대 규칙',
      '1. 지원자가 제공하지 않은 경력·수치·자격은 절대 창작하지 마세요.',
      '   근거가 부족한 부분은 문장 안에 [○○ 수치 입력] 형태의 빈칸으로 남기세요.',
      '2. 모든 경험은 STAR(상황-과제-행동-결과) 구조로 쓰고, 결과는 반드시 정량 표현을 시도하세요.',
      '3. "열정, 최선, 소통왕, 남들보다" 같은 추상적 자기평가 표현은 금지합니다.',
      '4. 각 항목 맨 앞에 15자 이내 소제목을 [ ] 안에 넣으세요.',
      '5. 회사 정보는 Google 검색으로 확인된 사실만 인용하세요.',
      '',
      '■ 분량 : 각 항목 ' + (v.len || '700') + '자 내외 (±10%)',
      '■ 문체 : ' + (v.tone || '간결한 문어체, ~합니다'),
      '',
      '=== 회사명 ===',
      v.company || '(공고에서 추출)',
      '',
      '=== 채용공고 ===',
      v.jd || '(미입력)',
      '',
      '=== 작성 항목 ===',
      v.items || '(미입력)',
      '',
      '=== 지원자 경력·경험 ===',
      v.career || '(미입력)',
      '',
      '출력 형식 :',
      '항목마다 아래 순서로 출력',
      '### [항목명]',
      '**소제목**',
      '본문',
      '`글자수: ○○자`',
      '> 보완 포인트 : (지원자가 직접 채워야 할 부분 안내)'
    ].join('\n');
  }

  /* 3) 맞춤법·문장 검사 */
  function promptSpell(text, level) {
    return [
      '당신은 국립국어원 어문규범을 기준으로 교정하는 한국어 교정 전문가입니다.',
      '아래 글의 맞춤법·띄어쓰기·문법·비문·중복표현을 교정하세요.',
      '',
      '■ 교정 강도 : ' + (level === 'strong'
        ? '강함 (맞춤법 + 문장 구조·군더더기까지 다듬기)'
        : '기본 (맞춤법·띄어쓰기·명백한 비문만)'),
      '■ 원문의 의미와 사실관계는 절대 바꾸지 마세요.',
      '■ 자기소개서 문체(~합니다)를 유지하세요.',
      '',
      '출력 형식 (반드시 이 순서)',
      '## 교정문',
      '(교정된 전체 글)',
      '',
      '## 수정 내역',
      '| 원문 | 수정 | 사유 |',
      '|---|---|---|',
      '(수정한 항목만. 없으면 "수정 사항 없음")',
      '',
      '## 문장 진단',
      '- 총 글자수 / 평균 문장 길이 / 긴 문장(60자 초과) 개수',
      '- 개선 제안 3가지',
      '',
      '=== 원문 ===',
      text
    ].join('\n');
  }

  /* ============================================
     간이 마크다운 렌더러
     ============================================ */
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function md(src) {
    const lines = esc(src).split('\n');
    let out = '', inTable = false, inList = false;

    function closeList() { if (inList) { out += '</ul>'; inList = false; } }
    function closeTable() { if (inTable) { out += '</tbody></table></div>'; inTable = false; } }

    for (let i = 0; i < lines.length; i++) {
      let L = lines[i];

      /* 인라인 */
      L = L.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
           .replace(/`(.+?)`/g, '<code>$1</code>');

      /* 표 */
      if (/^\s*\|/.test(L)) {
        const cells = L.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
        if (/^[\s|:\-]+$/.test(L)) continue;                 /* 구분선 스킵 */
        if (!inTable) {
          closeList();
          out += '<div class="ai-table-wrap"><table class="ai-table"><thead><tr>';
          cells.forEach(function (c) { out += '<th>' + c.trim() + '</th>'; });
          out += '</tr></thead><tbody>';
          inTable = true;
        } else {
          out += '<tr>';
          cells.forEach(function (c) { out += '<td>' + c.trim() + '</td>'; });
          out += '</tr>';
        }
        continue;
      }
      closeTable();

      if (/^###\s+/.test(L))      { closeList(); out += '<h4>' + L.replace(/^###\s+/, '') + '</h4>'; continue; }
      if (/^##\s+/.test(L))       { closeList(); out += '<h3>' + L.replace(/^##\s+/, '') + '</h3>'; continue; }
      if (/^#\s+/.test(L))        { closeList(); out += '<h3>' + L.replace(/^#\s+/, '') + '</h3>'; continue; }
      if (/^>\s?/.test(L))        { closeList(); out += '<blockquote>' + L.replace(/^>\s?/, '') + '</blockquote>'; continue; }
      if (/^\s*[-*]\s+/.test(L))  {
        if (!inList) { out += '<ul>'; inList = true; }
        out += '<li>' + L.replace(/^\s*[-*]\s+/, '') + '</li>';
        continue;
      }
      closeList();

      if (L.trim() === '') { out += ''; continue; }
      out += '<p>' + L + '</p>';
    }
    closeList(); closeTable();
    return out;
  }

  /* ============================================
     외부 공개
     ============================================ */
  window.ResumeAI = {
    CONFIG: CONFIG,
    getKey: getKey,
    setKey: setKey,
    keyInfo: keyInfo,
    remaining: remaining,
    call: callGemini,
    md: md,
    prompts: {
      strategy: promptStrategy,
      draft: promptDraft,
      spell: promptSpell
    }
  };
})();
