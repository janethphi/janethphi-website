/**
 * JanethPhi — build de blog estático (cero dependencias)
 * En cada deploy de Netlify:
 *  1. Lee posts/*.md (creados desde el CMS en /admin)
 *  2. Genera blog/<slug>.html con schema Article (indexable por Google)
 *  3. Inyecta las tarjetas del blog en index.html (entre BLOG:START y BLOG:END)
 *  4. Regenera posts.json y sitemap.xml
 */
import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SITE = 'https://janethphi.netlify.app';
const ROOT = new URL('.', import.meta.url).pathname;
const POSTS_DIR = join(ROOT, 'posts');
const BLOG_DIR = join(ROOT, 'blog');
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

if (!existsSync(BLOG_DIR)) mkdirSync(BLOG_DIR);

/* ---------- frontmatter ---------- */
function parseFrontmatter(raw) {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (kv) meta[kv[1]] = kv[2].replace(/^["']|["']$/g, '');
  }
  return { meta, body: m[2].trim() };
}

/* ---------- markdown mínimo (headers, bold, italic, links, listas, párrafos) ---------- */
function esc(s){ return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function inline(s){
  return esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}
function mdToHtml(md) {
  const blocks = md.split(/\r?\n\r?\n+/);
  return blocks.map(b => {
    b = b.trim();
    if (!b) return '';
    const im = b.match(/^!\[([^\]]*)\]\(([^)\s]+)\)$/);
    if (im) return `<figure><img src="${im[2]}" alt="${esc(im[1])}" loading="lazy"><figcaption>${esc(im[1])}</figcaption></figure>`;
    if (b.startsWith('### ')) return `<h3>${inline(b.slice(4))}</h3>`;
    if (b.startsWith('## '))  return `<h2>${inline(b.slice(3))}</h2>`;
    if (b.startsWith('# '))   return `<h2>${inline(b.slice(2))}</h2>`;
    if (/^[-*] /m.test(b)) {
      const items = b.split(/\r?\n/).filter(l => /^[-*] /.test(l)).map(l => `<li>${inline(l.slice(2))}</li>`).join('');
      return `<ul>${items}</ul>`;
    }
    return `<p>${inline(b.replace(/\r?\n/g, ' '))}</p>`;
  }).join('\n');
}

/* ---------- plantilla de artículo ---------- */
function articlePage(p) {
  const d = new Date(p.date);
  const dateStr = `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  const iso = d.toISOString().slice(0, 10);
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(p.title)} | JanethPhi</title>
<meta name="description" content="${esc(p.excerpt)}">
<link rel="canonical" href="${SITE}/blog/${p.slug}.html">
<link rel="icon" type="image/png" href="/imagenes/favicon.png">
<meta property="og:type" content="article">
<meta property="og:title" content="${esc(p.title)}">
<meta property="og:description" content="${esc(p.excerpt)}">
<meta property="og:url" content="${SITE}/blog/${p.slug}.html">
<meta property="og:image" content="${SITE}/imagenes/og-image.jpg">
<meta property="og:locale" content="es_MX">
<meta name="twitter:card" content="summary_large_image">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Jost:wght@300;400;500&display=swap" rel="stylesheet">
<style>
  :root{--ink:#0B0A08;--card:#17140F;--ivory:#F4EFE7;--ivory-70:rgba(244,239,231,.75);--muted:#9A948A;--gold:#C9A84C;--gold-soft:#E3C87E;--line:rgba(201,168,76,.22);--line-soft:rgba(201,168,76,.13)}
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:var(--ink);color:var(--ivory);font-family:'Jost',sans-serif;font-weight:300;font-size:1.05rem;line-height:1.85}
  :focus-visible{outline:2px solid var(--gold);outline-offset:3px}
  a{color:var(--gold-soft)}
  nav{display:flex;align-items:center;justify-content:space-between;padding:1rem clamp(1.25rem,5vw,4.5rem);border-bottom:1px solid var(--line-soft)}
  nav img{height:44px;width:auto;display:block}
  nav a.back{font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:var(--ivory-70);text-decoration:none}
  nav a.back:hover{color:var(--gold-soft)}
  article{max-width:70ch;margin:0 auto;padding:clamp(3rem,7vw,5rem) 1.5rem 4rem}
  .cat{font-size:.75rem;letter-spacing:.28em;text-transform:uppercase;color:var(--gold)}
  h1{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:clamp(2.1rem,5vw,3.2rem);line-height:1.15;margin:1rem 0}
  .meta{font-size:.85rem;color:var(--muted);padding-bottom:2rem;border-bottom:1px solid var(--line-soft);margin-bottom:2.5rem}
  .content p{margin-bottom:1.4rem;color:var(--ivory-70)}
  .content h2{font-family:'Cormorant Garamond',serif;font-weight:500;font-size:1.9rem;line-height:1.25;margin:2.6rem 0 1rem;color:var(--ivory)}
  .content h3{font-family:'Cormorant Garamond',serif;font-weight:600;font-size:1.4rem;margin:2rem 0 .8rem;color:var(--gold-soft)}
  .content ul{margin:0 0 1.4rem 1.2rem;color:var(--ivory-70)}
  .content li{margin-bottom:.5rem}
  .content strong{color:var(--ivory);font-weight:500}
  .content figure{margin:2.2rem 0}
  .content figure img{width:100%;display:block}
  .content figcaption{font-size:.8rem;color:var(--muted);margin-top:.7rem;text-align:center}
  .cta{margin-top:3rem;border:1px solid var(--line);padding:2.2rem;text-align:center;background:var(--card)}
  .cta p{color:var(--ivory-70);margin-bottom:1.4rem}
  .btn{display:inline-block;background:linear-gradient(120deg,var(--gold),var(--gold-soft));color:var(--ink);text-decoration:none;padding:1rem 2.2rem;border-radius:2px;font-size:.8rem;font-weight:500;letter-spacing:.16em;text-transform:uppercase}
  footer{border-top:1px solid var(--line-soft);padding:2rem 1.5rem;text-align:center;font-size:.78rem;color:var(--muted)}
  footer a{color:var(--muted);text-decoration:none}
</style>
</head>
<body>
<nav>
  <a href="/" aria-label="JanethPhi — inicio"><img src="/imagenes/logo.png" alt="JanethPhi"></a>
  <a class="back" href="/#blog">⟵ Volver al sitio</a>
</nav>
<article>
  <span class="cat">${esc(p.category)}</span>
  <h1>${esc(p.title)}</h1>
  <p class="meta">Por Janeth — Especialista certificada Phi Academy · ${dateStr}</p>
  <div class="content">
${p.html}
  </div>
  <div class="cta">
    <p>¿Quieres una valoración personalizada de tu caso?</p>
    <a class="btn" href="https://wa.me/526632020133?text=${encodeURIComponent('Hola Janeth, leí tu artículo "' + p.title + '" y tengo una pregunta')}" target="_blank" rel="noopener">Escríbeme por WhatsApp</a>
  </div>
</article>
<footer>© ${new Date().getFullYear()} JanethPhi · <a href="/">janethphi.netlify.app</a> · Tijuana, B.C.</footer>
<script type="application/ld+json">
${JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: p.title,
  description: p.excerpt,
  datePublished: iso,
  dateModified: iso,
  inLanguage: 'es-MX',
  mainEntityOfPage: `${SITE}/blog/${p.slug}.html`,
  image: `${SITE}/imagenes/og-image.jpg`,
  author: { '@type': 'Person', name: 'Janeth', jobTitle: 'Especialista en micropigmentación certificada por Phi Academy', url: SITE },
  publisher: { '@type': 'Organization', name: 'JanethPhi', logo: { '@type': 'ImageObject', url: `${SITE}/imagenes/logo.png` } }
}, null, 2)}
</script>
</body>
</html>`;
}

/* ---------- pipeline ---------- */
const posts = readdirSync(POSTS_DIR)
  .filter(f => f.endsWith('.md'))
  .map(f => {
    const { meta, body } = parseFrontmatter(readFileSync(join(POSTS_DIR, f), 'utf8'));
    const slug = f.replace(/\.md$/, '').replace(/^\d{4}-\d{2}-\d{2}-/, '');
    return {
      slug,
      title: meta.title || slug,
      date: meta.date || '2026-01-01',
      excerpt: meta.excerpt || '',
      category: meta.category || 'General',
      html: mdToHtml(body)
    };
  })
  .sort((a, b) => new Date(b.date) - new Date(a.date));

for (const p of posts) {
  writeFileSync(join(BLOG_DIR, `${p.slug}.html`), articlePage(p));
  console.log(`✓ blog/${p.slug}.html`);
}

/* tarjetas del home */
const cards = posts.map(p => {
  const d = new Date(p.date);
  const dateStr = `${MESES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return `    <a class="post-card rv" href="/blog/${p.slug}.html">
      <span class="post-cat">${esc(p.category)}</span>
      <h3>${esc(p.title)}</h3>
      <p>${esc(p.excerpt)}</p>
      <div class="post-foot"><span class="post-date">${dateStr}</span><span class="post-link">Leer guía ⟶</span></div>
    </a>`;
}).join('\n');

const indexPath = join(ROOT, 'index.html');
let index = readFileSync(indexPath, 'utf8');
index = index.replace(/<!--BLOG:START-->[\s\S]*?<!--BLOG:END-->/, `<!--BLOG:START-->\n${cards}\n    <!--BLOG:END-->`);
writeFileSync(indexPath, index);
console.log('✓ tarjetas inyectadas en index.html');

/* posts.json (compatibilidad) */
writeFileSync(join(ROOT, 'posts.json'), JSON.stringify({ posts: posts.map(({ html, ...r }) => r) }, null, 2));

/* sitemap */
const urls = [`${SITE}/`, ...posts.map(p => `${SITE}/blog/${p.slug}.html`)];
writeFileSync(join(ROOT, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc></url>`).join('\n')}
</urlset>`);
console.log(`✓ sitemap.xml (${urls.length} URLs)`);
