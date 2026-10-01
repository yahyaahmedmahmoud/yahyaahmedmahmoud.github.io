/* موقع يحيى أحمد محمود — واجهة تقرأ المقالات والتعليقات مباشرة من المدونة الأصلية على ووردبريس. */
(function () {
  'use strict';

  var C = window.SITE;
  var API = 'https://public-api.wordpress.com/rest/v1.1/sites/' + C.wp;
  var FIELDS = 'ID,date,modified,title,URL,slug,excerpt,content,categories,tags,discussion,featured_image';
  var CACHE_KEY = 'ya.data.v2';
  var main = document.getElementById('main');

  var S = { posts: [], pages: [], byId: {}, quotes: [], ready: false, view: 'cards' };

  /* ---------- أدوات صغيرة ---------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function parse(html) {
    return new DOMParser().parseFromString('<div id="r">' + (html || '') + '</div>', 'text/html').getElementById('r');
  }
  function textOf(html) { return (parse(html).textContent || '').replace(/[\s ]+/g, ' ').trim(); }
  function num(n) { try { return Number(n).toLocaleString('ar-EG', { useGrouping: false }); } catch (e) { return String(n); } }
  var fmtDate = (function () {
    var f;
    try { f = new Intl.DateTimeFormat('ar-EG', { day: 'numeric', month: 'long', year: 'numeric' }); } catch (e) { f = null; }
    return function (d) {
      var dt = new Date(d + 'T12:00:00');
      return f ? f.format(dt) : d;
    };
  })();
  function minsLabel(m) {
    if (m <= 1) return 'دقيقة قراءة';
    if (m === 2) return 'دقيقتا قراءة';
    if (m <= 10) return num(m) + ' دقائق قراءة';
    return num(m) + ' دقيقة قراءة';
  }
  function countLabel(n, one, two, few, many) {
    if (n === 0) return 'لا ' + many;
    if (n === 1) return one;
    if (n === 2) return two;
    if (n <= 10) return num(n) + ' ' + few;
    return num(n) + ' ' + many;
  }
  function isLatin(s) {
    var a = (s.match(/[؀-ۿ]/g) || []).length;
    var l = (s.match(/[A-Za-z]/g) || []).length;
    return l > a * 2;
  }
  function store(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function url(params) {
    var q = [];
    for (var k in params) if (params[k] != null && params[k] !== '') q.push(k + '=' + encodeURIComponent(params[k]));
    return './' + (q.length ? '?' + q.join('&') : '');
  }

  /* ---------- الرسومات الهندسية للبطاقات ---------- */
  var PAL = [
    { bg: '#1c1b18', a: '#d4532b', b: '#f4ede1', c: '#e0a53a', fg: '#f4ede1', dark: 1 },
    { bg: '#c4472a', a: '#1c1b18', b: '#f4ede1', c: '#f0b7a4', fg: '#fffaf2', dark: 1 },
    { bg: '#f0b7a4', a: '#1c1b18', b: '#2a45c9', c: '#f4ede1', fg: '#1c1b18' },
    { bg: '#9aa274', a: '#1c1b18', b: '#f4ede1', c: '#c4472a', fg: '#1c1b18' },
    { bg: '#0f4f57', a: '#f4ede1', b: '#e07a4a', c: '#e0a53a', fg: '#f4ede1', dark: 1 },
    { bg: '#58264a', a: '#e0a53a', b: '#f0b7a4', c: '#f4ede1', fg: '#f4ede1', dark: 1 },
    { bg: '#e9dfca', a: '#c4472a', b: '#1c1b18', c: '#2a45c9', fg: '#1c1b18' }
  ];
  function rng(seed) {
    var t = seed >>> 0;
    return function () {
      t += 0x6D2B79F5;
      var r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }
  function stripes(x, y, w, n, gap, th, col) {
    var s = '';
    for (var i = 0; i < n; i++) s += '<rect x="' + x + '" y="' + (y + i * gap) + '" width="' + w + '" height="' + th + '" fill="' + col + '"/>';
    return s;
  }
  function art(seed, pi) {
    var p = PAL[pi % PAL.length], r = rng(seed * 7919 + 13), m = Math.floor(r() * 6), g = '';
    var i, flip = r() > 0.5;
    if (m === 0) { /* شمس تغرب في خطوط */
      g += '<path d="M120 150a80 80 0 0 1 160 0z" fill="' + p.a + '"/>';
      g += stripes(90, 164, 220, 5, 20, 6, p.b);
      g += '<circle cx="' + (flip ? 318 : 82) + '" cy="72" r="12" fill="' + p.c + '"/>';
    } else if (m === 1) { /* ثلاث قباب */
      var hs = [70 + r() * 30, 120 + r() * 30, 60 + r() * 30], cols = flip ? [p.b, p.a, p.a] : [p.a, p.a, p.b];
      for (i = 0; i < 3; i++) g += '<path d="M' + (45 + i * 110) + ' 250V' + (250 - hs[i]) + 'a45 45 0 0 1 90 0V250z" fill="' + cols[i] + '"/>';
      g += '<rect x="30" y="250" width="340" height="5" fill="' + p.c + '"/>';
    } else if (m === 2) { /* حلقات */
      for (i = 4; i >= 1; i--) g += '<circle cx="200" cy="150" r="' + (24 + i * 22) + '" fill="none" stroke="' + p.a + '" stroke-width="2.5"/>';
      g += '<circle cx="200" cy="150" r="28" fill="' + p.a + '"/>';
      g += '<circle cx="' + (flip ? 262 : 138) + '" cy="118" r="13" fill="' + p.b + '"/>';
    } else if (m === 3) { /* باب مقوّس */
      g += '<path d="M132 258V122a68 68 0 0 1 136 0V258z" fill="' + p.a + '"/>';
      g += '<path d="M172 258V160a28 28 0 0 1 56 0V258z" fill="' + p.bg + '"/>';
      g += '<circle cx="' + (flip ? 322 : 78) + '" cy="78" r="15" fill="' + p.b + '"/>';
      g += '<rect x="80" y="258" width="240" height="5" fill="' + p.c + '"/>';
    } else if (m === 4) { /* قرص يقطع شريطًا */
      g += flip ? '<path d="M40 168L360 138V262H40z" fill="' + p.b + '"/>' : '<path d="M40 138L360 168V262H40z" fill="' + p.b + '"/>';
      g += '<circle cx="200" cy="150" r="76" fill="' + p.a + '"/>';
      g += '<rect x="' + (flip ? 286 : 64) + '" y="60" width="50" height="6" fill="' + p.c + '"/>';
    } else { /* أقواس متراكبة */
      var cs = [p.a, p.bg, p.b, p.bg];
      for (i = 0; i < 4; i++) { var rad = 150 - i * 36; g += '<path d="M' + (200 - rad) + ' 250a' + rad + ' ' + rad + ' 0 0 1 ' + (rad * 2) + ' 0z" fill="' + cs[i] + '"/>'; }
      g += '<circle cx="' + (flip ? 340 : 60) + '" cy="62" r="12" fill="' + p.c + '"/>';
    }
    return '<svg class="art" viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">' + g + '</svg>';
  }
  /* الصورة البارزة للمقال إن وُجدت، وإلا الرسمة الهندسية */
  function imgUrl(u, w) {
    if (!u) return '';
    return u + (u.indexOf('?') < 0 && /wordpress\.com\//.test(u) ? '?w=' + w : '');
  }
  function visual(p, pi, w) {
    return p.img ? '<img class="pic" src="' + esc(imgUrl(p.img, w)) + '" alt="" loading="lazy" decoding="async">' : art(p.id, pi);
  }
  function heroArt() {
    return '<svg class="hero-art" viewBox="0 0 300 420" aria-hidden="true" focusable="false">' +
      '<path d="M40 410V150a110 110 0 0 1 220 0V410" fill="none" stroke="#e0a53a" stroke-width="2"/>' +
      '<path d="M56 410V150a94 94 0 0 1 188 0V410z" fill="#c4472a"/>' +
      '<circle cx="150" cy="250" r="118" fill="#d4532b"/><circle cx="150" cy="250" r="88" fill="#dc6238"/>' +
      '<clipPath id="hc"><path d="M56 410V150a94 94 0 0 1 188 0V410z"/></clipPath>' +
      '<g clip-path="url(#hc)"><circle cx="150" cy="270" r="54" fill="#f4ede1"/>' +
      '<rect x="56" y="270" width="188" height="140" fill="#1c1b18"/>' + stripes(56, 282, 188, 7, 19, 6, '#d4532b') + '</g>' +
      '<circle cx="196" cy="118" r="10" fill="#2a45c9"/>' +
      '<path d="M150 22l7 9-7 9-7-9z" fill="#e0a53a"/>' +
      '</svg>';
  }

  /* ---------- جلب البيانات ---------- */
  function getJSON(u) {
    return fetch(u).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); });
  }
  function fetchAllPosts() {
    var all = [];
    function page(n) {
      return getJSON(API + '/posts/?number=100&page=' + n + '&fields=' + FIELDS).then(function (j) {
        all = all.concat(j.posts || []);
        if ((j.posts || []).length && all.length < j.found && n < 20) return page(n + 1);
        return all;
      });
    }
    return page(1);
  }
  function fetchPages() {
    return getJSON(API + '/posts/?type=page&number=50&fields=ID,title,slug,content,URL').then(function (j) { return j.posts || []; }).catch(function () { return []; });
  }

  function mapCat(name) {
    if (Object.prototype.hasOwnProperty.call(C.catAlias, name)) return C.catAlias[name];
    return name;
  }
  function firstPdf(root) {
    var a = root.querySelector('a[href$=".pdf"], a[href*=".pdf?"]');
    return a ? a.getAttribute('href') : '';
  }
  function norm(p) {
    var d = String(p.date).slice(0, 10);
    var root = parse(p.content);
    var text = (root.textContent || '').replace(/[\s ]+/g, ' ').trim();
    var words = text ? text.split(' ').length : 0;
    var title = textOf(p.title) || 'بلا عنوان';
    var cats = C.catByDate[d];
    if (!cats) {
      cats = [];
      Object.keys(p.categories || {}).forEach(function (n) { var m = mapCat(n); if (m && cats.indexOf(m) < 0) cats.push(m); });
      if (!cats.length) cats = ['عامة'];
    }
    var ex = textOf(p.excerpt).replace(/\s*\[?(…|\.\.\.)\]?\s*$/, '');
    return {
      id: p.ID, d: d, y: +d.slice(0, 4), title: title, url: p.URL, content: p.content || '',
      text: text, words: words, mins: Math.max(1, Math.round(words / 200)),
      excerpt: ex, cats: cats, tags: Object.keys(p.tags || {}),
      ncom: (p.discussion && p.discussion.comment_count) || 0,
      comOpen: !!(p.discussion && p.discussion.comments_open),
      en: isLatin(title), pdf: firstPdf(root), modified: p.modified || '', img: typeof p.featured_image === 'string' ? p.featured_image : ''
    };
  }

  function setData(rawPosts, rawPages) {
    S.posts = rawPosts.map(norm).sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : b.id - a.id; });
    S.byId = {};
    S.posts.forEach(function (p, i) { S.byId[p.id] = p; p.i = i; });
    S.pages = rawPages || [];
    S.quotes = buildQuotes();
    S.ready = true;
    var about = aboutPage();
    document.getElementById('nav-about').hidden = !about;
    var first = S.posts.length ? S.posts[S.posts.length - 1].y : '';
    document.getElementById('foot-note').textContent = S.posts.length
      ? countLabel(S.posts.length, 'مقال واحد', 'مقالان', 'مقالات', 'مقالًا') + ' منذ ' + num(first)
      : '';
  }

  function aboutPage() {
    for (var i = 0; i < S.pages.length; i++) {
      var pg = S.pages[i], t = textOf(pg.title), slug = decodeURIComponent(pg.slug || '');
      if (/^(about|حول|عن|من أنا|عن الكاتب)/i.test(t) || /^(about|حول)/i.test(slug)) {
        var txt = textOf(pg.content);
        if (txt.length < 40 || /This is an example of an about page|مثال لصفحة/i.test(txt)) return null;
        return pg;
      }
    }
    return null;
  }

  /* الاقتباسات: من صفحة «اقتباسات» على ووردبريس إن وُجدت، وإلا من config.js */
  function buildQuotes() {
    var out = [], i;
    for (i = 0; i < S.pages.length; i++) {
      if (textOf(S.pages[i].title) === 'اقتباسات') {
        var root = parse(S.pages[i].content);
        var nodes = root.querySelectorAll('blockquote, p');
        for (var k = 0; k < nodes.length; k++) {
          var n = nodes[k];
          if (n.tagName === 'P' && n.closest('blockquote')) continue;
          var t = (n.textContent || '').replace(/[\s ]+/g, ' ').trim();
          if (t.length < 12) continue;
          var src = null, a = n.querySelector('a[href]');
          if (a) src = postByUrl(a.getAttribute('href'));
          out.push({ t: t, p: src });
        }
        if (out.length) return out;
      }
    }
    var byDate = {};
    S.posts.forEach(function (p) { byDate[p.d] = p; });
    (C.quotes || []).forEach(function (q) {
      var p = byDate[q.d];
      if (!p) return;
      var s = p.text.indexOf(q.a);
      if (s < 0) return;
      var e = p.text.indexOf(q.z, s);
      if (e < 0) return;
      var t = p.text.slice(s, e + q.z.length);
      if (t.length > 420) return;
      out.push({ t: t, p: p });
    });
    return out;
  }
  function postByUrl(href) {
    if (!href) return null;
    var m = /[?&]p=(\d+)/.exec(href);
    if (m && S.byId[m[1]]) return S.byId[m[1]];
    var clean = function (u) { try { return decodeURIComponent(u).replace(/^https?:\/\//, '').replace(/[?#].*$/, '').replace(/\/$/, '').toLowerCase(); } catch (e) { return u; } };
    var h = clean(href);
    for (var i = 0; i < S.posts.length; i++) if (clean(S.posts[i].url) === h) return S.posts[i];
    return null;
  }

  /* ---------- تنظيف محتوى المقال ---------- */
  var KEEP_ATTR = { href: 1, src: 1, alt: 1, title: 1, id: 1, name: 1, class: 1, colspan: 1, rowspan: 1, width: 1, height: 1, srcset: 1, sizes: 1, dir: 1, lang: 1, start: 1, cite: 1 };
  function cleanContent(html, strict) {
    var root = parse(html), i;
    var bad = root.querySelectorAll('script,style,link,meta,form,input,button,select,textarea,object,embed,noscript,svg' + (strict ? ',img,iframe,video,audio,table,h1,h2,h3,h4,h5,h6' : ''));
    for (i = 0; i < bad.length; i++) bad[i].remove();
    var frames = root.querySelectorAll('iframe');
    for (i = 0; i < frames.length; i++) {
      var src = frames[i].getAttribute('src') || '';
      if (/^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com|player\.vimeo\.com)\//.test(src)) {
        var box = document.createElement('div'); box.className = 'video';
        var f = document.createElement('iframe');
        f.setAttribute('src', src); f.setAttribute('loading', 'lazy'); f.setAttribute('allowfullscreen', ''); f.setAttribute('title', 'فيديو');
        box.appendChild(f); frames[i].replaceWith(box);
      } else {
        if (!strict && /^https:\/\//.test(src) && !/wp-embedded-content/.test(frames[i].getAttribute('class') || '')) {
          var ep = document.createElement('p'), ea = document.createElement('a');
          ea.setAttribute('href', src); ea.textContent = 'عرض المحتوى المضمَّن في صفحته الأصلية';
          ep.appendChild(ea); frames[i].replaceWith(ep);
        } else frames[i].remove();
      }
    }
    var all = root.querySelectorAll('*');
    for (i = 0; i < all.length; i++) {
      var n = all[i], attrs = Array.prototype.slice.call(n.attributes), center = false;
      for (var k = 0; k < attrs.length; k++) {
        var an = attrs[k].name.toLowerCase(), av = attrs[k].value;
        if (an === 'style') { if (/text-align\s*:\s*center/i.test(av)) center = true; n.removeAttribute(attrs[k].name); }
        else if (an.indexOf('on') === 0) n.removeAttribute(attrs[k].name);
        else if (!KEEP_ATTR[an] && n.tagName !== 'IFRAME') n.removeAttribute(attrs[k].name);
        else if ((an === 'href' || an === 'src') && /^\s*(javascript|data|vbscript):/i.test(av)) n.removeAttribute(attrs[k].name);
      }
      if (center) n.classList.add('tc');
    }
    /* ملفات مرفقة (PDF) */
    var files = root.querySelectorAll('.wp-block-file');
    for (i = 0; i < files.length; i++) {
      var a = files[i].querySelector('a[href]');
      if (!a) { files[i].remove(); continue; }
      var fb = document.createElement('p'); fb.className = 'filebox';
      var link = document.createElement('a'); link.className = 'btn'; link.href = a.getAttribute('href');
      link.target = '_blank'; link.rel = 'noopener';
      link.textContent = /\.pdf/i.test(link.href) ? 'تحميل الملف (PDF)' : 'تحميل الملف';
      fb.appendChild(link); files[i].replaceWith(fb);
    }
    /* عناصر div المستعملة كفقرات (نصوص منقولة من فيسبوك) تتحول إلى فقرات حقيقية */
    var divs = Array.prototype.slice.call(root.querySelectorAll('div')).reverse();
    for (i = 0; i < divs.length; i++) {
      var dv = divs[i];
      if (dv.classList.contains('video') || dv.querySelector('p, div, ul, ol, figure, table, blockquote, h1, h2, h3, h4, h5, h6, iframe')) continue;
      var np = document.createElement('p');
      while (dv.firstChild) np.appendChild(dv.firstChild);
      dv.replaceWith(np);
    }
    /* فقرات فارغة */
    var ps = root.querySelectorAll('p, div, figure');
    for (i = 0; i < ps.length; i++) {
      var el = ps[i];
      if (!el.querySelector('img, iframe, a[href]') && !(el.textContent || '').replace(/[\s\u00a0]/g, '')) el.remove();
    }
    var imgs = root.querySelectorAll('img');
    for (i = 0; i < imgs.length; i++) { imgs[i].setAttribute('loading', 'lazy'); imgs[i].setAttribute('decoding', 'async'); if (!imgs[i].hasAttribute('alt')) imgs[i].setAttribute('alt', ''); }
    var links = root.querySelectorAll('a[href]');
    for (i = 0; i < links.length; i++) {
      var h = links[i].getAttribute('href');
      if (h.charAt(0) === '#') continue;
      var p = strict ? null : postByUrl(h);
      if (p) { links[i].setAttribute('href', url({ p: p.id })); links[i].setAttribute('data-link', ''); }
      else { links[i].setAttribute('target', '_blank'); links[i].setAttribute('rel', strict ? 'noopener nofollow ugc' : 'noopener'); }
    }
    var blocks = root.querySelectorAll('p, li, blockquote, h1, h2, h3, h4, h5, h6, figcaption, td, th');
    for (i = 0; i < blocks.length; i++) if (!blocks[i].hasAttribute('dir')) blocks[i].setAttribute('dir', 'auto');
    return root;
  }
  /* خيار الترجمة: سطر مستقل نصه [English] أو [العربية] يفصل بين نسختي المقال */
  function splitLangs(root) {
    var kids = Array.prototype.slice.call(root.children), at = -1, lang = '';
    for (var i = 0; i < kids.length; i++) {
      var m = /^\[\s*(english|العربية|عربي|arabic)\s*\]$/i.exec((kids[i].textContent || '').trim());
      if (m) { at = i; lang = /english/i.test(m[1]) ? 'en' : 'ar'; break; }
    }
    if (at < 0) return null;
    var a = document.createElement('div'), b = document.createElement('div');
    kids.forEach(function (k, i) { if (i < at) a.appendChild(k); else if (i > at) b.appendChild(k); });
    return { first: a, second: b, secondLang: lang };
  }

  /* ---------- عناصر مشتركة ---------- */
  function catChips(p, cls) {
    return p.cats.map(function (c) { return '<a class="tag ' + (cls || '') + '" href="' + url({ c: c }) + '" data-link>' + esc(c) + '</a>'; }).join('');
  }
  function palOf(p) { return (p.i * 3 + 2) % PAL.length; }
  function card(p, size) {
    var idx = palOf(p), pal = PAL[idx];
    var showMins = p.words >= 40;
    return '<article class="card k-' + size + '" style="--cbg:' + pal.bg + ';--cfg:' + pal.fg + '">' +
      '<div class="card-art' + (p.img ? ' has-img' : '') + '">' + visual(p, idx, 900) + '</div>' +
      '<div class="card-body">' +
        '<p class="card-meta"><span>' + esc(fmtDate(p.d)) + '</span>' + (showMins ? '<span>' + minsLabel(p.mins) + '</span>' : '') + '</p>' +
        '<h3 class="card-title"' + (p.en ? ' dir="ltr" lang="en"' : '') + '><a href="' + url({ p: p.id }) + '" data-link>' + esc(p.title) + '</a></h3>' +
        (size === 'lg' && p.excerpt ? '<p class="card-ex"' + (p.en ? ' dir="ltr" lang="en"' : '') + '>' + esc(p.excerpt.slice(0, 220)) + '…</p>' : '') +
        '<p class="card-cats">' + p.cats.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') + '</p>' +
      '</div></article>';
  }
  var SIZES = ['lg', 'sm', 'sm', 'wide', 'sm', 'sm', 'sm', 'sm'];
  function cardsHTML(list) {
    if (list.length < 3) return '<div class="grid">' + list.map(function (p) { return card(p, 'wide'); }).join('') + '</div>';
    return '<div class="grid">' + list.map(function (p, i) { return card(p, SIZES[i % SIZES.length]); }).join('') + '</div>';
  }
  function listHTML(list) {
    var out = '', y = null;
    list.forEach(function (p) {
      if (p.y !== y) { if (y !== null) out += '</ul>'; y = p.y; out += '<h3 class="year">' + num(y) + '</h3><ul class="rows">'; }
      out += '<li class="row"><a class="row-title" href="' + url({ p: p.id }) + '" data-link' + (p.en ? ' dir="ltr" lang="en"' : '') + '>' + esc(p.title) + '</a>' +
        '<span class="row-meta">' + esc(fmtDate(p.d)) + (p.words >= 40 ? '، ' + minsLabel(p.mins) : '') + '</span>' +
        '<span class="row-cats">' + p.cats.map(esc).join('، ') + '</span></li>';
    });
    return out + (y !== null ? '</ul>' : '');
  }

  function quoteBox() {
    if (!S.quotes.length) return '';
    return '<section class="quote" aria-label="اقتباسات">' +
      '<h2 class="quote-h"><a href="' + url({ v: 'quotes' }) + '" data-link>اقتباسات</a></h2>' +
      '<blockquote id="qt" class="quote-t"></blockquote>' +
      '<p class="quote-src" id="qs"></p>' +
      '<button class="pill" id="qn" type="button">اقتباس آخر</button>' +
      '</section>';
  }
  var qi = -1;
  function showQuote(next) {
    var t = document.getElementById('qt');
    if (!t || !S.quotes.length) return;
    if (qi < 0) qi = Math.floor(Math.random() * S.quotes.length); else if (next) qi = (qi + 1) % S.quotes.length;
    var q = S.quotes[qi], en = isLatin(q.t);
    t.textContent = q.t;
    t.dir = en ? 'ltr' : 'rtl'; t.lang = en ? 'en' : 'ar';
    t.classList.toggle('long', q.t.length > 150);
    document.getElementById('qs').innerHTML = q.p ? 'من <a href="' + url({ p: q.p.id }) + '" data-link>«' + esc(q.p.title) + '»</a>' : '';
  }

  function bookletsHTML(bare) {
    var list = S.posts.filter(function (p) { return p.cats.indexOf('كتيبات') >= 0; });
    if (!list.length) return '';
    return '<section class="books" aria-labelledby="books-h">' + (bare ? '<h2 id="books-h" class="sr">الكتيبات</h2>' : '<h2 id="books-h" class="sec-h">الكتيبات</h2>') + '<div class="books-in">' +
      list.map(function (p, i) {
        var pal = PAL[(i * 3 + 4) % PAL.length];
        return '<article class="book">' +
          '<a class="cover" href="' + url({ p: p.id }) + '" data-link style="--cbg:' + pal.bg + ';--cfg:' + pal.fg + '" aria-label="' + esc(p.title) + '">' +
            (p.img ? '<img class="pic" src="' + esc(imgUrl(p.img, 600)) + '" alt="" loading="lazy" decoding="async">'
              : art(p.id + 5, (i * 3 + 4)) + '<span class="cover-t">' + esc(p.title) + '</span><span class="cover-a">' + esc(C.name) + '</span>') + '</a>' +
          '<div class="book-body"><h3 class="book-t"><a href="' + url({ p: p.id }) + '" data-link>' + esc(p.title) + '</a></h3>' +
            '<p class="book-meta">' + esc(fmtDate(p.d)) + (p.ncom ? '، ' + countLabel(p.ncom, 'تعليق واحد', 'تعليقان', 'تعليقات', 'تعليقًا') : '') + '</p>' +
            (p.excerpt && p.words >= 40 ? '<p class="book-ex">' + esc(p.excerpt.slice(0, 200)) + '…</p>' : '') +
            '<p class="book-act">' + (p.pdf ? '<a class="btn" href="' + esc(p.pdf) + '" target="_blank" rel="noopener">تحميل الكتيب (PDF)</a>' : '') +
            '<a class="btn ghost" href="' + url({ p: p.id }) + '" data-link>صفحة الكتيب والتعليقات</a></p>' +
          '</div></article>';
      }).join('') + '</div></section>';
  }

  /* ---------- الصفحة الرئيسية ---------- */
  function renderHome(f) {
    var onlyBooks = f.c === 'كتيبات' && !f.y && !f.t;
    document.title = (f.c ? f.c + ' — ' : f.t ? '#' + f.t + ' — ' : f.y ? num(f.y) + ' — ' : f.v === 'articles' ? 'المقالات — ' : '') + C.name;
    var latest = S.posts[0];
    var years = [], cc = {};
    S.posts.forEach(function (p) { if (years.indexOf(p.y) < 0) years.push(p.y); p.cats.forEach(function (c) { cc[c] = (cc[c] || 0) + 1; }); });
    var cats = C.cats.slice();
    Object.keys(cc).forEach(function (c) { if (cats.indexOf(c) < 0) cats.push(c); });

    var list = S.posts.filter(function (p) {
      if (f.c && p.cats.indexOf(f.c) < 0) return false;
      if (f.y && String(p.y) !== String(f.y)) return false;
      if (f.t && p.tags.indexOf(f.t) < 0) return false;
      return true;
    });
    var filtered = !!(f.c || f.y || f.t);

    var hero = '<section class="hero">' +
      '<div class="hero-name">' + heroArt() +
        '<h1 class="name">' + C.name.split(' ').map(function (w, k) { return '<span' + (k === 1 ? ' class="name-2"' : '') + '>' + esc(w) + '</span>'; }).join('') + '</h1>' +
        '<p class="hero-count">' + esc(document.getElementById('foot-note').textContent) + '</p>' +
      '</div>' +
      '<div class="hero-side">' + quoteBox() +
        (latest ? '<article class="latest' + (latest.img ? ' has-img' : '') + '" style="--cbg:' + PAL[palOf(latest)].bg + ';--cfg:' + PAL[palOf(latest)].fg + '">' + visual(latest, palOf(latest), 900) +
          '<div class="latest-body"><p class="latest-k">أحدث مقال</p>' +
          '<h2 class="latest-t"' + (latest.en ? ' dir="ltr" lang="en"' : '') + '><a href="' + url({ p: latest.id }) + '" data-link>' + esc(latest.title) + '</a></h2>' +
          '<p class="card-meta"><span>' + esc(fmtDate(latest.d)) + '</span>' + (latest.words >= 40 ? '<span>' + minsLabel(latest.mins) + '</span>' : '') + '</p></div></article>' : '') +
      '</div></section>';

    var chip = function (label, params, on, count) {
      return '<a class="chip' + (on ? ' on' : '') + (count === 0 ? ' empty' : '') + '" href="' + url(params) + '" data-link' + (on ? ' aria-current="true"' : '') + '>' + esc(label) +
        (count != null ? ' <span class="n">' + num(count) + '</span>' : '') + '</a>';
    };
    var base = function (o) { var r = { v: 'articles', c: f.c, y: f.y }; for (var k in o) r[k] = o[k]; return r; };
    var filters = '<div class="filters">' +
      '<div class="frow" role="group" aria-label="التصنيف"><span class="flabel">التصنيف</span>' +
        chip('الكل', base({ c: '' }), !f.c) +
        cats.map(function (c) { return chip(c, base({ c: c }), f.c === c, cc[c] || 0); }).join('') + '</div>' +
      '<div class="frow" role="group" aria-label="السنة"><span class="flabel">السنة</span>' +
        chip('كل السنوات', base({ y: '' }), !f.y) +
        years.map(function (y) { return chip(num(y), base({ y: y }), String(f.y) === String(y)); }).join('') + '</div>' +
      (f.t ? '<div class="frow"><span class="flabel">الوسم</span>' + chip('#' + f.t, base({ t: '' }), true) + '</div>' : '') +
      '</div>';

    var head = '<div class="sec-head"><h2 id="articles" class="sec-h" tabindex="-1">' + (onlyBooks ? 'الكتيبات' : 'المقالات') + ' <span class="sec-n">' + num(list.length) + '</span></h2>' + (onlyBooks ? '</div>' : '') +
      '<div class="views" role="group" aria-label="طريقة العرض">' +
        '<button type="button" class="vbtn' + (S.view === 'cards' ? ' on' : '') + '" data-view="cards" aria-pressed="' + (S.view === 'cards') + '">بطاقات</button>' +
        '<button type="button" class="vbtn' + (S.view === 'list' ? ' on' : '') + '" data-view="list" aria-pressed="' + (S.view === 'list') + '">قائمة بالسنوات</button>' +
      '</div></div>';
    if (onlyBooks) head = head.slice(0, head.indexOf('<div class="views"'));

    var body = onlyBooks && list.length ? bookletsHTML(true) : list.length
      ? (S.view === 'list' ? listHTML(list) : cardsHTML(list))
      : '<p class="empty">لا توجد مقالات هنا بعد. <a href="' + url({ v: 'articles' }) + '" data-link>اعرض كل المقالات</a></p>';

    main.innerHTML = (filtered || f.v === 'articles' ? '' : hero + bookletsHTML()) +
      '<section class="articles" aria-labelledby="articles">' + head + filters + '<div id="list">' + body + '</div></section>';
    showQuote(false);
  }

  /* ---------- صفحة المقال ---------- */
  function renderPost(p, lang) {
    document.title = p.title + ' — ' + C.name;
    var root = cleanContent(p.content);
    var parts = splitLangs(root), firstLang = p.en ? 'en' : 'ar', bodyRoot = root, bodyLang = firstLang, toggle = '';
    if (parts) {
      var want = lang || firstLang;
      bodyRoot = want === parts.secondLang && parts.secondLang !== firstLang ? parts.second : parts.first;
      bodyLang = bodyRoot === parts.second ? parts.secondLang : firstLang;
      toggle = '<div class="lang" role="group" aria-label="لغة المقال">' +
        '<a class="vbtn' + (bodyLang === 'ar' ? ' on' : '') + '" href="' + url({ p: p.id, lang: 'ar' }) + '" data-link>العربية</a>' +
        '<a class="vbtn' + (bodyLang === 'en' ? ' on' : '') + '" href="' + url({ p: p.id, lang: 'en' }) + '" data-link lang="en">English</a></div>';
    }
    var pal = PAL[palOf(p)];
    var newer = S.posts[p.i - 1], older = S.posts[p.i + 1];
    var share = encodeURIComponent(location.href), st = encodeURIComponent(p.title);
    var html = '<article class="post">' +
      '<header class="post-head' + (p.img ? ' has-img' : '') + '" style="--cbg:' + pal.bg + ';--cfg:' + pal.fg + '">' + visual(p, palOf(p), 1400) +
        '<div class="post-head-in">' +
          '<p class="post-meta">' + catChips(p) + '<span class="tag plain">' + esc(fmtDate(p.d)) + '</span>' +
            (p.words >= 40 ? '<span class="tag plain">' + minsLabel(p.mins) + '</span>' : '') + '</p>' +
          '<h1 class="post-title"' + (p.en ? ' dir="ltr" lang="en"' : '') + '>' + esc(p.title) + '</h1>' +
          '<p class="by">بقلم ' + esc(C.name) + '</p>' +
        '</div></header>' + toggle +
      '<div class="prose' + (bodyLang === 'en' ? ' en' : '') + '" id="prose" dir="' + (bodyLang === 'en' ? 'ltr' : 'rtl') + '" lang="' + bodyLang + '"></div>' +
      (p.tags.length ? '<p class="tags"><span class="flabel">الوسوم</span>' + p.tags.map(function (t) { return '<a class="tag" href="' + url({ t: t }) + '" data-link>#' + esc(t) + '</a>'; }).join('') + '</p>' : '') +
      '<div class="share" role="group" aria-label="مشاركة المقال">' +
        '<button type="button" class="btn ghost" id="copy">نسخ الرابط</button>' +
        '<a class="btn ghost" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + share + '">فيسبوك</a>' +
        '<a class="btn ghost" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?url=' + share + '&text=' + st + '">إكس</a>' +
        '<a class="btn ghost" target="_blank" rel="noopener" href="https://wa.me/?text=' + st + '%20' + share + '">واتساب</a>' +
        '<a class="btn ghost" target="_blank" rel="noopener" href="' + esc(p.url) + '">المقال على المدونة الأصلية</a>' +
      '</div>' +
      '<section class="comments" id="comments" aria-labelledby="com-h"><h2 id="com-h" class="sec-h">التعليقات</h2><div id="com-list"><p class="muted">جارٍ تحميل التعليقات…</p></div>' +
        '<p class="com-act"><a class="btn" target="_blank" rel="noopener" href="' + esc(p.url) + '#respond">اكتب تعليقًا</a>' +
        '<span class="muted">تُكتب التعليقات على المدونة الأصلية وتظهر هنا تلقائيًا.</span></p></section>' +
      '<nav class="pn" aria-label="مقالات أخرى">' +
        (newer ? '<a class="pn-a" href="' + url({ p: newer.id }) + '" data-link><span class="muted">الأحدث</span><span' + (newer.en ? ' dir="ltr" lang="en"' : '') + '>' + esc(newer.title) + '</span></a>' : '<span></span>') +
        (older ? '<a class="pn-a end" href="' + url({ p: older.id }) + '" data-link><span class="muted">الأقدم</span><span' + (older.en ? ' dir="ltr" lang="en"' : '') + '>' + esc(older.title) + '</span></a>' : '<span></span>') +
      '</nav></article>';
    main.innerHTML = html;
    var prose = document.getElementById('prose');
    while (bodyRoot.firstChild) prose.appendChild(document.adoptNode(bodyRoot.firstChild));
    if (p.cats.indexOf('كتيبات') >= 0) { var fbx = prose.querySelector('.filebox .btn'); if (fbx) fbx.textContent = 'تحميل الكتيب (PDF)'; }
    if (!prose.textContent.trim() && !prose.querySelector('img,a,iframe')) prose.innerHTML = '<p class="muted">لا يوجد نص لهذا المقال هنا. <a href="' + esc(p.url) + '" target="_blank" rel="noopener">افتحه على المدونة الأصلية</a>.</p>';
    var cp = document.getElementById('copy');
    cp.addEventListener('click', function () {
      var done = function () { cp.textContent = 'تم نسخ الرابط'; setTimeout(function () { cp.textContent = 'نسخ الرابط'; }, 2000); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(location.href).then(done, function () {});
    });
    loadComments(p);
  }

  function loadComments(p) {
    var box = document.getElementById('com-list');
    getJSON(API + '/posts/' + p.id + '/replies/?number=100&order=ASC').then(function (j) {
      if (!document.getElementById('com-list') || currentPost !== p.id) return;
      var all = j.comments || [];
      if (!all.length) { box.innerHTML = '<p class="muted">لا توجد تعليقات على هذا المقال بعد.</p>'; return; }
      var kids = {}, tops = [], ids = {};
      all.forEach(function (c) { ids[c.ID] = 1; });
      all.forEach(function (c) {
        var par = c.parent && c.parent.ID && ids[c.parent.ID] ? c.parent.ID : 0;
        if (par) (kids[par] = kids[par] || []).push(c); else tops.push(c);
      });
      var one = function (c, depth) {
        var name = (c.author && c.author.name) || 'زائر';
        if (c.type && c.type !== 'comment') { /* إشارة تلقائية من مقال آخر */
          var href = (c.author && c.author.URL) || '', lp = postByUrl(href);
          var t = textOf(name) || 'مقال آخر';
          return '<li class="com ping"><p class="com-h"><span class="muted">إشارة من مقال آخر:</span> ' +
            (lp ? '<a href="' + url({ p: lp.id }) + '" data-link>' + esc(lp.title) + '</a>'
                : /^https?:\/\//.test(href) ? '<a href="' + esc(href) + '" target="_blank" rel="noopener nofollow ugc" dir="auto">' + esc(t) + '</a>' : '<span dir="auto">' + esc(t) + '</span>') +
            ' <span class="muted">' + esc(fmtDate(String(c.date).slice(0, 10))) + '</span></p>' +
            (kids[c.ID] ? '<ul class="coms sub">' + kids[c.ID].map(function (k) { return one(k, depth + 1); }).join('') + '</ul>' : '') + '</li>';
        }
        var body = cleanContent(c.content, true);
        return '<li class="com"><p class="com-h"><span class="com-av" aria-hidden="true">' + esc(name.trim().charAt(0) || '؟') + '</span>' +
          '<strong dir="auto">' + esc(name) + '</strong><span class="muted">' + esc(fmtDate(String(c.date).slice(0, 10))) + '</span></p>' +
          '<div class="com-b">' + body.innerHTML + '</div>' +
          (kids[c.ID] ? '<ul class="coms sub">' + kids[c.ID].map(function (k) { return one(k, depth + 1); }).join('') + '</ul>' : '') + '</li>';
      };
      document.getElementById('com-h').textContent = 'التعليقات (' + num(all.length) + ')';
      box.innerHTML = '<ul class="coms">' + tops.map(function (c) { return one(c, 0); }).join('') + '</ul>';
    }).catch(function () {
      if (document.getElementById('com-list')) box.innerHTML = '<p class="muted">تعذّر تحميل التعليقات الآن. <a href="' + esc(p.url) + '#comments" target="_blank" rel="noopener">اقرأها على المدونة الأصلية</a>.</p>';
    });
  }

  /* ---------- صفحات أخرى ---------- */
  function renderQuotes() {
    document.title = 'اقتباسات — ' + C.name;
    main.innerHTML = '<section class="page"><h1 class="page-h">اقتباسات</h1>' +
      (S.quotes.length ? '<ul class="qlist">' + S.quotes.map(function (q, i) {
        var en = isLatin(q.t), pal = PAL[i % PAL.length];
        return '<li class="q" style="--cbg:' + pal.bg + ';--cfg:' + pal.fg + '"><blockquote' + (en ? ' dir="ltr" lang="en"' : '') + '>' + esc(q.t) + '</blockquote>' +
          (q.p ? '<p class="q-src">من <a href="' + url({ p: q.p.id }) + '" data-link>«' + esc(q.p.title) + '»</a></p>' : '') + '</li>';
      }).join('') + '</ul>' : '<p class="empty">لا توجد اقتباسات بعد.</p>') + '</section>';
  }
  function renderAbout() {
    var pg = aboutPage();
    if (!pg) return renderHome({});
    document.title = 'عن الكاتب — ' + C.name;
    main.innerHTML = '<section class="page"><h1 class="page-h">عن الكاتب</h1><div class="prose" id="prose"></div></section>';
    var root = cleanContent(pg.content), prose = document.getElementById('prose');
    while (root.firstChild) prose.appendChild(document.adoptNode(root.firstChild));
  }
  function renderError() {
    main.innerHTML = '<section class="page"><h1 class="page-h">تعذّر تحميل المقالات</h1>' +
      '<p class="empty">لم نتمكن من الوصول إلى المدونة الآن. تحقّق من اتصالك ثم <a href="' + location.href + '">أعد المحاولة</a>، أو اقرأ المقالات على <a href="https://' + C.wp + '/">المدونة الأصلية</a>.</p></section>';
  }

  /* ---------- التوجيه ---------- */
  var currentPost = 0;
  function params() {
    var o = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var i = kv.indexOf('='), k = i < 0 ? kv : kv.slice(0, i), v = i < 0 ? '' : kv.slice(i + 1);
      try { o[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) {}
    });
    return o;
  }
  function route(opts) {
    if (!S.ready) return;
    var q = params();
    currentPost = 0;
    document.body.className = '';
    if (q.p && S.byId[q.p]) { currentPost = +q.p; document.body.className = 'is-post'; renderPost(S.byId[q.p], q.lang); }
    else if (q.v === 'quotes') renderQuotes();
    else if (q.v === 'about') renderAbout();
    else renderHome(q);
    markNav(q);
    onScroll();
    if (opts && opts.keep) return;
    if (location.hash && location.hash.length > 1) { jump(location.hash.slice(1)); return; }
    if (opts && opts.nav) { window.scrollTo(0, 0); main.focus({ preventScroll: true }); }
  }
  function markNav(q) {
    var links = document.querySelectorAll('.nav a');
    for (var i = 0; i < links.length; i++) {
      var h = links[i].getAttribute('href'), on = false;
      if (/v=quotes/.test(h)) on = q.v === 'quotes';
      else if (/v=about/.test(h)) on = q.v === 'about';
      else if (/[?&]c=/.test(h)) on = q.c === 'كتيبات';
      else if (/v=articles/.test(h)) on = !q.p && q.c !== 'كتيبات' && (q.v === 'articles' || !!q.c || !!q.y || !!q.t);
      if (on) links[i].setAttribute('aria-current', 'page'); else links[i].removeAttribute('aria-current');
    }
  }
  function go(href, replace) {
    if (replace) history.replaceState(null, '', href); else history.pushState(null, '', href);
    route({ nav: true });
  }
  function jump(id) {
    var t = null;
    try { t = document.getElementById(id) || document.querySelector('[name="' + id.replace(/"/g, '') + '"]'); } catch (e) {}
    if (t) { t.scrollIntoView({ block: 'start' }); }
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest ? e.target.closest('a') : null;
    if (a) {
      var href = a.getAttribute('href') || '';
      if (href.charAt(0) === '#' && href.length > 1) { e.preventDefault(); try { jump(decodeURIComponent(href.slice(1))); } catch (er) { jump(href.slice(1)); } return; }
      if (a.hasAttribute('data-link') && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) {
        e.preventDefault(); closeSearch();
        var keepList = a.classList.contains('chip');
        if (keepList) { history.pushState(null, '', href); route({ keep: true }); var h = document.getElementById('articles'); if (h && h.getBoundingClientRect().top < 0) h.scrollIntoView(); }
        else go(href);
        return;
      }
    }
    var v = e.target.closest ? e.target.closest('[data-view]') : null;
    if (v) { S.view = v.getAttribute('data-view'); store('ya.view', S.view); route({ keep: true }); return; }
    if (e.target.id === 'qn') showQuote(true);
  });
  window.addEventListener('popstate', function () { route({ nav: false }); });

  /* ---------- شريط تقدّم القراءة ---------- */
  var bar = document.getElementById('progress');
  function onScroll() {
    if (!currentPost) { bar.style.transform = 'scaleX(0)'; return; }
    var pr = document.getElementById('prose');
    if (!pr) return;
    var r = pr.getBoundingClientRect(), total = r.height - window.innerHeight * 0.6;
    var done = Math.min(1, Math.max(0, (-r.top + window.innerHeight * 0.2) / (total > 0 ? total : 1)));
    bar.style.transform = 'scaleX(' + done + ')';
  }
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- الوضع الداكن ---------- */
  document.getElementById('btn-theme').addEventListener('click', function () {
    var el = document.documentElement, cur = el.getAttribute('data-theme');
    if (!cur) cur = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var next = cur === 'dark' ? 'light' : 'dark';
    el.setAttribute('data-theme', next); store('ya.theme', next);
  });

  /* ---------- البحث ---------- */
  var sBox = document.getElementById('search'), qIn = document.getElementById('q'), res = document.getElementById('results'), lastFocus = null;
  function openSearch() { lastFocus = document.activeElement; sBox.hidden = false; qIn.value = ''; res.innerHTML = ''; qIn.focus(); }
  function closeSearch() { if (sBox.hidden) return; sBox.hidden = true; if (lastFocus && lastFocus.focus) lastFocus.focus(); }
  function normAr(s) {
    return s.toLowerCase().replace(/[ً-ْٰـ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه');
  }
  function doSearch() {
    var q = normAr(qIn.value.trim());
    if (q.length < 2) { res.innerHTML = ''; return; }
    var hits = [];
    S.posts.forEach(function (p) {
      if (!p._n) p._n = normAr(p.title + ' \n ' + p.text);
      var at = p._n.indexOf(q);
      if (at >= 0) hits.push({ p: p, inTitle: at < p.title.length });
    });
    hits.sort(function (a, b) { return (b.inTitle - a.inTitle) || (a.p.i - b.p.i); });
    res.innerHTML = hits.length
      ? '<p class="muted">' + countLabel(hits.length, 'نتيجة واحدة', 'نتيجتان', 'نتائج', 'نتيجة') + '</p><ul class="rows">' + hits.map(function (h) {
          var p = h.p;
          return '<li class="row"><a class="row-title" href="' + url({ p: p.id }) + '" data-link' + (p.en ? ' dir="ltr" lang="en"' : '') + '>' + esc(p.title) + '</a><span class="row-meta">' + esc(fmtDate(p.d)) + '</span></li>';
        }).join('') + '</ul>'
      : '<p class="muted">لا توجد نتائج لهذه الكلمة. جرّب كلمة أخرى.</p>';
  }
  document.getElementById('btn-search').addEventListener('click', openSearch);
  document.getElementById('search-close').addEventListener('click', closeSearch);
  sBox.addEventListener('click', function (e) { if (e.target === sBox) closeSearch(); });
  qIn.addEventListener('input', doSearch);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closeSearch();
    else if (e.key === '/' && sBox.hidden && !/^(INPUT|TEXTAREA)$/.test((document.activeElement || {}).tagName || '')) { e.preventDefault(); openSearch(); }
  });

  /* ---------- التشغيل ---------- */
  S.view = read('ya.view') === 'list' ? 'list' : 'cards';
  try { localStorage.removeItem('ya.data.v1'); } catch (e) {}
  var cached = null;
  try { cached = JSON.parse(read(CACHE_KEY) || 'null'); } catch (e) { cached = null; }
  if (cached && cached.posts && cached.posts.length) { setData(cached.posts, cached.pages || []); route({ nav: false }); }

  Promise.all([fetchAllPosts(), fetchPages()]).then(function (r) {
    var sig = function (posts) { return posts.map(function (p) { return p.ID + ':' + (p.modified || '') + ':' + ((p.discussion || {}).comment_count || 0) + ':' + (p.featured_image || ''); }).join('|'); };
    var changed = !cached || !cached.posts || sig(cached.posts) !== sig(r[0]) || (cached.pages || []).length !== r[1].length;
    store(CACHE_KEY, JSON.stringify({ t: Date.now(), posts: r[0], pages: r[1] }));
    if (!S.ready || (changed && !currentPost)) {
      var y = window.scrollY;
      setData(r[0], r[1]); route({ nav: false, keep: !!cached });
      if (cached) window.scrollTo(0, y);
    } else if (changed) {
      var cur = currentPost; setData(r[0], r[1]); currentPost = cur;
    }
  }).catch(function () { if (!S.ready) renderError(); });
})();
