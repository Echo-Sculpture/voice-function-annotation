// 奏 / 不奏训练（闸门二）结果页。数据：/api/gate2/index、/api/gate2/track?id=，音频：/g2audio/<文件名>.mp3（make_gate2.py 整理）。
'use strict';
const $ = (s, el = document) => el.querySelector(s);
const pct = (x) => (x == null ? '—' : `${Math.round(x * 1000) / 10}%`);
const fmt = (t) => { t = Math.max(0, t || 0); const m = Math.floor(t / 60); const s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
const fmt0 = (t) => { const m = Math.floor(t / 60); const s = Math.round(t - m * 60); return `${m}:${s < 10 ? '0' : ''}${s}`; };
const LANE_H = 62;
const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

const S = { idx: null, tr: null, rows: [], active: 'fin_true', mode: 'solo', zoom: 1, raf: 0, nTracks: 0 };
const audio = $('#audio');

async function getJSON(u) {
  const r = await fetch(u, { cache: 'no-store' });
  if (!r.ok) throw new Error(`${u}：${r.status}`);
  return r.json();
}

// ---------------------------------------------------------------- 总数和选轨
function renderTop() {
  const idx = S.idx;
  S.nTracks = idx.songs.reduce((a, s) => a + s.tracks.length, 0);
  $('#built').textContent = idx.built_at ? `整理于 ${idx.built_at}` : '';
  const cards = $('#cards');
  cards.innerHTML = '';
  for (const v of idx.versions) {
    const sm = idx.summary[v.id] || {};
    const full = sm.n_tracks === S.nTracks;
    const c = document.createElement('div');
    c.className = 'card' + (sm.n_tracks ? '' : ' miss');
    c.innerHTML = `<div class="grp">${v.group}</div><div class="how">${v.how}</div>` +
      (sm.n_tracks ? `<div class="nums"><div class="n"><span>叫它停的地方</span><b>${pct(sm.told_stop_obeyed)}</b><span>停了</span></div>` +
        `<div class="n"><span>叫它奏的地方</span><b>${pct(sm.told_play_obeyed)}</b><span>奏了</span></div></div>` :
        `<div class="nums"><div class="n"><b>补跑中</b><span>跑完刷新这一页</span></div></div>`) +
      `<div class="note">${v.note}${sm.n_tracks && !full ? `<br>（目前只出了 ${sm.n_tracks} / ${S.nTracks} 条，补跑中）` : ''}</div>`;
    cards.appendChild(c);
  }
  $('#caveat').textContent = '注意：第一轮只用 4 首训练歌、照 ACE-Step 官方默认的训练方式训了 300 次；最终模型用了 201 首训练歌、' +
    '修好的训练方式（一半样本按生成时的噪声比例练、15% 的时间不给标记）训了 4 遍。所以两者不只是训练方式不同，训练用的歌也多得多。' +
    '"原模型"没有标记，表里按原曲的奏 / 停对照（叫它停 = 原曲停的拍）。';
  const pk = $('#picker');
  pk.innerHTML = '';
  for (const s of idx.songs) {
    const row = document.createElement('div');
    row.className = 'psong';
    const m = s.name.match(/^(.*?)（(.*)）$/);
    row.innerHTML = `<div class="nm">${m ? m[1] : s.name}<small>${m ? m[2] : ''} · ${fmt0(s.seconds)}</small></div><div class="chips"></div>`;
    const chips = $('.chips', row);
    for (const t of s.tracks) {
      const b = document.createElement('button');
      b.className = 'chip';
      b.dataset.id = t.id;
      b.setAttribute('aria-pressed', 'false');
      const a = t.rows.base?.told_stop_obeyed, f = t.rows.fin_true?.told_stop_obeyed;
      b.innerHTML = `${t.name}<small>停 ${pct(a)} → ${pct(f)}</small>`;
      b.title = `叫它停的拍里停了多少：原模型 ${pct(a)}，最终模型（按原样给）${pct(f)}；原曲停的拍占 ${pct(t.orig_stop_frac)}`;
      b.addEventListener('click', () => openTrack(t.id, true));
      chips.appendChild(b);
    }
    pk.appendChild(row);
  }
  $('#foot').innerHTML = `每拍"奏 / 停"用标注器同一套规则判：一拍的平均能量低于 max(${idx.rule.abs_db} dB，这条轨自己的响度水平 ${idx.rule.rel_self_db} dB，` +
    `整首歌的响度水平 ${idx.rule.rel_mix_db} dB) 就算停（响度水平 = 各拍分贝的第 95 百分位）。每条只用第 1 个种子（${idx.seed}）。` +
    `"放进歌里"时生成的这一条按"只降不升"对齐到原轨的响度（和重生成结果页同一个做法）；同一条轨的各版本乘同一个系数，彼此音量可比。` +
    `演示版：音频压成了 Opus 64 kbps，音质比本机版差一些。`;
}

// ---------------------------------------------------------------- 一条轨
async function openTrack(id, scroll) {
  document.querySelectorAll('.chip').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.id === id)));
  let tr;
  try { tr = await getJSON(`data/gate2/tracks/${encodeURIComponent(id)}.json`); } catch (e) { return showErr(e); }
  S.tr = tr;
  history.replaceState(null, '', `#${id}`);
  const orig = tr.orig.voiced;
  const flip = orig.map((v) => 1 - v);
  S.rows = [{ id: 'orig', group: '原曲', how: '真实录音（参照）', instr: null, ready: true, voiced: orig, db: tr.orig.db, thr_db: tr.orig.thr_db, band: orig }];
  for (const v of S.idx.versions) {
    const r = tr.rows[v.id] || { ready: false };
    const instr = v.instr === 'flip' ? flip : orig;
    S.rows.push(Object.assign({ id: v.id, group: v.group, how: v.how, instr, band: instr, kind: v.instr }, r));
  }
  if (!S.rows.find((r) => r.id === S.active && r.ready)) S.active = 'fin_true';
  $('#ptitle').innerHTML = `${tr.song_name.replace(/（.*$/, '')} · ${tr.name}<small>原曲停的拍占 ${pct(tr.orig.stop_frac)} · ${fmt0(tr.seconds)}</small>`;
  $('#pcap').textContent = `给模型的乐器描述："${tr.caption}"`;
  $('#player').hidden = false;          // 先显示再排：隐藏时量不出宽度
  buildLanes();
  setSource(S.active, 0, false);
  if (scroll) $('#player').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildLanes() {
  const L = $('#lanes');
  L.innerHTML = '';
  const sp = document.createElement('div');
  sp.className = 'spacer';
  sp.style.gridColumn = '1';
  L.appendChild(sp);
  S.rows.forEach((r, i) => {
    const d = document.createElement('div');
    d.className = 'lbl' + (r.ready ? '' : ' miss') + (r.id === S.active ? ' on' : '');
    d.style.gridColumn = '1';
    d.style.height = `${LANE_H}px`;
    d.dataset.id = r.id;
    let rate;
    if (r.id === 'orig') rate = `停的拍占 <b>${pct(S.tr.orig.stop_frac)}</b>`;
    else if (!r.ready) rate = '还没跑完（补跑中）';
    else rate = `停 <b>${pct(r.told_stop_obeyed)}</b> · 奏 <b>${pct(r.told_play_obeyed)}</b>`;
    d.title = r.ready && r.id !== 'orig' ? `叫它停的拍里停了 ${pct(r.told_stop_obeyed)}；叫它奏的拍里奏了 ${pct(r.told_play_obeyed)}` : '';
    const h = r.id === 'base' ? '没训练（按原曲对照）' : r.how;
    d.innerHTML = `<span class="g"><kbd>${i + 1}</kbd>${r.group}</span><span class="h">${h}</span><span class="r">${rate}</span>`;
    d.addEventListener('click', () => { if (r.ready) setSource(r.id, audio.currentTime, !audio.paused); });
    L.appendChild(d);
  });
  const sc = document.createElement('div');
  sc.className = 'scroller';
  sc.style.gridRow = `1 / span ${S.rows.length + 1}`;
  L.style.gridTemplateRows = `22px repeat(${S.rows.length}, ${LANE_H}px)`;   // 行高写死：放大后出现横向滚动条也不会把左右两边错开
  const inner = document.createElement('div');
  inner.className = 'inner';
  inner.innerHTML = '<div class="ruler"></div>';
  S.rows.forEach((r) => {
    if (!r.ready) {
      const m = document.createElement('div');
      m.className = 'lane-miss';
      m.textContent = '还没跑完，补跑结束后重新整理数据、刷新这一页就会出现';
      inner.appendChild(m);
      return;
    }
    const c = document.createElement('canvas');
    c.className = 'lane';
    c.dataset.id = r.id;
    c.addEventListener('click', (ev) => {
      const t = (ev.offsetX / c.clientWidth) * S.tr.seconds;
      setSource(r.id, t, true);
    });
    inner.appendChild(c);
  });
  const ph = document.createElement('div');
  ph.className = 'ph';
  ph.id = 'ph';
  inner.appendChild(ph);
  sc.appendChild(inner);
  L.appendChild(sc);
  layout();
}

function layout() {
  const sc = $('.scroller');
  if (!sc || !S.tr) return;
  const inner = $('.inner', sc);
  const W = Math.max(200, sc.clientWidth * S.zoom);
  inner.style.width = `${W}px`;
  const ru = $('.ruler', inner);
  ru.innerHTML = '';
  const dur = S.tr.seconds;
  const pxPerSec = W / dur;
  const step = [1, 2, 5, 10, 15, 30, 60].find((s) => s * pxPerSec >= 70) || 60;
  for (let t = 0; t <= dur; t += step) {
    const x = t * pxPerSec;
    ru.insertAdjacentHTML('beforeend', `<i style="left:${x}px"></i><span style="left:${Math.max(14, Math.min(W - 14, x))}px">${fmt0(t)}</span>`);
  }
  inner.querySelectorAll('canvas.lane').forEach((c) => drawLane(c, S.rows.find((r) => r.id === c.dataset.id)));
  movePH();
}

let PAT = null;
function patterns(ctx, dpr) {
  const mk = (color, back, dir) => {
    const n = Math.round(6 * dpr);
    const p = document.createElement('canvas');
    p.width = p.height = n;
    const g = p.getContext('2d');
    g.fillStyle = back; g.fillRect(0, 0, n, n);
    g.strokeStyle = color; g.lineWidth = 1.6 * dpr;
    g.beginPath();
    if (dir > 0) { g.moveTo(0, n); g.lineTo(n, 0); g.moveTo(-n / 2, n / 2); g.lineTo(n / 2, -n / 2); g.moveTo(n / 2, n * 1.5); g.lineTo(n * 1.5, n / 2); }
    else { g.moveTo(0, 0); g.lineTo(n, n); g.moveTo(-n / 2, n / 2); g.lineTo(n / 2, n * 1.5); g.moveTo(n / 2, -n / 2); g.lineTo(n * 1.5, n / 2); }
    g.stroke();
    return ctx.createPattern(p, 'repeat');
  };
  return { bad: mk(css('--dbl'), 'rgba(194,31,85,.30)', 1), miss: mk(css('--ctr'), 'rgba(1,162,197,.10)', -1) };
}

function drawLane(c, r) {
  const dpr = window.devicePixelRatio || 1;
  const W = c.clientWidth, H = LANE_H;
  c.width = Math.round(W * dpr);
  c.height = Math.round(H * dpr);
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  PAT = patterns(g, dpr);
  const tr = S.tr, E = tr.edges, dur = tr.seconds;
  const top = tr.mix_ref_db + 6, floor = tr.mix_ref_db - 54;
  const yOf = (db) => H - 4 - Math.max(0, Math.min(1, (db - floor) / (top - floor))) * (H - 10);
  g.strokeStyle = css('--line');
  g.beginPath(); g.moveTo(0, 0.5); g.lineTo(W, 0.5); g.stroke();
  for (let i = 0; i < r.voiced.length; i++) {
    const x0 = (E[i] / dur) * W, x1 = (E[i + 1] / dur) * W;
    const w = Math.max(1, x1 - x0);
    const stopTold = r.band && r.band[i] === 0;
    if (stopTold) { g.fillStyle = 'rgba(243,239,232,.075)'; g.fillRect(x0, 1, w, H - 1); }
    const y = yOf(r.db[i]);
    const bw = w > 3 ? w - 1 : w;
    if (r.id === 'orig') {
      g.fillStyle = r.voiced[i] ? 'rgba(243,239,232,.78)' : 'rgba(243,239,232,.22)';
      g.fillRect(x0, y, bw, H - 4 - y);
      continue;
    }
    const on = r.voiced[i] === 1;
    if (stopTold && on) {                     // 叫它停，它还在响
      g.fillStyle = PAT.bad; g.fillRect(x0, Math.min(y, H - 14), bw, H - 4 - Math.min(y, H - 14));
    } else if (!stopTold && !on) {            // 叫它奏，它没声
      g.fillStyle = PAT.miss; g.fillRect(x0, 8, bw, H - 12);
      g.fillStyle = 'rgba(243,239,232,.30)'; g.fillRect(x0, y, bw, H - 4 - y);
    } else {
      g.fillStyle = on ? 'rgba(243,239,232,.62)' : 'rgba(243,239,232,.22)';
      g.fillRect(x0, y, bw, H - 4 - y);
    }
  }
  const yt = yOf(r.thr_db);                   // "停"的门槛
  g.strokeStyle = 'rgba(243,239,232,.55)';
  g.setLineDash([4, 4]);
  g.beginPath(); g.moveTo(0, yt + 0.5); g.lineTo(W, yt + 0.5); g.stroke();
  g.setLineDash([]);
}

// ---------------------------------------------------------------- 播放
function setSource(id, t, play) {
  const r = S.rows.find((x) => x.id === id);
  if (!r || !r.ready || !S.tr.audio[id]) return;
  S.active = id;
  document.querySelectorAll('.lbl').forEach((d) => d.classList.toggle('on', d.dataset.id === id));
  const src = 'g2audio/' + S.tr.audio[id][S.mode].replace(/\.mp3$/, '.ogg');
  const wasPlaying = play;
  if (audio.dataset.src === src) {
    audio.currentTime = t;
    if (wasPlaying) audio.play();
    return;
  }
  audio.dataset.src = src;
  audio.src = src;
  audio.addEventListener('loadedmetadata', function once() {
    audio.removeEventListener('loadedmetadata', once);
    audio.currentTime = Math.min(t, (audio.duration || t + 1) - 0.05);
    if (wasPlaying) audio.play();
    movePH();
  });
}

function movePH() {
  const ph = $('#ph'), sc = $('.scroller');
  if (!ph || !S.tr) return;
  const inner = $('.inner', sc);
  const x = (audio.currentTime / S.tr.seconds) * inner.clientWidth;
  ph.style.left = `${x - 1}px`;
  $('#clock').textContent = `${fmt(audio.currentTime)} / ${fmt0(S.tr.seconds)}`;
  if (S.zoom > 1 && !audio.paused) {
    if (x < sc.scrollLeft + 40 || x > sc.scrollLeft + sc.clientWidth - 60) sc.scrollLeft = Math.max(0, x - sc.clientWidth * 0.25);
  }
}

function tick() { movePH(); S.raf = audio.paused ? 0 : requestAnimationFrame(tick); }
audio.addEventListener('play', () => { $('#play').textContent = '暂停'; if (!S.raf) S.raf = requestAnimationFrame(tick); });
audio.addEventListener('pause', () => { $('#play').textContent = '播放'; movePH(); });
audio.addEventListener('timeupdate', () => { if (audio.paused) movePH(); });
$('#play').addEventListener('click', () => (audio.paused ? audio.play() : audio.pause()));

$('#mode').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  S.mode = b.dataset.m;
  $('#mode').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  setSource(S.active, audio.currentTime, !audio.paused);
});
$('#zoom').addEventListener('click', (ev) => {
  const b = ev.target.closest('button'); if (!b) return;
  S.zoom = Number(b.dataset.z);
  $('#zoom').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  layout();
  const sc = $('.scroller');
  if (sc) sc.scrollLeft = Math.max(0, (audio.currentTime / S.tr.seconds) * $('.inner', sc).clientWidth - sc.clientWidth * 0.25);
});

// 上一个 / 下一个"停"：当前这一行叫它停的、连着至少 2 拍的段，跳到段首前 2 秒
function stopStarts() {
  const r = S.rows.find((x) => x.id === S.active);
  const band = r && r.band ? r.band : S.tr.orig.voiced;
  const E = S.tr.edges, out = [];
  for (let i = 0; i < band.length; i++) {
    if (band[i] === 0 && (i === 0 || band[i - 1] === 1)) {
      let j = i; while (j < band.length && band[j] === 0) j++;
      if (j - i >= 2) out.push(E[i]);
    }
  }
  return out;
}
function jumpStop(dir) {
  const now = audio.currentTime, starts = stopStarts();
  const target = dir > 0 ? starts.find((s) => s - 2 > now + 0.3) : [...starts].reverse().find((s) => s - 2 < now - 0.3);
  if (target != null) { audio.currentTime = Math.max(0, target - 2); movePH(); }
}
$('#prevStop').addEventListener('click', () => jumpStop(-1));
$('#nextStop').addEventListener('click', () => jumpStop(1));

document.addEventListener('keydown', (ev) => {
  if (!S.tr || (ev.target.closest && ev.target.closest('input,textarea')) || ev.ctrlKey || ev.metaKey || ev.altKey) return;
  if (ev.code === 'Space') { ev.preventDefault(); audio.paused ? audio.play() : audio.pause(); }
  else if (/^[1-9]$/.test(ev.key)) { const r = S.rows[Number(ev.key) - 1]; if (r && r.ready) setSource(r.id, audio.currentTime, !audio.paused); }
  else if (ev.key === 'ArrowLeft') { audio.currentTime = Math.max(0, audio.currentTime - 5); movePH(); }
  else if (ev.key === 'ArrowRight') { audio.currentTime = Math.min(S.tr.seconds, audio.currentTime + 5); movePH(); }
  else if (ev.key === '[') jumpStop(-1);
  else if (ev.key === ']') jumpStop(1);
});
let rz = 0;
window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(layout, 120); });

function showErr(e) {
  $('#cards').innerHTML = `<div class="err">读不到数据：${e.message || e}。请刷新页面再试。</div>`;
}

(async function main() {
  try { S.idx = await getJSON('data/gate2/index.json'); } catch (e) { return showErr(e); }
  renderTop();
  const want = decodeURIComponent(location.hash.slice(1));
  const all = S.idx.songs.flatMap((s) => s.tracks.map((t) => t.id));
  if (all.length) openTrack(all.includes(want) ? want : all[0], false);
})();
