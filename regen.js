/* 声部功能识别 · 第二个分区：重生成结果的对比试听。无依赖，全部在浏览器里跑。
   数据：GET /api/regen/index、/api/regen/session?id=，POST /api/regen/refresh、/api/regen/review?id=&run=&take=，音频 /raudio/<路径>
   画法：一条音频一行，画它的音量起伏。原轨休止的地方画浅色竖带；原轨休止而重生成的轨在响的地方，波形画成斜纹。
   所有轨的波形用同一把尺，所以画出来的高矮就是真实的响度关系。
   颜色沿用标注页那一套（已用 dataviz 的脚本校验过），这里没有新增颜色。界面文字全部在 STR 里，中英两套。 */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 存不了就算了 */ } } };
  const fmt = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
  const pct = (v) => (v == null ? '–' : `${Math.round(v * 100)}%`);
  const num = (v) => (v == null ? '–' : (v < 0 ? '−' : '') + Math.abs(v).toFixed(2));

  // ------------------------------------------------------------------ 文字（中英两套）
  const STR = {
    zh: {
      docTitle: '重生成结果 · 声部功能识别', secAria: '分区', secLabels: '标注核对', secRegen: '重生成结果',
      kicker: 'Regeneration review', heroTitle: '<span class="ln"><b>重生成</b></span><span class="ln"><b><em>结果</em></b></span>',
      lede: '原曲、原来的分轨和每一条重生成的结果摆在一起听。它们是严格对齐的，切换的时候不会错位。点开一首，选一条目标轨，就可以在原轨和各个版本之间来回切。',
      how: [['空格', '播放 / 暂停'], ['1–9', '听第几个版本'], ['0', '听原轨'], ['Tab', '原轨和这一条来回切'], ['C', '带不带上下文']],
      refresh: '刷新', refreshing: '正在整理…', refreshTip: '把新放进来的结果整理进页面（本机跑完的、云端取回的都一样）',
      refreshed: '整理好了', refreshFail: (m) => `没整理成：${m}`, builtAt: (t) => `上次整理 ${t}`,
      empty: '还没有结果。把一次运行的输出放进 experiments/regen_gap/xl_real/outputs/<运行名>/ 以后，点右上角的“刷新”。',
      foot: '演示版　·　只放了 Suno 分轨的第一首（放克）　·　听感标记可以点，但不会保存',
      kind: { real: '真实多轨', suno: 'Suno 分轨', selfgen: '模型自己生成', clip: '60 秒片段' },
      kindNote: { real: '真实录音的原生分轨当上下文', suno: 'Suno 导出的分轨当上下文', selfgen: '模型自己生成整曲、自己拆、再自己补', clip: '试脚本用的短片段' },
      model: { small: '小号模型', large: '大号模型' }, where: { local: '本机', cloud: '云端' },
      nTakes: (n) => `${n} 条`, allOk: '全部正常', nBad: (n) => `${n} 条异常`, stopsShort: (p) => `原轨停处它也停 ${p}`,
      cells: (n, u) => `${n} ${u === 'beat' ? '拍' : '格（每半秒）'}`, regenOf: (s) => `补：${s}`,
      back: '← 全部结果', pickHead: '看哪一条目标轨', extractTab: '拆轨', partsTab: '它拆出来的各轨',
      loading: '加载中…', noSession: '演示版里没有这首歌的结果',
      ctx: '上下文', ctxSub: '其余各轨相加', ctxSubX: '其余各轨（模型拆出来的）相加', mix: '整曲', mixSub: '原曲', mixSubGen: '模型生成的整曲',
      orig: (s) => `原轨 · ${s}`, origExtracted: (s) => `被替换的那条 · ${s}`, origSubC: '按你改过的标注上色', origSubA: '按自动标注上色', origSubX: '模型自己拆出来的', origSubN: '',
      take: (n) => `版本 ${n}`, extracted: '拆出来的', tagAlias: (s) => `以${s}的名义`, tagMeta: '告诉了速度和调', tagUi: '官方界面的设置', tagX: '上下文是拆出来的轨',
      runName: (m, w) => `${m} · ${w}`,
      cardCtx: '除了目标轨以外的全部分轨加在一起。模型补轨时听到的就是它。', cardMix: '全部分轨加在一起。',
      cardStem: '原来的一条分轨。点它就单独听这一条。', cardOrig: (p) => `这是参照。它有 ${p} 的拍在休止。`,
      cardOrigX: '这条不是真的原轨，是模型自己从整曲里拆出来的那一条；重生成的轨是来顶替它的。',
      descPlain: '只告诉了模型乐器和风格。', descAlias: (s) => `乐器和风格照旧，只是告诉模型这是一条“${s}”轨。`,
      descMeta: '另外告诉了模型这首歌的速度、调和拍号（现在用的是没核对过的值）。', descUi: '内容照旧，换成官方界面的那套默认设置。',
      descX: '上下文换成了模型自己拆出来的各轨，不是真轨。和同一个版本号的普通版本对比着听。',
      descExtract: '模型从整曲里按轨名拆出来的。和它上面的原轨对比着听。',
      rKey: '调', rBeat: '拍', rStop: '原轨停处它也停', rSim: '像原轨',
      capKey: (lo, up) => `○ 移高半音 ${lo}　| 原轨 ${up}`, capBeat: (lo, up) => `○ 错后四分之一拍 ${lo}　| 原轨 ${up}`,
      capStop: (s) => `0% 从头响到尾　○ 随便停 ${s}　| 原轨 100%`, capSim: (b) => `○ 什么都不做时 ${b}`,
      broken: '这把尺子在这条轨上不灵，不下结论', noScore: '还没算',
      activeLine: (a, o) => `有声的拍 ${a}` + (o ? `（原轨 ${o}）` : ''), louder: (d) => (d >= 0 ? `比原轨响 ${d.toFixed(1)} dB` : `比原轨轻 ${(-d).toFixed(1)} dB`),
      tookSecs: (s) => `生成用时 ${s} 秒`, gate: (g) => `能不能当上下文：${g}`, normal: '检查正常',
      flag: { '模型内部缩小过音量': '模型内部缩小过音量（这里已按原本的音量放）', '无声': '无声', '像噪声': '像噪声', '局部像噪声': '局部像噪声', '削波': '削波', '直流偏移': '直流偏移', '输出几乎等于输入': '输出几乎等于输入' },
      markHead: '你听下来', mOk: '正常', mDoubt: '存疑', mBad: '有问题', notePh: '这一条听下来怎么样，比如“副歌该停没停”“像是另一件乐器”',
      saved: (t) => '演示版，不会保存', saveFail: (m) => `没存上：${m}`, pickTake: '选一个版本以后可以在这里记下听感',
      legendHead: '怎么看', legendRest: '浅色竖带：原轨在休止', legendViol: '斜纹：原轨休止，而它在响',
      fn: ['休止', '主旋律', '叠奏', '副旋律', '和弦伴奏', '音型伴奏'], fnAcc: '伴奏', level1: '一级', level2: '二级',
      levelTip: '标注的两级目标。一级：六类功能都分开。二级：音型伴奏并进和弦伴奏，合成一个“伴奏”。只改怎么看，存下来的始终是六类',
      keysHead: '键盘', keys: [['空格', '播放 / 暂停'], ['0', '原轨'], ['1–9', '第几个版本'], ['↑ ↓', '上一条 / 下一条'], ['Tab', '原轨和这一条来回切'], ['C', '带不带上下文'], ['← →', '前后 4 拍（按住 Shift 是 16 拍）'], ['P N', '上一处 / 下一处原轨休止'], ['L', '循环这一处休止'], ['Esc', '取消循环'], ['F', '画面跟不跟着播放线走']],
      playAria: '播放或暂停', tlAria: '时间线：点一下跳到那里，并且听那一行', zoomAria: '放大缩小',
      listenWith: (a, b) => `在听：<b>${a}</b> ＋ <b>${b}</b>`, listenSolo: (a) => `只听：<b>${a}</b>`,
      ctxBtn: '带上下文', ctxTip: '听的时候带不带其余各轨（C）', abBtn: '原轨 ⇄ 这条', abTip: '在原轨和你刚才听的那个版本之间来回切（Tab）',
      prevRest: '← 休止', nextRest: '休止 →', prevRestTip: '跳到上一处原轨休止之前（P）', nextRestTip: '跳到下一处原轨休止之前（N）',
      loopBtn: '循环', loopTip: '把离播放线最近的一处原轨休止前后各留 4 拍，循环着听（L）',
      retBtn: '停止回起点',
      retTip: '开着：按空格停下时，播放线回到这一次开始播放的地方（或你刚点过的地方），再按空格从同一处重放，换一个版本也从同一处听。关着：停在哪里，就从哪里接着放。按住 Shift 再按空格，这一次用另一种。Cubase 里这个开关叫 Return to Start Position on Stop',
      stemsBtn: '各分轨', stemsTip: '把上下文展开成一条一条的原分轨', fit: '全曲', fitTip: '把整首歌放进一屏',
      showHead: '还可以摆出来', moreBtn: (n) => `其他做法 ${n} 条`, moreGroup: '其他做法',
      moreTip: '默认只摆“只告诉乐器和风格”的三个版本。这里把换了轨名、告诉了速度和调、换了官方设置、换了上下文的那些也摆出来',
      noRest: '这条原轨没有休止的地方', noMoreNext: '后面没有休止了', noMorePrev: '前面没有休止了',
      audioFail: (m) => `声音没读出来：${m}`, cantRead: (f) => `读不了 ${f}`,
      outDefault: '系统默认', outLabel: (s) => `输出：${s}`, outTip: '选择声音从哪个设备出来，比如你的声卡',
      outUnsupported: '这个浏览器不能在网页里切换输出设备。请在系统的声音设置里切换，或者换用新版的 Chrome / Edge。',
      outNeedPerm: '浏览器要先得到一次麦克风权限，才肯把各个设备的名字告诉网页。只用来拿名字，不会录音。',
      outAsk: '列出全部输出设备', outDenied: '没有得到权限，只能用系统默认设备。',
      outNoMic: '这台电脑现在没有可用的录音设备，浏览器因此不肯给出输出设备的名字。请在系统的声音设置里把声卡设成默认输出。',
      outGone: (s) => `输出设备“${s}”不见了，已经退回系统默认。`, outFail: (m) => `没切成：${m}`, outNone: '没有找到别的输出设备',
      tipCell: (n, u) => (u === 'beat' ? `第 ${n} 拍` : `第 ${n} 格`), tipRest: '原轨在休止', tipViol: '原轨休止，它在响', tipBoth: '一起停',
      selfNote: (g) => `它自己拆出来的各轨：${g}`,
    },
    en: {
      docTitle: 'Regeneration · Voice Function', secAria: 'Sections', secLabels: 'Labels', secRegen: 'Regeneration',
      kicker: 'Regeneration review', heroTitle: '<span class="ln"><b>Regenerated</b></span><span class="ln"><b><em>stems</em></b></span>',
      lede: 'The original song, its stems and every regenerated take, side by side. Everything is sample-aligned, so switching never drifts. Open a song, pick a target stem, and flip between the original and each take.',
      how: [['Space', 'play / pause'], ['1–9', 'hear take n'], ['0', 'hear the original'], ['Tab', 'flip original ⇄ this take'], ['C', 'context on / off']],
      refresh: 'Refresh', refreshing: 'Indexing…', refreshTip: 'Bring newly added results into the page (local runs and cloud downloads alike)',
      refreshed: 'Index rebuilt', refreshFail: (m) => `Indexing failed: ${m}`, builtAt: (t) => `indexed ${t}`,
      empty: 'No results yet. Put a run’s output into experiments/regen_gap/xl_real/outputs/<run>/ and press “Refresh” at the top right.',
      foot: 'Demo　·　only the first Suno song (Funk) is included　·　verdict marks can be clicked but are not saved',
      kind: { real: 'Real multitrack', suno: 'Suno stems', selfgen: 'Self-generated', clip: '60 s clip' },
      kindNote: { real: 'native stems of a real recording as context', suno: 'stems exported by Suno as context', selfgen: 'the model generates, separates and refills its own song', clip: 'short excerpt used to test the scripts' },
      model: { small: 'Small model', large: 'Large model' }, where: { local: 'this PC', cloud: 'cloud' },
      nTakes: (n) => `${n} output${n === 1 ? '' : 's'}`, allOk: 'all healthy', nBad: (n) => `${n} flagged`, stopsShort: (p) => `rests where the original rests: ${p}`,
      cells: (n, u) => `${n} ${u === 'beat' ? 'beats' : 'cells (half-second)'}`, regenOf: (s) => `regenerated: ${s}`,
      back: '← All results', pickHead: 'Target stem', extractTab: 'Separation', partsTab: 'Its separated stems',
      loading: 'Loading…', noSession: 'This demo does not include results for this song',
      ctx: 'Context', ctxSub: 'all other stems summed', ctxSubX: 'the other stems as separated by the model, summed', mix: 'Full mix', mixSub: 'original song', mixSubGen: 'song generated by the model',
      orig: (s) => `Original · ${s}`, origExtracted: (s) => `Replaced stem · ${s}`, origSubC: 'coloured by your corrected labels', origSubA: 'coloured by automatic labels', origSubX: 'separated by the model itself', origSubN: '',
      take: (n) => `Take ${n}`, extracted: 'Separated', tagAlias: (s) => `asked for as “${s}”`, tagMeta: 'tempo and key given', tagUi: 'official UI settings', tagX: 'separated stems as context',
      runName: (m, w) => `${m} · ${w}`,
      cardCtx: 'Every stem except the target, summed. This is what the model hears when it fills the stem.', cardMix: 'All stems summed.',
      cardStem: 'One of the original stems. Click it to hear it alone.', cardOrig: (p) => `This is the reference. It rests on ${p} of the beats.`,
      cardOrigX: 'Not a true original: the model separated this stem out of its own song, and the regenerated takes replace it.',
      descPlain: 'The model was told the instrument and the style only.', descAlias: (s) => `Same instrument and style, but the model was asked for a “${s}” track.`,
      descMeta: 'The model was also given the tempo, key and time signature (currently unverified values).', descUi: 'Same content, using the official UI’s default settings.',
      descX: 'The context is the stems the model separated itself, not the real ones. Compare with the plain take of the same number.',
      descExtract: 'Separated from the full mix by track name. Compare with the original stem above it.',
      rKey: 'Key', rBeat: 'Beat', rStop: 'Rests where the original rests', rSim: 'Similarity to the original',
      capKey: (lo, up) => `○ a semitone up ${lo}　| original ${up}`, capBeat: (lo, up) => `○ a quarter-beat late ${lo}　| original ${up}`,
      capStop: (s) => `0% never stops　○ at random ${s}　| original 100%`, capSim: (b) => `○ doing nothing ${b}`,
      broken: 'This ruler does not work on this stem; no conclusion', noScore: 'not computed yet',
      activeLine: (a, o) => `sounding on ${a} of beats` + (o ? ` (original ${o})` : ''), louder: (d) => (d >= 0 ? `${d.toFixed(1)} dB louder than the original` : `${(-d).toFixed(1)} dB quieter than the original`),
      tookSecs: (s) => `generated in ${s} s`, gate: (g) => `usable as context: ${g}`, normal: 'health checks passed',
      flag: { '模型内部缩小过音量': 'scaled down by the model (played here at its original level)', '无声': 'silent', '像噪声': 'noise-like', '局部像噪声': 'partly noise-like', '削波': 'clipped', '直流偏移': 'DC offset', '输出几乎等于输入': 'output almost equals input' },
      markHead: 'Your verdict', mOk: 'Fine', mDoubt: 'Unsure', mBad: 'Problem', notePh: 'How does this take sound? e.g. “plays through the chorus rest”, “sounds like a different instrument”',
      saved: (t) => 'Demo, not saved', saveFail: (m) => `Not saved: ${m}`, pickTake: 'Select a take to note your verdict here',
      legendHead: 'How to read it', legendRest: 'Light bands: the original is resting', legendViol: 'Stripes: the original rests but this take sounds',
      fn: ['Rest', 'Lead', 'Doubling', 'Counter-melody', 'Chords', 'Figure'], fnAcc: 'Accompaniment', level1: 'L1', level2: 'L2',
      levelTip: 'Two labelling targets. Level 1: all six functions kept apart. Level 2: figure accompaniment is folded into chordal accompaniment as one “accompaniment”. This only changes the view; six classes are always stored',
      keysHead: 'Keyboard', keys: [['Space', 'play / pause'], ['0', 'the original'], ['1–9', 'take n'], ['↑ ↓', 'previous / next lane'], ['Tab', 'flip original ⇄ this take'], ['C', 'context on / off'], ['← →', '4 beats back / forward (Shift: 16)'], ['P N', 'previous / next rest of the original'], ['L', 'loop this rest'], ['Esc', 'clear the loop'], ['F', 'follow the playhead or not']],
      playAria: 'Play or pause', tlAria: 'Timeline: click to jump there and hear that lane', zoomAria: 'Zoom',
      listenWith: (a, b) => `Hearing: <b>${a}</b> + <b>${b}</b>`, listenSolo: (a) => `Hearing only: <b>${a}</b>`,
      ctxBtn: 'With context', ctxTip: 'Hear the other stems underneath or not (C)', abBtn: 'Original ⇄ take', abTip: 'Flip between the original and the take you were just hearing (Tab)',
      prevRest: '← Rest', nextRest: 'Rest →', prevRestTip: 'Jump to just before the previous rest of the original (P)', nextRestTip: 'Jump to just before the next rest of the original (N)',
      loopBtn: 'Loop', loopTip: 'Loop the rest nearest the playhead, with 4 beats on each side (L)',
      retBtn: 'Return on stop',
      retTip: 'On: stopping with Space sends the playhead back to where this playback started (or where you last clicked), so Space plays the same spot again, also after switching takes. Off: playback resumes from where it stopped. Hold Shift with Space to use the other behaviour once. Cubase calls this Return to Start Position on Stop',
      stemsBtn: 'Stems', stemsTip: 'Expand the context into the individual original stems', fit: 'Fit', fitTip: 'Fit the whole song on screen',
      showHead: 'Also show', moreBtn: (n) => `${n} other variant${n === 1 ? '' : 's'}`, moreGroup: 'other variants',
      moreTip: 'By default only the three plain takes are shown. This adds the ones with another track name, with tempo and key given, with the official UI settings, or with a different context',
      noRest: 'This original has no rests', noMoreNext: 'No more rests after this point', noMorePrev: 'No rests before this point',
      audioFail: (m) => `Audio failed to load: ${m}`, cantRead: (f) => `cannot read ${f}`,
      outDefault: 'System default', outLabel: (s) => `Output: ${s}`, outTip: 'Choose which device plays the sound, e.g. your audio interface',
      outUnsupported: 'This browser cannot switch the output device from a web page. Change it in the system sound settings, or use a recent Chrome / Edge.',
      outNeedPerm: 'The browser only reveals device names after microphone permission has been granted once. It is used for the names only; nothing is recorded.',
      outAsk: 'List all output devices', outDenied: 'Permission was not granted, so only the system default is available.',
      outNoMic: 'This computer has no usable recording device right now, so the browser will not reveal output device names. Set your audio interface as the default output in the system sound settings instead.',
      outGone: (s) => `Output device “${s}” is gone. Switched back to the system default.`, outFail: (m) => `Could not switch: ${m}`, outNone: 'No other output device found',
      tipCell: (n, u) => (u === 'beat' ? `beat ${n}` : `cell ${n}`), tipRest: 'the original rests', tipViol: 'the original rests, this one sounds', tipBoth: 'both rest',
      selfNote: (g) => `Its own separated stems: ${g}`,
    },
  };
  let LANG = store.get('fn-lang') === 'en' ? 'en' : 'zh';
  const T = (k, ...a) => { const v = STR[LANG][k]; return typeof v === 'function' ? v(...a) : v; };
  // 标注的两级目标（和标注页共用一个开关）：二级里音型伴奏（5）并进和弦伴奏（4），合称“伴奏”。只是看法不同
  let LEVEL = store.get('fn-level') === '2' ? 2 : 1;
  // 双重功能：一格里可以有两个功能，存成 p + 10 × q（见标注页 app.js 里的说明）
  const RANK = [9, 0, 2, 1, 4, 3];
  const fn1 = (v) => v % 10, fn2 = (v) => (v - v % 10) / 10;
  const pair = (a, b) => (!a ? b : !b || a === b ? a : RANK[a] < RANK[b] ? a + 10 * b : b + 10 * a);
  const lv1 = (v) => (LEVEL === 2 && v === 5 ? 4 : v);
  const lv = (v) => (v < 10 ? lv1(v) : pair(lv1(fn1(v)), lv1(fn2(v))));
  const fnName1 = (v) => (LEVEL === 2 && lv1(v) === 4 ? T('fnAcc') : T('fn')[v]);
  const fnName = (v) => { const w = lv(v); return fn2(w) ? fnName1(fn1(w)) + ' + ' + fnName1(fn2(w)) : fnName1(v < 10 ? v : w); };
  const L2 = (o) => (o ? (o[LANG] || o.zh || '') : '');
  const GATE_EN = { '可用': 'yes', '空': 'no, empty', '等于整曲': 'no, same as the mix', '异常': 'no, unhealthy' };

  // 六类功能的颜色和高度，和标注页一致（改颜色要两边一起改，并重新校验）
  const FN = [{ color: null, h: 0 }, { color: '#ee5e23', h: 1 }, { color: '#c21f55', h: 0.58 }, { color: '#01a2c5', h: 0.78 }, { color: '#2f66c4', h: 0.26 }, { color: '#9e71fd', h: 0.42 }];
  const INK = '243,239,232', RULER = 30, RATE = 50, SEEDS = [1001, 1002, 1003];

  async function api(url, opt) {
    const r = await fetch(url, opt);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(j.error || ('HTTP ' + r.status)); err.code = j.code || ''; throw err; }
    return j;
  }
  const audioUrl = (file) => '/raudio/' + file.split('/').map(encodeURIComponent).join('/');
  let toastTimer = 0;
  function toast(msg, ms = 3200) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms); }
  function applyStatic() {
    document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
    document.title = T('docTitle');
    $$('[data-t]').forEach((e) => { e.textContent = T(e.dataset.t); });
    $$('[data-t-html]').forEach((e) => { e.innerHTML = T(e.dataset.tHtml); });
    for (const attr of ['title', 'placeholder', 'aria-label']) $$(`[data-t-${attr}]`).forEach((e) => e.setAttribute(attr, T(e.getAttribute(`data-t-${attr}`))));
    $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === LANG));
    $$('.lvl button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.level === LEVEL));
    $('#how').innerHTML = T('how').map(([k, v]) => `<li><kbd>${esc(k)}</kbd>${esc(v)}</li>`).join('');
    $('#keys').innerHTML = T('keys').map(([k, v]) => `<li><kbd>${esc(k)}</kbd>${esc(v)}</li>`).join('');
    $('#foot').textContent = T('foot');
    $('#fnLegend').innerHTML = FN.map((f, v) => (v && !(LEVEL === 2 && v === 5) ? `<li><u style="height:${Math.max(3, f.h * 16)}px;background:${f.color}"></u>${esc(fnName(v))}</li>` : '')).join('');
    $('#refreshLabel').textContent = T(st.refreshing ? 'refreshing' : 'refresh');
    output.label();
  }

  // ------------------------------------------------------------------ 声音
  // 要听的几条轨整条解码进内存，在同一时刻一起起播，所以它们之间是逐个采样点对齐的。
  const engine = {
    ctx: null, master: null, analyser: null, tbuf: null, buffers: new Map(), pending: new Map(), nodes: [], active: [], gain: 1,
    playing: false, started: false, offset: 0, t0: 0, duration: 0, token: 0, epoch: 0, loading: 0, level: 0, loop: null,
    origin: 0,          // 这一次是从哪里开始放的；用鼠标点过别处，就是点的那里。“停止回起点”回的就是这儿
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain(); this.master.gain.value = this.gain;
      this.analyser = this.ctx.createAnalyser(); this.analyser.fftSize = 1024; this.tbuf = new Float32Array(1024);
      this.master.connect(this.analyser); this.analyser.connect(this.ctx.destination);
      output.restore();
    },
    load(url) {
      if (this.buffers.has(url)) { const b = this.buffers.get(url); this.buffers.delete(url); this.buffers.set(url, b); return Promise.resolve(b); }
      if (this.pending.has(url)) return this.pending.get(url);
      this.init();
      const epoch = this.epoch;
      const p = fetch(url).then((r) => { if (!r.ok) throw new Error(T('cantRead', decodeURIComponent(url.split('/').pop()))); return r.arrayBuffer(); })
        .then((ab) => this.ctx.decodeAudioData(ab))
        .then((buf) => {
          if (epoch !== this.epoch) return buf;
          this.pending.delete(url); this.buffers.set(url, buf);
          const keep = new Set(this.active.map((a) => a.url)); keep.add(url);
          for (const k of [...this.buffers.keys()]) { if (this.buffers.size <= 7) break; if (!keep.has(k)) this.buffers.delete(k); }   // 内存里最多留 7 条
          return buf;
        }, (err) => { if (epoch === this.epoch) this.pending.delete(url); throw err; });
      this.pending.set(url, p);
      return p;
    },
    pos() { return (!this.playing || !this.started) ? this.offset : clamp(this.offset + Math.max(0, this.ctx.currentTime - this.t0), 0, this.duration); },
    stopNodes() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (const n of this.nodes) { try { n.g.gain.cancelScheduledValues(now); n.g.gain.setValueAtTime(n.g.gain.value, now); n.g.gain.linearRampToValueAtTime(0, now + 0.015); n.src.stop(now + 0.03); } catch (e) { /* 已经停了 */ } }
      this.nodes = [];
    },
    async restart(keepOffset) {
      if (!keepOffset) this.offset = this.pos();
      const my = ++this.token;
      this.started = false; this.stopNodes();
      if (!this.playing) return;
      this.init(); this.loading++;
      let bufs;
      try { bufs = await Promise.all(this.active.map((a) => this.load(a.url))); }
      catch (err) { if (my === this.token) { this.playing = false; toast(T('audioFail', err.message)); } return; }
      finally { this.loading--; }
      if (my !== this.token || !this.playing) return;
      if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (e) { /* 等用户再点一次 */ } }
      if (my !== this.token || !this.playing) return;
      const when = this.ctx.currentTime + 0.04;
      bufs.forEach((b, i) => {
        const src = this.ctx.createBufferSource(); src.buffer = b;
        const g = this.ctx.createGain(), level = this.active[i].gain;
        g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(level, when + 0.015);
        src.connect(g); g.connect(this.master);
        src.start(when, Math.min(this.offset, Math.max(0, b.duration - 0.01)));
        this.nodes.push({ src, g });
      });
      this.t0 = when; this.started = true;
    },
    play() { if (this.playing) return; if (this.offset >= this.duration - 0.05) this.offset = this.loop ? this.loop.a : 0; this.origin = this.offset; this.playing = true; this.restart(true); },
    pause() { if (!this.playing) return; this.offset = this.pos(); this.playing = false; this.started = false; this.token++; this.stopNodes(); },
    // 空格：没在放就放；在放就停。“停止回起点”开着时停下以后回到 origin。other 为真（按着 Shift）时，这一次用另一种停法
    toggle(other) {
      if (!this.playing) { this.play(); return; }
      this.pause();
      if (st.ret !== !!other) this.offset = this.origin;
    },
    // keep 为真：只是循环绕回开头，不算用户挑的位置，不动 origin
    seek(t, keep) { this.offset = clamp(t, 0, this.duration); if (!keep) this.origin = this.offset; if (this.playing) this.restart(true); },
    setActive(list) {
      if (list.length === this.active.length && list.every((a, i) => a.url === this.active[i].url && a.gain === this.active[i].gain)) return;
      this.active = list;
      if (this.playing) this.restart(false); else list.forEach((a) => this.load(a.url).catch(() => {}));
    },
    setGain(g) { this.gain = g; if (this.master) this.master.gain.value = g; },
    reset(duration) { this.pause(); this.token++; this.epoch++; this.offset = 0; this.origin = 0; this.duration = duration; this.active = []; this.loop = null; this.buffers.clear(); this.pending.clear(); this.level = 0; },
    sample() {
      let target = 0;
      if (this.playing && this.started && this.analyser) {
        this.analyser.getFloatTimeDomainData(this.tbuf);
        let sum = 0; for (let i = 0; i < this.tbuf.length; i++) sum += this.tbuf[i] * this.tbuf[i];
        target = clamp(Math.sqrt(sum / this.tbuf.length) * 3.2, 0, 1);
      }
      this.level += (target - this.level) * (target > this.level ? 0.35 : 0.08);
      return this.level;
    },
  };

  // ------------------------------------------------------------------ 播放设备（比如切到声卡）。和标注页共用同一个选择。
  const output = {
    id: store.get('fn-sink') || '', name: store.get('fn-sink-name') || '',
    supported() { const AC = window.AudioContext || window.webkitAudioContext; return !!(AC && AC.prototype && typeof AC.prototype.setSinkId === 'function'); },
    restore() { if (!this.id || !this.supported() || !engine.ctx) return; engine.ctx.setSinkId(this.id).catch(() => { this.id = ''; this.name = ''; store.set('fn-sink', ''); store.set('fn-sink-name', ''); this.label(); }); },
    label() { $('#outLabel').textContent = T('outLabel', this.id ? (this.name || this.id.slice(0, 8)) : T('outDefault')); },
    async devices(ask) {
      const md = navigator.mediaDevices;
      if (!md || !md.enumerateDevices) return { list: [], named: false };
      let list = (await md.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
      if (ask && !list.some((d) => d.label)) {       // 拿到名字就立刻把麦克风关掉，不录音
        const s = await md.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        list = (await md.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
      }
      return { list: list.filter((d) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications'), named: list.some((d) => d.label) };
    },
    async choose(id, name) { engine.init(); await engine.ctx.setSinkId(id); this.id = id; this.name = id ? name : ''; store.set('fn-sink', this.id); store.set('fn-sink-name', this.name); this.label(); },
    async open(ask) {
      const menu = $('#outMenu'), btn = $('#outBtn');
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
      if (!this.supported()) { menu.innerHTML = `<p>${esc(T('outUnsupported'))}</p>`; return; }
      let res, denied = '';
      try { res = await this.devices(ask); } catch (e) { denied = e && e.name === 'NotFoundError' ? 'outNoMic' : 'outDenied'; res = await this.devices(false).catch(() => ({ list: [], named: false })); }
      const item = (id, name) => `<button role="menuitemradio" aria-checked="${this.id === id}" data-sink="${esc(id)}" data-name="${esc(name)}"><i>${this.id === id ? '●' : ''}</i>${esc(name)}</button>`;
      let html = item('', T('outDefault'));
      if (res.named) html += res.list.map((d) => item(d.deviceId, d.label || d.deviceId.slice(0, 8))).join('') + (res.list.length ? '' : `<p>${esc(T('outNone'))}</p>`);
      else html += (denied ? `<p>${esc(T(denied))}</p>` : `<p>${esc(T('outNeedPerm'))}</p><button data-ask="1"><i>＋</i>${esc(T('outAsk'))}</button>`);
      menu.innerHTML = html;
    },
    close() { $('#outMenu').hidden = true; $('#outBtn').setAttribute('aria-expanded', 'false'); },
    async check() {
      if (!$('#outMenu').hidden) this.open(false);
      if (!this.id) return;
      const res = await this.devices(false).catch(() => null);
      if (!res || !res.named || res.list.some((d) => d.deviceId === this.id)) return;
      const gone = this.name;
      try { if (engine.ctx) await engine.ctx.setSinkId(''); } catch (e) { /* 退不回去也把记录清掉 */ }
      this.id = ''; this.name = ''; store.set('fn-sink', ''); store.set('fn-sink-name', ''); this.label();
      toast(T('outGone', gone), 6000);
    },
  };

  // ------------------------------------------------------------------ 状态
  const st = { index: null, sess: null, view: null, vi: 0, lanes: [], takes: [], sel: null, lastTake: null, withCtx: true, showStems: false, showMore: false, moreCount: 0,
    ret: store.get('fn-return') === '1',      // “停止回起点”开没开（和标注页共用这一个设置）
    pps: 0, minPps: 1, scroll: 0, vy: 0, contentH: 0, follow: true, dirty: true, W: 0, H: 0, hover: null, layer: null, stripe: null,
    refreshing: false, saveTimer: 0, route: '' };
  const cv = $('#tl'), ctx = cv.getContext('2d');
  const X = (t) => (t - st.scroll) * st.pps;
  const cellAt = (t) => { const e = st.sess.edges; let lo = 0, hi = e.length - 2; while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (e[mid] <= t) lo = mid; else hi = mid - 1; } return lo; };
  const pk = (l) => { if (!l._pk) l._pk = Uint8Array.from(atob(l.peaks || ''), (c) => c.charCodeAt(0)); return l._pk; };
  const runOf = (id) => st.sess.runs.find((r) => r.id === id);
  const runName = (r) => T('runName', T('model')[r.model], T('where')[r.where]);

  // ------------------------------------------------------------------ 目录
  function drawPreview(c, p) {
    const dpr = window.devicePixelRatio || 1, w = c.clientWidth, h = c.clientHeight;
    c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
    const g = c.getContext('2d'); g.scale(dpr, dpr);
    const rows = [p.orig, ...p.takes].filter((s) => s && s.length);
    if (!rows.length) return;
    const n = rows[0].length, cw = w / n, rh = Math.min(13, (h - 4 * (rows.length - 1)) / rows.length);
    rows.forEach((s, r) => {
      const y = r * (rh + 4) + (r ? 4 : 0);
      for (let i = 0; i < n; i++) {
        if (s[i] !== '1') continue;
        const viol = r > 0 && p.orig[i] === '0';
        g.fillStyle = r === 0 ? `rgba(${INK},.9)` : (viol ? `rgba(${INK},.78)` : `rgba(${INK},.22)`);
        g.fillRect(i * cw, y, Math.max(1, cw - 0.6), r === 0 ? rh : rh - 3);
      }
    });
  }
  function renderHome() {
    const idx = st.index, list = idx ? idx.sessions : [];
    $('#homeCount').textContent = idx && idx.built_at ? T('builtAt', idx.built_at.slice(5, 16)) : '';
    const ol = $('#songs');
    if (!list.length) { ol.innerHTML = `<li class="empty" style="opacity:1;transform:none">${esc(T('empty'))}</li>`; return; }
    let html = '', last = '', no = 0;
    for (const s of list) {
      if (s.kind !== last) { last = s.kind; html += `<li class="sep"><b>${esc(T('kind')[s.kind])}</b><span>${esc(T('kindNote')[s.kind])}</span></li>`; }
      no++;
      const runs = s.runs.map((r) => { const c = s.counts[r.id]; return `<span class="pill${c.bad ? ' warn' : ''}">${esc(runName(r))}　${esc(T('nTakes', c.n))}${c.bad ? ' · ' + esc(T('nBad', c.bad)) : ''}</span>` + (c.stops == null ? '' : `<span class="mono dim" style="text-transform:none;letter-spacing:.02em">${esc(T('stopsShort', pct(c.stops)))}</span>`); }).join('');
      const tg = s.targets.map(L2).join(LANG === 'zh' ? '、' : ', ');
      html += `<li style="animation-delay:${Math.min(no, 12) * 55}ms"><button class="song" data-id="${esc(s.id)}">
        <span class="no">${String(no).padStart(2, '0')}</span>
        <span><h3>${esc(L2(s.title))}</h3><span class="meta"><span class="mono dim">${fmt(s.seconds)} · ${esc(T('cells', s.n_cells, s.unit))}</span>${tg ? `<span class="mono dim" style="text-transform:none;letter-spacing:.02em">${esc(T('regenOf', tg))}</span>` : ''}</span></span>
        <span class="state">${runs}</span><canvas data-prev="${esc(s.id)}"></canvas></button></li>`;
    }
    ol.innerHTML = html;
    $$('canvas[data-prev]', ol).forEach((c) => drawPreview(c, list.find((s) => s.id === c.dataset.prev).preview));
  }
  async function loadIndex() { st.index = await api('/api/regen/index'); if (!$('#home').hidden) renderHome(); }
  $('#songs').addEventListener('click', (e) => { const b = e.target.closest('.song'); if (b) location.hash = `#/s/${b.dataset.id}`; });
  $('#refresh').addEventListener('click', async () => {
    if (st.refreshing) return;
    st.refreshing = true; $('#refresh').disabled = true; $('#refreshLabel').textContent = T('refreshing');
    try { await api('/api/regen/refresh', { method: 'POST', body: '{}' }); await loadIndex(); toast(T('refreshed')); }
    catch (err) { toast(T('refreshFail', err.message), 7000); }
    finally { st.refreshing = false; $('#refresh').disabled = false; $('#refreshLabel').textContent = T('refresh'); }
  });

  // ------------------------------------------------------------------ 对比页：把一个“看法”摆成若干行
  const takeNo = (t) => { const i = SEEDS.indexOf(t.seed); return i >= 0 ? i + 1 : t.seed; };
  function takeTags(t, key) {
    const tags = [];
    if (t.alias) tags.push(T('tagAlias', LANG === 'zh' ? ({ brass: '铜管', woodwinds: '木管' }[t.alias] || t.alias) : t.alias));
    if (t.arm === 'meta') tags.push(T('tagMeta'));
    if (t.arm === 'ui') tags.push(T('tagUi'));
    if (t.task === 'legox') tags.push(T('tagX'));
    return tags;
  }
  function restRuns(active) {
    const e = st.sess.edges, out = [];
    if (!active) return out;
    for (let i = 0; i < active.length; i++) {
      if (active[i] !== '0') continue;
      let j = i; while (j + 1 < active.length && active[j + 1] === '0') j++;
      out.push({ a: e[i], b: e[j + 1], i, j });
      i = j;
    }
    return out;
  }
  function violRuns(take, ref) {
    const e = st.sess.edges, out = [];
    if (!take.active || !ref || !ref.active) return out;
    const n = Math.min(take.active.length, ref.active.length);
    for (let i = 0; i < n; i++) {
      if (!(ref.active[i] === '0' && take.active[i] === '1')) continue;
      let j = i; while (j + 1 < n && ref.active[j + 1] === '0' && take.active[j + 1] === '1') j++;
      out.push({ a: e[i], b: e[j + 1] });
      i = j;
    }
    return out;
  }
  function views() {
    const s = st.sess, vs = s.views.slice();
    if (s.kind === 'selfgen' && s.stems.length) vs.push({ id: 'parts', type: 'parts' });
    return vs;
  }
  function buildLanes() {
    const s = st.sess, v = st.view, lanes = [], takes = [];
    const mix = Object.assign({}, s.mix, { type: 'mix', id: 'mix', name: T('mix'), sub: T(s.kind === 'selfgen' ? 'mixSubGen' : 'mixSub') });
    const addTakes = (list, ref, extra) => {
      for (const run of s.runs) {
        const mine = list.filter((t) => t.run === run.id);
        if (!mine.length) continue;
        lanes.push({ type: 'grp', id: 'grp:' + run.id + ':' + (ref ? ref.id : '') + (extra ? ':more' : ''), name: runName(run) + (extra ? ' · ' + T('moreGroup') : '') });
        for (const t of mine) {
          const l = Object.assign({}, t, { type: 'take', id: `${t.run}/${t.id}`, ref, name: t.task === 'extract' ? T('extracted') : T('take', takeNo(t)), sub: takeTags(t).join(' · '), rests: ref ? ref.rests : [] });
          l.viol = violRuns(l, ref);
          lanes.push(l); takes.push(l);
        }
      }
    };
    if (v.type === 'lego') {
      const lab = s.labels && s.labels[v.stem];
      const o = Object.assign({}, v.original, { type: 'orig', id: 'orig', labels: lab || null });
      o.name = T(v.original.kind === 'extracted' ? 'origExtracted' : 'orig', L2(v.label));
      o.sub = v.original.kind === 'extracted' ? T('origSubX') : (lab ? T(s.labels_from === 'corrected' ? 'origSubC' : 'origSubA') : T('origSubN'));
      o.rests = restRuns(o.active);
      if (v.context) lanes.push(Object.assign({}, v.context, { type: 'ctx', id: 'ctx', name: T('ctx'), sub: T('ctxSub') }));
      if (st.showStems) for (const x of s.stems) if (x.name !== v.stem) lanes.push(Object.assign({}, x, { type: 'stem', id: 'stem:' + x.name, name: L2(x.label), sub: '' }));
      lanes.push(o);
      // 默认只摆主要的三个版本（只告诉乐器和风格）；其他做法收着，要看再展开
      const isMain = (t) => t.task === 'lego' && t.arm === 'plain' && !t.alias;
      const main = v.takes.filter(isMain), more = main.length ? v.takes.filter((t) => !isMain(t)) : [];
      st.moreCount = more.length;
      addTakes(main.length ? main : v.takes, o);
      if (st.showMore && more.length) addTakes(more, o, true);
    } else if (v.type === 'extract') {
      st.moreCount = 0;
      lanes.push(mix);
      const stems = [...new Set(v.takes.map((t) => t.stem))];
      for (const name of stems) {
        const src = s.stems.find((x) => x.name === name);
        const lab = s.labels && s.labels[name];
        const o = Object.assign({}, src, { type: 'orig', id: 'orig:' + name, labels: lab || null, name: T('orig', L2(src.label)), sub: '' });
        o.rests = restRuns(o.active);
        lanes.push(o);
        addTakes(v.takes.filter((t) => t.stem === name), o);
      }
    } else {                                  // 模型自己生成的曲子：它拆出来的各轨
      st.moreCount = 0;
      lanes.push(mix);
      for (const x of s.stems) { const l = Object.assign({}, x, { type: 'take', id: 'part:' + x.name, ref: null, name: L2(x.label), sub: x.gate ? T('gate', LANG === 'zh' ? x.gate : (GATE_EN[x.gate] || x.gate)) : '', rests: [], viol: [], part: true }); lanes.push(l); takes.push(l); }
    }
    st.lanes = lanes; st.takes = takes;
    // 整体音量：保证“上下文 + 最响的那一条”不超幅。同一个看法里所有切换都用同一个系数，对比才公平。
    const ctxPeak = v.type === 'lego' ? Math.max(v.context ? v.context.peak : 0, ...v.takes.map((t) => (t.ctx ? t.ctx.peak : 0))) : 0;
    // 收起来的“其他做法”也算在内，展开、收起的时候整体音量不变
    const lanePeak = Math.max(0.05, ...lanes.filter((l) => l.type === 'take' || l.type === 'orig').map((l) => l.peak || 0), ...(v.takes || []).map((t) => t.peak || 0));
    engine.setGain(Math.min(1, 0.98 / Math.max(s.mix.peak || 0, ctxPeak + lanePeak)));
  }
  function laneById(id) { return st.lanes.find((l) => l.id === id) || null; }
  function ctxOf(l) { const v = st.view; if (v.type !== 'lego') return null; return (l.type === 'take' && l.ctx) ? l.ctx : v.context; }
  function sources() {
    const l = st.sel; if (!l) return [];
    const out = [];
    if ((l.type === 'take' || l.type === 'orig') && st.view.type === 'lego' && st.withCtx) { const c = ctxOf(l); if (c) out.push({ url: audioUrl(c.file), gain: 1 }); }
    out.push({ url: audioUrl(l.file), gain: l.gain || 1 });
    return out;
  }
  function select(l, opt = {}) {
    if (!l || l.type === 'grp') return;
    if (l.type === 'take') st.lastTake = l.id;
    st.sel = l;
    engine.setActive(sources());
    // 顺手把相邻的两条先读进来，切过去的时候不用等
    const i = st.takes.indexOf(l);
    for (const n of [st.takes[i + 1], l.ref, st.takes[i - 1]]) if (n && n.file) engine.load(audioUrl(n.file)).catch(() => {});
    renderHeadsState(); renderCard(); renderReview(); updateDock(); st.dirty = true;
    if (!opt.keepHash) history.replaceState(null, '', `#/s/${st.sess.id}/${st.vi}`);
  }
  function flipAB() {
    const l = st.sel; if (!l) return;
    if (l.type === 'take' && l.ref) return select(l.ref);
    const back = laneById(st.lastTake) || st.takes[0];
    if (back) select(back);
  }
  function currentRef() { const l = st.sel; if (l && l.type === 'take' && l.ref) return l.ref; if (l && l.type === 'orig') return l; return st.lanes.find((x) => x.type === 'orig') || null; }

  // ------------------------------------------------------------------ 行的摆放与行头
  function layout() {
    const rect = $('#lanes').getBoundingClientRect();
    st.W = Math.max(50, rect.width - $('#heads').offsetWidth); st.H = rect.height;
    const ideal = { grp: 24, stem: 26, ctx: 42, mix: 42, orig: 60, take: 46 }, low = { grp: 18, stem: 18, ctx: 24, mix: 24, orig: 38, take: 24 };
    const avail = st.H - RULER - 4, lanes = st.lanes;
    const sumI = lanes.reduce((a, l) => a + ideal[l.type], 0), sumL = lanes.reduce((a, l) => a + low[l.type], 0);
    let k = sumI > avail ? clamp((avail - sumL) / Math.max(1, sumI - sumL), 0, 1) : 1;
    const nt = lanes.filter((l) => l.type === 'take').length;
    const extra = sumI < avail && nt ? Math.min(52, (avail - sumI) / (nt + 1)) : 0;   // 有富余就让原轨和每个版本的行高一点
    let y = RULER;
    for (const l of lanes) { l.h = low[l.type] + (ideal[l.type] - low[l.type]) * k + (l.type === 'take' ? extra : (l.type === 'orig' ? Math.min(extra, 30) : 0)); l.y0 = y; y += l.h; }
    st.contentH = y; st.vy = clamp(st.vy, 0, Math.max(0, st.contentH - st.H));
    st.minPps = st.W / Math.max(1, st.sess.seconds);
    if (!st.pps || st.pps < st.minPps) st.pps = st.minPps;
    st.scroll = clamp(st.scroll, 0, Math.max(0, st.sess.seconds - st.W / st.pps));
    const dpr = window.devicePixelRatio || 1;
    if (cv.width !== Math.round(st.W * dpr) || cv.height !== Math.round(st.H * dpr)) { cv.width = Math.round(st.W * dpr); cv.height = Math.round(st.H * dpr); }
    $('#heads').classList.toggle('tight', lanes.some((l) => l.type === 'take' && l.h < 34));
    positionHeads(); st.dirty = true;
  }
  function renderHeads() {
    let n = 0;
    $('#heads').innerHTML = st.lanes.map((l) => {
      const tx = `<span class="tx"><span class="nm">${esc(l.name)}</span>${l.sub ? `<span class="en">${esc(l.sub)}</span>` : ''}</span>`;
      if (l.type === 'grp') return `<div class="head grp mono" data-id="${esc(l.id)}">${esc(l.name)}</div>`;
      const key = l.type === 'take' ? (++n <= 9 ? n : '') : (l.type === 'orig' && l.id === 'orig' ? 0 : '');
      return `<button class="head${l.type === 'stem' ? ' small' : ''}" data-id="${esc(l.id)}" aria-pressed="false">${key === '' ? '' : `<span class="k">${key}</span>`}${tx}<span class="dot" hidden></span></button>`;
    }).join('');
    positionHeads(); renderHeadsState();
  }
  function positionHeads() { $$('#heads .head').forEach((h) => { const l = laneById(h.dataset.id); if (l) { h.style.top = (l.y0 - st.vy) + 'px'; h.style.height = l.h + 'px'; } }); }
  function reviewOf(l) { const r = st.sess.reviews && st.sess.reviews[l.run]; return (r && r[l.id.split('/').slice(1).join('/')]) || null; }
  function renderHeadsState() {
    $$('#heads .head').forEach((h) => {
      const l = laneById(h.dataset.id); if (!l || l.type === 'grp') return;
      h.setAttribute('aria-pressed', st.sel === l);
      const dot = h.querySelector('.dot'), rv = l.type === 'take' && !l.part ? reviewOf(l) : null;
      dot.hidden = !(rv && rv.mark); dot.className = 'dot ' + (rv && rv.mark ? rv.mark : '');
    });
  }
  $('#heads').addEventListener('click', (e) => { const h = e.target.closest('button.head'); if (h) select(laneById(h.dataset.id)); });

  // ------------------------------------------------------------------ 侧栏：现在听的这一条
  function ruleSvg(lo, hi, val, marks) {
    const px = (v) => clamp((v - lo) / (hi - lo), 0, 1) * 96 + 2;
    let s = `<svg viewBox="0 0 100 22" preserveAspectRatio="none" aria-hidden="true"><line x1="2" y1="11" x2="98" y2="11" stroke="rgba(${INK},.22)" stroke-width="1" vector-effect="non-scaling-stroke"/>`;
    for (const m of marks) {
      if (m.v == null) continue;
      s += m.solid ? `<line x1="${px(m.v)}" y1="4" x2="${px(m.v)}" y2="18" stroke="rgba(${INK},.9)" stroke-width="1.5" vector-effect="non-scaling-stroke"/>`
        : `<circle cx="${px(m.v)}" cy="11" r="3.2" fill="#0d0d0e" stroke="rgba(${INK},.6)" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`;
    }
    if (val != null) s += `<circle cx="${px(val)}" cy="11" r="4.2" fill="rgb(${INK})"/>`;
    return s + '</svg>';
  }
  function renderCard() {
    const l = st.sel, v = st.view, box = $('#card');
    if (!l) { box.innerHTML = ''; return; }
    const rule = (name, value, svg, cap) => `<div class="rule"><b>${esc(name)}</b><i>${esc(value)}</i>${svg}<p>${esc(cap)}</p></div>`;
    let html = '';
    if (l.type === 'take' && !l.part) {
      const run = runOf(l.run), refs = v.refs || {};
      const desc = l.task === 'extract' ? T('descExtract') : l.task === 'legox' ? T('descX') : l.arm === 'meta' ? T('descMeta') : l.arm === 'ui' ? T('descUi') : l.alias ? T('descAlias', l.alias) : T('descPlain');
      const flags = l.flags.length ? l.flags.map((f) => `<span class="pill${l.unhealthy ? ' warn' : ''}">${esc(LANG === 'zh' ? (T('flag')[f] || f) : (T('flag')[f] || f))}</span>`).join('') : `<span class="pill">${esc(T('normal'))}</span>`;
      html += `<h3>${esc(runName(run))} · ${esc(l.name)}</h3><p class="sub">${esc(desc)}</p><div class="tags">${flags}</div>`;
      if (l.task === 'extract') {
        html += rule(T('rSim'), num(l.sim_true), ruleSvg(0, 1, l.sim_true, [{ v: l.base }]), T('capSim', num(l.base)));
        if (l.gate) html += `<p class="sub">${esc(T('gate', LANG === 'zh' ? l.gate : (GATE_EN[l.gate] || l.gate)))}</p>`;
      } else {
        html += rule(T('rStop'), pct(l.stops), ruleSvg(0, 1, l.stops, [{ v: refs.stops_shift }, { v: 1, solid: true }]), T('capStop', pct(refs.stops_shift)));
        if (l.key != null || refs.key_up != null) html += rule(T('rKey'), refs.key_ok === false ? '–' : num(l.key), ruleSvg(-1, 1, refs.key_ok === false ? null : l.key, [{ v: refs.key_low }, { v: refs.key_up, solid: true }]), refs.key_ok === false ? T('broken') : T('capKey', num(refs.key_low), num(refs.key_up)));
        if (l.beat != null || refs.beat_up != null) html += rule(T('rBeat'), refs.beat_ok === false ? '–' : num(l.beat), ruleSvg(-0.5, 1, refs.beat_ok === false ? null : l.beat, [{ v: refs.beat_low }, { v: refs.beat_up, solid: true }]), refs.beat_ok === false ? T('broken') : T('capBeat', num(refs.beat_low), num(refs.beat_up)));
        const bits = [T('activeLine', pct(l.active_ratio), refs.active != null ? pct(refs.active) : '')];
        if (l.louder_db != null) bits.push(T('louder', l.louder_db));
        html += `<p class="sub">${esc(bits.join(' · '))}</p>`;
      }
      html += `<p class="sub dim">${esc(T('tookSecs', l.secs))}</p>`;
    } else if (l.type === 'orig') {
      const rest = l.active ? [...l.active].filter((c) => c === '0').length / l.active.length : null;
      html += `<h3>${esc(l.name)}</h3><p class="sub">${esc(v.type === 'lego' && v.original.kind === 'extracted' ? T('cardOrigX') : T('cardOrig', pct(rest)))}</p>`;
    } else {
      html += `<h3>${esc(l.name)}</h3><p class="sub">${esc(l.part ? (l.sub || '') : T(l.type === 'ctx' ? 'cardCtx' : l.type === 'mix' ? 'cardMix' : 'cardStem'))}</p>`;
    }
    box.innerHTML = html;
  }
  function renderReview() {
    const l = st.sel, on = !!(l && l.type === 'take' && !l.part);
    $('#marks').innerHTML = [['ok', 'mOk'], ['doubt', 'mDoubt'], ['bad', 'mBad']].map(([m, k]) => `<button class="mark" data-mark="${m}" aria-pressed="false" ${on ? '' : 'disabled'}>${esc(T(k))}</button>`).join('');
    const note = $('#note'); note.disabled = !on;
    const rv = on ? reviewOf(l) : null;
    note.value = rv ? (rv.note || '') : '';
    $$('#marks .mark').forEach((b) => b.setAttribute('aria-pressed', !!rv && rv.mark === b.dataset.mark));
    $('#saveState').textContent = on ? (rv && rv.at ? T('saved', rv.at.slice(11, 16)) : '') : T('pickTake');
  }
  function saveReview(l, mark, note) {
    const take = l.id.split('/').slice(1).join('/');
    const all = st.sess.reviews || (st.sess.reviews = {}), mine = all[l.run] || (all[l.run] = {});
    mine[take] = { mark, note, at: '' };
    renderHeadsState();
    clearTimeout(st.saveTimer);
    st.saveTimer = setTimeout(async () => {
      try {
        const r = await api(`/api/regen/review?id=${encodeURIComponent(st.sess.id)}&run=${encodeURIComponent(l.run)}&take=${encodeURIComponent(take)}`, { method: 'POST', body: JSON.stringify({ mark, note }) });
        mine[take].at = r.at; if (st.sel === l) $('#saveState').textContent = T('saved', r.at.slice(11, 16));
      } catch (err) { $('#saveState').textContent = T('saveFail', err.message); }
    }, 450);
  }
  $('#marks').addEventListener('click', (e) => {
    const b = e.target.closest('.mark'), l = st.sel; if (!b || !l || l.type !== 'take' || l.part) return;
    const rv = reviewOf(l), mark = rv && rv.mark === b.dataset.mark ? '' : b.dataset.mark;
    saveReview(l, mark, $('#note').value);
    $$('#marks .mark').forEach((x) => x.setAttribute('aria-pressed', x.dataset.mark === mark));
  });
  $('#note').addEventListener('input', () => { const l = st.sel; if (!l || l.type !== 'take' || l.part) return; const rv = reviewOf(l); saveReview(l, rv ? rv.mark || '' : '', $('#note').value); });

  // ------------------------------------------------------------------ 画
  function stripePattern() {
    if (st.stripe) return st.stripe;
    const c = document.createElement('canvas'); c.width = c.height = 8;
    const g = c.getContext('2d'); g.strokeStyle = `rgba(${INK},.95)`; g.lineWidth = 1.5;
    for (const o of [-8, 0, 8]) { g.beginPath(); g.moveTo(o, 8); g.lineTo(o + 8, 0); g.stroke(); }
    st.stripe = ctx.createPattern(c, 'repeat');
    return st.stripe;
  }
  function wavePath(l, base, hh) {
    const p = pk(l), path = new Path2D(), W = st.W;
    path.moveTo(0, base);
    for (let x = 0; x <= W; x++) {
      const i0 = Math.max(0, Math.floor((st.scroll + x / st.pps) * RATE)), i1 = Math.min(p.length, Math.max(i0 + 1, Math.ceil((st.scroll + (x + 1) / st.pps) * RATE)));
      let m = 0; for (let i = i0; i < i1; i++) if (p[i] > m) m = p[i];
      path.lineTo(x, base - (m / 255) * hh);
    }
    path.lineTo(W, base); path.closePath();
    return path;
  }
  function drawStatic() {
    const dpr = window.devicePixelRatio || 1, W = st.W, H = st.H, s = st.sess;
    if (!st.layer) st.layer = document.createElement('canvas');
    const lc = st.layer; if (lc.width !== cv.width || lc.height !== cv.height) { lc.width = cv.width; lc.height = cv.height; }
    const g = lc.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, W, H);
    // 时间尺
    const step = [1, 2, 5, 10, 15, 30, 60, 120].find((v) => v * st.pps >= 62) || 120;
    g.font = "11px 'JetBrains Mono', Consolas, monospace"; g.textBaseline = 'middle';
    for (let t = Math.ceil(st.scroll / step) * step; t <= st.scroll + W / st.pps; t += step) {
      const x = Math.round(X(t)) + 0.5;
      g.strokeStyle = `rgba(${INK},.07)`; g.beginPath(); g.moveTo(x, RULER - 6); g.lineTo(x, H); g.stroke();
      g.fillStyle = `rgba(${INK},.42)`; g.fillText(fmt(t), x + 5, 13);
    }
    g.strokeStyle = `rgba(${INK},.11)`; g.beginPath(); g.moveTo(0, RULER + 0.5); g.lineTo(W, RULER + 0.5); g.stroke();
    for (const l of st.lanes) {
      const y = l.y0 - st.vy, base = y + l.h - 4, hh = Math.max(6, l.h - 10), on = st.sel === l;
      if (y > H || y + l.h < RULER) continue;
      g.save(); g.beginPath(); g.rect(0, Math.max(RULER + 1, y), W, l.h); g.clip();
      g.strokeStyle = `rgba(${INK},${l.type === 'grp' ? 0 : 0.08})`; g.beginPath(); g.moveTo(0, y + l.h - 0.5); g.lineTo(W, y + l.h - 0.5); g.stroke();
      if (l.type === 'grp') { g.strokeStyle = `rgba(${INK},.16)`; g.setLineDash([2, 5]); g.beginPath(); g.moveTo(0, y + l.h - 0.5); g.lineTo(W, y + l.h - 0.5); g.stroke(); g.setLineDash([]); g.restore(); continue; }
      if (on) { g.fillStyle = `rgba(${INK},.045)`; g.fillRect(0, y, W, l.h); }
      const wave = wavePath(l, base, hh);
      if (l.type === 'orig' && l.labels) {
        g.fillStyle = `rgba(${INK},.2)`; g.fill(wave);
        const e = s.edges, n = Math.min(l.labels.length, e.length - 1);
        const blocks = new Path2D();
        for (let i = 0; i < n; i++) {
          const code = lv(l.labels[i]); if (!code || !FN[fn1(code)] || (fn2(code) && !FN[fn2(code)])) continue;
          let j = i; while (j + 1 < n && lv(l.labels[j + 1]) === code) j++;
          const x0 = X(e[i]) + 0.75, x1 = X(e[j + 1]) - 0.75; i = j;
          if (x1 < 0 || x0 > W) continue;
          const w = Math.max(1, x1 - x0);
          (fn2(code) ? [fn1(code), fn2(code)] : [code]).forEach((v, k) => {      // 双重功能：高的在后、矮的在前，中间留一道缝
            const bh = Math.max(3, hh * FN[v].h), rad = Math.min(4, w / 2, bh / 2);
            if (k) { g.fillStyle = '#0d0d0e'; g.beginPath(); g.roundRect(x0, base - bh - 2, w, bh + 2, [rad, rad, 0, 0]); g.fill(); }
            g.fillStyle = FN[v].color; g.globalAlpha = on ? 0.95 : 0.8;
            g.beginPath(); g.roundRect(x0, base - bh, w, bh, [rad, rad, 0, 0]); g.fill(); g.globalAlpha = 1;
            if (!k) blocks.roundRect(x0, base - bh, w, bh, [rad, rad, 0, 0]);
          });
        }
        g.save(); g.clip(blocks); g.fillStyle = 'rgba(13,13,14,.42)'; g.fill(wave); g.restore();     // 色块里用深色再画一遍波形，看得出起伏
      } else if (l.type === 'orig') {
        g.fillStyle = `rgba(${INK},${on ? 0.92 : 0.72})`; g.fill(wave);
      } else if (l.type === 'take') {
        for (const r of l.rests) { const x0 = X(r.a), x1 = X(r.b); if (x1 < 0 || x0 > W) continue; g.fillStyle = `rgba(${INK},.06)`; g.fillRect(x0, y + 1, x1 - x0, l.h - 2); }
        g.fillStyle = `rgba(${INK},${on ? 0.62 : 0.3})`; g.fill(wave);
        if (l.viol.length) {
          const clip = new Path2D();
          for (const r of l.viol) { const x0 = X(r.a), x1 = X(r.b); if (x1 < 0 || x0 > W) continue; clip.rect(x0, y, x1 - x0, l.h); g.fillStyle = `rgba(${INK},${on ? 0.9 : 0.5})`; g.fillRect(x0, y + 1, x1 - x0, 2); }
          g.save(); g.clip(clip); g.fillStyle = '#0d0d0e'; g.fill(wave); g.fillStyle = stripePattern(); g.globalAlpha = on ? 0.95 : 0.5; g.fill(wave); g.restore();
        }
      } else {
        g.fillStyle = `rgba(${INK},${on ? 0.5 : (l.type === 'stem' ? 0.16 : 0.2)})`; g.fill(wave);
      }
      g.restore();
    }
    st.dirty = false;
  }
  function draw() {
    if (st.dirty || !st.layer) drawStatic();
    if (!st.layer || !st.layer.width || !st.layer.height) { st.dirty = true; return; }      // 窗口还没有尺寸：等有了再画
    const dpr = window.devicePixelRatio || 1, W = st.W, H = st.H;
    ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, cv.width, cv.height); ctx.drawImage(st.layer, 0, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (engine.loop) {
      const x0 = X(engine.loop.a), x1 = X(engine.loop.b);
      ctx.fillStyle = `rgba(${INK},.06)`; ctx.fillRect(x0, RULER, x1 - x0, H - RULER);
      ctx.strokeStyle = `rgba(${INK},.55)`; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(x0 + 0.5, 0); ctx.lineTo(x0 + 0.5, H); ctx.moveTo(x1 + 0.5, 0); ctx.lineTo(x1 + 0.5, H); ctx.stroke(); ctx.setLineDash([]);
    }
    if (st.hover) { ctx.strokeStyle = `rgba(${INK},.22)`; ctx.beginPath(); ctx.moveTo(st.hover.x + 0.5, RULER); ctx.lineTo(st.hover.x + 0.5, H); ctx.stroke(); }
    const px = X(engine.pos());
    if (px >= -2 && px <= W + 2) {
      ctx.strokeStyle = `rgb(${INK})`; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(px, 4); ctx.lineTo(px, H); ctx.stroke(); ctx.lineWidth = 1;
      ctx.fillStyle = `rgb(${INK})`; ctx.beginPath(); ctx.arc(px, 6, 3.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  function drawLegend() {
    const mk = (id, fn) => { const c = $(id), g = c.getContext('2d'); g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 68, 32); g.scale(2, 2); fn(g); };
    const wave = (g) => { const p = new Path2D(); p.moveTo(0, 15); [9, 12, 6, 13, 8, 11, 5, 12, 9].forEach((v, i) => p.lineTo(i * 4.25, 15 - v)); p.lineTo(34, 15); p.closePath(); return p; };
    mk('#lgRest', (g) => { g.fillStyle = `rgba(${INK},.1)`; g.fillRect(10, 0, 16, 16); g.fillStyle = `rgba(${INK},.3)`; const p = new Path2D(); p.moveTo(0, 15); p.lineTo(0, 6); p.lineTo(5, 9); p.lineTo(9, 5); p.lineTo(10, 15); p.moveTo(26, 15); p.lineTo(27, 6); p.lineTo(31, 10); p.lineTo(34, 7); p.lineTo(34, 15); g.fill(p); });
    mk('#lgViol', (g) => { const p = wave(g); g.fillStyle = `rgba(${INK},.1)`; g.fillRect(10, 0, 16, 16); g.fillStyle = `rgba(${INK},.3)`; g.fill(p); g.save(); g.beginPath(); g.rect(10, 0, 16, 16); g.clip(); g.fillStyle = '#0d0d0e'; g.fill(p); g.fillStyle = stripePattern(); g.fill(p); g.restore(); });
  }

  // ------------------------------------------------------------------ 底栏与走时
  function updateDock() {
    const l = st.sel, v = st.view, lego = v && v.type === 'lego';
    const withCtx = lego && st.withCtx && l && (l.type === 'take' || l.type === 'orig') && ctxOf(l);
    const nm = (x) => esc((x.type === 'take' && !x.part ? runName(runOf(x.run)) + ' · ' : '') + x.name);
    $('#listen').innerHTML = l ? (withCtx ? T('listenWith', esc(T('ctx')), nm(l)) : T('listenSolo', nm(l))) + (engine.loading ? ` <i class="dim">${esc(T('loading'))}</i>` : '') : '';
    $('#ctxBtn').hidden = !lego; $('#ctxBtn').setAttribute('aria-pressed', st.withCtx);
    $('#stemsBtn').hidden = !(lego && st.sess.kind !== 'selfgen'); $('#stemsBtn').setAttribute('aria-pressed', st.showStems);
    $('#moreBtn').hidden = !st.moreCount; $('#moreBtn').textContent = T('moreBtn', st.moreCount); $('#moreBtn').setAttribute('aria-pressed', st.showMore);
    $('#showBox').hidden = $('#stemsBtn').hidden && $('#moreBtn').hidden;
    $('#abBtn').disabled = !st.takes.some((t) => t.ref);
    const ref = currentRef(), has = !!(ref && ref.rests && ref.rests.length);
    $('#prevRest').disabled = $('#nextRest').disabled = $('#loopBtn').disabled = !has;
    $('#loopBtn').setAttribute('aria-pressed', !!engine.loop);
  }
  const lead = () => { const e = st.sess.edges; return 4 * (e[e.length - 1] / (e.length - 1)); };      // 4 拍大约多少秒（只用来留提前量）
  function jumpRest(dir) {
    const ref = currentRef(); if (!ref || !ref.rests.length) return toast(T('noRest'));
    const t = engine.pos() + lead();
    const r = dir > 0 ? ref.rests.find((x) => x.a > t + 0.05) : [...ref.rests].reverse().find((x) => x.a < t - 0.05 - (engine.playing ? 0.8 : 0));
    if (!r) return toast(T(dir > 0 ? 'noMoreNext' : 'noMorePrev'));
    engine.seek(Math.max(0, r.a - lead())); reveal();
  }
  function toggleLoop() {
    if (engine.loop) { engine.loop = null; return updateDock(); }
    const ref = currentRef(); if (!ref || !ref.rests.length) return toast(T('noRest'));
    const t = engine.pos();
    const r = ref.rests.find((x) => x.b > t) || ref.rests[ref.rests.length - 1];
    engine.loop = { a: Math.max(0, r.a - lead()), b: Math.min(st.sess.seconds, r.b + lead()) };
    if (t < engine.loop.a || t > engine.loop.b) engine.seek(engine.loop.a);
    reveal(); updateDock();
  }
  function reveal() { const t = engine.pos(), span = st.W / st.pps; if (t < st.scroll || t > st.scroll + span * 0.92) { st.scroll = clamp(t - span * 0.2, 0, Math.max(0, st.sess.seconds - span)); st.dirty = true; } }
  function setZoom(pps, anchorT) {
    const old = st.pps; st.pps = clamp(pps, st.minPps, st.minPps * 40);
    if (anchorT != null) st.scroll = anchorT - (anchorT - st.scroll) * old / st.pps;
    st.scroll = clamp(st.scroll, 0, Math.max(0, st.sess.seconds - st.W / st.pps));
    $('#zoom').value = Math.round(1000 * Math.log(st.pps / st.minPps) / Math.log(40)); st.dirty = true;
  }
  let lastLoading = -1, lastPlaying = null;
  function tick() {
    requestAnimationFrame(tick);
    if ($('#room').hidden || !st.sess) return;
    const t = engine.pos();
    if (engine.playing && engine.started) {
      if (engine.loop && t >= engine.loop.b - 0.01) engine.seek(engine.loop.a, true);
      else if (t >= engine.duration - 0.02) { engine.pause(); engine.offset = st.ret ? engine.origin : engine.duration; }
      if (st.follow) { const span = st.W / st.pps; if (t > st.scroll + span * 0.86 || t < st.scroll) { st.scroll = clamp(t - span * 0.12, 0, Math.max(0, st.sess.seconds - span)); st.dirty = true; } }
    }
    if (engine.loading !== lastLoading) { lastLoading = engine.loading; updateDock(); }
    if (engine.playing !== lastPlaying) { lastPlaying = engine.playing; $('#playIcon').setAttribute('d', engine.playing ? 'M3 1.5h3.6v13H3zM9.4 1.5H13v13H9.4z' : 'M3 1.5v13l11-6.5z'); }
    $('#clock').textContent = `${fmt(t)} / ${fmt(st.sess.seconds)}`;
    document.documentElement.style.setProperty('--lvl', engine.sample().toFixed(3));
    draw();
  }

  // ------------------------------------------------------------------ 鼠标与键盘
  const laneAtY = (y) => st.lanes.find((l) => l.type !== 'grp' && y >= l.y0 - st.vy && y < l.y0 - st.vy + l.h) || null;
  cv.addEventListener('pointermove', (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, t = clamp(st.scroll + x / st.pps, 0, st.sess.seconds), l = laneAtY(y);
    st.hover = { x, y };
    const tip = $('#tip'), i = cellAt(t);
    let extra = '';
    if (l && l.type === 'take' && l.ref && l.ref.active && l.active) { const a = l.active[i] === '1', o = l.ref.active[i] === '1'; if (!o) extra = a ? T('tipViol') : T('tipBoth'); }
    else if (l && l.type === 'orig' && l.active && l.active[i] === '0') extra = T('tipRest');
    else if (l && l.type === 'orig' && l.labels && l.labels[i]) extra = fnName(l.labels[i]);
    tip.innerHTML = `<b>${esc(l ? l.name : '')}</b> <i>${fmt(t)} · ${esc(T('tipCell', i + 1, st.sess.unit))}${extra ? ' · ' + esc(extra) : ''}</i>`;
    tip.hidden = false;
    const lr = $('#lanes').getBoundingClientRect();
    tip.style.left = clamp(e.clientX - lr.left + 14, 8, lr.width - tip.offsetWidth - 8) + 'px';
    tip.style.top = clamp(e.clientY - lr.top - 40, 4, lr.height - 34) + 'px';
  });
  cv.addEventListener('pointerleave', () => { st.hover = null; $('#tip').hidden = true; });
  cv.addEventListener('click', (e) => {
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const l = y > RULER ? laneAtY(y) : null;
    if (l && l !== st.sel) select(l);
    engine.seek(clamp(st.scroll + x / st.pps, 0, st.sess.seconds));
  });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left;
    if (e.ctrlKey || e.metaKey) return setZoom(st.pps * Math.exp(-e.deltaY * 0.0022), st.scroll + x / st.pps);
    const dx = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
    if (dx) { st.scroll = clamp(st.scroll + dx / st.pps, 0, Math.max(0, st.sess.seconds - st.W / st.pps)); st.dirty = true; return; }
    if (st.contentH > st.H) { st.vy = clamp(st.vy + e.deltaY, 0, st.contentH - st.H); positionHeads(); st.dirty = true; }
    else if (st.pps > st.minPps * 1.01) { st.scroll = clamp(st.scroll + e.deltaY / st.pps, 0, Math.max(0, st.sess.seconds - st.W / st.pps)); st.dirty = true; }
  }, { passive: false });
  $('#play').addEventListener('click', (e) => engine.toggle(e.shiftKey));
  $('#retBtn').setAttribute('aria-pressed', st.ret);
  $('#retBtn').addEventListener('click', (e) => { st.ret = !st.ret; store.set('fn-return', st.ret ? '1' : '0'); e.currentTarget.setAttribute('aria-pressed', st.ret); });
  $('#ctxBtn').addEventListener('click', () => { st.withCtx = !st.withCtx; engine.setActive(sources()); updateDock(); });
  $('#abBtn').addEventListener('click', flipAB);
  $('#prevRest').addEventListener('click', () => jumpRest(-1));
  $('#nextRest').addEventListener('click', () => jumpRest(1));
  $('#loopBtn').addEventListener('click', toggleLoop);
  $('#stemsBtn').addEventListener('click', () => { st.showStems = !st.showStems; rebuild(st.sel ? st.sel.id : null); });
  $('#moreBtn').addEventListener('click', () => { st.showMore = !st.showMore; rebuild(st.sel ? st.sel.id : null); });
  $('#fit').addEventListener('click', () => setZoom(st.minPps, 0));
  $('#zoom').addEventListener('input', (e) => setZoom(st.minPps * Math.pow(40, e.target.value / 1000), engine.pos()));
  $('#outBtn').addEventListener('click', () => { if ($('#outMenu').hidden) output.open(false); else output.close(); });
  $('#outMenu').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ask) { output.open(true); return; }
    try { await output.choose(b.dataset.sink, b.dataset.name); output.close(); } catch (err) { toast(T('outFail', err.message || String(err)), 5000); }
  });
  document.addEventListener('pointerdown', (e) => { if (!$('#outMenu').hidden && !e.target.closest('.menuWrap')) output.close(); });
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => output.check());
  document.addEventListener('keydown', (e) => {
    if ($('#room').hidden || !st.sess) return;
    const tag = e.target.tagName;
    if (tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type !== 'range')) { if (e.key === 'Escape') e.target.blur(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase(), cells = (n) => { const ed = st.sess.edges, i = clamp(cellAt(engine.pos()) + n, 0, ed.length - 1); return ed[i]; };
    if (e.key === ' ') { e.preventDefault(); if (tag === 'BUTTON') e.target.blur(); engine.toggle(e.shiftKey); }
    else if (e.key === 'Tab') { e.preventDefault(); flipAB(); }
    else if (k === '0' || k === '`') { const o = currentRef(); if (o) select(o); }
    else if (k >= '1' && k <= '9') { const t = st.takes[+k - 1]; if (t) select(t); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const ls = st.lanes.filter((l) => l.type !== 'grp'), i = ls.indexOf(st.sel); const n = ls[clamp(i + (e.key === 'ArrowDown' ? 1 : -1), 0, ls.length - 1)]; if (n) select(n); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); engine.seek(cells((e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 16 : 4))); reveal(); }
    else if (k === 'c') $('#ctxBtn').click();
    else if (k === 'n') jumpRest(1);
    else if (k === 'p') jumpRest(-1);
    else if (k === 'l') toggleLoop();
    else if (k === 'f') st.follow = !st.follow;
    else if (e.key === 'Escape') { if (engine.loop) { engine.loop = null; updateDock(); } }
    else if (e.key === 'Home') { engine.seek(0); reveal(); }
  });
  window.addEventListener('resize', () => { if (!$('#room').hidden && st.sess) layout(); else if (st.index) renderHome(); });

  // ------------------------------------------------------------------ 进出一首歌
  function renderPicks() {
    const vs = views();
    $('#picks').innerHTML = vs.map((v, i) => `<button class="pick" data-vi="${i}" aria-pressed="${i === st.vi}">${esc(v.type === 'lego' ? L2(v.label) : T(v.type === 'extract' ? 'extractTab' : 'partsTab'))}</button>`).join('');
  }
  $('#picks').addEventListener('click', (e) => { const b = e.target.closest('.pick'); if (b && +b.dataset.vi !== st.vi) { st.vi = +b.dataset.vi; st.view = views()[st.vi]; rebuild(null); renderPicks(); } });
  function rebuild(keepId) {
    buildLanes(); renderHeads(); layout();
    const l = (keepId && laneById(keepId)) || st.takes[0] || st.lanes.find((x) => x.type !== 'grp');
    st.sel = null; select(l);
  }
  function renderRoomStatic() {
    const s = st.sess;
    $('#rKicker').textContent = `${T('kind')[s.kind]} · ${T('kindNote')[s.kind]}`;
    $('#rTitle').textContent = L2(s.title);
    $('#rMeta').textContent = `${fmt(s.seconds)} · ${T('cells', s.edges.length - 1, s.unit)}` + (s.kind === 'selfgen' && s.selfgen && s.selfgen.gate ? '' : '');
    renderPicks();
  }
  async function openSession(id, vi) {
    engine.reset(0);
    let s;
    try { s = await api('/api/regen/session?id=' + encodeURIComponent(id)); } catch (err) { toast(T('noSession')); location.hash = '#/'; return; }
    st.sess = s; engine.reset(s.seconds);
    const vs = views(); st.vi = clamp(vi || 0, 0, Math.max(0, vs.length - 1)); st.view = vs[st.vi];
    st.pps = 0; st.scroll = 0; st.vy = 0; st.withCtx = true; st.showStems = false; st.showMore = false; st.lastTake = null;
    $('#home').hidden = true; $('#room').hidden = false;
    renderRoomStatic(); drawLegend(); rebuild(null);
    $('#zoom').value = 0;
  }
  function route() {
    const m = /^#\/s\/([A-Za-z0-9_\-]+)(?:\/(\d+))?/.exec(location.hash);
    if (m) { if (!st.sess || st.sess.id !== m[1] || $('#room').hidden) openSession(m[1], m[2] ? +m[2] : 0); return; }
    engine.pause(); st.sess = null;
    $('#room').hidden = true; $('#home').hidden = false;
    renderHome(); if (!st.index) loadIndex().catch((err) => toast(err.message));
  }
  $('#back').addEventListener('click', () => { location.hash = '#/'; });
  $$('.lang button').forEach((b) => b.addEventListener('click', () => {
    LANG = b.dataset.lang; store.set('fn-lang', LANG); applyStatic();
    if (st.sess && !$('#room').hidden) { renderRoomStatic(); rebuild(st.sel ? st.sel.id : null); } else renderHome();
  }));
  $$('.lvl button').forEach((b) => b.addEventListener('click', () => {
    LEVEL = +b.dataset.level === 2 ? 2 : 1; store.set('fn-level', String(LEVEL)); applyStatic();
    if (st.sess && !$('#room').hidden) rebuild(st.sel ? st.sel.id : null);
  }));
  window.addEventListener('hashchange', route);
  applyStatic(); route(); requestAnimationFrame(tick);
})();
