// Wohnnetto in 3D: das echte Logo, die gelbe Kachel mit dem Haus.
// Beim Scrollen erzählt es den Weg einer Wohnung zur fertigen Anlage V:
// Belege fliegen ungeordnet herum, wandern in die Kachel, das Haus hebt sich ab und
// rechnet, ein Prüfring der Kanzlei schließt sich, am Ende steigt die Anlage V auf.
import * as THREE from 'three';

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;
const GELB = 0xffd23f, TINTE = 0x111111;

// Zustände je Abschnitt (Reihenfolge wie die Abschnitte in index.html)
// x, y: Lage in Bildbreiten-Einheiten, s: Größe, ry/rx: Drehung,
// spread: Belege verstreut, absorb: Belege in der Kachel, lift: Haus hebt ab,
// bars: Rechenbalken, seal: Prüfring, sheet: Anlage V, rings: drei Bahnen, glow: Leuchten
const ST = {
  x:      [ 2.55, 2.5, 2.45, -2.5, 2.5, -2.5, 2.45, 2.75, 2.55, 3.4, 0.0 ],
  y:      [ 0.05, 0.0, 0.0, 0.0, 0.0, 0.0, -0.2, 0.1, 0.0, 1.55, 2.2 ],
  s:      [ 1.0, 0.95, 0.95, 0.95, 0.95, 0.95, 0.9, 0.75, 0.85, 0.55, 0.5 ],
  ry:     [ -0.42, -0.5, -0.62, 0.55, -0.35, 0.42, -0.3, -0.75, -0.5, -0.3, 0.0 ],
  rx:     [ 0.12, 0.15, 0.25, 0.1, 0.05, 0.08, 0.06, 0.2, 0.1, 0.1, 0.05 ],
  spread: [ 0, 0, 1, 0.4, 0, 0, 0, 0, 0, 0, 0 ],
  absorb: [ 0, 0, 0, 0.55, 1, 1, 1, 1, 1, 1, 1 ],
  lift:   [ 0, 0.55, 0, 0, 1, 0.7, 0.15, 0, 0, 0, 0 ],
  bars:   [ 0, 1, 0, 0, 1, 0.2, 0, 0, 0, 0, 0 ],
  seal:   [ 0, 0, 0, 0, 0, 1, 0.35, 0, 0.2, 0, 0 ],
  sheet:  [ 0, 0, 0, 0, 0, 0, 1, 0.25, 0, 0, 0 ],
  rings:  [ 0, 0, 0, 0, 0, 0, 0, 0, 1, 0.3, 0 ],
  glow:   [ 0.25, 0.6, 0.1, 0.3, 0.7, 0.6, 0.8, 0.4, 0.5, 0.3, 0.9 ],
  // Textspalte: 0 = schmale Spalte (560 px), 1 = breite Liste (54% der Breite)
  wide:   [ 1, 0.1, 0.1, 0, 0, 0, 0, 1, 0, 0, 0 ]
};
const LAST = ST.x.length - 1;
function at(key, story) {
  const a = ST[key], s = clamp(story, 0, LAST), i = Math.floor(s), f = s - i;
  return i >= LAST ? a[LAST] : lerp(a[i], a[i + 1], ease(f));
}

// Abgerundetes Quadrat wie im Logo (44er Raster, Radius 12)
function kachelForm(g, r) {
  const s = new THREE.Shape(), h = g / 2;
  s.moveTo(-h + r, -h); s.lineTo(h - r, -h); s.quadraticCurveTo(h, -h, h, -h + r);
  s.lineTo(h, h - r); s.quadraticCurveTo(h, h, h - r, h); s.lineTo(-h + r, h);
  s.quadraticCurveTo(-h, h, -h, h - r); s.lineTo(-h, -h + r); s.quadraticCurveTo(-h, -h, -h + r, -h);
  return s;
}

// Linienzug aus Zylindern mit runden Gelenken, Punkte im 44er Logo-Raster
function linienzug(punkte, groesse, radius, mat) {
  const g = new THREE.Group(), p = punkte.map(([x, y]) => new THREE.Vector3((x - 22) / 44 * groesse, -(y - 22) / 44 * groesse, 0));
  const kugel = new THREE.SphereGeometry(radius, 20, 12);
  for (let i = 0; i < p.length; i++) {
    const k = new THREE.Mesh(kugel, mat); k.position.copy(p[i]); g.add(k);
    if (i === 0) continue;
    const a = p[i - 1], b = p[i], len = a.distanceTo(b);
    const z = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 20, 1, true), mat);
    z.position.copy(a).add(b).multiplyScalar(0.5);
    z.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    g.add(z);
  }
  return g;
}

function blattTextur(zeilen, kopf) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 332;
  const x = c.getContext('2d');
  x.fillStyle = '#F7F5EE'; x.fillRect(0, 0, 256, 332);
  x.fillStyle = '#FFD23F'; x.fillRect(22, 24, kopf, 16);
  x.fillStyle = '#C9C5B8';
  for (let i = 0; i < zeilen; i++) x.fillRect(22, 62 + i * 22, 140 + ((i * 53) % 70), 7);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  return t;
}

function anlageTextur() {
  const c = document.createElement('canvas'); c.width = 600; c.height = 780;
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  const zeichnen = () => {
    const x = c.getContext('2d'), f = '"Schibsted Grotesk", Arial, sans-serif';
    x.fillStyle = '#FAF8F2'; x.fillRect(0, 0, 600, 780);
    x.fillStyle = '#111'; x.font = '800 54px ' + f; x.fillText('Anlage V 2026', 44, 92);
    x.fillStyle = '#7A7468'; x.font = '500 24px ' + f; x.fillText('Beispiel, geprüft von der Kanzlei', 44, 132);
    const z = [['Mieteinnahmen', '10.200 €'], ['Abschreibung', '−6.936 €'], ['Schuldzinsen', '−10.920 €'], ['Nicht umlegbare Kosten', '−1.764 €']];
    x.font = '500 28px ' + f;
    z.forEach((r, i) => {
      const y = 212 + i * 66;
      x.fillStyle = '#E4E0D6'; x.fillRect(44, y + 22, 512, 2);
      x.fillStyle = '#2A2A2A'; x.textAlign = 'left'; x.fillText(r[0], 44, y);
      x.textAlign = 'right'; x.fillText(r[1], 556, y); x.textAlign = 'left';
    });
    x.fillStyle = '#111'; x.font = '800 30px ' + f; x.fillText('Ergebnis', 44, 500);
    x.textAlign = 'right'; x.fillText('−9.420 €', 556, 500); x.textAlign = 'left';
    x.fillStyle = '#FFD23F'; x.beginPath(); x.roundRect(44, 560, 512, 160, 28); x.fill();
    x.fillStyle = '#111'; x.font = '600 26px ' + f; x.fillText('Mehr netto über den Freibetrag', 76, 612);
    x.font = '800 58px ' + f; x.fillText('+330 € im Monat', 76, 688);
    t.needsUpdate = true;
  };
  zeichnen();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(zeichnen);
  return t;
}

// Leichte Umgebung für Spiegelungen, ohne externe Datei
function umgebung(renderer) {
  const s = new THREE.Scene();
  s.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20), new THREE.MeshBasicMaterial({ color: 0x1a1a1a, side: THREE.BackSide })));
  const licht = (w, h, pos, c) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: c, side: THREE.DoubleSide })); m.position.copy(pos); m.lookAt(0, 0, 0); s.add(m); };
  licht(8, 3, new THREE.Vector3(-5, 6, 6), 0xffffff);
  licht(4, 8, new THREE.Vector3(7, 1, -2), 0xfff1c4);
  licht(10, 2, new THREE.Vector3(0, -7, 3), 0x5a4a1a);
  const pm = new THREE.PMREMGenerator(renderer);
  const env = pm.fromScene(s, 0.02).texture; pm.dispose();
  return env;
}

export function createScene(canvas, opts) {
  const { reduced, coarse, viewportHeight } = opts;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene = new THREE.Scene();
  scene.environment = umgebung(renderer);
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 0, 11);

  scene.add(new THREE.AmbientLight(0xffffff, 0.25));
  const key = new THREE.DirectionalLight(0xfff6e0, 2.2); key.position.set(-4, 5, 6); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd23f, 1.6); rim.position.set(5, 1, -4); scene.add(rim);
  const unten = new THREE.PointLight(0xffd23f, 0, 9, 2); unten.position.set(0, -2, 2); scene.add(unten);

  const rig = new THREE.Group(); scene.add(rig);
  const logo = new THREE.Group(); rig.add(logo);

  // Kachel
  const G = 2.2, TIEFE = 0.34;
  const kGeo = new THREE.ExtrudeGeometry(kachelForm(G - 0.2, 0.52), { depth: TIEFE, bevelEnabled: true, bevelThickness: 0.1, bevelSize: 0.1, bevelSegments: 8, curveSegments: 28 });
  kGeo.center();
  const kMat = new THREE.MeshPhysicalMaterial({ color: GELB, roughness: 0.32, metalness: 0.02, clearcoat: 1, clearcoatRoughness: 0.18, emissive: GELB, emissiveIntensity: 0.0 });
  const kachel = new THREE.Mesh(kGeo, kMat); logo.add(kachel);
  const vorn = TIEFE / 2 + 0.1 + 0.02;

  // Haus und Plus aus dem Logo
  const hMat = new THREE.MeshStandardMaterial({ color: TINTE, roughness: 0.38, metalness: 0.1, emissive: 0xfff6dc, emissiveIntensity: 0 });
  const haus = new THREE.Group();
  haus.add(linienzug([[11, 23], [22, 13], [33, 23]], G, 0.085, hMat));
  haus.add(linienzug([[15, 21], [15, 31], [29, 31], [29, 21]], G, 0.085, hMat));
  haus.add(linienzug([[22, 23.5], [22, 29]], G, 0.07, hMat));
  haus.add(linienzug([[19.25, 26.25], [24.75, 26.25]], G, 0.07, hMat));
  haus.position.z = vorn; logo.add(haus);

  // Belege
  const belege = [], bGeo = new THREE.PlaneGeometry(0.62, 0.8);
  const tex = [blattTextur(9, 90), blattTextur(7, 120), blattTextur(11, 70)];
  for (let i = 0; i < 16; i++) {
    const m = new THREE.Mesh(bGeo, new THREE.MeshStandardMaterial({ map: tex[i % 3], roughness: 0.75, side: THREE.DoubleSide, transparent: true }));
    const w = (i / 16) * Math.PI * 2 + (i % 3) * 0.4;
    m.userData = { w, r: 1.75 + (i * 37 % 10) / 10 * 0.85, y: ((i * 53) % 20) / 10 - 1, sp: 0.15 + (i % 5) * 0.04, rot: new THREE.Euler((i * 0.7) % 1.2 - 0.6, w, (i * 1.3) % 1 - 0.5), d: i / 16 };
    rig.add(m); belege.push(m);
  }

  // Rechenbalken im Kreis
  const balken = [], baMat = new THREE.MeshStandardMaterial({ color: GELB, emissive: GELB, emissiveIntensity: 0.6, roughness: 0.4, transparent: true });
  for (let i = 0; i < 30; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.07, 1, 0.07), baMat);
    const w = i / 30 * Math.PI * 2; b.userData = { w, p: (i * 7) % 11 / 11 };
    b.position.set(Math.cos(w) * 2.0, -1.25, Math.sin(w) * 2.0);
    rig.add(b); balken.push(b);
  }

  // Prüfring mit Haken
  const sMat = new THREE.MeshStandardMaterial({ color: GELB, emissive: GELB, emissiveIntensity: 1.2, roughness: 0.3 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.75, 0.035, 12, 160, Math.PI * 2), sMat);
  rig.add(ring);
  const haken = linienzug([[14, 23], [20, 29], [31, 16]], 1.6, 0.06, sMat);
  haken.position.set(0, 1.85, 0.3); rig.add(haken);

  // Anlage V
  const blatt = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 2.275), new THREE.MeshStandardMaterial({ map: anlageTextur(), roughness: 0.6, side: THREE.DoubleSide, transparent: true }));
  rig.add(blatt);

  // Drei Bahnen: Kanzleiwahl, getrennte Zahlungen, Daten in Frankfurt
  const bahnen = [];
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Group();
    const r = new THREE.Mesh(new THREE.TorusGeometry(1.7 + i * 0.2, 0.012, 8, 200), new THREE.MeshBasicMaterial({ color: GELB, transparent: true, opacity: 0.5 }));
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 12), sMat);
    p.position.x = 1.7 + i * 0.2; r.add(p);
    t.add(r); t.rotation.set(Math.PI / 2 + (i - 1) * 0.55, (i - 1) * 0.6, 0);
    rig.add(t); bahnen.push({ t, r, p, k: i });
  }

  let w = 1, h = 1, aspect = 1, mobil = false;
  const zeiger = { x: 0, y: 0, tx: 0, ty: 0 };
  if (!coarse) addEventListener('pointermove', e => { zeiger.tx = e.clientX / innerWidth - 0.5; zeiger.ty = e.clientY / innerHeight - 0.5; }, { passive: true });

  function relayout() {
    w = innerWidth; h = viewportHeight();
    aspect = w / h; mobil = w < 760;
    renderer.setSize(w, h, false);
    canvas.style.height = h + 'px';
    camera.aspect = aspect; camera.updateProjectionMatrix();
  }
  relayout();

  let t = 0;
  function render(story, dt, over) {
    t += reduced ? 0 : dt;
    zeiger.x += (zeiger.tx - zeiger.x) * 0.06; zeiger.y += (zeiger.ty - zeiger.y) * 0.06;
    const breite = Math.min(1, aspect / 1.7);
    const sp = at('spread', story), ab = at('absorb', story), li = at('lift', story), ba = at('bars', story);
    const se = at('seal', story), sh = at('sheet', story), ri = at('rings', story), gl = at('glow', story);

    // Lage der ganzen Szene
    // Logo in die Mitte des freien Platzes neben der Textspalte setzen
    const halbB = Math.tan(THREE.MathUtils.degToRad(16)) * 11 * aspect;
    const rand = Math.min(64, Math.max(20, w * 0.04));
    const spalte = lerp(Math.min(560, w * 0.6), w * 0.54, at('wide', story)) + rand + 24;
    const frei = Math.max(0.2, (w - spalte) / w * 2 * halbB);
    const mitteFrei = halbB - frei / 2;
    const xt = at('x', story);
    let x = Math.sign(xt) * Math.min(Math.abs(xt) * breite, mitteFrei), y = at('y', story);
    let s = at('s', story) * clamp(frei / 4.6, 0.55, 1);
    if (Math.abs(xt) < 0.01) x = 0;
    if (mobil) { x = 0; y = 1.55 + (story > LAST - 0.5 ? 0.35 : 0); s = at('s', story) * 0.68; }
    rig.position.set(x, y + over * 6.3 + Math.sin(t * 0.8) * 0.05, 0);
    rig.scale.setScalar(s);
    logo.rotation.set(at('rx', story) + zeiger.y * 0.25 + Math.sin(t * 0.5) * 0.03, at('ry', story) + zeiger.x * 0.45 + Math.sin(t * 0.35) * 0.1, 0);

    // Haus hebt ab und leuchtet
    haus.position.z = vorn + li * 1.5;
    haus.scale.setScalar(1 + li * 0.35);
    hMat.color.setRGB(lerp(0.067, 1.0, li), lerp(0.067, 0.98, li), lerp(0.067, 0.92, li));
    hMat.emissiveIntensity = li * 0.9;
    kMat.emissiveIntensity = gl * 0.06;
    unten.intensity = gl * 6;

    // Belege: verstreut kreisen, dann in die Kachel
    belege.forEach(m => {
      const u = m.userData, wink = u.w + t * u.sp;
      const zuruck = clamp((ab - u.d * 0.6) / 0.4);
      const r = lerp(u.r * (0.85 + sp * 0.25), 0, ease(zuruck));
      m.position.set(Math.cos(wink) * r, lerp(u.y * (0.6 + sp), 0, zuruck), Math.sin(wink) * r * 0.6 + 0.2);
      m.rotation.set(u.rot.x + t * 0.2 * u.sp, wink + Math.PI / 2, u.rot.z);
      const sichtbar = Math.max(sp, ab > 0.001 && ab < 0.999 ? 1 : 0) * (1 - ease(zuruck));
      m.scale.setScalar(Math.max(0.001, sichtbar));
      m.visible = sichtbar > 0.01;
    });

    // Rechenbalken
    balken.forEach(b => {
      const u = b.userData, hoch = ba * (0.25 + 0.75 * Math.abs(Math.sin(t * 1.6 + u.p * 9)));
      b.scale.y = Math.max(0.001, hoch * 1.3);
      b.position.y = -1.25 + b.scale.y / 2;
      b.visible = ba > 0.01;
    });
    baMat.opacity = ba;

    // Prüfring schließt sich, Haken wird gezeichnet
    ring.visible = se > 0.01;
    const bogen = Math.round(ease(clamp(se * 1.15)) * 100) / 100;
    if (ring.visible && bogen !== ring.userData.bogen) {
      ring.userData.bogen = bogen;
      ring.geometry.dispose();
      ring.geometry = new THREE.TorusGeometry(1.75, 0.035, 10, 120, Math.max(0.01, Math.PI * 2 * bogen));
    }
    ring.rotation.set(0.15, -0.2, Math.PI / 2 + t * 0.15);
    haken.visible = se > 0.55;
    haken.scale.setScalar(ease(clamp((se - 0.55) / 0.45)));

    // Anlage V steigt hinter der Kachel auf
    blatt.visible = sh > 0.01;
    blatt.position.set(lerp(0, 0.55, sh), lerp(-0.4, 1.05, ease(sh)), lerp(-0.6, 0.75, ease(sh)));
    blatt.rotation.set(-0.08, -0.32 + Math.sin(t * 0.6) * 0.04, 0.05);
    blatt.scale.setScalar(Math.max(0.001, ease(sh)));
    blatt.material.opacity = clamp(sh * 1.6);

    // Bahnen
    bahnen.forEach(b => {
      b.r.visible = ri > 0.01;
      b.r.material.opacity = ri * 0.55;
      b.r.scale.setScalar(Math.max(0.001, lerp(0.4, 1, ease(ri))));
      b.r.rotation.z = t * (0.35 + b.k * 0.12) + b.k * 2;
    });

    renderer.render(scene, camera);
  }

  const ready = new Promise(res => {
    try { if (renderer.compileAsync) renderer.compileAsync(scene, camera).then(res, res); else { renderer.compile(scene, camera); res(); } } catch (e) { res(); }
  });
  return { render, relayout, ready, debug: { ST } };
}
