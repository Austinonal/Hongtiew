/* ห้องติว — ครู AI ส่วนตัว (Gemini API) */
(function () {
  'use strict';

  var VERSION = '2.1.1';
  var API = 'https://generativelanguage.googleapis.com';
  var TUTOR_PROMPT = document.getElementById('tutor-prompt').textContent.trim();

  var DEFAULT_MODEL = 'gemini-3.8-flash';
  var FALLBACK_MODELS = [
    { id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash (แนะนำ ใช้ฟรีได้)' },
    { id: 'gemini-flash-latest', label: 'Gemini Flash รุ่นล่าสุดเสมอ' },
    { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (เร็ว ประหยัด)' },
    { id: 'gemini-3.1-pro-preview', label: 'Gemini 3.1 Pro (ต้องเปิดใช้แบบเสียเงิน)' }
  ];
  var INLINE_MAX = 48 * 1024 * 1024;
  var FILE_API_MIN = 3.5 * 1024 * 1024;
  var FILE_TTL = 46 * 3600 * 1000;
  var MAX_TEXT_CHARS = 400000;
  var HISTORY_CHAR_BUDGET = 120000;
  var HISTORY_IMAGE_MSGS = 3;
  var DAY = 864e5;

  var SUBJECTS = [
    { id: 'all', label: 'ทุกวิชา', en: 'none' },
    { id: 'math', label: 'คณิต', en: 'Mathematics' },
    { id: 'physics', label: 'ฟิสิกส์', en: 'Physics' },
    { id: 'chem', label: 'เคมี', en: 'Chemistry' },
    { id: 'bio', label: 'ชีวะ', en: 'Biology' },
    { id: 'python', label: 'Python', en: 'Python programming' }
  ];
  var SUBJECT_LABEL = { math: 'คณิต', physics: 'ฟิสิกส์', chem: 'เคมี', bio: 'ชีวะ', python: 'Python', other: 'อื่นๆ' };

  var SUGGESTIONS = [
    { s: 'physics', t: 'อธิบายกฎการเคลื่อนที่ข้อที่ 2 ของนิวตัน พร้อมโจทย์ตัวอย่าง 1 ข้อ' },
    { s: 'chem', t: 'ดุลสมการ Fe + O₂ → Fe₂O₃ ให้ดูทีละขั้น' },
    { s: 'bio', t: 'สรุปความต่างของไมโทซิสกับไมโอซิสให้จำง่าย' },
    { s: 'math', t: 'วาดกราฟ y = x² − 4x + 3 แล้วอธิบายจุดตัดแกน' },
    { s: 'python', t: 'สอนเขียน for loop ใน Python ตั้งแต่พื้นฐาน' }
  ];

  var PROFILE_TEMPLATE = [
    '- Current goals: ',
    '- Strong topics (by subject): ',
    '- Weak topics (by subject, with specific examples of mistakes): ',
    '- Recurring mistakes to watch for: ',
    '- Suggested next topics to study: ',
    '- Python skill level and next project idea: '
  ].join('\n');

  var SUMMARY_INSTRUCTION = 'สรุปวันนี้\n\n[Instruction from the app] Write my updated learning profile now, using exactly the six labels from the "Adapting to me" section: Current goals, Strong topics (by subject), Weak topics (by subject, with specific examples of mistakes), Recurring mistakes to watch for, Suggested next topics to study, Python skill level and next project idea. Keep the labels as written and write the content in Thai. Base it on my current learning_profile, my recent quiz mistakes, and what happened in this conversation. Replace outdated information instead of only adding to it, and keep it concise and specific. Output only the profile as six lines starting with "- ", with no introduction and no closing remarks.';

  var LEVELS = {
    basic: { label: 'พื้นฐาน', en: 'foundation level: checks core understanding of each key idea' },
    exam: { label: 'เท่าข้อสอบจริง', en: 'the same difficulty and style as real Thai A-Level exam questions' },
    hard: { label: 'ท้าทาย', en: 'harder than the real exam: multi-step, combining several ideas, with tricky distractors' }
  };

  var ACTIONS = [
    { id: 'summary', label: 'สรุปเนื้อหา', desc: 'ใจความสำคัญ สูตร ตัวอย่าง และสิ่งที่มักออกสอบ' },
    { id: 'teach', label: 'สอนทีละขั้น', desc: 'แบ่งหัวข้อ แล้วสอนทีละเรื่องพร้อมคำถามเช็กความเข้าใจ' },
    { id: 'quiz', label: 'แนวข้อสอบ', desc: 'ข้อสอบกดตอบได้ มีข้อเติมตัวเลข จับเวลาได้ ตรวจพร้อมเฉลย', json: true },
    { id: 'cards', label: 'บัตรคำทบทวน', desc: 'บัตรถาม-ตอบ ครูจะนัดทบทวนให้ตามจังหวะที่ช่วยให้จำได้นาน', json: true },
    { id: 'mnemonic', label: 'เทคนิคการจำ', desc: 'คำย่อ คำคล้องจอง ภาพจำ และรอบทบทวนแบบเว้นระยะ' },
    { id: 'traps', label: 'จุดที่มักผิดและกับดัก', desc: 'ความเข้าใจผิดที่พบบ่อย กับดักในตัวเลือก และวิธีเลี่ยง' },
    { id: 'cheatsheet', label: 'สรุปสูตรโค้งสุดท้าย', desc: 'สูตร นิยาม ค่าคงที่ และคู่ที่ชอบสับสน ในหน้าเดียว' },
    { id: 'weakness', label: 'วิเคราะห์จุดอ่อน', desc: 'ดูจากข้อที่เคยผิดและโปรไฟล์ แล้วบอกวิธีแก้ให้ตรงจุด' },
    { id: 'plan', label: 'แผนอ่านหนังสือ', desc: 'ตารางอ่านพร้อมรอบทบทวน เน้นจุดอ่อนของคุณ' }
  ];

  var ACTION_INSTR = {
    summary: function () { return 'Summarize the target for studying. Structure it as: (1) ภาพรวม in 2–3 sentences; (2) the key concepts in a logical order, each with a short clear explanation; (3) important formulas, definitions, and numbers (LaTeX), with what each symbol means; (4) typical examples or problem types; (5) what is most likely to be tested and why; (6) three self-check questions at the end, with answers hidden until I reply. Cite pages or slides when you use a file. Keep it easy to scan with small headings.'; },
    teach: function () { return 'Teach me the target step by step as my tutor. First show a short numbered outline of the topics (at most 8) in the order you will teach them. Then teach only the first topic: explain it simply with an example, then ask me one check question and wait for my answer before moving on. When I answer, give feedback and continue with the next topic in later turns. Cite pages or slides when you use a file.'; },
    mnemonic: function () { return 'Create memory techniques for the key things to remember in the target: lists, sequences, formulas, classifications, definitions, and easily confused pairs. For each one give: what to remember; the technique (Thai acronyms or คำย่อ, short rhymes or คำคล้องจอง, vivid images or stories, memory palace, chunking, visual patterns, or a quick derivation so I don\'t need to memorize it); and a one-line self-test. Make Thai mnemonics natural and easy to say, and check that every mnemonic maps correctly to the facts. End with a spaced-repetition schedule (review after 1, 3, 7, and 14 days).'; },
    traps: function () { return 'List the common mistakes and exam traps for the target: conceptual misunderstandings, calculation, unit, and sign errors, misreading question wording, confusing similar terms, and trick answer choices typical of A-Level exams. For each: the mistake, why students make it, a short example of wrong versus right reasoning, and a technique to avoid it. Then add valid time-saving exam techniques for this content (shortcuts, elimination strategies, estimation checks). Do not invent claims about specific past exam questions.'; },
    cheatsheet: function () { return 'Make a one-page cheat sheet of the target for last-minute review: formulas (LaTeX) with the meaning and units of each symbol, key definitions, constants, key diagrams described in words, and "don\'t confuse X with Y" pairs. Use compact Markdown tables where helpful. Be strictly accurate and verify every formula.'; },
    weakness: function () { return 'Analyze my weak points using my learning_profile, my recent quiz mistakes and flashcards I have not memorized, this conversation, and the target if there is one. Group the mistakes by root cause (concept gap, careless error, misreading, memorization). For each weak point: what is going wrong, a short targeted explanation, one technique to fix it, and one practice question with the answer hidden until I reply. End with my top 3 priorities for the next study session. If there is little data, say so and suggest taking a quiz with the แนวข้อสอบ tool.'; },
    plan: function () { return 'Make a study plan for the target. If you don\'t know my exam date or available time, assume 7 days with about 1–2 hours per day, and ask me for my real dates so you can adjust. Split it into sessions, each with: what to study, an active-recall task, a practice task, and review days using spaced repetition. Prioritize my weak areas from my learning_profile and recent mistakes.'; },
    quiz: function (o) {
      return 'Create an exam-style quiz from the target with exactly ' + o.count + ' questions, at ' + LEVELS[o.level].en + '. '
        + (o.mistakes ? 'Target the concepts behind my recent quiz mistakes listed in the system instructions, using new numbers and contexts rather than repeating the same questions. ' : '')
        + 'Mostly multiple-choice questions with 5 choices and exactly one correct answer, in the style of Thai A-Level exams. When the content involves calculation, make about a third of the questions "numeric" fill-in questions whose answer is a single number. Make wrong choices plausible, based on real common mistakes. '
        + 'Before finalizing, verify every answer key' + (S.codeExec ? ' with the code execution tool for any numeric work' : ' by working it out carefully') + '. '
        + 'Write in Thai (technical terms may stay in English); use $...$ LaTeX for math and \\ce{} for chemistry, escaping backslashes properly in JSON. In explanation, trap, and technique, refer to choices by their content, never by letter or number, because the choices will be shuffled. For numeric questions, leave choices empty and give numeric_answer and unit.';
    },
    cards: function (o) {
      return 'Create exactly ' + o.count + ' flashcards from the target, covering the most important and most-tested points (definitions, formulas, key facts, processes, easily confused pairs). The front is a short question, term, or formula prompt. The back is the answer with a brief explanation or memory hook. Write in Thai (technical terms may stay in English); use $...$ LaTeX for math and \\ce{} for chemistry, escaping backslashes properly in JSON. Check every card is accurate.';
    }
  };

  var QUIZ_SCHEMA = {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Short Thai title for the quiz' },
      questions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['mcq', 'numeric'] },
            subject: { type: 'string', enum: ['math', 'physics', 'chem', 'bio', 'python', 'other'] },
            topic: { type: 'string', description: 'Short topic name in Thai' },
            question: { type: 'string' },
            choices: { type: 'array', items: { type: 'string' }, description: '5 choices for mcq, empty for numeric' },
            answer_index: { type: 'integer', description: 'Index of the correct choice for mcq' },
            numeric_answer: { type: 'number', description: 'Exact answer for numeric questions' },
            unit: { type: 'string', description: 'Unit of the numeric answer, or empty' },
            explanation: { type: 'string', description: 'Step-by-step reason the answer is right' },
            trap: { type: 'string', description: 'The trap choice or common mistake, and why students fall for it' },
            technique: { type: 'string', description: 'A quick technique for this type of question' },
            source: { type: 'string', description: 'Page or slide in the file if used, else empty' }
          },
          required: ['type', 'subject', 'topic', 'question', 'explanation']
        }
      }
    },
    required: ['title', 'questions']
  };
  var CARDS_SCHEMA = {
    type: 'object',
    properties: {
      title: { type: 'string' },
      cards: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            front: { type: 'string' },
            back: { type: 'string' },
            topic: { type: 'string' },
            subject: { type: 'string', enum: ['math', 'physics', 'chem', 'bio', 'python', 'other'] }
          },
          required: ['front', 'back', 'topic', 'subject']
        }
      }
    },
    required: ['title', 'cards']
  };

  // ---------- helpers ----------
  var $ = function (id) { return document.getElementById(id); };
  function h(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        var v = attrs[k];
        if (v === null || v === undefined || v === false) return;
        if (k === 'class') node.className = v;
        else if (k === 'text') node.textContent = v;
        else if (k === 'html') node.innerHTML = v;
        else if (k.slice(0, 2) === 'on' && typeof v === 'function') node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, v === true ? '' : v);
      });
    }
    (children || []).forEach(function (c) { if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return node;
  }
  function newId(p) { return (p || 'x') + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function str(v) { return typeof v === 'string' ? v : (v === null || v === undefined ? '' : String(v)); }
  function clip(s, n) { s = str(s); return s.length > n ? s.slice(0, n) + '…' : s; }
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function fmtDate(ts) { try { return new Date(ts).toLocaleString('th-TH', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }); } catch (e) { return ''; } }
  function fmtDay(ts) { try { return new Date(ts).toLocaleDateString('th-TH', { day: 'numeric', month: 'short' }); } catch (e) { return ''; } }
  function dayKey(ts) { var d = new Date(ts || Date.now()); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function fmtSize(b) { return b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'; }
  function fmtInterval(ms) {
    if (ms < 3600e3) return Math.max(1, Math.round(ms / 60e3)) + ' นาที';
    if (ms < DAY) return Math.round(ms / 3600e3) + ' ชม.';
    var d = Math.round(ms / DAY);
    return d < 45 ? d + ' วัน' : Math.round(d / 30) + ' เดือน';
  }
  function blobToBase64(blob) {
    return new Promise(function (res, rej) {
      var r = new FileReader();
      r.onload = function () { res(String(r.result).split(',')[1] || ''); };
      r.onerror = function () { rej(r.error); };
      r.readAsDataURL(blob);
    });
  }
  function dataUrlParts(u) { var m = /^data:([^;]+);base64,(.*)$/.exec(u || ''); return m ? { mime: m[1], data: m[2] } : null; }

  // ---------- settings ----------
  var SETTINGS_KEY = 'ht2:settings';
  var S = (function () {
    var d = { apiKey: '', model: DEFAULT_MODEL, thinking: 'medium', codeExec: true, search: true, theme: 'system', subject: 'all', models: null, searchBlockedAt: 0, fileApiFailAt: 0, onboarded: false, tb: { count: 10, level: 'exam', cards: 15, timed: false } };
    try { var s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}'); Object.keys(s).forEach(function (k) { d[k] = s[k]; }); } catch (e) {}
    if (!d.tb || typeof d.tb !== 'object') d.tb = { count: 10, level: 'exam', cards: 15, timed: false };
    return d;
  })();
  function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(S)); } catch (e) {} }
  function searchUsable() { return S.search && (!S.searchBlockedAt || Date.now() - S.searchBlockedAt > 3 * DAY); }
  function fileApiUsable() { return !S.fileApiFailAt || Date.now() - S.fileApiFailAt > 7 * DAY; }

  // ---------- IndexedDB (with an in-memory fallback) ----------
  var STORES = ['sessions', 'materials', 'decks', 'cards', 'results', 'activity', 'kv'];
  var KEYPATH = { activity: 'date', kv: 'k' };
  var DB = {
    db: null, mem: null,
    open: function () {
      var self = this;
      return new Promise(function (resolve) {
        if (!window.indexedDB) { self.mem = {}; return resolve(); }
        var req;
        try { req = indexedDB.open('hongtiew', 1); } catch (e) { self.mem = {}; return resolve(); }
        req.onupgradeneeded = function () {
          var d = req.result;
          STORES.forEach(function (n) {
            if (!d.objectStoreNames.contains(n)) {
              var st = d.createObjectStore(n, { keyPath: KEYPATH[n] || 'id' });
              if (n === 'cards') { st.createIndex('deckId', 'deckId'); st.createIndex('due', 'due'); }
            }
          });
        };
        req.onsuccess = function () { self.db = req.result; resolve(); };
        req.onerror = function () { self.mem = {}; resolve(); };
        req.onblocked = function () { self.mem = {}; resolve(); };
      });
    },
    _m: function (s) { if (!this.mem[s]) this.mem[s] = new Map(); return this.mem[s]; },
    _req: function (store, mode, fn) {
      var self = this;
      return new Promise(function (resolve, reject) {
        var tx = self.db.transaction(store, mode);
        var st = tx.objectStore(store);
        var r = fn(st);
        tx.oncomplete = function () { resolve(r && 'result' in r ? r.result : undefined); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('aborted')); };
      });
    },
    get: function (store, key) {
      if (this.mem) return Promise.resolve(this._m(store).get(key));
      return this._req(store, 'readonly', function (st) { return st.get(key); });
    },
    put: function (store, val) {
      if (this.mem) { this._m(store).set(val[KEYPATH[store] || 'id'], val); return Promise.resolve(); }
      return this._req(store, 'readwrite', function (st) { st.put(val); });
    },
    putMany: function (store, vals) {
      if (this.mem) { var m = this._m(store); vals.forEach(function (v) { m.set(v[KEYPATH[store] || 'id'], v); }); return Promise.resolve(); }
      return this._req(store, 'readwrite', function (st) { vals.forEach(function (v) { st.put(v); }); });
    },
    del: function (store, key) {
      if (this.mem) { this._m(store).delete(key); return Promise.resolve(); }
      return this._req(store, 'readwrite', function (st) { st.delete(key); });
    },
    all: function (store) {
      if (this.mem) return Promise.resolve(Array.from(this._m(store).values()));
      return this._req(store, 'readonly', function (st) { return st.getAll(); }).then(function (r) { return r || []; });
    },
    clear: function (store) {
      if (this.mem) { this._m(store).clear(); return Promise.resolve(); }
      return this._req(store, 'readwrite', function (st) { st.clear(); });
    }
  };
  // Every storage call waits until the database is open.
  ['get', 'put', 'putMany', 'del', 'all', 'clear'].forEach(function (name) {
    var fn = DB[name];
    DB[name] = function () { var args = arguments, self = this; return DB.ready.then(function () { return fn.apply(self, args); }); };
  });
  DB.ready = DB.open();
  function kvGet(k, dflt) { return DB.get('kv', k).then(function (r) { return r ? r.v : dflt; }).catch(function () { return dflt; }); }
  function kvSet(k, v) { return DB.put('kv', { k: k, v: v }).catch(function () {}); }

  // ---------- state ----------
  var state = {
    profile: { text: '', updatedAt: 0 },
    log: [],
    materials: [],
    session: null,
    busy: false, ctl: null,
    pendingImages: [],
    autoScroll: true,
    view: 'chat',
    dueCount: 0
  };
  function freshSession() { return { id: newId('s'), title: '', subject: S.subject, updatedAt: Date.now(), messages: [], materialIds: [] }; }
  state.session = freshSession();

  function saveLog() { return kvSet('log', state.log.slice(0, 150)); }
  function addLog(item) {
    item.t = Date.now();
    state.log = state.log.filter(function (x) { return !(x.type === item.type && x.q === item.q); });
    state.log.unshift(item);
    if (state.log.length > 150) state.log.length = 150;
  }
  // Activity updates run one at a time so simultaneous updates don't overwrite each other.
  var activityQueue = Promise.resolve();
  function bumpActivity(field, n) {
    activityQueue = activityQueue.then(function () {
      var k = dayKey();
      return DB.get('activity', k).then(function (a) {
        a = a || { date: k, msgs: 0, quizQ: 0, quizOk: 0, cards: 0 };
        a[field] = (a[field] || 0) + (n === undefined ? 1 : n);
        return DB.put('activity', a);
      });
    }).catch(function () {});
    return activityQueue;
  }

  var saveTimer = null;
  function queueSave() {
    var s = state.session;
    if (!s.messages.some(function (m) { return m.role === 'user' || m.kind === 'material'; })) return;
    s.updatedAt = Date.now();
    if (!s.title) {
      var fu = s.messages.find(function (m) { return m.role === 'user' && m.kind !== 'summary'; });
      var fm = s.messages.find(function (m) { return m.kind === 'material'; });
      s.title = fu ? fu.content.replace(/\s+/g, ' ').slice(0, 60) : (fm ? fm.name || 'บทเรียน' : 'บทเรียน');
      updateTitle();
    }
    clearTimeout(saveTimer);
    saveTimer = setTimeout(function () {
      var snap = { id: s.id, title: s.title, subject: s.subject, updatedAt: s.updatedAt, materialIds: (s.materialIds || []).slice(), messages: s.messages.map(cleanMsg).filter(function (m) { return m.content || m.error || m.kind === 'material'; }).slice(-120) };
      DB.put('sessions', snap).catch(function () { showToast('บันทึกบทเรียนไม่สำเร็จ พื้นที่ในเครื่องอาจเต็ม'); });
    }, 300);
  }
  function cleanMsg(m) {
    var o = {};
    Object.keys(m).forEach(function (k) { if (k.charAt(0) !== '_') o[k] = m[k]; });
    return o;
  }

  // ---------- Gemini API ----------
  function apiError(code, message, extra) {
    var e = new Error(message || code);
    e.code = code;
    if (extra) Object.keys(extra).forEach(function (k) { e[k] = extra[k]; });
    return e;
  }
  async function parseHttpError(res) {
    var body = null;
    try { body = await res.json(); } catch (e) {}
    var err = (body && body.error) || {};
    var e = apiError('http', err.message || ('HTTP ' + res.status), { http: res.status, status: err.status || '', apiMessage: err.message || '' });
    (err.details || []).forEach(function (d) {
      if (d && d.retryDelay) e.retryAfter = parseFloat(d.retryDelay);
      if (d && d.reason) e.reason = d.reason;
    });
    return e;
  }
  function keyHeaders(json) {
    var hd = { 'x-goog-api-key': S.apiKey };
    if (json) hd['Content-Type'] = 'application/json';
    return hd;
  }

  async function listModels(key) {
    var res = await fetch(API + '/v1beta/models?pageSize=200', { headers: { 'x-goog-api-key': key } });
    if (!res.ok) throw await parseHttpError(res);
    var data = await res.json();
    return (data.models || []).filter(function (m) {
      var id = str(m.name).replace(/^models\//, '');
      var gen = (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1;
      return gen && /^gemini/.test(id) && !/(tts|image|live|embedding|transcribe|robotics|computer-use|audio|native)/.test(id);
    }).map(function (m) {
      var id = m.name.replace(/^models\//, '');
      return { id: id, label: (m.displayName || id) + (/pro/.test(id) ? ' (อาจต้องเปิดใช้แบบเสียเงิน)' : '') };
    }).sort(function (a, b) { return rankModel(a.id) - rankModel(b.id); });
  }
  function rankModel(id) {
    if (id === DEFAULT_MODEL) return 0;
    if (id === 'gemini-flash-latest') return 1;
    var m = /gemini-(\d+(?:\.\d+)?)/.exec(id);
    var v = m ? parseFloat(m[1]) : 0;
    var penalty = /preview|exp/.test(id) ? 0.5 : 0;
    return 10 - v + penalty + (/lite/.test(id) ? 0.2 : 0) + (/pro/.test(id) ? 0.1 : 0);
  }

  async function streamGenerate(model, body, signal, onChunk) {
    var res;
    try {
      res = await fetch(API + '/v1beta/models/' + encodeURIComponent(model) + ':streamGenerateContent?alt=sse', {
        method: 'POST', headers: keyHeaders(true), body: JSON.stringify(body), signal: signal
      });
    } catch (e) {
      if (e && e.name === 'AbortError') throw apiError('cancelled');
      throw apiError('network', String(e && e.message || e));
    }
    if (!res.ok) throw await parseHttpError(res);
    var reader = res.body.getReader();
    var dec = new TextDecoder();
    var buf = '';
    function handleLine(line) {
      line = line.replace(/\r$/, '');
      if (line.indexOf('data:') !== 0) return;
      var data = line.slice(5).trim();
      if (!data || data === '[DONE]') return;
      var obj;
      try { obj = JSON.parse(data); } catch (e) { return; }
      if (obj.error) throw apiError('http', obj.error.message, { http: obj.error.code, status: obj.error.status, apiMessage: obj.error.message });
      onChunk(obj);
    }
    try {
      while (true) {
        var r = await reader.read();
        if (r.done) break;
        buf += dec.decode(r.value, { stream: true });
        var idx;
        while ((idx = buf.indexOf('\n')) >= 0) { var line = buf.slice(0, idx); buf = buf.slice(idx + 1); handleLine(line); }
      }
      if (buf) handleLine(buf);
    } catch (e) {
      if (e && e.name === 'AbortError') throw apiError('cancelled');
      if (e && e.code) throw e;
      throw apiError('network', String(e && e.message || e), { partial: true });
    }
  }

  function newAcc() { return { text: '', thoughts: '', code: [], images: [], grounding: null, finishReason: null, usage: null, blocked: null }; }
  function applyChunk(acc, obj) {
    if (obj.promptFeedback && obj.promptFeedback.blockReason) acc.blocked = obj.promptFeedback.blockReason;
    if (obj.usageMetadata) acc.usage = obj.usageMetadata;
    var c = obj.candidates && obj.candidates[0];
    if (!c) return;
    if (c.finishReason) acc.finishReason = c.finishReason;
    if (c.groundingMetadata) acc.grounding = c.groundingMetadata;
    ((c.content && c.content.parts) || []).forEach(function (p) {
      if (p.thought && typeof p.text === 'string') acc.thoughts += p.text;
      else if (typeof p.text === 'string') acc.text += p.text;
      else if (p.executableCode) acc.code.push({ code: str(p.executableCode.code), lang: str(p.executableCode.language) });
      else if (p.codeExecutionResult) {
        var r = { outcome: str(p.codeExecutionResult.outcome), output: str(p.codeExecutionResult.output) };
        var last = acc.code[acc.code.length - 1];
        if (last && !last.result) last.result = r; else acc.code.push({ code: '', result: r });
      } else if (p.inlineData && p.inlineData.data) {
        acc.images.push('data:' + (p.inlineData.mimeType || 'image/png') + ';base64,' + p.inlineData.data);
      }
    });
  }
  function groundingInfo(g) {
    if (!g) return null;
    var sources = [];
    (g.groundingChunks || []).forEach(function (ch) {
      if (ch.web && ch.web.uri && !sources.some(function (s) { return s.uri === ch.web.uri; })) sources.push({ uri: ch.web.uri, title: ch.web.title || ch.web.uri });
    });
    var rendered = g.searchEntryPoint && g.searchEntryPoint.renderedContent;
    if (!sources.length && !rendered) return null;
    return { sources: sources.slice(0, 8), queries: (g.webSearchQueries || []).slice(0, 5), rendered: rendered || '' };
  }

  /*
   * One generation with automatic recovery:
   * drops unsupported options (thinking level, search, code execution, JSON field style),
   * re-uploads expired files, and retries once when Google's servers are busy.
   */
  async function gemini(o) {
    var flags = { thinking: true, search: !!o.search && searchUsable(), code: !!o.code, altJson: false, retried: false, reupload: false, notes: [] };
    for (var attempt = 0; attempt < 6; attempt++) {
      var contents = await o.buildContents(flags);
      var body = { contents: contents, systemInstruction: { parts: [{ text: o.system }] } };
      var tools = [];
      if (flags.code) tools.push({ codeExecution: {} });
      if (flags.search) tools.push({ googleSearch: {} });
      if (tools.length) body.tools = tools;
      var gc = {};
      if (flags.thinking) gc.thinkingConfig = { thinkingLevel: o.thinking || S.thinking, includeThoughts: true };
      if (o.schema) {
        if (flags.altJson) gc.responseFormat = { text: { mimeType: 'application/json', schema: o.schema } };
        else { gc.responseMimeType = 'application/json'; gc.responseJsonSchema = o.schema; }
      }
      if (Object.keys(gc).length) body.generationConfig = gc;
      var acc = newAcc();
      try {
        await streamGenerate(o.model || S.model, body, o.signal, function (obj) { applyChunk(acc, obj); if (o.onUpdate) o.onUpdate(acc); });
        acc.notes = flags.notes;
        return acc;
      } catch (e) {
        if (e.code === 'cancelled') { e.acc = acc; throw e; }
        var msg = str(e.apiMessage || e.message).toLowerCase();
        if (e.code === 'network' && e.partial && acc.text) { e.acc = acc; throw e; }
        if (e.http === 400 && flags.thinking && /thinking/.test(msg)) { flags.thinking = false; continue; }
        if (flags.search && /search|grounding/.test(msg) && (e.http === 400 || e.http === 403 || e.http === 429)) {
          flags.search = false; S.searchBlockedAt = Date.now(); saveSettings();
          flags.notes.push('ค้นเว็บไม่ได้ในตอนนี้ (บัญชีฟรีบางแบบใช้การค้นเว็บไม่ได้) ครูเลยตอบโดยไม่ค้นเว็บ');
          continue;
        }
        if (flags.code && e.http === 400 && /code.?execution|tool/.test(msg)) { flags.code = false; flags.notes.push('ครั้งนี้ครูรันโค้ดตรวจคำตอบไม่ได้ เฉลยและตัวเลขอาจผิดได้ ควรตรวจซ้ำ'); continue; }
        if (flags.search && e.http === 400 && /tool/.test(msg)) { flags.search = false; continue; }
        if (o.schema && !flags.altJson && e.http === 400 && /response_?mime|response_?json|responsejsonschema|responsemimetype|unknown name|invalid json payload/.test(msg)) { flags.altJson = true; continue; }
        if (!flags.reupload && (e.http === 403 || e.http === 404 || e.http === 400) && /file/.test(msg) && /(not exist|not found|permission|expired|access)/.test(msg)) { flags.reupload = true; continue; }
        if (!flags.retried && (e.http === 500 || e.http === 503 || e.http === 504)) { flags.retried = true; await sleep(2500); continue; }
        e.acc = acc;
        throw e;
      }
    }
    throw apiError('http', 'too many retries');
  }

  function errorCopy(e) {
    var code = e && e.code;
    var msg = str(e && (e.apiMessage || e.message)).toLowerCase();
    if (code === 'nokey') return 'ยังไม่ได้ใส่ API key ไปที่หน้า "ตั้งค่า" เพื่อใส่ก่อน';
    if (code === 'network') return 'เชื่อมต่ออินเทอร์เน็ตไม่ได้ ตรวจการเชื่อมต่อแล้วกด "ลองอีกครั้ง"';
    if (code === 'invalid_json') return 'ครูส่งผลลัพธ์มาในรูปแบบที่แอปอ่านไม่ได้ กด "ลองอีกครั้ง"';
    if (code === 'blocked') return 'Gemini ไม่ตอบข้อนี้เพราะติดตัวกรองความปลอดภัย ลองถามด้วยคำอื่น';
    if (code === 'recitation') return 'ครูหยุดตอบเพราะเนื้อหาใกล้เคียงข้อความที่มีลิขสิทธิ์ ลองขอให้อธิบายด้วยคำของครูเอง';
    if (code === 'empty') return 'ครูไม่ได้ให้คำตอบ ลองถามให้สั้นหรือชัดขึ้น';
    if (code === 'too_large') return 'ไฟล์ใหญ่เกิน 48 MB ลองแยกไฟล์หรือบีบอัดก่อน';
    if (/api key not valid|api_key_invalid|invalid api key/.test(msg) || e.reason === 'API_KEY_INVALID') return 'API key ใช้ไม่ได้ ไปที่หน้า "ตั้งค่า" เพื่อตรวจสอบหรือใส่ key ใหม่';
    if (e.http === 429) return 'ใช้งานถี่เกินโควตาของ API key แล้ว' + (e.retryAfter ? ' รอประมาณ ' + Math.ceil(e.retryAfter) + ' วินาที' : ' รอสักครู่') + ' แล้วลองใหม่ หรือเปลี่ยนเป็นโมเดลที่เบากว่าในหน้าตั้งค่า';
    if (e.http === 404 || /not found for api version|is not found|not supported for generatecontent/.test(msg)) return 'ไม่พบโมเดล "' + S.model + '" ไปที่หน้า "ตั้งค่า" แล้วเลือกโมเดลใหม่';
    if (/location is not supported/.test(msg)) return 'พื้นที่ของคุณใช้ Gemini API ไม่ได้ในตอนนี้';
    if (/billing|free tier|paid/.test(msg)) return 'โมเดลนี้ต้องเปิดใช้แบบเสียเงินใน Google AI Studio ก่อน หรือเลือกโมเดล Flash ที่ใช้ฟรีได้ในหน้าตั้งค่า';
    if (e.http === 403) return 'API key นี้ไม่มีสิทธิ์ใช้งาน ตรวจสอบใน Google AI Studio หรือสร้าง key ใหม่';
    if (e.http === 400) return 'คำขอไม่ถูกต้อง: ' + clip(e.apiMessage || e.message, 160);
    if (e.http >= 500) return 'เซิร์ฟเวอร์ของ Google ไม่ว่างชั่วคราว กด "ลองอีกครั้ง"';
    return 'เกิดข้อผิดพลาด: ' + clip(e && e.message || 'ไม่ทราบสาเหตุ', 160);
  }
  function checkFinish(acc) {
    if (acc.blocked) throw apiError('blocked');
    if (acc.finishReason === 'SAFETY' || acc.finishReason === 'PROHIBITED_CONTENT' || acc.finishReason === 'BLOCKLIST' || acc.finishReason === 'SPII') throw apiError('blocked');
    if (acc.finishReason === 'RECITATION') throw apiError('recitation');
  }

  // ---------- Files API (large files) ----------
  async function uploadToFileApi(m, signal) {
    var blob = m.blob;
    var start = await fetch(API + '/upload/v1beta/files', {
      method: 'POST', signal: signal,
      headers: { 'x-goog-api-key': S.apiKey, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(blob.size), 'X-Goog-Upload-Header-Content-Type': m.mime, 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: { display_name: clip(m.name, 100) } })
    });
    if (!start.ok) throw await parseHttpError(start);
    var url = start.headers.get('x-goog-upload-url');
    if (!url) throw apiError('noupload');
    var up = await fetch(url, { method: 'POST', signal: signal, headers: { 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize' }, body: blob });
    if (!up.ok) throw await parseHttpError(up);
    var f = (await up.json()).file || {};
    for (var i = 0; i < 40 && f.state === 'PROCESSING'; i++) {
      await sleep(1500);
      var r = await fetch(API + '/v1beta/' + f.name, { headers: { 'x-goog-api-key': S.apiKey }, signal: signal });
      if (r.ok) f = await r.json();
    }
    if (f.state === 'FAILED' || !f.uri) throw apiError('upload_failed');
    return { uri: f.uri, mime: f.mimeType || m.mime, at: Date.now() };
  }

  async function materialParts(m, flags, signal, onStatus) {
    var header = { text: '[ไฟล์ประกอบการเรียน: ' + m.name + ']' };
    if (m.kind === 'pdf' || m.kind === 'image') {
      if (!m.blob) {
        var rec = await DB.get('materials', m.id);
        m.blob = rec && rec.blob;
        if (!m.blob) return [{ text: '[ไฟล์ ' + m.name + ' หายไปจากเครื่อง ให้บอกฉันว่าต้องแนบใหม่]' }];
      }
      if (m.blob.size >= FILE_API_MIN && fileApiUsable()) {
        if (flags.reupload || !m.file || Date.now() - m.file.at > FILE_TTL) {
          onStatus('กำลังส่งไฟล์ ' + clip(m.name, 30) + ' ให้ครู…');
          try {
            m.file = await uploadToFileApi(m, signal);
            persistMaterial(m);
          } catch (e) {
            if (e.code === 'cancelled' || (e && e.name === 'AbortError')) throw apiError('cancelled');
            m.file = null;
            if (!e.http || e.code === 'noupload') { S.fileApiFailAt = Date.now(); saveSettings(); }
          }
        }
        if (m.file) return [header, { fileData: { mimeType: m.file.mime, fileUri: m.file.uri } }];
      }
      if (m.blob.size > INLINE_MAX) throw apiError('too_large');
      if (!m._b64) m._b64 = await blobToBase64(m.blob);
      return [header, { inlineData: { mimeType: m.mime, data: m._b64 } }];
    }
    return [{ text: header.text + ' (ข้อความที่ดึงจากไฟล์ ' + kindLabel(m) + ')\n' + str(m.text) }];
  }

  // ---------- reading files ----------
  var scriptPromises = {};
  function loadScript(src, globalName) {
    if (globalName && window[globalName]) return Promise.resolve();
    if (!scriptPromises[src]) {
      scriptPromises[src] = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = src; s.async = true;
        s.onload = function () { resolve(); };
        s.onerror = function () { delete scriptPromises[src]; reject(new Error('load ' + src)); };
        document.head.appendChild(s);
      });
    }
    return scriptPromises[src];
  }
  function detectKind(f) {
    var n = (f.name || '').toLowerCase(), t = f.type || '';
    if (/^image\/(jpeg|png|webp|heic|heif|gif)$/.test(t) || /\.(jpe?g|png|webp|heic|heif)$/.test(n)) return 'image';
    if (n.slice(-4) === '.pdf' || t === 'application/pdf') return 'pdf';
    if (n.slice(-5) === '.docx') return 'docx';
    if (n.slice(-5) === '.pptx') return 'pptx';
    if (/\.(txt|md|markdown|csv|tsv|py|json|tex|html?|js|java|c|cpp)$/.test(n) || t.indexOf('text/') === 0) return 'text';
    if (/\.(doc|ppt|xls|xlsx|pages|key|numbers)$/.test(n)) return 'office-old';
    return null;
  }
  function kindLabel(m) {
    return { pdf: 'PDF', image: 'รูปภาพ', docx: 'Word', pptx: 'PowerPoint', text: 'ไฟล์ข้อความ' }[m.kind] || 'ไฟล์';
  }
  function decodeXml(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-f]+);/gi, function (_, x) { return String.fromCodePoint(parseInt(x, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(parseInt(d, 10)); })
      .replace(/&amp;/g, '&');
  }
  function drawingText(xml) {
    return xml.split(/<\/a:p>/).map(function (p) {
      var ts = p.match(/<a:t(?:\s[^>]*)?>[^<]*<\/a:t>/g) || [];
      return ts.map(function (t) { return decodeXml(t.replace(/<a:t(?:\s[^>]*)?>/, '').replace('</a:t>', '')); }).join('');
    }).filter(function (s) { return s.trim(); }).join('\n');
  }
  async function extractPptx(file) {
    await loadScript('vendor/jszip.min.js', 'JSZip');
    var zip = await window.JSZip.loadAsync(await file.arrayBuffer());
    var num = function (p) { var m = p.match(/(\d+)\.xml$/); return m ? Number(m[1]) : 0; };
    var slides = Object.keys(zip.files).filter(function (p) { return /^ppt\/slides\/slide\d+\.xml$/.test(p); }).sort(function (a, b) { return num(a) - num(b); });
    var out = [];
    for (var i = 0; i < slides.length; i++) {
      var text = drawingText(await zip.file(slides[i]).async('string'));
      var rels = zip.file('ppt/slides/_rels/' + slides[i].split('/').pop() + '.rels');
      if (rels) {
        var mm = (await rels.async('string')).match(/Target="\.\.\/notesSlides\/(notesSlide\d+\.xml)"/);
        var nf = mm && zip.file('ppt/notesSlides/' + mm[1]);
        if (nf) {
          var notes = drawingText(await nf.async('string')).split('\n').filter(function (l) { return !/^\d+$/.test(l.trim()); }).join('\n');
          if (notes.trim()) text += '\n(โน้ตผู้บรรยาย) ' + notes;
        }
      }
      out.push('[สไลด์ ' + (i + 1) + ']\n' + text);
    }
    return { text: out.join('\n\n'), pages: slides.length };
  }
  async function extractDocx(file) {
    await loadScript('vendor/mammoth.browser.min.js', 'mammoth');
    var res = await window.mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return str(res.value);
  }
  function normalizeText(s) {
    return str(s).replace(/\u0000/g, '').replace(/\r\n?/g, '\n').replace(/[ \t\u00A0]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  // Shrinks photos before sending: keeps text readable while saving data on mobile.
  function compressImage(file, maxSide, quality) {
    return new Promise(function (resolve) {
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var w = img.naturalWidth, hgt = img.naturalHeight;
        var scale = Math.min(1, maxSide / Math.max(w, hgt));
        var c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(w * scale)); c.height = Math.max(1, Math.round(hgt * scale));
        var ctx = c.getContext('2d');
        ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url);
        c.toBlob(function (b) { resolve(b || file); }, 'image/jpeg', quality);
      };
      img.onerror = function () { URL.revokeObjectURL(url); resolve(file); };
      img.src = url;
    });
  }
  function blobToDataUrl(b) {
    return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(String(r.result)); }; r.onerror = function () { rej(r.error); }; r.readAsDataURL(b); });
  }

  // ---------- prompt building ----------
  function subjectInfo() { return SUBJECTS.find(function (s) { return s.id === state.subject(); }) || SUBJECTS[0]; }
  state.subject = function () { return state.session.subject || 'all'; };
  function logText() {
    return state.log.slice(0, 12).map(function (x) {
      if (x.type === 'card') return '- [' + (x.topic || '-') + '] flashcard not memorized yet: ' + clip(x.q, 200);
      return '- [' + (x.topic || '-') + '] Q: ' + clip(x.q, 220) + ' | I answered: ' + clip(x.chosen, 100) + ' | correct: ' + clip(x.correct, 100);
    }).join('\n');
  }
  function buildSystem(opts) {
    var subj = subjectInfo();
    var prof = clip((state.profile.text || '').trim(), 4000);
    var lt = logText();
    var today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    var lines = [
      TUTOR_PROMPT, '',
      '## App context (how this tutor app works)',
      '- You are running inside my personal tutoring app "ห้องติว", powered by the Gemini API, which I use on my phone and my computer. Today is ' + today + ' (Thailand).',
      '- Files I attach (PDFs, photos, and Word, PowerPoint, or text files converted to text) come with my latest message. They are the project files in rule 1: base your teaching, summaries, and questions on them first, and cite the page or slide, for example [หน้า 12]. If a file is hard to read, say which part.',
      opts.code ? '- The code execution tool is the tool that rule 2 refers to: use it to verify every numeric result in math, physics, and chemistry, and to run Python code you show me. When a graph or diagram helps, you may plot it with matplotlib in code execution.' : '- No code execution tool is available right now. Work through every calculation step by step and double-check it.',
      opts.search ? '- Google Search is available for rule 4. Use it for anything time-sensitive about Thai university admissions, and mention the sources.' : '- There is no web search right now. For rule 4, tell me to check official sources such as mytcas.com.',
      '- Your learning_profile file is included below in these instructions instead of as a project file.',
      '- A message of mine may end with an [Instruction from the app] block. It comes from a study-tool button I pressed; follow it.',
      '- Formatting: the app renders Markdown and LaTeX. Write math with $...$ inline and $$...$$ on its own line for display equations. Write chemical formulas and equations with \\ce{...} inside math, for example $\\ce{2H2 + O2 -> 2H2O}$. Put code in fenced code blocks with a language tag. Use small headings only in long answers.',
      subj.id === 'all' ? '- Subject focus selected in the app: none. I may ask about any subject above.' : '- Subject focus selected in the app: ' + subj.en + ' (' + subj.label + '). Assume my questions are about this subject unless clearly otherwise.',
      '', '## My learning_profile',
      prof || '(No profile yet. If useful, briefly ask about my grade level and goals, after answering my question.)'
    ];
    if (lt) lines.push('', '## My recent quiz mistakes and flashcards I have not memorized yet (newest first)', lt);
    return lines.join('\n');
  }

  function turnText(m, isLast) {
    var c = str(m.content).trim();
    if (m.role === 'user') {
      if (m.imgs && m.imgs.length && !c) c = 'ช่วยดูรูปนี้หน่อย';
      if (isLast && m.instr) c += '\n\n[Instruction from the app]\n' + m.instr;
    }
    return c;
  }
  function activeMaterials() { return (state.session.materialIds || []).map(getMaterial).filter(function (m) { return m && m.status === 'ready'; }); }
  function getMaterial(id) { return state.materials.find(function (m) { return m.id === id; }) || null; }

  function makeContentsBuilder(opts, node) {
    return async function (flags) {
      var msgs = state.session.messages.filter(function (m) { return !m.local && m.kind !== 'summary' && (str(m.content).trim() || (m.imgs && m.imgs.length)); });
      var lastIdx = msgs.length - 1;
      var budget = HISTORY_CHAR_BUDGET;
      var picked = [];
      for (var i = lastIdx; i >= 0; i--) {
        var t = turnText(msgs[i], i === lastIdx && msgs[i].role === 'user');
        if (picked.length && budget - t.length < 0) break;
        budget -= t.length;
        picked.unshift({ m: msgs[i], text: t, last: i === lastIdx });
      }
      var imgMsgsLeft = HISTORY_IMAGE_MSGS;
      for (var k = picked.length - 1; k >= 0; k--) {
        var pm = picked[k];
        pm.withImgs = pm.m.role === 'user' && pm.m.imgs && pm.m.imgs.length && imgMsgsLeft > 0;
        if (pm.withImgs) imgMsgsLeft--;
      }
      var contents = [];
      for (var j = 0; j < picked.length; j++) {
        var p = picked[j];
        var role = p.m.role === 'user' ? 'user' : 'model';
        var parts = [];
        if (p.last && role === 'user' && opts.withMaterials) {
          var mats = activeMaterials();
          for (var q = 0; q < mats.length; q++) {
            (await materialParts(mats[q], flags, opts.signal, function (s) { setStatus(node, s); })).forEach(function (x) { parts.push(x); });
          }
        }
        if (p.withImgs) {
          p.m.imgs.forEach(function (u) { var d = dataUrlParts(u); if (d) parts.push({ inlineData: { mimeType: d.mime, data: d.data } }); });
        }
        if (p.text) parts.push({ text: p.text });
        if (!parts.length) continue;
        var prev = contents[contents.length - 1];
        if (prev && prev.role === role) prev.parts = prev.parts.concat(parts);
        else contents.push({ role: role, parts: parts });
      }
      while (contents.length && contents[0].role !== 'user') contents.shift();
      if (opts.extraUserText) {
        var lastC = contents[contents.length - 1];
        if (lastC && lastC.role === 'user') lastC.parts.push({ text: opts.extraUserText });
        else contents.push({ role: 'user', parts: [{ text: opts.extraUserText }] });
      }
      if (!contents.length) contents.push({ role: 'user', parts: [{ text: 'สวัสดี' }] });
      return contents;
    };
  }

  // ---------- markdown + math ----------
  function renderMarkdown(src) {
    if (!src) return '';
    var codeStash = [];
    var s = String(src).replace(/```[\s\S]*?(?:```|$)/g, function (m) { codeStash.push(m); return '\u0000C' + (codeStash.length - 1) + '\u0000'; });
    s = s.replace(/`[^`\n]+`/g, function (m) { codeStash.push(m); return '\u0000C' + (codeStash.length - 1) + '\u0000'; });
    var mathStash = [];
    var stash = function (m) { mathStash.push(m); return 'MJXTOKEN' + (mathStash.length - 1) + 'END'; };
    s = s.replace(/\$\$[\s\S]+?\$\$/g, stash).replace(/\\\[[\s\S]+?\\\]/g, stash).replace(/\\\([\s\S]+?\\\)/g, stash).replace(/\$([^\s$](?:[^$\n]*?[^\s$])?)\$/g, stash);
    s = s.replace(/\u0000C(\d+)\u0000/g, function (_, i) { return codeStash[+i]; });
    var html = window.marked && window.marked.parse ? window.marked.parse(s, { gfm: true, breaks: true }) : '<p>' + escapeHtml(s).replace(/\n/g, '<br>') + '</p>';
    html = html.replace(/MJXTOKEN(\d+)END/g, function (_, i) { return escapeHtml(mathStash[+i]); });
    if (window.DOMPurify) html = window.DOMPurify.sanitize(html);
    return html;
  }
  function renderInline(src) { var html = renderMarkdown(src); var m = html.match(/^\s*<p>([\s\S]*)<\/p>\s*$/); return m && m[1].indexOf('<p>') === -1 ? m[1] : html; }
  function typeset(node) {
    var MJ = window.MathJax;
    if (MJ && MJ.startup && MJ.startup.promise && typeof MJ.typesetPromise === 'function') MJ.startup.promise.then(function () { return MJ.typesetPromise([node]); }).catch(function () {});
    else window.__pendingTypeset.add(node);
  }
  function copyText(text, btn) {
    var done = function () { if (btn) { var o = btn.textContent; btn.textContent = 'คัดลอกแล้ว'; setTimeout(function () { btn.textContent = o; }, 1400); } };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }
  function fallbackCopy(text) { var ta = h('textarea', { style: 'position:fixed;top:-1000px;opacity:0' }); ta.value = text; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }
  function enhanceCode(root) {
    root.querySelectorAll('pre').forEach(function (pre) {
      if (pre.querySelector('.copy-btn')) return;
      var btn = h('button', { class: 'copy-btn', type: 'button', text: 'คัดลอก' });
      btn.addEventListener('click', function () { var c = pre.querySelector('code'); copyText(c ? c.textContent : pre.textContent, btn); });
      pre.appendChild(btn);
    });
  }
  function fixLatex(s) {
    return str(s).replace(/\f/g, '\\f').replace(/\u0008/g, '\\b').replace(/\t(?=[a-zA-Z])/g, '\\t').replace(/\r(?=[a-zA-Z])/g, '\\r').replace(/\v/g, '\\v')
      .replace(/\n(?=(?:eq|abla|ot|u\b|ewline|leq|geq|i\b))/g, '\\n');
  }

  // ---------- thread ----------
  var thread = $('thread'), chat = $('chat');
  chat.addEventListener('scroll', function () { state.autoScroll = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 140; });
  function stick() { if (state.autoScroll) chat.scrollTop = chat.scrollHeight; }
  var PAPERCLIP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5l-7.8 7.8a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8"/></svg>';

  function renderEmpty() {
    var list = h('ul', { class: 'sugg' });
    SUGGESTIONS.forEach(function (sg) {
      list.appendChild(h('li', null, [h('button', { type: 'button', onclick: function () { setSubject(sg.s); send(sg.t); } }, [h('span', { class: 'sugg-subj', text: SUBJECT_LABEL[sg.s] || '' }), h('span', { class: 'sugg-text', text: sg.t })])]));
    });
    return h('div', { class: 'empty' }, [
      h('h1', { text: 'วันนี้อยากเรียนเรื่องอะไร' }),
      h('p', { class: 'lead', text: 'ถามทฤษฎี ถ่ายรูปโจทย์ หรือส่งชีทมาให้ครูช่วยติวก็ได้' }),
      h('button', { class: 'upload-cta', type: 'button', onclick: function () { fileInput.click(); } }, [h('span', { html: PAPERCLIP }), h('span', null, [h('span', { class: 't', text: 'ส่งไฟล์ให้ครูอ่าน' }), h('span', { class: 'd', text: 'PDF (รวมไฟล์สแกน), Word, PowerPoint หรือรูปโจทย์ ครูจะสรุป สอน ออกข้อสอบ และบอกเทคนิคให้' })])]),
      list,
      h('p', { class: 'fine', text: 'ครู AI อาจผิดพลาดได้ เรื่องสำคัญให้ตรวจกับหนังสือเรียน สสวท. หรือ mytcas.com' })
    ]);
  }
  function renderAll() {
    thread.innerHTML = '';
    if (!state.session.messages.length) { thread.appendChild(renderEmpty()); return; }
    state.session.messages.forEach(function (m) { thread.appendChild(msgNode(m)); });
    state.autoScroll = true; stick();
  }
  function appendMessage(m) {
    if (thread.querySelector('.empty')) thread.innerHTML = '';
    var node = msgNode(m); thread.appendChild(node); state.autoScroll = true; stick(); return node;
  }
  function lastMessage() { var a = state.session.messages; return a[a.length - 1]; }

  function msgNode(m) {
    if (m.role === 'user') {
      var bubble = h('div', { class: 'bubble' });
      if (m.imgs && m.imgs.length) {
        var row = h('div', { class: 'img-row' });
        m.imgs.forEach(function (u) { row.appendChild(h('img', { src: u, alt: 'รูปที่แนบ' })); });
        bubble.appendChild(row);
      }
      bubble.appendChild(document.createTextNode(m.content));
      return h('div', { class: 'msg user' }, [bubble]);
    }
    var node = h('div', { class: 'msg assistant' }, [
      h('div', { class: 'who', text: 'ครู' }),
      h('div', { class: 'thoughts-slot' }),
      h('div', { class: 'md' }),
      h('div', { class: 'body2' }),
      h('div', { class: 'status', hidden: true }, [h('span', { class: 'pulse' }), h('span', { class: 'status-text' })]),
      h('div', { class: 'extras' })
    ]);
    m._node = node;
    if (m.kind === 'material') renderMaterialCard(node, m);
    else finalizeRender(node, m);
    return node;
  }
  function setStatus(node, text) {
    if (!node) return;
    var st = node.querySelector('.status');
    if (!st) return;
    if (!text) { st.hidden = true; return; }
    st.querySelector('.status-text').textContent = text;
    st.hidden = false; stick();
  }
  function renderThoughts(node, m, open) {
    var slot = node.querySelector('.thoughts-slot');
    if (!slot) return;
    slot.innerHTML = '';
    if (!m.thoughts) return;
    var d = h('details', { class: 'thoughts' }, [h('summary', { text: m.content ? 'ดูว่าครูคิดอะไรก่อนตอบ' : 'ครูกำลังคิด…' }), h('div', { class: 'md', html: renderMarkdown(m.thoughts) })]);
    if (open) d.open = true;
    slot.appendChild(d);
  }
  var renderTimers = new WeakMap();
  function scheduleRender(node, m) {
    if (renderTimers.get(node)) return;
    renderTimers.set(node, setTimeout(function () {
      renderTimers.delete(node);
      node.querySelector(':scope > .md').innerHTML = renderMarkdown(m.content);
      renderThoughts(node, m, !m.content);
      stick();
    }, 90));
  }
  function finalizeRender(node, m) {
    var t = renderTimers.get(node); if (t) { clearTimeout(t); renderTimers.delete(node); }
    renderThoughts(node, m, false);
    var md = node.querySelector(':scope > .md');
    if (m.kind === 'quiz') { md.innerHTML = ''; renderQuiz(node, m); }
    else if (m.kind === 'cards') { md.innerHTML = ''; renderDeck(node, m); }
    else { md.innerHTML = renderMarkdown(m.content); enhanceCode(md); typeset(md); }
    renderTools(node, m);
    renderExtras(node, m);
    stick();
  }
  function renderTools(node, m) {
    node.querySelectorAll('.checks, .plot, .search-chips').forEach(function (x) { x.remove(); });
    var anchor = node.querySelector('.status');
    (m.images || []).forEach(function (u) { node.insertBefore(h('img', { class: 'plot', src: u, alt: 'กราฟหรือรูปที่ครูสร้างด้วยโค้ด' }), anchor); });
    if (m.code && m.code.length) {
      var body = h('div', { class: 'body' });
      m.code.forEach(function (c) {
        if (c.code) body.appendChild(h('pre', { text: c.code }));
        if (c.result) body.appendChild(h('pre', { class: 'out' + (c.result.outcome && c.result.outcome !== 'OUTCOME_OK' ? ' err' : ''), text: c.result.output || '(ไม่มีผลลัพธ์ที่พิมพ์ออกมา)' }));
      });
      node.insertBefore(h('details', { class: 'checks' }, [h('summary', { text: 'ครูรันโค้ดตรวจคำตอบแล้ว ' + m.code.filter(function (c) { return c.code; }).length + ' ครั้ง' }), body]), anchor);
    }
    if (m.sources && (m.sources.sources.length || m.sources.rendered)) {
      var ul = h('ul');
      m.sources.sources.forEach(function (s) { ul.appendChild(h('li', null, [h('a', { href: s.uri, target: '_blank', rel: 'noopener noreferrer', text: s.title })])); });
      var det = h('details', { class: 'checks' }, [h('summary', { text: 'แหล่งข้อมูลจากการค้นเว็บ ' + m.sources.sources.length + ' แห่ง' }), h('div', { class: 'body' }, [ul])]);
      node.insertBefore(det, anchor);
      if (m.sources.rendered) {
        var host = h('div', { class: 'search-chips' });
        try { host.attachShadow({ mode: 'open' }).innerHTML = window.DOMPurify ? window.DOMPurify.sanitize(m.sources.rendered, { FORCE_BODY: true, ADD_ATTR: ['target'] }) : ''; } catch (e) {}
        node.insertBefore(host, anchor);
      }
    }
  }
  function renderExtras(node, m) {
    var ex = node.querySelector('.extras');
    ex.innerHTML = '';
    if (m.kind === 'summary' && m.saved) ex.appendChild(h('div', { class: 'saved-tag', text: 'บันทึกเป็นโปรไฟล์การเรียนแล้ว ดูได้ที่หน้า "ตั้งค่า"' }));
    (m.notes || []).forEach(function (n) { ex.appendChild(h('div', { class: 'note', text: n })); });
    if (m.note) ex.appendChild(h('div', { class: 'note', text: m.note }));
    if (m.error) {
      ex.appendChild(h('div', { class: 'note bad', text: m.error }));
      if (m.retryable && m === lastMessage()) ex.appendChild(h('div', { class: 'msg-actions' }, [h('button', { class: 'textbtn', type: 'button', text: 'ลองอีกครั้ง', onclick: retryLast })]));
      else if (m.needsKey) ex.appendChild(h('div', { class: 'msg-actions' }, [h('button', { class: 'textbtn strong', type: 'button', text: 'ไปใส่ API key', onclick: function () { showView('settings'); } })]));
      return;
    }
    if (m.content && !m.kind) {
      var acts = h('div', { class: 'msg-actions' });
      var cp = h('button', { class: 'mini', type: 'button', text: 'คัดลอก' });
      cp.addEventListener('click', function () { copyText(m.content, cp); });
      acts.appendChild(cp);
      if (window.speechSynthesis) acts.appendChild(h('button', { class: 'mini', type: 'button', text: 'ฟัง', onclick: function (e) { speak(m.content, e.currentTarget); } }));
      if (m === lastMessage() && !state.busy) acts.appendChild(h('button', { class: 'mini', type: 'button', text: 'ตอบใหม่', onclick: retryLast }));
      ex.appendChild(acts);
    }
  }

  // Read-aloud for explanations (uses the device's Thai voice if available)
  function plainForSpeech(md) {
    return str(md).replace(/```[\s\S]*?```/g, ' (มีโค้ดประกอบ) ').replace(/\$\$[\s\S]+?\$\$/g, ' (มีสมการ) ').replace(/\$[^$\n]+\$/g, ' สูตร ')
      .replace(/[#*_>`|]/g, ' ').replace(/\[(.*?)\]\((.*?)\)/g, '$1').replace(/\s+/g, ' ').trim();
  }
  function speak(md, btn) {
    var synth = window.speechSynthesis;
    if (synth.speaking) { synth.cancel(); if (btn) btn.textContent = 'ฟัง'; return; }
    var u = new SpeechSynthesisUtterance(plainForSpeech(md));
    u.lang = 'th-TH';
    var v = synth.getVoices().find(function (x) { return /^th/i.test(x.lang); });
    if (v) u.voice = v;
    u.rate = 1;
    u.onend = function () { if (btn) btn.textContent = 'ฟัง'; };
    if (btn) btn.textContent = 'หยุดฟัง';
    synth.speak(u);
  }

  // ---------- file cards ----------
  var CARD_ACTIONS = ['summary', 'teach', 'quiz', 'cards', 'mnemonic', 'traps', 'cheatsheet', 'plan'];
  function renderMaterialCard(node, msg) {
    var box = node.querySelector('.body2');
    box.innerHTML = '';
    var m = getMaterial(msg.materialId);
    var card = h('div', { class: 'matcard' });
    box.appendChild(card);
    card.appendChild(h('div', { class: 'mt', text: m ? m.name : (msg.name || 'ไฟล์') }));
    if (!m) { card.appendChild(h('div', { class: 'mat-msg muted', text: 'ไฟล์นี้ถูกลบจากคลังแล้ว' })); return; }
    card.appendChild(h('div', { class: 'mm', text: kindLabel(m) + (m.pages ? ' ' + m.pages + ' สไลด์' : '') + '  ' + fmtSize(m.size || 0) }));
    var st = h('div', { class: 'mat-msg' });
    card.appendChild(st);
    if (m.status === 'reading') { st.appendChild(h('div', { class: 'status' }, [h('span', { class: 'pulse' }), h('span', { text: 'กำลังเตรียมไฟล์…' })])); return; }
    if (m.status === 'error') { st.appendChild(h('div', { class: 'note bad', text: m.error || 'อ่านไฟล์นี้ไม่ได้' })); return; }
    st.appendChild(document.createTextNode(m.kind === 'pdf' || m.kind === 'image' ? 'ครูอ่านไฟล์นี้ได้ทั้งตัวหนังสือ รูป และตาราง รวมถึงไฟล์สแกน เลือกสิ่งที่อยากให้ช่วย หรือพิมพ์ถามได้เลย' : 'ครูได้ข้อความจากไฟล์แล้ว เลือกสิ่งที่อยากให้ช่วย หรือพิมพ์ถามได้เลย'));
    var acts = h('div', { class: 'mat-actions' });
    CARD_ACTIONS.forEach(function (id) {
      var a = ACTIONS.find(function (x) { return x.id === id; });
      acts.appendChild(h('button', { type: 'button', text: a.label, onclick: function () {
        activateMaterial(m.id);
        runAction(id, { count: S.tb.count, level: S.tb.level, cardCount: S.tb.cards, timed: false, topic: '', only: [m.id] });
      } }));
    });
    card.appendChild(acts);
  }

  // ---------- quiz ----------
  var LETTERS = ['ก', 'ข', 'ค', 'ง', 'จ', 'ฉ'];
  var quizTimers = {};
  function parseNumber(s) {
    s = str(s).trim().replace(/[๐-๙]/g, function (d) { return String('๐๑๒๓๔๕๖๗๘๙'.indexOf(d)); }).replace(/,/g, '').replace(/−/g, '-').replace(/\s+/g, '');
    if (!s) return NaN;
    var f = /^(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)$/.exec(s);
    if (f) return parseFloat(f[1]) / parseFloat(f[2]);
    var x = /^(-?\d*\.?\d+)(?:[eE]|×10\^|x10\^|\*10\^)(-?\d+)$/.exec(s);
    if (x) return parseFloat(x[1]) * Math.pow(10, parseInt(x[2], 10));
    return /^-?\d*\.?\d+$/.test(s) ? parseFloat(s) : NaN;
  }
  function numericCorrect(qq, v) {
    var x = parseNumber(v);
    if (!isFinite(x)) return false;
    var a = qq.numeric;
    return Math.abs(x - a) <= Math.max(Math.abs(a) * 0.01, 1e-9);
  }
  function isRight(qq, ans) { return qq.type === 'numeric' ? numericCorrect(qq, ans) : ans === qq.answer; }
  function answered(qq, ans) { return qq.type === 'numeric' ? str(ans).trim() !== '' : ans !== null && ans !== undefined; }

  function renderQuiz(node, m) {
    var box = node.querySelector('.body2');
    box.innerHTML = '';
    var q = m.quiz; if (!q) return;
    var paper = h('div', { class: 'quiz' });
    paper.appendChild(h('div', { class: 'quiz-head' }, [h('span', { class: 'quiz-title', text: q.title }), h('span', { class: 'muted', text: q.questions.length + ' ข้อ  ' + (LEVELS[q.level] ? LEVELS[q.level].label : '') + (q.timeLimit ? '  จับเวลา ' + Math.round(q.timeLimit / 60) + ' นาที' : '') })]));
    if (q.timeLimit && !q.done) {
      var tm = h('div', { class: 'timer', role: 'timer' }, [h('span', { text: 'เวลาที่เหลือ' }), h('span', { class: 'tv' })]);
      paper.appendChild(tm);
      startQuizTimer(m, tm);
    }
    q.questions.forEach(function (qq, qi) {
      var block = h('div', { class: 'qq' });
      block.appendChild(h('div', { class: 'qq-num', text: 'ข้อ ' + (qi + 1) + (qq.topic ? '  ' + qq.topic : '') + (qq.type === 'numeric' ? '  (เติมคำตอบเป็นตัวเลข)' : '') }));
      block.appendChild(h('div', { class: 'md', html: renderMarkdown(qq.question) }));
      if (qq.type === 'numeric') {
        var inp = h('input', { type: 'text', inputmode: 'decimal', 'aria-label': 'คำตอบข้อ ' + (qi + 1), placeholder: 'ใส่ตัวเลข', value: str(q.answers[qi]), disabled: q.done });
        if (q.done) inp.className = numericCorrect(qq, q.answers[qi]) ? 'correct' : 'wrong';
        inp.addEventListener('input', function () { q.answers[qi] = inp.value; updateQuizFoot(paper, m); });
        block.appendChild(h('div', { class: 'numrow' }, [inp, qq.unit ? h('span', { class: 'muted', text: qq.unit }) : null]));
      } else {
        var ch = h('div', { class: 'choices' });
        qq.choices.forEach(function (c, ci) {
          var cls = 'choice';
          if (q.done) { if (ci === qq.answer) cls += ' correct'; else if (q.answers[qi] === ci) cls += ' wrong'; }
          var btn = h('button', { class: cls, type: 'button', disabled: q.done, 'aria-pressed': q.answers[qi] === ci ? 'true' : 'false' }, [h('span', { class: 'lt', text: LETTERS[ci] }), h('span', { class: 'ct md', html: renderInline(c) })]);
          btn.addEventListener('click', function () {
            if (q.done) return;
            q.answers[qi] = ci;
            ch.querySelectorAll('.choice').forEach(function (b, bi) { b.setAttribute('aria-pressed', bi === ci ? 'true' : 'false'); });
            updateQuizFoot(paper, m);
          });
          ch.appendChild(btn);
        });
        block.appendChild(ch);
      }
      if (q.done) {
        var right = isRight(qq, q.answers[qi]);
        var correctText = qq.type === 'numeric' ? String(qq.numeric) + (qq.unit ? ' ' + qq.unit : '') : LETTERS[qq.answer];
        var fb = h('div', { class: 'fb' });
        fb.appendChild(h('div', { class: 'verdict ' + (right ? 'ok' : 'no'), text: right ? 'ถูกต้อง' : (answered(qq, q.answers[qi]) ? 'ยังไม่ถูก คำตอบที่ถูกคือ ' : 'ไม่ได้ตอบ คำตอบที่ถูกคือ ') + (right ? '' : correctText) }));
        if (qq.explanation) fb.appendChild(h('div', { class: 'fb-sec' }, [h('b', { text: 'เฉลย' }), h('div', { class: 'md', html: renderMarkdown(qq.explanation) })]));
        if (qq.trap) fb.appendChild(h('div', { class: 'fb-sec' }, [h('b', { text: 'กับดัก' }), h('div', { class: 'md', html: renderMarkdown(qq.trap) })]));
        if (qq.technique) fb.appendChild(h('div', { class: 'fb-sec' }, [h('b', { text: 'เทคนิค' }), h('div', { class: 'md', html: renderMarkdown(qq.technique) })]));
        if (qq.source) fb.appendChild(h('div', { class: 'muted', text: 'อ้างอิง: ' + qq.source }));
        fb.appendChild(h('button', { class: 'textbtn', type: 'button', text: 'เฉลยน่าสงสัย ให้ครูตรวจใหม่', onclick: function () {
          var key = qq.type === 'numeric' ? correctText : LETTERS[qq.answer] + ' ' + clip(qq.choices[qq.answer], 150);
          var opts = qq.choices ? ' | ตัวเลือก: ' + qq.choices.map(function (c, ci) { return LETTERS[ci] + ') ' + clip(c, 150); }).join(' / ') : '';
          send('ช่วยตรวจเฉลยข้อ ' + (qi + 1) + ' ในแบบทดสอบ "' + q.title + '" ใหม่อีกครั้ง โจทย์: ' + clip(qq.question, 400) + opts + ' | เฉลยที่ให้ไว้: ' + key + ' ตรวจละเอียด ถ้าผิดให้บอกคำตอบที่ถูกพร้อมเหตุผล');
        } }));
        block.appendChild(fb);
      }
      paper.appendChild(block);
    });
    paper.appendChild(h('div', { class: 'quiz-foot' }));
    box.appendChild(paper);
    updateQuizFoot(paper, m);
    typeset(paper);
  }
  function startQuizTimer(m, el) {
    var q = m.quiz;
    if (!q.startedAt) { q.startedAt = Date.now(); queueSave(); }
    clearInterval(quizTimers[m.qid]);
    var tick = function () {
      var left = Math.max(0, Math.round((q.startedAt + q.timeLimit * 1000 - Date.now()) / 1000));
      var tv = el.querySelector('.tv');
      if (tv) tv.textContent = Math.floor(left / 60) + ':' + String(left % 60).padStart(2, '0');
      el.classList.toggle('low', left <= 60);
      if (!el.isConnected || q.done) { clearInterval(quizTimers[m.qid]); return; }
      if (left <= 0) { clearInterval(quizTimers[m.qid]); showToast('หมดเวลา ครูตรวจคำตอบให้แล้ว'); submitQuiz(m, true); }
    };
    tick();
    quizTimers[m.qid] = setInterval(tick, 1000);
  }
  function updateQuizFoot(paper, m) {
    var q = m.quiz, foot = paper.querySelector('.quiz-foot');
    foot.innerHTML = '';
    if (!q.done) {
      var n = q.questions.filter(function (qq, i) { return answered(qq, q.answers[i]); }).length;
      foot.appendChild(h('button', { class: 'textbtn strong', type: 'button', text: 'ส่งคำตอบ', onclick: function () { submitQuiz(m); } }));
      foot.appendChild(h('span', { class: 'muted', text: 'ตอบแล้ว ' + n + '/' + q.questions.length + ' ข้อ' }));
      return;
    }
    foot.appendChild(h('span', { class: 'score', text: 'ได้ ' + q.score + '/' + q.questions.length + ' คะแนน' }));
    var wrong = q.questions.filter(function (qq, i) { return !isRight(qq, q.answers[i]); });
    if (wrong.length) {
      foot.appendChild(h('button', { class: 'textbtn', type: 'button', text: 'อธิบายข้อที่ผิดเพิ่ม', onclick: function () { send('อธิบายข้อที่ฉันทำผิดในแบบทดสอบ "' + q.title + '" ให้ละเอียดขึ้น ว่าฉันเข้าใจผิดตรงไหน และมีเทคนิคอะไรไม่ให้ผิดซ้ำ'); } }));
      foot.appendChild(h('button', { class: 'textbtn', type: 'button', text: 'ทำชุดใหม่เน้นจุดที่ผิด', onclick: function () {
        var topics = Array.from(new Set(wrong.map(function (x) { return x.topic; }).filter(Boolean))).join(', ');
        runAction('quiz', { count: Math.min(10, Math.max(5, wrong.length * 2)), level: q.level || 'exam', topic: topics || 'ข้อที่ฉันเพิ่งทำผิด', only: q.materialIds });
      } }));
    } else {
      foot.appendChild(h('button', { class: 'textbtn', type: 'button', text: 'ทำชุดที่ยากขึ้น', onclick: function () { runAction('quiz', { count: q.questions.length, level: 'hard', topic: q.topicHint || '', only: q.materialIds }); } }));
    }
  }
  function quizContent(m) {
    var q = m.quiz;
    var topics = Array.from(new Set(q.questions.map(function (x) { return x.topic; }).filter(Boolean))).join(', ');
    if (!q.done) return '[ครูสร้างแบบทดสอบ "' + q.title + '" ' + q.questions.length + ' ข้อ' + (topics ? ' หัวข้อ: ' + topics : '') + ' ฉันยังไม่ได้ส่งคำตอบ]';
    var lines = ['[ผลแบบทดสอบ "' + q.title + '"] ฉันได้ ' + q.score + '/' + q.questions.length + ' คะแนน'];
    q.questions.forEach(function (qq, i) {
      var a = q.answers[i];
      if (isRight(qq, a)) lines.push('ข้อ ' + (i + 1) + ' (' + (qq.topic || '-') + '): ถูก');
      else lines.push('ข้อ ' + (i + 1) + ' (' + (qq.topic || '-') + '): ผิด | โจทย์: ' + clip(qq.question, 300) + ' | ฉันตอบ: ' + (answered(qq, a) ? (qq.type === 'numeric' ? str(a) : clip(qq.choices[a], 150)) : '(ไม่ได้ตอบ)') + ' | เฉลย: ' + (qq.type === 'numeric' ? qq.numeric + (qq.unit ? ' ' + qq.unit : '') : clip(qq.choices[qq.answer], 150)));
    });
    return lines.join('\n');
  }
  function submitQuiz(m, force) {
    var q = m.quiz;
    if (q.done) return;
    var un = q.questions.filter(function (qq, i) { return !answered(qq, q.answers[i]); }).length;
    if (un && !m._confirm && !force) { m._confirm = true; showToast('ยังไม่ได้ตอบ ' + un + ' ข้อ กดส่งคำตอบอีกครั้งเพื่อยืนยัน'); return; }
    q.done = true;
    clearInterval(quizTimers[m.qid]);
    q.score = q.questions.filter(function (qq, i) { return isRight(qq, q.answers[i]); }).length;
    var bySubj = {};
    q.questions.forEach(function (qq, i) {
      var ok = isRight(qq, q.answers[i]);
      var sj = qq.subject || 'other';
      bySubj[sj] = bySubj[sj] || [0, 0]; bySubj[sj][1]++; if (ok) bySubj[sj][0]++;
      if (!ok) addLog({ type: 'quiz', topic: qq.topic, subject: sj, q: clip(qq.question, 300), chosen: answered(qq, q.answers[i]) ? (qq.type === 'numeric' ? str(q.answers[i]) : clip(qq.choices[q.answers[i]], 150)) : '(ไม่ได้ตอบ)', correct: qq.type === 'numeric' ? String(qq.numeric) : clip(qq.choices[qq.answer], 150) });
    });
    DB.put('results', { id: m.qid, title: q.title, date: Date.now(), score: q.score, total: q.questions.length, bySubject: bySubj, topics: q.questions.map(function (qq, i) { return { topic: qq.topic, subject: qq.subject, ok: isRight(qq, q.answers[i]) }; }) }).catch(function () {});
    bumpActivity('quizQ', q.questions.length); bumpActivity('quizOk', q.score);
    m.content = quizContent(m);
    renderQuiz(m._node, m);
    saveLog(); queueSave();
  }
  function normalizeQuiz(data, o) {
    var list = data && Array.isArray(data.questions) ? data.questions : [];
    var qs = list.map(function (q) {
      if (!q || typeof q.question !== 'string') return null;
      var base = { question: fixLatex(q.question), explanation: fixLatex(q.explanation), trap: fixLatex(q.trap), technique: fixLatex(q.technique), topic: clip(q.topic, 80), subject: SUBJECT_LABEL[q.subject] ? q.subject : 'other', source: clip(q.source, 120) };
      if (q.type === 'numeric' || (!Array.isArray(q.choices) || !q.choices.length) && typeof q.numeric_answer === 'number') {
        if (typeof q.numeric_answer !== 'number' || !isFinite(q.numeric_answer)) return null;
        base.type = 'numeric'; base.numeric = q.numeric_answer; base.unit = clip(q.unit, 30);
        return base;
      }
      if (!Array.isArray(q.choices) || q.choices.length < 2) return null;
      var choices = q.choices.slice(0, 6).map(fixLatex);
      var ans = Number(q.answer_index);
      if (!Number.isInteger(ans) || ans < 0 || ans >= choices.length) return null;
      var order = shuffle(choices.map(function (_, i) { return i; }));
      base.type = 'mcq'; base.choices = order.map(function (i) { return choices[i]; }); base.answer = order.indexOf(ans);
      return base;
    }).filter(Boolean);
    if (!qs.length) return null;
    return { title: clip(data.title, 120) || 'แบบทดสอบ', level: o.level, questions: qs, answers: qs.map(function (qq) { return qq.type === 'numeric' ? '' : null; }), done: false, score: 0, materialIds: o.only || null, topicHint: o.topic || '', timeLimit: o.timed ? Math.max(3, qs.length * 2) * 60 : 0 };
  }

  // ---------- flashcards with spaced repetition ----------
  function schedule(card, grade) {
    var now = Date.now();
    card.reps = card.reps || 0; card.ease = card.ease || 2.5; card.interval = card.interval || 0;
    if (grade === 0) { card.lapses = (card.lapses || 0) + 1; card.reps = 0; card.ease = Math.max(1.3, card.ease - 0.2); card.interval = 0; card.due = now + 10 * 60e3; }
    else {
      card.reps += 1;
      if (card.reps === 1) card.interval = grade === 2 ? 3 : 1;
      else if (card.reps === 2) card.interval = grade === 2 ? 6 : 3;
      else card.interval = Math.max(card.interval + 1, Math.round(card.interval * card.ease * (grade === 2 ? 1.3 : 1)));
      if (grade === 2) card.ease += 0.15;
      card.due = now + card.interval * DAY;
    }
    card.last = now;
    return card;
  }
  function previewNext(card, grade) { var c = JSON.parse(JSON.stringify(card)); schedule(c, grade); return fmtInterval(c.due - Date.now()); }
  function gradeButtons(card, onGrade) {
    var mk = function (label, grade, strong) {
      return h('button', { class: 'textbtn' + (strong ? ' strong' : ''), type: 'button', onclick: function () { onGrade(grade); } }, [label, h('span', { class: 'hint', text: 'อีก ' + previewNext(card, grade) })]);
    };
    return h('div', { class: 'grade' }, [mk('ยังจำไม่ได้', 0), mk('จำได้', 1, true), mk('ง่ายมาก', 2)]);
  }
  function indexCard(card, flipped, onFlip) {
    var el = h('div', { class: 'icard', role: 'button', tabindex: '0', 'aria-label': flipped ? 'บัตรคำ ด้านคำตอบ' : 'บัตรคำ แตะเพื่อดูคำตอบ' }, [
      h('div', { class: 'side', text: (card.topic || '') + (flipped ? '' : (card.topic ? '  ' : '') + 'แตะเพื่อดูคำตอบ') }),
      h('div', { class: 'front md', html: renderMarkdown(card.front) }),
      flipped ? h('div', { class: 'back md', html: renderMarkdown(card.back) }) : null
    ]);
    el.addEventListener('click', function () { if (!flipped) onFlip(); });
    el.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && !flipped) { e.preventDefault(); onFlip(); } });
    return el;
  }
  async function reviewCard(card, grade) {
    schedule(card, grade);
    await DB.put('cards', card).catch(function () {});
    bumpActivity('cards');
    if (grade === 0) addLog({ type: 'card', topic: card.topic, subject: card.subject, q: clip(card.front, 300) });
    else state.log = state.log.filter(function (x) { return !(x.type === 'card' && x.q === clip(card.front, 300)); });
    saveLog();
    refreshDue();
  }
  function renderDeck(node, m) {
    var box = node.querySelector('.body2');
    box.innerHTML = '';
    var d = m.deck; if (!d) return;
    var wrap = h('div', { class: 'deck' });
    var done = d.pos >= d.order.length;
    wrap.appendChild(h('div', { class: 'deck-head' }, [h('span', { class: 'quiz-title', text: d.title }), h('span', { class: 'muted', text: done ? 'ทบทวนครบชุดแล้ว' : 'ใบที่ ' + (d.pos + 1) + '/' + d.order.length })]));
    if (!done) {
      var cardId = d.order[d.pos];
      var card = d.cards.find(function (c) { return c.id === cardId; });
      wrap.appendChild(indexCard(card, d.flipped, function () { d.flipped = true; renderDeck(node, m); }));
      if (!d.flipped) wrap.appendChild(h('div', { class: 'grade' }, [h('button', { class: 'textbtn strong', type: 'button', text: 'ดูคำตอบ', onclick: function () { d.flipped = true; renderDeck(node, m); } })]));
      else wrap.appendChild(gradeButtons(card, async function (grade) {
        await reviewCard(card, grade);
        d.results[cardId] = grade;
        if (grade === 0 && !d.requeued[cardId]) { d.order.push(cardId); d.requeued[cardId] = true; }
        d.pos++; d.flipped = false;
        if (d.pos >= d.order.length) {
          var hard = d.cards.filter(function (c) { return d.results[c.id] === 0; }).map(function (c) { return c.front; });
          m.content = '[บัตรคำ "' + d.title + '" ' + d.cards.length + ' ใบ] ทบทวนแล้ว' + (hard.length ? ' ใบที่ยังจำไม่ได้: ' + clip(hard.join('; '), 1000) : ' จำได้ทุกใบ');
          queueSave();
        }
        renderDeck(node, m);
      }));
    } else {
      wrap.appendChild(h('div', { class: 'md', html: renderMarkdown('บัตรคำชุดนี้ถูกเก็บในหน้า **ทบทวน** แล้ว ครูจะนัดให้ทบทวนแต่ละใบตามจังหวะที่ช่วยให้จำได้นาน ใบที่ยังจำไม่ได้จะกลับมาเร็วกว่า') }));
      wrap.appendChild(h('div', { class: 'grade' }, [h('button', { class: 'textbtn strong', type: 'button', text: 'ไปหน้าทบทวน', onclick: function () { showView('review'); } })]));
    }
    box.appendChild(wrap);
    typeset(wrap);
  }
  async function saveDeck(data, o) {
    var list = data && Array.isArray(data.cards) ? data.cards : [];
    var deckId = newId('d');
    var now = Date.now();
    var cards = list.filter(function (c) { return c && str(c.front).trim() && str(c.back).trim(); }).map(function (c, i) {
      return { id: newId('c') + i, deckId: deckId, front: fixLatex(c.front), back: fixLatex(c.back), topic: clip(c.topic, 80), subject: SUBJECT_LABEL[c.subject] ? c.subject : 'other', created: now, due: now, reps: 0, ease: 2.5, interval: 0 };
    });
    if (!cards.length) return null;
    var deck = { id: deckId, title: clip(data.title, 120) || 'บัตรคำ', created: now, count: cards.length, materialIds: o.only || null };
    await DB.put('decks', deck).catch(function () {});
    await DB.putMany('cards', cards).catch(function () {});
    refreshDue();
    return { title: deck.title, deckId: deckId, cards: cards, order: shuffle(cards.map(function (c) { return c.id; })), pos: 0, flipped: false, results: {}, requeued: {} };
  }

  // ---------- generation ----------
  function startThinking(node, label) {
    var started = Date.now();
    var t = { gotText: false };
    setStatus(node, label + '…');
    t.timer = setInterval(function () { if (!t.gotText && !t.paused) setStatus(node, label + '… ' + Math.round((Date.now() - started) / 1000) + ' วินาที'); }, 1000);
    return t;
  }
  function needKey(am) {
    if (S.apiKey) return false;
    am.local = true; am.needsKey = true; am.error = errorCopy({ code: 'nokey' });
    return true;
  }
  function fail(am, e) {
    if (e.code === 'cancelled') { if (e.acc && e.acc.text && !am.kind) am.content = e.acc.text; am.note = 'หยุดแล้ว'; return; }
    if (e.acc && e.acc.text && !am.kind) { am.content = e.acc.text; }
    am.error = errorCopy(e);
    am.retryable = !(e.code === 'too_large' || e.code === 'blocked' || e.code === 'nokey');
  }

  async function send(text) {
    text = str(text).trim();
    if (state.busy) return;
    var imgs = state.pendingImages.slice();
    if (!text && !imgs.length) return;
    if (text === 'สรุปวันนี้') { input.value = ''; autosize(); return runSummary(); }
    var userMsg = { role: 'user', content: text || 'ช่วยดูรูปนี้หน่อย', imgs: imgs.map(function (i) { return i.url; }), ts: Date.now() };
    state.session.messages.push(userMsg);
    input.value = ''; autosize();
    state.pendingImages = []; renderThumbs();
    appendMessage(userMsg);
    bumpActivity('msgs');
    await generate({});
  }

  async function generate(gen) {
    setBusy(true);
    var am = { role: 'assistant', content: '', ts: Date.now(), gen: { only: gen.only || null } };
    state.session.messages.push(am);
    var node = appendMessage(am);
    var think = startThinking(node, 'ครูกำลังคิด');
    var ctl = new AbortController(); state.ctl = ctl;
    var unscope = scopeMaterials(gen.only);
    try {
      if (needKey(am)) return;
      var tools = { code: S.codeExec, search: searchUsable() };
      var acc = await gemini({
        system: buildSystem(tools), code: tools.code, search: tools.search, signal: ctl.signal,
        buildContents: makeContentsBuilder({ withMaterials: true, signal: ctl.signal }, node),
        onUpdate: function (a) {
          am.thoughts = a.thoughts;
          if (a.text) { think.gotText = true; am.content = a.text; setStatus(node, ''); }
          else if (a.code.length) setStatus(node, 'ครูกำลังรันโค้ดตรวจคำตอบ…');
          scheduleRender(node, am);
        }
      });
      checkFinish(acc);
      am.content = acc.text; am.thoughts = acc.thoughts;
      if (acc.code.length) am.code = acc.code;
      if (acc.images.length) am.images = acc.images;
      var g = groundingInfo(acc.grounding); if (g) am.sources = g;
      if (acc.notes && acc.notes.length) am.notes = acc.notes;
      if (!am.content && !am.code) throw apiError('empty');
      if (acc.finishReason === 'MAX_TOKENS') am.note = 'คำตอบยาวเกินไปจึงถูกตัด พิมพ์ "ต่อ" เพื่อให้ครูเขียนต่อ';
    } catch (e) { fail(am, e); }
    finally {
      unscope();
      clearInterval(think.timer); setStatus(node, ''); state.ctl = null;
      finalizeRender(node, am); setBusy(false); queueSave();
    }
  }

  async function generateStructured(id, o, imgs) {
    setBusy(true);
    var am = { role: 'assistant', kind: id === 'quiz' ? 'quiz' : 'cards', content: '', ts: Date.now(), qid: newId('q'), genStructured: { id: id, o: o } };
    state.session.messages.push(am);
    var node = appendMessage(am);
    var think = startThinking(node, id === 'quiz' ? 'ครูกำลังออกข้อสอบและตรวจเฉลย' : 'ครูกำลังทำบัตรคำ');
    var ctl = new AbortController(); state.ctl = ctl;
    var unscope = scopeMaterials(o.only);
    try {
      if (needKey(am)) return;
      var tools = { code: S.codeExec, search: false };
      var acc = await gemini({
        system: buildSystem(tools), code: tools.code, search: false, signal: ctl.signal, thinking: 'high',
        schema: id === 'quiz' ? QUIZ_SCHEMA : CARDS_SCHEMA,
        buildContents: makeContentsBuilder({ withMaterials: true, signal: ctl.signal }, node),
        onUpdate: function (a) {
          am.thoughts = a.thoughts;
          var n = (a.text.match(id === 'quiz' ? /"question"\s*:/g : /"front"\s*:/g) || []).length;
          if (a.text) { think.gotText = true; setStatus(node, (id === 'quiz' ? 'ครูกำลังเขียนข้อสอบ' : 'ครูกำลังเขียนบัตรคำ') + (n ? ' เสร็จแล้ว ' + n + (id === 'quiz' ? ' ข้อ' : ' ใบ') : '…')); }
          else if (a.code.length) setStatus(node, 'ครูกำลังรันโค้ดตรวจเฉลย…');
          scheduleRender(node, am);
        }
      });
      checkFinish(acc);
      am.thoughts = acc.thoughts;
      if (acc.code.length) am.code = acc.code;
      var raw = acc.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
      var data;
      try { data = JSON.parse(raw); } catch (err) {
        var s = raw.indexOf('{'), t = raw.lastIndexOf('}');
        try { data = JSON.parse(raw.slice(s, t + 1)); } catch (err2) { throw apiError('invalid_json'); }
      }
      if (id === 'quiz') {
        am.quiz = normalizeQuiz(data, o);
        if (!am.quiz) throw apiError('invalid_json');
        am.content = quizContent(am);
      } else {
        am.deck = await saveDeck(data, o);
        if (!am.deck) throw apiError('invalid_json');
        am.content = '[ครูทำบัตรคำ "' + am.deck.title + '" ' + am.deck.cards.length + ' ใบ และเก็บไว้ในหน้าทบทวนแล้ว]';
      }
      if (acc.notes && acc.notes.length) am.notes = acc.notes;
    } catch (e) { fail(am, e); }
    finally {
      unscope();
      clearInterval(think.timer); setStatus(node, ''); state.ctl = null;
      finalizeRender(node, am); setBusy(false); queueSave();
    }
  }

  function retryLast() {
    if (state.busy) return;
    var msgs = state.session.messages, last = msgs[msgs.length - 1];
    if (!last || last.role !== 'assistant') return;
    msgs.pop(); if (last._node) last._node.remove();
    if (last.kind === 'summary') { var prev = msgs[msgs.length - 1]; if (prev && prev.kind === 'summary') { msgs.pop(); if (prev._node) prev._node.remove(); } runSummary(); return; }
    if (last.genStructured) { generateStructured(last.genStructured.id, last.genStructured.o); return; }
    generate(last.gen || {});
  }

  // Limits the files in context to `only` during one generation.
  function scopeMaterials(only) {
    if (!only || !only.length) return function () {};
    var all = (state.session.materialIds || []).slice();
    var keep = all.filter(function (x) { return only.indexOf(x) !== -1; });
    if (!keep.length || keep.length === all.length) return function () {};
    state.session.materialIds = keep;
    return function () {
      var now = state.session.materialIds || [];
      var removed = keep.filter(function (x) { return now.indexOf(x) === -1; });
      var added = now.filter(function (x) { return all.indexOf(x) === -1; });
      state.session.materialIds = all.filter(function (x) { return removed.indexOf(x) === -1; }).concat(added);
      renderMatChips();
    };
  }

  async function runAction(id, o) {
    o = o || {};
    if (state.busy) { showToast('รอครูตอบข้อนี้ให้เสร็จก่อน'); return; }
    var act = ACTIONS.find(function (a) { return a.id === id; });
    if (!act) return;
    if (!LEVELS[o.level]) o.level = 'exam';
    o.count = Number(o.count) || 10;
    if (state.view !== 'chat') showView('chat');
    var mats = activeMaterials();
    if (o.only && o.only.length) { var om = mats.filter(function (m) { return o.only.indexOf(m.id) !== -1; }); if (om.length) mats = om; }
    var topic = str(o.topic).trim();
    var hasConvo = state.session.messages.some(function (m) { return m.role === 'user' && m.kind !== 'summary'; });
    var imgs = state.pendingImages.slice();
    if (!mats.length && !topic && !hasConvo && !imgs.length && !o.mistakes && id !== 'weakness' && id !== 'plan') {
      showToast('แนบไฟล์ หรือพิมพ์หัวข้อในช่อง "หัวข้อหรือขอบเขต" ก่อน');
      openTools(); setTimeout(function () { $('tb-topic').focus(); }, 60);
      return;
    }
    var target = mats.length ? mats.map(function (m) { return m.name; }).join(', ') : (topic || (o.mistakes ? 'ข้อที่เคยทำผิด' : imgs.length ? 'รูปที่แนบ' : 'เรื่องที่คุยอยู่'));
    var label = act.label;
    if (id === 'quiz') label += ' ' + o.count + ' ข้อ (' + LEVELS[o.level].label + (o.timed ? ', จับเวลา' : '') + ')';
    if (id === 'cards') label += ' ' + (o.cardCount || 15) + ' ใบ';
    var visible = label + ': ' + target + (mats.length && topic ? ' เน้น ' + topic : '');
    var tl;
    if (mats.length) tl = 'Target: the attached file(s) ' + mats.map(function (m) { return '"' + m.name + '"'; }).join(', ') + (topic ? ', focusing on: ' + topic : ' (the whole file)') + '.';
    else if (topic) tl = 'Target topic: ' + topic + '.';
    else if (o.mistakes) tl = 'Target: my recent quiz mistakes listed in the system instructions.';
    else if (imgs.length) tl = 'Target: the photo(s) I attached to this message.';
    else if (hasConvo) tl = 'Target: the topic we have been discussing in this conversation.';
    else tl = 'Target: my weak areas from my learning_profile and recent mistakes.';
    if (imgs.length && mats.length) tl += ' Also use the photo(s) I attached.';
    var instr = tl + '\n' + ACTION_INSTR[id]({ count: id === 'cards' ? (o.cardCount || 15) : o.count, level: o.level, mistakes: !!o.mistakes });
    var userMsg = { role: 'user', content: visible, instr: instr, action: id, topic: topic, imgs: imgs.map(function (i) { return i.url; }), ts: Date.now() };
    state.session.messages.push(userMsg);
    state.pendingImages = []; renderThumbs();
    appendMessage(userMsg);
    closeAllDrawers();
    bumpActivity('msgs');
    var only = (o.only && o.only.length) ? mats.map(function (m) { return m.id; }) : null;
    if (act.json) await generateStructured(id, { count: o.count, level: o.level, cardCount: o.cardCount, topic: topic, timed: !!o.timed, only: only });
    else await generate({ only: only });
  }

  async function runSummary() {
    if (state.busy) return;
    if (state.view !== 'chat') showView('chat');
    var has = state.session.messages.some(function (m) { return (m.role === 'user' && m.kind !== 'summary') || m.kind === 'quiz' || m.kind === 'cards'; });
    var um = { role: 'user', content: 'สรุปวันนี้', kind: 'summary', ts: Date.now() };
    state.session.messages.push(um); appendMessage(um);
    if (!has) {
      var info = { role: 'assistant', kind: 'summary', local: true, content: 'บทเรียนนี้ยังไม่มีเนื้อหาให้สรุป เรียนสักเรื่องหรือทำแบบทดสอบก่อน แล้วค่อยกด "สรุปวันนี้" ครูจะได้มีข้อมูลไปอัปเดตโปรไฟล์ของคุณ' };
      state.session.messages.push(info); appendMessage(info); return;
    }
    setBusy(true);
    var am = { role: 'assistant', kind: 'summary', content: '', ts: Date.now() };
    state.session.messages.push(am);
    var node = appendMessage(am);
    setStatus(node, 'ครูกำลังสรุปบทเรียนและอัปเดตโปรไฟล์…');
    var ctl = new AbortController(); state.ctl = ctl;
    try {
      if (needKey(am)) return;
      var acc = await gemini({
        system: buildSystem({ code: false, search: false }), code: false, search: false, signal: ctl.signal,
        buildContents: makeContentsBuilder({ withMaterials: false, signal: ctl.signal, extraUserText: SUMMARY_INSTRUCTION }, node),
        onUpdate: function (a) { am.thoughts = a.thoughts; if (a.text) { am.content = a.text; setStatus(node, ''); } scheduleRender(node, am); }
      });
      checkFinish(acc);
      am.content = acc.text.trim(); am.thoughts = acc.thoughts;
      if (!am.content) throw apiError('empty');
      var previous = { text: state.profile.text, updatedAt: state.profile.updatedAt };
      state.profile = { text: am.content, updatedAt: Date.now() };
      await kvSet('profile', state.profile);
      am.saved = true;
      showToast('บันทึกโปรไฟล์การเรียนแล้ว', 'ย้อนกลับ', async function () {
        state.profile = previous; await kvSet('profile', previous);
        am.saved = false; finalizeRender(node, am); showToast('คืนค่าโปรไฟล์เดิมแล้ว');
      });
    } catch (e) { fail(am, e); }
    finally { setStatus(node, ''); state.ctl = null; finalizeRender(node, am); setBusy(false); queueSave(); }
  }

  // ---------- composer ----------
  var input = $('input'), sendBtn = $('btn-send'), fileInput = $('file'), cameraInput = $('camera');
  var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 168) + 'px'; }
  input.addEventListener('input', function () { autosize(); updateComposer(); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !coarse && !e.isComposing) { e.preventDefault(); send(input.value); } });
  sendBtn.addEventListener('click', function () { if (state.busy) { if (state.ctl) state.ctl.abort(); return; } send(input.value); });
  function setBusy(b) { state.busy = b; thread.setAttribute('aria-busy', b ? 'true' : 'false'); updateComposer(); }
  function updateComposer() {
    var busy = state.busy;
    sendBtn.querySelector('.i-send').style.display = busy ? 'none' : '';
    sendBtn.querySelector('.i-stop').style.display = busy ? '' : 'none';
    sendBtn.setAttribute('aria-label', busy ? 'หยุด' : 'ส่ง');
    sendBtn.disabled = !busy && !input.value.trim() && !state.pendingImages.length;
    document.querySelectorAll('.qbtn').forEach(function (b) { b.disabled = busy; });
  }
  var QUICK = [
    { label: 'เครื่องมือช่วยเรียน', main: true, run: function () { openTools(); } },
    { label: 'เฉลยเลย', run: function () { send('เฉลยเลย'); } },
    { label: 'อธิบายง่ายๆ', run: function () { send('อธิบายง่ายๆ'); } },
    { label: 'ทบทวน', run: function () { send('ทบทวน'); } },
    { label: 'สรุปวันนี้', run: function () { runSummary(); } }
  ];
  function renderQuick() {
    var q = $('quick'); q.innerHTML = '';
    QUICK.forEach(function (a) { q.appendChild(h('button', { class: 'qbtn' + (a.main ? ' main' : ''), type: 'button', text: a.label, onclick: a.run })); });
  }
  function renderSubjects() {
    var nav = $('subjects'); nav.innerHTML = '';
    SUBJECTS.forEach(function (s) { nav.appendChild(h('button', { class: 'chip', type: 'button', text: s.label, 'aria-pressed': s.id === state.subject() ? 'true' : 'false', onclick: function () { setSubject(s.id); } })); });
  }
  function setSubject(id) { state.session.subject = id; S.subject = id; saveSettings(); renderSubjects(); }
  function updateTitle() { $('session-title').textContent = state.session.title || 'บทเรียนใหม่'; }

  // Attachments
  $('btn-attach').addEventListener('click', function () { fileInput.click(); });
  $('btn-camera').addEventListener('click', function () { cameraInput.click(); });
  fileInput.addEventListener('change', function () { var f = Array.from(fileInput.files || []); fileInput.value = ''; handleFiles(f); });
  cameraInput.addEventListener('change', function () { var f = Array.from(cameraInput.files || []); cameraInput.value = ''; f.forEach(addPendingImage); });
  async function addPendingImage(f) {
    if (state.pendingImages.length >= 6) { showToast('แนบรูปได้สูงสุด 6 รูปต่อข้อความ'); return; }
    var item = { url: '' };
    state.pendingImages.push(item); renderThumbs();
    try {
      var small = await compressImage(f, 1800, 0.85);
      item.url = await blobToDataUrl(small);
    } catch (e) { state.pendingImages.splice(state.pendingImages.indexOf(item), 1); showToast('อ่านรูปนี้ไม่ได้'); }
    renderThumbs();
  }
  function renderThumbs() {
    var t = $('thumbs'); t.innerHTML = '';
    t.hidden = !state.pendingImages.length;
    state.pendingImages.forEach(function (it, idx) {
      t.appendChild(h('div', { class: 'thumb' }, [
        it.url ? h('img', { src: it.url, alt: 'รูปที่จะส่ง' }) : h('div', { style: 'width:58px;height:58px;border-radius:8px;background:var(--code-bg)' }),
        h('button', { type: 'button', 'aria-label': 'เอารูปออก', text: '×', onclick: function () { state.pendingImages.splice(idx, 1); renderThumbs(); } })
      ]));
    });
    updateComposer();
  }
  async function handleFiles(files) {
    for (var i = 0; i < files.length; i++) {
      var f = files[i], kind = detectKind(f);
      if (kind === 'office-old') { showToast('ยังอ่าน ' + f.name + ' ไม่ได้ ให้บันทึกเป็น PDF, .docx หรือ .pptx ก่อน'); continue; }
      if (!kind) { showToast('ยังไม่รองรับไฟล์ ' + f.name); continue; }
      if (kind === 'image' && state.view === 'chat') { addPendingImage(f); continue; }
      if (f.size > INLINE_MAX && kind === 'pdf') { showToast(f.name + ' ใหญ่เกิน 48 MB ลองแยกไฟล์ก่อน'); continue; }
      await addMaterial(f, kind);
    }
  }
  var dragDepth = 0;
  document.addEventListener('dragenter', function (e) { if (e.dataTransfer && Array.from(e.dataTransfer.types || []).indexOf('Files') !== -1) { dragDepth++; document.body.classList.add('dragging'); } });
  document.addEventListener('dragleave', function () { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) document.body.classList.remove('dragging'); });
  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('drop', function (e) { e.preventDefault(); dragDepth = 0; document.body.classList.remove('dragging'); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) handleFiles(Array.from(e.dataTransfer.files)); });

  // Voice input (Thai speech-to-text where the browser supports it)
  (function setupMic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    var btn = $('btn-mic');
    if (!SR) return;
    btn.hidden = false;
    var rec = null, base = '';
    btn.addEventListener('click', function () {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.lang = 'th-TH'; rec.interimResults = true; rec.continuous = false;
      base = input.value ? input.value.replace(/\s*$/, ' ') : '';
      rec.onresult = function (ev) { var t = ''; for (var i = 0; i < ev.results.length; i++) t += ev.results[i][0].transcript; input.value = base + t; autosize(); updateComposer(); };
      rec.onerror = function (ev) { if (ev.error === 'not-allowed') showToast('ยังไม่ได้อนุญาตให้ใช้ไมโครโฟน'); };
      rec.onend = function () { rec = null; btn.classList.remove('listening'); btn.setAttribute('aria-label', 'พูดแทนพิมพ์'); };
      try { rec.start(); btn.classList.add('listening'); btn.setAttribute('aria-label', 'หยุดฟัง'); } catch (e) { rec = null; }
    });
  })();

  // ---------- materials ----------
  function persistMaterial(m) {
    var rec = { id: m.id, name: m.name, kind: m.kind, mime: m.mime, size: m.size, created: m.created, pages: m.pages || 0, text: m.text || '', blob: m.blob || null, file: m.file || null };
    return DB.put('materials', rec).catch(function () { showToast('เก็บไฟล์ไม่สำเร็จ พื้นที่ในเครื่องอาจเต็ม'); });
  }
  async function addMaterial(file, kind) {
    var m = { id: newId('m'), name: file.name, kind: kind, mime: file.type || (kind === 'pdf' ? 'application/pdf' : 'text/plain'), size: file.size, created: Date.now(), status: 'reading' };
    state.materials.unshift(m);
    if (state.view === 'chat') { activateMaterial(m.id); pushMaterialCard(m); }
    try {
      if (kind === 'pdf') m.blob = file;
      else if (kind === 'image') { var small = await compressImage(file, 2400, 0.88); m.blob = small; m.mime = 'image/jpeg'; m.size = small.size; }
      else if (kind === 'docx') m.text = normalizeText(await extractDocx(file));
      else if (kind === 'pptx') { var r = await extractPptx(file); m.text = normalizeText(r.text); m.pages = r.pages; }
      else m.text = normalizeText(await file.text());
      if (m.text !== undefined && m.kind !== 'pdf' && m.kind !== 'image') {
        if (!m.text.trim()) throw new Error('ไม่พบข้อความในไฟล์นี้');
        if (m.text.length > MAX_TEXT_CHARS) { m.text = m.text.slice(0, MAX_TEXT_CHARS) + '\n…[ไฟล์ยาวมาก ตัดส่วนที่เหลือ]'; }
      }
      m.status = 'ready';
      await persistMaterial(m);
    } catch (e) {
      m.status = 'error';
      m.error = 'อ่านไฟล์นี้ไม่ได้ (' + clip(e && e.message || '', 80) + ') ลองบันทึกเป็น PDF แล้วส่งใหม่';
    }
    refreshMaterialViews(m);
    queueSave();
    if (state.view === 'library') renderLibrary();
    return m;
  }
  function pushMaterialCard(m) {
    var card = { role: 'assistant', kind: 'material', local: true, materialId: m.id, name: m.name, content: '[ไฟล์ ' + m.name + ']', ts: Date.now() };
    state.session.messages.push(card); appendMessage(card); queueSave();
  }
  function activateMaterial(id) {
    var ids = state.session.materialIds || (state.session.materialIds = []);
    if (ids.indexOf(id) === -1) ids.push(id);
    renderMatChips();
  }
  function deactivateMaterial(id) { state.session.materialIds = (state.session.materialIds || []).filter(function (x) { return x !== id; }); renderMatChips(); queueSave(); }
  function refreshMaterialViews(m) {
    state.session.messages.forEach(function (msg) { if (msg.kind === 'material' && msg.materialId === m.id && msg._node) renderMaterialCard(msg._node, msg); });
    renderMatChips();
  }
  function renderMatChips() {
    var box = $('matchips'); box.innerHTML = '';
    var mats = (state.session.materialIds || []).map(getMaterial).filter(Boolean);
    box.hidden = !mats.length;
    mats.forEach(function (m) {
      box.appendChild(h('span', { class: 'matchip', title: m.name }, [
        h('span', { class: 'nm', text: m.name }),
        m.status !== 'ready' ? h('span', { class: 'st', text: m.status === 'reading' ? 'กำลังเตรียม' : 'อ่านไม่ได้' }) : null,
        h('button', { type: 'button', 'aria-label': 'เลิกใช้ไฟล์ ' + m.name + ' ในบทเรียนนี้', text: '×', onclick: function () { deactivateMaterial(m.id); } })
      ]));
    });
  }

  // ---------- views ----------
  function showView(v) {
    state.view = v;
    document.querySelectorAll('.view').forEach(function (el) { el.hidden = el.id !== 'view-' + v; });
    document.querySelectorAll('.nav-btn').forEach(function (b) { if (b.dataset.view === v) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); });
    if (v === 'library') renderLibrary();
    if (v === 'review') renderReview();
    if (v === 'stats') renderStats();
    if (v === 'settings') renderSettings();
    if (v === 'chat') { stick(); }
  }
  document.querySelectorAll('.nav-btn').forEach(function (b) { b.addEventListener('click', function () { if (reviewSession) reviewSession = null; showView(b.dataset.view); }); });

  // Library
  $('btn-lib-upload').addEventListener('click', function () { fileInput.click(); });
  function renderLibrary() {
    var list = $('library-list'); list.innerHTML = '';
    if (!state.materials.length) { list.appendChild(h('li', null, [h('span', { class: 'muted', style: 'padding:14px 4px', text: 'ยังไม่มีไฟล์ เพิ่มชีทหรือหนังสือเรียนเล่มแรกได้จากปุ่มด้านบน' })])); return; }
    state.materials.forEach(function (m) {
      var del = h('button', { class: 'del', type: 'button', text: 'ลบ' });
      del.addEventListener('click', async function () {
        if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.textContent = 'ยืนยันลบ'; setTimeout(function () { del.classList.remove('confirm'); del.textContent = 'ลบ'; }, 3500); return; }
        await DB.del('materials', m.id).catch(function () {});
        state.materials = state.materials.filter(function (x) { return x.id !== m.id; });
        state.session.materialIds = (state.session.materialIds || []).filter(function (x) { return x !== m.id; });
        refreshMaterialViews(m); renderLibrary(); queueSave();
      });
      list.appendChild(h('li', null, [
        h('button', { class: 'lib-open', type: 'button', onclick: function () {
          showView('chat'); activateMaterial(m.id); pushMaterialCard(m);
        } }, [h('span', { class: 't', text: m.name }), h('span', { class: 'm', text: kindLabel(m) + '  ' + fmtSize(m.size || 0) + '  ' + fmtDay(m.created) + (m.status === 'error' ? '  อ่านไม่ได้' : '') })]),
        del
      ]));
    });
  }

  // Review (spaced repetition)
  var reviewSession = null;
  async function dueCards() {
    var all = await DB.all('cards').catch(function () { return []; });
    var now = Date.now();
    return { all: all, due: all.filter(function (c) { return (c.due || 0) <= now; }).sort(function (a, b) { return (a.due || 0) - (b.due || 0); }) };
  }
  async function refreshDue() {
    var r = await dueCards();
    state.dueCount = r.due.length;
    var b = $('due-badge');
    b.hidden = !state.dueCount; b.textContent = state.dueCount > 99 ? '99+' : String(state.dueCount);
  }
  async function renderReview() {
    var root = $('review-root'); root.innerHTML = '';
    if (reviewSession) return renderReviewStage(root);
    var r = await dueCards();
    var decks = await DB.all('decks').catch(function () { return []; });
    decks.sort(function (a, b) { return b.created - a.created; });
    root.appendChild(h('h1', { class: 'page-title', text: 'ทบทวน' }));
    root.appendChild(h('p', { class: 'page-lead', text: 'บัตรคำทุกชุดที่ครูทำให้จะมาอยู่ที่นี่ ครูนัดทบทวนแต่ละใบตามจังหวะความจำ ใบที่จำได้แล้วจะเว้นนานขึ้น ใบที่ยังจำไม่ได้จะกลับมาเร็ว' }));
    var hero = h('div', { class: 'review-hero' });
    hero.appendChild(h('div', { class: 'review-count' }, [String(r.due.length), h('small', { text: 'ใบที่ต้องทบทวนวันนี้' })]));
    if (r.due.length) hero.appendChild(h('div', { class: 'row' }, [h('button', { class: 'primary', type: 'button', text: 'เริ่มทบทวน', onclick: function () { startReview(r.due.slice(0, 60)); } })]));
    else {
      var next = r.all.filter(function (c) { return c.due > Date.now(); }).sort(function (a, b) { return a.due - b.due; })[0];
      hero.appendChild(h('p', { class: 'muted', text: r.all.length ? 'ทบทวนครบแล้ว ใบถัดไปครบกำหนดในอีก ' + fmtInterval(next.due - Date.now()) : 'ยังไม่มีบัตรคำ ให้ครูทำบัตรคำจากไฟล์หรือเรื่องที่เรียนก่อน' }));
      if (!r.all.length) hero.appendChild(h('div', { class: 'row' }, [h('button', { class: 'textbtn strong', type: 'button', text: 'ให้ครูทำบัตรคำ', onclick: function () { showView('chat'); openTools(); } })]));
    }
    root.appendChild(hero);
    var quizMistakes = state.log.filter(function (x) { return x.type === 'quiz'; });
    root.appendChild(h('h2', { class: 'section-title', text: 'ฝึกข้อที่เคยผิด' }));
    root.appendChild(h('p', { class: 'muted', text: quizMistakes.length ? 'มีข้อที่เคยทำผิด ' + quizMistakes.length + ' ข้อ ครูจะออกข้อใหม่ที่ใช้แนวคิดเดียวกันแต่เปลี่ยนตัวเลขและสถานการณ์' : 'ยังไม่มีข้อที่เคยผิด ทำแนวข้อสอบก่อนแล้วครูจะจดจุดที่พลาดไว้ให้' }));
    if (quizMistakes.length) root.appendChild(h('div', { class: 'row' }, [h('button', { class: 'textbtn strong', type: 'button', text: 'ฝึกข้อที่เคยผิด 10 ข้อ', onclick: function () { runAction('quiz', { count: 10, level: 'exam', mistakes: true }); } })]));
    root.appendChild(h('h2', { class: 'section-title', text: 'ชุดบัตรคำ' }));
    if (!decks.length) { root.appendChild(h('p', { class: 'muted', text: 'ยังไม่มีชุดบัตรคำ' })); return; }
    var ul = h('ul', { class: 'deck-list' });
    decks.forEach(function (d) {
      var cards = r.all.filter(function (c) { return c.deckId === d.id; });
      var due = cards.filter(function (c) { return c.due <= Date.now(); });
      var learned = cards.filter(function (c) { return (c.interval || 0) >= 7; }).length;
      var del = h('button', { class: 'del', type: 'button', text: 'ลบ' });
      del.addEventListener('click', async function () {
        if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.textContent = 'ยืนยันลบ'; setTimeout(function () { del.classList.remove('confirm'); del.textContent = 'ลบ'; }, 3500); return; }
        for (var i = 0; i < cards.length; i++) await DB.del('cards', cards[i].id).catch(function () {});
        await DB.del('decks', d.id).catch(function () {});
        refreshDue(); renderReview();
      });
      ul.appendChild(h('li', null, [
        h('div', { class: 'grow' }, [h('span', { class: 't', text: d.title }), h('span', { class: 'm', text: cards.length + ' ใบ  จำได้ดีแล้ว ' + learned + ' ใบ  ครบกำหนด ' + due.length + ' ใบ' })]),
        h('button', { class: 'textbtn', type: 'button', text: due.length ? 'ทบทวน' : 'ฝึกทั้งชุด', onclick: function () { startReview(due.length ? due : shuffle(cards.slice())); } }),
        del
      ]));
    });
    root.appendChild(ul);
  }
  function startReview(cards) {
    if (!cards.length) return;
    reviewSession = { queue: cards.map(function (c) { return c.id; }), cards: cards, pos: 0, flipped: false, again: {}, done: 0, total: cards.length };
    renderReview();
  }
  function renderReviewStage(root) {
    var rs = reviewSession;
    var stage = h('div', { class: 'review-stage' });
    root.appendChild(stage);
    if (rs.pos >= rs.queue.length) {
      stage.appendChild(h('h1', { class: 'page-title', text: 'ทบทวนเสร็จแล้ว' }));
      stage.appendChild(h('p', { class: 'page-lead', text: 'ทบทวนไป ' + rs.total + ' ใบ ครูนัดรอบถัดไปของแต่ละใบไว้ให้แล้ว กลับมาอีกครั้งเมื่อมีตัวเลขขึ้นที่เมนูทบทวน' }));
      stage.appendChild(h('button', { class: 'primary', type: 'button', text: 'กลับหน้าทบทวน', onclick: function () { reviewSession = null; renderReview(); } }));
      return;
    }
    var id = rs.queue[rs.pos];
    var card = rs.cards.find(function (c) { return c.id === id; });
    stage.appendChild(h('div', { class: 'row', style: 'justify-content:space-between' }, [h('span', { class: 'muted', text: 'ใบที่ ' + (rs.pos + 1) + ' จาก ' + rs.queue.length }), h('button', { class: 'mini', type: 'button', text: 'จบการทบทวน', onclick: function () { reviewSession = null; renderReview(); } })]));
    stage.appendChild(h('div', { class: 'progressbar' }, [h('i', { style: 'width:' + Math.round(rs.pos / rs.queue.length * 100) + '%' })]));
    stage.appendChild(indexCard(card, rs.flipped, function () { rs.flipped = true; renderReview(); }));
    if (!rs.flipped) stage.appendChild(h('div', { class: 'grade' }, [h('button', { class: 'textbtn strong', type: 'button', text: 'ดูคำตอบ', onclick: function () { rs.flipped = true; renderReview(); } })]));
    else stage.appendChild(gradeButtons(card, async function (grade) {
      await reviewCard(card, grade);
      if (grade === 0 && !rs.again[id]) { rs.queue.push(id); rs.again[id] = true; }
      rs.pos++; rs.flipped = false;
      renderReview();
    }));
    typeset(stage);
  }

  // Progress
  async function renderStats() {
    var root = $('stats-root'); root.innerHTML = '';
    var acts = await DB.all('activity').catch(function () { return []; });
    var results = await DB.all('results').catch(function () { return []; });
    var r = await dueCards();
    var byDay = {}; acts.forEach(function (a) { byDay[a.date] = a; });
    var score = function (a) { return a ? (a.msgs || 0) + (a.quizQ || 0) + (a.cards || 0) : 0; };
    var streak = 0, d = new Date();
    if (!score(byDay[dayKey(d)])) d.setDate(d.getDate() - 1);
    while (score(byDay[dayKey(d)]) > 0) { streak++; d.setDate(d.getDate() - 1); }
    var totalQ = acts.reduce(function (s, a) { return s + (a.quizQ || 0); }, 0);
    var totalOk = acts.reduce(function (s, a) { return s + (a.quizOk || 0); }, 0);
    root.appendChild(h('h1', { class: 'page-title', text: 'ความก้าวหน้า' }));
    root.appendChild(h('p', { class: 'page-lead', text: 'สรุปจากการเรียน แบบทดสอบ และบัตรคำในเครื่องนี้' }));
    var grid = h('div', { class: 'statgrid' });
    [[streak + ' วัน', 'เรียนต่อเนื่อง'], [String(totalQ), 'ข้อที่ทำแล้ว'], [totalQ ? Math.round(totalOk / totalQ * 100) + '%' : '–', 'ตอบถูกโดยรวม'], [String(r.due.length), 'บัตรคำครบกำหนด']].forEach(function (x) { grid.appendChild(h('div', { class: 'stat' }, [h('b', { text: x[0] }), h('span', { text: x[1] })])); });
    root.appendChild(grid);

    root.appendChild(h('h2', { class: 'section-title', text: 'ความสม่ำเสมอ 12 สัปดาห์' }));
    var heat = h('div', { class: 'heat', role: 'img', 'aria-label': 'ปฏิทินการเรียนย้อนหลัง 12 สัปดาห์' });
    var start = new Date(); start.setDate(start.getDate() - 83 - start.getDay());
    var todayK = dayKey();
    for (var i = 0; i < 84 + new Date().getDay() + 1; i++) {
      var dd = new Date(start); dd.setDate(start.getDate() + i);
      var k = dayKey(dd); var v = score(byDay[k]);
      if (dd > new Date()) break;
      heat.appendChild(h('i', { class: (v >= 15 ? 'l3' : v >= 6 ? 'l2' : v > 0 ? 'l1' : '') + (k === todayK ? ' today' : ''), title: fmtDay(dd) + ': ' + v + ' กิจกรรม' }));
    }
    root.appendChild(heat);

    var subj = {};
    results.forEach(function (res) { Object.keys(res.bySubject || {}).forEach(function (s) { subj[s] = subj[s] || [0, 0]; subj[s][0] += res.bySubject[s][0]; subj[s][1] += res.bySubject[s][1]; }); });
    root.appendChild(h('h2', { class: 'section-title', text: 'ความแม่นยำรายวิชา' }));
    var keys = Object.keys(subj);
    if (!keys.length) root.appendChild(h('p', { class: 'muted', text: 'ยังไม่มีข้อมูล ทำแนวข้อสอบสักชุดแล้วกลับมาดูอีกครั้ง' }));
    else {
      var bars = h('div', { class: 'bars' });
      keys.sort(function (a, b) { return subj[a][0] / subj[a][1] - subj[b][0] / subj[b][1]; }).forEach(function (s) {
        var p = Math.round(subj[s][0] / subj[s][1] * 100);
        bars.appendChild(h('div', { class: 'bar' }, [h('span', { text: SUBJECT_LABEL[s] || s }), h('span', { class: 'track' }, [h('i', { style: 'width:' + p + '%' })]), h('span', { class: 'v', text: p + '% (' + subj[s][1] + ')' })]));
      });
      root.appendChild(bars);
    }

    var topics = {};
    state.log.filter(function (x) { return x.type === 'quiz' && x.topic; }).forEach(function (x) { topics[x.topic] = (topics[x.topic] || 0) + 1; });
    var top = Object.keys(topics).sort(function (a, b) { return topics[b] - topics[a]; }).slice(0, 6);
    root.appendChild(h('h2', { class: 'section-title', text: 'เรื่องที่ผิดบ่อย' }));
    if (!top.length) root.appendChild(h('p', { class: 'muted', text: 'ยังไม่มีเรื่องที่ผิดซ้ำ' }));
    else {
      var ul = h('ul', { class: 'weak-list' });
      top.forEach(function (t) { ul.appendChild(h('li', null, [h('span', { class: 'grow', text: t }), h('span', { class: 'muted', text: 'ผิด ' + topics[t] + ' ครั้ง' }), h('button', { class: 'textbtn', type: 'button', text: 'ฝึกเรื่องนี้', onclick: function () { runAction('quiz', { count: 8, level: 'exam', topic: t }); } })])); });
      root.appendChild(ul);
    }

    results.sort(function (a, b) { return b.date - a.date; });
    root.appendChild(h('h2', { class: 'section-title', text: 'แบบทดสอบล่าสุด' }));
    if (!results.length) root.appendChild(h('p', { class: 'muted', text: 'ยังไม่มี' }));
    else {
      var ul2 = h('ul', { class: 'weak-list' });
      results.slice(0, 10).forEach(function (res) { ul2.appendChild(h('li', null, [h('span', { class: 'grow', text: res.title }), h('span', { class: 'muted', text: res.score + '/' + res.total + '  ' + fmtDay(res.date) })])); });
      root.appendChild(ul2);
    }
  }

  // Settings
  function renderSettings() {
    var root = $('settings-root'); root.innerHTML = '';
    root.appendChild(h('h1', { class: 'page-title', text: 'ตั้งค่า' }));

    root.appendChild(h('h2', { class: 'section-title', text: 'Gemini API key' }));
    root.appendChild(h('p', { class: 'muted', html: 'สร้าง key ฟรีได้ที่ <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> key จะเก็บไว้ในเครื่องนี้เท่านั้น และส่งไปที่ Google ตอนถามครูเท่านั้น' }));
    var keyInput = h('input', { class: 'text', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'วาง API key ที่นี่', value: S.apiKey });
    var show = h('button', { class: 'textbtn', type: 'button', text: 'แสดง', onclick: function () { keyInput.type = keyInput.type === 'password' ? 'text' : 'password'; show.textContent = keyInput.type === 'password' ? 'แสดง' : 'ซ่อน'; } });
    var keyStatus = h('div', { class: 'muted' });
    var saveKey = h('button', { class: 'primary', type: 'button', text: 'บันทึกและตรวจสอบ', onclick: async function () {
      var k = keyInput.value.trim();
      if (!k) { S.apiKey = ''; saveSettings(); keyStatus.className = 'badline'; keyStatus.textContent = 'ลบ key แล้ว'; return; }
      saveKey.disabled = true; keyStatus.className = 'muted'; keyStatus.textContent = 'กำลังตรวจสอบ…';
      try {
        var models = await listModels(k);
        S.apiKey = k; S.models = models; saveSettings();
        keyStatus.className = 'okline'; keyStatus.textContent = 'ใช้ได้ พบโมเดลที่ใช้ได้ ' + models.length + ' รุ่น';
        renderModelSelect();
      } catch (e) { keyStatus.className = 'badline'; keyStatus.textContent = e.http ? errorCopy(e) : 'เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่'; }
      saveKey.disabled = false;
    } });
    root.appendChild(h('div', { class: 'keyrow' }, [keyInput, show]));
    root.appendChild(h('div', { class: 'row' }, [saveKey, keyStatus]));

    root.appendChild(h('h2', { class: 'section-title', text: 'โมเดล' }));
    var modelBox = h('div');
    root.appendChild(modelBox);
    function renderModelSelect() {
      modelBox.innerHTML = '';
      var list = (S.models && S.models.length ? S.models : FALLBACK_MODELS).slice();
      if (!list.some(function (m) { return m.id === S.model; })) list.unshift({ id: S.model, label: S.model });
      var sel = h('select', { class: 'text', 'aria-label': 'เลือกโมเดล' });
      list.forEach(function (m) { var op = h('option', { value: m.id, text: m.label }); if (m.id === S.model) op.selected = true; sel.appendChild(op); });
      sel.addEventListener('change', function () { S.model = sel.value; saveSettings(); showToast('เปลี่ยนเป็น ' + sel.value + ' แล้ว'); });
      modelBox.appendChild(sel);
      modelBox.appendChild(h('p', { class: 'muted', text: 'รุ่น Flash ใช้ฟรีได้ภายในโควตาต่อนาทีและต่อวัน รุ่น Pro ต้องเปิดใช้แบบเสียเงินใน Google AI Studio' }));
    }
    renderModelSelect();

    root.appendChild(h('h2', { class: 'section-title', text: 'ความลึกในการคิดตอนคุย' }));
    root.appendChild(h('p', { class: 'muted', text: 'คิดลึกแม่นกว่าแต่ตอบช้ากว่า การออกข้อสอบและบัตรคำใช้คิดลึกเสมอ' }));
    root.appendChild(segControl([{ label: 'เร็ว', value: 'low' }, { label: 'สมดุล', value: 'medium' }, { label: 'คิดลึก', value: 'high' }], S.thinking, function (v) { S.thinking = v; saveSettings(); }));

    root.appendChild(h('h2', { class: 'section-title', text: 'เครื่องมือของครู' }));
    root.appendChild(switchRow('ให้ครูรันโค้ดตรวจคำตอบ', 'ครูจะคำนวณด้วย Python จริงก่อนตอบ รันโค้ดที่สอน และวาดกราฟได้', S.codeExec, function (v) { S.codeExec = v; saveSettings(); }));
    root.appendChild(switchRow('ให้ครูค้นเว็บเมื่อจำเป็น', 'ใช้กับเรื่องที่เปลี่ยนตามเวลา เช่น ปฏิทิน TCAS ถ้าบัญชีของคุณค้นเว็บไม่ได้ ครูจะตอบโดยไม่ค้นเอง', S.search, function (v) { S.search = v; S.searchBlockedAt = 0; saveSettings(); }));

    root.appendChild(h('h2', { class: 'section-title', text: 'โปรไฟล์การเรียน' }));
    root.appendChild(h('p', { class: 'muted', text: 'ครูอ่านโปรไฟล์นี้ทุกครั้งที่ตอบ และเขียนให้ใหม่เมื่อคุณกด "สรุปวันนี้"' }));
    var prof = h('textarea', { class: 'text', spellcheck: 'false' });
    prof.value = state.profile.text || PROFILE_TEMPLATE;
    var profStatus = h('span', { class: 'muted', text: state.profile.updatedAt ? 'อัปเดตล่าสุด ' + fmtDate(state.profile.updatedAt) : '' });
    root.appendChild(prof);
    root.appendChild(h('div', { class: 'row' }, [h('button', { class: 'primary', type: 'button', text: 'บันทึกโปรไฟล์', onclick: async function () {
      var t = prof.value.trim();
      state.profile = { text: t === PROFILE_TEMPLATE.trim() ? '' : t, updatedAt: Date.now() };
      await kvSet('profile', state.profile);
      profStatus.textContent = 'บันทึกแล้ว ' + fmtDate(state.profile.updatedAt);
    } }), profStatus]));
    var q = state.log.filter(function (x) { return x.type === 'quiz'; }).length, c = state.log.filter(function (x) { return x.type === 'card'; }).length;
    root.appendChild(h('p', { class: 'muted', text: 'ข้อที่เคยผิด ' + q + ' ข้อ บัตรคำที่ยังจำไม่ได้ ' + c + ' ใบ (ครูใช้ตอน "ทบทวน" และ "วิเคราะห์จุดอ่อน")' }));
    if (state.log.length) root.appendChild(h('button', { class: 'textbtn', type: 'button', text: 'ล้างประวัติข้อที่ผิด', onclick: function () {
      var prev = state.log.slice(); state.log = []; saveLog(); renderSettings();
      showToast('ล้างประวัติข้อที่ผิดแล้ว', 'ย้อนกลับ', function () { state.log = prev; saveLog(); renderSettings(); });
    } }));

    root.appendChild(h('h2', { class: 'section-title', text: 'ธีม' }));
    root.appendChild(segControl([{ label: 'ตามระบบ', value: 'system' }, { label: 'สว่าง', value: 'light' }, { label: 'มืด', value: 'dark' }], S.theme, function (v) { S.theme = v; saveSettings(); applyTheme(); }));

    root.appendChild(h('h2', { class: 'section-title', text: 'สำรองและย้ายข้อมูล' }));
    root.appendChild(h('p', { class: 'muted', text: 'ข้อมูลทั้งหมดอยู่ในเครื่องนี้ ถ้าจะย้ายไปมือถือหรือคอมอีกเครื่อง ให้สำรองเป็นไฟล์แล้วนำเข้าที่เครื่องนั้น (API key ไม่ถูกรวมในไฟล์)' }));
    var withFiles = h('input', { type: 'checkbox' });
    root.appendChild(h('label', { class: 'switch' }, [withFiles, h('span', null, [h('span', { class: 't', text: 'รวมไฟล์เอกสารด้วย' }), h('span', { class: 'd', text: 'ไฟล์สำรองจะใหญ่ขึ้นตามขนาดเอกสาร' })])]));
    var importInput = h('input', { type: 'file', accept: 'application/json,.json', hidden: true });
    importInput.addEventListener('change', function () { var f = importInput.files && importInput.files[0]; importInput.value = ''; if (f) importBackup(f); });
    root.appendChild(importInput);
    root.appendChild(h('p', { class: 'muted', text: 'สำรองล่าสุด: ' + (S.lastBackupAt ? fmtDate(S.lastBackupAt) : 'ยังไม่เคย') + (S.persisted === false ? ' — เบราว์เซอร์ยังไม่รับประกันว่าจะเก็บข้อมูลไว้ถาวร ควรสำรองบ่อยๆ' : '') }));
    var canShare = navigator.canShare && navigator.canShare({ files: [new File(['{}'], 'a.json', { type: 'application/json' })] });
    root.appendChild(h('div', { class: 'row' }, [
      h('button', { class: 'primary', type: 'button', text: 'สำรองข้อมูลเป็นไฟล์', onclick: function () { exportBackup(withFiles.checked); } }),
      canShare ? h('button', { class: 'textbtn', type: 'button', text: 'แชร์ไฟล์สำรอง (Drive, LINE)', onclick: function () { exportBackup(withFiles.checked, true); } }) : null,
      h('button', { class: 'textbtn', type: 'button', text: 'นำเข้าไฟล์สำรอง', onclick: function () { importInput.click(); } })
    ]));

    root.appendChild(h('h2', { class: 'section-title', text: 'ความเป็นส่วนตัว' }));
    root.appendChild(h('p', { class: 'muted', text: 'ถ้าใช้ API key แบบฟรี Google อาจนำข้อความและไฟล์ที่ส่งไปใช้ปรับปรุงบริการ จึงไม่ควรส่งข้อมูลส่วนตัวที่อ่อนไหว เช่น เลขบัตรประชาชน' }));
    var wipe = h('button', { class: 'textbtn danger', type: 'button', text: 'ลบข้อมูลทั้งหมดในเครื่องนี้' });
    wipe.addEventListener('click', async function () {
      if (!wipe.classList.contains('confirm')) { wipe.classList.add('confirm'); wipe.textContent = 'กดอีกครั้งเพื่อยืนยันการลบทั้งหมด'; setTimeout(function () { wipe.classList.remove('confirm'); wipe.textContent = 'ลบข้อมูลทั้งหมดในเครื่องนี้'; }, 4000); return; }
      for (var i = 0; i < STORES.length; i++) await DB.clear(STORES[i]).catch(function () {});
      try { localStorage.removeItem(SETTINGS_KEY); } catch (e) {}
      location.reload();
    });
    root.appendChild(wipe);
    root.appendChild(h('p', { class: 'muted', style: 'margin-top:24px', text: 'ห้องติว เวอร์ชัน ' + VERSION }));
  }
  function segControl(options, current, onPick) {
    var seg = h('div', { class: 'seg' });
    options.forEach(function (op) {
      seg.appendChild(h('button', { type: 'button', text: op.label, 'aria-pressed': String(op.value === current), onclick: function () {
        onPick(op.value);
        seg.querySelectorAll('button').forEach(function (b, i) { b.setAttribute('aria-pressed', String(options[i].value === op.value)); });
      } }));
    });
    return seg;
  }
  function switchRow(title, desc, value, onChange) {
    var cb = h('input', { type: 'checkbox' }); cb.checked = !!value;
    cb.addEventListener('change', function () { onChange(cb.checked); });
    return h('label', { class: 'switch' }, [cb, h('span', null, [h('span', { class: 't', text: title }), h('span', { class: 'd', text: desc })])]);
  }
  function applyTheme() { var r = document.documentElement; if (S.theme === 'light' || S.theme === 'dark') r.setAttribute('data-theme', S.theme); else r.removeAttribute('data-theme'); }

  // Backup
  async function exportBackup(withFiles, share) {
    var out = { app: 'hongtiew', version: 2, exportedAt: Date.now(), settings: { model: S.model, thinking: S.thinking, codeExec: S.codeExec, search: S.search, theme: S.theme }, profile: state.profile, log: state.log };
    for (var i = 0; i < STORES.length; i++) {
      var s = STORES[i];
      if (s === 'kv') continue;
      var rows = await DB.all(s).catch(function () { return []; });
      if (s === 'materials') {
        rows = await Promise.all(rows.map(async function (m) {
          var o = Object.assign({}, m); delete o.file;
          if (o.blob) { if (withFiles) o.blob64 = await blobToBase64(o.blob); delete o.blob; }
          return o;
        }));
      }
      out[s] = rows;
    }
    var name = 'hongtiew-backup-' + dayKey() + '.json';
    var blob = new Blob([JSON.stringify(out)], { type: 'application/json' });
    if (share) {
      try { await navigator.share({ files: [new File([blob], name, { type: 'application/json' })] }); }
      catch (e) { if (e && e.name === 'AbortError') return; share = false; }
    }
    if (!share) {
      var a = h('a', { href: URL.createObjectURL(blob), download: name });
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function () { URL.revokeObjectURL(a.href); }, 5000);
    }
    S.lastBackupAt = Date.now(); saveSettings();
    showToast('สร้างไฟล์สำรองแล้ว');
    if (state.view === 'settings') renderSettings();
  }
  async function importBackup(file) {
    try {
      var data = JSON.parse(await file.text());
      if (data.app !== 'hongtiew') throw new Error('not a backup');
      for (var i = 0; i < STORES.length; i++) {
        var s = STORES[i];
        if (!Array.isArray(data[s])) continue;
        var rows = data[s].map(function (r) {
          if (s === 'materials') {
            var o = Object.assign({}, r);
            if (o.blob64) { var bin = atob(o.blob64), arr = new Uint8Array(bin.length); for (var j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j); o.blob = new Blob([arr], { type: o.mime }); delete o.blob64; }
            return o;
          }
          return r;
        });
        if (rows.length) await DB.putMany(s, rows);
      }
      if (data.profile && typeof data.profile.text === 'string') { state.profile = data.profile; await kvSet('profile', data.profile); }
      if (Array.isArray(data.log)) { state.log = data.log; await saveLog(); }
      if (data.settings) { ['model', 'thinking', 'codeExec', 'search', 'theme'].forEach(function (k) { if (data.settings[k] !== undefined) S[k] = data.settings[k]; }); saveSettings(); }
      showToast('นำเข้าข้อมูลแล้ว กำลังโหลดใหม่…');
      setTimeout(function () { location.reload(); }, 900);
    } catch (e) { showToast('ไฟล์นี้ไม่ใช่ไฟล์สำรองของห้องติว'); }
  }

  // ---------- drawers ----------
  function openDrawer(id) { var d = $(id); d.classList.add('open'); d.setAttribute('aria-hidden', 'false'); var f = d.querySelector('.hbtn[data-close]'); if (f) f.focus(); }
  function closeDrawer(d) { d.classList.remove('open'); d.setAttribute('aria-hidden', 'true'); }
  function closeAllDrawers() { document.querySelectorAll('.drawer.open').forEach(closeDrawer); }
  document.querySelectorAll('.drawer').forEach(function (d) { d.querySelectorAll('[data-close]').forEach(function (c) { c.addEventListener('click', function () { closeDrawer(d); }); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeAllDrawers(); });

  $('btn-new').addEventListener('click', function () {
    if (state.busy && state.ctl) state.ctl.abort();
    state.session = freshSession(); state.pendingImages = [];
    renderThumbs(); renderMatChips(); renderSubjects(); updateTitle(); renderAll(); updateComposer(); input.focus();
  });
  $('btn-history').addEventListener('click', function () { openDrawer('drawer-history'); loadHistory(); });
  async function loadHistory() {
    var list = $('history-list'); list.innerHTML = '';
    var items = await DB.all('sessions').catch(function () { return []; });
    items.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    if (!items.length) { list.appendChild(h('li', null, [h('span', { class: 'muted', style: 'padding:12px 4px', text: 'ยังไม่มีบทเรียนที่บันทึกไว้' })])); return; }
    items.slice(0, 80).forEach(function (it) {
      var del = h('button', { class: 'del', type: 'button', text: 'ลบ' });
      var li;
      del.addEventListener('click', async function () {
        if (!del.classList.contains('confirm')) { del.classList.add('confirm'); del.textContent = 'ยืนยันลบ'; setTimeout(function () { del.classList.remove('confirm'); del.textContent = 'ลบ'; }, 3500); return; }
        await DB.del('sessions', it.id).catch(function () {});
        li.remove();
        if (state.session.id === it.id) { state.session = freshSession(); renderMatChips(); updateTitle(); renderAll(); }
      });
      li = h('li', { class: it.id === state.session.id ? 'current' : '' }, [
        h('button', { class: 'open', type: 'button', onclick: function () { openSession(it); closeDrawer($('drawer-history')); } }, [h('span', { class: 't', text: it.title || 'บทเรียน' }), h('span', { class: 'm', text: (SUBJECT_LABEL[it.subject] ? SUBJECT_LABEL[it.subject] + '  ' : '') + fmtDate(it.updatedAt) })]),
        del
      ]);
      list.appendChild(li);
    });
  }
  function openSession(it) {
    if (state.busy && state.ctl) state.ctl.abort();
    state.session = { id: it.id, title: it.title || '', subject: it.subject || 'all', updatedAt: it.updatedAt || Date.now(), messages: (it.messages || []).map(function (m) { return JSON.parse(JSON.stringify(m)); }), materialIds: (it.materialIds || []).filter(function (id) { return !!getMaterial(id); }) };
    renderSubjects(); renderMatChips(); updateTitle(); renderAll(); updateComposer();
    if (state.view !== 'chat') showView('chat');
  }

  // Study tools drawer
  function openTools() { renderToolsDrawer(); openDrawer('drawer-tools'); }
  function renderToolsDrawer() {
    var target = $('tb-target'); target.innerHTML = '';
    var mats = activeMaterials();
    if (mats.length) { target.appendChild(document.createTextNode('ใช้กับไฟล์: ')); target.appendChild(h('b', { text: mats.map(function (m) { return m.name; }).join(', ') })); }
    else { target.appendChild(document.createTextNode('ยังไม่ได้แนบไฟล์ ครูจะใช้หัวข้อที่พิมพ์ด้านล่าง หรือเรื่องที่คุยอยู่ ')); target.appendChild(h('button', { class: 'linkbtn', type: 'button', text: 'แนบไฟล์', onclick: function () { fileInput.click(); } })); }
    var list = $('tb-list'); list.innerHTML = '';
    var topicVal = function () { var v = $('tb-topic').value.trim(); $('tb-topic').value = ''; return v; };
    ACTIONS.forEach(function (a) {
      var li = h('li');
      if (a.id === 'quiz') {
        var box = h('div', { class: 'tb-static' }, [h('span', { class: 't', text: a.label }), h('span', { class: 'd', text: a.desc })]);
        var opts = h('div', { class: 'tb-opts' });
        opts.appendChild(segControl([{ label: '5 ข้อ', value: 5 }, { label: '10 ข้อ', value: 10 }, { label: '20 ข้อ', value: 20 }], S.tb.count, function (v) { S.tb.count = v; saveSettings(); }));
        opts.appendChild(segControl(Object.keys(LEVELS).map(function (k) { return { label: LEVELS[k].label, value: k }; }), S.tb.level, function (v) { S.tb.level = v; saveSettings(); }));
        var timed = h('input', { type: 'checkbox' }); timed.checked = !!S.tb.timed;
        timed.addEventListener('change', function () { S.tb.timed = timed.checked; saveSettings(); });
        opts.appendChild(h('label', null, [timed, 'จับเวลาเหมือนสอบจริง (ข้อละ 2 นาที)']));
        opts.appendChild(h('button', { class: 'textbtn strong', type: 'button', text: 'สร้างข้อสอบ', onclick: function () { runAction('quiz', { count: S.tb.count, level: S.tb.level, timed: S.tb.timed, topic: topicVal() }); } }));
        box.appendChild(opts); li.appendChild(box);
      } else if (a.id === 'cards') {
        var box2 = h('div', { class: 'tb-static' }, [h('span', { class: 't', text: a.label }), h('span', { class: 'd', text: a.desc })]);
        var opts2 = h('div', { class: 'tb-opts' });
        opts2.appendChild(segControl([{ label: '10 ใบ', value: 10 }, { label: '15 ใบ', value: 15 }, { label: '25 ใบ', value: 25 }], S.tb.cards, function (v) { S.tb.cards = v; saveSettings(); }));
        opts2.appendChild(h('button', { class: 'textbtn strong', type: 'button', text: 'สร้างบัตรคำ', onclick: function () { runAction('cards', { cardCount: S.tb.cards, topic: topicVal() }); } }));
        box2.appendChild(opts2); li.appendChild(box2);
      } else {
        li.appendChild(h('button', { class: 'tb-row', type: 'button', onclick: function () { runAction(a.id, { topic: topicVal() }); } }, [h('span', { class: 't', text: a.label }), h('span', { class: 'd', text: a.desc })]));
      }
      list.appendChild(li);
    });
  }

  // ---------- toast ----------
  var toastTimer = null;
  function showToast(text, actionLabel, action) {
    var t = $('toast'); $('toast-text').textContent = text;
    var btn = $('toast-action');
    if (actionLabel) { btn.textContent = actionLabel; btn.hidden = false; btn.onclick = function () { t.hidden = true; action(); }; }
    else { btn.hidden = true; btn.onclick = null; }
    t.hidden = false; clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, actionLabel ? 8000 : 4500);
  }

  // ---------- onboarding ----------
  function renderOnboarding() {
    var ob = $('onboard'); ob.innerHTML = ''; ob.hidden = false;
    var inner = h('div', { class: 'ob-inner' });
    inner.appendChild(h('h1', { class: 'ob-title', html: 'ห้องติว<br><mark>ครูส่วนตัว</mark> ที่อยู่ในมือถือ' }));
    inner.appendChild(h('p', { class: 'page-lead', text: 'สอนคณิต ฟิสิกส์ เคมี ชีวะ และ Python อ่านชีทให้ ออกข้อสอบ ทำบัตรคำ และจำจุดอ่อนของคุณ ใช้สมองของ Gemini ผ่าน API key ของคุณเอง' }));
    var s1 = h('div', { class: 'ob-step' }, [h('h2', { text: 'ขั้นที่ 1 รับ API key ฟรี' }), h('ol', null, [
      h('li', { html: 'เปิด <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> แล้วล็อกอินด้วยบัญชี Google' }),
      h('li', { text: 'กด Create API key แล้วคัดลอก key ที่ได้' }),
      h('li', { text: 'กลับมาวางในช่องด้านล่าง' })
    ])]);
    inner.appendChild(s1);
    var keyIn = h('input', { class: 'text', type: 'password', autocomplete: 'off', spellcheck: 'false', placeholder: 'วาง API key ที่นี่' });
    var st = h('div', { class: 'muted', style: 'margin-top:6px' });
    var go = h('button', { class: 'primary', type: 'button', text: 'ตรวจสอบ key' });
    var s2 = h('div', { class: 'ob-step' }, [h('h2', { text: 'ขั้นที่ 2 วาง key' }), keyIn, h('div', { class: 'row' }, [go]), st]);
    inner.appendChild(s2);
    var s3 = h('div', { class: 'ob-step', hidden: true });
    inner.appendChild(s3);
    go.addEventListener('click', async function () {
      var k = keyIn.value.trim();
      if (!k) { st.className = 'badline'; st.textContent = 'ยังไม่ได้วาง key'; return; }
      go.disabled = true; st.className = 'muted'; st.textContent = 'กำลังตรวจสอบ…';
      try {
        var models = await listModels(k);
        S.apiKey = k; S.models = models;
        if (models.length && !models.some(function (m) { return m.id === S.model; })) S.model = models[0].id;
        saveSettings();
        st.className = 'okline'; st.textContent = 'ใช้ได้แล้ว';
        s3.hidden = false; renderProfileStep(s3);
      } catch (e) { st.className = 'badline'; st.textContent = e.http ? errorCopy(e) : 'เชื่อมต่อไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่'; }
      go.disabled = false;
    });
    inner.appendChild(h('p', { class: 'muted', text: 'key เก็บไว้ในเครื่องนี้เท่านั้น ถ้าใช้ key แบบฟรี Google อาจนำข้อความที่ส่งไปใช้ปรับปรุงบริการ อย่าส่งข้อมูลส่วนตัวที่อ่อนไหว' }));
    ob.appendChild(inner);
  }
  function renderProfileStep(box) {
    box.innerHTML = '';
    box.appendChild(h('h2', { text: 'ขั้นที่ 3 เล่าให้ครูรู้จักหน่อย (ข้ามได้)' }));
    var grade = { v: '' };
    box.appendChild(h('div', { class: 'field' }, [h('label', { text: 'ระดับชั้น' }), segControl([{ label: 'ม.4', value: 'ม.4' }, { label: 'ม.5', value: 'ม.5' }, { label: 'ม.6', value: 'ม.6' }, { label: 'อื่นๆ', value: 'other' }], '', function (v) { grade.v = v; })]));
    var goal = h('input', { class: 'text', type: 'text', placeholder: 'เช่น วิศวะจุฬา, แพทย์, หรือยังไม่แน่ใจ' });
    box.appendChild(h('div', { class: 'field' }, [h('label', { text: 'เป้าหมาย' }), goal]));
    var weak = h('input', { class: 'text', type: 'text', placeholder: 'เช่น ฟิสิกส์ไฟฟ้า, เคมีสมดุล' });
    box.appendChild(h('div', { class: 'field' }, [h('label', { text: 'เรื่องที่รู้สึกว่ายังไม่แม่น' }), weak]));
    box.appendChild(h('div', { class: 'row' }, [h('button', { class: 'primary', type: 'button', text: 'เริ่มเรียน', onclick: async function () {
      if (grade.v || goal.value.trim() || weak.value.trim()) {
        var t = ['- Current goals: ' + (grade.v && grade.v !== 'other' ? 'นักเรียน ' + grade.v + ' ' : '') + (goal.value.trim() ? 'เป้าหมาย ' + goal.value.trim() : ''),
          '- Strong topics (by subject): ',
          '- Weak topics (by subject, with specific examples of mistakes): ' + weak.value.trim(),
          '- Recurring mistakes to watch for: ', '- Suggested next topics to study: ', '- Python skill level and next project idea: '].join('\n');
        state.profile = { text: t, updatedAt: Date.now() }; await kvSet('profile', state.profile);
      }
      S.onboarded = true; saveSettings();
      $('onboard').hidden = true; input.focus();
    } })]));
  }

  // ---------- init ----------
  applyTheme();
  renderSubjects(); renderQuick(); renderMatChips(); updateTitle(); renderAll(); updateComposer();
  showView('chat');
  if (!S.apiKey) renderOnboarding();

  (async function init() {
    await DB.ready;
    state.profile = await kvGet('profile', { text: '', updatedAt: 0 });
    state.log = await kvGet('log', []);
    var mats = await DB.all('materials').catch(function () { return []; });
    state.materials = mats.sort(function (a, b) { return b.created - a.created; }).map(function (m) { return Object.assign(m, { status: 'ready' }); });
    var sessions = await DB.all('sessions').catch(function () { return []; });
    sessions.sort(function (a, b) { return (b.updatedAt || 0) - (a.updatedAt || 0); });
    if (sessions[0] && !state.session.messages.length && Date.now() - (sessions[0].updatedAt || 0) < 18 * 3600e3) openSession(sessions[0]);
    refreshDue();
    if (navigator.storage && navigator.storage.persist) { S.persisted = await navigator.storage.persist().catch(function () { return undefined; }); saveSettings(); }
    var lastSafe = S.lastBackupAt || (sessions.length ? sessions[sessions.length - 1].updatedAt : Date.now());
    if (Date.now() - lastSafe > (S.persisted === false ? 3 : 7) * DAY && Date.now() - (S.backupNudgeAt || 0) > DAY) {
      S.backupNudgeAt = Date.now(); saveSettings();
      showToast('ยังไม่ได้สำรองข้อมูลมาสักพักแล้ว', 'สำรองเลย', function () { showView('settings'); });
    }
  })();

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
})();
