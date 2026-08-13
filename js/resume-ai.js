/* ============================================================
   안전과장 CBT - 자기소개서 AI 엔진
   resume-ai.js (v3 · Groq / OpenAI 호환 API)
   ------------------------------------------------------------
   · 리서치·전략  : groq/compound (웹검색 내장)
   · 초안 작성    : llama-3.3-70b-versatile
   · 맞춤법 교정  : openai/gpt-oss-120b
   ============================================================ */
(function () {
  'use strict';

  const CONFIG = {
    API_BASE: 'https://api.groq.com/openai/v1/chat/completions',

    MODEL_SEARCH: 'groq/compound',              /* 웹검색 필요 */
    MODEL_WRITE:  'llama-3.3-70b-versatile',    /* 장문 작성 */
    MODEL_EDIT:   'openai/gpt-oss-120b',        /* 교정 */

    LS_KEY: 'cbt_groq_key'
  };

  /* ============================================
     개인 키 관리
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

  function keyInfo() {
    if (window.CBT_API) return window.CBT_API.peek();
    var k = getKey();
    return k
      ? { usable: true, mode: 'own', key: k, own: true, left: Infinity }
      : { usable: false, mode: 'none', own: false, left: 0,
          error: 'API 키가 설정되지 않았습니다.\nhttps://console.groq.com/keys' };
  }
  function remaining() {
    if (window.CBT_API) return window.CBT_API.remaining();
    return getKey() ? '무제한' : 0;
  }

  /* ============================================
     검색 출처 추출 (compound 모델)
     ============================================ */
  function collectSources(msg) {
    var out = [], seen = {};

    function push(u, t) {
      if (!u || seen[u]) return;
      seen[u] = 1;
      out.push({ title: t || u, uri: u });
    }

    var tools = msg && (msg.executed_tools || msg.tool_calls) || [];
    if (!Array.isArray(tools)) tools = [];

    tools.forEach(function (t) {
      var sr = t.search_results || (t.output && t.output.search_results) || t.output;
      var arr = null;
      if (sr && Array.isArray(sr.results)) arr = sr.results;
      else if (Array.isArray(sr)) arr = sr;
      if (arr) {
        arr.forEach(function (r) {
          if (r && typeof r === 'object') push(r.url || r.uri || r.link, r.title);
        });
      }
    });

    /* 보조 : reasoning 텍스트에서 URL 회수 */
    if (!out.length && msg && typeof msg.reasoning === 'string') {
      var re = /URL:\s*(https?:\/\/[^\s<)"']+)/g, m;
      while ((m = re.exec(msg.reasoning)) !== null) push(m[1], m[1]);
    }
    return out.slice(0, 12);
  }

  /* ============================================
     Groq 호출
     ============================================ */
  async function callAI(prompt, opt) {
    opt = opt || {};

    const model = opt.model ||
      (opt.search ? CONFIG.MODEL_SEARCH
                  : (opt.edit ? CONFIG.MODEL_EDIT : CONFIG.MODEL_WRITE));

    const sys = opt.search
      ? '당신은 한국 채용시장에 정통한 인사 전문가입니다. 회사 관련 사실은 반드시 웹검색으로 확인한 뒤 서술하고, 확인되지 않은 내용은 "확인 필요"로 표기하세요. 모든 답변은 한국어 마크다운입니다.'
      : '당신은 한국 채용시장에 정통한 자기소개서 전문 컨설턴트입니다. 지원자가 제공하지 않은 사실·수치는 절대 창작하지 말고 [○○ 입력] 형태의 빈칸으로 남기세요. 모든 답변은 한국어 마크다운입니다.';

    const body = {
      model: model,
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: prompt }
      ],
      temperature: opt.temp != null ? opt.temp : 0.7,
      top_p: 0.95,
      max_completion_tokens: opt.maxTokens || 6144,
      stream: false
    };

    /* ---------- 접속 방식 결정 ---------- */
    const info = window.CBT_API ? window.CBT_API.take() : keyInfo();
    if (!info.usable) throw new Error(info.error || 'NO_KEY');

    let url, headers = { 'Content-Type': 'application/json' };

    if (info.mode === 'proxy') {
      url = info.proxy;                                  /* 키 전송 없음 */
    } else {
      if (!info.key) throw new Error('NO_KEY');
      url = CONFIG.API_BASE;
      headers['Authorization'] = 'Bearer ' + info.key;
    }

    /* ---------- 요청 (60초 타임아웃) ---------- */
    let res;
    const ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, 60000) : null;

    try {
      res = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(body),
        signal: ctrl ? ctrl.signal : undefined
      });
    } catch (e) {
      if (window.CBT_API) window.CBT_API.refund(info);
      if (e && e.name === 'AbortError')
        throw new Error('응답이 60초를 넘었습니다. 입력을 줄여 다시 시도해 주세요.');
      throw new Error('네트워크 연결 또는 CORS 문제로 요청이 차단되었습니다.\n' +
                      '(개인 키 직접 호출이 막히는 환경일 수 있습니다. 관리자에게 프록시 설정을 문의하세요.)');
    } finally {
      if (timer) clearTimeout(timer);
    }

    if (!res.ok) {
      if (window.CBT_API) window.CBT_API.refund(info);

      let msg = 'HTTP ' + res.status;
      try {
        const j = await res.json();
        if (j && j.error && j.error.message) msg = j.error.message;
      } catch (e) {}

      if (res.status === 401) throw new Error('BAD_KEY');
      if (res.status === 403) throw new Error('이 도메인에서는 사용이 허용되지 않았습니다. 관리자에게 문의해 주세요.');
      if (res.status === 413) throw new Error('입력이 너무 깁니다. 채용공고·경력사항을 줄여 주세요.');
      if (res.status === 429) {
        throw new Error('무료 사용 한도(분당 토큰/일일 요청)에 도달했습니다.\n' +
                        '1~2분 후 다시 시도하거나, 항목 수를 줄여 나눠 생성해 주세요.');
      }
      if (/decommissioned|not found|does not exist/i.test(msg)) {
        throw new Error('모델이 변경되었습니다. 관리자에게 모델 업데이트를 요청해 주세요.\n(' + msg + ')');
      }
      if (res.status >= 500) throw new Error('AI 서버가 일시적으로 불안정합니다. 다시 시도해 주세요.');
      throw new Error(msg);
    }

    const data = await res.json();
    const choice = (data.choices || [])[0];
    if (!choice || !choice.message) throw new Error('응답이 비어 있습니다. 다시 시도해 주세요.');

    const text = (choice.message.content || '').trim();
    if (!text) throw new Error('응답 본문이 비어 있습니다. 입력을 조금 줄여 다시 시도해 주세요.');

    return {
      text: text,
      sources: collectSources(choice.message),
      model: data.model || model
    };
  }

  /* ============================================
     프롬프트 빌더
     ============================================ */
  function promptStrategy(v) {
    return [
      '아래 정보를 바탕으로 지원자 맞춤 "자기소개서 작성 전략서"를 작성하세요.',
      '',
      '■ 1단계 : 회사 리서치 (웹검색 필수)',
      '- 회사명 : ' + (v.company || '(공고에서 추출)'),
      '- 최신 사업 방향, 주력 제품/서비스, 인재상, 핵심가치, 최근 1년 내 주요 뉴스(투자·수주·신사업·조직개편)를 검색해 확인하세요.',
      '- 검색으로 확인되지 않은 내용은 절대 단정하지 말고 "확인 필요"로 표기하세요.',
      '',
      '■ 2단계 : 채용공고 해독',
      '- "필수요건 / 우대사항 / 담당업무"를 분리하고, 평가 키워드를 우선순위대로 8개 이내로 뽑으세요.',
      '',
      '■ 3단계 : 경력 매칭',
      '- [키워드 → 근거 경험 → 정량 성과] 형태의 매칭표를 만드세요.',
      '- 근거가 약한 키워드는 "보완 필요"로 표시하고 보완 방법을 제시하세요.',
      '',
      '■ 4단계 : 항목별 전략',
      '- 각 항목마다 ① 핵심 메시지 1문장 ② 사용할 경험 ③ 소제목 예시 2개 ④ 첫 문장 예시 ⑤ 피해야 할 표현',
      '',
      '■ 5단계 : 제출 전 리스크',
      '- 탈락 가능성이 높은 지점 3개와 대응책',
      '',
      '=== 채용공고 ===', v.jd || '(미입력)', '',
      '=== 작성 항목 ===', v.items || '(미입력)', '',
      '=== 지원자 경력·경험 ===', v.career || '(미입력)', '',
      '출력 형식 : 마크다운(## 대제목, ### 소제목, 마크다운 표). 인사말·사족 금지.'
    ].join('\n');
  }

  function promptDraft(v) {
    return [
      '아래 정보로 각 항목의 자기소개서 초안을 완성하세요.',
      '',
      '■ 절대 규칙',
      '1. 제공되지 않은 경력·수치·자격은 절대 창작하지 마세요. 부족한 부분은 [○○ 수치 입력] 빈칸으로 남기세요.',
      '2. 모든 경험은 STAR(상황-과제-행동-결과) 구조, 결과는 반드시 정량 표현을 시도하세요.',
      '3. "열정, 최선, 소통왕, 남들보다" 같은 추상적 자기평가 표현 금지.',
      '4. 각 항목 맨 앞에 15자 이내 소제목을 [ ] 안에 넣으세요.',
      '5. 회사에 대한 사실은 아래 입력에 있는 내용만 사용하고, 추측은 쓰지 마세요.',
      '',
      '■ 분량 : 각 항목 ' + (v.len || '700') + '자 내외 (±10%)',
      '■ 문체 : ' + (v.tone || '간결한 문어체, ~합니다'),
      '',
      '=== 회사명 ===', v.company || '(공고에서 추출)', '',
      '=== 채용공고 ===', v.jd || '(미입력)', '',
      '=== 작성 항목 ===', v.items || '(미입력)', '',
      '=== 지원자 경력·경험 ===', v.career || '(미입력)', '',
      '출력 형식 : 항목마다',
      '### [항목명]',
      '**소제목**',
      '본문',
      '`글자수: ○○자`',
      '> 보완 포인트 : (직접 채워야 할 부분 안내)'
    ].join('\n');
  }

  function promptSpell(text, level) {
    return [
      '당신은 국립국어원 어문규범 기준 한국어 교정 전문가입니다.',
      '아래 글의 맞춤법·띄어쓰기·문법·비문·중복표현을 교정하세요.',
      '',
      '■ 교정 강도 : ' + (level === 'strong'
        ? '강함 (맞춤법 + 문장 구조·군더더기까지 다듬기)'
        : '기본 (맞춤법·띄어쓰기·명백한 비문만)'),
      '■ 원문의 의미와 사실관계는 절대 바꾸지 마세요.',
      '■ 자기소개서 문체(~합니다)를 유지하세요.',
      '',
      '출력 형식 (반드시 이 순서)',
      '## 교정문', '(교정된 전체 글)', '',
      '## 수정 내역',
      '| 원문 | 수정 | 사유 |', '|---|---|---|',
      '(수정한 항목만. 없으면 "수정 사항 없음")', '',
      '## 문장 진단',
      '- 총 글자수 / 평균 문장 길이 / 긴 문장(60자 초과) 개수',
      '- 개선 제안 3가지', '',
      '=== 원문 ===', text
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
      L = L.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
           .replace(/`(.+?)`/g, '<code>$1</code>');

      if (/^\s*\|/.test(L)) {
        if (/^[\s|:\-]+$/.test(L)) continue;
        const cells = L.replace(/^\s*\|/, '').replace(/\|\s*$/, '').split('|');
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

      if (/^###\s+/.test(L))     { closeList(); out += '<h4>' + L.replace(/^###\s+/, '') + '</h4>'; continue; }
      if (/^##\s+/.test(L))      { closeList(); out += '<h3>' + L.replace(/^##\s+/, '') + '</h3>'; continue; }
      if (/^#\s+/.test(L))       { closeList(); out += '<h3>' + L.replace(/^#\s+/, '') + '</h3>'; continue; }
      if (/^>\s?/.test(L))       { closeList(); out += '<blockquote>' + L.replace(/^>\s?/, '') + '</blockquote>'; continue; }
      if (/^\s*[-*]\s+/.test(L)) {
        if (!inList) { out += '<ul>'; inList = true; }
        out += '<li>' + L.replace(/^\s*[-*]\s+/, '') + '</li>';
        continue;
      }
      closeList();
      if (L.trim() === '') continue;
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
    call: callAI,
    md: md,
    prompts: {
      strategy: promptStrategy,
      draft: promptDraft,
      spell: promptSpell
    }
  };
})();
