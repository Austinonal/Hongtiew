const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const read = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');
const source = read('app.js');

// The static app is one browser closure. Exercise its actual functions with small browser fixtures.
function fixture(names, globals) {
  const ctx = vm.createContext(globals);
  for (const name of names) {
    const pattern = new RegExp('^  (?:async )?function ' + name + '\\([^\\n]+(?:\\n[\\s\\S]*?^  \\})?$', 'm');
    const match = source.match(pattern);
    assert.ok(match, name);
    vm.runInContext(match[0], ctx);
  }
  return ctx;
}

test('new tutor, default tutor and legacy replies retain distinct identities', () => {
  const TUTOR_PROMPT = read('index.html').match(/id="tutor-prompt"[^>]*>([\s\S]*?)<\/script>/)[1];
  const ctx = fixture(['tutorBase', 'turnText'], { TUTOR_PROMPT, str: String, femaleFix: String, CHS: { list: { p: { name: 'พี่สาว' } } } });
  assert.match(ctx.tutorBase(true), /## Persona:/);
  assert.doesNotMatch(ctx.tutorBase(false), /big-sister tutor|## Persona:/);
  assert.match(ctx.turnText({ role: 'assistant', content: 'คำตอบเดิม' }, false, { ch: 'h' }), /พี่สาว.*answered earlier/);
});

test('history retains the opening task, relevant older question and full latest message', async () => {
  const messages = [{ role: 'user', content: 'เป้าหมายตั้งต้น' }, { role: 'user', content: 'โจทย์เดิมเรื่อง capacitor' }];
  for (let i = 0; i < 24; i++) messages.push({ role: i % 2 ? 'assistant' : 'user', content: 'x'.repeat(400) });
  messages.push({ role: 'user', content: 'ทบทวน capacitor' });
  const ctx = fixture(['makeContentsBuilder'], { state: { session: { messages } }, S: { hist: 'mid' }, HISTORY_CHARS: { mid: 3000 }, HISTORY_FULL_TURNS: 4, HISTORY_IMAGE_MSGS: 2, OLD_USER_CHARS: 90, OLD_BOT_CHARS: 100, str: String, clip: (s,n) => s.length > n ? s.slice(0,n) + '…' : s, turnText: m => m.content });
  const contents = await ctx.makeContentsBuilder({})({});
  const parts = contents.flatMap(item => item.parts.map(p => p.text));
  assert.match(parts[0], /เป้าหมายตั้งต้น/);
  assert.match(parts[0], /โจทย์เดิมเรื่อง capacitor/);
  assert.equal(parts.at(-1), messages.at(-1).content);
  assert.ok(parts.join('').length <= 3000);
});

test('Gemini model discovery follows page tokens and excludes audio models', async () => {
  const urls = [];
  const ctx = fixture(['listModels'], { API: 'https://example.invalid', URLSearchParams, str: String, rankModel: () => 0, fetch: async url => {
    urls.push(url);
    const name = urls.length === 1 ? 'gemini-native-audio' : 'gemini-test';
    return { ok: true, json: async () => ({ models: [{ name: 'models/' + name, supportedGenerationMethods: ['generateContent'] }], nextPageToken: urls.length === 1 ? 'a+b' : '' }) };
  } });
  assert.deepEqual(Array.from(await ctx.listModels('test'), m => m.id), ['gemini-test']);
  assert.equal(new URL(urls[1]).searchParams.get('pageToken'), 'a+b');
});
