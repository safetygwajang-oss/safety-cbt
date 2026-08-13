/* ============================================
   안전과장 CBT - 홈 대시보드
   main.js (v7)
   - ★ 커리어 탭(자기소개서·토익스피킹)을 자격증 탭 "윗줄"에 별도 배치
   - 자격증별 탭 분류 + 문항수/시험시간 자동 보정
   - 마지막 선택 탭 기억
   ★ index.html 에서 toeic.js / resume-tab.js 태그는 제거하세요
   ============================================ */

(function () {
  'use strict';

  const $ = (id) => document.getElementById(id);

  /* ============================================
     🔑 중복기출 입장코드 — 아래 값만 바꾸세요
     ============================================ */
  const ACCESS_CODE = '1221';

  const codeStore = sessionStorage;   // localStorage 로 바꾸면 계속 기억
  const CODE_KEY = 'dup-access-ok';
  const TAB_KEY = 'cbt-last-tab';

  /* ============================================
     ★ 윗줄 커리어 메뉴
     type: 'link'  → 누르면 바로 이동
           'cards' → 아래에 카드 목록 표시
     ============================================ */
  const CAREER_TABS = [
    {
      key: 'resume',
      label: '📝 자기소개서',
      badge: 'AI',
      type: 'link',
      href: 'resume.html'
    },
    {
      key: 'toeic',
      label: '🎤 토익스피킹',
      badge: '5',
      type: 'cards',
      intro: '<b>TOEIC Speaking</b> 파트별 답변 템플릿 · 만능 표현 정리 (PART 1~5)',
      cards: [
        { href: 'study.html?id=toeic-part1', tag: 'PART 1', title: '문장 읽기',            desc: 'Read a text aloud · 발음 · 강세 · 끊어읽기' },
        { href: 'study.html?id=toeic-part2', tag: 'PART 2', title: '사진 묘사',            desc: 'Describe a picture · 3단 구성 템플릿' },
        { href: 'study.html?id=toeic-part3', tag: 'PART 3', title: '듣고 질문에 답하기',   desc: 'Respond to questions · 즉답 패턴' },
        { href: 'study.html?id=toeic-part4', tag: 'PART 4', title: '제공된 정보로 답하기', desc: 'Respond using information · 표 읽기' },
        { href: 'study.html?id=toeic-part5', tag: 'PART 5', title: '의견 제시하기',        desc: 'Express an opinion · 서론-본론-결론' }
      ]
    }
  ];

  /* ============================================
     아랫줄 자격증 탭
     ============================================ */
  const CATEGORIES = [
    { key: 'safety',       label: '🏭 산업안전기사' },
    { key: 'construction', label: '🏗 건설안전기사' },
    { key: 'hygiene',      label: '🩺 산업위생관리기사' },
    { key: 'hazmat',       label: '🧪 위험물기능장' },
    { key: 'dup',          label: '중복기출 모음집', locked: true, alwaysShow: true },
    { key: 'etc',          label: '📂 기타' }
  ];

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    injectStyle();
    renderStats();
    renderBookmarks();
    renderRecent();
    await renderExamList();
    bindEvents();
    bindCodeModal();
  }

  /* ============================================
     추가 스타일 (css 파일 수정 불필요)
     ============================================ */
  function injectStyle() {
    if (document.getElementById('cbt-career-style')) return;

    const css = `
      /* ===== 윗줄 커리어 탭 ===== */
      .career-bar {
        display: flex; align-items: center; gap: 8px;
        flex-wrap: wrap; margin: 26px 0 12px;
      }
      .career-bar-label {
        font-size: .78rem; font-weight: 700; color: #94a3b8;
        letter-spacing: .04em; margin-right: 2px;
      }
      .career-tab {
        display: inline-flex; align-items: center; gap: 7px;
        padding: 10px 16px; border-radius: 99px; cursor: pointer;
        font-family: inherit; font-size: .93rem; font-weight: 700;
        color: #1d4ed8; background: linear-gradient(135deg,#eff6ff,#f0fdfa);
        border: 1px solid #dbeafe;
        transition: transform .16s ease, box-shadow .16s ease, background .16s ease;
      }
      .career-tab:hover {
        transform: translateY(-1px);
        box-shadow: 0 6px 16px rgba(37,99,235,.18);
        border-color: #93c5fd;
      }
      .career-tab.active {
        background: linear-gradient(135deg,#2563eb,#0ea5e9);
        border-color: #2563eb; color: #fff;
      }
      .career-tab .cbadge {
        background: #2563eb; color: #fff;
        font-size: .64rem; font-weight: 800; letter-spacing: .04em;
        padding: 2px 7px; border-radius: 99px;
      }
      .career-tab.active .cbadge { background: rgba(255,255,255,.28); }

      @media (max-width: 520px) {
        .career-bar { gap: 6px; margin: 18px 0 10px; }
        .career-bar-label { width: 100%; margin-bottom: 2px; }
        .career-tab { flex: 1 1 46%; justify-content: center; padding: 10px 10px; font-size: .87rem; }
      }

      /* ===== 토익 패널 ===== */
      .front-intro {
        background: linear-gradient(135deg,#eff6ff,#f0fdfa);
        border: 1px solid #dbeafe; border-radius: 12px;
        padding: 12px 14px; margin-bottom: 14px;
        font-size: .88rem; color: #334155; line-height: 1.6;
      }
      a.exam-card { text-decoration: none; display: block; color: inherit; }
      .front-tag {
        display: inline-block; background: #2563eb; color: #fff;
        font-size: .68rem; font-weight: 800; letter-spacing: .05em;
        padding: 3px 9px; border-radius: 99px; margin-bottom: 8px;
      }
    `;

    const style = document.createElement('style');
    style.id = 'cbt-career-style';
    style.textContent = css;
    document.head.appendChild(style);
  }

  /* ============================================
     분류 함수
     ============================================ */
  function classify(exam) {
    const text = `${exam.id || ''} ${exam.title || ''}`;

    if (/중복기출/.test(text)) return 'dup';
    if (/건설안전기사/.test(text)) return 'construction';
    if (/산업위생관리기사|산업위생/.test(text)) return 'hygiene';
    if (/위험물기능장|위험물/.test(text)) return 'hazmat';
    if (/산업안전기사/.test(text)) return 'safety';
    if (/^\d{4}-\d{2}-\d{2}$/.test(String(exam.id || '').trim())) return 'safety';
    return 'etc';
  }

  /* ============================================
     ★ 자격증별 문항수 / 시험시간 보정
     ============================================ */
  function fixMeta(exam) {
    const text = `${exam.id || ''} ${exam.title || ''}`;
    const out = Object.assign({}, exam);

    if (/중복기출/.test(text)) {
      if (out.questions) out.duration = Math.max(30, Math.ceil(out.questions * 1.5));
      return out;
    }
    if (/위험물기능장/.test(text)) {
      out.questions = 60;
      out.duration = 60;
      out.subjects = null;
      return out;
    }
    if (/산업위생관리기사/.test(text)) {
      out.questions = 100;
      out.duration = 150;
      return out;
    }
    if (/건설안전기사|산업안전기사/.test(text)) {
      out.questions = 120;
      out.duration = 150;
      return out;
    }
    return out;
  }

  /* 정렬용 날짜 키 (최신순) */
  function getDateKey(exam) {
    const src = `${exam.id || ''} ${exam.date || ''}`;
    const m = src.match(/(\d{4})[-.\s]?(\d{1,2})[-.\s]?(\d{1,2})/);
    if (m) {
      return m[1] + String(m[2]).padStart(2, '0') + String(m[3]).padStart(2, '0');
    }
    const y = src.match(/(\d{4})/);
    return y ? y[1] + '0000' : '00000000';
  }

  function isUnlocked() {
    return codeStore.getItem(CODE_KEY) === '1';
  }

  // ===== 통계 카드 =====
  function renderStats() {
    const stats = window.Storage && window.Storage.getStats
      ? window.Storage.getStats()
      : { totalSessions: 0, avgScore: 0, bookmarkCount: 0 };

    if ($('stat-sessions')) $('stat-sessions').textContent = stats.totalSessions;
    if ($('stat-avg')) $('stat-avg').innerHTML = `${stats.avgScore}<span style="font-size:1rem;">점</span>`;
    if ($('stat-bookmarks')) $('stat-bookmarks').textContent = stats.bookmarkCount;
  }

  // ===== 북마크 모아보기 =====
  function renderBookmarks() {
    const list = window.Storage && window.Storage.getBookmarkList
      ? window.Storage.getBookmarkList()
      : [];

    if (!$('bookmark-section')) return;

    if (list.length === 0) {
      $('bookmark-section').style.display = 'none';
      return;
    }

    $('bookmark-section').style.display = 'block';
    $('bookmark-count').textContent = `(${list.length})`;

    const container = $('bookmark-list');
    container.innerHTML = '';

    list.slice(0, 12).forEach(bm => {
      const item = document.createElement('div');
      item.className = 'bookmark-item';
      item.innerHTML = `
        <div class="bm-header">
          <span>📅 ${escapeHtml(bm.examId)} · ${bm.no}번</span>
          <span style="color:var(--gray-400);">${bm.subject ? escapeHtml(bm.subject) : ''}</span>
        </div>
        <div class="bm-text">${escapeHtml((bm.question || '').substring(0, 100))}${(bm.question || '').length > 100 ? '...' : ''}</div>
      `;
      item.addEventListener('click', () => {
        window.location.href = `exam.html?exam=${encodeURIComponent(bm.examId)}&jumpTo=${bm.no}`;
      });
      container.appendChild(item);
    });

    if (list.length > 12) {
      const more = document.createElement('div');
      more.className = 'bookmark-item';
      more.style.background = 'var(--gray-50)';
      more.style.textAlign = 'center';
      more.style.color = 'var(--gray-500)';
      more.innerHTML = `<div style="padding:16px;">외 ${list.length - 12}개 더...</div>`;
      container.appendChild(more);
    }
  }

  // ===== 최근 응시 결과 =====
  function renderRecent() {
    const sessions = window.Storage && window.Storage.getAllSessions
      ? window.Storage.getAllSessions()
      : {};

    if (!$('recent-section')) return;

    const arr = Object.entries(sessions)
      .map(([id, data]) => ({ sessionId: id, ...data }))
      .sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0))
      .slice(0, 5);

    if (arr.length === 0) {
      $('recent-section').style.display = 'none';
      return;
    }

    $('recent-section').style.display = 'block';
    const container = $('recent-list');
    container.innerHTML = '';

    arr.forEach(s => {
      const card = document.createElement('div');
      card.className = 'exam-card';

      const date = new Date(s.submittedAt || Date.now()).toLocaleString('ko-KR', {
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      const scoreColor = s.score >= 60 ? 'var(--success)' : (s.score >= 40 ? 'var(--warning)' : 'var(--danger)');
      const modeText = s.mode === 'wrong' ? '🔁 오답' : (s.mode === 'study' ? '📖 학습' : '🎯 실전');

      card.innerHTML = `
        <h3>${escapeHtml(s.examTitle || s.examId)}</h3>
        <div class="meta">📅 ${date} · ${modeText}</div>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px;">
          <span class="badge">${s.correct} / ${s.total}</span>
          <span style="font-size:1.4rem; font-weight:700; color:${scoreColor};">${s.score}점</span>
        </div>
      `;
      card.addEventListener('click', () => {
        window.location.href = `result.html?session=${encodeURIComponent(s.sessionId)}`;
      });
      container.appendChild(card);
    });
  }

  /* ============================================
     탭 껍데기 확보 (index.html 수정 불필요)
     ============================================ */
  function buildShell() {
    let tabsEl = document.querySelector('.main-tabs');

    if (!tabsEl) {
      const section = document.createElement('section');
      tabsEl = document.createElement('div');
      tabsEl.className = 'main-tabs';
      section.appendChild(tabsEl);
      (document.querySelector('main.container') || document.body).appendChild(section);
    }

    const host = tabsEl.parentElement;

    // 기존 패널 / 커리어바 제거 (중복 방지)
    host.querySelectorAll('.tab-panel').forEach(p => p.remove());
    const oldBar = document.getElementById('career-bar');
    if (oldBar) oldBar.remove();
    tabsEl.innerHTML = '';

    return { tabsEl, host };
  }

  /* ============================================
     ★ 커리어 바 (자격증 탭 윗줄)
     ============================================ */
  function buildCareerBar(tabsEl, host) {
    const bar = document.createElement('div');
    bar.className = 'career-bar';
    bar.id = 'career-bar';
    bar.innerHTML = '<span class="career-bar-label"> </span>';

    const panelKeys = [];

    CAREER_TABS.forEach(cfg => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'career-tab';
      btn.dataset.tab = cfg.key;
      btn.innerHTML = `${cfg.label}${cfg.badge ? `<span class="cbadge">${escapeHtml(cfg.badge)}</span>` : ''}`;

      if (cfg.type === 'link') {
        btn.addEventListener('click', () => { window.location.href = cfg.href; });
        bar.appendChild(btn);
        return;
      }

      /* 카드형 : 패널 생성 */
      btn.addEventListener('click', () => activateTab(cfg.key));
      bar.appendChild(btn);
      panelKeys.push(cfg.key);

      const panel = document.createElement('div');
      panel.className = 'tab-panel';
      panel.id = `panel-${cfg.key}`;
      panel.style.display = 'none';

      if (cfg.intro) {
        const intro = document.createElement('div');
        intro.className = 'front-intro';
        intro.innerHTML = cfg.intro;
        panel.appendChild(intro);
      }

      const grid = document.createElement('div');
      grid.className = 'exam-grid';
      (cfg.cards || []).forEach(c => {
        const a = document.createElement('a');
        a.className = 'exam-card';
        a.href = c.href;
        a.innerHTML = `
          <span class="front-tag">${escapeHtml(c.tag)}</span>
          <h3>${escapeHtml(c.title)}</h3>
          <div class="exam-subjects">${escapeHtml(c.desc)}</div>
        `;
        grid.appendChild(a);
      });
      panel.appendChild(grid);
      host.appendChild(panel);
    });

    /* 자격증 탭 줄 바로 위에 삽입 */
    host.insertBefore(bar, tabsEl);

    return panelKeys;
  }

  /* ============================================
     회차 목록 로드 + 탭 생성
     ============================================ */
  async function renderExamList() {
    let exams = [];

    try {
      const res = await fetch('data/index.json');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          exams = data;
        } else if (data && Array.isArray(data.exams)) {
          exams = data.exams.map(item => (typeof item === 'string' ? { id: item, title: item } : item));
        }
      }
    } catch (e) {
      console.log('data/index.json 로드 실패:', e);
    }

    // 응시 기록
    const sessions = window.Storage && window.Storage.getAllSessions
      ? window.Storage.getAllSessions()
      : {};
    const attempted = new Set(Object.values(sessions).map(s => s.examId));

    // 진행중 기록
    const inProgress = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('exam-progress-') && !key.includes('-wrong-')) {
        const examId = key.replace('exam-progress-', '');
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.answers && Object.keys(data.answers).length > 0) inProgress.add(examId);
        } catch (e) {}
      }
    }

    // 그룹핑
    const groups = {};
    CATEGORIES.forEach(c => { groups[c.key] = []; });
    exams.forEach(ex => { groups[classify(ex)].push(ex); });

    // 정렬
    Object.keys(groups).forEach(key => {
      if (key === 'dup') {
        groups[key].sort((a, b) => String(a.title || a.id).localeCompare(String(b.title || b.id)));
      } else {
        groups[key].sort((a, b) => getDateKey(b).localeCompare(getDateKey(a)));
      }
    });

    const { tabsEl, host } = buildShell();

    /* ★ 윗줄 커리어 바 먼저 생성 */
    const careerPanelKeys = buildCareerBar(tabsEl, host);

    /* 아랫줄 자격증 탭 */
    let firstExamKey = null;
    const panelKeys = careerPanelKeys.slice();

    CATEGORIES.forEach(cat => {
      const items = groups[cat.key];
      if (items.length === 0 && !cat.alwaysShow) return;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'main-tab';
      btn.dataset.tab = cat.key;
      btn.innerHTML = `${cat.locked && !isUnlocked() ? '🔒 ' : (cat.locked ? '🔓 ' : '')}${cat.label}<span class="tab-cnt">${items.length}</span>`;
      tabsEl.appendChild(btn);
      panelKeys.push(cat.key);

      const panel = document.createElement('div');
      panel.className = 'tab-panel';
      panel.id = `panel-${cat.key}`;
      panel.style.display = 'none';

      if (cat.locked) {
        const lock = document.createElement('div');
        lock.className = 'lock-box';
        lock.id = 'dup-locked';
        lock.innerHTML = `
          <div class="lock-icon">🔒</div>
          <p class="lock-text">중복기출 모음집은 <b>입장코드</b>를 입력해야 이용할 수 있습니다.</p>
          <button class="btn-primary" id="open-code-btn" type="button">입장코드 입력</button>
        `;
        panel.appendChild(lock);
      }

      const grid = document.createElement('div');
      grid.className = 'exam-grid';
      grid.id = `list-${cat.key}`;
      if (cat.locked) grid.style.display = 'none';
      panel.appendChild(grid);

      host.appendChild(panel);
      paint(grid, items, attempted, inProgress);

      if (!firstExamKey) firstExamKey = cat.key;
    });

    /* 기본 활성 탭 */
    let startKey = firstExamKey || panelKeys[0];
    try {
      const saved = sessionStorage.getItem(TAB_KEY);
      if (saved && panelKeys.indexOf(saved) >= 0) {
        if (saved !== 'dup' || isUnlocked()) startKey = saved;
      }
    } catch (e) {}
    if (startKey) activateTab(startKey);

    tabsEl.scrollLeft = 0;

    /* 자격증 탭 클릭 */
    tabsEl.querySelectorAll('.main-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        activateTab(btn.dataset.tab);
        if (btn.dataset.tab === 'dup' && !isUnlocked()) openCodeModal();
      });
    });

    const openBtn = $('open-code-btn');
    if (openBtn) openBtn.addEventListener('click', openCodeModal);

    if (isUnlocked()) unlockDup();
  }

  /* 두 줄 모두 반영 */
  function activateTab(key) {
    document.querySelectorAll('.main-tab, .career-tab').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === key);
    });
    document.querySelectorAll('.tab-panel').forEach(p => {
      p.style.display = (p.id === `panel-${key}`) ? 'block' : 'none';
    });
    try { sessionStorage.setItem(TAB_KEY, key); } catch (e) {}
  }

  /* ===== 카드 그리기 ===== */
  function paint(container, list, attempted, inProgress) {
    container.innerHTML = '';

    if (list.length === 0) {
      container.innerHTML = `<div style="grid-column:1/-1; padding:30px; text-align:center; color:var(--gray-500);">📂 등록된 회차가 없습니다.</div>`;
      return;
    }

    list.forEach(raw => {
      const exam = fixMeta(raw);

      const card = document.createElement('div');
      card.className = 'exam-card';

      let badges = '';
      if (inProgress.has(exam.id)) badges += '<span class="badge" style="background:#fef3c7; color:#92400e;">▶ 진행중</span>';
      if (attempted.has(exam.id)) badges += '<span class="badge done">✅ 응시완료</span>';
      if (exam.questions) badges += `<span class="badge">${exam.questions}문항</span>`;
      if (exam.duration) badges += `<span class="badge">⏱ ${exam.duration}분</span>`;

      let subjectsHtml = '';
      if (exam.subjects && exam.subjects.length > 0) {
        const names = exam.subjects
          .map(s => (typeof s === 'string' ? s : s.name))
          .filter(n => n && !/임의구분/.test(n))
          .join(' · ');
        if (names) subjectsHtml = `<div class="exam-subjects">${escapeHtml(names)}</div>`;
      }

      const dateText = exam.date ? `📅 ${escapeHtml(exam.date)}` : '';
      const isDup = classify(exam) === 'dup';

      card.innerHTML = `
        <h3>${escapeHtml(exam.title || exam.id)}</h3>
        ${dateText ? `<div class="meta">${dateText}</div>` : ''}
        <div style="margin-top:8px;">${badges}</div>
        ${subjectsHtml}
      `;

      card.addEventListener('click', () => {
        if (isDup && !isUnlocked()) {
          openCodeModal();
          return;
        }
        window.location.href = `exam.html?exam=${encodeURIComponent(exam.id)}`;
      });

      container.appendChild(card);
    });
  }

  /* ===== 입장코드 ===== */
  function openCodeModal() {
    if (!$('code-modal')) return;
    $('code-error').style.display = 'none';
    $('code-input').value = '';
    $('code-modal').classList.add('show');
    setTimeout(() => $('code-input').focus(), 50);
  }

  function unlockDup() {
    codeStore.setItem(CODE_KEY, '1');
    const lock = $('dup-locked');
    const grid = $('list-dup');
    if (lock) lock.style.display = 'none';
    if (grid) grid.style.display = 'grid';

    const tab = document.querySelector('.main-tab[data-tab="dup"]');
    if (tab) tab.innerHTML = tab.innerHTML.replace('🔒 ', '🔓 ');
  }

  function bindCodeModal() {
    if (!$('code-modal')) return;

    const submit = () => {
      if ($('code-input').value.trim() === ACCESS_CODE) {
        $('code-modal').classList.remove('show');
        unlockDup();
        activateTab('dup');
      } else {
        $('code-error').style.display = 'block';
        $('code-input').select();
      }
    };

    $('code-submit-btn').addEventListener('click', submit);
    $('code-input').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit();
    });
    $('code-cancel-btn').addEventListener('click', () => $('code-modal').classList.remove('show'));
    $('code-modal').addEventListener('click', (e) => {
      if (e.target === $('code-modal')) $('code-modal').classList.remove('show');
    });
  }

  /* ===== 설정 ===== */
  function bindEvents() {
    if ($('settings-btn')) {
      $('settings-btn').addEventListener('click', () => $('settings-modal').classList.add('show'));
    }
    if ($('close-settings-btn')) {
      $('close-settings-btn').addEventListener('click', () => $('settings-modal').classList.remove('show'));
    }
    if ($('settings-modal')) {
      $('settings-modal').addEventListener('click', (e) => {
        if (e.target === $('settings-modal')) $('settings-modal').classList.remove('show');
      });
    }

    if ($('clear-data-btn')) {
      $('clear-data-btn').addEventListener('click', () => {
        if (!confirm('⚠️ 모든 응시 기록과 북마크를 삭제합니다.\n\n정말 초기화하시겠습니까?')) return;
        if (!confirm('한 번 더 확인합니다.\n\n정말 모든 데이터를 삭제할까요?')) return;

        if (window.Storage && window.Storage.clearAll) window.Storage.clearAll();

        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('exam-progress-')) keysToRemove.push(key);
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));

        alert('✅ 모든 데이터가 초기화되었습니다.');
        location.reload();
      });
    }
  }

  /* ===== 유틸 ===== */
  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

})();
