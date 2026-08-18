/* ============================================
   포스코퓨처엠 CBT - 시험 진행 로직
   exam.js (v5 - 랜덤 문제은행 기능 추가)
   ============================================ */

(function () {
  'use strict';

  /* ============================================
     기본 설정
     ============================================ */

  const RANDOM_EXAM_ID = 'random';

  const RANDOM_INDEX_URL = 'data/index.json';

  const RANDOM_EXAM_STORAGE_KEY = 'cbt-random-exam-current-v1';

  /*
   * data/index.json을 읽지 못하거나 파일 목록을 찾지 못했을 때
   * 사용하는 예비 파일 목록입니다.
   *
   * 새 JSON 파일을 추가했는데 index.json에 등록하지 않았다면
   * 아래 목록에도 파일명을 추가할 수 있습니다.
   */
  const FALLBACK_EXAM_FILES = [
    '2018-03-04.json',
    '2018-04-28.json',
    '2018-08-19.json',
    '2019-03-03.json',
    '2019-04-27.json',
    '2019-08-04.json',
    '2020-06-06.json',
    '2020-08-22.json',
    '2020-09-26.json',
    '2021-03-07.json',
    '2021-05-15.json',
    '2021-08-14.json',
    '2022-03-05.json',
    '2022-04-24.json',
    '2023-05-13.json',
    '2023-07-08.json',
    '2024-02-17.json',
    '2024-05-11.json',
    '2024-07-06.json',
    '2025-02-08.json',
    '2025-05-10.json',
    '2025-08-09.json',
    '2026-01-31.json',
    '2026-05-09.json'
  ];

  /*
   * 구형 과목명과 신규 과목명을 모두 신규 과목명으로 통일합니다.
   */
  const SUBJECT_MAP = {
    '안전관리론':
      '산업재해 예방 및 안전보건교육',

    '산업재해 예방 및 안전보건교육':
      '산업재해 예방 및 안전보건교육',

    '인간공학 및 시스템안전공학':
      '인간공학 및 위험성 평가·관리',

    '인간공학 및 위험성 평가·관리':
      '인간공학 및 위험성 평가·관리',

    '기계위험방지기술':
      '기계·기구 및 설비 안전 관리',

    '기계·기구 및 설비 안전 관리':
      '기계·기구 및 설비 안전 관리',

    '전기위험방지기술':
      '전기설비 안전 관리',

    '전기설비 안전 관리':
      '전기설비 안전 관리',

    '화학설비위험방지기술':
      '화학설비 안전 관리',

    '화학설비 안전 관리':
      '화학설비 안전 관리',

    '건설안전기술':
      '건설공사 안전 관리',

    '건설공사 안전 관리':
      '건설공사 안전 관리'
  };

  const RANDOM_SUBJECTS = [
    {
      name: '산업재해 예방 및 안전보건교육',
      range: [1, 20]
    },
    {
      name: '인간공학 및 위험성 평가·관리',
      range: [21, 40]
    },
    {
      name: '기계·기구 및 설비 안전 관리',
      range: [41, 60]
    },
    {
      name: '전기설비 안전 관리',
      range: [61, 80]
    },
    {
      name: '화학설비 안전 관리',
      range: [81, 100]
    },
    {
      name: '건설공사 안전 관리',
      range: [101, 120]
    }
  ];

  // ===== 전역 상태 =====
  const state = {
    examId: null,
    examTitle: '',
    mode: 'exam',
    sessionId: null,
    questions: [],
    answers: {},
    bookmarks: {},
    perPage: 2,
    currentPage: 1,
    totalPages: 1,
    startTime: null,
    timerInterval: null,
    autoSaveInterval: null,
    durationMin: null,
    timeLimit: 150 * 60,
    submitted: false,
    isRandomExam: false,
    randomCreatedAt: null,
    loadedFileCount: 0
  };

  const $ = (id) => document.getElementById(id);
  const els = {};

  document.addEventListener('DOMContentLoaded', init);

  /* ============================================
     초기화
     ============================================ */

  async function init() {
    els.title = $('exam-title');
    els.timer = $('timer');
    els.modeToggle = $('mode-toggle');
    els.resetBtn = $('reset-btn');
    els.saveBtn = $('save-btn');
    els.homeBtn = $('home-btn');
    els.submitBtn = $('submit-btn');
    els.progressFill = $('progress-fill');
    els.perPage = $('per-page');
    els.jumpBtn = $('jump-input-btn');
    els.answeredCount = $('answered-count');
    els.questionArea = $('question-area');
    els.prevPage = $('prev-page');
    els.nextPage = $('next-page');
    els.pageInfo = $('page-info');

    const params = new URLSearchParams(window.location.search);

    state.examId = params.get('exam');
    state.mode = params.get('mode') || 'exam';
    state.sessionId = params.get('session');

    const forceNewRandom =
      params.get('new') === '1' ||
      params.get('new') === 'true';

    if (!state.examId) {
      els.questionArea.innerHTML =
        '<p class="loading">❌ 시험 정보가 없습니다. ' +
        '<a href="index.html">홈으로</a></p>';
      return;
    }

    state.isRandomExam = state.examId === RANDOM_EXAM_ID;

    showLoadingMessage();

    try {
      await loadExamData(forceNewRandom);
    } catch (err) {
      console.error('시험 데이터 로드 실패:', err);

      const errorMessage = escapeHtml(
        err && err.message
          ? err.message
          : '알 수 없는 오류가 발생했습니다.'
      );

      if (state.isRandomExam) {
        els.questionArea.innerHTML = `
          <div class="loading">
            <p>❌ 랜덤 문제를 생성할 수 없습니다.</p>
            <p>${errorMessage}</p>
            <p>
              <code>data/index.json</code>과 각 문제 JSON의
              문법 및 파일 경로를 확인해 주세요.
            </p>
            <p><a href="index.html">홈으로</a></p>
          </div>
        `;
      } else {
        els.questionArea.innerHTML = `
          <div class="loading">
            <p>❌ 문제 파일을 불러올 수 없습니다.</p>
            <p>파일: <code>data/${escapeHtml(state.examId)}.json</code></p>
            <p>${errorMessage}</p>
            <p><a href="index.html">홈으로</a></p>
          </div>
        `;
      }

      return;
    }

    /*
     * ?new=1은 최초 생성에만 사용합니다.
     * 주소에서 제거해야 새로고침할 때마다 문제가 다시 생성되지 않습니다.
     */
    if (state.isRandomExam && forceNewRandom) {
      removeNewParameterFromUrl();
    }

    if (state.mode === 'wrong' && state.sessionId) {
      filterWrongQuestions();
    }

    if (state.questions.length === 0) {
      els.questionArea.innerHTML =
        '<p class="loading">😅 풀 문제가 없습니다. ' +
        '<a href="index.html">홈으로</a></p>';
      return;
    }

    applyTimeLimit();
    restoreProgress();
    bindEvents();
    updateTitle();

    const jumpTo = params.get('jumpTo');

    if (jumpTo) {
      const targetNo = parseInt(jumpTo, 10);
      const idx = state.questions.findIndex(
        (q) => q.no === targetNo
      );

      if (idx >= 0) {
        state.currentPage =
          Math.floor(idx / state.perPage) + 1;
      }
    }

    renderPage();
    startTimer();
    startAutoSave();

    ensureKatexReady().then(() => {
      renderPage();
    });

    window.addEventListener(
      'beforeunload',
      beforeUnloadHandler
    );
  }

  function showLoadingMessage() {
    if (!els.questionArea) return;

    if (state.isRandomExam) {
      els.questionArea.innerHTML = `
        <div class="loading">
          <p>🎲 랜덤 기출문제를 생성하고 있습니다.</p>
          <p>등록된 문제 파일을 불러오는 중입니다.</p>
        </div>
      `;
    } else {
      els.questionArea.innerHTML =
        '<p class="loading">문제를 불러오는 중입니다...</p>';
    }
  }

  function removeNewParameterFromUrl() {
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('new');

      window.history.replaceState(
        {},
        document.title,
        url.pathname + url.search + url.hash
      );
    } catch (error) {
      console.warn('URL 정리 실패:', error);
    }
  }

  /* ============================================
     시험시간 자동 결정
     ============================================ */

  function applyTimeLimit() {
    const text =
      `${state.examId || ''} ${state.examTitle || ''}`;

    const count = state.questions.length;
    let min;

    if (state.durationMin && state.durationMin > 0) {
      min = state.durationMin;
    } else if (state.mode === 'wrong') {
      min = Math.max(10, Math.ceil(count * 1.5));
    } else if (/중복기출/.test(text)) {
      min = Math.max(30, Math.ceil(count * 1.5));
    } else if (/위험물기능장/.test(text)) {
      min = 60;
    } else if (/산업위생관리기사/.test(text)) {
      min = 150;
    } else {
      min = 150;
    }

    if (state.mode === 'wrong') {
      min = Math.max(10, Math.ceil(count * 1.5));
    }

    state.timeLimit = min * 60;
  }

  function ensureKatexReady() {
    return new Promise((resolve) => {
      if (window.katex) {
        resolve();
        return;
      }

      let tries = 0;

      const timer = setInterval(() => {
        tries++;

        if (window.katex || tries > 20) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  }

  function startAutoSave() {
    state.autoSaveInterval = setInterval(() => {
      if (
        !state.submitted &&
        Object.keys(state.answers).length > 0
      ) {
        saveProgress();
      }
    }, 30000);
  }

  /* ============================================
     데이터 로드
     ============================================ */

  async function loadExamData(forceNewRandom = false) {
    if (state.isRandomExam) {
      await loadRandomExamData(forceNewRandom);
      return;
    }

    const res = await fetch(
      `data/${encodeURIComponent(state.examId)}.json`
    );

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    const data = await res.json();

    state.examTitle = data.title || state.examId;
    state.questions =
      Array.isArray(data.questions)
        ? data.questions
        : [];

    state.durationMin =
      Number(data.duration || data.timeLimitMin || 0) ||
      null;

    state.questions.forEach((q, i) => {
      if (typeof q.no !== 'number') {
        q.no = i + 1;
      }

      if (SUBJECT_MAP[q.subject]) {
        q.subject = SUBJECT_MAP[q.subject];
      }
    });
  }

  async function loadRandomExamData(forceNewRandom) {
    let randomExam = null;

    if (!forceNewRandom) {
      randomExam = getSavedRandomExam();
    }

    if (!randomExam) {
      randomExam = await createNewRandomExam();
    }

    if (
      !randomExam ||
      !Array.isArray(randomExam.questions)
    ) {
      throw new Error(
        '저장된 랜덤 시험 데이터가 올바르지 않습니다.'
      );
    }

    state.examTitle =
      randomExam.title || '랜덤 기출문제';

    state.questions = randomExam.questions;

    state.durationMin =
      Number(
        randomExam.duration ||
        randomExam.timeLimitMin ||
        150
      ) || 150;

    state.randomCreatedAt =
      randomExam.createdAt || null;

    state.loadedFileCount =
      randomExam.loadedFileCount || 0;

    state.questions.forEach((q, index) => {
      q.no = index + 1;

      if (SUBJECT_MAP[q.subject]) {
        q.subject = SUBJECT_MAP[q.subject];
      }
    });
  }

  function getSavedRandomExam() {
    try {
      const saved =
        localStorage.getItem(RANDOM_EXAM_STORAGE_KEY);

      if (!saved) return null;

      const parsed = JSON.parse(saved);

      if (
        !parsed ||
        !Array.isArray(parsed.questions) ||
        parsed.questions.length !== 120
      ) {
        localStorage.removeItem(
          RANDOM_EXAM_STORAGE_KEY
        );
        return null;
      }

      return parsed;
    } catch (error) {
      console.warn(
        '저장된 랜덤 시험 복원 실패:',
        error
      );

      localStorage.removeItem(
        RANDOM_EXAM_STORAGE_KEY
      );

      return null;
    }
  }

  async function createNewRandomExam() {
    const loadResult = await loadQuestionBank();

    const randomExam = createRandomExam(
      loadResult.questionBank
    );

    randomExam.loadedFileCount =
      loadResult.loadedFileCount;

    randomExam.failedFiles =
      loadResult.failedFiles.map((item) => item.path);

    try {
      /*
       * 새로운 랜덤 시험을 만들 때 이전 랜덤 시험의
       * 답안 및 진행 상황을 제거합니다.
       */
      localStorage.removeItem(
        'exam-progress-random'
      );

      localStorage.setItem(
        RANDOM_EXAM_STORAGE_KEY,
        JSON.stringify(randomExam)
      );
    } catch (error) {
      console.warn(
        '랜덤 시험 저장 실패:',
        error
      );

      /*
       * 저장 실패 시에도 현재 시험은 진행할 수 있습니다.
       * 다만 새로고침하면 문제가 유지되지 않을 수 있습니다.
       */
    }

    return randomExam;
  }

  async function loadQuestionBank() {
    const filePaths = await loadExamFileList();

    if (filePaths.length === 0) {
      throw new Error(
        '불러올 기출문제 JSON 파일이 없습니다.'
      );
    }

    const results = await Promise.allSettled(
      filePaths.map(async (path) => {
        const exam = await fetchJson(path);

        if (
          !exam ||
          !Array.isArray(exam.questions)
        ) {
          throw new Error(
            `${path} 파일에 questions 배열이 없습니다.`
          );
        }

        return {
          path,
          exam
        };
      })
    );

    const loadedExams = [];
    const failedFiles = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        loadedExams.push(result.value);
      } else {
        failedFiles.push({
          path: filePaths[index],
          reason:
            result.reason &&
            result.reason.message
              ? result.reason.message
              : '알 수 없는 오류'
        });
      }
    });

    if (failedFiles.length > 0) {
      console.warn(
        '일부 문제 파일 로딩 실패:',
        failedFiles
      );
    }

    if (loadedExams.length === 0) {
      throw new Error(
        '정상적으로 불러온 문제 파일이 없습니다.'
      );
    }

    const questionBank = [];

    loadedExams.forEach(({ path, exam }) => {
      exam.questions.forEach(
        (originalQuestion, questionIndex) => {
          if (!originalQuestion) return;

          const normalizedSubject =
            normalizeSubject(
              originalQuestion.subject,
              originalQuestion.no
            );

          /*
           * 산업안전기사 6개 과목으로 분류되지 않는 문제는
           * 랜덤 문제은행에서 제외합니다.
           */
          if (!normalizedSubject) {
            console.warn(
              '알 수 없는 과목이라 제외:',
              {
                path,
                no: originalQuestion.no,
                subject: originalQuestion.subject
              }
            );
            return;
          }

          questionBank.push({
            ...originalQuestion,
            subject: normalizedSubject,

            /*
             * 원본 문제 추적용 정보입니다.
             * 화면 및 채점에는 영향을 주지 않습니다.
             */
            sourceExamId:
              exam.examId || fileNameFromPath(path),

            sourceTitle:
              exam.title || '',

            sourceNo:
              typeof originalQuestion.no === 'number'
                ? originalQuestion.no
                : questionIndex + 1,

            sourceFile: path
          });
        }
      );
    });

    if (questionBank.length === 0) {
      throw new Error(
        '랜덤 문제은행에 사용할 수 있는 문항이 없습니다.'
      );
    }

    return {
      questionBank,
      loadedFileCount: loadedExams.length,
      failedFiles
    };
  }

  async function loadExamFileList() {
    let discoveredFiles = [];

    try {
      const indexData = await fetchJson(
        RANDOM_INDEX_URL
      );

      discoveredFiles =
        extractJsonFilePaths(indexData);
    } catch (error) {
      console.warn(
        'data/index.json 로딩 실패. 예비 목록을 사용합니다.',
        error
      );
    }

    if (discoveredFiles.length === 0) {
      discoveredFiles = FALLBACK_EXAM_FILES;
    }

    const normalizedPaths =
      discoveredFiles
        .map(normalizeDataPath)
        .filter(Boolean)
        .filter(
          (path) =>
            path.toLowerCase().endsWith('.json')
        )
        .filter(
          (path) =>
            !path.toLowerCase().endsWith(
              '/index.json'
            )
        );

    return [...new Set(normalizedPaths)];
  }

  /*
   * index.json이 다음 중 어떤 구조여도 JSON 파일명을 찾습니다.
   *
   * 1) ["2025-02-08.json"]
   * 2) { "files": ["2025-02-08.json"] }
   * 3) { "exams": [{ "file": "2025-02-08.json" }] }
   * 4) [{ "id": "2025-02-08" }]
   * 5) [{ "examId": "2025-02-08" }]
   */
  function extractJsonFilePaths(value) {
    const found = [];

    function walk(current, parentKey = '') {
      if (current == null) return;

      if (typeof current === 'string') {
        const text = current.trim();

        if (/\.json(?:\?.*)?$/i.test(text)) {
          found.push(text);
          return;
        }

        const keyAllowsId =
          /^(id|examId|exam|slug|filename|file|path)$/i
            .test(parentKey);

        if (
          keyAllowsId &&
          /^\d{4}-\d{2}-\d{2}$/.test(text)
        ) {
          found.push(`${text}.json`);
        }

        return;
      }

      if (Array.isArray(current)) {
        current.forEach((item) => {
          walk(item, parentKey);
        });
        return;
      }

      if (typeof current === 'object') {
        Object.entries(current).forEach(
          ([key, item]) => {
            walk(item, key);
          }
        );
      }
    }

    walk(value);

    return [...new Set(found)];
  }

  function normalizeDataPath(filePath) {
    if (!filePath) return null;

    let path = String(filePath).trim();

    if (!path) return null;

    if (/^https?:\/\//i.test(path)) {
      return path;
    }

    path = path
      .replace(/^\.\//, '')
      .replace(/^\/+/, '');

    if (path.startsWith('data/')) {
      return path;
    }

    return `data/${path}`;
  }

  async function fetchJson(url) {
    const separator =
      url.includes('?') ? '&' : '?';

    /*
     * Cloudflare 또는 브라우저 캐시 때문에
     * 갱신된 index.json이 늦게 반영되는 것을 줄입니다.
     */
    const requestUrl =
      `${url}${separator}_=${Date.now()}`;

    const response = await fetch(requestUrl, {
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(
        `${url} 로딩 실패: HTTP ${response.status}`
      );
    }

    try {
      return await response.json();
    } catch (error) {
      throw new Error(
        `${url} JSON 문법 오류: ${error.message}`
      );
    }
  }

  function normalizeSubject(subject, questionNo) {
    if (subject && SUBJECT_MAP[subject]) {
      return SUBJECT_MAP[subject];
    }

    /*
     * 과목명이 없거나 인식되지 않더라도
     * 원본 번호가 1~120이면 번호 범위로 분류합니다.
     */
    const no = Number(questionNo);

    if (no >= 1 && no <= 20) {
      return RANDOM_SUBJECTS[0].name;
    }

    if (no >= 21 && no <= 40) {
      return RANDOM_SUBJECTS[1].name;
    }

    if (no >= 41 && no <= 60) {
      return RANDOM_SUBJECTS[2].name;
    }

    if (no >= 61 && no <= 80) {
      return RANDOM_SUBJECTS[3].name;
    }

    if (no >= 81 && no <= 100) {
      return RANDOM_SUBJECTS[4].name;
    }

    if (no >= 101 && no <= 120) {
      return RANDOM_SUBJECTS[5].name;
    }

    return null;
  }

  function createRandomExam(questionBank) {
    const selectedQuestions = [];

    RANDOM_SUBJECTS.forEach((subjectInfo) => {
      const candidates = questionBank.filter(
        (question) =>
          question.subject === subjectInfo.name
      );

      const uniqueCandidates =
        removeDuplicateQuestions(candidates);

      if (uniqueCandidates.length < 20) {
        throw new Error(
          `${subjectInfo.name} 과목의 문항이 부족합니다. ` +
          `중복 제거 후 ${uniqueCandidates.length}문항입니다.`
        );
      }

      const selected =
        shuffleArray(uniqueCandidates).slice(0, 20);

      selectedQuestions.push(...selected);
    });

    const questions =
      selectedQuestions.map(
        (question, index) => ({
          ...question,
          no: index + 1
        })
      );

    return {
      examId: RANDOM_EXAM_ID,
      title: '랜덤 기출문제',
      duration: 150,
      passingScore: 60,
      subjects: RANDOM_SUBJECTS,
      questions,
      randomExam: true,
      createdAt: new Date().toISOString()
    };
  }

  function removeDuplicateQuestions(questions) {
    const uniqueMap = new Map();

    questions.forEach((question) => {
      const key = makeQuestionKey(question);

      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, question);
      }
    });

    return [...uniqueMap.values()];
  }

  function makeQuestionKey(question) {
    const normalizedQuestion =
      normalizeQuestionText(question.question);

    return (
      `${question.subject}::${normalizedQuestion}`
    );
  }

  function normalizeQuestionText(text) {
    return String(text || '')
      .normalize('NFKC')
      .replace(/\s+/g, ' ')
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .trim()
      .toLowerCase();
  }

  function shuffleArray(array) {
    const result = [...array];

    for (
      let i = result.length - 1;
      i > 0;
      i--
    ) {
      const j =
        Math.floor(Math.random() * (i + 1));

      [result[i], result[j]] = [
        result[j],
        result[i]
      ];
    }

    return result;
  }

  function fileNameFromPath(path) {
    return String(path || '')
      .split('/')
      .pop()
      .replace(/\.json$/i, '');
  }

  /* ============================================
     오답 필터링
     ============================================ */

  function filterWrongQuestions() {
    const session =
      window.Storage &&
      window.Storage.getSession
        ? window.Storage.getSession(
            state.sessionId
          )
        : null;

    if (!session || !session.answers) {
      alert(
        '원본 세션 정보를 찾을 수 없어 전체 문제로 진행합니다.'
      );
      state.mode = 'exam';
      return;
    }

    const wrongNos = [];

    state.questions.forEach((q) => {
      const picked = session.answers[q.no];

      if (picked !== q.answer) {
        wrongNos.push(q.no);
      }
    });

    if (wrongNos.length === 0) {
      alert(
        '🎉 오답이 없습니다! 전체 문제로 진행합니다.'
      );
      state.mode = 'exam';
      return;
    }

    state.questions =
      state.questions.filter(
        (q) => wrongNos.includes(q.no)
      );

    state.examTitle +=
      ` · 오답 재도전 (${state.questions.length}문항)`;
  }

  /* ============================================
     진행 상황 저장 및 복구
     ============================================ */

  function restoreProgress() {
    const key = getStorageKey();

    try {
      const saved = JSON.parse(
        localStorage.getItem(key) || '{}'
      );

      state.answers = saved.answers || {};
      state.bookmarks = saved.bookmarks || {};
      state.perPage = saved.perPage || 2;
      state.currentPage =
        saved.currentPage || 1;

      state.startTime =
        saved.startTime || Date.now();

      const elapsed = Math.floor(
        (Date.now() - state.startTime) / 1000
      );

      if (elapsed >= state.timeLimit) {
        state.startTime = Date.now();
      }

      if (els.perPage) {
        els.perPage.value = state.perPage;
      }
    } catch (error) {
      console.warn(
        '진행 상황 복구 실패:',
        error
      );

      state.answers = {};
      state.bookmarks = {};
      state.startTime = Date.now();
    }

    updateTotalPages();
  }

  function saveProgress() {
    const key = getStorageKey();

    const data = {
      answers: state.answers,
      bookmarks: state.bookmarks,
      perPage: state.perPage,
      currentPage: state.currentPage,
      startTime: state.startTime,
      randomCreatedAt:
        state.randomCreatedAt || null,
      lastSavedAt: Date.now()
    };

    try {
      localStorage.setItem(
        key,
        JSON.stringify(data)
      );
      return true;
    } catch (error) {
      console.warn('저장 실패:', error);
      return false;
    }
  }

  function getStorageKey() {
    const modeSuffix =
      state.mode === 'wrong'
        ? `-wrong-${state.sessionId}`
        : '';

    return (
      `exam-progress-${state.examId}` +
      modeSuffix
    );
  }

  /* ============================================
     이벤트 바인딩
     ============================================ */

  function bindEvents() {
    if (els.perPage) {
      els.perPage.addEventListener(
        'change',
        () => {
          state.perPage =
            parseInt(
              els.perPage.value,
              10
            ) || 2;

          state.currentPage = 1;

          updateTotalPages();
          renderPage();
          saveProgress();
        }
      );
    }

    if (els.prevPage) {
      els.prevPage.addEventListener(
        'click',
        () => {
          if (state.currentPage > 1) {
            state.currentPage--;
            renderPage();
            saveProgress();

            window.scrollTo({
              top: 0,
              behavior: 'smooth'
            });
          }
        }
      );
    }

    if (els.nextPage) {
      els.nextPage.addEventListener(
        'click',
        () => {
          if (
            state.currentPage <
            state.totalPages
          ) {
            state.currentPage++;
            renderPage();
            saveProgress();

            window.scrollTo({
              top: 0,
              behavior: 'smooth'
            });
          }
        }
      );
    }

    if (els.jumpBtn) {
      els.jumpBtn.addEventListener(
        'click',
        () => {
          const total =
            state.questions.length;

          const input = prompt(
            `이동할 문제 번호 (1 ~ ${total}):`
          );

          if (!input) return;

          const target =
            parseInt(input, 10);

          if (
            Number.isNaN(target) ||
            target < 1 ||
            target > total
          ) {
            alert(
              '올바른 문제 번호를 입력하세요.'
            );
            return;
          }

          const idx =
            state.questions.findIndex(
              (q) => q.no === target
            );

          const useIdx =
            idx >= 0 ? idx : target - 1;

          state.currentPage =
            Math.floor(
              useIdx / state.perPage
            ) + 1;

          renderPage();
          saveProgress();

          window.scrollTo({
            top: 0,
            behavior: 'smooth'
          });
        }
      );
    }

    if (els.modeToggle) {
      els.modeToggle.addEventListener(
        'click',
        () => {
          if (state.mode === 'wrong') {
            alert(
              '오답 재도전은 실전 모드로만 진행됩니다.'
            );
            return;
          }

          if (state.mode === 'exam') {
            state.mode = 'study';
            els.modeToggle.textContent =
              '📖 학습모드';

            els.modeToggle.classList.add(
              'btn-primary'
            );
          } else {
            state.mode = 'exam';
            els.modeToggle.textContent =
              '🎯 실전모드';

            els.modeToggle.classList.remove(
              'btn-primary'
            );
          }

          renderPage();
        }
      );
    }

    if (els.resetBtn) {
      els.resetBtn.addEventListener(
        'click',
        handleReset
      );
    }

    if (els.saveBtn) {
      els.saveBtn.addEventListener(
        'click',
        () => {
          const ok = saveProgress();

          const answered =
            Object.keys(
              state.answers
            ).length;

          if (ok) {
            showToast(
              `💾 저장 완료! (${answered}문항 진행 중)`
            );
          } else {
            showToast(
              '⚠️ 저장에 실패했습니다.',
              3000
            );
          }
        }
      );
    }

    if (els.homeBtn) {
      els.homeBtn.addEventListener(
        'click',
        () => {
          const answered =
            Object.keys(
              state.answers
            ).length;

          const msg =
            answered > 0
              ? (
                `💾 현재까지 푼 ${answered}문항이 저장됩니다.\n\n` +
                '나중에 다시 이 시험을 선택하면 이어서 풀 수 있습니다.\n\n' +
                '홈으로 이동할까요?'
              )
              : '홈으로 이동하시겠습니까?';

          if (!confirm(msg)) return;

          saveProgress();

          clearInterval(
            state.autoSaveInterval
          );

          window.removeEventListener(
            'beforeunload',
            beforeUnloadHandler
          );

          window.location.href =
            'index.html';
        }
      );
    }

    if (els.submitBtn) {
      els.submitBtn.addEventListener(
        'click',
        () => handleSubmit(false)
      );
    }
  }

  function handleReset() {
    if (state.isRandomExam) {
      const makeNew = confirm(
        '🎲 랜덤 기출문제입니다.\n\n' +
        '[확인] 새로운 120문항을 다시 생성합니다.\n' +
        '[취소] 현재 문제는 유지하고 답안만 초기화합니다.'
      );

      if (makeNew) {
        const confirmed = confirm(
          '⚠️ 현재 답안과 진행 상황이 모두 삭제됩니다.\n\n' +
          '새로운 랜덤 문제를 생성할까요?'
        );

        if (!confirmed) return;

        localStorage.removeItem(
          getStorageKey()
        );

        localStorage.removeItem(
          RANDOM_EXAM_STORAGE_KEY
        );

        window.removeEventListener(
          'beforeunload',
          beforeUnloadHandler
        );

        window.location.href =
          'exam.html?exam=random&new=1';

        return;
      }
    }

    if (
      !confirm(
        '⚠️ 현재 시험의 답안과 진행상황을 모두 지웁니다. 계속할까요?'
      )
    ) {
      return;
    }

    state.answers = {};
    state.bookmarks = {};
    state.currentPage = 1;
    state.startTime = Date.now();
    state.submitted = false;

    saveProgress();
    renderPage();

    showToast('↺ 초기화되었습니다.');
  }

  /* ============================================
     제목
     ============================================ */

  function updateTitle() {
    const min =
      Math.round(
        state.timeLimit / 60
      );

    els.title.textContent =
      `${state.examTitle || state.examId} ` +
      `(${state.questions.length}문항 / ${min}분)`;

    if (state.mode === 'wrong') {
      els.modeToggle.style.display =
        'none';
    } else if (state.mode === 'study') {
      els.modeToggle.textContent =
        '📖 학습모드';

      els.modeToggle.classList.add(
        'btn-primary'
      );
    }
  }

  /* ============================================
     페이지
     ============================================ */

  function updateTotalPages() {
    state.totalPages = Math.max(
      1,
      Math.ceil(
        state.questions.length /
        state.perPage
      )
    );

    if (
      state.currentPage >
      state.totalPages
    ) {
      state.currentPage =
        state.totalPages;
    }
  }

  function renderPage() {
    updateTotalPages();

    const start =
      (state.currentPage - 1) *
      state.perPage;

    const end = Math.min(
      start + state.perPage,
      state.questions.length
    );

    const pageQuestions =
      state.questions.slice(
        start,
        end
      );

    els.questionArea.innerHTML = '';

    pageQuestions.forEach((q) => {
      els.questionArea.appendChild(
        renderQuestionCard(q)
      );
    });

    els.pageInfo.textContent =
      `${state.currentPage} / ${state.totalPages}`;

    els.prevPage.disabled =
      state.currentPage === 1;

    els.nextPage.disabled =
      state.currentPage ===
      state.totalPages;

    updateProgress();
  }

  /* ============================================
     문제 카드
     ============================================ */

  function renderQuestionCard(q) {
    const card =
      document.createElement('div');

    card.className =
      'question-card';

    if (state.bookmarks[q.no]) {
      card.classList.add(
        'bookmarked'
      );
    }

    card.dataset.no = q.no;

    const header =
      document.createElement('div');

    header.className =
      'question-header';

    header.innerHTML = `
      <div>
        <span class="question-no">${q.no}</span>
        ${
          q.subject
            ? `<span class="subject-tag">${escapeHtml(q.subject)}</span>`
            : ''
        }
      </div>
      <div class="question-actions">
        <button
          class="btn-icon bookmark-btn"
          title="북마크"
          data-no="${q.no}"
          type="button"
        >
          ${state.bookmarks[q.no] ? '⭐' : '☆'}
        </button>
      </div>
    `;

    card.appendChild(header);

    const qText =
      document.createElement('div');

    qText.className =
      'question-text';

    qText.textContent =
      q.question || '';

    card.appendChild(qText);

    if (q.passage) {
      const passageEl =
        renderPassage(q.passage);

      if (passageEl) {
        card.appendChild(
          passageEl
        );
      }
    }

    const choicesDiv =
      document.createElement('div');

    choicesDiv.className =
      'choices';

    (q.choices || []).forEach(
      (choiceText, idx) => {
        const choiceNo = idx + 1;

        const choice =
          document.createElement('div');

        choice.className = 'choice';
        choice.dataset.no = q.no;
        choice.dataset.choice =
          choiceNo;

        const picked =
          state.answers[q.no];

        if (picked === choiceNo) {
          choice.classList.add(
            'selected'
          );
        }

        if (
          state.mode === 'study' &&
          picked
        ) {
          if (
            choiceNo === q.answer
          ) {
            choice.classList.add(
              'correct'
            );
          } else if (
            choiceNo === picked
          ) {
            choice.classList.add(
              'wrong'
            );
          }
        }

        choice.innerHTML = `
          <span class="choice-no">${choiceNo}</span>
          <span class="choice-text">${escapeHtml(choiceText)}</span>
        `;

        choice.addEventListener(
          'click',
          () => {
            handleChoiceClick(
              q,
              choiceNo
            );
          }
        );

        choicesDiv.appendChild(
          choice
        );
      }
    );

    card.appendChild(choicesDiv);

    if (q.explanation) {
      const exp =
        document.createElement('div');

      exp.className =
        'explanation';

      if (
        state.mode === 'study' &&
        state.answers[q.no]
      ) {
        exp.classList.add('show');
      }

      exp.innerHTML =
        '<span class="label">💡 해설</span>' +
        escapeHtml(q.explanation);

      card.appendChild(exp);
    }

    const bmBtn =
      header.querySelector(
        '.bookmark-btn'
      );

    if (bmBtn) {
      bmBtn.addEventListener(
        'click',
        (event) => {
          event.stopPropagation();
          toggleBookmark(q.no);
        }
      );
    }

    return card;
  }

  /* ============================================
     지문
     ============================================ */

  function renderPassage(passage) {
    if (
      window.PassageRenderer &&
      typeof window.PassageRenderer.render ===
        'function'
    ) {
      const html =
        window.PassageRenderer.render(
          passage
        );

      if (html) {
        const wrapper =
          document.createElement('div');

        wrapper.className =
          'passage passage-v2';

        wrapper.innerHTML = html;

        return wrapper;
      }
    }

    const box =
      document.createElement('div');

    box.className = 'passage';

    if (typeof passage === 'string') {
      box.classList.add('type-text');
      box.textContent = passage;
      return box;
    }

    /*
     * PassageRenderer가 없을 때도
     * passage 배열을 최대한 표시합니다.
     */
    if (Array.isArray(passage)) {
      box.classList.add('type-mixed');

      passage.forEach((item) => {
        const rendered =
          renderSinglePassage(item);

        if (rendered) {
          box.appendChild(rendered);
        }
      });

      return box;
    }

    const rendered =
      renderSinglePassage(passage);

    if (rendered) {
      box.appendChild(rendered);
    }

    return box;
  }

  function renderSinglePassage(passage) {
    if (!passage) return null;

    if (typeof passage === 'string') {
      const text =
        document.createElement('div');

      text.textContent = passage;
      return text;
    }

    const type =
      passage.type || 'text';

    const section =
      document.createElement('div');

    section.className =
      `passage-section type-${type}`;

    if (passage.caption) {
      const caption =
        document.createElement('div');

      caption.className =
        'passage-caption';

      caption.textContent =
        passage.caption;

      section.appendChild(caption);
    }

    if (passage.title) {
      const title =
        document.createElement('div');

      title.className =
        'passage-title';

      title.textContent =
        passage.title;

      section.appendChild(title);
    }

    if (type === 'list') {
      const list =
        document.createElement(
          passage.ordered
            ? 'ol'
            : 'ul'
        );

      (passage.items || []).forEach(
        (item) => {
          const li =
            document.createElement('li');

          li.textContent = item;
          list.appendChild(li);
        }
      );

      section.appendChild(list);

      return section;
    }

    if (type === 'table') {
      const table =
        document.createElement('table');

      if (
        Array.isArray(
          passage.headers
        ) &&
        passage.headers.length
      ) {
        const thead =
          document.createElement('thead');

        const tr =
          document.createElement('tr');

        passage.headers.forEach(
          (header) => {
            const th =
              document.createElement('th');

            th.textContent = header;
            tr.appendChild(th);
          }
        );

        thead.appendChild(tr);
        table.appendChild(thead);
      }

      const tbody =
        document.createElement('tbody');

      (passage.rows || []).forEach(
        (row) => {
          const tr =
            document.createElement('tr');

          (row || []).forEach(
            (cell) => {
              const td =
                document.createElement('td');

              td.textContent = cell;
              tr.appendChild(td);
            }
          );

          tbody.appendChild(tr);
        }
      );

      table.appendChild(tbody);
      section.appendChild(table);

      return section;
    }

    if (type === 'svg') {
      const svgWrapper =
        document.createElement('div');

      svgWrapper.className =
        'passage-svg';

      svgWrapper.innerHTML =
        passage.content || '';

      section.appendChild(
        svgWrapper
      );

      return section;
    }

    if (type === 'katex') {
      const formula =
        document.createElement('div');

      formula.className =
        passage.display
          ? 'katex-display-wrapper'
          : 'katex-inline-wrapper';

      const content =
        passage.content || '';

      if (window.katex) {
        try {
          window.katex.render(
            content,
            formula,
            {
              displayMode:
                passage.display !== false,
              throwOnError: false
            }
          );
        } catch (error) {
          formula.textContent = content;
        }
      } else {
        formula.textContent = content;
      }

      section.appendChild(formula);

      return section;
    }

    const text =
      document.createElement('div');

    text.className =
      'passage-text';

    text.textContent =
      passage.text ||
      passage.content ||
      '';

    section.appendChild(text);

    return section;
  }

  function handleChoiceClick(q, choiceNo) {
    if (state.submitted) return;

    state.answers[q.no] =
      choiceNo;

    saveProgress();
    renderPage();
    updateProgress();
  }

  function toggleBookmark(no) {
    if (state.bookmarks[no]) {
      delete state.bookmarks[no];
    } else {
      state.bookmarks[no] = true;
    }

    saveProgress();

    if (
      window.Storage &&
      window.Storage.setGlobalBookmark
    ) {
      const q =
        state.questions.find(
          (question) =>
            question.no === no
        );

      if (q) {
        window.Storage.setGlobalBookmark(
          state.examId,
          no,
          !!state.bookmarks[no],
          q
        );
      }
    }

    renderPage();
  }

  function updateProgress() {
    const total =
      state.questions.length;

    const answered =
      Object.keys(
        state.answers
      ).filter((key) => {
        return state.questions.some(
          (q) =>
            String(q.no) ===
            String(key)
        );
      }).length;

    const percent =
      total > 0
        ? Math.round(
            (answered / total) * 100
          )
        : 0;

    els.progressFill.style.width =
      percent + '%';

    els.answeredCount.textContent =
      `${answered} / ${total} 답변`;
  }

  /* ============================================
     타이머
     ============================================ */

  function startTimer() {
    if (!state.startTime) {
      state.startTime =
        Date.now();
    }

    updateTimer();

    state.timerInterval =
      setInterval(
        updateTimer,
        1000
      );
  }

  function updateTimer() {
    const elapsed = Math.floor(
      (
        Date.now() -
        state.startTime
      ) / 1000
    );

    const remaining = Math.max(
      0,
      state.timeLimit - elapsed
    );

    els.timer.classList.remove(
      'warning',
      'danger'
    );

    if (remaining <= 60) {
      els.timer.classList.add(
        'danger'
      );
    } else if (remaining <= 300) {
      els.timer.classList.add(
        'warning'
      );
    }

    els.timer.textContent =
      formatTime(remaining);

    if (remaining === 0) {
      clearInterval(
        state.timerInterval
      );

      alert(
        '⏰ 시험 시간이 종료되었습니다. 자동 제출됩니다.'
      );

      handleSubmit(true);
    }
  }

  function formatTime(sec) {
    const h =
      Math.floor(sec / 3600);

    const m =
      Math.floor(
        (sec % 3600) / 60
      );

    const s = sec % 60;

    return (
      `${String(h).padStart(2, '0')}:` +
      `${String(m).padStart(2, '0')}:` +
      `${String(s).padStart(2, '0')}`
    );
  }

  /* ============================================
     제출
     ============================================ */

  function handleSubmit(auto = false) {
    if (state.submitted) return;

    const total =
      state.questions.length;

    const answered =
      state.questions.filter(
        (q) =>
          state.answers[q.no] != null
      ).length;

    if (!auto) {
      const unanswered =
        total - answered;

      const msg =
        unanswered > 0
          ? (
            `⚠️ ${unanswered}문항을 풀지 않았습니다.\n\n` +
            '정말 제출하시겠습니까?'
          )
          : (
            `총 ${total}문항 모두 답변했습니다.\n\n` +
            '제출하시겠습니까?'
          );

      if (!confirm(msg)) return;
    }

    state.submitted = true;

    clearInterval(
      state.timerInterval
    );

    clearInterval(
      state.autoSaveInterval
    );

    let correct = 0;

    const subjectStats = {};
    const reviewData = [];

    state.questions.forEach((q) => {
      const picked =
        state.answers[q.no] || null;

      const isCorrect =
        picked === q.answer;

      if (isCorrect) {
        correct++;
      }

      const subj =
        q.subject || '전체';

      if (!subjectStats[subj]) {
        subjectStats[subj] = {
          correct: 0,
          total: 0
        };
      }

      subjectStats[subj].total++;

      if (isCorrect) {
        subjectStats[subj].correct++;
      }

      reviewData.push({
        no: q.no,
        subject: subj,
        question: q.question,
        passage: q.passage || null,
        choices: q.choices,
        answer: q.answer,
        picked,
        correct: isCorrect,
        explanation:
          q.explanation || '',
        bookmarked:
          !!state.bookmarks[q.no],

        /*
         * 랜덤 문제의 원본 출처
         */
        sourceExamId:
          q.sourceExamId || null,

        sourceTitle:
          q.sourceTitle || null,

        sourceNo:
          q.sourceNo || null,

        sourceFile:
          q.sourceFile || null
      });
    });

    const elapsedSec = Math.floor(
      (
        Date.now() -
        state.startTime
      ) / 1000
    );

    const sessionId =
      'sess-' + Date.now();

    const resultData = {
      sessionId,
      examId: state.examId,
      examTitle: state.examTitle,
      mode: state.mode,
      isRandomExam:
        state.isRandomExam,
      randomCreatedAt:
        state.randomCreatedAt,
      total,
      correct,
      score:
        total > 0
          ? Math.round(
              (correct / total) * 100
            )
          : 0,
      elapsedSec,
      timeLimitSec:
        state.timeLimit,
      subjectStats,
      review: reviewData,
      answers: state.answers,
      bookmarks:
        state.bookmarks,
      submittedAt:
        Date.now()
    };

    if (
      window.Storage &&
      window.Storage.saveSession
    ) {
      window.Storage.saveSession(
        sessionId,
        resultData
      );
    } else {
      localStorage.setItem(
        `result-${sessionId}`,
        JSON.stringify(resultData)
      );
    }

    localStorage.removeItem(
      getStorageKey()
    );

    window.removeEventListener(
      'beforeunload',
      beforeUnloadHandler
    );

    window.location.href =
      `result.html?session=${sessionId}`;
  }

  function beforeUnloadHandler(event) {
    if (state.submitted) return;

    if (
      Object.keys(
        state.answers
      ).length === 0
    ) {
      return;
    }

    saveProgress();

    event.preventDefault();
    event.returnValue = '';

    return '';
  }

  /* ============================================
     토스트
     ============================================ */

  let toastTimer = null;

  function showToast(
    message,
    duration = 2000
  ) {
    let toast =
      document.getElementById(
        'cbt-toast'
      );

    if (!toast) {
      toast =
        document.createElement('div');

      toast.id = 'cbt-toast';

      toast.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: rgba(30, 41, 59, 0.95);
        color: #fff;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 0.95rem;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        opacity: 0;
        transition:
          opacity 0.25s ease,
          transform 0.25s ease;
        pointer-events: none;
        max-width: 90%;
        text-align: center;
      `;

      document.body.appendChild(
        toast
      );
    }

    toast.textContent = message;

    requestAnimationFrame(() => {
      toast.style.opacity = '1';

      toast.style.transform =
        'translateX(-50%) translateY(0)';
    });

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    toastTimer = setTimeout(() => {
      toast.style.opacity = '0';

      toast.style.transform =
        'translateX(-50%) translateY(20px)';
    }, duration);
  }

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
