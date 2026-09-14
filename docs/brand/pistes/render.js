const fs = require('fs');
const { W, PISTES } = require('./symboles.js');

/** L'enclos vu d'en haut : un contenant carré dont un côté s'ouvre — la porte. */
function penPath() {
  const a = 240, b = 784, r = 96, gap = 150; // ouverture centrée sur le côté haut
  return (
    `M ${512 + gap} ${a} H ${b - r} A ${r} ${r} 0 0 1 ${b} ${a + r} ` +
    `V ${b - r} A ${r} ${r} 0 0 1 ${b - r} ${b} H ${a + r} ` +
    `A ${r} ${r} 0 0 1 ${a} ${b - r} V ${a + r} A ${r} ${r} 0 0 1 ${a + r} ${a} H ${512 - gap}`
  );
}

/** Trois bâtons et la barre qui ferme le groupe — la marque de compte, partout la même. */
function tallyPaths() {
  const top = 288, bot = 736;
  return [
    `M 336 ${top} V ${bot}`,
    `M 512 ${top} V ${bot}`,
    `M 688 ${top} V ${bot}`,
    // La barre de fermeture, franchement oblique : horizontale, elle deviendrait une rature.
    `M 256 ${bot - 96} L 768 ${top + 96}`,
  ];
}

function svg(p, color = '#000', bg = null) {
  const parts = [];
  if (bg) parts.push(`<rect width="1024" height="1024" fill="${bg}"/>`);
  const s = `stroke="${color}" stroke-width="${W}" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  if (p.path) parts.push(`<path d="${p.path}" ${s}/>`);
  if (p.openPen) parts.push(`<path d="${penPath()}" ${s}/>`);
  if (p.tally) tallyPaths().forEach((d) => parts.push(`<path d="${d}" ${s}/>`));
  (p.arcs || []).forEach((d) => parts.push(`<path d="${d}" ${s}/>`));
  if (p.ring) parts.push(`<circle cx="${p.ring.cx}" cy="${p.ring.cy}" r="${p.ring.r}" ${s}/>`);
  if (p.dot) parts.push(`<circle cx="${p.dot.cx}" cy="${p.dot.cy}" r="${p.dot.r}" fill="${color}"/>`);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">${parts.join('')}</svg>`;
}

module.exports = { svg, penPath };

if (require.main === module) {
  PISTES.forEach((p) => fs.writeFileSync(`${__dirname}/${p.id}.svg`, svg(p)));
  const card = (p) => `
  <section class="piste">
    <h2>${p.nom}</h2>
    <div class="row">
      <div class="big">${svg(p)}</div>
      <div class="sizes">
        ${[64, 32, 16].map((n) => `<div class="s"><div style="width:${n}px;height:${n}px">${svg(p)}</div><span>${n} px</span></div>`).join('')}
      </div>
      <div class="s"><div class="inv">${svg(p, '#fff')}</div><span>fond sombre</span></div>
    </div>
    <p class="intent">${p.intention}</p>
  </section>`;
  fs.writeFileSync(`${__dirname}/index.html`, `<!doctype html><meta charset="utf-8"><title>Jawdi — trois pistes</title>
<style>
 body{font-family:Outfit,-apple-system,sans-serif;max-width:56rem;margin:0 auto;padding:2.5rem 1.5rem;background:#fff;color:#292524;line-height:1.5}
 h1{font-size:1.6rem;font-weight:600;margin:0 0 .3rem}
 .lede{color:#57534E;margin:0 0 2rem;max-width:44rem}
 .piste{border-top:2px solid #292524;padding-top:1rem;margin-top:2rem}
 h2{font-size:1.15rem;font-weight:600;margin:0 0 1rem}
 .row{display:flex;gap:2.2rem;align-items:center;flex-wrap:wrap}
 .big{width:152px;height:152px;flex:none}
 .sizes{display:flex;gap:1.5rem;align-items:flex-end}
 .s{display:flex;flex-direction:column;align-items:center;gap:.45rem}
 .s span{font-family:ui-monospace,monospace;font-size:.64rem;color:#78716C}
 .inv{width:64px;height:64px;background:#1C1917;border-radius:12px;padding:8px;box-sizing:border-box}
 .intent{color:#57534E;font-size:.94rem;max-width:44rem;margin:1rem 0 0}
 svg{display:block;width:100%;height:100%}
</style>
<h1>Jawdi — trois pistes de symbole</h1>
<p class="lede">Étape 1 du cahier des charges : noir et blanc, jugées à 16 px avant toute couleur. Un symbole peut être magnifique isolé et illisible dans une barre de 60 px.</p>
${PISTES.map(card).join('')}`);
  console.log('planche régénérée');
}
