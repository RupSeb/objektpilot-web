// Seitenlogik: Scrollposition wird zur Position in der Geschichte, die die 3D-Szene steuert.
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const sections = [...document.querySelectorAll('main .s')];
const railLabel = document.getElementById('railLabel');
const railBar = document.getElementById('railBar');
const rail = document.querySelector('.rail');

// Am Handy ändert die Adressleiste die Höhe. Gemessen wird gegen die größte Höhe,
// damit Geschichte und Bild beim Scrollen ruhig bleiben.
const probe = document.createElement('div');
probe.style.cssText = 'position:fixed;top:0;left:0;width:0;height:100vh;height:100lvh;visibility:hidden;pointer-events:none';
document.body.appendChild(probe);
const stableHeight = () => (coarse ? Math.max(probe.offsetHeight, innerHeight) : innerHeight);
let viewH = innerHeight, lastW = innerWidth, docH = 0, centres = [];
function measure() {
  viewH = stableHeight();
  centres = sections.map((el, i) => {
    const r = el.getBoundingClientRect(), top = r.top + scrollY;
    if (i === 0) return 0;
    if (i === sections.length - 1) return Math.max(0, top + r.height - viewH);
    return top + r.height / 2 - viewH / 2;
  });
  docH = document.documentElement.scrollHeight;
  if (scene) scene.relayout();
}
function storyAt(y) {
  if (y <= centres[0]) return 0;
  for (let i = 0; i < centres.length - 1; i++) if (y < centres[i + 1]) return i + (y - centres[i]) / (centres[i + 1] - centres[i]);
  return centres.length - 1;
}

// Texte blenden beim Erreichen ein
const io = new IntersectionObserver(es => {
  for (const e of es) if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
document.querySelectorAll('.reveal').forEach(el => {
  const geschw = [...el.parentElement.children].filter(c => c.classList.contains('reveal'));
  el.style.transitionDelay = (0.09 * Math.max(0, geschw.indexOf(el))) + 's';
  io.observe(el);
});

// Weiches Scrollen nur mit Mausrad, Touch bleibt nativ
let lenis = null;
if (!reduced && !coarse && globalThis.Lenis) lenis = new globalThis.Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
  const ziel = document.querySelector(a.getAttribute('href'));
  if (!ziel) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(ziel, { offset: 0, duration: 1.6 }); else ziel.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}));

let scene = null;
const fertig = () => { document.body.classList.remove('is-loading'); document.body.classList.add('ready'); };
const failSafe = setTimeout(fertig, 1100);

measure();
addEventListener('resize', () => { if (coarse && innerWidth === lastW) return; lastW = innerWidth; measure(); });
addEventListener('load', measure);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

let story = storyAt(scrollY), last = performance.now(), lastLabel = -1;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (lenis) lenis.raf(now);
  const target = storyAt(scrollY);
  story = reduced ? target : story + (target - story) * (1 - Math.exp(-dt * 5.5));
  const idx = Math.min(sections.length - 1, Math.round(target));
  if (idx !== lastLabel) { railLabel.textContent = sections[idx].dataset.label; lastLabel = idx; }
  railBar.style.transform = `scaleX(${target / (sections.length - 1)})`;
  rail.classList.toggle('off', sections[idx].dataset.rail === 'off' || scrollY + innerHeight > docH - 180);
  const over = Math.max(0, scrollY - centres[centres.length - 1]) / viewH;
  if (scene && !document.hidden) scene.render(story, dt, over);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// 3D ist eine Zugabe: ohne WebGL bleibt die Seite vollständig lesbar.
import('./scene.js?v=3')
  .then(m => {
    const created = m.createScene(document.getElementById('scene'), { reduced, coarse, viewportHeight: stableHeight });
    return created.ready.then(() => {
      scene = created; created.relayout();
      document.getElementById('scene').classList.add('on');
      clearTimeout(failSafe); fertig();
    });
  })
  .catch(err => {
    console.warn('3D nicht verfügbar:', err);
    document.documentElement.classList.add('no-webgl');
    clearTimeout(failSafe); fertig();
  });
