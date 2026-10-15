/* 声部功能识别：标注核对工作台。无依赖，全部在浏览器里跑。
   数据：GET /api/library、/api/song?c=&id=、/api/peaks?c=&id=，POST /api/save?c=&id=，音频 /audio/<c>/<id>/<文件>
         POST /api/grid?c=&id=（存小节标尺的设置）、POST /api/reextract?c=&id=（按网格重新识别这首歌）、GET /api/reextract?c=&id=（进度）
         GET /api/history?c=&id=、/api/history/version?c=&id=&v=&keep=，POST /api/history/restore?c=&id=（历史版本，2026-10-16）
   画法：每条分轨一行，每一拍一格。功能既用颜色、也用高度表示（主旋律最高，和弦伴奏最矮，休止为空），
   所以分不清颜色也能看懂。配色用 dataviz 的校验脚本在深色底上逐对验证过，改颜色要重新校验。
   界面文字全部在 STR 里，中英两套。 */
(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const fmt = (t) => { t = Math.max(0, Math.floor(t + 1e-6)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  const fmt1 = (t) => { t = Math.round(Math.max(0, t) * 10) / 10; const m = Math.floor(t / 60), s = t - m * 60; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 存不了就算了 */ } } };

  // ------------------------------------------------------------------ 文字（中 / 英）
  const STR = {
    zh: {
      docTitle: '声部功能识别', kicker: 'Voice function recognition',
      heroTitle: '<span class="ln"><b>声部<em>功能</em></b></span><span class="ln"><b>识别</b></span>',
      lede: '一条分轨在整首歌里不会一直做同一件事：有时唱主旋律，有时让开去铺和声，有时停下来。这里把每条分轨在每一拍上的功能摆出来，看自动识别的结果对不对，不对就直接改。',
      foot: '演示版　·　标 ♪ 的 6 首可以播放，其余只有标注和波形　·　改动不会保存　·　音频来自 MoisesDB（CC BY-NC-SA 4.0），已压缩',
      count: (n, d) => `${n} 首 · 看完 ${d} 首`, tabCount: (n) => `${n} 首`,
      level1: '一级', level2: '二级', fnAcc: '伴奏', fnAccEn: 'ACCOMPANIMENT',
      levelTip: '标注的两级目标。一级：六类功能都分开。二级：音型伴奏并进和弦伴奏，合成一个“伴奏”。只改怎么看，存下来的始终是六类，随时可以切回一级',
      fnAccNote: '伴奏：和弦伴奏与音型伴奏在二级目标里不分。已经标成这两类的格子不会被改写',
      ruleNew: '新标准', ruleFrom: '从这一首起，自动标注用的是新标准', ruleMeta: '自动标注：新标准',
      viewBeat: '按拍', viewBar: '按小节', viewTip: '按拍：一拍一个功能（第七版）。按小节：4 拍一个小节、一小节一个功能（可以有两个）。两边的修改各存各的，互不影响。',
      noBar: '这首歌还没有按小节的结果，先显示按拍的。', barsN: (n) => `${n} 个小节`, barSrc: (s) => `小节线：${s}`,
      barConfirm: '（第 1 拍是估计的，请到按拍页面的小节标尺上确认）', barCapBar: '小节', barOf: (k, n) => (k ? `第 ${k} 小节 · 共 ${n} 个` : `第 1 小节之前 · 共 ${n} 个`),
      ruleVer: (n) => `第 ${n} 版规则`, ruleMetaV: (n) => `自动标注：第 ${n} 版规则`,
      ruleNoteV: (n) => (n >= 6 ? '第 6 版：在第 5 版上加了两条。循环的伴奏（一条轨的声音隔一、二、四小节原样回来、而且持续很久的地方算伴奏，不算副旋律）；伴唱用自己的规则（不会是主旋律；和主唱同时唱、不叠奏的是和声；主唱间歇里走自己旋律的才是副旋律）。'
        : n >= 5 ? '第 5 版：主奏按“段”判（最短 8 拍，要过几道关）；一个长音只有一个功能；叠奏要和旋律一起换音；一条轨里有几段录音的拆开判，功能不同就是双重功能。'
        : n >= 3 ? '第 3 版：主奏短暂被别的轨打断又接回来的，算它一直在领奏；长音的慢旋律算副旋律。'
        : '第 2 版：2026-10-12 的旧标准，没有后面几版加的规则。') + '详见项目里的《声部功能自动标注规则》。',
      findPh: '搜编号或歌名', findCount: (n, m) => `找到 ${n} 首 / 共 ${m} 首`, findNone: (q) => `没有编号或歌名对得上“${q}”的歌。`, findClear: '清空搜索', toTop: '回到顶部',
      ruleNote: '新标准（2026-10-13 起）改了两处，都是结合前后几个小节来判：谁在领奏（主奏短暂被别的轨打断又接回来的，算它一直在领奏）；长音的慢旋律算副旋律。别的和旧标准一样。两套标准判得不一样的拍都标成了“存疑”。这条线以上的歌用的是旧标准',
      beats: (n) => `${n} 拍`, pitched: (n) => `${n} 条有音高的轨`, reviewed: '看完了', edits: (n) => `改了 ${n} 格`,
      emptyTab: '这一组还没有分析结果。', libFail: (m) => `读不到曲目列表：${m}`,
      libOffline: '歌单没读出来，请刷新页面。', _libOffline: '请看一下“启动标注页”那个黑色窗口是不是开着（关掉它，服务就停了）；没开就双击根目录的“启动标注页.bat”。这里每 3 秒自动再试一次，连上了歌单会自己出来。',
      back: '← 全部曲目', ringAria: '整首歌的总览，点一下跳到那里', tlAria: '功能时间线', playAria: '播放或暂停（空格）', zoomAria: '缩放',
      brushHead: '画笔', noteHead: '备注', notePh: '这首歌里发现的问题，比如哪一类总是判错', doneBtn: '这一首我看完了',
      modeAria: '点击时间线时做什么', modePoint: '指针', modeEdit: '改标注', modeListen: '试听',
      modePointTip: '普通指针：点一下只把播放线移到那里，不改任何东西（V）',
      modeAlign: '对齐', modeAlignTip: '按住左右拖：小节线、拍线、小节号都留在原地不动，整首歌的所有分轨连同它自己的时间刻度一起挪，把重拍对到小节线上（G）。拍速不变。方向键一次挪 5 毫秒，按住 Shift 是 20 毫秒。松手后自动保存',
      metroBtn: '节拍器', metroTip: '播放时每一拍响一声，小节的第一拍音高一些（M）。挪了网格，它跟着眼前这套网格响',
      applyBtn: '再保存一次', applyTip: '网格的改动平时是自动保存的；刚才那一次没存上，点这里再存一次', dropBtn: '放弃这次改动',
      regridRunning: () => '正在保存网格…', regridUndone: '网格已保存。有些标记换了格子，“看完了”的记号先取消了，核对以后再点一下。',
      gridSaved: (t) => `网格已保存 ${t}`, leaveUnsavedGrid: '网格的改动没有存上。仍然离开这首歌吗？（离开后这次改动会丢失）',
      regridFail: (m) => `网格没存上：${m}`,
      rePendBlind: '网格改了，马上自动保存…（这一种改动要存好以后才看得到）',
      alignMoved: (ms, beats) => `声音${ms > 0 ? '往后' : '往前'}挪了 ${Math.abs(ms)} 毫秒（${beats} 拍）`,
      gridNudge: '整体挪动分轨', gridNudgeTip: '把整首歌的声音往前或往后挪 5 毫秒。小节线和拍线留在原地，拍速不变',
      gridOffset: (ms) => (ms ? `相对自动识别的拍点，声音${ms < 0 ? '往后' : '往前'}挪了 ${Math.abs(ms)} 毫秒` : ''),
      modeEditTip: '点击或拖动，把这几拍改成画笔的功能；按住 Shift 是在原有功能上再加一个（E）', modeListenTip: '点一下跳到那里，并且只听那一条轨（L）',
      clearSolo: '听回整曲', prevU: '← 存疑', nextU: '存疑 →', prevUTip: '上一处存疑（[）', nextUTip: '下一处存疑（]）',
      showU: '标出存疑', showUTip: '显示或隐藏存疑的小圆圈', showW: '波形', showWTip: '在每一行的背景里显示这条轨的音量起伏',
      undo: '撤销', redo: '重做', undoTip: '撤销（Ctrl+Z）', redoTip: '重做（Ctrl+Y）', follow: '跟随', followTip: '播放时画面跟着走（F）', fit: '全曲', fitTip: '把整首歌放进一屏',
      ribbon: '主旋律在谁手里', unclassified: '不分类', solo: 'S', soloTip: '只听这一条（可以多选）',
      fn: ['休止', '主旋律', '叠奏', '副旋律', '和弦伴奏', '音型伴奏'],
      fnNote: ['这一拍没有声音', '这一拍最突出的那条旋律', '跟着主旋律走同样的音', '另一条独立的、不循环的旋律',
        '只给和弦和节奏：柱式和弦、扫弦、长音、贝斯打根音、两个音来回的律动',
        '伴奏里反复出现的一小段，有节奏也有音高走向：连复段（riff）、分解和弦的音型、固定音型。原样重复、带一点变化、跟着和声移位都算'],
      restore: '还原成自动识别', restoreNote: '把这几拍改回程序原来的判断', plus: ' + ', fnDual: '双重功能', fnDualEn: 'TWO FUNCTIONS', addBtn: '双重功能：再加一个', addHint: '按住 Shift 画也一样',
      addNeedsRestart: '双重功能要先把标注页的服务重启一次才能用：双击项目文件夹里的“启动标注页.bat”，按任意键让它接手，然后刷新这个页面（F5）。别的功能不受影响。',
      addTip: '双重功能：一条轨里同时有两样东西时用，比如一把吉他扫和弦、另一把走副旋律。打开以后，画笔不是把这几拍改掉，而是在原有功能上再加一个，两个功能叠着画。这一格已经有两个功能时，换掉和画笔同一类的那个（旋律类：主旋律、叠奏、副旋律；伴奏类：和弦伴奏、音型伴奏）。用“休止”去加，是去掉后一个功能。要变回单一功能，关掉它照常画（D）',
      fHand: '次主旋律换手', fLeads: '条轨当过主角', fNoLead: '还没有哪条轨被标成主旋律',
      fUnsure: (n) => `处存疑（共 ${n} 拍）`, fEdited: '格已被你改过',
      fNone: (n) => `有声音却没有主旋律的拍：${n}`, fMulti: (n) => `同时有两条以上主旋律的拍：${n}`,
      beatOf: (bar, beat, b, n) => `${bar} 小节 ${beat} 拍 · ${b} / ${n}`, leadNow: (s) => `主角：${s}`, sep: '、', loading: ' · 读入中…',
      listenMix: '在听：<b>整曲</b>', listenSolo: (s) => `只听：<b>${s}</b>`, many: (n) => `${n} 条同时`,
      tipBeat: (bar, beat, b, a, c) => `${bar} 小节 ${beat} 拍（第 ${b} 格）· ${a}–${c}`, tipNow: (s) => `现在：${s}`, tipWas: (s) => `（程序原判：${s}）`,
      tipUnsure: '存疑：门限稍微一动，这一拍的判断就会变', tipUncls: '鼓、打击乐和音效不分类，可以点“听”单独听',
      saveErr: (m) => `没存上：${m}（点这里重试）`, saving: '正在保存…', savePending: '有改动，马上保存',
      saved: (t, n) => (n ? `共改 ${n} 格 · ` : '') + '演示版，改动不会保存', saveNone: '演示版：可以试着改，但不会保存',
      stale: '自动识别结果重新生成过，拍的划分变了，以前保存的修改对不上，没有载入。旧文件再保存时会另存一份，不会丢。',
      rebased: (n) => `自动识别结果重新生成过。你以前改过的 ${n} 格已经接到新的结果上。`,
      badFile: '以前保存的修改文件读不出来，现在显示的是自动识别的结果。旧文件会原样另存，不会被覆盖。',
      conflict: '没存上：这首歌在别的页面里被保存过（点这里处理）', conflictAsk: '这首歌在别的页面里被保存过。用这个页面里的内容覆盖它吗？',
      autoChanged: '没存上：这首歌的自动识别结果刚被重新生成过。你刚才的修改已经另存了一份，没有丢；请刷新页面。',
      leaveUnsaved: '刚才的修改没有存上。仍然离开这首歌吗？（离开后这些修改会丢失）',
      noMoreNext: '后面没有存疑的地方了', noMorePrev: '前面没有存疑的地方了', audioFail: (m) => `声音没读进来：${m}`, cantRead: (f) => '演示版里这首只有标注和波形，没有放音频（标 ♪ 的几首可以播放）',
      audioOffline: '声音没读进来，请检查网络后刷新页面。', _audioOffline: '（它停了会自己重新启动，一般几秒）。等一会儿再点播放；一直不行就双击根目录的“启动标注页.bat”。',
      outDefault: '系统默认设备', outLabel: (s) => `输出：${s}`, outTip: '选择声音从哪个设备播放，比如你的声卡',
      outUnsupported: '这个浏览器不支持在网页里切换播放设备。可以在系统的声音设置里改，或者换用新版 Chrome / Edge。',
      outNeedPerm: '浏览器要先得到一次麦克风权限，才肯把各个设备的名字告诉网页。这里只是为了拿到名字，不会录音。',
      outAsk: '列出全部播放设备', outDenied: '没有拿到权限，只能用系统默认设备。',
      outNoMic: '这台电脑现在没有可用的录音设备，浏览器因此不肯给出播放设备的名字。可以在系统的声音设置里把默认输出改成你的声卡。',
      outGone: (s) => `播放设备“${s}”不在了，已经换回系统默认设备。`, outFail: (m) => `切换失败：${m}`, outNone: '没有找到别的播放设备',
      coll: { moises: ['MoisesDB 整曲', '真实录音的原生分轨'], suno: ['Suno 试点', '生成音乐，Suno 导出的分轨'] },
      sunoKicker: 'Suno 生成', secAria: '分区', secLabels: '标注核对', secRegen: '重生成结果',
      barCap: (n) => `小节 · 每小节 ${n} 拍`,
      bpmTip: '程序测出来的拍速。点开可以手动修正拍速、对齐网格、挪小节线', gridManualTag: '手动',
      retBtn: '停止回起点',
      retTip: '开着：按空格停下时，播放线回到这一次开始播放的地方（或你刚点过的地方），再按空格从同一处重放。关着：停在哪里，就从哪里接着放。按住 Shift 再按空格，这一次用另一种。Cubase 里这个开关叫 Return to Start Position on Stop',
      reBtn: '重新识别声部功能', reBtnPend: '按新网格重新识别',
      reTip: '让程序把这首歌的声部功能重新算一遍，一般十几秒。你手改过的格子会留着：网格没变就原样接上，网格变了就按时间搬过去',
      reRunning: (n) => `正在重新识别… ${n} 秒`, rePend: '网格改了，马上自动保存…',
      reSame: (n) => (n ? `重新识别完成。自动识别的结果有 ${n} 拍和原来不同。` : '重新识别完成，结果和原来一样。'),
      reMoved: (n) => `已按新网格重新识别。你改过的地方按时间搬到了新网格上，现在是 ${n} 格。`, reNew: '已按新网格重新识别。',
      reFail: (m) => `重新识别没成功：${m}`, reNeedSave: '刚才的修改还没存上。先解决保存的问题，再重新识别。',
      histBtn: '历史版本', histTip: '这首歌以前的规则版本、你点过“看完了”的版本：可以只看一看，也可以回退过去。回退前会先备份，随时能撤销',
      histHead: '历史版本', histClose: '关闭', histLoading: '正在读历史版本…', histFail: (m) => `读不到历史版本：${m}`,
      histKeep: (n) => `回退到规则版本时，留着我改过的 ${n} 格（盖在那一版上面）`,
      histRules: '规则版本', histDones: '你点过“看完了”的版本', histNoDone: '这首歌还没有点过“看完了”的版本。',
      histRule: (n) => (n ? `第 ${n} 版规则` : '旧的自动结果（没记版本号）'),
      histKind: { current: '现在用的', first: '最初的自动结果', used: '页面上用过', try: '试判过，没上过页面' },
      histDiff: (n) => (n ? `和现在不同 ${n} 格` : '和现在一样'), histDoneAt: (t) => `${t} 点的“看完了”`, histDoneN: (n) => `改了 ${n} 格`,
      histNowTag: '现在就是这一版', histView: '看一看', histRestore: '回退到这一版',
      histUndo: '撤销上一次回退', histUndoNote: (w, t, act) => (act === 'undo' ? `上一次：${t} 撤销了一次回退（再点就是撤销这次撤销）` : `上一次：${t} 回退到${w}`), histUndoAsk: '撤销上一次回退，回到回退之前的样子？',
      histAt: (kind, t) => (kind === 'current' ? `${t} 起用` : kind === 'try' ? `${t} 试判` : `用到 ${t}`),
      histFoot: '“看一看”不改任何东西。回退会先把现在的样子备份，回退以后这里会出现“撤销上一次回退”。按小节的结果会跟着重做。',
      histPreview: (t) => `正在看：${t}`, histPreviewKeep: '（留着你改过的格子）', histPreviewPure: '（规则原样，不含你的改动）',
      histBack: '回到现在', histBusy: '正在看历史版本，不能改。点“回到现在”再改，或者直接回退到这一版。',
      histConfirm: (t) => `回退到：${t}？\n\n现在的样子会先备份，回退以后可以在“历史版本”里撤销。`,
      histConfirmDrop: (n) => `\n\n没勾“留着我改过的格子”：你在这首歌上改过的 ${n} 格这次不接上去（备份里还有）。`,
      histDone: (w) => `已回退到${w}。`, histUndone: '已撤销上一次回退。', histRestoreFail: (m) => `没回退成功：${m}`,
      tipVer: (s) => `这一版：${s}`, tipCur: (s) => `（现在：${s}）`,
      gridHead: '拍速与网格',
      gridSrcAuto: '拍点：<b>自动识别</b>', gridSrcAutoX2: '拍点：<b>自动识别，再加倍</b>', gridSrcAutoHalf: '拍点：<b>自动识别，再减半</b>',
      gridSrcManual: '拍点：<b>手动的匀速网格</b>', gridNoPreview: '自动识别的拍点要重新识别以后才画得出来。',
      gridHalfTip: '程序把拍速认成了两倍时用：隔一拍取一拍', gridDoubleTip: '程序把拍速认成了一半时用：每两拍之间加一拍',
      gridBpb: '每小节', gridBpbUnit: '拍', gridShift: '小节线', gridShiftTip: '把小节线挪一拍（第 1 小节的起点跟着挪）。只动顶上的小节标尺，不影响标记',
      gridAnchor: '把播放线这里定为第 1 小节的起点',
      gridAnchorTipAuto: '离播放线最近的那条拍线成为第 1 小节的第一拍，它前面的拍算弱起（第 0 小节、第 −1 小节）。只动小节标尺，不影响标记',
      gridAnchorTipManual: '整个网格以播放线为准对齐：播放线所在的地方就是第 1 小节的第一拍',
      gridFit: '把最近的一拍对到播放线上（微调拍速）',
      gridFitTip: '第 1 小节的起点不动，把拍速稍微改一点，让离播放线最近的那一拍正好落在播放线上。先把歌的开头对好，再到后面找一个拍点用它，拍速就准了',
      gridFitNear: '播放线离第 1 小节的起点太近了。到歌的后面找一个拍点再用。',
      gridAuto: '恢复自动识别的拍点',
      gridHint: '改拍速：声音不动，格子线从第 1 小节的起点往两头重新排。对齐：格子线不动，声音挪。两种都不改声音文件。标记跟着声音走：每一段留在原来的声音上，边界对到新的格子线。改动会自动保存；挪回原来的位置，标记也原样回来。想让程序按新网格重新判断，再点“重新识别”。',
      gridCancel: '放弃改动', gridPending: '网格正在保存，稍等一下再改标注。',
      gridBusy: '正在重新识别，等它做完。', gridSaveFail: (m) => `小节的设置没存上：${m}`,
    },
    en: {
      docTitle: 'Voice Function Recognition', kicker: '声部功能识别',
      heroTitle: '<span class="ln"><b>Voice <em>function</em></b></span><span class="ln"><b>recognition</b></span>',
      lede: 'A stem does not do one thing for a whole song: sometimes it carries the melody, sometimes it steps back into the harmony, sometimes it rests. This page lays out what every stem is doing on every beat, so you can check the automatic result and fix whatever is wrong.',
      foot: 'Demo　·　the 6 songs marked ♪ can be played; the rest show labels and waveforms only　·　edits are not saved　·　audio from MoisesDB (CC BY-NC-SA 4.0), compressed',
      count: (n, d) => `${n} songs · ${d} reviewed`, tabCount: (n) => `${n} songs`,
      level1: 'L1', level2: 'L2', fnAcc: 'Accompaniment', fnAccEn: 'ACCOMPANIMENT',
      levelTip: 'Two labelling targets. Level 1: all six functions kept apart. Level 2: figure accompaniment is folded into chordal accompaniment as one “accompaniment”. This only changes the view; six classes are always stored and you can switch back at any time',
      fnAccNote: 'Accompaniment: chordal and figure accompaniment are not told apart at level 2. Cells already labelled as either are left as they are',
      ruleNew: 'New rule', ruleFrom: 'From this song on, the automatic labels use the new rule', ruleMeta: 'auto labels: new rule',
      viewBeat: 'Beats', viewBar: 'Bars', viewTip: 'Beats: one function per beat (rule 7). Bars: four beats per bar, one function per bar (two allowed). Edits are saved separately for each view.',
      noBar: 'This song has no bar-level result yet; showing beats.', barsN: (n) => `${n} bars`, barSrc: (s) => `bar lines: ${s}`,
      barConfirm: ' (beat 1 is estimated; please confirm it with the bar ruler in the beat view)', barCapBar: 'Bars', barOf: (k, n) => (k ? `bar ${k} of ${n}` : `before bar 1 · ${n} bars`),
      ruleVer: (n) => `rule v${n}`, ruleMetaV: (n) => `auto labels: rule v${n}`,
      ruleNoteV: (n) => (n >= 6 ? 'Rule 6 adds two things to rule 5: looping accompaniment (where a stem keeps bringing the same sound back one, two or four bars later for a long stretch, it is accompaniment, not a counter-melody), and a rule of its own for backing vocals (never the lead; harmony while the lead sings unless doubling; a counter-melody only for a line of their own in a gap of the lead). '
        : n >= 5 ? 'Rule 5: leads are judged per passage (at least 8 beats, several checks); one sustained note has one function; doubling means changing notes together with a melody; a stem made of several recordings is judged per recording, and different functions give a double function. '
        : n >= 3 ? 'Rule 3: a lead that is interrupted for a few beats and comes back is kept as the lead; slow melodies in long notes count as counter-melody. '
        : 'Rule 2: the old rule of 2026-10-12, without what the later versions added. ') + 'See the rule document in the project.',
      findPh: 'Search by number or title', findCount: (n, m) => `${n} of ${m} songs`, findNone: (q) => `No song whose number or title matches “${q}”.`, findClear: 'Clear search', toTop: 'Back to top',
      ruleNote: 'The new rule (from 2026-10-13) changes two things, both judged over several bars: who leads (a lead that is interrupted for a few beats and comes back is kept as the lead), and slow melodies in long notes now count as counter-melody. Everything else is as before. Beats where the two rules disagree are marked uncertain. Songs above this line were labelled with the old rule',
      beats: (n) => `${n} beats`, pitched: (n) => `${n} pitched stems`, reviewed: 'Reviewed', edits: (n) => `${n} edited`,
      emptyTab: 'Nothing has been analysed in this set yet.', libFail: (m) => `Could not load the song list: ${m}`,
      libOffline: 'The song list did not load. Please reload the page.', _libOffline: ' Check that the black “启动标注页” window is open (closing it stops the service); if it is not, double-click “启动标注页.bat” in the project folder. Retrying every 3 seconds: the song list appears by itself once it connects.',
      back: '← All songs', ringAria: 'Overview of the whole song. Click to jump there', tlAria: 'Function timeline', playAria: 'Play or pause (Space)', zoomAria: 'Zoom',
      brushHead: 'Brush', noteHead: 'Notes', notePh: 'Problems found in this song, e.g. a class that is often wrong', doneBtn: 'I have finished this song',
      modeAria: 'What a click on the timeline does', modePoint: 'Pointer', modeEdit: 'Edit', modeListen: 'Audition',
      modePointTip: 'Plain pointer: a click only moves the playhead and changes nothing (V)',
      modeAlign: 'Align', modeAlignTip: 'Drag left or right: bar lines, beat lines and bar numbers stay where they are, and all stems slide together with their own time ruler until the downbeat sits on a bar line (G). The tempo does not change. Arrow keys move 5 ms, 20 ms with Shift. Saved automatically when you let go',
      metroBtn: 'Metronome', metroTip: 'Clicks on every beat during playback, higher on the first beat of a bar (M). It always follows the grid you see',
      applyBtn: 'Save again', applyTip: 'Grid changes are normally saved automatically; the last one failed, press here to try again', dropBtn: 'Discard this change',
      regridRunning: () => 'Saving the grid…', regridUndone: 'Grid saved. Some labels moved to another cell, so “finished” was unticked; tick it again after checking.',
      gridSaved: (t) => `Grid saved ${t}`, leaveUnsavedGrid: 'The grid change was not saved. Leave this song anyway? (The change will be lost)',
      regridFail: (m) => `The grid was not saved: ${m}`,
      rePendBlind: 'Grid changed, saving in a moment… (this change is only visible once saved)',
      alignMoved: (ms, beats) => `Audio moved ${Math.abs(ms)} ms ${ms > 0 ? 'later' : 'earlier'} (${beats} beats)`,
      gridNudge: 'Slide all stems', gridNudgeTip: 'Move the whole song 5 ms earlier or later. Bar and beat lines stay where they are; the tempo does not change',
      gridOffset: (ms) => (ms ? `Relative to the detected beats, the audio is moved ${Math.abs(ms)} ms ${ms < 0 ? 'later' : 'earlier'}` : ''),
      modeEditTip: 'Click or drag to set those beats to the brush function; hold Shift to add it to what is already there (E)', modeListenTip: 'Click to jump there and hear only that stem (L)',
      clearSolo: 'Back to full mix', prevU: '← Uncertain', nextU: 'Uncertain →', prevUTip: 'Previous uncertain spot ([)', nextUTip: 'Next uncertain spot (])',
      showU: 'Mark uncertain', showUTip: 'Show or hide the small circles on uncertain beats', showW: 'Waveform', showWTip: 'Show each stem’s loudness contour behind its lane',
      undo: 'Undo', redo: 'Redo', undoTip: 'Undo (Ctrl+Z)', redoTip: 'Redo (Ctrl+Y)', follow: 'Follow', followTip: 'Keep the playhead in view while playing (F)', fit: 'Fit', fitTip: 'Fit the whole song on screen',
      ribbon: 'Who holds the lead', unclassified: 'Unclassified', solo: 'S', soloTip: 'Hear only this stem (several can be selected)',
      fn: ['Rest', 'Lead', 'Doubling', 'Counter-melody', 'Chords', 'Figure'],
      fnNote: ['No sound on this beat', 'The most prominent melodic line', 'Plays the same notes as the lead', 'A second, independent melody that does not loop',
        'Chords and rhythm only: block chords, strumming, sustained notes, root-note bass, two-note grooves',
        'A short accompaniment figure with rhythm and contour that keeps recurring: riffs, vamps, arpeggio patterns, ostinatos. Exact, slightly varied, or moved with the harmony'],
      restore: 'Restore automatic label', restoreNote: 'Set these beats back to what the program decided', plus: ' + ', fnDual: 'Two functions', fnDualEn: 'TWO FUNCTIONS', addBtn: 'Add a second function', addHint: 'Or hold Shift while painting',
      addNeedsRestart: 'Two functions per cell needs the labelling service to be restarted once: double-click “启动标注页.bat” in the project folder, press any key to let it take over, then reload this page (F5). Everything else works as before.',
      addTip: 'Two functions at once: for a stem that holds two things, e.g. one guitar strumming chords and another playing a counter-melody. While this is on, the brush does not replace those beats; it adds its function to what is already there and the two are drawn stacked. If a cell already has two, the one of the same kind as the brush is replaced (melodic: lead, doubling, counter-melody; accompaniment: chords, figure). Adding “Rest” removes the second one. To go back to a single function, turn this off and paint as usual (D)',
      fHand: 'lead hand-offs', fLeads: 'stems have held the lead', fNoLead: 'No stem is labelled as lead yet',
      fUnsure: (n) => `uncertain spots (${n} beats)`, fEdited: 'cells edited by you',
      fNone: (n) => `Beats with sound but no lead: ${n}`, fMulti: (n) => `Beats with two or more leads: ${n}`,
      beatOf: (bar, beat, b, n) => `Bar ${bar} · beat ${beat} · ${b} / ${n}`, leadNow: (s) => `Lead: ${s}`, sep: ', ', loading: ' · loading…',
      listenMix: 'Playing: <b>full mix</b>', listenSolo: (s) => `Solo: <b>${s}</b>`, many: (n) => `${n} at once`,
      tipBeat: (bar, beat, b, a, c) => `Bar ${bar}, beat ${beat} (cell ${b}) · ${a}–${c}`, tipNow: (s) => `Now: ${s}`, tipWas: (s) => `(program said: ${s})`,
      tipUnsure: 'Uncertain: a small shift of the thresholds would change this beat', tipUncls: 'Drums, percussion and FX are not classified. Use the S button to hear them alone',
      saveErr: (m) => `Not saved: ${m} (click to retry)`, saving: 'Saving…', savePending: 'Unsaved changes, saving shortly',
      saved: (t, n) => (n ? `${n} cell${n === 1 ? '' : 's'} edited · ` : '') + 'demo, edits are not saved', saveNone: 'Demo: you can try edits, but nothing is saved',
      stale: 'The automatic result was regenerated with a different beat grid, so earlier edits no longer line up and were not loaded. The old file is kept as a separate copy on the next save.',
      rebased: (n) => `The automatic result was regenerated. Your ${n} earlier edit${n === 1 ? ' has' : 's have'} been carried over onto the new result.`,
      badFile: 'The file with your earlier edits cannot be read, so the automatic result is shown. The old file will be kept as a separate copy, not overwritten.',
      conflict: 'Not saved: this song was saved from another page (click to resolve)', conflictAsk: 'This song was saved from another page. Overwrite it with what is on this page?',
      autoChanged: 'Not saved: the automatic result for this song was just regenerated. Your edits were kept in a separate file, nothing is lost. Please reload the page.',
      leaveUnsaved: 'Your last edits were not saved. Leave this song anyway? (Those edits will be lost)',
      noMoreNext: 'No uncertain spots after this point', noMorePrev: 'No uncertain spots before this point', audioFail: (m) => `Audio failed to load: ${m}`, cantRead: (f) => 'this demo has labels and waveforms only for this song; the songs marked ♪ can be played',
      audioOffline: 'The audio did not load. Check your connection and reload the page.', _audioOffline: '(it restarts by itself within a few seconds). Wait a moment and press play again; if it keeps failing, double-click “启动标注页.bat” in the project folder.',
      outDefault: 'System default', outLabel: (s) => `Output: ${s}`, outTip: 'Choose which device plays the sound, e.g. your audio interface',
      outUnsupported: 'This browser cannot switch the output device from a web page. Change it in the system sound settings, or use a recent Chrome / Edge.',
      outNeedPerm: 'The browser only reveals device names after microphone permission has been granted once. It is used for the names only; nothing is recorded.',
      outAsk: 'List all output devices', outDenied: 'Permission was not granted, so only the system default is available.',
      outNoMic: 'This computer has no usable recording device right now, so the browser will not reveal output device names. Set your audio interface as the default output in the system sound settings instead.',
      outGone: (s) => `Output device “${s}” is gone. Switched back to the system default.`, outFail: (m) => `Could not switch: ${m}`, outNone: 'No other output device found',
      coll: { moises: ['MoisesDB · full songs', 'real recordings, native stems'], suno: ['Suno pilot', 'generated music, stems exported by Suno'] },
      sunoKicker: 'Generated by Suno', secAria: 'Sections', secLabels: 'Labels', secRegen: 'Regeneration',
      barCap: (n) => `Bars · ${n} per bar`,
      bpmTip: 'The tempo the program measured. Open to correct the tempo, align the grid, or move the bar lines', gridManualTag: 'manual',
      retBtn: 'Return on stop',
      retTip: 'On: stopping with Space sends the playhead back to where this playback started (or where you last clicked), so Space plays the same spot again. Off: playback resumes from where it stopped. Hold Shift with Space to use the other behaviour once. Cubase calls this Return to Start Position on Stop',
      reBtn: 'Re-run recognition', reBtnPend: 'Re-run on the new grid',
      reTip: 'Have the program recompute the voice functions for this song, usually in ten to twenty seconds. Your edits are kept: carried over as they are if the grid is unchanged, moved by time if the grid changed',
      reRunning: (n) => `Recognising… ${n} s`, rePend: 'Grid changed, saving in a moment…',
      reSame: (n) => (n ? `Recognition finished. ${n} beat${n === 1 ? '' : 's'} of the automatic result changed.` : 'Recognition finished. The result is the same as before.'),
      reMoved: (n) => `Recognised on the new grid. Your edits were moved by time onto it: ${n} cell${n === 1 ? '' : 's'} now.`, reNew: 'Recognised on the new grid.',
      reFail: (m) => `Recognition failed: ${m}`, reNeedSave: 'Your last edits are not saved yet. Sort out saving first, then re-run.',
      histBtn: 'History', histTip: 'Earlier rule versions of this song and the versions you marked “finished”: look at one, or go back to it. The current state is backed up first and can be restored',
      histHead: 'History', histClose: 'Close', histLoading: 'Reading the history…', histFail: (m) => `Could not read the history: ${m}`,
      histKeep: (n) => `When going back to a rule version, keep my ${n} edited cell${n === 1 ? '' : 's'} on top of it`,
      histRules: 'Rule versions', histDones: 'Versions you marked “finished”', histNoDone: 'This song has no version marked “finished” yet.',
      histRule: (n) => (n ? `Rule version ${n}` : 'Older automatic result (no version number)'),
      histKind: { current: 'in use now', first: 'first automatic result', used: 'used on this page before', try: 'trial run, never on the page' },
      histDiff: (n) => (n ? `${n} cell${n === 1 ? '' : 's'} differ from now` : 'same as now'), histDoneAt: (t) => `Marked “finished” at ${t}`, histDoneN: (n) => `${n} cell${n === 1 ? '' : 's'} edited`,
      histNowTag: 'this is what you see now', histView: 'Look', histRestore: 'Go back to this',
      histUndo: 'Undo the last go-back', histUndoNote: (w, t, act) => (act === 'undo' ? `Last time (${t}) you undid a go-back (pressing this undoes that undo)` : `Last time (${t}) you went back to: ${w}`), histUndoAsk: 'Undo the last go-back and return to the state before it?',
      histAt: (kind, t) => (kind === 'current' ? `in use since ${t}` : kind === 'try' ? `trial run ${t}` : `used until ${t}`),
      histFoot: '“Look” changes nothing. Going back first backs up the current state; afterwards “Undo the last go-back” appears here. The bar view is redone to match.',
      histPreview: (t) => `Looking at: ${t}`, histPreviewKeep: '(with your edits on top)', histPreviewPure: '(the rule as it was, without your edits)',
      histBack: 'Back to now', histBusy: 'You are looking at an earlier version and cannot edit it. Press “Back to now” to edit, or go back to this version.',
      histConfirm: (t) => `Go back to: ${t}?\n\nThe current state is backed up first; you can undo this under “History”.`,
      histConfirmDrop: (n) => `\n\n“Keep my edited cells” is off: your ${n} edited cell${n === 1 ? '' : 's'} on this song will not be carried over this time (they stay in the backup).`,
      histDone: (w) => `Went back to ${w}.`, histUndone: 'The last go-back was undone.', histRestoreFail: (m) => `Could not go back: ${m}`,
      tipVer: (s) => `This version: ${s}`, tipCur: (s) => `(now: ${s})`,
      gridHead: 'Tempo and grid',
      gridSrcAuto: 'Beats: <b>detected automatically</b>', gridSrcAutoX2: 'Beats: <b>detected, then doubled</b>', gridSrcAutoHalf: 'Beats: <b>detected, then halved</b>',
      gridSrcManual: 'Beats: <b>manual, even grid</b>', gridNoPreview: 'The detected beats can only be drawn after re-running.',
      gridHalfTip: 'Use when the program heard double tempo: keep every other beat', gridDoubleTip: 'Use when the program heard half tempo: add a beat between every two',
      gridBpb: 'Beats per bar', gridBpbUnit: '', gridShift: 'Bar lines', gridShiftTip: 'Move the bar lines by one beat (bar 1 moves with them). Only the bar ruler changes, not the labels',
      gridAnchor: 'Make this the start of bar 1',
      gridAnchorTipAuto: 'The beat line nearest to the playhead becomes beat 1 of bar 1; beats before it are a pickup (bar 0, bar −1). Only the bar ruler changes, not the labels',
      gridAnchorTipManual: 'Align the whole grid to the playhead: beat 1 of bar 1 is exactly there',
      gridFit: 'Pull the nearest beat onto the playhead (fine-tune tempo)',
      gridFitTip: 'Keeps the start of bar 1 where it is and changes the tempo slightly so that the beat nearest to the playhead lands on it. Align the start of the song first, then use this on a beat late in the song to get the tempo exact',
      gridFitNear: 'The playhead is too close to the start of bar 1. Use a beat later in the song.',
      gridAuto: 'Back to the detected beats',
      gridHint: 'Changing the tempo: the audio stays put and the grid lines are re-spaced outwards from the start of bar 1. Aligning: the lines stay put and the audio moves. Neither touches the audio files. Labels follow the audio: every stretch stays on the sound it was on and its ends snap to the new lines. Changes are saved automatically; move back and the labels come back exactly. Press “Re-run recognition” if you want the program to judge again on the new grid.',
      gridCancel: 'Discard', gridPending: 'The grid is being saved. Try again in a moment.',
      gridBusy: 'Recognition is running. Wait for it to finish.', gridSaveFail: (m) => `Bar settings were not saved: ${m}`,
    },
  };
  let LANG = store.get('fn-lang') === 'en' ? 'en' : 'zh';
  const T = (k, ...a) => { const v = STR[LANG][k]; return typeof v === 'function' ? v(...a) : v; };
  // 标注的两级目标。一级：六类都分开。二级：音型伴奏（5）并进和弦伴奏（4），合称“伴奏”。
  // 只是看法不同：存下来的、提取器给出的始终是六类；lv() 把一个值换成“在当前这一级里算哪一类”
  let LEVEL = store.get('fn-level') === '2' ? 2 : 1;
  let VIEW = store.get('fn-view') === 'bar' ? 'bar' : 'beat';      // 按拍 / 按小节（2026-10-14）
  // 双重功能（2026-10-13）：一格里可以同时有两个功能（一条轨里一把吉他扫和弦、另一把走副旋律）。
  // 还是每格一个数：只有一个功能时是 0–5，和以前一样；有两个时是 p + 10 × q，p 是排在前面的那个
  // （主旋律 > 副旋律 > 叠奏 > 音型伴奏 > 和弦伴奏，也就是画得高的在前）。例：43 = 副旋律 + 和弦伴奏。
  const RANK = [9, 0, 2, 1, 4, 3];
  const fn1 = (v) => v % 10, fn2 = (v) => (v - v % 10) / 10;       // 一格里的第一个、第二个功能（没有第二个就是 0）
  const pair = (a, b) => (!a ? b : !b || a === b ? a : RANK[a] < RANK[b] ? a + 10 * b : b + 10 * a);
  const hasFn = (v, f) => fn1(v) === f || fn2(v) === f;
  const okFn = (v) => Number.isInteger(v) && v >= 0 && (v < 6 || (fn1(v) >= 1 && fn1(v) <= 5 && fn2(v) >= 1 && fn2(v) <= 5 && pair(fn1(v), fn2(v)) === v));
  // 在原有功能上再加一个。已经有两个时：和画笔同一类（旋律类 1 2 3 / 伴奏类 4 5）的那个被换掉；分不出来就换掉排在后面的那个。
  // 用“休止”去加：去掉后一个功能
  const famOf = (f) => (f === 4 || f === 5 ? 1 : 0);
  function addFn(old, f) {
    const a = fn1(old), b = fn2(old);
    if (!f) return a;
    if (!a) return f;
    if (a === f || b === f) return old;
    if (!b) return pair(a, f);
    return famOf(a) === famOf(f) && famOf(b) !== famOf(f) ? pair(b, f) : pair(a, f);
  }
  const lv1 = (v) => (LEVEL === 2 && v === 5 ? 4 : v);
  const lv = (v) => (v < 10 ? lv1(v) : pair(lv1(fn1(v)), lv1(fn2(v))));
  const fnName1 = (v) => (LEVEL === 2 && lv1(v) === 4 ? T('fnAcc') : T('fn')[v]);
  const fnName = (v) => { const w = lv(v); return fn2(w) ? fnName1(fn1(w)) + T('plus') + fnName1(fn2(w)) : fnName1(v < 10 ? v : w); };
  const GENRE = {
    zh: { pop: '流行', rock: '摇滚', electronic: '电子', reggae: '雷鬼', world_folk: '世界 / 民谣', bossa_nova: '波萨诺瓦', singer_songwriter: '创作歌手', rap: '说唱', jazz: '爵士', blues: '布鲁斯', country: '乡村', musical_theatre: '音乐剧' },
    en: { pop: 'Pop', rock: 'Rock', electronic: 'Electronic', reggae: 'Reggae', world_folk: 'World / Folk', bossa_nova: 'Bossa nova', singer_songwriter: 'Singer-songwriter', rap: 'Rap', jazz: 'Jazz', blues: 'Blues', country: 'Country', musical_theatre: 'Musical theatre' },
  };
  const STEM_EN = { vocals: 'Vocals', backing_vocals: 'Backing vocals', woodwinds: 'Woodwinds', brass: 'Brass', strings: 'Strings', guitar: 'Guitar', keyboard: 'Keyboard', synth: 'Synth', bass: 'Bass', drums: 'Drums', percussion: 'Percussion', fx: 'FX' };
  const pretty = (s) => { s = String(s).replace(/_/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };
  const genreName = (g) => (g ? (GENRE[LANG][g] || pretty(g)) : '');
  const stemName = (r) => (LANG === 'zh' ? r.zh : (STEM_EN[r.name] || pretty(r.name)));
  const stemSub = (r) => (LANG === 'zh' ? r.name : (r.zh !== r.name ? r.zh : ''));
  function applyStatic() {
    document.documentElement.lang = LANG === 'zh' ? 'zh-CN' : 'en';
    $$('[data-t]').forEach((e) => { e.textContent = T(e.dataset.t); });
    $$('[data-t-html]').forEach((e) => { e.innerHTML = T(e.dataset.tHtml); });
    for (const attr of ['title', 'placeholder', 'aria-label']) $$(`[data-t-${attr}]`).forEach((e) => e.setAttribute(attr, T(e.getAttribute(`data-t-${attr}`))));
    $$('.lang button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.lang === LANG));
    $$('.lvl button').forEach((b) => b.setAttribute('aria-pressed', +b.dataset.level === LEVEL));
  }

  // 六类功能的颜色与高度。h 是这一类在行里画多高（占行高的比例）：主旋律 > 副旋律 > 叠奏 > 音型伴奏 > 和弦伴奏。
  // 编号 4 原来叫“和声”，2026-10-12 拆成两类：4 是和弦伴奏（只给和弦和节奏），5 是音型伴奏（反复出现的、有节奏也有走向的一小段）。
  // 名字是用户定的；“固定音型”严格只指原样重复，所以没有用它。旧文件里的 4 照旧读作和弦伴奏。
  const FN = [
    { color: null, h: 0, key: '1' }, { color: '#ee5e23', h: 1, key: '2' }, { color: '#c21f55', h: 0.58, key: '3' },
    { color: '#01a2c5', h: 0.78, key: '4' }, { color: '#2f66c4', h: 0.26, key: '5' }, { color: '#9e71fd', h: 0.42, key: '6' },
  ];
  const INK = '243,239,232';
  // RULER：顶上两行刻度的总高（时间一行，小节一行）；TROW：时间那一行的高
  const RULER = 46, TROW = 22, RIBBON = 34, HEADW = 172;
  const MAXPPS = 240;       // 最多放大到每秒多少像素（对网格的时候要看得清一拍以内的位置）

  async function api(url, opt) {
    const r = await fetch(url, opt);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { const err = new Error(j.error || ('HTTP ' + r.status)); err.code = j.code || ''; err.status = r.status; throw err; }
    return j;
  }
  const audioUrl = (s, file) => `/audio/${s.c}/${s.id}/` + file.split('/').map(encodeURIComponent).join('/');

  let toastTimer = 0;
  function toast(msg, ms = 3200) {
    const t = $('#toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, ms);
  }

  function eachRun(arr, from, to, fn) {
    let a = from;
    while (a < to) {
      let b = a + 1;
      while (b < to && lv(arr[b]) === lv(arr[a])) b++;
      fn(a, b, lv(arr[a]));
      a = b;
    }
  }

  // 已保存的修改怎么用，取决于它是照哪一版自动识别结果改的：
  //   full   就是照现在这一版改的 → 整份载入
  //   edits  自动识别结果重新生成过，但拍的划分没变 → 只把用户改过的那几格接到新结果上
  //   stale  拍的划分变了，或旧文件对不上 → 不载入，也不沿用“看完了”
  //   bad    文件在但读不出来 → 不载入，提示用户
  function buildSong(c, id, data) {
    const a = data.auto, n = a.edges.length - 1, cor = data.corrected;
    const ok = okFn;
    const pitchedStems = a.stems.filter((s) => s.kind === 'pitched');
    let use = data.corrected_state === 'bad' ? 'bad' : 'none', rebased = 0;
    if (cor && cor.labels && typeof cor.labels === 'object') {
      const fits = pitchedStems.every((s) => Array.isArray(cor.labels[s.name]) && cor.labels[s.name].length === n && cor.labels[s.name].every(ok));
      if (cor.auto_fp) {
        if (cor.auto_fp === data.auto_fp && fits) use = 'full';
        else if (cor.edits && cor.edges_fp && cor.edges_fp === data.edges_fp) use = 'edits';
        else use = 'stale';
      } else {
        // 旧格式的文件没有指纹：数一数它和现在的自动识别结果差几格，和当时记下的改动数一样才算是照这一版改的
        let diff = 0;
        if (fits) pitchedStems.forEach((s) => { const lab = cor.labels[s.name]; for (let b = 0; b < n; b++) if (lab[b] !== s.labels[b]) diff++; });
        use = fits && diff === (cor.n_changed || 0) ? 'full' : 'stale';
      }
      if (use === 'stale' && !cor.n_changed) use = 'none';      // 对不上，但里面本来就没有用户的改动：没有东西可丢，不必提示
    }
    const rows = a.stems.filter((s) => s.kind !== 'empty').map((s) => {
      const pitched = s.kind === 'pitched';
      let cur = null;
      if (pitched) {
        cur = Int8Array.from(use === 'full' ? cor.labels[s.name] : s.labels);
        if (use === 'edits') for (const [b, v] of Object.entries(cor.edits[s.name] || {})) { const i = +b; if (i >= 0 && i < n && ok(v) && cur[i] !== v) { cur[i] = v; rebased++; } }
      }
      return { name: s.name, zh: s.zh || s.name, kind: s.kind, file: s.file, level: s.level_db,
        auto: pitched ? s.labels : null, cur, unstable: pitched ? s.unstable : null, peaks: null, y: 0, h: 0 };
    });
    rows.sort((p, q) => (p.kind === 'pitched' ? 0 : 1) - (q.kind === 'pitched' ? 0 : 1));
    const meta = data.meta || {}, live = use === 'full';     // 自动识别结果换过以后，“看完了”不再算数
    const edges = Float64Array.from(a.edges), dur = new Float64Array(n);
    for (let b = 0; b < n; b++) dur[b] = edges[b + 1] - edges[b];
    const gu = data.grid_user || {}, S = data.source && Array.isArray(data.source.edges) && data.source.rows ? data.source : null;
    const song = { c, id, title: meta.song || id, artist: meta.artist || '', genre: meta.genre || '', n, bpm: a.bpm, duration: a.duration,
      edges, dur, rows, mix: a.mix_file, use, rebased, peakRate: 0, changed: 0, leadRuns: [],
      autoFp: data.auto_fp || '', rev: (cor && Number.isInteger(cor.rev)) ? cor.rev : 0,
      done: live && !!cor.done, note: (cor && typeof cor.note === 'string') ? cor.note : '', savedAt: live ? (cor.saved_at || '') : '',
      // 网格：grid 是现在这套拍点的来历；draft 是页面上改了、还没应用的草稿；live 是有草稿时收起来的原件（见 setDraft）
      canDual: !!(data.caps && data.caps.dual),      // 服务端认不认双重功能（还没重启过的旧服务不认，存不下）
      view: data.view === 'bar' ? 'bar' : 'beat', barInfo: a.bar_info || null,
      rule: Number.isInteger(a.rule_version) ? a.rule_version : 2,
      grid: a.grid || { mode: 'auto', factor: 1 }, autoBpm: a.auto_bpm || a.bpm, autoBeats: a.auto_beats || null,
      firstBeat: typeof a.first_beat === 'number' ? a.first_beat : null, draft: null, live: null, noPreview: false, gridRev: 0,
      // 出处：这套标记最后一次是在哪套格子上定下来的（没有，就是现在这一份自己）。换网格时从它搬，见 pickBase
      src: S ? { edges: Float64Array.from(S.edges), rows: rows.map((r) => { const q = S.rows[r.name]; return r.cur && q && Array.isArray(q.cur) && Array.isArray(q.auto) ? { cur: q.cur, auto: q.auto, unstable: Array.isArray(q.unstable) ? q.unstable : null } : null; }) } : null,
      // 小节：每小节几拍、小节从哪里起（秒；没设过就从程序找到的第一拍起）。只管顶上的小节标尺
      bpb: data.view === 'bar' ? 1 : clamp(Math.round(gu.beats_per_bar) || 4, 1, 12),
      barAt: data.view === 'bar' ? (a.bar_info && a.bar_info.pickup && edges.length > 2 ? edges[1] : edges[0]) : (typeof gu.bar_at === 'number' ? gu.bar_at : null), bar0: 0 };
    setBars(song);
    return song;
  }

  // ---- 拍线与小节
  // 格子的边界里，除了开头的 0 秒（那只是歌的开头，不一定踩在拍上），每一个都是一条拍线。
  // 拍线往歌的开头之前也照样排，所以第 1 小节可以起在歌开头之前，歌最前面的几拍也可以落在第 1 小节之前（弱起，算第 0、第 −1 小节）。
  // 拍线的编号 j：歌里第一条是 0，往后 1、2、3…，歌开头之前的是 −1、−2…。s.j1 是第 1 小节第一拍的那一条；s.barAt 是它的时间（秒，可以是负的）。
  // 小节只是顶上的一条标尺，不影响标记。
  function setBars(s) {
    const e = s.edges, n = s.n, off = e[0] === 0 && n > 1 ? 1 : 0, gaps = [];
    for (let i = off; i < Math.min(n - 1, off + 8); i++) gaps.push(e[i + 1] - e[i]);
    s.off = off; s.head = gaps.length ? median(gaps) : Math.max(0.05, e[n] - e[off]);
    // 歌开头之前的拍线：pre 是知道确切位置的那几条（离歌的开头由近到远），再往前从 preFrom 起每隔 preStep 一条。
    // 手动网格按锚点算；自动拍点被整体往前挪过时，落到歌开头之前的那几拍就用它们自己的位置（自动拍点不是匀速的）
    const g = curGrid(s), first = e[off];
    s.pre = []; s.preFrom = first; s.preStep = s.head;
    if (!s.noPreview && g.mode === 'manual') { s.preStep = 60 / g.bpm; s.preFrom = g.anchor + Math.round((first - g.anchor) / s.preStep) * s.preStep; }
    else if (!s.noPreview) {
      const sh = autoLines(s, g);
      if (sh && sh.length > 8) {
        const step = median(sh.slice(1, 9).map((t, i) => t - sh[i])), k = (sh[0] - first) / step;
        // 先核对这一套拍点确实就是现在画着的这一套：歌里第一条线要么是其中一拍，要么是从第一拍按同样的间隔往前补出来的
        if (sh.some((t) => Math.abs(t - first) < 0.0015) || (k > 0.5 && Math.abs(k - Math.round(k)) * step < 0.003)) {
          s.preStep = step;
          s.pre = sh.filter((t) => t < first - 0.5 * s.head).map(r3).reverse();
          if (s.pre.length) s.preFrom = s.pre[s.pre.length - 1];
        }
      }
    }
    // 没设过第 1 小节：从歌曲开头数起。歌开在哪一拍里就从那一拍起；开头只剩不到半拍的零头，就从下一拍起
    s.j1 = s.barAt != null ? lineNear(s, s.barAt) : (off && e[1] - e[0] >= 0.5 * s.head ? -1 : 0);
    s.bar0 = off + s.j1;                     // 换算成边界的序号（可以是负的）：数第 i 格是第几小节第几拍时用
  }
  function lineTime(s, j) {                  // 第 j 条拍线的时间
    if (j >= 0) return s.edges[Math.min(s.off + j, s.n)];
    const k = -j - 1;
    return k < s.pre.length ? s.pre[k] : s.preFrom - (k - s.pre.length + 1) * s.preStep;
  }
  function lineNear(s, t) {                  // 离时间 t 最近的拍线是第几条（可以是歌开头之前的）
    const e = s.edges, off = s.off;
    if (t >= e[off]) {
      let best = Infinity, p = off;
      for (let i = off; i < s.n; i++) { const d = Math.abs(e[i] - t); if (d < best) { best = d; p = i; } else if (e[i] > t) break; }
      return p - off;
    }
    for (let j = 0, cur = e[off]; ; j--) {   // 在歌里第一条线之前：一条一条往前找
      const nx = lineTime(s, j - 1);
      if (nx <= t || j < -8192) return t - nx < cur - t ? j - 1 : j;
      cur = nx;
    }
  }
  // 第 i 格在第几小节、第几拍（拍从 1 数；第 1 小节之前的小节是 0、−1）
  function barBeat(s, i) { const q = i - s.bar0; return [Math.floor(q / s.bpb) + 1, (q % s.bpb + s.bpb) % s.bpb + 1]; }
  // 画面最左能到哪里：第 1 小节的起点，或者歌开头所在的那一小节的起点，取靠前的那个（不会晚于 0 秒）。
  // 歌开头之前那一段没有声音，只有格子线。歌开头离某条拍线不到四分之一拍时，就当它是踩在那条线上开的头
  function viewMin(s) {
    let jStart = 0;
    while (lineTime(s, jStart) > 0.25 * s.head && jStart > -8192) jStart--;
    const jFloor = s.j1 + Math.floor((jStart - s.j1) / s.bpb) * s.bpb;
    return Math.min(0, lineTime(s, Math.min(s.j1, jFloor)));
  }
  const viewHome = (s) => Math.min(0, lineTime(s, s.j1));      // 打开一首歌时画面从哪里起：歌的开头；第 1 小节起在歌开头之前的话，从第 1 小节起

  // ---- 网格草稿：在页面上改了拍速、挪了网格以后，先只是预览，点“应用新网格”才存。
  // 标记跟着时间走：预览时就把每一格的标记按时间搬到新格子上（新的一格取盖住它最多的那个旧值），所以看到的就是应用以后的样子。
  // 有草稿时，s.edges / 各行的 cur、auto、unstable 是预览用的；没动过的原件留在 s.live 里，保存、放弃都用它。
  // 拍点的算法和服务端的 fn_extractor/grid_math.py 是同一套规则，时间取到毫秒。
  const r3 = (x) => Math.round(x * 1000) / 1000;      // 取到毫秒。服务端的 grid_math.ms 是同一个算法（半毫秒一律往上取）
  const r4 = (x) => Math.round(x * 10000) / 10000;    // 手动网格的锚点取到万分之一秒，服务端存的就是这个精度
  const median = (a) => { const b = Array.from(a).sort((x, y) => x - y), m = b.length >> 1; return b.length % 2 ? b[m] : (b[m - 1] + b[m]) / 2; };
  const gridSame = (a, b) => a.mode === b.mode && (a.mode === 'manual'
    ? Math.abs(a.bpm - b.bpm) < 5e-4 && Math.abs(a.anchor - b.anchor) < 5e-5
    : (a.factor || 1) === (b.factor || 1) && Math.abs((a.offset || 0) - (b.offset || 0)) < 5e-4);
  const curGrid = (s) => s.draft || s.grid;
  const gridBpm = (s, g) => (g.mode === 'manual' ? g.bpm : (s.autoBpm || s.bpm) * (g.factor || 1));
  const bpmText = (v) => (Math.abs(v * 10 - Math.round(v * 10)) < 1e-6 ? v.toFixed(1) : v.toFixed(2));
  const movedText = (s, d) => T('alignMoved', Math.round(d * 1000), (Math.abs(d) * gridBpm(s, curGrid(s)) / 60).toFixed(2));      // 声音挪了多少：毫秒，按现在的拍速合多少拍
  // 第 1 小节第一拍现在的时间。手动网格按锚点算：格子边界取过毫秒，反复拿它当基准会一点点走偏
  function barOne(s) {
    const g = curGrid(s), t = lineTime(s, s.j1);
    if (g.mode !== 'manual' || s.noPreview) return r3(t);
    const per = 60 / g.bpm;
    return g.anchor + Math.round((t - g.anchor) / per) * per;
  }
  // 把整首歌的声音相对网格往后挪 d 秒以后的网格。声音文件不动，动的是格子线：格子线往前挪 d 秒
  const gridShifted = (g, d) => (g.mode === 'manual' ? { mode: 'manual', bpm: g.bpm, anchor: g.anchor - d }
    : { mode: 'auto', factor: g.factor || 1, offset: r3((g.offset || 0) - d) });
  function autoBeatsOf(s) {                  // 程序自动识别的那一套拍点（老文件里没有单独存：它当时用的就是自动拍点）
    if (s.autoBeats) return s.autoBeats;
    if (s.grid.mode !== 'auto' || (s.grid.factor || 1) !== 1 || s.grid.offset) return null;
    const e = (s.live || s).edges;
    return Array.from(e.subarray(e[0] === 0 ? 1 : 0, e.length - 1));
  }
  function fillBeats(beats, end) {           // 把拍点铺满整首歌：两头按各自最近 8 拍的间隔往外补；0.05 秒以前的、离结尾不到 0.3 拍的不要
    const b = beats.filter((x) => x > 0.05);
    if (b.length < 4) return b.map(r3);
    const gaps = b.slice(1).map((x, i) => x - b[i]);
    const head = median(gaps.slice(0, 8)), tail = median(gaps.slice(-8)), pre = [], post = [];
    for (let i = 1; b[0] - i * head > 0.05; i++) pre.push(b[0] - i * head);
    for (let i = 1; b[b.length - 1] + i * tail < end - 0.3 * tail; i++) post.push(b[b.length - 1] + i * tail);
    return pre.reverse().concat(b, post).filter((x) => x < end - 0.3 * tail).map(r3);
  }
  // 自动拍点按这套设置加倍、减半、平移以后的全部拍点：还没铺满整首歌，落在歌开头之前的也还留着。没有自动拍点时返回 null
  function autoLines(s, g) {
    let base = autoBeatsOf(s); if (!base) return null;
    base = base.map(r3);
    const f = g.factor || 1, off = r3(g.offset || 0);
    if (f === 2) { const out = []; base.forEach((t, i) => { out.push(t); if (i + 1 < base.length) out.push(r3((t + base[i + 1]) / 2)); }); base = out; }
    else if (f === 0.5) {
      let keep = 0;
      if (s.barAt != null && base.length > 1) {
        const ref = s.barAt - off, hd = median(base.slice(1, 9).map((t, i) => t - base[i]));
        if (ref < base[0] - hd / 2) keep = (Math.round((base[0] - ref) / hd) % 2 + 2) % 2;      // 小节起点在歌开头之前：按拍长往前数
        else { let best = Infinity; base.forEach((t, i) => { const d = Math.abs(t - ref); if (d < best) { best = d; keep = i % 2; } }); }
      }
      base = base.filter((t, i) => i % 2 === keep);
    }
    return base.map((t) => t + off);
  }
  function draftEdges(s, g) {                // 草稿网格的格子边界；缺自动拍点、画不出来时返回 null
    const ce = (s.live || s).edges, end = ce[ce.length - 1];
    let beats = [];
    if (g.mode === 'manual') {
      const per = 60 / g.bpm, k0 = Math.floor((0.05 - g.anchor) / per) + 1, k1 = Math.ceil((end - 0.3 * per - g.anchor) / per) - 1;
      for (let k = k0; k <= k1; k++) beats.push(r3(g.anchor + k * per));
    } else {
      const sh = autoLines(s, g); if (!sh) return null;
      beats = fillBeats(sh, end);
    }
    if (beats.length < 8) return null;
    return Float64Array.from((beats[0] > 0.05 ? [0] : []).concat(beats, [end]));
  }
  function resample(values, oe, ne) {        // 按时间把“每格一个值”搬到另一套格子上：新的一格取盖住它最多的那个旧值（并列取靠前的）
    const nOld = oe.length - 1, nNew = ne.length - 1, out = new Array(nNew);
    let j = 0;
    for (let i = 0; i < nNew; i++) {
      const a = ne[i], b = ne[i + 1], votes = new Map();
      while (j < nOld - 1 && oe[j + 1] <= a) j++;
      for (let k = j; k < nOld && oe[k] < b; k++) {
        const c = Math.min(b, oe[k + 1]) - Math.max(a, oe[k]);
        if (c > 0) votes.set(values[k], (votes.get(values[k]) || 0) + c);
      }
      let pick = values[Math.min(j, nOld - 1)], top = 0;
      votes.forEach((c, v) => { if (c > top) { top = c; pick = v; } });
      out[i] = pick;
    }
    return out;
  }
  function ensureLive(s) {                   // 第一次动网格之前，把现在这套原件收好。shift：从这时起一共把声音挪了多少秒（放弃时画面要挪回去）
    if (s.live) return;
    s.live = { edges: s.edges, n: s.n, dur: s.dur, bpb: s.bpb, barAt: s.barAt, shift: 0, rows: s.rows.map((r) => ({ cur: r.cur, auto: r.auto, unstable: r.unstable })) };
    s.live.base = pickBase(s);
  }
  // 换网格时标记从哪一份搬。服务端记着这套标记最后一次是在哪套格子上“定下来”的（出处）。
  // 手上这份要是原样从出处搬来的（中间没人改过），这一次还从出处搬：分几次小步挪和一次挪到位，结果才一样，挪回去也原样回来。
  // 手上这份改过了（或者没有出处），它自己就是出处。服务端（server.py 的 regrid）是同一个规矩，所以预览和存下来的一样
  function pickBase(s) {
    const L = s.live, S = s.src;
    if (!S) return L;
    const same = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
    const ok = L.rows.every((o, i) => {
      if (!o.cur) return true;
      const q = S.rows[i];
      return !!q && same(resample(q.cur, S.edges, L.edges), o.cur) && same(resample(q.auto, S.edges, L.edges), o.auto)
        && (!o.unstable || (!!q.unstable && same(resample(q.unstable, S.edges, L.edges), o.unstable)));
    });
    return ok ? S : L;
  }
  // 网格一有改动，停下来不到一秒就自己存。还在拖、上一次还没存完、正在输入拍速的时候先等一等
  let gridTimer = 0;
  function scheduleApply(ms) {
    clearTimeout(gridTimer);
    gridTimer = setTimeout(() => {
      const s = st.song; if (!s || !s.draft) return;
      if (st.align || st.job || (document.activeElement && document.activeElement.id === 'bpmIn')) { scheduleApply(250); return; }
      applyGrid();
    }, ms == null ? 700 : ms);
  }
  // 换草稿（g 为空是放弃）。
  // keepBars：这次改动本身就是在定第 1 小节的位置（挪声音、把播放线定为第 1 小节）。这时就算格子线转了一圈回到原样
  // （比如正好挪了整一拍），第 1 小节换到了哪条线上也要留下，画面也不退回去
  function setDraft(g, keepBars) {
    const s = st.song; if (!s) return;
    if (st.stroke) endStroke();
    const same = !!(g && gridSame(g, s.grid));
    if (same) g = null;
    if (g) { ensureLive(s); if (s.barAt == null) s.barAt = barOne(s); }      // 网格一有改动，就把第 1 小节的起点记下来：格子线怎么排，它都留在原处
    const L = s.live, e = g ? draftEdges(s, g) : null;
    let heads = false, save = false;
    if (L) {
      const show = (ed, from) => {             // from：从哪一份搬过来画（见 pickBase）；为空就是原件
        s.edges = ed; s.n = ed.length - 1; s.dur = new Float64Array(s.n);
        for (let b = 0; b < s.n; b++) s.dur[b] = ed[b + 1] - ed[b];
        s.rows.forEach((r, i) => {
          const o = L.rows[i]; if (!o.cur) return;
          const q = from && from.rows[i];
          if (!q) { r.cur = o.cur; r.auto = o.auto; r.unstable = o.unstable; return; }
          r.cur = Int8Array.from(resample(q.cur, from.edges, ed)); r.auto = resample(q.auto, from.edges, ed);
          r.unstable = q.unstable ? resample(q.unstable, from.edges, ed) : o.unstable;
        });
      };
      if (g && e) show(e, L.base || L); else show(L.edges, null);
      if (!g) {                              // 没有草稿了：小节的设置回到原样
        const want = same && keepBars ? s.barAt : null, bpb = s.bpb;
        s.bpb = L.bpb; s.barAt = L.barAt; s.live = null;
        if (want == null) { st.view.t0 += L.shift; heads = bpb !== L.bpb; }      // 放弃：画面也回到挪之前
        else {                               // 格子线回到了原样，但第 1 小节可能已经换了一条线：换了就存下来
          s.draft = null; s.noPreview = false; setBars(s);
          const j = lineNear(s, want);
          if (j !== s.j1 || bpb !== L.bpb) { s.barAt = lineTime(s, j); s.bpb = bpb; save = true; }
        }
      }
    }
    s.draft = g; s.noPreview = !!(g && !e); s.gridRev++;
    st.hover = null; showTip(null);
    st.view.keep = st.view.t0;               // 画面留在原处，不因为可看的范围变了而被拉走
    if (heads) buildHeads();
    if (s.draft) st.gridErr = '';
    if (save) saveBars(); else { setBars(s); layout(true); applySolo(); refreshDerived(); renderGrid(); }
    st.lastBeat = -1; st.dirty = true; st.ringDirty = true;
    if (s.draft) scheduleApply(); else clearTimeout(gridTimer);
  }
  // 把整首歌的声音往后挪 d 秒（负数是往前），拍速不变。屏幕上小节线、拍线、小节号都留在原地，挪的是声音和它自己的时间刻度。
  // 声音文件本身不动：记下来的是每条线在声音里的时间都早了 d 秒，第 1 小节的起点也跟着早 d 秒（可以落到歌开头之前）。
  // viewDone：画面已经跟着手挪过了（拖动时）
  function shiftStems(d, viewDone) {
    const s = st.song; if (!s || !d) return;
    if (st.job) { if (st.job.kind === 'regrid') st.pendingShift += d; return; }      // 上一次改动正在保存：先记着，存完接着挪
    ensureLive(s);
    const g = gridShifted(curGrid(s), d);
    if (g.mode === 'manual') { const per = 60 / g.bpm; g.anchor = r4(g.anchor - Math.floor(g.anchor / per) * per); }      // 锚点收回到歌曲开头的第一拍上（还是同一套拍线）
    s.barAt = (s.noPreview && s.barAt != null ? s.barAt : barOne(s)) - d;
    s.live.shift += d;
    if (!viewDone) st.view.t0 -= d;
    setDraft(g, true);
  }
  function beatAt(s, t) {
    let lo = 0, hi = s.n - 1;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (s.edges[mid] <= t) lo = mid; else hi = mid - 1; }
    return lo;
  }

  // ------------------------------------------------------------------ 声音
  // 把要听的几条轨整条解码进内存一起放，所以它们之间是严格对齐的。
  const engine = {
    ctx: null, master: null, analyser: null, tbuf: null,
    buffers: new Map(), pending: new Map(), nodes: [], epoch: 0,
    active: [], playing: false, started: false, offset: 0, t0: 0, duration: 0, token: 0, loading: 0, level: 0,
    origin: 0,          // 这一次是从哪里开始放的；用鼠标点过别处，就是点的那里。“停止回起点”回的就是这儿
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this.tbuf = new Float32Array(this.analyser.fftSize);
      this.master.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
      output.restore();
    },
    load(url) {
      if (this.buffers.has(url)) {            // 最近用过的排到最后
        const b = this.buffers.get(url); this.buffers.delete(url); this.buffers.set(url, b);
        return Promise.resolve(b);
      }
      if (this.pending.has(url)) return this.pending.get(url);
      this.init();
      const epoch = this.epoch;
      const get = async () => {             // 连不上服务（正在重新启动）时隔 1.5 秒再试，最多 3 次；服务端自己报的错不重试
        for (let k = 0; ; k++) {
          try { return await fetch(url); }
          catch (err) { if (k >= 2) throw new Error(T('audioOffline')); await new Promise((r) => setTimeout(r, 1500)); }
        }
      };
      const p = get().then((r) => { if (!r.ok) throw new Error(T('cantRead', decodeURIComponent(url.split('/').pop()))); return r.arrayBuffer(); })
        .then((ab) => this.ctx.decodeAudioData(ab))
        .then((buf) => {
          if (epoch !== this.epoch) return buf;       // 已经换了歌，这条不再放进缓存
          this.pending.delete(url); this.buffers.set(url, buf);
          for (const k of [...this.buffers.keys()]) { // 内存里最多留 5 条，正在用的不删
            if (this.buffers.size <= 5) break;
            if (!this.active.includes(k) && k !== url) this.buffers.delete(k);
          }
          return buf;
        }, (err) => { if (epoch === this.epoch) this.pending.delete(url); throw err; });
      this.pending.set(url, p);
      return p;
    },
    pos() {
      if (!this.playing || !this.started) return this.offset;
      return clamp(this.offset + Math.max(0, this.ctx.currentTime - this.t0), 0, this.duration);
    },
    stopNodes() {
      if (!this.ctx) return;
      const now = this.ctx.currentTime;
      for (const n of this.nodes) {
        try { n.g.gain.cancelScheduledValues(now); n.g.gain.setValueAtTime(n.g.gain.value, now); n.g.gain.linearRampToValueAtTime(0, now + 0.015); n.src.stop(now + 0.03); } catch (e) { /* 已经停了 */ }
      }
      this.nodes = [];
    },
    async restart(keepOffset) {
      if (!keepOffset) this.offset = this.pos();
      const my = ++this.token;
      this.started = false;
      this.stopNodes();
      if (!this.playing) return;
      this.init();
      this.loading++;
      let bufs;
      try { bufs = await Promise.all(this.active.map((u) => this.load(u))); }
      catch (err) { if (my === this.token) { this.playing = false; toast(T('audioFail', err.message)); } return; }
      finally { this.loading--; }
      if (my !== this.token || !this.playing) return;
      if (this.ctx.state === 'suspended') { try { await this.ctx.resume(); } catch (e) { /* 等用户再点一次 */ } }
      if (my !== this.token || !this.playing) return;
      const when = this.ctx.currentTime + 0.04;
      for (const b of bufs) {
        const src = this.ctx.createBufferSource(); src.buffer = b;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, when); g.gain.linearRampToValueAtTime(1, when + 0.015);
        src.connect(g); g.connect(this.master);
        src.start(when, Math.min(this.offset, Math.max(0, b.duration - 0.01)));
        this.nodes.push({ src, g });
      }
      this.t0 = when; this.started = true;
    },
    play() {              // 停在结尾时再按播放，从头来；播放中拖到结尾则不回头，交给 tick 去停
      if (this.playing) return;
      if (this.offset >= this.duration - 0.05) this.offset = 0;
      this.origin = this.offset;
      this.playing = true; this.restart(true);
    },
    pause() { if (!this.playing) return; this.offset = this.pos(); this.playing = false; this.started = false; this.token++; this.stopNodes(); },
    // 空格：没在放就放；在放就停。“停止回起点”开着时停下以后回到 origin。other 为真（按着 Shift）时，这一次用另一种停法
    toggle(other) {
      if (!this.playing) { this.play(); return; }
      this.pause();
      if (st.ret !== !!other) this.offset = this.origin;
    },
    seek(t) { this.offset = clamp(t, 0, this.duration); this.origin = this.offset; if (this.playing) this.restart(true); },
    setActive(urls) {
      if (urls.length === this.active.length && urls.every((u, i) => u === this.active[i])) return;
      this.active = urls;
      if (this.playing) this.restart(false); else urls.forEach((u) => this.load(u).catch(() => {}));
    },
    reset(duration) {
      this.pause(); this.token++; this.epoch++; this.offset = 0; this.origin = 0; this.duration = duration; this.active = [];
      this.buffers.clear(); this.pending.clear(); this.level = 0;
    },
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

  // ------------------------------------------------------------------ 播放设备（比如切到声卡）
  // 浏览器只有在得到过一次麦克风权限之后，才把各个设备的名字给网页；这里拿到名字就立刻把麦克风关掉，不录音。
  const output = {
    id: store.get('fn-sink') || '', name: store.get('fn-sink-name') || '',
    supported() { const AC = window.AudioContext || window.webkitAudioContext; return !!(AC && AC.prototype && typeof AC.prototype.setSinkId === 'function'); },
    restore() {            // 页面重开后，把上次选的设备用回来
      if (!this.id || !this.supported() || !engine.ctx) return;
      engine.ctx.setSinkId(this.id).catch(() => { this.id = ''; this.name = ''; store.set('fn-sink', ''); store.set('fn-sink-name', ''); this.label(); });
    },
    label() { $('#outLabel').textContent = T('outLabel', this.id ? (this.name || this.id.slice(0, 8)) : T('outDefault')); },
    async devices(ask) {
      const md = navigator.mediaDevices;
      if (!md || !md.enumerateDevices) return { list: [], named: false };
      let list = (await md.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
      if (ask && !list.some((d) => d.label)) {
        const s = await md.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
        list = (await md.enumerateDevices()).filter((d) => d.kind === 'audiooutput');
      }
      return { list: list.filter((d) => d.deviceId && d.deviceId !== 'default' && d.deviceId !== 'communications'), named: list.some((d) => d.label) };
    },
    async choose(id, name) {
      engine.init();
      await engine.ctx.setSinkId(id);
      this.id = id; this.name = id ? name : ''; store.set('fn-sink', this.id); store.set('fn-sink-name', this.name); this.label();
    },
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
    async check() {        // 设备有增减时：选中的那个要是不在了，退回系统默认并说一声
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
  $('#outBtn').addEventListener('click', () => { if ($('#outMenu').hidden) output.open(false); else output.close(); });
  $('#outMenu').addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.ask) { output.open(true); return; }
    try { await output.choose(b.dataset.sink, b.dataset.name); output.close(); } catch (err) { toast(T('outFail', err.message || String(err)), 5000); }
  });
  document.addEventListener('pointerdown', (e) => {      // 点在菜单外面：把开着的菜单收起来
    const wrap = e.target.closest('.menuWrap');
    if (!$('#outMenu').hidden && !(wrap && wrap.contains($('#outMenu')))) output.close();
    if (!$('#gridMenu').hidden && !(wrap && wrap.contains($('#gridMenu')))) gridUi.close();
  });

  // ------------------------------------------------------------------ 圆环：整首歌的总览
  // 一圈是一条分轨（第一行在最外圈），顺时针一圈是整首歌，12 点钟方向是开头。
  function ringGeom(size, nLanes, mini) {
    const R = size / 2 - (mini ? 3 : 15), r0 = R * (mini ? 0.32 : 0.6);
    return { c: size / 2, R, r0, th: (R - r0) / Math.max(1, nLanes) };
  }
  function paintRing(ctx, size, song, mini) {
    const lanes = song.rows.filter((r) => r.kind === 'pitched');
    const g = ringGeom(size, lanes.length, mini);
    const ang = (t) => -Math.PI / 2 + 2 * Math.PI * t / song.duration;
    ctx.lineCap = 'butt';
    if (g.r0 <= 1) return g;              // 画布还没有尺寸（窗口正在变大小）：这一帧不画，免得半径算成负数
    lanes.forEach((row, i) => {
      const r = g.R - (i + 0.5) * g.th, w = Math.max(1, g.th - (mini ? 1 : 2.5));
      ctx.strokeStyle = `rgba(${INK},.08)`; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(g.c, g.c, r, 0, Math.PI * 2); ctx.stroke();
      eachRun(row.cur, 0, song.n, (a, b, v) => {
        if (!v) return;
        const a0 = ang(song.edges[a]), a1 = ang(song.edges[b]);
        for (const f of fn2(v) ? [fn1(v), fn2(v)] : [v]) {      // 双重功能：宽的在下、窄的在上
          ctx.strokeStyle = FN[f].color; ctx.lineWidth = Math.max(1, w * (0.22 + 0.78 * FN[f].h));
          ctx.beginPath(); ctx.arc(g.c, g.c, r, a0, Math.max(a0 + 0.003, a1 - 0.007)); ctx.stroke();
        }
      });
    });
    return g;
  }
  function sizeCanvas(cv) {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.max(1, Math.round(cv.clientWidth)), h = Math.max(1, Math.round(cv.clientHeight));
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx, w, h, dpr };
  }

  // ------------------------------------------------------------------ 首页
  const home = { lib: null, tab: null, token: 0, songs: new Map(), io: null, back: null, q: {}, rewatch: null };
  // 搜索框里的字，每个分区各记各的；进一首歌再回来还在
  try { home.q = JSON.parse(sessionStorage.getItem('fn-find') || '{}') || {}; } catch (e) { home.q = {}; }
  function findMatch(q) {            // 按编号（列表里的序号，可以写成 113、m113、#113）或歌名、歌手里的字找；几个词用空格隔开要都对得上
    const s0 = q.trim().toLowerCase();
    if (!s0) return () => true;
    const num = /^[m#＃]?0*(\d+)$/.exec(s0.replace(/\s+/g, '')), words = s0.split(/\s+/);
    return (s, i) => {
      if (num && String(i + 1).startsWith(num[1])) return true;
      const hay = `${s.title || ''} ${s.artist || ''}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    };
  }
  // 回到曲目表时回到原来的位置。back：点进一首歌时，那一行离屏幕顶多远（按行记，不按滚了多少像素记）
  try { home.back = JSON.parse(sessionStorage.getItem('fn-back') || 'null'); } catch (e) { home.back = null; }
  const absTop = (el) => { let y = 0; for (let e = el; e; e = e.offsetParent) y += e.offsetTop; return y; };
  function rememberRow(btn) {
    home.back = { tab: home.tab, id: btn.dataset.id, top: Math.round(absTop(btn.closest('li')) - window.scrollY) };
    try { sessionStorage.setItem('fn-back', JSON.stringify(home.back)); } catch (e) { /* 存不了就只在这一次有效 */ }
  }
  function restoreRow(from, flash) {            // from：刚离开的那首歌 { tab, id }
    if (!from || from.tab !== home.tab) return false;
    const btn = $(`#songs .song[data-id="${from.id}"]`); if (!btn) return false;
    const li = btn.closest('li'), b = home.back, top = absTop(li);
    const want = b && b.tab === from.tab && b.id === from.id ? b.top : Math.max(0, (window.innerHeight - li.offsetHeight) / 2);
    window.scrollTo(0, Math.max(0, top - want));
    if (flash) { btn.classList.add('came'); setTimeout(() => btn.classList.remove('came'), 1900); }
    return true;
  }
  function renderLegend() {
    $('#legend').innerHTML = FN.map((f, v) => (LEVEL === 2 && v === 5 ? '' : `<li><span class="glyph"><u style="height:${Math.max(2, f.h * 22)}px;background:${f.color || 'transparent'}"></u></span><b>${fnName(v)}</b>${LANG === 'zh' ? `<span class="mono dim">${LEVEL === 2 && v === 4 ? T('fnAccEn') : STR.en.fn[v]}</span>` : ''}</li>`)).join('')
      + `<li><span class="glyph dual"><u style="height:17px;background:${FN[3].color}"></u><u style="height:6px;background:${FN[4].color}"></u></span><b>${esc(T('fnDual'))}</b>${LANG === 'zh' ? `<span class="mono dim">${esc(T('fnDualEn'))}</span>` : ''}</li>`;
  }
  function renderHome() {
    const cols = home.lib.collections, list = $('#songs');
    const total = cols.reduce((n, c) => n + c.songs.length, 0), done = cols.reduce((n, c) => n + c.songs.filter((s) => s.done).length, 0);
    $('#homeCount').textContent = T('count', total, done);
    const cname = (c) => (T('coll')[c.id] || [c.title, c.note]);
    $('#tabs').innerHTML = cols.map((c) => `<button class="tab" role="tab" data-c="${c.id}" aria-selected="${c.id === home.tab}">${esc(cname(c)[0])}<small>${T('tabCount', c.songs.length)} · ${esc(cname(c)[1])}</small></button>`).join('');
    const col = cols.find((c) => c.id === home.tab);
    const box = $('#find'), q = ((col && home.q[col.id]) || '').trim();
    if (box.value.trim() !== q && document.activeElement !== box) box.value = q;
    $('#findClear').hidden = !q;
    $('#findBar').hidden = !col || !col.songs.length;
    $('#findCount').textContent = '';
    if (!col || !col.songs.length) { list.innerHTML = `<li class="empty">${esc(T('emptyTab'))}</li>`; return null; }
    const hit = findMatch(q), rows = col.songs.map((s, i) => ({ s, i })).filter((r) => hit(r.s, r.i));
    if (q) $('#findCount').textContent = T('findCount', rows.length, col.songs.length);
    if (!rows.length) { list.innerHTML = `<li class="empty">${esc(T('findNone', q))}</li>`; return col; }
    let firstNew = q ? -1 : col.songs.findIndex((s) => s.rule >= 3);       // 从哪一首起自动标注用的是新标准（搜索的时候不插这一行）
    if (firstNew >= 0 && !col.songs.slice(firstNew).every((s) => s.rule === 3)) firstNew = -1;      // 几版规则一首一首混着用以后，这条线说的就不对了：每一行自己标着是第几版
    list.innerHTML = rows.map(({ s, i }, k) => `${i === firstNew ? `<li class="mark" style="animation-delay:${0.06 * Math.min(k, 10)}s"><b>${esc(T('ruleFrom'))}</b><span>${esc(T('ruleNote'))}</span></li>` : ''}<li style="animation-delay:${0.06 * Math.min(k, 10)}s"><button class="song" data-id="${s.id}">
        <span class="no">${String(i + 1).padStart(2, '0')}</span>
        <span><h3>${esc(s.title)}</h3><span class="meta mono dim">${[s.artist, genreName(s.genre), s.bpm ? s.bpm + ' BPM' : '', fmt(s.duration || 0), T('beats', s.n_beats), T('pitched', s.n_stems)].filter(Boolean).map(esc).join('<span>·</span>')}</span></span>
        <span class="state"><span class="pill${s.rule >= 3 ? ' new' : ''}" title="${esc(T('ruleNoteV', s.rule))}">${esc(T('ruleVer', s.rule))}</span>${s.done ? `<span class="pill ok">${esc(T('reviewed'))}</span>` : ''}${s.n_changed ? `<span class="pill">${esc(T('edits', s.n_changed))}</span>` : ''}</span>
        <canvas data-ring="${s.id}" aria-hidden="true"></canvas></button></li>`).join('');
    return col;
  }
  function paintHomeRing(cid, sid) {
    const song = home.songs.get(cid + '/' + sid), cv = $(`#songs canvas[data-ring="${sid}"]`);
    if (!song || !cv || cid !== home.tab) return;
    const { ctx, w } = sizeCanvas(cv);
    ctx.clearRect(0, 0, w, w);
    paintRing(ctx, w, song, true);
  }
  async function showHome(tab, from) {
    const my = ++home.token;
    for (;;) {
      try { home.lib = await api('/api/library'); break; }
      catch (err) {
        if (my !== home.token) return;
        const offline = !err.status;          // 根本连不上（服务没在跑、正在启动或重启）就隔一会儿再试；服务端自己报的错照旧只显示一次
        $('#songs').innerHTML = `<li class="empty">${esc(offline ? T('libOffline') : T('libFail', err.message))}</li>`;
        if (!offline) return;
        await new Promise((r) => setTimeout(r, 3000));
        if (my !== home.token) return;
      }
    }
    if (my !== home.token) return;
    const cols = home.lib.collections;
    home.tab = cols.some((c) => c.id === tab) ? tab : (home.tab && cols.some((c) => c.id === home.tab) ? home.tab : (cols.find((c) => c.songs.length) || cols[0]).id);
    $('#songs').classList.toggle('still', !!from);
    const col = renderHome();
    if (!col) return;
    if (from) restoreRow(from, true);
    // 每首歌自己的小圆环：滚到哪画到哪（歌多了以后，一进首页就把每首的整份标注都取一遍太慢）。一次只取一首
    if (home.io) home.io.disconnect();
    const queue = [], fresh = new Set();
    let busy = false;
    const pump = async () => {
      if (busy) return;
      busy = true;
      while (queue.length && my === home.token) {
        const sid = queue.shift();
        try {
          const data = await api(`/api/song?c=${col.id}&id=${sid}`);
          if (my !== home.token) break;
          home.songs.set(col.id + '/' + sid, buildSong(col.id, sid, data));
          fresh.add(sid);
          paintHomeRing(col.id, sid);
        } catch (err) { /* 画不出来就留空 */ }
      }
      busy = false;
    };
    const want = (sid) => { if (fresh.has(sid)) { paintHomeRing(col.id, sid); return; } if (!queue.includes(sid)) queue.push(sid); pump(); };
    const watch = () => {
      if (home.io) home.io.disconnect();
      if (window.IntersectionObserver) {
        home.io = new IntersectionObserver((entries) => {
          for (const en of entries) if (en.isIntersecting) { home.io.unobserve(en.target); want(en.target.dataset.ring); }
        }, { rootMargin: '300px 0px' });
        $$('#songs canvas[data-ring]').forEach((cv) => home.io.observe(cv));
      } else $$('#songs canvas[data-ring]').forEach((cv) => want(cv.dataset.ring));
    };
    watch();
    home.rewatch = () => { if (my === home.token) watch(); };
  }
  function refind() {              // 搜索框里的字变了：只重画列表（不重新取曲目表），行不再一条条滑进来
    if (!home.lib || !home.tab) return;
    home.q[home.tab] = $('#find').value.trim();
    try { sessionStorage.setItem('fn-find', JSON.stringify(home.q)); } catch (e) { /* 存不了就只在这一次有效 */ }
    $('#songs').classList.add('still');
    if (renderHome() && home.rewatch) home.rewatch();
  }
  $('#find').addEventListener('input', refind);
  $('#find').addEventListener('keydown', (e) => { if (e.key === 'Escape' && $('#find').value) { e.preventDefault(); $('#find').value = ''; refind(); } });
  $('#findClear').addEventListener('click', () => { $('#find').value = ''; refind(); $('#find').focus(); });
  // 回到顶部：曲目表往下滚过一屏多以后才出现
  const topBtn = () => { $('#toTop').classList.toggle('on', !$('#home').hidden && window.scrollY > 600); };
  window.addEventListener('scroll', topBtn, { passive: true });
  window.addEventListener('hashchange', () => setTimeout(topBtn, 0));
  $('#toTop').addEventListener('click', () => { window.scrollTo({ top: 0, behavior: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); });
  $('#tabs').addEventListener('click', (e) => { const b = e.target.closest('.tab'); if (b) location.hash = '#/' + b.dataset.c; });
  $('#songs').addEventListener('click', (e) => { const b = e.target.closest('.song'); if (b) { rememberRow(b); location.hash = `#/${home.tab}/${b.dataset.id}`; } });

  // ------------------------------------------------------------------ 编辑页
  const st = { song: null, view: { t0: 0, pps: 10 }, fitPps: 1, brush: 1, mode: 'point', solo: new Set(), follow: true, showU: true, showW: true,
    ret: store.get('fn-return') === '1',      // “停止回起点”开没开（两个分区共用这一个设置）
    job: null,                                // 正在重新识别（或保存网格）时的进度
    gridErr: '', gridSaved: '', pendingShift: 0,      // 网格上一次没存上的原因；上一次存好的时刻；正在存的那一瞬间又挪的量（存完接着挪）
    align: null,                              // “对齐”模式下正在拖：起点的位置和当时的网格
    preview: null,                            // 正在“看一看”历史版本：{ song, v, it, keep, diff, orig（现在的标记） }
    hover: null, stroke: null, scrub: false, add: false, addKey: false, undo: [], redo: [], dirty: true, ringDirty: true, flash: null, uStarts: [],
    save: 'idle', saveErr: '', saveCode: '', saveStatus: 0, detached: false, lastBeat: -1, lvlCss: -1, lastJump: -1, holdFollow: 0, wasPlaying: false, wasLoading: 0 };
  const tl = $('#tl'), ringCv = $('#ring'), lanesEl = $('#lanes');
  let ringCache = null, ringGeo = null;

  const pitchedRows = () => st.song.rows.filter((r) => r.kind === 'pitched');
  const holders = (b) => { const out = []; st.song.rows.forEach((r, i) => { if (r.cur && hasFn(r.cur[b], 1)) out.push(i); }); return out; };
  const adding = () => (st.add || st.addKey) && !!(st.song && st.song.canDual);      // “再加一个功能”开着，或者正按着 Shift
  const X = (t) => (t - st.view.t0) * st.view.pps;
  const viewW = () => Math.max(50, lanesEl.clientWidth - HEADW);

  function layout(keepZoom) {            // keepZoom：改网格、改小节时用。能看到的范围会变，但缩放不能跟着变（线不能自己动）
    const s = st.song; if (!s) return;
    const H = lanesEl.clientHeight;
    const P = pitchedRows().length, U = s.rows.length - P, gap = 8, hu = 20;
    const hp = clamp((H - RULER - RIBBON - 14 - U * (hu + gap)) / Math.max(1, P) - gap, 22, 86);
    let y = RULER + RIBBON + 8;
    s.rows.forEach((r) => { r.h = r.kind === 'pitched' ? hp : hu; r.y = y; y += r.h + gap; });
    $('#heads').classList.toggle('tight', hp < 36);
    $$('#heads .head').forEach((h) => {
      if (h.dataset.i === 'capB') { h.style.top = TROW + 'px'; h.style.height = (RULER - TROW) + 'px'; return; }
      if (h.dataset.i === 'cap') { h.style.top = RULER + 'px'; h.style.height = RIBBON + 'px'; return; }
      const r = s.rows[+h.dataset.i]; h.style.top = r.y + 'px'; h.style.height = r.h + 'px';
    });
    st.fitPps = viewW() / (s.duration - viewMin(s));
    st.view.pps = clamp(st.view.pps, keepZoom && st.view.pps > 0 ? Math.min(st.fitPps, st.view.pps) : st.fitPps, Math.max(MAXPPS, st.fitPps));
    clampView();
    st.dirty = true; st.ringDirty = true;
  }
  function clampView() {
    const s = st.song, W = viewW();
    if (!st.align) {                         // 拖着对网格的途中不拦，松手再说
      // 最左到第 1 小节的起点（或歌开头所在小节的起点），最右到歌的结尾。
      // 刚挪过声音、改过网格时，画面可能停在这个范围外面一点：那就先留在那儿（keep），等用户自己滚回范围里再收紧，免得画面回弹
      const nat = viewMin(s), natHi = Math.max(nat, s.duration - W / st.view.pps), k = st.view.keep;
      st.view.t0 = clamp(st.view.t0, k == null ? nat : Math.min(nat, k), k == null ? natHi : Math.max(natHi, k));
      if (st.view.t0 >= nat && st.view.t0 <= natHi) st.view.keep = null;
    }
    const f = st.fitPps, top = Math.max(MAXPPS, f * 1.0001), v = Math.log(st.view.pps / f) / Math.log(top / f);
    $('#zoom').value = String(Math.round(clamp(v, 0, 1) * 1000));
  }
  function zoomTo(pps, anchorT, anchorX) {
    st.view.pps = clamp(pps, st.fitPps, Math.max(MAXPPS, st.fitPps));
    st.view.t0 = anchorT - anchorX / st.view.pps;
    clampView(); st.dirty = true;
  }

  function buildHeads() {
    const s = st.song;
    $('#heads').innerHTML = `<div class="head cap mono" data-i="capB" style="align-items:center;padding-bottom:0">${esc(s.view === 'bar' ? T('barCapBar') : T('barCap', s.bpb))}</div><div class="head cap mono" data-i="cap">${esc(T('ribbon'))}</div>` + s.rows.map((r, i) => r.kind === 'pitched'
      ? `<div class="head" data-i="${i}"><span><span class="nm">${esc(stemName(r))}</span><span class="en">${esc(stemSub(r))}</span></span><button class="solo" data-solo="${i}" aria-pressed="false" title="${esc(T('soloTip'))}">${esc(T('solo'))}</button><span class="share"></span></div>`
      : `<div class="head small" data-i="${i}"><span class="nm">${esc(stemName(r))}</span><span class="en">${esc(T('unclassified'))}</span><button class="solo" data-solo="${i}" aria-pressed="false" title="${esc(T('soloTip'))}">${esc(T('solo'))}</button></div>`).join('');
  }
  // “主旋律在谁手里”的分段：同一批持有者连着的拍并成一段。kind 为 '~' 表示有声音却没有主旋律，'' 表示全都休止
  function computeLeadRuns(s) {
    const runs = []; let run = null;
    for (let b = 0; b < s.n; b++) {
      const ids = []; let sounding = false;
      s.rows.forEach((r, i) => { if (!r.cur) return; if (hasFn(r.cur[b], 1)) ids.push(i); if (r.cur[b] !== 0) sounding = true; });
      const kind = ids.join(',') || (sounding ? '~' : '');
      if (run && run.kind === kind) run.b = b + 1; else { run = { a: b, b: b + 1, kind, ids }; runs.push(run); }
    }
    s.leadRuns = runs;
  }
  function refreshDerived() {
    const s = st.song;
    // 每行底下的小条：这条轨各类功能各占多少。按时间算，不按格数算（每一格不一样长）
    $$('#heads .head').forEach((h) => {
      const r = s.rows[+h.dataset.i]; if (!r || !r.cur) return;
      const sec = FN.map(() => 0);
      for (let b = 0; b < s.n; b++) { const w = lv(r.cur[b]); if (fn2(w)) { sec[fn1(w)] += s.dur[b] / 2; sec[fn2(w)] += s.dur[b] / 2; } else sec[w] += s.dur[b]; }      // 双重功能的格子，两个功能各算一半
      h.querySelector('.share').innerHTML = [1, 3, 2, 5, 4].map((v) => `<i style="width:${(100 * sec[v] / s.duration).toFixed(2)}%;background:${FN[v].color}"></i>`).join('');
    });
    let handoffs = 0, last = null, none = 0, multi = 0, changed = 0, shaky = 0, changedLv = 0;
    const leadSec = new Map();
    st.uStarts = [];
    computeLeadRuns(s);
    for (let b = 0, prevU = false; b < s.n; b++) {
      const hs = holders(b), key = hs.join(',');
      const sounding = s.rows.some((r) => r.cur && r.cur[b] !== 0);
      if (hs.length === 0) { if (sounding) none++; } else {
        if (hs.length > 1) multi++;
        if (last !== null && key !== last) handoffs++;
        last = key;
        hs.forEach((i) => leadSec.set(i, (leadSec.get(i) || 0) + s.dur[b]));
      }
      let u = false;
      s.rows.forEach((r) => { if (!r.cur) return; if (r.cur[b] !== r.auto[b]) changed++; if (lv(r.cur[b]) !== lv(r.auto[b])) changedLv++; if (r.unstable[b]) u = true; });
      if (u) { shaky++; if (!prevU) st.uStarts.push(b); }
      prevU = u;
    }
    s.changed = changed;
    const leadBeats = leadSec;
    const who = [...leadSec.entries()].sort((a, b) => b[1] - a[1]).map(([i, c]) => `${stemName(s.rows[i])} ${Math.round(100 * c / s.duration)}%`);
    $('#facts').innerHTML =
      `<div class="fact"><b>${handoffs}</b><span>${esc(T('fHand'))}</span></div>` +
      `<div class="fact"><b>${leadBeats.size}</b><span>${esc(T('fLeads'))}</span></div>` +
      `<div class="fact wide"><p>${who.length ? esc(who.join('　')) : esc(T('fNoLead'))}</p></div>` +
      `<div class="fact"><b>${st.uStarts.length}</b><span>${esc(T('fUnsure', shaky))}</span></div>` +
      `<div class="fact"><b>${LEVEL === 2 ? changedLv : changed}</b><span>${esc(T('fEdited'))}</span></div>` +
      ((none || multi) ? `<div class="fact wide"><p>${none ? esc(T('fNone', none)) + '　' : ''}${multi ? esc(T('fMulti', multi)) : ''}</p></div>` : '');
    $('#undo').disabled = !!s.draft || !st.undo.length; $('#redo').disabled = !!s.draft || !st.redo.length;
    $('#prevU').disabled = $('#nextU').disabled = !st.uStarts.length;
    st.ringDirty = true; st.dirty = true;
  }
  function renderBrushes() {
    const items = FN.map((f, v) => ({ v, name: fnName(v), key: f.key, note: LEVEL === 2 && v === 4 ? T('fnAccNote') : T('fnNote')[v], h: f.h, color: f.color }))
      .filter((it) => !(LEVEL === 2 && it.v === 5));
    items.push({ v: -1, name: T('restore'), key: 'R', note: T('restoreNote'), h: 0, color: null });
    $('#brushes').innerHTML = items.map((it) => `<button class="brush" data-v="${it.v}" aria-pressed="${st.mode === 'edit' && lv(st.brush) === it.v}" title="${esc(it.note)}">
      <span class="glyph"><u style="height:${it.v === -1 ? 2 : Math.max(2, it.h * 22)}px;background:${it.color || (it.v === -1 ? `rgba(${INK},.7)` : 'transparent')}"></u></span>
      <b>${esc(it.name)}</b><kbd>${it.key}</kbd></button>`).join('')
      + `<button class="brush add${st.song && !st.song.canDual ? ' off' : ''}" id="addFn" aria-pressed="${st.add}" title="${esc(T('addTip'))}">
      <span class="glyph dual"><u style="height:17px;background:${FN[3].color}"></u><u style="height:6px;background:${FN[4].color}"></u></span>
      <b>${esc(T('addBtn'))}</b><kbd>D</kbd></button><p class="addHint dim">${esc(T(st.song && !st.song.canDual ? 'addNeedsRestart' : 'addHint'))}</p>`;
  }
  function setMode(m) {
    if (m === 'align' && st.song && st.song.view === 'bar') m = 'point';      // 按小节时没有对齐（网格只在按拍里改）
    if (st.preview && (m === 'edit' || m === 'align')) { toast(T('histBusy'), 4000); m = 'point'; }      // 看历史版本时不能改
    st.mode = m;
    $('#modePoint').setAttribute('aria-pressed', m === 'point'); $('#modeEdit').setAttribute('aria-pressed', m === 'edit'); $('#modeListen').setAttribute('aria-pressed', m === 'listen');
    $('#modeAlign').setAttribute('aria-pressed', m === 'align');
    tl.style.cursor = m === 'edit' ? 'crosshair' : m === 'listen' ? 'pointer' : m === 'align' ? 'ew-resize' : 'default';
    renderBrushes(); st.dirty = true;
  }
  function setBrush(v) { st.brush = lv(v); setMode('edit'); }   // 选了画笔，就是要改标注（二级里没有单独的音型伴奏画笔）
  // “再加一个功能”：开着的时候（或按住 Shift 的时候）画笔不是改掉这几拍，而是在原有功能上再加一个
  function setAdd(on) {
    if (on && st.song && !st.song.canDual) { toast(T('addNeedsRestart'), 12000); return; }
    st.add = !!on; if (st.add && st.mode !== 'edit') setMode('edit'); else { renderBrushes(); st.dirty = true; }
  }
  function applySolo() {
    const s = st.song, ids = [...st.solo].sort((a, b) => a - b);
    engine.setActive(ids.length ? ids.map((i) => audioUrl(s, s.rows[i].file)) : [audioUrl(s, s.mix)]);
    $$('#heads .head').forEach((h) => {
      if (h.dataset.i.startsWith('cap')) return;
      const i = +h.dataset.i;
      h.classList.toggle('off', ids.length > 0 && !st.solo.has(i));
      h.querySelector('.solo').setAttribute('aria-pressed', st.solo.has(i));
    });
    $('#listen').innerHTML = ids.length ? T('listenSolo', ids.map((i) => esc(stemName(s.rows[i]))).join(T('sep'))) : T('listenMix');
    $('#clearSolo').hidden = !ids.length;
    st.dirty = true;
  }
  function renderSongTexts(keepZoom) {     // 打开一首歌、或切换语言之后，把所有跟文字有关的地方重画一遍
    const s = st.song;
    $('#edKicker').textContent = [genreName(s.genre), s.artist].filter(Boolean).join(' · ') || (s.c === 'suno' ? T('sunoKicker') : '');
    $('#edTitle').textContent = s.title;
    $('#edMeta').textContent = s.view === 'bar'
      ? `${T('barsN', s.n)} · ${T('ruleMetaV', s.rule)}` + (s.barInfo ? ` · ${T('barSrc', s.barInfo.source)}${s.barInfo.confirm ? T('barConfirm') : ''}` : '')
      : `${s.bpm} BPM · ${fmt(s.duration)} · ${T('beats', s.n)}` + ` · ${T('ruleMetaV', s.rule)}`;
    document.title = s.title + ' · ' + T('docTitle');
    buildHeads(); layout(keepZoom); renderBrushes(); applySolo(); refreshDerived(); showSave(); output.label(); renderGrid();
    $('#retBtn').setAttribute('aria-pressed', st.ret); $('#metroBtn').setAttribute('aria-pressed', metro.on);
    st.lastBeat = -1; st.dirty = true;
  }

  // ---- 每条轨的音量起伏（波形），画在行的背景里
  async function loadPeaks(s) {
    try {
      const p = await api(`/api/peaks?c=${s.c}&id=${s.id}`);
      if (st.song !== s || !p.rate) return;
      s.peakRate = p.rate;
      s.rows.forEach((r) => {
        const e = p.stems && p.stems[r.name]; if (!e || !e.data) return;
        const bin = atob(e.data), arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        r.peaks = arr;
      });
      st.dirty = true;
    } catch (err) { /* 没有波形数据就不画 */ }
  }
  function wavePath(s, r, W) {
    const pk = r.peaks, rate = s.peakRate, pps = st.view.pps, base = r.y + r.h, hmax = r.h - 1, t0 = st.view.t0;
    const p = new Path2D();
    p.moveTo(0, base);
    for (let x = 0; x <= W; x++) {
      const i0 = Math.floor((t0 + x / pps) * rate);
      if (i0 >= pk.length) { p.lineTo(x, base); break; }
      const i1 = Math.min(pk.length, Math.max(i0 + 1, Math.ceil((t0 + (x + 1) / pps) * rate)));
      let m = 0; for (let i = i0; i < i1; i++) if (pk[i] > m) m = pk[i];
      p.lineTo(x, base - (m / 255) * hmax);
    }
    p.lineTo(W, base); p.closePath();
    return p;
  }

  // ---- 时间线
  function drawTimeline() {
    const s = st.song; if (!s) return;
    const { ctx, w: W, h: H } = sizeCanvas(tl);
    ctx.clearRect(0, 0, W, H);
    const pps = st.view.pps, tA = st.view.t0, tB = tA + W / pps;
    const bA = beatAt(s, tA), bB = Math.min(s.n, beatAt(s, Math.min(s.duration - 1e-6, tB)) + 1);

    // 刻度：上面一行是时间，下面一行是小节。往下贯穿各行的竖线跟着小节和拍走，不跟着秒走
    const step = [1, 2, 5, 10, 15, 30, 60, 120].find((v) => v * pps >= 62) || 120;
    ctx.font = "10px 'JetBrains Mono', Consolas, monospace"; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    for (let t = Math.floor(tA / step) * step; t <= tB; t += step) {
      const x = Math.round(X(t)) + 0.5; if (x < -40 || t < 0) continue;
      ctx.strokeStyle = `rgba(${INK},.16)`; ctx.beginPath(); ctx.moveTo(x, TROW - 6); ctx.lineTo(x, TROW); ctx.stroke();
      ctx.fillStyle = `rgba(${INK},.42)`; ctx.fillText(fmt(t), x + 5, TROW - 11);
    }
    ctx.strokeStyle = `rgba(${INK},.07)`; ctx.beginPath(); ctx.moveTo(0, TROW + 0.5); ctx.lineTo(W, TROW + 0.5); ctx.stroke();
    ctx.strokeStyle = `rgba(${INK},.11)`; ctx.beginPath(); ctx.moveTo(0, RULER + 0.5); ctx.lineTo(W, RULER + 0.5); ctx.stroke();
    const sliding = !!(st.align && st.align.moved), pending = sliding || !!s.draft;
    drawGrid(ctx, s, W, H, pending ? '238,94,35' : INK, pending ? 2.2 : 1, sliding ? st.align.d : 0);      // 网格有没应用的改动时画成橙色
    if (st.view.t0 < 0) {                    // 歌开头之前：没有声音，压暗一些，并用虚线标出歌是从哪里开始的
      const x0 = Math.round(X(0));
      ctx.fillStyle = 'rgba(13,13,14,.5)'; ctx.fillRect(0, RULER + RIBBON, x0, H - RULER - RIBBON);
      ctx.strokeStyle = `rgba(${INK},.38)`; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(x0 + 0.5, TROW); ctx.lineTo(x0 + 0.5, H); ctx.stroke(); ctx.setLineDash([]);
    }

    // “主旋律在谁手里”
    const ry = RULER + 7, rh = RIBBON - 14;
    ctx.font = LANG === 'zh' ? "500 12px 'Noto Serif SC', 'Songti SC', serif" : "600 11.5px 'Inter Tight', system-ui, sans-serif"; ctx.textAlign = 'center';
    for (const run of s.leadRuns) {      // 分段在标注变化时算好（refreshDerived），这里只画看得见的那几段，段的两头按真实位置画
      if (run.b <= bA) continue;
      if (run.a >= bB) break;
      if (run.kind === '') continue;
      const x0 = X(s.edges[run.a]) + 1, x1 = X(s.edges[run.b]) - 1, w = Math.max(1, x1 - x0);
      if (run.kind === '~') {
        ctx.strokeStyle = `rgba(${INK},.3)`; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(x0, ry + rh / 2); ctx.lineTo(x1, ry + rh / 2); ctx.stroke(); ctx.setLineDash([]);
        continue;
      }
      const many = run.ids.length > 1;
      ctx.fillStyle = many ? 'rgba(194,31,85,.3)' : 'rgba(238,94,35,.2)'; ctx.strokeStyle = many ? FN[2].color : FN[1].color; ctx.lineWidth = 1;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, ry, w, rh, Math.min(rh / 2, w / 2)); else ctx.rect(x0, ry, w, rh); ctx.fill(); ctx.stroke();
      const label = many ? T('many', run.ids.length) : stemName(s.rows[run.ids[0]]);
      const lo = Math.max(x0, 0), hi = Math.min(x1, W);
      if (hi - lo > ctx.measureText(label).width + 12) { ctx.fillStyle = `rgba(${INK},.92)`; ctx.fillText(label, (lo + hi) / 2, ry + rh / 2 + 0.5); }
    }

    // 各行
    s.rows.forEach((r, ri) => {
      const base = r.y + r.h, dim = st.solo.size > 0 && !st.solo.has(ri);
      ctx.globalAlpha = dim ? 0.3 : 1;
      ctx.strokeStyle = `rgba(${INK},.13)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, base + 0.5); ctx.lineTo(W, base + 0.5); ctx.stroke();
      const wave = st.showW && r.peaks && s.peakRate ? wavePath(s, r, W) : null;
      if (wave) { ctx.fillStyle = `rgba(${INK},${r.cur ? 0.15 : 0.2})`; ctx.fill(wave); }
      if (!r.cur) {
        if (!wave) { ctx.strokeStyle = `rgba(${INK},.16)`; ctx.setLineDash([1, 5]); ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, base - 6); ctx.lineTo(W, base - 6); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1; }
        ctx.globalAlpha = 1; return;
      }
      const bars = wave ? new Path2D() : null;
      eachRun(r.cur, bA, bB, (p, q, code) => {
        if (!code) return;
        const x0 = X(s.edges[p]) + 0.75, x1 = X(s.edges[q]) - 0.75, w = Math.max(1, x1 - x0);
        // 双重功能：两个功能各按自己的高度画，高的在后、矮的在前，中间留一道缝
        (fn2(code) ? [fn1(code), fn2(code)] : [code]).forEach((v, k) => {
          const bh = Math.max(3, r.h * FN[v].h), rad = Math.min(4, w / 2, bh / 2);
          const box = (top, hgt) => { ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x0, top, w, hgt, [rad, rad, 0, 0]); else ctx.rect(x0, top, w, hgt); ctx.fill(); };
          if (k) { ctx.fillStyle = '#0d0d0e'; box(base - bh - 2, bh + 2); }
          ctx.fillStyle = FN[v].color; box(base - bh, bh);
          if (bars && !k) bars.rect(x0, base - bh, w, bh);
          if (w > 5) {
            if (v === 1) { ctx.fillStyle = 'rgba(255,255,255,.42)'; ctx.fillRect(x0 + rad, base - bh, w - 2 * rad, 2); }
            if (v === 2 && bh > 9) { ctx.fillStyle = 'rgba(255,255,255,.34)'; ctx.fillRect(x0 + 1, base - bh + 4, w - 2, 1); }
          }
        });
      });
      if (wave) {                    // 色块里面的波形用深色再画一遍，像工程里的音频片段
        ctx.save(); ctx.clip(bars); ctx.fillStyle = 'rgba(13,13,14,.36)'; ctx.fill(wave); ctx.restore();
      }
      for (let b = bA; b < bB; b++) {
        const x0 = X(s.edges[b]), x1 = X(s.edges[b + 1]);
        if (lv(r.cur[b]) !== lv(r.auto[b])) { ctx.fillStyle = `rgba(${INK},.95)`; ctx.fillRect(x0 + 1, base + 2, Math.max(1, x1 - x0 - 2), 2); }
        if (st.showU && r.unstable[b]) {     // 存疑的小圈画在色块上方；色块顶到行顶时画在色块里面，免得跑到上一行去
          const want = base - (r.cur[b] ? Math.max(3, r.h * FN[fn1(lv(r.cur[b]))].h) : 0) - 5, inside = want < r.y + 4;
          ctx.strokeStyle = inside ? 'rgba(13,13,14,.85)' : `rgba(${INK},.9)`; ctx.lineWidth = inside ? 1.5 : 1.2;
          ctx.beginPath(); ctx.arc((x0 + x1) / 2, inside ? r.y + 5 : want, 2.1, 0, Math.PI * 2); ctx.stroke(); ctx.lineWidth = 1;
        }
      }
      ctx.globalAlpha = 1;
    });

    // 指针所在的那一格
    if (st.hover && st.hover.ri >= 0 && !st.scrub) {
      const r = s.rows[st.hover.ri], b = st.hover.beat, x0 = X(s.edges[b]), x1 = X(s.edges[b + 1]);
      ctx.strokeStyle = `rgba(${INK},${st.mode === 'point' ? 0.4 : 0.75})`; ctx.lineWidth = 1; ctx.strokeRect(Math.round(x0) + 0.5, r.y - 2.5, Math.max(2, Math.round(x1 - x0) - 1), r.h + 5);
      if (st.mode === 'edit' && r.cur) {     // 只有在“改标注”时，指针旁边才带着画笔的颜色
        const v = fn1(lv(st.brush === -1 ? r.auto[b] : st.brush));
        ctx.fillStyle = v ? FN[v].color : `rgba(${INK},.5)`; ctx.beginPath(); ctx.arc(st.hover.x + 13, st.hover.y - 13, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#0d0d0e'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.lineWidth = 1;
        if (adding() && st.brush !== -1) {      // 正在“再加一个功能”：色点旁边带一个加号
          const cx = st.hover.x + 26, cy = st.hover.y - 13, plus = (d) => { ctx.beginPath(); ctx.moveTo(cx - d, cy); ctx.lineTo(cx + d, cy); ctx.moveTo(cx, cy - d); ctx.lineTo(cx, cy + d); ctx.stroke(); };
          ctx.strokeStyle = '#0d0d0e'; ctx.lineWidth = 4.5; plus(5);
          ctx.strokeStyle = `rgb(${INK})`; ctx.lineWidth = 1.8; plus(4.2); ctx.lineWidth = 1;
        }
      }
    }
    // 跳到存疑处时闪一下
    if (st.flash) {
      const k = (st.flash.until - performance.now()) / 900;
      if (k <= 0) st.flash = null; else {
        const x0 = X(s.edges[st.flash.a]), x1 = X(s.edges[st.flash.b]);
        ctx.fillStyle = `rgba(${INK},${(0.16 * k).toFixed(3)})`; ctx.fillRect(x0, RULER + RIBBON, Math.max(3, x1 - x0), H);
        st.dirty = true;
      }
    }
    // “停止回起点”开着时，标出会回到哪里
    if (st.ret) {
      const ox = X(engine.origin);
      if (ox >= -6 && ox <= W + 6) {
        const x = Math.round(ox) + 0.5;
        ctx.fillStyle = `rgba(${INK},.6)`; ctx.beginPath(); ctx.moveTo(x - 5, 1); ctx.lineTo(x + 5, 1); ctx.lineTo(x, 8.5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = `rgba(${INK},.3)`; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(x, 9); ctx.lineTo(x, H); ctx.stroke(); ctx.setLineDash([]);
      }
    }
    // 播放线
    const px = X(engine.pos());
    if (px >= -2 && px <= W + 2) {
      const x = Math.round(px) + 0.5;
      ctx.strokeStyle = `rgba(${INK},.95)`; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, RULER - 2); ctx.lineTo(x, H); ctx.stroke();
      ctx.fillStyle = `rgb(${INK})`; ctx.beginPath(); ctx.arc(x, RULER - 4, 4, 0, Math.PI * 2); ctx.fill();
    }
    // 拖着对齐的途中：在指针旁边写出声音挪了多少
    if (sliding) {
      const label = movedText(s, st.align.d);
      ctx.font = LANG === 'zh' ? "500 12px 'Noto Serif SC', 'Songti SC', serif" : "600 11.5px 'Inter Tight', system-ui, sans-serif"; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      const w = ctx.measureText(label).width + 18, x = clamp(st.align.x + 16, 4, Math.max(4, W - w - 4)), y = RULER + RIBBON + 6;
      ctx.fillStyle = 'rgba(13,13,14,.9)'; ctx.strokeStyle = 'rgba(238,94,35,.75)'; ctx.lineWidth = 1;
      ctx.beginPath(); if (ctx.roundRect) ctx.roundRect(x + 0.5, y + 0.5, w, 24, 7); else ctx.rect(x + 0.5, y + 0.5, w, 24); ctx.fill(); ctx.stroke();
      ctx.fillStyle = `rgba(${INK},.95)`; ctx.fillText(label, x + 9, y + 13);
    }
  }

  // 画网格：小节标尺上的小节号和小节线；放大以后每一拍一条细线。歌开头之前也照样排线。
  // k 是浓淡（没应用的改动画得重一些）。shift：拖着对网格的途中，线要留在屏幕上原来的地方，相当于每条线在声音里的时间都早 shift 秒
  function drawGrid(ctx, s, W, H, rgb, k, shift) {
    const e = s.edges, n = s.n, off = s.off, head = s.head, bpb = s.bpb, bar0 = s.bar0;
    const pps = st.view.pps, tA = st.view.t0 + shift, tB = tA + W / pps, top = RULER + RIBBON;
    const time = (i) => (i >= off ? e[i] : lineTime(s, i - off));      // 序号小于 off 的是歌开头之前的线
    let i0;
    if (tA < e[off]) { i0 = off - 1; while (time(i0) >= tA && i0 > off - 8192) i0--; }
    else { let lo = off, hi = n; while (lo < hi) { const m = (lo + hi) >> 1; if (e[m] < tA) lo = m + 1; else hi = m; } i0 = Math.max(off, lo - 1); }
    const pxBeat = pps * (n - off > 1 ? (e[n - 1] - e[off]) / (n - 1 - off) : head), pxBar = pxBeat * bpb;
    const every = [1, 2, 4, 8, 16, 32, 64].find((v) => v * pxBar >= 34) || 128;      // 小节号太挤时隔几个标一个
    const al = (v) => Math.min(1, v * k).toFixed(3);
    ctx.font = "10px 'JetBrains Mono', Consolas, monospace"; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineWidth = 1;
    for (let i = i0; i < n; i++) {
      const t = time(i); if (t > tB) break;
      const x = Math.round(X(t - shift)) + 0.5, q = i - bar0;
      if ((q % bpb + bpb) % bpb === 0) {
        const bar = q / bpb + 1, main = ((bar - 1) % every + every) % every === 0;
        if (main || pxBar >= 9) { ctx.strokeStyle = `rgba(${rgb},${al(main ? 0.36 : 0.17)})`; ctx.beginPath(); ctx.moveTo(x, main ? TROW + 3 : RULER - 7); ctx.lineTo(x, RULER); ctx.stroke(); }
        if (main) { ctx.fillStyle = `rgba(${rgb},${al(bar === 1 ? 0.95 : 0.62)})`; ctx.fillText(String(bar), x + 4, TROW + 12.5); }
        if (main || pxBar >= 14) { ctx.strokeStyle = `rgba(${rgb},${al(main ? 0.11 : 0.07)})`; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, H); ctx.stroke(); }
      } else if (pxBeat >= 7) {
        ctx.strokeStyle = `rgba(${rgb},${al(0.26)})`; ctx.beginPath(); ctx.moveTo(x, RULER - 4); ctx.lineTo(x, RULER); ctx.stroke();
        ctx.strokeStyle = `rgba(${rgb},${al(0.04)})`; ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, H); ctx.stroke();
      }
    }
  }

  function drawRing() {
    const s = st.song; if (!s) return;
    const { ctx, w: size, dpr } = sizeCanvas(ringCv);
    if (st.ringDirty || !ringCache || ringCache.width !== ringCv.width) {
      ringCache = document.createElement('canvas'); ringCache.width = ringCv.width; ringCache.height = ringCv.height;
      const c2 = ringCache.getContext('2d'); c2.setTransform(dpr, 0, 0, dpr, 0, 0);
      ringGeo = paintRing(c2, size, s, false); st.ringDirty = false;
    }
    ctx.clearRect(0, 0, size, size);
    const g = ringGeo, ang = (t) => -Math.PI / 2 + 2 * Math.PI * t / s.duration, lvl = engine.level;
    if (g.r0 <= 1) { st.ringDirty = true; return; }      // 画布还没有尺寸：等有了再画
    // 播放时外圈随音量发光
    ctx.save(); ctx.shadowColor = `rgba(238,94,35,${(0.25 + 0.6 * lvl).toFixed(3)})`; ctx.shadowBlur = 10 + 26 * lvl;
    ctx.strokeStyle = `rgba(238,94,35,${(0.1 + 0.5 * lvl).toFixed(3)})`; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(g.c, g.c, g.R + 4, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(ringCache, 0, 0); ctx.restore();
    // 时间线上正在看的那一段
    const tA = Math.max(0, st.view.t0), tB = Math.min(s.duration, st.view.t0 + viewW() / st.view.pps);
    if (tB - tA < s.duration - 0.5) {
      ctx.strokeStyle = `rgba(${INK},.75)`; ctx.lineWidth = 2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(g.c, g.c, g.R + 9, ang(tA), ang(tB)); ctx.stroke(); ctx.lineCap = 'butt';
    }
    const a = ang(engine.pos()), ca = Math.cos(a), sa = Math.sin(a);
    ctx.strokeStyle = `rgb(${INK})`; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(g.c + ca * (g.r0 - 7), g.c + sa * (g.r0 - 7)); ctx.lineTo(g.c + ca * (g.R + 11), g.c + sa * (g.R + 11)); ctx.stroke();
    ctx.fillStyle = `rgb(${INK})`; ctx.beginPath(); ctx.arc(g.c + ca * (g.R + 11), g.c + sa * (g.R + 11), 3, 0, Math.PI * 2); ctx.fill();
  }
  function updateReadouts() {
    const s = st.song, pos = engine.pos(), b = beatAt(s, Math.min(pos, s.duration - 1e-6));
    $('#clock').textContent = `${fmt(pos)} / ${fmt(s.duration)}` + (engine.loading ? T('loading') : '');
    $('#rTime').textContent = fmt(pos);
    if (b !== st.lastBeat) {
      st.lastBeat = b;
      $('#rBeat').textContent = s.view === 'bar' ? T('barOf', b + (s.barInfo && s.barInfo.pickup ? 0 : 1), s.n) : T('beatOf', ...barBeat(s, b), b + 1, s.n);
      const hs = holders(b);
      $('#rLead').textContent = hs.length ? T('leadNow', hs.map((i) => stemName(s.rows[i])).join(T('sep'))) : '';
    }
    const want = engine.playing ? 'M3 1.5h3.6v13H3zM9.4 1.5H13v13H9.4z' : 'M3 1.5v13l11-6.5z';
    const path = $('#playIcon path'); if (path.getAttribute('d') !== want) path.setAttribute('d', want);
  }

  // ---- 改标注
  function paint(ri, from, to) {
    const row = st.song.rows[ri], lo = Math.min(from, to), hi = Math.max(from, to);
    let touched = false;
    for (let b = lo; b <= hi; b++) {
      const old = row.cur[b], was = st.stroke.before.has(b) ? st.stroke.before.get(b) : old;      // was：这一笔落下之前，这一格是什么
      const v = st.brush === -1 ? row.auto[b] : st.stroke.add ? addFn(was, st.brush) : st.brush;
      if (old === v || (st.brush !== -1 && lv(old) === lv(v))) continue;      // 二级：这一格已经是“伴奏”，不改写它原来是哪一种
      if (!st.stroke.before.has(b)) st.stroke.before.set(b, old);
      row.cur[b] = v; touched = true;
    }
    if (touched) computeLeadRuns(st.song);      // 顶上那条色带跟着手上的笔实时变
    st.dirty = true; st.ringDirty = true;
  }
  function endStroke() {
    const k = st.stroke; st.stroke = null; if (!k) return;
    const row = k.song.rows[k.ri];
    const beats = [...k.before.keys()].filter((b) => row.cur[b] !== k.before.get(b)).sort((a, b) => a - b);
    if (!beats.length || k.song !== st.song) return;
    st.undo.push({ ri: k.ri, beats, before: beats.map((b) => k.before.get(b)), after: beats.map((b) => row.cur[b]) });
    if (st.undo.length > 300) st.undo.shift();
    st.redo = [];
    labelsChanged();
  }
  function labelsChanged() { st.lastBeat = -1; refreshDerived(); scheduleSave(); }
  function undoRedo(from, to, field) {
    if (st.preview) return;
    if (st.stroke || (st.song && st.song.draft)) return;      // 网格有没应用的改动时，格子对不上，先不撤销
    const e = from.pop(); if (!e) return;
    const row = st.song.rows[e.ri];
    e.beats.forEach((b, i) => { row.cur[b] = e[field][i]; });
    to.push(e); labelsChanged();
    reveal(st.song.edges[e.beats[0]]);
    st.detached = true;                            // 让人看清撤销的是哪里：画面先留在这儿，不跟着播放线走
    st.flash = { a: e.beats[0], b: e.beats[e.beats.length - 1] + 1, until: performance.now() + 900 };
  }

  // ---- 保存：改完 0.7 秒后自动存；同一时间只发一个请求，发出去的总是那一刻最新的内容
  let saveTimer = 0, saving = false, saveAgain = false;
  const WRITER = Math.random().toString(36).slice(2) + Date.now().toString(36);   // 这个页面的标识：服务端据此认出“上一版就是这个页面自己存的”
  function showSave() {
    const s = st.song, p = $('#saveState'); if (!s) return;
    p.classList.toggle('err', st.save === 'error');
    p.textContent = st.save === 'error' ? saveErrText() : st.save === 'saving' ? T('saving') : st.save === 'dirty' ? T('savePending')
      : s.savedAt ? T('saved', s.savedAt.slice(11), s.changed) : T('saveNone');
  }
  // 被服务端拦下（别处保存过，或自动识别结果换过）以后，不再自动重发：改动留在页面里，等用户确认覆盖或刷新
  const blocked = () => st.save === 'error' && (st.saveCode === 'conflict' || st.saveCode === 'auto_changed');
  function saveErrText() {
    if (st.saveCode === 'conflict') return T('conflict');
    if (st.saveCode === 'auto_changed') return T('autoChanged');
    const zh = /[\u4e00-\u9fff]/.test(st.saveErr);       // 服务端的报错是中文；英文界面下换成状态码
    return T('saveErr', LANG === 'en' && zh ? ('server error ' + (st.saveStatus || '')) : st.saveErr);
  }
  function scheduleSave() {
    if (blocked()) { showSave(); return; }
    st.save = 'dirty'; showSave(); clearTimeout(saveTimer); saveTimer = setTimeout(() => saveNow(), 700);
  }
  // 每次保存都告诉服务端：这是照哪一版自动识别结果改的（auto_fp），以及本页手里是第几版（base_rev）。
  // 服务端发现对不上就拒收并把内容另存一份，不会悄悄盖掉别处的修改。
  function payloadOf(s, extra) {
    // 网格有草稿时页面上是预览；存的永远是没动过的原件
    const pv = st.preview && st.preview.song === s ? st.preview.orig : null;      // 正在看历史版本：存的是现在的标记，不是屏幕上那一版
    const labels = {}; s.rows.forEach((r, i) => { if (r.cur) labels[r.name] = Array.from(pv && pv[i] ? pv[i] : s.live ? s.live.rows[i].cur : r.cur); });
    return JSON.stringify(Object.assign({ labels, done: s.done, note: s.note, base_rev: s.rev, auto_fp: s.autoFp, writer: WRITER }, extra || {}));
  }
  async function saveNow(force) {
    clearTimeout(saveTimer);
    if (saving) { saveAgain = true; return; }
    saving = true;
    try {
      do {
        saveAgain = false;
        const s = st.song; if (!s) break;
        st.save = 'saving'; showSave();
        try {
          const r = await api(`/api/save?c=${s.c}&id=${s.id}${s.view === 'bar' ? '&view=bar' : ''}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payloadOf(s, force ? { force: true } : null) });
          s.savedAt = r.saved_at; s.rev = r.rev; force = false; st.saveCode = ''; st.saveErr = '';
          if (st.song === s && !saveAgain && st.save === 'saving') st.save = 'idle';
        } catch (err) {
          if (st.song === s) { st.save = 'error'; st.saveCode = err.code || ''; st.saveErr = err.message; st.saveStatus = err.status || 0; }
          saveAgain = false;
        }
        if (st.song === s) showSave();
      } while (saveAgain);
    } finally { saving = false; }
  }
  function retrySave() {
    if (st.save !== 'error') return;
    if (st.saveCode === 'auto_changed') { toast(T('autoChanged'), 7000); return; }
    if (st.saveCode === 'conflict') { if (window.confirm(T('conflictAsk'))) saveNow(true); return; }
    saveNow();
  }
  async function flushSave() {          // 把还没存的存掉；返回 true 表示现在是干净的
    if (st.stroke) endStroke();
    if (!st.song) return true;
    if (blocked()) return false;
    if (st.save === 'dirty' || st.save === 'error') await saveNow();
    while (saving) await new Promise((r) => setTimeout(r, 40));
    if (st.save === 'dirty') await saveNow();
    return st.save !== 'error' && st.save !== 'dirty';
  }
  window.addEventListener('beforeunload', (e) => {
    const s = st.song;
    if (!s) return;
    // 网格的改动还没来得及存：补发一次。标记也有没存上的修改时不发（两样撞在一起会被拦下），那时先保标记
    if (s.draft && !st.job && st.save === 'idle') navigator.sendBeacon(`/api/regrid?c=${s.c}&id=${s.id}`, new Blob([JSON.stringify({ grid: gridBody(s) })], { type: 'application/json' }));
    if (st.save === 'idle') return;
    // 关页面时补发一次。被服务端拦下的话，内容会被另存成 rejected 文件，不会丢
    navigator.sendBeacon(`/api/save?c=${s.c}&id=${s.id}${s.view === 'bar' ? '&view=bar' : ''}`, new Blob([payloadOf(s, { beacon: true })], { type: 'application/json' }));
    if (st.save === 'error') { e.preventDefault(); e.returnValue = ''; }     // 上一次就没存上：让浏览器再问一句
  });

  // ---- 打开一首歌
  let openToken = 0;
  function stayHere() {          // 用户不想丢下没存上的修改：把地址改回当前这首歌（openSong 发现是同一首就什么都不做）
    const s = st.song; if (s) location.hash = `#/${s.c}/${s.id}`;
  }
  async function openSong(c, id) {
    if (st.song && st.song.c === c && st.song.id === id) { swap('editor'); return; }
    const my = ++openToken;
    if (st.song && st.song.draft && !(await flushGrid()) && !window.confirm(T('leaveUnsavedGrid'))) { stayHere(); return; }
    if (my !== openToken) return;
    if (st.song && !(await flushSave()) && !window.confirm(T('leaveUnsaved'))) { stayHere(); return; }
    let data;
    try { data = await api(`/api/song?c=${c}&id=${id}${VIEW === 'bar' ? '&view=bar' : ''}`); }
    catch (err) {
      let e = err;
      if (err.code === 'no_bar') {               // 这首歌还没有按小节的结果：回到按拍
        toast(T('noBar'), 6000); VIEW = 'beat'; store.set('fn-view', 'beat'); paintView();
        try { data = await api(`/api/song?c=${c}&id=${id}`); e = null; } catch (err2) { e = err2; }
      }
      if (e) { toast(e.message); if (my === openToken && !st.song) location.hash = '#/' + c; else if (my === openToken) stayHere(); return; }
    }
    if (my !== openToken) return;
    if (st.song && (st.save !== 'idle' || st.stroke) && !(await flushSave()) && !window.confirm(T('leaveUnsaved'))) { stayHere(); return; }
    if (my !== openToken) return;
    clearTimeout(saveTimer);
    const s = buildSong(c, id, data);
    document.body.classList.toggle('viewBar', s.view === 'bar');
    if (s.view === 'bar' && metro.on) setMetro(false);      // 节拍器、网格只在按拍里
    st.song = s; st.solo = new Set(); st.undo = []; st.redo = []; st.hover = null; st.stroke = null; st.scrub = false; st.flash = null;
    st.save = 'idle'; st.saveErr = ''; st.saveCode = ''; st.lastJump = -1; st.holdFollow = 0; st.detached = false;
    dropPreview(); hist.data = null;
    st.job = null; st.align = null; gridUi.close(); lockEditing(false);
    clearTimeout(gridTimer); st.gridErr = ''; st.gridSaved = ''; st.pendingShift = 0;
    engine.reset(s.duration);
    $('#note').value = s.note;
    $('#done').setAttribute('aria-pressed', s.done);
    swap('editor');
    st.mode = 'point';                     // 每次打开都从普通指针开始，免得一上来就改到东西
    st.view = { t0: viewHome(s), pps: 0 };
    renderSongTexts(); setMode('point');
    st.view.pps = Math.max(st.fitPps, 11); st.view.t0 = viewHome(s); clampView();
    loadPeaks(s);
    if (data.job && data.job.state === 'running') { st.job = data.job; lockEditing(true); renderGrid(); watchJob(s); }      // 这首歌正在重新识别：接着等
    if (s.use === 'stale') toast(T('stale'), 9000);
    else if (s.use === 'bad') toast(T('badFile'), 9000);
    else if (s.use === 'edits') { toast(T('rebased', s.rebased), 7000); if (s.rebased) scheduleSave(); }
  }
  function swap(which) {
    const a = $('#home'), b = $('#editor'), show = which === 'editor' ? b : a, hide = which === 'editor' ? a : b;
    if (!show.hidden) return;
    hide.hidden = true; show.hidden = false; show.classList.add('out');
    requestAnimationFrame(() => requestAnimationFrame(() => show.classList.remove('out')));
    setTimeout(() => show.classList.remove('out'), 300);
    window.scrollTo(0, 0);
  }
  async function leaveEditor() {
    if (!st.song) return true;
    engine.pause();
    if (st.song.draft && !(await flushGrid()) && !window.confirm(T('leaveUnsavedGrid'))) return false;
    if (!st.song) return true;
    if (!(await flushSave()) && !window.confirm(T('leaveUnsaved'))) return false;
    clearTimeout(saveTimer); clearTimeout(gridTimer); st.song = null; st.job = null; engine.reset(0); output.close(); gridUi.close(); lockEditing(false);
    dropPreview(); hist.data = null;
    document.documentElement.style.setProperty('--lvl', '0'); st.lvlCss = -1;
    return true;
  }

  // ---- 拍速与网格的菜单
  const gridUi = {
    open() { if (st.preview) { toast(T('histBusy'), 4000); return; } $('#gridMenu').hidden = false; $('#bpmBtn').setAttribute('aria-expanded', 'true'); renderGrid(); },
    close() { $('#gridMenu').hidden = true; $('#bpmBtn').setAttribute('aria-expanded', 'false'); },
  };
  function renderGrid() {
    const s = st.song; if (!s) return;
    const g = curGrid(s), pend = !!s.draft, busy = !!st.job, failed = pend && !busy && !!st.gridErr;      // failed：这次改动没存上，等用户再存一次或放弃
    const bpm = g.mode === 'manual' ? bpmText(g.bpm) : gridBpm(s, g).toFixed(1);      // 自动识别的拍速是个平均值，只报一位小数
    $('#bpmLabel').innerHTML = `BPM <b>${bpm}</b>` + (g.mode === 'manual' ? ` · ${esc(T('gridManualTag'))}` : '');
    $('#bpmBtn').classList.toggle('pend', pend);
    $('#applyBtn').hidden = $('#dropBtn').hidden = !failed;
    $('#applyBtn').disabled = $('#dropBtn').disabled = busy;
    $('#reLabel').textContent = T(pend ? 'reBtnPend' : 'reBtn'); $('#reBtn').disabled = busy;
    const slid = pend && s.live && Math.abs(s.live.shift) >= 0.0005 ? ' ' + movedText(s, s.live.shift) : '';
    $('#reState').textContent = busy ? T(st.job.kind === 'regrid' ? 'regridRunning' : 'reRunning', Math.round(st.job.seconds || 0))
      : failed ? st.gridErr : pend ? T(s.noPreview ? 'rePendBlind' : 'rePend') + slid : st.gridSaved ? T('gridSaved', st.gridSaved) : '';
    $('#undo').disabled = pend || !st.undo.length; $('#redo').disabled = pend || !st.redo.length;
    const m = $('#gridMenu'); if (m.hidden) return;
    const f = g.factor || 1, src = g.mode === 'manual' ? 'gridSrcManual' : f === 2 ? 'gridSrcAutoX2' : f === 0.5 ? 'gridSrcAutoHalf' : 'gridSrcAuto';
    const dis = busy ? 'disabled' : '', moved = g.mode === 'manual' ? '' : T('gridOffset', Math.round((g.offset || 0) * 1000));
    m.innerHTML = `<h5>${esc(T('gridHead'))}</h5>
      <p class="src">${T(src)}${moved ? '<br>' + esc(moved) : ''}${s.noPreview ? '<br>' + esc(T('gridNoPreview')) : ''}</p>
      <div class="row"><button class="sq" data-g="minus" title="−0.1" ${dis}>−</button><input id="bpmIn" type="number" min="20" max="400" step="0.01" value="${bpm}" aria-label="BPM" ${dis}><button class="sq" data-g="plus" title="+0.1" ${dis}>+</button>
        <button data-g="half" title="${esc(T('gridHalfTip'))}" ${busy || (g.mode === 'auto' && f === 0.5) ? 'disabled' : ''}>÷2</button><button data-g="dbl" title="${esc(T('gridDoubleTip'))}" ${busy || (g.mode === 'auto' && f === 2) ? 'disabled' : ''}>×2</button></div>
      <div class="row"><span>${esc(T('gridNudge'))}</span><button class="sq" data-g="nudge-" title="${esc(T('gridNudgeTip'))}" ${dis}>←</button><button class="sq" data-g="nudge+" title="${esc(T('gridNudgeTip'))}" ${dis}>→</button><span class="off">5 ms</span></div>
      <div class="row"><span>${esc(T('gridBpb'))}</span><button class="sq" data-g="bpb-" ${dis}>−</button><b class="bpbVal">${s.bpb}</b><button class="sq" data-g="bpb+" ${dis}>+</button><span>${esc(T('gridBpbUnit'))}</span>
        <span style="margin-left:auto">${esc(T('gridShift'))}</span><button class="sq" data-g="bar-" title="${esc(T('gridShiftTip'))}" ${dis}>←</button><button class="sq" data-g="bar+" title="${esc(T('gridShiftTip'))}" ${dis}>→</button></div>
      <button class="wide" data-g="anchor" title="${esc(T(g.mode === 'manual' ? 'gridAnchorTipManual' : 'gridAnchorTipAuto'))}" ${dis}>${esc(T('gridAnchor'))}</button>
      <button class="wide" data-g="fit" title="${esc(T('gridFitTip'))}" ${dis}>${esc(T('gridFit'))}</button>
      ${g.mode === 'manual' || f !== 1 || g.offset ? `<button class="wide" data-g="auto" ${dis}>${esc(T('gridAuto'))}</button>` : ''}
      <p class="hint">${esc(T('gridHint'))}</p>
      ${failed ? `<div class="row end"><button data-g="cancel">${esc(T('gridCancel'))}</button><button class="go" data-g="apply">${esc(T('applyBtn'))}</button></div>` : ''}`;
  }
  // 小节的设置（每小节几拍、从哪里起）不影响标记。没有网格草稿时改了就存；有草稿时跟着草稿一起应用或放弃
  async function saveBars() {
    const s = st.song;
    setBars(s); s.gridRev++;
    st.view.keep = st.view.t0;
    buildHeads(); layout(true); applySolo(); refreshDerived(); renderGrid(); st.lastBeat = -1; st.dirty = true;
    if (s.draft) return;
    try { await api(`/api/grid?c=${s.c}&id=${s.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ beats_per_bar: s.bpb, bar_at: s.barAt }) }); }
    catch (err) { toast(T('gridSaveFail', err.message), 6000); }
  }
  function gridAct(act, val) {
    const s = st.song; if (!s) return;
    if (st.job) { if (act === 'nudge-' || act === 'nudge+') shiftStems(act === 'nudge+' ? 0.005 : -0.005); return; }      // 正在保存：微调先记着，别的等存完
    const g = curGrid(s), pos = engine.pos();
    // 换成手动的匀速网格：第 1 小节的起点留在原处，拍从那里往两头排。锚点收回到歌曲开头的第一拍上（还是同一套拍线）
    const manual = (bpm, anchor) => {
      const v = clamp(r3(bpm), 20, 400), per = 60 / v, a = anchor != null ? anchor : barOne(s);
      return { mode: 'manual', bpm: v, anchor: r4(a - Math.floor(a / per) * per) };
    };
    if (act === 'bpm') { if (val >= 20 && val <= 400) setDraft(manual(val)); else renderGrid(); }
    else if (act === 'minus' || act === 'plus') setDraft(manual(Math.round((gridBpm(s, g) + (act === 'plus' ? 0.1 : -0.1)) * 100) / 100));
    else if (act === 'half' || act === 'dbl') {
      const k = act === 'dbl' ? 2 : 0.5;
      if (g.mode === 'manual') setDraft(manual(g.bpm * k)); else setDraft({ mode: 'auto', factor: clamp((g.factor || 1) * k, 0.5, 2), offset: g.offset || 0 });
    } else if (act === 'nudge-' || act === 'nudge+') shiftStems(act === 'nudge+' ? 0.005 : -0.005);
    else if (act === 'auto') {                            // 只是整体挪过的：把声音挪回去，线留在原地；别的情况整套换回自动拍点
      if (g.mode === 'auto' && (g.factor || 1) === 1 && g.offset) shiftStems(g.offset); else setDraft({ mode: 'auto', factor: 1, offset: 0 });
    }
    else if (act === 'cancel') setDraft(null);
    else if (act === 'bpb-' || act === 'bpb+') { if (s.draft) ensureLive(s); s.bpb = clamp(s.bpb + (act === 'bpb+' ? 1 : -1), 1, 12); saveBars(); }
    else if (act === 'bar-' || act === 'bar+') {          // 小节线挪一拍（第 1 小节的起点跟着挪）
      s.barAt = lineTime(s, s.j1 + (act === 'bar+' ? 1 : -1));
      saveBars();
    } else if (act === 'anchor') {                        // 把播放线这里定为第 1 小节的起点
      if (g.mode === 'manual') { ensureLive(s); s.barAt = pos; setDraft(manual(g.bpm, pos), true); }
      else { s.barAt = lineTime(s, lineNear(s, pos)); saveBars(); }
    } else if (act === 'fit') {                           // 第 1 小节的起点不动，把拍速改一点，让离播放线最近的那一拍正好落在播放线上
      const p1 = barOne(s), k = Math.round((pos - p1) / (60 / gridBpm(s, g)));
      if (!k || Math.abs(pos - p1) < 1) { toast(T('gridFitNear'), 4500); return; }
      setDraft(manual(60 * k / (pos - p1), p1));
    } else if (act === 'apply') { gridUi.close(); applyGrid(); }
  }
  $('#bpmBtn').addEventListener('click', () => { if ($('#gridMenu').hidden) gridUi.open(); else gridUi.close(); });
  $('#gridMenu').addEventListener('click', (e) => { const b = e.target.closest('button[data-g]'); if (b && !b.disabled) gridAct(b.dataset.g); });
  $('#gridMenu').addEventListener('change', (e) => { if (e.target.id === 'bpmIn') gridAct('bpm', parseFloat(e.target.value)); });
  $('#gridMenu').addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.id === 'bpmIn') e.target.blur(); });
  $('#reBtn').addEventListener('click', () => reextract());
  $('#applyBtn').addEventListener('click', () => applyGrid());
  $('#dropBtn').addEventListener('click', () => { if (!st.job) setDraft(null); });

  // ---- 节拍器：播放时在网格的每一拍上响一声，小节的第一拍音高一些。网格有没应用的改动时，响的是改动以后的网格。
  // 声音和歌走同一个播放时钟，所以和歌之间不会有先后误差
  const metro = { on: store.get('fn-metro') === '1', nodes: [], next: 0, token: -1, rev: -1, bufs: null, count: 0 };
  function metroBuf(freq) {
    const ctx = engine.ctx, n = Math.floor(ctx.sampleRate * 0.035), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) { const t = i / ctx.sampleRate; d[i] = Math.sin(2 * Math.PI * freq * t) * Math.exp(-t / 0.007) * Math.min(1, i / 6); }
    return b;
  }
  function metroClick(when, accent) {
    const ctx = engine.ctx;
    if (!metro.bufs) metro.bufs = [metroBuf(1100), metroBuf(1650)];
    const src = ctx.createBufferSource(), g = ctx.createGain();
    src.buffer = metro.bufs[accent ? 1 : 0]; g.gain.value = accent ? 0.62 : 0.42;
    src.connect(g); g.connect(engine.master); src.start(when);
    metro.nodes.push(src); metro.count++;
    src.onended = () => { const i = metro.nodes.indexOf(src); if (i >= 0) metro.nodes.splice(i, 1); };
  }
  function metroFlush() {                // 把已经排好、还没响的都撤掉（暂停、跳位置、网格变了的时候）
    for (const n of metro.nodes) { try { n.onended = null; n.stop(); } catch (e) { /* 已经响完了 */ } }
    metro.nodes = []; metro.token = -1;
  }
  function metroTick() {                 // 每隔一小会儿，把接下来四分之一秒里的拍排进去
    const s = st.song;
    if (!s || !metro.on || !engine.playing || !engine.started) { if (metro.nodes.length || metro.token !== -1) metroFlush(); return; }
    const e = s.edges, n = s.n, off = s.off, time = (i) => (i >= off ? e[i] : lineTime(s, i - off));
    if (metro.token !== engine.token || metro.rev !== s.gridRev) {
      metroFlush(); metro.token = engine.token; metro.rev = s.gridRev;
      const pos = engine.pos() + 0.01;
      let i = off && time(off - 1) >= 0 ? off - 1 : off;      // 第一条线之前的那一拍如果还在歌里（0 秒之后），也要响
      while (i < n && time(i) < pos) i++;
      metro.next = i;
    }
    const now = engine.ctx.currentTime;
    while (metro.next < n) {
      const when = engine.t0 + (time(metro.next) - engine.offset);
      if (when > now + 0.25) break;
      if (when >= now - 0.005) metroClick(Math.max(now, when), ((metro.next - s.bar0) % s.bpb + s.bpb) % s.bpb === 0);
      metro.next++;
    }
  }
  setInterval(metroTick, 30);
  function setMetro(on) {
    metro.on = on; store.set('fn-metro', on ? '1' : '0'); $('#metroBtn').setAttribute('aria-pressed', on);
    if (!on) { metroFlush(); return; }
    engine.init();
    if (engine.ctx.state === 'suspended') engine.ctx.resume().catch(() => {});
    if (!engine.playing) metroClick(engine.ctx.currentTime + 0.03, true);      // 没在放的时候点它，先响一声让人知道它开了
  }
  $('#metroBtn').addEventListener('click', () => setMetro(!metro.on));

  // ---- 应用新网格：标记不重算，按时间搬到新格子上（服务端做，页面上预览的就是这个结果）
  const gridBody = (s) => Object.assign({}, s.draft, { beats_per_bar: s.bpb, bar_at: s.barAt != null ? s.barAt : (s.draft.mode === 'manual' ? s.draft.anchor : null) });
  function lockEditing(on) { $('#note').disabled = on; $('#done').disabled = on; }
  async function applyGrid() {
    const s = st.song; if (!s || !s.draft || st.job) return;
    clearTimeout(gridTimer);
    if (!(await flushSave())) { st.gridErr = T('reNeedSave'); renderGrid(); toast(T('reNeedSave'), 6000); return; }
    if (st.song !== s || !s.draft || st.job) return;
    st.job = { state: 'running', seconds: 0, kind: 'regrid' }; lockEditing(true); renderGrid();
    let err = '', r = null;
    try {
      r = await api(`/api/regrid?c=${s.c}&id=${s.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grid: gridBody(s) }) });
      await reloadSong(s, null, true);
    } catch (e2) { err = T('regridFail', e2.message); }
    if (st.song && st.song.c === s.c && st.song.id === s.id) {
      st.job = null; lockEditing(false);
      st.gridErr = err; if (!err) st.gridSaved = new Date().toLocaleTimeString('en-GB');
      renderGrid(); st.dirty = true;
      if (err) toast(err, 8000); else if (r && r.done_kept === false) toast(T('regridUndone'), 8000);
      if (!err && st.pendingShift) { const d = st.pendingShift; st.pendingShift = 0; shiftStems(d); }      // 存的那一瞬间又挪的：现在接着挪
    }
  }
  async function flushGrid() {              // 网格有还没存的改动就马上存；返回 true 表示没有悬着的改动了
    clearTimeout(gridTimer);
    for (let i = 0; st.job && i < 600; i++) await new Promise((r) => setTimeout(r, 50));
    if (st.song && st.song.draft && !st.job) await applyGrid();
    return !(st.song && st.song.draft);
  }

  // ---- 重新识别这首歌：服务端在后台用提取器算（一般十几秒），这里隔一会儿问一次进度，算完把新结果换进来
  async function reextract() {
    const s = st.song; if (!s || st.job) return;
    if (st.preview) { toast(T('histBusy'), 4000); return; }
    engine.pause();
    if (!(await flushSave())) { toast(T('reNeedSave'), 6000); return; }
    if (st.song !== s || st.job) return;
    const body = { grid: s.draft ? gridBody(s) : null };
    st.job = { state: 'running', seconds: 0 }; lockEditing(true); renderGrid();
    try { await api(`/api/reextract?c=${s.c}&id=${s.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
    catch (err) { if (st.song === s) { st.job = null; lockEditing(false); renderGrid(); toast(T('reFail', err.message), 8000); } return; }
    watchJob(s);
  }
  async function watchJob(s) {
    let j = null, err = null;
    try {
      do {
        await new Promise((r) => setTimeout(r, 700));
        if (st.song !== s) return;
        j = await api(`/api/reextract?c=${s.c}&id=${s.id}`);
        if (st.song !== s) return;
        st.job = j; renderGrid();
      } while (j.state === 'running');
      if (j.state === 'done') await reloadSong(s, j.result); else err = j.error || j.state;
    } catch (e) { err = e.message; }
    if (st.song && st.song.c === s.c && st.song.id === s.id) { st.job = null; lockEditing(false); renderGrid(); if (err) toast(T('reFail', err), 9000); }
  }
  async function reloadSong(old, result, keepAlign) {            // 服务端的新结果换进来：画面位置、正在听的轨、已经读进来的声音都留着
    const data = await api(`/api/song?c=${old.c}&id=${old.id}`);
    if (st.song !== old) return;
    clearTimeout(saveTimer);
    const s = buildSong(old.c, old.id, data);
    s.peakRate = old.peakRate;
    s.rows.forEach((r) => { const o = old.rows.find((x) => x.name === r.name); if (o) r.peaks = o.peaks; });
    const solo = new Set();
    st.solo.forEach((i) => { const k = old.rows[i] ? s.rows.findIndex((r) => r.name === old.rows[i].name) : -1; if (k >= 0) solo.add(k); });
    s.gridRev = old.gridRev + 1;                 // 节拍器靠它知道网格换过了
    st.song = s; st.solo = solo; st.undo = []; st.redo = []; st.hover = null; st.stroke = null; st.scrub = false; st.flash = null; st.lastJump = -1;
    dropPreview();
    if (!keepAlign) st.align = null;             // 只是把刚存好的网格换进来：正拖着的那一下不打断
    st.save = 'idle'; st.saveErr = ''; st.saveCode = '';
    $('#note').value = s.note; $('#done').setAttribute('aria-pressed', s.done);
    st.view.keep = st.view.t0;
    renderSongTexts(true);
    if (result) toast(result.same_grid ? T('reSame', result.changed || 0) : result.carried ? T('reMoved', result.carried.cells) : T('reNew'), 8000);
    if (s.use === 'edits' && s.rebased) scheduleSave();
  }

  // ---- 指针
  function hit(e) {
    const s = st.song, rc = tl.getBoundingClientRect(), y = e.clientY - rc.top;
    let x = e.clientX - rc.left;
    if (st.stroke || st.scrub) x = clamp(x, 0, rc.width - 1);     // 拖动时指针滑出画布，也只作用到看得见的范围
    const raw = st.view.t0 + x / st.view.pps, t = clamp(raw, 0, s.duration - 1e-6);
    let zone = null, ri = -1;
    if (y < RULER + RIBBON) zone = 'ruler';
    else { ri = s.rows.findIndex((r) => y >= r.y - 4 && y < r.y + r.h + 4); if (ri >= 0) zone = 'lane'; }
    return { x, y, t, zone, ri, beat: beatAt(s, t), pre: raw < 0 };      // pre：指在歌开头之前（那里没有声音，也没有格子）
  }
  function showTip(h) {
    const tip = $('#tip'), s = st.song;
    if (!h || h.zone !== 'lane' || h.pre || st.stroke || st.scrub) { tip.hidden = true; return; }
    const r = s.rows[h.ri], b = h.beat;
    let html = `<b>${esc(stemName(r))}</b> <i>${esc(T('tipBeat', ...barBeat(s, b), b + 1, fmt1(s.edges[b]), fmt1(s.edges[b + 1])))}</i><br>`;
    const po = st.preview && st.preview.song === s ? st.preview.orig[h.ri] : null;
    if (r.cur && po) {                                     // 看历史版本：这一版是什么，现在是什么
      html += esc(T('tipVer', fnName(r.cur[b])));
      if (lv(r.cur[b]) !== lv(po[b])) html += ` <i>${esc(T('tipCur', fnName(po[b])))}</i>`;
    } else if (r.cur) {
      html += esc(T('tipNow', fnName(r.cur[b])));
      if (lv(r.cur[b]) !== lv(r.auto[b])) html += ` <i>${esc(T('tipWas', fnName(r.auto[b])))}</i>`;
      if (r.unstable[b]) html += `<br><i>${esc(T('tipUnsure'))}</i>`;
    } else html += `<i>${esc(T('tipUncls'))}</i>`;
    tip.innerHTML = html; tip.hidden = false;
    const tw = tip.offsetWidth, th = tip.offsetHeight, W = lanesEl.clientWidth, H = lanesEl.clientHeight;
    tip.style.left = clamp(HEADW + h.x + 16, HEADW + 4, Math.max(HEADW + 4, W - tw - 6)) + 'px';
    tip.style.top = clamp(h.y - th - 14 < RULER ? h.y + 18 : h.y - th - 14, 4, Math.max(4, H - th - 4)) + 'px';
  }
  tl.addEventListener('contextmenu', (e) => e.preventDefault());
  tl.addEventListener('pointerdown', (e) => {
    if (!st.song) return;
    const h = hit(e), s = st.song;
    if (e.button === 2) {                                // 右键：把这一格的功能吸成画笔
      if (h.zone === 'lane' && !h.pre && s.rows[h.ri].cur) setBrush(fn1(s.rows[h.ri].cur[h.beat]));
      return;
    }
    if (e.button !== 0 || st.stroke || st.scrub || st.align) return;
    if (st.mode === 'align' && h.zone) {                 // 对齐：按住左右拖，整首歌的声音相对网格挪动；只点一下不拖，就是移动播放线
      if (st.job && st.job.kind !== 'regrid') { toast(T('gridBusy'), 4000); return; }
      try { tl.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件没有指针可抓 */ }
      st.align = { x0: e.clientX, x: h.x, t0: st.view.t0, t: h.t, d: 0, moved: false };
      showTip(null); return;
    }
    const mode = e.altKey && st.mode !== 'point' && st.mode !== 'align' ? (st.mode === 'edit' ? 'listen' : 'edit') : st.mode;
    const row = h.zone === 'lane' && !h.pre ? s.rows[h.ri] : null;
    // 网格的改动正在保存、或者正在重新识别时，标记对不上格子，先不让改（网格马上存，存完就能改）
    if (row && mode === 'edit' && row.cur && (s.draft || st.job)) {
      toast(T(st.job && st.job.kind !== 'regrid' ? 'gridBusy' : 'gridPending'), 3000);
      if (s.draft && !st.job) applyGrid();
      return;
    }
    try { tl.setPointerCapture(e.pointerId); } catch (err) { /* 合成事件没有指针可抓 */ }
    if (row && mode === 'edit' && row.cur) {
      if (st.preview) { toast(T('histBusy'), 4000); return; }
      if ((st.add || e.shiftKey) && !s.canDual) { toast(T('addNeedsRestart'), 12000); return; }      // 服务还是旧的，存不下双重功能：这一笔不画
      st.stroke = { song: s, ri: h.ri, last: h.beat, before: new Map(), add: st.add || e.shiftKey };      // add：这一笔是“再加一个功能”
      paint(h.ri, h.beat, h.beat); showTip(null);
    } else if (row && mode === 'listen') {
      st.solo = new Set([h.ri]); applySolo();
      engine.seek(s.edges[h.beat]); engine.play();
    } else if (h.zone) {                                 // 刻度上，或“指针”模式：只移动播放线，可以拖着走
      st.scrub = true; st.detached = false; engine.seek(h.t); st.dirty = true; showTip(null);
    }
  });
  tl.addEventListener('pointermove', (e) => {
    if (!st.song) return;
    if (st.align) {                                      // 声音和它的时间刻度跟着手走；小节线、拍线、小节号留在屏幕上原来的地方
      const a = st.align, dx = e.clientX - a.x0;
      if (!a.moved && Math.abs(dx) < 3) return;
      a.moved = true; a.d = dx / st.view.pps; a.x = e.clientX - tl.getBoundingClientRect().left;
      st.view.t0 = a.t0 - a.d; st.dirty = true;
      return;
    }
    const h = hit(e);
    if (st.scrub) { engine.seek(h.t); st.dirty = true; return; }
    if (st.stroke) { paint(st.stroke.ri, st.stroke.last, h.beat); st.stroke.last = h.beat; st.hover = { ri: st.stroke.ri, beat: h.beat, x: h.x, y: h.y }; return; }
    st.hover = h.zone === 'lane' && !h.pre ? { ri: h.ri, beat: h.beat, x: h.x, y: h.y } : null;
    showTip(h); st.dirty = true;
  });
  const endPointer = () => {
    if (st.align) {
      const a = st.align; st.align = null;
      // 松手：把挪动定下来，标记这时才对到格子上，随后自动保存。正赶上上一次在保存：画面先退回去，存完再挪
      if (!a.moved) engine.seek(a.t); else if (st.job) { st.view.t0 = a.t0; shiftStems(a.d); } else shiftStems(a.d, true);
    }
    st.scrub = false; endStroke(); st.dirty = true;
  };
  tl.addEventListener('pointerup', endPointer);
  tl.addEventListener('pointercancel', endPointer);
  tl.addEventListener('lostpointercapture', endPointer);
  tl.addEventListener('pointerleave', () => { if (!st.stroke && !st.scrub && !st.align) { st.hover = null; showTip(null); st.dirty = true; } });
  window.addEventListener('blur', endPointer);
  // 按住 Shift = 临时打开“再加一个功能”（指针旁边会多一个加号）
  const shiftSeen = (e) => { const on = !!e.shiftKey; if (on !== st.addKey) { st.addKey = on; st.dirty = true; } };
  document.addEventListener('keydown', shiftSeen); document.addEventListener('keyup', shiftSeen); tl.addEventListener('pointermove', shiftSeen);
  window.addEventListener('blur', () => { if (st.addKey) { st.addKey = false; st.dirty = true; } });
  tl.addEventListener('wheel', (e) => {
    if (!st.song) return;
    e.preventDefault();
    if (st.align) return;                                // 拖着对齐的途中不滚、不缩放
    const rc = tl.getBoundingClientRect(), x = e.clientX - rc.left, unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? rc.width : 1;
    if (e.ctrlKey || e.metaKey) zoomTo(st.view.pps * Math.exp(-e.deltaY * unit * 0.0022), st.view.t0 + x / st.view.pps, x);
    else { st.view.t0 += (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) * unit / st.view.pps; clampView(); st.dirty = true; }
    st.hover = null; showTip(null);
    st.detached = true;            // 手动把画面挪开了：在播放线自己走进画面之前，“跟随”不把它拉回去
  }, { passive: false });

  function ringSeek(e, force) {
    const s = st.song; if (!s || !ringGeo) return false;
    const rc = ringCv.getBoundingClientRect(), dx = e.clientX - rc.left - rc.width / 2, dy = e.clientY - rc.top - rc.height / 2;
    const k = rc.width / (ringGeo.c * 2), rr = Math.hypot(dx, dy) / k;
    if (!force && (rr < ringGeo.r0 - 12 || rr > ringGeo.R + 16)) return false;
    let a = Math.atan2(dy, dx) + Math.PI / 2; if (a < 0) a += Math.PI * 2;
    const t = a / (Math.PI * 2) * s.duration;
    st.detached = false;
    engine.seek(t);
    st.view.t0 = t - viewW() / st.view.pps * 0.3; clampView(); st.dirty = true;
    return true;
  }
  let ringDrag = false;
  ringCv.addEventListener('pointerdown', (e) => { if (e.button === 0 && ringSeek(e, false)) { ringDrag = true; try { ringCv.setPointerCapture(e.pointerId); } catch (err) { /* 同上 */ } } });
  ringCv.addEventListener('pointermove', (e) => { if (ringDrag) ringSeek(e, true); });
  for (const ev of ['pointerup', 'pointercancel', 'lostpointercapture']) ringCv.addEventListener(ev, () => { ringDrag = false; });

  // ---- 历史版本（2026-10-16）：这首歌以前的规则版本、他点过“看完了”的版本。可以只看一看（时间线上临时换成那一版，不能改），也可以回退。
  // 回退由服务端做：先把现在的自动结果和修改照 fn_swap.py 的命名备份，再换上去；之后列表里有“撤销上一次回退”。
  // 看一看的时候 st.preview.orig 收着现在的标记：保存（包括关页面时的补发）一律用它，不用画在屏幕上的那一版。
  const hist = { data: null, keep: true };
  const histItemOf = (id) => (hist.data ? [...hist.data.rules, ...hist.data.dones].find((x) => x.id === id) : null);
  const histTitle = (it) => (it.kind === 'done' ? T('histDoneAt', it.at) : T('histRule', it.rule) + ' · ' + T('histKind')[it.kind]);
  async function openHistory() {
    const s = st.song; if (!s || s.view === 'bar') return;
    if (st.job || s.draft) { toast(T(st.job && st.job.kind !== 'regrid' ? 'gridBusy' : 'gridPending'), 4000); return; }
    $('#histWrap').hidden = false; $('#histTitle').textContent = T('histHead') + ' · ' + s.title;
    $('#histBody').innerHTML = `<p class="sub dim">${esc(T('histLoading'))}</p>`;
    let d;
    try { d = await api(`/api/history?c=${s.c}&id=${s.id}`); }
    catch (err) { if (st.song === s) $('#histBody').innerHTML = `<p class="sub">${esc(T('histFail', err.message))}</p>`; return; }
    if (st.song !== s) return;
    hist.data = d; renderHistory();
  }
  function closeHistory() { $('#histWrap').hidden = true; }
  function renderHistory() {
    const d = hist.data, s = st.song; if (!d || !s) return;
    $('#histTitle').textContent = T('histHead') + ' · ' + s.title;
    const keep = d.has_edits && hist.keep, pv = st.preview ? st.preview.v : '';
    const item = (it) => {
      const diff = it.kind !== 'done' && keep ? it.diff_keep : it.diff;
      const sub = it.kind === 'done' ? [it.n_changed != null ? T('histDoneN', it.n_changed) : '', T('histDiff', diff)] : [it.at ? T('histAt', it.kind, it.at) : '', T('histDiff', diff)];
      return `<div class="histItem${diff ? '' : ' cur'}"><div><b>${esc(it.kind === 'done' ? T('histDoneAt', it.at) : T('histRule', it.rule))}</b>`
        + (it.kind !== 'done' ? ` <span class="pill">${esc(T('histKind')[it.kind])}</span>` : '')
        + `<p class="sub">${esc(sub.filter(Boolean).join(' · '))}${diff ? '' : ' · ' + esc(T('histNowTag'))}</p></div>`
        + `<div class="acts">${diff ? `<button class="chip" data-hv="${esc(it.id)}" aria-pressed="${pv === it.id}">${esc(T('histView'))}</button><button class="chip go" data-hr="${esc(it.id)}">${esc(T('histRestore'))}</button>` : ''}</div></div>`;
    };
    $('#histBody').innerHTML =
      (d.undo ? `<div class="histItem"><div><b>${esc(T('histUndo'))}</b><p class="sub">${esc(T('histUndoNote', d.undo.what, d.undo.at, d.undo.act))}</p></div><div class="acts"><button class="chip go" data-hr="undo">${esc(T('histUndo'))}</button></div></div>` : '')
      + (d.has_edits ? `<label class="histKeep"><input type="checkbox" id="histKeep"${hist.keep ? ' checked' : ''}><span>${esc(T('histKeep', d.n_edits))}</span></label>` : '')
      + `<div><h5>${esc(T('histRules'))}</h5>${d.rules.map(item).join('')}</div>`
      + `<div><h5>${esc(T('histDones'))}</h5>${d.dones.length ? d.dones.map(item).join('') : `<p class="sub dim">${esc(T('histNoDone'))}</p>`}</div>`;
  }
  async function previewVersion(id) {
    const s = st.song, d = hist.data, it = histItemOf(id); if (!s || !d || !it) return;
    if (st.job || s.draft) { toast(T(st.job && st.job.kind !== 'regrid' ? 'gridBusy' : 'gridPending'), 4000); return; }
    const keep = it.kind !== 'done' && d.has_edits && hist.keep;
    let r;
    try { r = await api(`/api/history/version?c=${s.c}&id=${s.id}&v=${encodeURIComponent(id)}&keep=${keep ? 1 : 0}`); }
    catch (err) { toast(T('histFail', err.message), 6000); return; }
    if (st.song !== s) return;
    if (st.stroke) endStroke();
    if (!st.preview) st.preview = { song: s, orig: s.rows.map((row) => (row.cur ? Int8Array.from(row.cur) : null)) };
    Object.assign(st.preview, { v: id, it, keep, diff: keep ? it.diff_keep : it.diff });
    s.rows.forEach((row) => { if (row.cur && Array.isArray(r.labels[row.name]) && r.labels[row.name].length === s.n) row.cur = Int8Array.from(r.labels[row.name]); });
    if (st.mode === 'edit' || st.mode === 'align') setMode('point');
    lockEditing(true); closeHistory(); showPreviewBar(); refreshDerived(); showTip(null);
  }
  function showPreviewBar() {
    const p = st.preview; if (!p) { $('#histBar').hidden = true; return; }
    $('#histBarText').innerHTML = `<b>${esc(T('histPreview', histTitle(p.it)))}</b> ${esc(p.it.kind === 'done' ? '' : p.keep ? T('histPreviewKeep') : T('histPreviewPure'))} · ${esc(T('histDiff', p.diff))}`;
    $('#histBar').hidden = false;
  }
  function endPreview() {
    const p = st.preview; st.preview = null; $('#histBar').hidden = true;
    if (!p || p.song !== st.song) return;
    p.song.rows.forEach((row, i) => { if (p.orig[i]) row.cur = p.orig[i]; });
    lockEditing(!!st.job); refreshDerived(); showTip(null);
  }
  function dropPreview() { st.preview = null; $('#histBar').hidden = true; closeHistory(); }      // 换歌、重新载入时：屏幕上的整个换掉，不用还原
  async function restoreVersion(id) {
    const s = st.song, d = hist.data; if (!s || !d) return;
    const it = id === 'undo' ? null : histItemOf(id);
    if (id !== 'undo' && !it) return;
    const keep = !!(it && it.kind !== 'done' && d.has_edits && hist.keep);
    let msg = id === 'undo' ? T('histUndoAsk') : T('histConfirm', histTitle(it));
    if (it && it.kind !== 'done' && d.has_edits && !hist.keep) msg += T('histConfirmDrop', d.n_edits);
    if (!window.confirm(msg)) return;
    if (st.preview) endPreview();
    if (!(await flushSave())) { toast(T('reNeedSave'), 6000); return; }
    if (st.song !== s || st.job) return;
    let r;
    try { r = await api(`/api/history/restore?c=${s.c}&id=${s.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ v: id, keep }) }); }
    catch (err) { toast(T('histRestoreFail', err.message), 8000); return; }
    closeHistory(); hist.data = null;
    if (st.song !== s) return;
    await reloadSong(s, null);
    toast(id === 'undo' ? T('histUndone') : T('histDone', r.what), 7000);
  }
  $('#histBtn').addEventListener('click', openHistory);
  $('#histClose').addEventListener('click', closeHistory);
  $('#histWrap').addEventListener('click', (e) => {
    if (e.target.id === 'histWrap') { closeHistory(); return; }
    const v = e.target.closest('[data-hv]'); if (v) { previewVersion(v.dataset.hv); return; }
    const r = e.target.closest('[data-hr]'); if (r) restoreVersion(r.dataset.hr);
  });
  $('#histWrap').addEventListener('change', (e) => {
    if (e.target.id !== 'histKeep') return;
    hist.keep = e.target.checked;
    if (st.preview && st.preview.it.kind !== 'done') endPreview();      // 正在看的那一版跟着这个勾变了：先收起来，免得看到的和回退的不一样
    renderHistory();
  });
  $('#histBarBack').addEventListener('click', () => endPreview());
  $('#histBarRestore').addEventListener('click', () => { if (st.preview) restoreVersion(st.preview.v); });

  // ---- 按钮与键盘
  function reveal(t) {            // 把某个时间点带进画面；画面一动，指针下面的提示就过期了，收掉
    const W = viewW(), x = X(t);
    if (x < 0 || x > W * 0.86) { st.view.t0 = t - W * 0.3 / st.view.pps; clampView(); }
    st.hover = null; showTip(null); st.detached = false; st.dirty = true;
  }
  function jumpUnstable(dir) {
    const s = st.song; if (!st.uStarts.length) return;
    const b = beatAt(s, Math.min(engine.pos(), s.duration - 1e-6));
    // 播放线正好停在某一处存疑的开头、而这一处还没被跳到过（比如歌一开头就存疑），就先跳这一处
    const target = dir > 0 ? st.uStarts.find((u) => u > b || (u === b && st.lastJump !== u)) : [...st.uStarts].reverse().find((u) => u < b);
    if (target === undefined) { toast(dir > 0 ? T('noMoreNext') : T('noMorePrev'), 1800); return; }
    let end = target; while (end < s.n && s.rows.some((r) => r.unstable && r.unstable[end])) end++;
    st.lastJump = target; st.detached = false;
    engine.seek(s.edges[target]);
    st.view.t0 = s.edges[target] - viewW() / st.view.pps * 0.3; clampView();
    st.hover = null; showTip(null);
    st.flash = { a: target, b: end, until: performance.now() + 900 }; st.dirty = true;
  }
  function setLang(l) {
    if (l === LANG) return;
    LANG = l; store.set('fn-lang', l);
    applyStatic(); renderLegend(); output.label();
    if (st.song) { renderSongTexts(); showPreviewBar(); if (!$('#histWrap').hidden) renderHistory(); } else { document.title = T('docTitle'); if (home.lib) { const col = renderHome(); if (col) col.songs.forEach((s) => paintHomeRing(col.id, s.id)); } }
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('.lang button'); if (b) setLang(b.dataset.lang); });
  function setLevel(n) {            // 换一级 / 二级：只重画，不动任何标注
    if (n === LEVEL) return;
    if (st.stroke) endStroke();
    LEVEL = n; store.set('fn-level', String(n));
    st.brush = lv(st.brush);
    applyStatic(); renderLegend();
    if (st.song) { renderBrushes(); refreshDerived(); st.hover = null; showTip(null); st.dirty = true; st.ringDirty = true; }
    home.songs.forEach((song, key) => { const i = key.indexOf('/'); paintHomeRing(key.slice(0, i), key.slice(i + 1)); });
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('.lvl button'); if (b) setLevel(+b.dataset.level); });
  // 按拍 / 按小节：存好手上的修改，再把这首歌按另一种格子重新打开
  function paintView() { $$('.vsw button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === VIEW)); }
  async function setView(v) {
    if (v === VIEW) return;
    const s = st.song;
    if (s && !(await flushSave()) && !window.confirm(T('leaveUnsaved'))) return;
    VIEW = v; store.set('fn-view', v); paintView();
    if (s) { engine.stop && engine.stop(); st.song = null; await openSong(s.c, s.id); }
  }
  document.addEventListener('click', (e) => { const b = e.target.closest('.vsw button'); if (b) setView(b.dataset.view); });
  paintView();
  $('#back').addEventListener('click', () => { location.hash = '#/' + (st.song ? st.song.c : ''); });
  $('#play').addEventListener('click', (e) => engine.toggle(e.shiftKey));
  $('#retBtn').addEventListener('click', (e) => { st.ret = !st.ret; store.set('fn-return', st.ret ? '1' : '0'); e.currentTarget.setAttribute('aria-pressed', st.ret); st.dirty = true; });
  $('#modePoint').addEventListener('click', () => setMode('point'));
  $('#modeEdit').addEventListener('click', () => setMode('edit'));
  $('#modeListen').addEventListener('click', () => setMode('listen'));
  $('#modeAlign').addEventListener('click', () => setMode('align'));
  $('#clearSolo').addEventListener('click', () => { st.solo = new Set(); applySolo(); });
  $('#prevU').addEventListener('click', () => jumpUnstable(-1));
  $('#nextU').addEventListener('click', () => jumpUnstable(1));
  $('#showU').addEventListener('click', (e) => { st.showU = !st.showU; e.currentTarget.setAttribute('aria-pressed', st.showU); st.dirty = true; });
  $('#showW').addEventListener('click', (e) => { st.showW = !st.showW; e.currentTarget.setAttribute('aria-pressed', st.showW); st.dirty = true; });
  $('#undo').addEventListener('click', () => undoRedo(st.undo, st.redo, 'before'));
  $('#redo').addEventListener('click', () => undoRedo(st.redo, st.undo, 'after'));
  $('#follow').addEventListener('click', (e) => { st.follow = !st.follow; e.currentTarget.setAttribute('aria-pressed', st.follow); });
  $('#fit').addEventListener('click', () => zoomTo(st.fitPps, viewMin(st.song), 0));
  $('#zoom').addEventListener('input', (e) => {
    const W = viewW(), mid = st.view.t0 + W / 2 / st.view.pps, top = Math.max(MAXPPS, st.fitPps * 1.0001);
    zoomTo(st.fitPps * Math.pow(top / st.fitPps, +e.target.value / 1000), mid, W / 2);
    st.detached = true;
  });
  $('#heads').addEventListener('click', (e) => {
    const b = e.target.closest('[data-solo]'); if (!b || !st.song) return;
    const i = +b.dataset.solo; if (st.solo.has(i)) st.solo.delete(i); else st.solo.add(i);
    applySolo();
  });
  $('#brushes').addEventListener('click', (e) => { const b = e.target.closest('.brush'); if (b && b.id === 'addFn') setAdd(!st.add); else if (b) setBrush(+b.dataset.v); });
  $('#note').addEventListener('input', (e) => { if (st.song) { st.song.note = e.target.value; scheduleSave(); } });
  $('#done').addEventListener('click', (e) => { const s = st.song; if (!s) return; s.done = !s.done; e.currentTarget.setAttribute('aria-pressed', s.done); scheduleSave(); });
  $('#saveState').addEventListener('click', retrySave);
  $('#zoom').addEventListener('change', (e) => e.target.blur());     // 拖完滑块把焦点还回去，快捷键才继续有效

  window.addEventListener('keydown', (e) => {
    const tag = e.target.tagName;
    // 在备注框里打字时不抢键；缩放滑块不算打字，焦点在它上面时快捷键照常有效
    if (!st.song || tag === 'TEXTAREA' || (tag === 'INPUT' && e.target.type !== 'range') || tag === 'SELECT' || e.isComposing) return;
    const s = st.song, k = e.key.toLowerCase(), mod = e.ctrlKey || e.metaKey;
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) undoRedo(st.redo, st.undo, 'after'); else undoRedo(st.undo, st.redo, 'before'); return; }
    if (mod && k === 'y') { e.preventDefault(); undoRedo(st.redo, st.undo, 'after'); return; }
    if (mod || e.altKey) return;
    if (e.key === ' ') { e.preventDefault(); if (tag === 'BUTTON') e.target.blur(); engine.toggle(e.shiftKey); }
    else if (k >= '1' && k <= String(FN.length)) setBrush(+k - 1);
    else if (e.shiftKey && /^Digit[1-6]$/.test(e.code)) setBrush(+e.code.slice(5) - 1);      // 按着 Shift 换画笔（这时数字键打出来的是符号）
    else if (k === 'r') setBrush(-1);
    else if (k === 'd') setAdd(!st.add);
    else if (k === 'v') setMode('point');
    else if (k === 'e') setMode('edit');
    else if (k === 'l') setMode('listen');
    else if (k === 'g') setMode('align');
    else if (k === 'm' && !(st.song && st.song.view === 'bar')) setMetro(!metro.on);
    else if (k === 'f') $('#follow').click();
    else if (k === '[') jumpUnstable(-1);
    else if (k === ']') jumpUnstable(1);
    else if (k === 'escape') { if (!$('#histWrap').hidden) closeHistory(); else if (!$('#gridMenu').hidden) gridUi.close(); else if (!$('#outMenu').hidden) output.close(); else if (st.solo.size) { st.solo = new Set(); applySolo(); } else setMode('point'); }
    else if (k === 'arrowleft' || k === 'arrowright') {
      e.preventDefault();
      if (st.mode === 'align') {                         // 对齐：方向键把整首歌的声音挪 5 毫秒（按住 Shift 是 20 毫秒）
        shiftStems((k === 'arrowright' ? 1 : -1) * (e.shiftKey ? 0.02 : 0.005));
        return;
      }
      const b = beatAt(s, Math.min(engine.pos(), s.duration - 1e-6)), step = (e.shiftKey ? s.bpb : 1) * (k === 'arrowleft' ? -1 : 1);      // 按住 Shift 一次走一小节
      const t = s.edges[clamp(b + step, 0, s.n - 1)];
      engine.seek(t); reveal(t);
    } else if (k === 'home') { e.preventDefault(); engine.seek(0); st.view.t0 = viewHome(s); clampView(); st.hover = null; showTip(null); st.dirty = true; }
  });

  // ---- 每一帧
  function tick() {
    requestAnimationFrame(tick);
    const s = st.song; if (!s) return;
    const lvl = engine.sample(), pos = engine.pos();
    if (Math.abs(lvl - st.lvlCss) > 0.015) { st.lvlCss = lvl; document.documentElement.style.setProperty('--lvl', lvl.toFixed(3)); }
    if (engine.playing && engine.started && pos >= s.duration - 0.03) { engine.pause(); engine.offset = st.ret ? engine.origin : s.duration; }
    // 播放、暂停、读入这些状态一变就重画一次，按钮图标和“读入中”才不会停在旧样子
    if (engine.playing !== st.wasPlaying || engine.loading !== st.wasLoading) {
      if (engine.playing && !st.wasPlaying) st.detached = false;      // 按下播放：画面回到播放线
      st.wasPlaying = engine.playing; st.wasLoading = engine.loading; st.dirty = true;
    }
    if (engine.playing && st.follow && !st.stroke && !st.scrub && !st.align) {
      const W = viewW(), px = X(pos);
      if (st.detached) { if (px >= 0 && px <= W) st.detached = false; }
      else if (px > W * 0.86 || px < 0) { st.view.t0 = pos - W * 0.14 / st.view.pps; clampView(); st.hover = null; showTip(null); }
    }
    if (engine.playing || engine.loading || st.dirty || lvl > 0.004) {
      st.dirty = false;
      drawTimeline(); drawRing(); updateReadouts();
    }
  }

  // ---- 路由：#/<素材> 是首页，#/<素材>/<歌> 是编辑页
  async function route() {
    const m = /^#\/([a-z]+)(?:\/([A-Za-z0-9_\-]+))?/.exec(location.hash);
    if (m && m[2]) { await openSong(m[1], m[2]); return; }
    openToken++;
    const from = st.song ? { tab: st.song.c, id: st.song.id } : null;      // 刚才在看的那首：回到曲目表时回到它那一行
    if (st.song && !(await leaveEditor())) { stayHere(); return; }
    document.title = T('docTitle');
    swap('home');
    if (from) { $('#songs').classList.add('still'); restoreRow(from, false); }      // 先用还留着的旧列表放回原位，免得先跳到顶再跳下来
    showHome(m ? m[1] : null, from);
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('resize', () => { if (st.song) layout(); });
  if (window.ResizeObserver) new ResizeObserver(() => { if (st.song) layout(); }).observe(lanesEl);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { st.dirty = true; });
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) navigator.mediaDevices.addEventListener('devicechange', () => { output.check(); });

  if (/[?&]debug=1/.test(location.search)) window.fnDebug = { st, engine, metro, lineTime: (j) => lineTime(st.song, j) };      // 只在地址里带 debug=1 时露出来，测试用
  applyStatic();
  renderLegend();
  output.label();
  route();
  requestAnimationFrame(tick);
})();
