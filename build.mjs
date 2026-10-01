// يجهّز صفحة ثابتة لكل مقال (لمعاينة الروابط ومحركات البحث) ونسخة محفوظة من البيانات.
// يشتغل داخل GitHub Actions، ولا يغيّر شيئًا في المدونة الأصلية: قراءة فقط.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read = (f) => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const config = read('./config.js');
const appJs = read('./app.js');
const WP = /wp:\s*'([^']+)'/.exec(config)[1];
const NAME = /name:\s*'([^']+)'/.exec(config)[1];
const FIELDS = /var FIELDS = '([^']+)'/.exec(appJs)[1];
const SITE = (process.env.SITE_URL || 'https://yahyaahmedmahmoud.github.io').replace(/\/$/, '');
const API = `https://public-api.wordpress.com/rest/v1.1/sites/${WP}`;
const MOCK = process.env.MOCK_DIR || '';
const OUT = process.env.OUT_DIR || '.';
const out = (name, value) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`); console.log(`${name}=${value}`); };

async function getJSON(url, mockFile) {
  if (MOCK) return JSON.parse(fs.readFileSync(`${MOCK}/${mockFile}`, 'utf8'));
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { 'user-agent': 'yahyaahmed-site-build' } });
      if (r.ok) return await r.json();
    } catch (e) { /* retry */ }
    await new Promise((res) => setTimeout(res, 3000 * (i + 1)));
  }
  throw new Error('fetch failed: ' + url);
}

const NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', laquo: '«', raquo: '»', ndash: '–', mdash: '—', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”' };
function text(html) {
  return String(html || '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in NAMED ? NAMED[n.toLowerCase()] : m))
    .replace(/[\s ]+/g, ' ')
    .trim();
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

let posts = [], pages = [];
try {
  for (let page = 1; page <= 20; page++) {
    const j = await getJSON(`${API}/posts/?number=100&page=${page}&fields=${FIELDS}`, 'posts.json');
    posts = posts.concat(j.posts || []);
    if (MOCK || !(j.posts || []).length || posts.length >= j.found) break;
  }
  pages = (await getJSON(`${API}/posts/?type=page&number=50&fields=ID,title,slug,content,URL`, 'pages.json')).posts || [];
} catch (e) {
  // تعذّر الوصول إلى ووردبريس الآن: لا ننشر شيئًا ونترك الموقع كما هو
  console.log('WordPress unreachable, skipping this run:', e.message);
  out('changed', 'false');
  process.exit(0);
}
if (!posts.length) { console.log('no posts returned, skipping'); out('changed', 'false'); process.exit(0); }

// هل تغيّر شيء منذ آخر نشر؟
const sources = ['index.html', 'app.js', 'style.css', 'config.js', '404.html', 'build.mjs'].map((f) => read('./' + f)).join('\n');
const hash = crypto.createHash('sha256').update(SITE + '\n' + sources + '\n' + JSON.stringify(posts) + JSON.stringify(pages)).digest('hex');
let live = '';
if (!MOCK) { try { const r = await fetch(`${SITE}/build.txt?t=${Date.now()}`); if (r.ok) live = (await r.text()).trim(); } catch (e) { /* first deploy */ } }
const changed = process.env.FORCE === '1' || live !== hash;
out('changed', String(changed));
if (!changed) process.exit(0);

const index = read('./index.html');
const defaultDesc = /<meta name="description" content="([^"]*)"/.exec(index)[1];
function page({ title, desc, image, path, type, body }) {
  let h = index
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${esc(title)}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${esc(desc)}$2`)
    .replace(/(<meta property="og:type" content=")[^"]*(")/, `$1${type}$2`)
    .replace(/(<meta property="og:image" content=")[^"]*(")/, `$1${esc(image)}$2`)
    .replace('<meta name="theme-color"', `<meta property="og:url" content="${SITE}${path}">\n<link rel="canonical" href="${SITE}${path}">\n<meta name="theme-color"`);
  if (body) h = h.replace(/<p class="loading" role="status">[\s\S]*?<\/p>/, body);
  return h;
}

fs.mkdirSync(OUT, { recursive: true });
const urls = [`${SITE}/`];
for (const p of posts) {
  const title = text(p.title) || 'بلا عنوان';
  let desc = text(p.excerpt).replace(/\s*\[?(…|\.\.\.)\]?\s*$/, '');
  if (desc.length > 220) desc = desc.slice(0, 217).replace(/\s+\S*$/, '') + '…';
  if (!desc) desc = defaultDesc;
  const image = typeof p.featured_image === 'string' && p.featured_image ? p.featured_image : `${SITE}/og.png`;
  const path = `/p/${p.ID}/`;
  const body = `<article class="page"><h1 class="page-h">${esc(title)}</h1><p class="empty">${esc(desc)}</p><p class="loading" role="status">جارٍ تحميل المقال…</p></article>`;
  fs.mkdirSync(`${OUT}/p/${p.ID}`, { recursive: true });
  fs.writeFileSync(`${OUT}/p/${p.ID}/index.html`, page({ title: `${title} — ${NAME}`, desc, image, path, type: 'article', body }));
  urls.push(`${SITE}${path}`);
}
fs.writeFileSync(`${OUT}/index.html`, page({ title: NAME, desc: defaultDesc, image: `${SITE}/og.png`, path: '/', type: 'website' }));
fs.writeFileSync(`${OUT}/data.json`, JSON.stringify({ t: Date.now(), posts, pages }));
fs.writeFileSync(`${OUT}/sitemap.xml`, `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${u}</loc></url>`).join('\n')}\n</urlset>\n`);
fs.writeFileSync(`${OUT}/robots.txt`, `User-agent: *\nAllow: /\nSitemap: ${SITE}/sitemap.xml\n`);
fs.writeFileSync(`${OUT}/build.txt`, hash + '\n');
console.log(`built ${posts.length} article pages for ${SITE}`);
