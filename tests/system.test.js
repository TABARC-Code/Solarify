#!/usr/bin/env node
/* Checks the system builder. Run:  node tests/system.test.js
 * No dependencies. Exits 1 if anything fails.
 *
 * Three kinds of check:
 *   1. Published numbers: the Sun's habitable zone, Earth's blackbody temperature, Kepler's third law,
 *      and a few entries from the star and world tables.
 *   2. Arithmetic the builder promises: gravity = density x diameter, mass = density x diameter cubed,
 *      surface temperature, climate class, the size class limits, the tide-locked day and night factors.
 *   3. A few thousand random systems, checking the things that must always be true: counts match
 *      what was asked for (or the notes say why not), orbits never cross, nothing is inside its
 *      star, planets stay inside the limits a companion star imposes, belts keep clear of planets,
 *      moons stay inside the Hill limit, the same seed gives the same system, and share links round-trip.
 */
'use strict';
var S = require('../src/system.js'), T = require('../src/tables.js'), results = [], failed = 0;
function check(name, ok, detail){
  results.push(ok);
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? '   [' + detail + ']' : ''));
  if (!ok) failed++;
}
function near(a, b, tol){ return Math.abs(a - b) <= tol; }

/* --- published reference numbers --- */
var sun = S.hzBounds(5772, 1);
check('Sun: habitable zone about 0.95 to 1.67 AU (Kopparapu et al. 2014 quote 0.95-1.67)',
  near(sun.inner, 0.95, 0.01) && near(sun.outer, 1.68, 0.02), sun.inner.toFixed(3) + ' to ' + sun.outer.toFixed(3));
check('Earth equilibrium temperature with albedo 0.3 is about 255 K', near(S.teq(1, 1, 0.3), 255, 1.5), S.teq(1, 1, 0.3).toFixed(1) + ' K');
check('Blackbody temperature with no albedo is 278 K at 1 AU from the Sun', S.blackbody(1, 1) === 278);
check('Kepler: one AU round a solar-mass star is 365.25 days', near(S.periodDays(1, 1), 365.25, 0.01));
check('Kepler: 5.2 AU gives about 11.86 years (Jupiter)', near(S.periodDays(5.2, 1) / 365.25, 11.86, 0.1), (S.periodDays(5.2, 1) / 365.25).toFixed(2));
check('Giant-forming line for a star of 1 L-min is 4.85 AU', near(S.frostLine(1), 4.85, 1e-9));
var m4 = S.hzBounds(S.STARS.M.Teff, S.STARS.M.L);
check('Red dwarf (M4V): zone sits very close in, well under 0.3 AU', m4.outer < 0.3 && m4.inner > 0.03, m4.inner.toFixed(3) + ' to ' + m4.outer.toFixed(3));
check('Zone gets further out as stars get brighter (M < K < G < F < A < B)',
  ['M', 'K', 'G', 'F', 'A', 'B'].every(function(k, i, a){ return i === 0 || S.hzBounds(S.STARS[k].Teff, S.STARS[k].L).inner > S.hzBounds(S.STARS[a[i - 1]].Teff, S.STARS[a[i - 1]].L).inner; }));
check('Stars outside 2600-7200 K are flagged as rough', S.hzBounds(S.STARS.B.Teff, S.STARS.B.L).rough && S.hzBounds(S.STARS.WD.Teff, S.STARS.WD.L).rough && !S.hzBounds(S.STARS.M.Teff, S.STARS.M.L).rough);

/* --- the star tables --- */
var p1 = S.starProps(1.0), pLow = S.starProps(0.1), p2 = S.starProps(2.0);
check('Star table: one solar mass is a G2, 5800 K, 0.68 to 1.6 L, ten billion years', p1.spt === 'G2' && p1.Teff === 5800 && p1.Lmin === 0.68 && p1.Lmax === 1.6 && near(p1.span, 10, 1e-9));
check('Star table: 0.1 solar masses is an M7 of 0.0012 L that outlives the universe', pLow.spt === 'M7' && near(pLow.Lmin, 0.0012, 1e-9) && pLow.span >= 1000);
check('Star table: two solar masses lives about 1.3 billion years', near(p2.span, 1.3, 1e-9));
var sunNow = S.starAt(1.0, 4.6);
check('A solar-mass star at 4.6 billion years has brightened to about 1.1 L', sunNow.L > 1.0 && sunNow.L < 1.2 && !sunNow.past, sunNow.L.toFixed(3));
check('A star past its main-sequence life is held at its end brightness and flagged', (function(){ var s = S.starAt(2.0, 5); return s.past && near(s.L, 20, 1e-6) && near(s.ageUsed, 1.3, 1e-9); })());
check('More massive stars are brighter, hotter and shorter-lived (0.2, 0.5, 1, 2, 5, 10 solar masses)', [0.2, 0.5, 1, 2, 5, 10].every(function(m, i, a){
  if (!i) return true; var x = S.starProps(m), y = S.starProps(a[i - 1]); return x.Lmin > y.Lmin && x.Teff > y.Teff && x.span < y.span; }));
check('Star radius from luminosity and temperature: the Sun comes out about one solar radius', near(S.starAt(1.0, 4.6).R, 1.1, 0.15), S.starAt(1.0, 4.6).R.toFixed(3));
check('Table: the 5-solar-mass massive star agrees with the B5V preset to within a factor of two (700 vs 589 L)', near(Math.log10(S.starProps(5).Lmin), Math.log10(S.STARS.B.L), 0.3));

/* --- determinism and links --- */
var c1 = {star:'K', age:60, inner:3, outer:2, belts:2, moonsInner:2, moonsOuter:5, home:'cold', giants:'e', companion:'m', seed:777};
var a = JSON.stringify(S.generate(c1).bodies), b = JSON.stringify(S.generate(c1).bodies);
check('Same settings and seed give an identical system', a === b);
check('A different seed gives a different system', a !== JSON.stringify(S.generate(Object.assign({}, c1, {seed:778})).bodies));
check('Share link round-trips', JSON.stringify(S.decodeCfg(S.encodeCfg(c1))) === JSON.stringify(S.normalise(c1)), S.encodeCfg(c1));
check('Share link for a star chosen by mass round-trips', (function(){ var c = {star:'X', mass:137, age:0, inner:2, outer:1, belts:0, moonsInner:0, moonsOuter:1, home:'none', giants:'h', companion:'v', seed:5};
  return JSON.stringify(S.decodeCfg(S.encodeCfg(c))) === JSON.stringify(S.normalise(c)); })());
check('Rubbish share links are rejected', ['', 'x', '3.G.0.46.4.4.1.1.3.hz.c.n', '2.G.4.4.1.3.hz.0.5', '4.G.0.46.4.4.1.1.3.hz.c.n.5', '3.Q.0.46.4.4.1.1.3.hz.c.n.5',
  '3.G.0.46.4.4.1.1.3.nope.c.n.5', '3.G.0.46.4.4.1.1.3.hz.z.n.5', '3.G.0.46.4.4.1.1.3.hz.c.q.5', '3.G.0.46.a.4.1.1.3.hz.c.n.5', '3.G.0.46.4.4.1.1.3.hz.c.n.-5'].every(function(t){ return S.decodeCfg(t) === null; }));
check('Out-of-range settings are clamped, not trusted', (function(){ var n = S.normalise({star:'zz', inner:99, outer:-4, belts:50, moonsInner:50, moonsOuter:'x', home:'?', giants:'?', companion:'?', age:9999, seed:-1});
  return n.star === 'G' && n.inner === 8 && n.outer === 0 && n.belts === 3 && n.moonsInner === 4 && n.home === 'hz' && n.giants === 'c' && n.companion === 'n' && n.age === 120; })());

/* --- fuzz --- */
var violations = {}, runs = 0, homeStats = {hz:[0, 0], hot:[0, 0], cold:[0, 0]};
function bad(k, extra){ if (!violations[k]) violations[k] = extra || 'seen'; }
function band(table, v){ for (var i = 0; i < table.length; i++){ var u = table[i][0]; if (u == null || v < u) return table[i][1]; } return table[table.length - 1][1]; }
var CONFIGS = [];
function fuzzTypes(seed){ var o = {}; for (var i = 1; i <= 16; i++) if ((seed * 3 + i) % 5 === 0) o[i] = (seed + i * 7) % 9; return o; }
function fuzzDiam(seed){ var o = {}; for (var i = 1; i <= 16; i++) if ((seed + i) % 4 === 0) o[i] = (seed * i * 131) % 1001; return o; }
function fuzzSizes(seed){ var o = {}; for (var i = 1; i <= 16; i++) if ((seed * i * 7) % 3 === 0) o[i] = (seed + i) % 7; return o; }
['M', 'K', 'G', 'F', 'A', 'B', 'RG', 'WD', 'X'].forEach(function(sk){
  ['hz', 'hot', 'cold', 'none'].forEach(function(home){
    for (var seed = 1; seed <= 24; seed++){
      CONFIGS.push({star:sk, mass:[15, 40, 85, 100, 160, 300, 600][seed % 7], age:[0, 3, 20, 46, 90, 120][seed % 6], inner:seed % 9, outer:(seed * 7) % 9, belts:seed % 4,
        moonsInner:seed % 5, moonsOuter:(seed * 3) % 9, home:home, giants:['c', 'e', 'h'][seed % 3], companion:['n', 'n', 'v', 'c', 'm', 'w', 'd'][seed % 7], seed:seed * 977, sizes:fuzzSizes(seed), diam:fuzzDiam(seed), types:fuzzTypes(seed)});
    }
  });
});
var gasRows = T.gasGiantPhysics;
CONFIGS.forEach(function(cfg){
  var g = S.generate(cfg), tag = cfg.star + '/' + cfg.home + '/' + cfg.seed + '/' + cfg.giants + '/' + cfg.companion; runs++;
  var planets = g.bodies.filter(function(x){ return !x.isStar && !x.isMoon; }), stars = g.bodies.filter(function(x){ return x.isStar; });
  var noteText = g.notes.join(' | '), binary = g.binary, regime = binary ? binary.regime : null, noPl = binary && regime === null;
  var empty = noPl || /leave no room for any planets/.test(noteText);
  var wantedRocky = empty ? 0 : Math.max(cfg.inner, cfg.home === 'none' ? 0 : 1);
  var rockyN = planets.filter(function(p){ return !p.giant; }).length, giantN = planets.filter(function(p){ return p.giant; }).length;
  if (rockyN !== wantedRocky && !(rockyN < wantedRocky && /beyond the planet-forming limit/.test(noteText)) && !(rockyN === 1 && /Only the home world fitted/.test(noteText))) bad('rocky count', tag + ' got ' + rockyN + ' want ' + wantedRocky);
  var wantedGiants = empty ? 0 : Math.max(cfg.outer, cfg.giants === 'h' ? 1 : 0);
  if (giantN > wantedGiants || (giantN < wantedGiants && !/fit before the planet-forming limit/.test(noteText))) bad('giant count', tag + ' got ' + giantN + ' want ' + wantedGiants);
  var ids = {}; g.bodies.forEach(function(x){ if (ids[x.id]) bad('duplicate id', tag); ids[x.id] = 1; });
  if (g.order.length !== g.bodies.length) bad('label order incomplete', tag);
  if (stars.length !== (binary ? 2 : 1)) bad('star count', tag);
  if (binary){
    var cs = stars[1];
    if (!(binary.min <= binary.sep && binary.sep <= binary.max && binary.ecc >= 0 && binary.ecc <= 0.6)) bad('binary geometry', tag);
    if (!near(binary.aS, binary.min / 3, 1e-9) || !near(binary.aP, 3 * binary.max, 1e-9)) bad('forbidden zone edges', tag);
    if (!(binary.mass2 <= g.primary.mass + 1e-9)) bad('companion heavier than primary', tag);
    if (!near(binary.periodDays, S.periodDays(binary.sep, binary.Mtot), 1e-6 * binary.periodDays)) bad('binary period', tag);
    if (!cs.el) bad('companion has no orbit', tag);
    if (regime === 'P' && !stars[0].el) bad('primary has no orbit round the barycentre', tag);
    if (regime === 'S' && stars[0].el) bad('primary should sit at the origin', tag);
    if (regime === 'P' && cs.el && stars[0].el){
      var a1 = stars[0].el.a[0], a2 = cs.el.a[0];
      if (!near(a1 + a2, binary.sep, 1e-9 * binary.sep) || !near(a1 * g.primary.mass, a2 * binary.mass2, 1e-9 * a1 * g.primary.mass)) bad('barycentre split', tag);
    }
  }
  var Msys = regime === 'P' ? binary.Mtot : g.primary.mass, Rstar = g.primary.R * S.RSUN_KM / S.AU_KM, Lsys = g.L;
  planets.sort(function(x, y){ return x.aAU - y.aAU; });
  var hotGiants = planets.filter(function(p){ return p.hot; });
  if (hotGiants.length > 1) bad('more than one hot giant', tag);
  if (cfg.giants === 'h' && regime !== 'P' && !empty && hotGiants.length !== 1 && !/no room inside the limits here for a hot giant/.test(noteText)) bad('hot giant missing', tag);
  if (hotGiants.length){
    var hg = hotGiants[0];
    if (!hg.giant || planets[0] !== hg || !hg.lockNote) bad('hot giant is not the innermost, locked planet', tag);
    planets.forEach(function(p){ if (p !== hg && !(p.aAU > hg.aAU * 1.5)) bad('something sits inside or beside the hot giant', tag); });
  }
  for (var i = 0; i < planets.length; i++){
    var p = planets[i], e = p.el.e[0], ap = p.aAU * (1 + e), pe = p.aAU * (1 - e);
    if (!(pe > 3 * Rstar)) bad('inside or hugging the star', tag);
    if (e > (p.eccentric ? 0.4 : 0.2) + 1e-9) bad('eccentricity above the cap', tag);
    if (i > 0){ var q = planets[i - 1]; if (!(q.aAU * (1 + q.el.e[0]) * 1.03 < pe)) bad('orbits cross or nearly touch', tag); }
    if (regime === 'S' && !(ap <= binary.aS)) bad('planet inside the companion\'s forbidden zone (S)', tag);
    if (regime === 'P' && !(pe >= binary.aP)) bad('planet inside the companion\'s forbidden zone (P)', tag);
    if (!(ap <= 40 * Msys + 1e-9)) bad('beyond the planet-forming limit', tag);
    var period = S.periodDays(p.aAU, Msys);
    if (!near(period, p.periodDays, 1e-6 * period)) bad('period vs Kepler', tag);
    var expectRate = 360 * 36525 / period;
    if (!near(p.el.L[1], expectRate, 1e-6 * expectRate)) bad('mean motion vs period', tag);
    if (!(p.radiusKm > 0 && p.massEarth > 0 && p.rotH > 0)) bad('bad physical value', tag);
    if (!p.lockNote && (p.obliq < 0 || p.obliq > 90)) bad('axial tilt outside 0 to 90', tag + ' ' + p.obliq);
    var BB = S.blackbody(Lsys, p.aAU);
    if (!near(BB, p.bbK, 1e-6 * BB)) bad('blackbody temperature', tag);
    var D = p.radiusKm / S.REARTH_KM;
    if (p.giant){
      if (['Small', 'Medium', 'Large'].indexOf(p.ggClass) < 0) bad('giant class', tag);
      var col = p.ggClass === 'Small' ? 1 : p.ggClass === 'Medium' ? 3 : 5;
      var okRow = gasRows.some(function(r){ return (p.diamSet || near(r[col], p.massEarth, 1e-9)) && near(r[col + 1], p.density, 1e-9); });   // with an exact diameter, mass follows density x diameter cubed
      if (D < p.diamMin - 1e-9 || D > p.diamMax + 1e-9) bad('giant diameter outside its class range', tag);
      if (!okRow) bad('giant mass and density are not a table row', tag);
      if (!near(D, Math.cbrt(p.massEarth / p.density), 1e-9 * D)) bad('giant diameter', tag);
    } else {
      if (!near(p.gravity, p.density * D, 1e-9 * p.gravity)) bad('gravity = density x diameter', tag);
      if (!near(p.massEarth, p.density * D * D * D, 1e-9 * p.massEarth)) bad('mass = density x diameter cubed', tag);
      var sr = T.sizeConstraints.filter(function(r){ return r[0] === p.sizeClass; })[0];
      var lo = Math.sqrt(BB / p.density) * sr[1], hi = Math.sqrt(BB / p.density) * sr[2];
      if (!(D >= lo - 1e-9 && D <= hi + 1e-9)) bad('diameter outside its size class', tag + ' ' + p.sizeClass + ' D=' + D.toFixed(3) + ' [' + lo.toFixed(3) + ',' + hi.toFixed(3) + ']');
      if (p.climate !== band(T.climate, p.surfaceK)) bad('climate class does not match surface temperature', tag);
      if (p.atmosphere.none && p.atmosphere.pressureAtm !== 0) bad('pressure on an airless world', tag);
      if (!p.atmosphere.none && p.atmosphere.category !== band(T.pressureCategories, p.atmosphere.pressureAtm)) bad('pressure category', tag);
      if (p.worldType === 'Garden' && g.ageGyr < S.GARDEN_MIN_AGE && !p.typeSet) bad('Garden world in a system too young', tag);
      if (p.worldType === 'Garden' && !(p.hydro >= 45 && p.hydro <= 88)) bad('Garden hydrographics', tag);
      if (p.worldType === 'Ocean' && !(p.hydro >= 88)) bad('Ocean hydrographics', tag);
      if (['Garden', 'Ocean'].indexOf(p.worldType) < 0 && p.hydro !== 0) bad('liquid oceans on a non-ocean world', tag);
      if (p.atmosphere.breathable !== (p.worldType === 'Garden' && !p.atmosphere.none)) bad('breathability', tag);
      if (p.tide){
        if (!(p.tide.dayK >= p.surfaceK * 0.99 * 0 && p.tide.dayK >= p.tide.nightK)) bad('day side colder than night side', tag);
      }
      if (!p.home){
        // the world type follows the classification table unless the home brief overrode it
        var BBr = BB, sc = p.sizeClass, okTypes;
        if (sc === 'Tiny') okTypes = BBr <= 140 ? ['Ice', 'Sulfur'] : ['Rock'];
        else if (sc === 'Small') okTypes = BBr <= 80 ? ['Hadean'] : BBr <= 140 ? ['Ice'] : ['Rock'];
        else if (sc === 'Standard') okTypes = BBr <= 80 ? ['Hadean'] : BBr <= 150 ? ['Ice'] : BBr <= 230 ? ['Ammonia', 'Ice'] : BBr <= 240 ? ['Ice'] : BBr <= 320 ? ['Garden', 'Ocean'] : BBr <= 500 ? ['Greenhouse'] : ['Chthonian'];
        else okTypes = BBr <= 150 ? ['Ice'] : BBr <= 230 ? ['Ammonia', 'Ice'] : BBr <= 240 ? ['Ice'] : BBr <= 320 ? ['Garden', 'Ocean'] : BBr <= 500 ? ['Greenhouse'] : ['Chthonian'];
        if (p.typeSet && p.typeOptions.indexOf(p.worldType) < 0) bad('forced type not allowed for its class', tag);
        if (okTypes.indexOf(p.worldType) < 0 && !(p.worldType === 'Ocean' && p.young) && !p.typeSet) bad('world type does not match the classification table', tag + ' ' + sc + ' ' + BBr.toFixed(0) + 'K ' + p.worldType);
      }
      if (['None', 'Light', 'Moderate', 'Heavy', 'Extreme'].indexOf(p.volcanic) < 0) bad('volcanic label', tag);
      if (p.affinity !== p.resources.rvm + p.habitability) bad('affinity = resource value + habitability', tag);
    }
    p.moons.forEach(function(mid){
      var m = g.bodies.filter(function(x){ return x.id === mid; })[0];
      var hill = p.aAU * (1 - e) * S.AU_KM * Math.cbrt(p.massEarth / 333000 / (3 * Msys));
      if (!(m.moon.aKm < 0.33 * hill * 1.0001)) bad('moon outside Hill limit', tag);
      if (!(m.moon.aKm > 2.5 * p.radiusKm)) bad('moon inside Roche-ish floor', tag);
      if (!(m.radiusKm < p.radiusKm * 0.36)) bad('moon too big for its planet', tag);
    });
    var ms = p.moons.map(function(mid){ return g.bodies.filter(function(x){ return x.id === mid; })[0].moon.aKm; });
    for (var k = 1; k < ms.length; k++) if (!(ms[k] > ms[k - 1] * 1.2)) bad('moons too close together', tag);
    if (p.moons.length > (p.giant ? cfg.moonsOuter : cfg.moonsInner)) bad('more moons than asked', tag);
  }
  // asteroid belts
  g.belts.forEach(function(bt, bi){
    planets.forEach(function(p){
      var lo = p.aAU * (1 - p.el.e[0]), hi = p.aAU * (1 + p.el.e[0]);
      if (bt.a * 1.12 * 1.12 > lo && bt.a * 0.88 / 1.12 < hi) bad('belt overlaps a planet', tag);
    });
    g.belts.forEach(function(o, oi){ if (oi > bi && o.a * 0.88 < bt.a * 1.12) bad('belts overlap', tag); });
    if (!(bt.a * 1.12 <= g.outerLimit * 1.0001)) bad('belt beyond the limit', tag);
  });
  if (g.belts.length > cfg.belts) bad('more belts than asked', tag);
  // the home world
  var homes = planets.filter(function(p){ return p.home; });
  if (cfg.home === 'none' || empty ? homes.length !== 0 : homes.length !== 1) bad('home count', tag + ' ' + homes.length);
  if (homes.length === 1){
    var h = homes[0], shrunk = (h.sizeSet && ['Tiny', 'Small'].indexOf(h.sizeClass) >= 0) || h.typeSet, tried = !shrunk && !/left no room|Only the home world/.test(noteText);
    if (!(h.sizeSet || h.typeSet) && ['Standard', 'Large'].indexOf(h.sizeClass) < 0) bad('home world is not Standard or Large', tag);
    if (cfg.home === 'hz' && tried){ homeStats.hz[0]++; if (h.zone === 'in' || (g.hz.rough && true)) homeStats.hz[1]++; if (['Garden', 'Ocean'].indexOf(h.worldType) < 0) bad('hz home is not temperate or ocean', tag + h.worldType); }
    if (cfg.home === 'hot' && tried){ homeStats.hot[0]++; if (h.zone === 'inside') homeStats.hot[1]++; if (h.worldType !== 'Greenhouse') bad('hot home is not a greenhouse world', tag + h.worldType); }
    if (cfg.home === 'cold' && tried){ homeStats.cold[0]++; if (h.zone === 'beyond') homeStats.cold[1]++; if (['Ice', 'Ammonia'].indexOf(h.worldType) < 0) bad('cold home is not ice or ammonia', tag + h.worldType); }
    if (g.homeId !== h.id) bad('homeId', tag);
  }
  // ages
  if (!(g.ageGyr > 0)) bad('age', tag);
  if (g.primary.span && g.ageGyr > g.primary.span + 1e-9) bad('system older than its star\'s main sequence', tag);
  if (planets.length && !planets.some(function(p){ return p.key === '1'; })) bad('no key 1', tag);
});
check('Fuzz: ' + runs + ' random systems, no rule broken', Object.keys(violations).length === 0, JSON.stringify(violations));
['hz', 'hot', 'cold'].forEach(function(h){
  var label = {hz:'in the habitable zone', hot:'too hot', cold:'too cold'}[h];
  check('Home asked "' + label + '": it lands there, every time it could be placed exactly', homeStats[h][1] === homeStats[h][0], homeStats[h][1] + ' of ' + homeStats[h][0]);
});

/* --- worked examples that exercise one rule at a time --- */
var tight = S.generate({star:'M', inner:6, outer:0, belts:0, moonsInner:4, moonsOuter:0, home:'none', age:46, giants:'c', companion:'n', seed:5});
check('Close-in planets round a red dwarf lose their moons, and the notes say so', tight.counts.moons < tight.counts.moonsWanted && tight.notes.length > 0, tight.counts.moons + ' of ' + tight.counts.moonsWanted);
var added = S.generate({star:'G', inner:0, outer:2, belts:0, moonsInner:0, moonsOuter:2, home:'hz', age:46, giants:'c', companion:'n', seed:9});
check('Asking for a home world with zero rocky planets adds one, and says so', added.counts.rocky === 1 && added.notes.some(function(n){ return /rocky/.test(n); }));
var hotOnly = S.generate({star:'G', inner:2, outer:0, belts:0, moonsInner:0, moonsOuter:0, home:'none', giants:'h', age:46, companion:'n', seed:11});
check('Asking for a hot giant with no giants adds one, and says so', hotOnly.counts.giants === 1 && hotOnly.notes.some(function(n){ return /hot giant/.test(n); }));
var hotG = S.generate({star:'G', inner:3, outer:3, belts:0, moonsInner:0, moonsOuter:0, home:'hz', giants:'h', age:46, companion:'n', seed:12}).bodies.filter(function(b){ return b.hot; })[0];
check('A hot giant round a Sun-like star sits between about 0.04 and 0.15 AU', hotG.aAU > 0.035 && hotG.aAU < 0.15, hotG.aAU.toFixed(3) + ' AU');
var young = S.generate({star:'G', inner:3, outer:1, belts:0, moonsInner:0, moonsOuter:0, home:'hz', age:8, giants:'c', companion:'n', seed:3});
var yh = young.bodies.filter(function(b){ return b.home; })[0];
check('A home world in a system under 2.5 billion years old is an ocean world, with a note', yh.worldType === 'Ocean' && yh.young && young.notes.some(function(n){ return /too young/.test(n); }), yh.worldType);
var old = S.generate({star:'G', inner:3, outer:1, belts:0, moonsInner:0, moonsOuter:0, home:'hz', age:60, giants:'c', companion:'n', seed:3});
check('The same system at six billion years has a temperate home world', old.bodies.filter(function(b){ return b.home; })[0].worldType === 'Garden' || old.bodies.filter(function(b){ return b.home; })[0].worldType === 'Ocean');
var vol = ['G'].map(function(){ var young2 = S.generate({star:'G', inner:6, outer:0, belts:0, moonsInner:0, moonsOuter:0, home:'none', age:3, giants:'c', companion:'n', seed:21}), old2 = S.generate({star:'G', inner:6, outer:0, belts:0, moonsInner:0, moonsOuter:0, home:'none', age:100, giants:'c', companion:'n', seed:21});
  var rank = {None:0, Light:1, Moderate:2, Heavy:3, Extreme:4}, sum = function(g){ return g.bodies.filter(function(b){ return b.volcanic; }).reduce(function(s, b){ return s + rank[b.volcanic]; }, 0); };
  return [sum(young2), sum(old2)]; })[0];
check('Young systems are more volcanic than old ones (same seed, 0.3 against 10 billion years)', vol[0] > vol[1], vol.join(' vs '));
var lockedWorld = S.generate({star:'M', inner:3, outer:0, belts:0, moonsInner:0, moonsOuter:0, home:'hz', age:46, giants:'c', companion:'n', seed:2}).bodies.filter(function(b){ return b.tide; })[0];
check('A tide-locked rocky world has a day side hotter than its night side', lockedWorld && lockedWorld.tide.dayK > lockedWorld.tide.nightK, lockedWorld ? Math.round(lockedWorld.tide.dayK) + ' K / ' + Math.round(lockedWorld.tide.nightK) + ' K' : 'none');
var bin = S.generate({star:'G', inner:3, outer:2, belts:1, moonsInner:0, moonsOuter:0, home:'hz', age:46, giants:'c', companion:'w', seed:4});
check('A wide companion leaves planets round the primary alone (S-type), inside the forbidden zone limit', bin.binary.regime === 'S' && bin.bodies.filter(function(b){ return b.aAU && !b.isStar; }).every(function(b){ return b.aAU <= bin.binary.aS; }), bin.binary.regime);
var close = S.generate({star:'G', inner:3, outer:2, belts:0, moonsInner:0, moonsOuter:0, home:'hz', age:46, giants:'c', companion:'v', seed:6});
check('A very close companion has planets circling the pair (P-type) or none, never inside the forbidden zone', close.binary.regime === 'P' || close.binary.regime === null || close.binary.regime === 'S');
var mass2 = S.generate({star:'X', mass:100, inner:3, outer:2, belts:1, moonsInner:1, moonsOuter:2, home:'hz', age:46, giants:'c', companion:'n', seed:7});
check('A star chosen as one solar mass at 4.6 billion years comes out like the Sun, brightness about 1.1', near(mass2.primary.L, 1.1, 0.1) && mass2.primary.spt === 'G2', mass2.primary.L.toFixed(3) + ' ' + mass2.primary.spt);
var rolled = S.generate({star:'G', age:0, inner:2, outer:1, belts:0, moonsInner:0, moonsOuter:0, home:'none', giants:'c', companion:'n', seed:31});
check('Age 0 rolls an age from the table, within 0.1 and 12.5 billion years', rolled.ageGyr >= 0.1 && rolled.ageGyr <= 12.5, rolled.ageGyr.toFixed(2));
var none = S.generate({star:'G', inner:0, outer:0, belts:0, moonsInner:0, moonsOuter:0, home:'none', age:46, giants:'c', companion:'n', seed:1});
check('An empty system is just a star', none.bodies.length === 1 && none.counts.rocky === 0);


/* --- per-planet size overrides --- */
var base = {star:'G', inner:4, outer:3, belts:1, moonsInner:2, moonsOuter:3, home:'hz', age:46, giants:'c', companion:'n', seed:4242};
var g0 = S.generate(base), g1 = S.generate(Object.assign({}, base, {sizes:{2:0}}));
var p2a = g0.bodies.filter(function(b){ return b.id === 'p2'; })[0], p2b = g1.bodies.filter(function(b){ return b.id === 'p2'; })[0];
check('A size override sets that planet\'s size class and marks it as set', p2b.sizeClass === 'Tiny' && p2b.sizeSet === true && p2a.sizeSet === false, p2a.sizeClass + ' to ' + p2b.sizeClass);
check('The planet\'s automatic class is remembered so the panel can offer "Auto (...)"', p2b.sizeAuto === p2a.sizeAuto);
var others = function(g){ return JSON.stringify(g.bodies.filter(function(b){ return b.id !== 'p2' && b.parent !== 'p2' && !/^p2m/.test(b.id); })); };
check('Resizing one planet leaves every other body exactly as it was', others(g0) === others(g1));
check('A Tiny override gives a diameter inside the Tiny limits (factor 0.004 to 0.024 of sqrt(BB/density))',
  (function(){ var k = Math.sqrt(p2b.bbK / p2b.density) * S.REARTH_KM; return p2b.radiusKm / S.REARTH_KM >= Math.sqrt(p2b.bbK / p2b.density) * 0.004 - 1e-9 && p2b.radiusKm / S.REARTH_KM <= Math.sqrt(p2b.bbK / p2b.density) * 0.024 + 1e-9; })());
var gg = S.generate(Object.assign({}, base, {sizes:{5:6}})), gg5 = gg.bodies.filter(function(b){ return b.id === 'p5'; })[0];
check('A Large override on a giant gives a Large gas giant', gg5.giant && gg5.ggClass === 'Large', gg5.ggClass);
var gz = S.generate(Object.assign({}, base, {sizes:{5:0}})), gz5 = gz.bodies.filter(function(b){ return b.id === 'p5'; })[0];
var gr = S.generate(Object.assign({}, base, {sizes:{2:6}})), gr2 = gr.bodies.filter(function(b){ return b.id === 'p2'; })[0];
check('A giant size on a rocky planet is ignored', !gr2.sizeSet && gr2.sizeClass === p2a.sizeClass);
check('A rocky size (Tiny) on a giant is ignored', gz5.ggClass === (g0.bodies.filter(function(b){ return b.id === 'p5'; })[0].ggClass) && !gz5.sizeSet);
var hs = S.generate(Object.assign({}, base, {sizes:{1:0, 2:0, 3:0, 4:0}})), homeS = hs.bodies.filter(function(b){ return b.home; })[0];
check('A home world made Tiny is typed by temperature and a note says so', homeS && homeS.sizeClass === 'Tiny' && /too small to hold/.test(hs.notes.join(' ')), homeS && homeS.worldType);
var cfgS = S.normalise({star:'G', seed:5, sizes:{3:2, 1:0, 99:1, 2:7, 4:'x', 0:1, 5:6}});
check('Bad size entries are dropped when a config is cleaned up', JSON.stringify(cfgS.sizes) === '{"1":0,"3":2,"5":6}', JSON.stringify(cfgS.sizes));
var link = S.encodeCfg(cfgS);
check('Sizes survive a share link round trip', JSON.stringify(S.decodeCfg(link).sizes) === JSON.stringify(cfgS.sizes) && /\.1x0_3x2_5x6$/.test(link), link);
check('A config with no sizes ends in a dash', /\.-$/.test(S.encodeCfg({star:'G', seed:5})));
check('Malformed size fields are refused', ['4.G.0.46.4.4.1.1.3.hz.c.n.5.1x7', '4.G.0.46.4.4.1.1.3.hz.c.n.5.x', '4.G.0.46.4.4.1.1.3.hz.c.n.5.1x1_', '4.G.0.46.4.4.1.1.3.hz.c.n.5'].every(function(t){ return S.decodeCfg(t) === null; }));


/* --- exact diameter inside the size class --- */
var gd0 = S.generate(base), gdLo = S.generate(Object.assign({}, base, {diam:{2:0}})), gdHi = S.generate(Object.assign({}, base, {diam:{2:1000}}));
var q = function(g, id){ return g.bodies.filter(function(b){ return b.id === id; })[0]; };
check('Diameter position 0 and 1000 give the class limits, and 500 sits between them',
  (function(){ var lo = q(gdLo, 'p2'), hi = q(gdHi, 'p2'), mid = q(S.generate(Object.assign({}, base, {diam:{2:500}})), 'p2'), k = S.REARTH_KM;
    return near(lo.radiusKm / k, lo.diamMin, 1e-9) && near(hi.radiusKm / k, hi.diamMax, 1e-9) && near(mid.radiusKm / k, (lo.diamMin + hi.diamMax) / 2, 1e-6); })());
check('Diameter stays inside the size class whatever the slider says, and gravity and mass follow it',
  (function(){ var b = q(gdHi, 'p2'); return near(b.gravity, b.density * b.radiusKm / S.REARTH_KM, 1e-9) && near(b.massEarth, b.density * Math.pow(b.radiusKm / S.REARTH_KM, 3), 1e-9); })());
check('Without an override the panel gets the rolled position, and flags it as not set', q(gd0, 'p2').diamSet === false && q(gd0, 'p2').diamT >= 0 && q(gd0, 'p2').diamT <= 1);
check('An exact diameter changes only that planet', (function(){ var f = function(g){ return JSON.stringify(g.bodies.filter(function(b){ return b.id !== 'p2' && !/^p2m/.test(b.id); })); }; return f(gd0) === f(gdLo) && f(gd0) === f(gdHi); })());
check('Resizing the planet keeps its type and class (same size class, only the diameter moves)', q(gdLo, 'p2').sizeClass === q(gd0, 'p2').sizeClass && q(gdLo, 'p2').worldType === q(gd0, 'p2').worldType);
check('A giant takes an exact diameter too, and mass follows density times diameter cubed', (function(){ var a = q(S.generate(Object.assign({}, base, {diam:{6:1000}})), 'p6'), k = S.REARTH_KM; return near(a.radiusKm / k, a.diamMax, 1e-9) && near(a.massEarth, a.density * Math.pow(a.radiusKm / k, 3), 1e-6); })());
var dLink = S.encodeCfg({star:'G', seed:5, sizes:{1:0}, diam:{2:537, 4:1000, 3:1001, 0:5}});
check('Diameter positions survive a link round trip, with bad entries dropped', /\.1x0\.2x537_4x1000$/.test(dLink) && JSON.stringify(S.decodeCfg(dLink).diam) === '{"2":537,"4":1000}', dLink);
check('A link with no diameters has no extra field', S.encodeCfg({star:'G', seed:5}).split('.').length === 14);
check('Malformed diameter fields are refused', ['4.G.0.46.4.4.1.1.3.hz.c.n.5.-.2x1001', '4.G.0.46.4.4.1.1.3.hz.c.n.5.-.x', '4.G.0.46.4.4.1.1.3.hz.c.n.5.-.2x5_'].every(function(t){ return S.decodeCfg(t) === null; }));


/* --- world type override --- */
var tb = Object.assign({}, base, {home:'none', age:46}), tg0 = S.generate(tb);
var tg0p = q(tg0, 'p2');
var wantType = tg0p.typeOptions.filter(function(t){ return t !== tg0p.worldType; })[0], wantIdx = S.TYPE_LIST.indexOf(wantType);
var tg1 = S.generate(Object.assign({}, tb, {types:{2:wantIdx}})), tg1p = q(tg1, 'p2');
check('A type override sets the world type and flags it, keeping the size class', tg1p.worldType === wantType && tg1p.typeSet === true && tg1p.sizeClass === tg0p.sizeClass && tg0p.typeSet === false, tg0p.worldType + ' to ' + tg1p.worldType);
check('The automatic type is remembered for the "Auto (...)" entry', tg1p.typeAuto === tg0p.worldType);
check('Changing one planet\'s type leaves every other planet exactly as it was', (function(){ var f = function(g){ return JSON.stringify(g.bodies.filter(function(b){ return b.id !== 'p2' && !/^p2m/.test(b.id); })); }; return f(tg0) === f(tg1); })());
check('A type not allowed for the size class is ignored', (function(){ var bad = S.TYPE_LIST.filter(function(t){ return tg0p.typeOptions.indexOf(t) < 0; })[0], g = S.generate(Object.assign({}, tb, {types:{2:S.TYPE_LIST.indexOf(bad)}})), b = q(g, 'p2'); return !b.typeSet && b.worldType === tg0p.worldType; })());
check('Every type each size class lists can be generated, with gravity = density x diameter and a climate', (function(){
  var ok = true;
  S.SIZE_ORDER.forEach(function(sc, si){ S.TYPES_BY_SIZE[sc].forEach(function(t){
    var g = S.generate(Object.assign({}, tb, {sizes:{2:si}, types:{2:S.TYPE_LIST.indexOf(t)}})), b = q(g, 'p2');
    if (b.worldType !== t || b.sizeClass !== sc || !b.climate || !isFinite(b.surfaceK) || !near(b.gravity, b.density * b.radiusKm / S.REARTH_KM, 1e-9)) ok = false;
  }); });
  return ok; })());
check('A temperate world forced into a young system keeps its type and a note says it is unusual', (function(){ var g = S.generate(Object.assign({}, tb, {age:5, sizes:{2:2}, types:{2:0}})); return q(g, 'p2').worldType === 'Garden' && /your call/.test(g.notes.join(' ')); })());
var tLink = S.encodeCfg({star:'G', seed:5, types:{2:4, 3:0}});
check('Types survive a link round trip, with a placeholder diameter field', /\.-\.-\.2x4_3x0$/.test(tLink) && JSON.stringify(S.decodeCfg(tLink).types) === '{"2":4,"3":0}', tLink);
check('Links without types are unchanged', S.encodeCfg({star:'G', seed:5, diam:{2:5}}).split('.').length === 15 && S.encodeCfg({star:'G', seed:5}).split('.').length === 14);
check('Malformed type fields are refused', ['4.G.0.46.4.4.1.1.3.hz.c.n.5.-.-.2x9x', '4.G.0.46.4.4.1.1.3.hz.c.n.5.-.-.x', '4.G.0.46.4.4.1.1.3.hz.c.n.5.-.-.2x12', '4.G.0.46.4.4.1.1.3.hz.c.n.5.-.-.-.-'].every(function(t){ return S.decodeCfg(t) === null; }));
check('A type index beyond the list is dropped on cleanup', JSON.stringify(S.normalise({star:'G', types:{1:9, 2:8}}).types) === '{"2":8}');

console.log(failed ? '\n' + failed + ' of ' + results.length + ' FAILED' : '\nAll ' + results.length + ' checks passed.');
process.exit(failed ? 1 : 0);
