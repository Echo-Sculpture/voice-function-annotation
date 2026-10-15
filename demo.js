/* 演示版：页面原本向本机服务要的东西，换成读同一目录下的静态文件（build_static.py 生成）。
   保存只回一个“好了”，什么都不写；重新识别、改网格回一个说明，页面上这几个按钮也已经藏起来了。 */
(() => {
  'use strict';
  const AUDIO = new Set(["moises/m5_4_sets", "moises/m6_best_in_me", "moises/m7_what_are_the_odds", "moises/m8_best_of_times", "moises/m9_diamond_eyes", "moises/m10_the_bench"]);                 // 放了音频的几首，build_static.py 填进来
  const realFetch = window.fetch.bind(window);
  const reply = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });
  const local = (msgZh, msgEn) => (document.documentElement.lang === 'en' ? msgEn : msgZh);
  const seg = (s) => encodeURIComponent(s);

  async function fileOr(path, missing) {
    const r = await realFetch(path, { cache: 'no-cache' });
    return r.ok ? r : missing();
  }

  window.fetch = async (input, opt) => {
    const url = typeof input === 'string' ? input : (input && input.url) || '';
    if (!url.startsWith('/api/') && !url.startsWith('/audio/')) return realFetch(input, opt);
    const u = new URL(url, 'http://demo');
    const q = (k) => u.searchParams.get(k) || '';
    const method = ((opt && opt.method) || 'GET').toUpperCase();
    const c = q('c'), id = q('id');

    if (method !== 'GET') {
      if (u.pathname === '/api/save') return reply({ ok: true, saved_at: 'demo', n_changed: 0, rev: 1 });
      if (u.pathname === '/api/grid') return reply({ ok: true });
      return reply({ error: local('演示版不能重新识别或改网格，这些只在本机的标注页里能用', 'Recomputing and grid changes only work in the local label page, not in this demo') }, 400);
    }
    if (u.pathname === '/api/library') return fileOr('data/library.json', () => reply({ error: 'library' }, 500));
    if (u.pathname === '/api/song') {
      const bar = q('view') === 'bar';
      return fileOr(`data/song/${seg(c)}/${seg(id)}${bar ? '.bar' : ''}.json`, () => (bar
        ? reply({ error: local('这首歌还没有按小节的结果', 'No bar view for this song yet'), code: 'no_bar' }, 404)
        : reply({ error: local('没有这首歌的分析结果', 'No analysis for this song') }, 404)));
    }
    if (u.pathname === '/api/peaks') return fileOr(`data/peaks/${seg(c)}/${seg(id)}.json`, () => reply({ rate: 0, stems: {} }));
    if (u.pathname === '/api/reextract') return reply({ state: 'idle' });
    if (u.pathname.startsWith('/audio/')) {
      const parts = url.slice('/audio/'.length).split('/');
      if (parts.length >= 3 && AUDIO.has(decodeURIComponent(parts[0]) + '/' + decodeURIComponent(parts[1]))) {
        const rest = parts.slice(2).join('/').replace(/\.(flac|wav|mp3|ogg)$/i, '.ogg');
        return realFetch(`audio/${parts[0]}/${parts[1]}/${rest}`);
      }
      return new Response('', { status: 404 });
    }
    return reply({ error: 'not in demo' }, 404);
  };

  // 关页面时页面会用 sendBeacon 补存一次：演示版里不发
  if (navigator.sendBeacon) {
    const realBeacon = navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = (url, data) => (String(url).startsWith('/api/') ? true : realBeacon(url, data));
  }
})();
