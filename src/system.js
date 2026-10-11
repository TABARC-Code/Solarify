/* Solarify system builder. Author: TABARC-Code. MIT licence.
 *
 * Makes a made-up planetary system from a handful of choices: what sort of star (or what mass),
 * how old the system is, whether there's a companion star, how many rocky planets, giants and asteroid
 * belts, how many moons, and where the player's home world sits relative to the habitable zone.
 * Same choices plus the same seed always give the same system.
 *
 * No DOM and no Three.js in here, so tests/system.test.js can hammer it from Node.
 *
 * Ideas, not promises: an exact diameter inside a size class; per-planet overrides for type, atmosphere
 * and moon count (the per-planet random streams below were made so these can follow cheaply); a
 * retrograde or tilted planet on request; a link format that stays readable across versions.
 *
 * Where the numbers come from, and how far to trust them:
 *   - Main-sequence star presets: Mamajek's table "A Modern Mean Dwarf Stellar Color and Effective
 *     Temperature Sequence" (version 2022.04.16). The red giant and white dwarf are rounded from the
 *     figures Wikipedia gives for Aldebaran and Sirius B, so those two are the least solid rows.
 *   - Habitable zone edges: Kopparapu et al. 2014 (ApJL 787, L29), the 1 Earth-mass coefficients.
 *     Their fit is valid for 2600 K to 7200 K; outside that this code clamps the temperature and
 *     flags the zone as rough (hzRough).
 *   - World-building rules (star mass, age and evolution tables, orbit spacing, size classes, density,
 *     absorption and greenhouse factors, atmosphere pressure, world types, climate, volcanism, resources,
 *     habitability, tide-locked temperatures, companion-star separations, gas giant masses, axial tilt):
 *     tabletop-style lookup tables, in tables.js. They are rules of thumb that make a believable system,
 *     not a current astrophysics dataset. A comment marks each place they are used.
 *   - Everything else (the layout around your home world, belts, moons, textures, lighting) is staged:
 *     plausible and internally consistent, not a model of planet formation.
 */
(function(root, factory){
  var api = factory(typeof module === 'object' && module.exports ? require('./tables.js') : root.SolarifyTables);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SolarifySystem = api;
})(typeof window !== 'undefined' ? window : this, function(T){
'use strict';

var AU_KM = 149597870.7, RSUN_KM = 695700, REARTH_KM = 6378;
var MU_EARTH = 398600.4418;            // km^3 per s^2
var MJUP_EARTH = 317.83;
var EPOCH_JD = 2451545.0;
var VERSION = 4;                       // bump if generation changes, so old share links can be told apart
var GARDEN_MIN_AGE = 2.5;              // Gyr: Earth took about this long to get a breathable atmosphere (staged)

// tint is only how the star is painted on screen. It is not a measured colour.
var STARS = {
  M:  {key:'M',  label:'Red dwarf (M4V)',      spt:'M4V',  Teff:3210,  L:Math.pow(10, -2.14), R:0.274,  M:0.23,  rotH:24 * 60,  tint:[255, 112, 62],  main:true},
  K:  {key:'K',  label:'Orange dwarf (K2V)',   spt:'K2V',  Teff:5100,  L:Math.pow(10, -0.43), R:0.783,  M:0.82,  rotH:24 * 35,  tint:[255, 160, 74],  main:true},
  G:  {key:'G',  label:'Sun-like (G2V)',       spt:'G2V',  Teff:5770,  L:Math.pow(10, 0.01),  R:1.012,  M:1.00,  rotH:24 * 25,  tint:[255, 205, 102], main:true},
  F:  {key:'F',  label:'Yellow-white (F5V)',   spt:'F5V',  Teff:6550,  L:Math.pow(10, 0.56),  R:1.473,  M:1.33,  rotH:24 * 4,   tint:[255, 238, 190], main:true},
  A:  {key:'A',  label:'White (A2V)',          spt:'A2V',  Teff:8800,  L:Math.pow(10, 1.38),  R:2.117,  M:1.98,  rotH:24 * 1,   tint:[236, 242, 255], main:true},
  B:  {key:'B',  label:'Blue-white (B5V)',     spt:'B5V',  Teff:15700, L:Math.pow(10, 2.77),  R:3.36,   M:4.7,   rotH:24 * 0.6, tint:[168, 198, 255], main:true},
  RG: {key:'RG', label:'Red giant (K5 III)',   spt:'K5 III', Teff:3900, L:439,                 R:45,     M:1.03,  rotH:24 * 700, tint:[255, 128, 64],  main:false},
  WD: {key:'WD', label:'White dwarf (DA)',     spt:'DA',   Teff:25000, L:0.0245,               R:0.0081, M:1.02,  rotH:24 * 1,   tint:[196, 218, 255], main:false}
};
var STAR_ORDER = ['M', 'K', 'G', 'F', 'A', 'B', 'RG', 'WD'];
var MASS_STAR = {key:'X', label:'Star by mass…'};      // the form's "choose a mass" option

var GIANT_LAYOUTS = ['c', 'e', 'h'];                     // conventional, eccentric, hot (close to the star)
var COMPANIONS = ['n', 'v', 'c', 'm', 'w', 'd'];         // none, then the five separation classes from the companion table
var HOMES = ['hz', 'hot', 'cold', 'none'];
var MAX_PLANETS = 16;
var LIMITS = {inner:[0, 8], outer:[0, 8], belts:[0, 3], moonsInner:[0, 4], moonsOuter:[0, 8], age:[0, 120], mass:[10, 1000]};

function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
function mulberry32(a){
  a = a >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// the table row whose [low, high] contains v
function lookup(table, v){
  for (var i = 0; i < table.length; i++) if (v >= table[i][0][0] && v <= table[i][0][1]) return table[i];
  return table[v < table[0][0][0] ? 0 : table.length - 1];
}

/* ---- stars: by mass and age ---- */
function sptFromTeff(t){ return (t >= 30000 ? 'O' : t >= 10000 ? 'B' : t >= 7500 ? 'A' : t >= 6000 ? 'F' : t >= 5200 ? 'G' : t >= 3700 ? 'K' : 'M') + ' (approx.)'; }
function evolutionRows(){
  var rows = T.starEvolution.map(function(r){
    return {m:r[0], spt:r[1], Teff:r[2], Lmin:r[3], Lmax:r[4] == null ? r[3] : r[4], span:r[5] == null ? 1e4 : r[5], sub:r[6], giant:r[7]};
  });
  T.massiveStars.forEach(function(r){ rows.push({m:r[0], spt:sptFromTeff(r[2]), Teff:r[2], Lmin:r[1], Lmax:r[1], span:r[3], sub:null, giant:null}); });
  return rows;
}
var EVO = evolutionRows();
// Interpolates the evolution table (linear in temperature, logarithmic in luminosity and lifetime).
function starProps(mass){
  var m = clamp(mass, EVO[0].m, EVO[EVO.length - 1].m), i = 0;
  while (i < EVO.length - 2 && m > EVO[i + 1].m) i++;
  var a = EVO[i], b = EVO[i + 1], t = (m - a.m) / (b.m - a.m);
  function lg(x, y){ return Math.pow(10, Math.log10(x) + (Math.log10(y) - Math.log10(x)) * t); }
  return {mass:m, spt:t < 0.5 ? a.spt : b.spt, Teff:a.Teff + (b.Teff - a.Teff) * t, Lmin:lg(a.Lmin, b.Lmin), Lmax:lg(a.Lmax, b.Lmax), span:lg(a.span, b.span)};
}
function mainSequenceSpan(mass){ return starProps(mass).span; }
function tintFromTeff(t){
  return t < 3300 ? [255, 112, 62] : t < 4200 ? [255, 140, 70] : t < 5200 ? [255, 170, 80] : t < 6000 ? [255, 205, 102]
       : t < 7000 ? [255, 238, 190] : t < 10000 ? [236, 242, 255] : [168, 198, 255];
}
function rotFromTeff(t){ return 24 * (t < 4000 ? 40 : t < 5300 ? 30 : t < 6000 ? 25 : t < 7000 ? 5 : t < 10000 ? 1 : 0.6); }
// A star of this mass at this age. Past the end of its main sequence it is held at its end-of-main-sequence brightness.
function starAt(mass, age){
  var p = starProps(mass), past = age >= p.span, used = past ? p.span : age;
  var L = past ? p.Lmax : p.Lmin + (used / p.span) * (p.Lmax - p.Lmin);
  return {mass:p.mass, spt:p.spt, Teff:p.Teff, L:L, Linit:p.Lmin, R:Math.sqrt(L) * Math.pow(5772 / p.Teff, 2), span:p.span, ageUsed:used, past:past};
}

/* ---- habitable zone and friends ---- */
// [Seff at the Sun's temperature, a, b, c, d] for Teff - 5780 K, 1 Earth mass. Kopparapu et al. 2014, Table 1.
var HZ_INNER = [1.107, 1.332e-4, 1.58e-8, -8.308e-12, -1.931e-15];     // runaway greenhouse
var HZ_OUTER = [0.356, 6.171e-5, 1.698e-9, -3.198e-12, -5.575e-16];    // maximum greenhouse
function seff(c, Teff){ var t = clamp(Teff, 2600, 7200) - 5780; return c[0] + c[1] * t + c[2] * t * t + c[3] * t * t * t + c[4] * t * t * t * t; }
// Returns the habitable zone in AU. 'rough' is true when Teff is outside the range the fit was made for.
function hzBounds(Teff, L){
  return {inner: Math.sqrt(L / seff(HZ_INNER, Teff)), outer: Math.sqrt(L / seff(HZ_OUTER, Teff)), rough: Teff < 2600 || Teff > 7200};
}
// Rule of thumb: where giants form is 4.85 AU x sqrt(luminosity at the start of the main sequence).
function frostLine(Linit){ return 4.85 * Math.sqrt(Linit); }
// Blackbody temperature with no albedo, 278 K at 1 AU from the Sun.
function blackbody(L, a){ return 278 * Math.pow(L, 0.25) / Math.sqrt(a); }
function aFromBlackbody(L, K){ return Math.pow(278 / K, 2) * Math.sqrt(L); }
function teq(L, a, albedo){ return 278.3 * Math.pow(L, 0.25) / Math.sqrt(a) * Math.pow(1 - (albedo == null ? 0.3 : albedo), 0.25); }
function periodDays(a, Mstar){ return Math.sqrt(a * a * a / Mstar) * 365.25; }       // Kepler's third law, a in AU, M in solar masses
function zoneOf(a, hz){ return a < hz.inner ? 'inside' : (a > hz.outer ? 'beyond' : 'in'); }
function starRadiusAU(R){ return R * RSUN_KM / AU_KM; }

/* ---- names ---- */
var SYL_A = ['Ael', 'Bar', 'Cor', 'Dra', 'Eri', 'Fen', 'Gal', 'Hes', 'Ith', 'Jor', 'Kes', 'Lun', 'Mar', 'Nev', 'Ora', 'Pel', 'Qua', 'Ros', 'Sel', 'Tav', 'Ul', 'Vel', 'Wyn', 'Xan', 'Yor', 'Zen'];
var SYL_B = ['a', 'e', 'i', 'o', 'u', 'ar', 'en', 'is', 'on', 'ur'];
var SYL_C = ['da', 'ra', 'sa', 'ta', 'la', 'na', 'ris', 'tan', 'lis', 'dor', 'mir', 'vek', 'sen', 'thos', 'wen'];
function starName(rnd){
  var a = SYL_A[Math.floor(rnd() * SYL_A.length)], b = SYL_B[Math.floor(rnd() * SYL_B.length)], c = SYL_C[Math.floor(rnd() * SYL_C.length)];
  return a + b + c;
}
function roman(n){
  var map = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']], s = '';
  map.forEach(function(p){ while (n >= p[0]){ s += p[1]; n -= p[0]; } });
  return s;
}

/* ---- options and share links ---- */
function normalise(cfg){
  cfg = cfg || {};
  function n(k, d){ var v = Math.round(+cfg[k]); if (!isFinite(v)) v = d; return clamp(v, LIMITS[k][0], LIMITS[k][1]); }
  var seed = Math.floor(+cfg.seed); if (!isFinite(seed) || seed < 0) seed = 1; seed = seed % 4294967296;
  var star = STARS[cfg.star] || cfg.star === 'X' ? cfg.star : 'G';
  var mass = star === 'X' ? n('mass', 100) : 0;
  // size overrides: planet number (1 upwards, in orbit order) to a size class index. Rocky: 0 Tiny to 3 Large. Giants: 4 Small to 6 Large, so an override never lands on the wrong kind of planet if the layout shifts.
  var sizes = {}, src = cfg.sizes && typeof cfg.sizes === 'object' ? cfg.sizes : {};
  Object.keys(src).forEach(function(k){
    var slot = +k, v = src[k];
    if (/^\d+$/.test(k) && slot >= 1 && slot <= MAX_PLANETS && typeof v === 'number' && v === Math.floor(v) && v >= 0 && v <= 6) sizes[slot] = v;
  });
  return {
    star: star, mass: mass, age: n('age', 46),
    inner: n('inner', 4), outer: n('outer', 4), belts: n('belts', 1), moonsInner: n('moonsInner', 1), moonsOuter: n('moonsOuter', 3),
    home: HOMES.indexOf(cfg.home) >= 0 ? cfg.home : 'hz',
    giants: GIANT_LAYOUTS.indexOf(cfg.giants) >= 0 ? cfg.giants : 'c',
    companion: COMPANIONS.indexOf(cfg.companion) >= 0 ? cfg.companion : 'n', seed: seed, sizes: sizes
  };
}
function encodeSizes(sz){
  var k = Object.keys(sz).map(Number).sort(function(a, b){ return a - b; });
  return k.length ? k.map(function(i){ return i + 'x' + sz[i]; }).join('_') : '-';
}
function decodeSizes(t){
  if (t === '-') return {};
  if (!/^\d+x[0-6](_\d+x[0-6])*$/.test(t)) return null;
  var out = {};
  t.split('_').forEach(function(e){ var a = e.split('x'); out[+a[0]] = +a[1]; });
  return out;
}
function encodeCfg(cfg){
  var c = normalise(cfg);
  return [VERSION, c.star, c.mass, c.age, c.inner, c.outer, c.belts, c.moonsInner, c.moonsOuter, c.home, c.giants, c.companion, c.seed, encodeSizes(c.sizes)].join('.');
}
// Returns a normalised config, or null if the text isn't one of ours.
function decodeCfg(text){
  var p = String(text || '').split('.');
  if (p.length !== 14 || +p[0] !== VERSION) return null;
  var sizes = decodeSizes(p[13]); if (!sizes) return null;
  if (!(STARS[p[1]] || p[1] === 'X') || HOMES.indexOf(p[9]) < 0 || GIANT_LAYOUTS.indexOf(p[10]) < 0 || COMPANIONS.indexOf(p[11]) < 0) return null;
  var idx = [2, 3, 4, 5, 6, 7, 8, 12], nums = idx.map(function(i){ return /^\d+$/.test(p[i]) ? +p[i] : NaN; });
  if (nums.some(function(v){ return !isFinite(v); })) return null;
  return normalise({star:p[1], mass:nums[0], age:nums[1], inner:nums[2], outer:nums[3], belts:nums[4], moonsInner:nums[5], moonsOuter:nums[6],
    home:p[9], giants:p[10], companion:p[11], seed:nums[7], sizes:sizes});
}

/* ---- the generator ---- */
var GAS_PALETTES = 6, ICE_BASES = [[152, 214, 224], [50, 88, 208], [108, 176, 196], [88, 120, 205], [140, 205, 190]];
var TYPE_NAMES = {Garden:'temperate world', Ocean:'ocean world', Rock:'barren rock', Ice:'frozen world', Hadean:'frozen rock (Hadean)', Ammonia:'ammonia world',
                  Sulfur:'sulfur world', Greenhouse:'runaway greenhouse world', Chthonian:'scorched core (Chthonian)'};
var TYPE_GEN = {Garden:'terran', Ocean:'ocean', Rock:'barren', Ice:'ice', Hadean:'hadean', Ammonia:'ammonia', Sulfur:'sulfur', Greenhouse:'cloudy', Chthonian:'lava'};
var TYPE_COLOR = {Garden:0x3a74b8, Ocean:0x2a5ea0, Rock:0x9a8f84, Ice:0xcfe0ea, Hadean:0x5a6270, Ammonia:0xb8c890, Sulfur:0xd8c040, Greenhouse:0xe0c690, Chthonian:0xc2441f};
var SIZE_ORDER = ['Tiny', 'Small', 'Standard', 'Large'];

function generate(input){
  var cfg = normalise(input), rnd = mulberry32(cfg.seed * 2654435761 + 97);
  function U(a, b){ return a + (b - a) * rnd(); }
  function I(a, b){ return Math.floor(U(a, b + 1)); }
  function d6(){ return Math.floor(rnd() * 6) + 1; }
  function roll(n){ var s = 0; for (var i = 0; i < n; i++) s += d6(); return s; }
  var notes = [];

  /* --- age --- */
  var age = cfg.age / 10;
  if (!cfg.age){                                    // 0 means: roll it (a table of typical system ages)
    var row = lookup(T.systemAge, roll(3));
    age = Math.max(0.1, row[2] + (d6() - 1) * row[3] + (d6() - 1) * row[4]);
  }

  /* --- the primary star --- */
  var name = starName(rnd), primary, preset = STARS[cfg.star] || null, starMeta;
  if (preset){
    var span = preset.main ? mainSequenceSpan(preset.M) : null;
    var usedAge = span && age > span ? span * 0.98 : age;
    if (span && age > span) notes.push('A ' + preset.spt + ' star would already have left the main sequence by ' + age.toFixed(1) + ' billion years (it lasts about ' +
      (span < 1 ? Math.round(span * 1000) + ' million' : span.toFixed(1) + ' billion') + '), so the system is treated as ' + usedAge.toFixed(2) + ' billion years old.');
    primary = {mass:preset.M, spt:preset.spt, Teff:preset.Teff, L:preset.L, Linit:preset.L, R:preset.R, span:span, ageUsed:usedAge, past:false,
               label:preset.label, tint:preset.tint, rotH:preset.rotH, evolved:!preset.main};
  } else {
    var sa = starAt(cfg.mass / 100, age);
    primary = {mass:sa.mass, spt:sa.spt, Teff:sa.Teff, L:sa.L, Linit:sa.Linit, R:sa.R, span:sa.span, ageUsed:sa.ageUsed, past:sa.past,
               label:'Star of ' + sa.mass.toFixed(2) + ' solar masses (' + sa.spt + ')', tint:tintFromTeff(sa.Teff), rotH:rotFromTeff(sa.Teff), evolved:false};
    if (sa.past) notes.push('This star has used up its main-sequence life (about ' + (sa.span < 1 ? Math.round(sa.span * 1000) + ' million' : sa.span.toFixed(1) + ' billion') +
      ' years) and is shown at its end-of-main-sequence brightness; the table has nothing for later stages.');
  }
  var systemAge = primary.ageUsed;

  /* --- an optional companion star (typical separation and eccentricity tables) --- */
  var binary = null, companionStar = null;
  if (cfg.companion !== 'n'){
    var cls = T.companionSeparation[COMPANIONS.indexOf(cfg.companion) - 1];
    var sep = Math.max(cls[2] * (d6() + d6()), 0.02), ecc = Math.min(lookup(T.starEccentricity, roll(3))[1], 0.6);
    var m2 = Math.max(0.1, Math.min(primary.mass, primary.mass * U(0.25, 1.0)));
    var sb = starAt(m2, systemAge);
    companionStar = {mass:m2, label:'Star of ' + m2.toFixed(2) + ' solar masses (' + sb.spt + ')', spt:sb.spt, Teff:sb.Teff, L:sb.L, Linit:sb.Linit, R:sb.R, tint:tintFromTeff(sb.Teff), rotH:rotFromTeff(sb.Teff)};
    var Mtot = primary.mass + m2;
    binary = {cls:cls[1], sep:sep, ecc:ecc, min:sep * (1 - ecc), max:sep * (1 + ecc), mass2:m2, Mtot:Mtot,
              aS:sep * (1 - ecc) / 3, aP:3 * sep * (1 + ecc), periodDays:periodDays(sep, Mtot), regime:null};
  }

  /* --- which regime do planets live in: around the primary alone (S), around both (P), or nowhere --- */
  var Lsys = primary.L, Msys = primary.mass, TeffSys = primary.Teff, LinitSys = primary.Linit;
  if (binary){
    var Lp = primary.L + companionStar.L;
    var innerLimitS = Math.max(0.1 * primary.mass, 0.01 * Math.sqrt(primary.L));
    var sOk = binary.aS > innerLimitS * 1.6;
    var pOk = binary.aP < 40 * binary.Mtot;
    var wantTarget = 0;
    if (cfg.home !== 'none'){
      var hzS = hzBounds(primary.Teff, primary.L);
      wantTarget = cfg.home === 'hz' ? (hzS.inner + hzS.outer) / 2 : cfg.home === 'hot' ? hzS.inner * 0.6 : hzS.outer * 1.4;
    }
    var useP = false;
    if (!sOk) useP = pOk;
    else if (wantTarget && wantTarget > binary.aS * 0.95 && pOk) useP = true;
    if (useP){
      binary.regime = 'P';
      Lsys = Lp; Msys = binary.Mtot; LinitSys = primary.Linit + companionStar.Linit;
      TeffSys = (primary.L * primary.Teff + companionStar.L * companionStar.Teff) / Lp;      // luminosity-weighted: a rough combined temperature
      notes.push('The two stars are too close for planets to orbit just one of them, so every planet circles the pair.');
    } else if (sOk){
      binary.regime = 'S';
      notes.push('Planets orbit the primary star only, and stay inside ' + (binary.aS * 0.95).toFixed(2) + ' AU: further out, the companion\'s pull would throw them off.');
    } else {
      binary.regime = null;
      notes.push('The companion star is too close for planets to orbit one star and too far in for the pair to be circled within the planet-forming limit, so this system has no planets.');
    }
  }
  var hz = hzBounds(TeffSys, Lsys), frost = frostLine(LinitSys);
  var innerForm = Math.max(0.1 * Msys, 0.01 * Math.sqrt(Lsys)), outerForm = 40 * Msys;      // where planets can form
  var aLo = innerForm, aHi = outerForm;
  if (binary && binary.regime === 'S') aHi = Math.min(aHi, binary.aS * 0.95);
  if (binary && binary.regime === 'P') aLo = Math.max(aLo, binary.aP * 1.02);
  var noPlanets = binary && binary.regime === null;
  if (!noPlanets && aHi < aLo * 1.3){ noPlanets = true; notes.push('The limits on where planets can form leave no room for any planets round this star.'); }

  /* --- orbit spacing, eccentricity --- */
  function spacing(){ return lookup(T.orbitSpacing, roll(3))[1]; }                               // ratios between neighbouring orbits, 1.4 to 2.0
  function eccRocky(){ return Math.min(lookup(T.planetEccentricity, roll(3))[1], 0.15); }       // capped so neighbours never cross
  function eccGiant(){ return Math.min(lookup(T.planetEccentricity, roll(3))[1], 0.2); }
  function stepRatio(eIn, eOut){ return Math.max(spacing(), 1.06 * (1 + eIn) / (1 - eOut)); }

  var nIn = cfg.inner, nOut = cfg.outer, nBelts = cfg.belts;
  if (cfg.home !== 'none' && nIn < 1 && !noPlanets){ nIn = 1; notes.push('A home world has to be rocky, so one rocky planet was added.'); }
  if (cfg.giants === 'h' && nOut < 1 && !noPlanets){ nOut = 1; notes.push('A hot giant needs a giant planet, so one was added.'); }
  if (noPlanets){ nIn = 0; nOut = 0; nBelts = 0; }

  var aMinPhys = Math.max(6 * starRadiusAU(primary.R), 0.012);
  // a hot giant sits very close to its star, and everything rocky is kept well outside it
  var hotA = 0;      // (a hot giant has no meaning on a circumbinary orbit, so none is made there)
  if (cfg.giants === 'h' && nOut > 0 && !(binary && binary.regime === 'P')) hotA = Math.max(aMinPhys * 2, U(0.04, 0.10) * Math.sqrt(Lsys), aLo * 0.4);
  if (hotA && hotA * 1.6 * 1.3 > aHi){ hotA = 0; notes.push('There is no room inside the limits here for a hot giant with everything else outside it, so it was left out.'); }
  var innerLimit = Math.max(aLo, hotA ? hotA * 1.6 : 0, aMinPhys * 1.1);      // a planet's closest approach, not just its mean distance, must clear this

  /* --- rocky orbits: home first, then outwards and inwards in steps --- */
  var rocky = [], homeIdx = -1;      // each: {a, e, home}
  function homeTarget(){
    var lo, hi, a;
    if (cfg.home === 'hz'){
      lo = Math.max(hz.inner, aFromBlackbody(Lsys, 320)); hi = Math.min(hz.outer, aFromBlackbody(Lsys, 241));
      a = lo < hi ? U(lo, hi) : (hz.inner + hz.outer) / 2;
    } else if (cfg.home === 'hot'){
      lo = aFromBlackbody(Lsys, 500); hi = Math.min(aFromBlackbody(Lsys, 321), hz.inner * 0.97);
      a = lo < hi ? U(lo, hi) : hz.inner * U(0.45, 0.8);
    } else {
      lo = Math.max(aFromBlackbody(Lsys, 230), hz.outer * 1.12); hi = Math.max(lo * 1.4, Math.min(aFromBlackbody(Lsys, 100), lo * 2.2));
      a = U(lo, hi);
    }
    return a;
  }
  if (nIn > 0 && !noPlanets){
    if (cfg.home === 'none'){
      var e0 = eccRocky(), a0 = Math.max(innerLimit / (1 - e0) * 1.01, hz.inner * U(0.15, 0.5));
      rocky.push({a:a0, e:e0});
      for (var i = 1; i < nIn; i++){ var ei = eccRocky(), prev = rocky[i - 1]; rocky.push({a:prev.a * stepRatio(prev.e, ei), e:ei}); }
    } else {
      var homeA = homeTarget(), wanted = homeA;
      homeA = clamp(homeA, Math.max(innerLimit * 1.2, aMinPhys * 1.2), aHi * 0.92);
      if (Math.abs(homeA - wanted) / wanted > 0.02) notes.push('The planet-forming limits here left no room for your home world exactly where you asked, so it sits as near as it can.');
      var eHome = Math.min(eccRocky(), 0.05), order = [];
      for (var h = 0; h < nIn; h++) order.push(h);
      for (var s = order.length - 1; s > 0; s--){ var j = Math.floor(rnd() * (s + 1)), t = order[s]; order[s] = order[j]; order[j] = t; }
      if (homeA > frost * 0.7) order.sort(function(x, y){ return y - x; });      // a home out near the snow line is the outermost rocky planet, not the innermost
      var built = null;
      for (var oi = 0; oi < order.length && !built; oi++){
        var hh = order[oi], list = new Array(nIn), es = [];
        for (var q = 0; q < nIn; q++) es.push(q === hh ? eHome : eccRocky());
        list[hh] = {a:homeA, e:es[hh], home:true};
        var okc = true;
        for (var m = hh - 1; m >= 0 && okc; m--){ var aa = list[m + 1].a / stepRatio(es[m], es[m + 1]); if (aa * (1 - es[m]) < innerLimit) okc = false; else list[m] = {a:aa, e:es[m]}; }
        if (!okc) continue;
        for (var o = hh + 1; o < nIn; o++) list[o] = {a:list[o - 1].a * stepRatio(list[o - 1].e, es[o]), e:es[o]};
        built = list; homeIdx = hh;
      }
      if (!built){ built = [{a:homeA, e:eHome, home:true}]; homeIdx = 0; nIn = 1; notes.push('Only the home world fitted inside the limits.'); }
      rocky = built;
    }
  }
  // anything past the outer limit is dropped (the home world never is: it was placed inside the limit)
  var beforeCut = rocky.length;
  rocky = rocky.filter(function(r){ return r.home || r.a * (1 + r.e) <= aHi; });
  if (rocky.length < beforeCut) notes.push((beforeCut - rocky.length) + ' of your rocky planets would sit beyond the planet-forming limit (' + aHi.toFixed(1) + ' AU here), so they were dropped.');
  var lastRocky = rocky.length ? rocky[rocky.length - 1] : null, firstRocky = rocky.length ? rocky[0] : null;

  /* --- giants: eccentric first (if asked), then a conventional chain beyond the snow line --- */
  var giants = [];      // each: {a, e, hot, eccentric}
  var nCold = nOut - (hotA ? 1 : 0);
  var prevApo = lastRocky ? lastRocky.a * (1 + lastRocky.e) : 0;
  var belts = [];
  var beltBetween = nBelts >= 1 && rocky.length && nOut > 0;       // a belt between the rocky planets and the first giant, like ours
  if (!noPlanets && nOut > 0){
    var gA = [];
    if (hotA) gA.push({a:hotA, e:Math.min(eccGiant(), 0.02), hot:true});
    if (nCold > 0){
      var tight = false, tries = 0, chain = [];
      while (tries < 2){
        chain = []; var lastApo = prevApo;
        var beltA = 0;
        if (beltBetween){ beltA = (lastApo || aLo) * U(1.45, 1.75); lastApo = beltA * 1.12; }
        for (var gi = 0; gi < nCold; gi++){
          var eg = (gi === 0 && cfg.giants === 'e') ? U(0.15, 0.4) : eccGiant(), a;
          if (gi === 0){
            var floorA = Math.max(lastApo ? lastApo * 1.25 / (1 - eg) : 0, aLo * 1.03 / (1 - eg));
            a = cfg.giants === 'e' ? Math.max(floorA, frost * U(0.3, 0.8)) : Math.max(floorA, frost * U(1.0, 1.3));
          } else {
            var pg = chain[gi - 1];
            a = pg.a * (tight ? Math.max(1.4, 1.06 * (1 + pg.e) / (1 - eg)) : stepRatio(pg.e, eg));
          }
          chain.push({a:a, e:eg, eccentric:gi === 0 && cfg.giants === 'e'});
        }
        if (chain[chain.length - 1].a * (1 + chain[chain.length - 1].e) <= aHi || tight) break;
        tight = true; tries++;
      }
      var kept = chain.filter(function(g){ return g.a * (1 + g.e) <= aHi; });
      var fitted = kept.length + (hotA ? 1 : 0);
      if (kept.length < chain.length) notes.push((fitted ? 'Only ' + fitted + ' of your ' + nOut : 'None of your ' + nOut) + ' giants fit before the planet-forming limit (' + aHi.toFixed(0) + ' AU round this star), so the rest were dropped.');
      gA = gA.concat(kept);
    }
    giants = gA;
    nOut = giants.length;
  } else nOut = 0;
  if (beltBetween && giants.length){
    var firstCold = giants.filter(function(g){ return !g.hot; })[0];
    if (firstCold){
      var apoR = lastRocky.a * (1 + lastRocky.e), periG = firstCold.a * (1 - firstCold.e);
      if (periG / apoR >= 1.75) belts.push({a:Math.sqrt(apoR * periG), slot:'between'});
    }
  }
  if (rocky.length && rocky[rocky.length - 1].a > frost * 1.05)
    notes.push('Some rocky planets sit beyond the giant-forming line, because that many rocky planets would not fit inside it.');

  /* --- more belts: outside the outermost planet, then inside the innermost, then in the widest gap --- */
  function planetBands(){
    return rocky.concat(giants).map(function(p){ return {lo:p.a * (1 - p.e), hi:p.a * (1 + p.e)}; });
  }
  function beltFits(a){
    var halfW = 0.12 * a, lo = a - halfW, hi = a + halfW, ok = lo >= aLo * 1.05 && hi <= aHi;
    planetBands().concat(belts.map(function(b){ return {lo:b.a * 0.88, hi:b.a * 1.12}; })).forEach(function(p){
      if (hi * 1.12 > p.lo && lo / 1.12 < p.hi) ok = false;
    });
    return ok;
  }
  function addBelt(a, slot){ if (a > 0 && beltFits(a)){ belts.push({a:a, slot:slot}); return true; } return false; }
  if (!noPlanets){
    var allP = rocky.concat(giants).sort(function(x, y){ return x.a - y.a; });
    var innermost = allP.length ? allP[0] : null, outermost = allP.length ? allP[allP.length - 1] : null;
    var wanted2 = nBelts - belts.length, guard = 0;
    while (wanted2 > 0 && guard++ < 6){
      var placed = false;
      if (outermost) placed = addBelt(outermost.a * (1 + outermost.e) * U(1.45, 1.8), 'outer');
      if (!placed && innermost) placed = addBelt(innermost.a * (1 - innermost.e) / U(1.5, 1.9), 'inner');
      if (!placed){
        var best = null;
        for (var gp = 1; gp < allP.length; gp++){
          var ratio = allP[gp].a * (1 - allP[gp].e) / (allP[gp - 1].a * (1 + allP[gp - 1].e));
          if (ratio > 1.9 && (!best || ratio > best.ratio)) best = {ratio:ratio, a:Math.sqrt(allP[gp].a * (1 - allP[gp].e) * allP[gp - 1].a * (1 + allP[gp - 1].e))};
        }
        if (best) placed = addBelt(best.a, 'gap');
      }
      if (!placed && !allP.length) placed = addBelt(hz.inner * U(1.2, 3), 'lone');
      if (!placed) break;
      wanted2--;
    }
    if (belts.length < nBelts) notes.push(belts.length ? 'Only ' + belts.length + ' of your ' + nBelts + ' asteroid belts found room.' : 'No asteroid belt found room between the planets.');
  }
  belts.sort(function(x, y){ return x.a - y.a; });

  /* --- planets: everything sorted by distance --- */
  var planets = [];
  rocky.forEach(function(r){ planets.push({a:r.a, e:r.e, giant:false, home:!!r.home, hot:false, eccentric:false}); });
  giants.forEach(function(g){ planets.push({a:g.a, e:g.e, giant:true, home:false, hot:!!g.hot, eccentric:!!g.eccentric}); });
  planets.sort(function(x, y){ return x.a - y.a; });

  var bodies = [];
  var starBody = function(id, nm, st, extra){
    var b = {id:id, name:nm, short:nm, kind:'Star, ' + (st.label || 'main sequence'), isStar:true,
      radiusKm:st.R * RSUN_KM, rotH:st.rotH, obliq:+U(0, 8).toFixed(1), color:rgbToInt(st.tint), key:null,
      gen:{type:'star', tint:st.tint, seed:I(1, 99999)},
      Teff:st.Teff, L:st.L, massSun:st.mass, spt:st.spt, tint:st.tint, spanGyr:st.span || null, evolved:!!st.evolved};
    if (extra) for (var k in extra) b[k] = extra[k];
    return b;
  };
  var bin = !!binary;
  var primaryEl = null, companionEl = null;
  if (bin){
    var P2 = binary.periodDays, rate = 360 * 36525 / P2, ph = U(0, 360), incl = +U(0, 4).toFixed(2), node = +U(0, 360).toFixed(3);
    if (binary.regime === 'P'){
      var a1 = binary.sep * binary.mass2 / binary.Mtot, a2 = binary.sep * primary.mass / binary.Mtot;
      primaryEl = {a:[a1, 0], e:[binary.ecc, 0], I:[incl, 0], L:[(ph + 180) % 360, rate], lp:[node, 0], ln:[node, 0]};
      companionEl = {a:[a2, 0], e:[binary.ecc, 0], I:[incl, 0], L:[ph, rate], lp:[node, 0], ln:[node, 0]};
    } else {
      companionEl = {a:[binary.sep, 0], e:[binary.ecc, 0], I:[incl, 0], L:[ph, rate], lp:[node, 0], ln:[node, 0]};
    }
  }
  var primaryBody = starBody('sun', bin ? name + ' A' : name, primary, {primary:true, el:primaryEl || undefined, periodDays:bin ? binary.periodDays : undefined});
  bodies.push(primaryBody);
  if (bin){
    bodies.push(starBody('sun2', name + ' B', companionStar, {companion:true, el:companionEl, periodDays:binary.periodDays, ecc:binary.ecc, aAU:binary.sep,
      kind:'Star, companion (' + companionStar.spt + ')'}));
  }

  var letters = 'bcdefghijklmnopqrstuvwxyz';
  var hillTrimmed = 0, moonsWanted = 0, moonsMade = 0, rockyMoons = 0;
  var starL = Lsys, starM = Msys;
  planets.forEach(function(p, idx){
    var id = 'p' + (idx + 1), pname = name + ' ' + letters[idx];
    var BB = blackbody(starL, p.a), P = periodDays(p.a, starM);
    var locked = p.hot || (!p.giant && p.a < 0.2 * Math.cbrt(starM)), zone = zoneOf(p.a, hz);
    var el = {a:[p.a, 0], e:[p.e, 0], I:[+U(0, 2.5).toFixed(2), 0], L:[+U(0, 360).toFixed(3), 360 * 36525 / P], lp:[+U(0, 360).toFixed(3), 0], ln:[+U(0, 360).toFixed(3), 0]};
    var body, mainRnd = rnd;
    rnd = mulberry32((cfg.seed * 40503 + (idx + 1) * 2654435761 + 12345) >>> 0);    // each planet draws from its own stream, so resizing one leaves the rest alone
    if (p.giant){
      body = makeGiant(p, id, pname, el, P, BB, locked, zone);
    } else {
      body = makeRocky(p, id, pname, el, P, BB, locked, zone);
    }
    bodies.push(body);
    makeMoons(body, p, id, pname, BB);
    rnd = mainRnd;
  });

  // axial tilt: a table (a base from 0 to 80 degrees plus 2d-2)
  function axialTilt(){
    var r = lookup(T.axialTilt, roll(3)), txt = r[1];
    if (/extended/.test(txt)) txt = lookup(T.axialTiltExtended, d6())[1];
    return parseInt(txt, 10) + (d6() + d6() - 2);
  }

  function makeGiant(p, id, pname, el, P, BB, locked, zone){
    var cls = lookup(T.gasGiantSize, roll(3))[1], clsAuto = cls, ov = cfg.sizes[planets.indexOf(p) + 1];   // Small, Medium or Large
    if (ov >= 4) cls = ['Small', 'Medium', 'Large'][ov - 4];
    var gr = lookup(T.gasGiantPhysics, roll(3)), col = cls === 'Small' ? 1 : cls === 'Medium' ? 3 : 5;
    var massE = gr[col], dens = gr[col + 1], D = Math.cbrt(massE / dens);  // diameter in Earth diameters
    var small = cls === 'Small';
    var gen, color, rings = false, kindTxt;
    if (small){
      var base = ICE_BASES[I(0, ICE_BASES.length - 1)];
      gen = {type:'iceGiant', base:base, cloudy:rnd() < 0.5, seed:I(1, 99999)}; color = rgbToInt(base); rings = rnd() < 0.15; kindTxt = 'Planet, ice giant';
    } else {
      gen = {type:'gasGiant', pal:I(0, GAS_PALETTES - 1), bands:I(5, 11), spot:rnd() < 0.5, seed:I(1, 99999)};
      color = [0xc8a07a, 0xd8c08a, 0xb8a8c8, 0xc87a6a, 0x9ab0b8, 0xd0c8a0][gen.pal]; rings = cls === 'Medium' ? rnd() < 0.35 : rnd() < 0.2; kindTxt = 'Planet, gas giant';
    }
    if (p.hot){ rings = false; kindTxt += ' (hot, close to its star)'; }
    else if (p.eccentric) kindTxt += ' (eccentric orbit)';
    var rotH = roll(3) + (cls === 'Small' ? 6 : 0);                         // 3d + a modifier, in hours
    var obl = locked ? U(0, 2) : axialTilt();
    return {id:id, name:pname, short:letters[planets.indexOf(p)], kind:kindTxt, radiusKm:D * REARTH_KM, rotH:locked ? P * 24 : rotH, obliq:+obl.toFixed(1), retro:false,
      lockNote:locked ? 'locked to its star (assumed)' : null, lockTo:locked ? 'sun' : null, periodDays:P, incl:el.I[0], ecc:+p.e.toFixed(3), color:color, key:null, rings:rings,
      el:el, gen:gen, home:false, giant:true, hot:p.hot, eccentric:p.eccentric, ggClass:cls, density:dens, massEarth:massE, aAU:p.a, bbK:BB, zone:zone, moons:[], sizeAuto:clsAuto, sizeSet:cls !== clsAuto};
  }
  
  function makeRocky(p, id, pname, el, P, BB, locked, zone){
    // size class: from an orbit-contents roll, re-rolled until it comes out as a planet; a home world is Standard or Large
    var sc;
    if (p.home) sc = rnd() < 0.8 ? 'Standard' : 'Large';
    else {
      var rr = 0, row;
      do { rr = roll(3); row = lookup(T.orbitContents, rr)[1]; } while (!/Terrestrial/.test(row));
      sc = /Tiny/.test(row) ? 'Tiny' : /Small/.test(row) ? 'Small' : /Large/.test(row) ? 'Large' : 'Standard';
    }
    var scAuto = sc, ov = cfg.sizes[planets.indexOf(p) + 1], tooSmallHome = false;
    if (ov != null && ov <= 3) sc = SIZE_ORDER[ov];
    if (p.home && (sc === 'Tiny' || sc === 'Small')){ tooSmallHome = true; notes.push('The home world was set to ' + sc + ', too small to hold the habitable-zone brief, so it is typed by its temperature like any other world.'); }
    // world type from size class and blackbody temperature (a classification table), then the home world's brief wins
    var type = classify(sc, BB), young = false;
    if (p.home && !tooSmallHome){
      if (cfg.home === 'hz') type = rnd() < 0.8 ? 'Garden' : 'Ocean';
      else if (cfg.home === 'hot') type = 'Greenhouse';
      else type = BB >= 151 && BB <= 230 ? (rnd() < 0.4 ? 'Ammonia' : 'Ice') : 'Ice';
    }
    if (type === 'Garden' && systemAge < GARDEN_MIN_AGE){ type = 'Ocean'; young = true; }
    var core = ({Hadean:0, Ice:0, Ammonia:0, Sulfur:0, Rock:1, Garden:1, Ocean:1, Greenhouse:1, Chthonian:2})[type];
    var dens = lookup(T.densityByCore, roll(3))[1 + core];
    var sizeRow = T.sizeConstraints.filter(function(r){ return r[0] === sc; })[0];
    var lo = Math.sqrt(BB / dens) * sizeRow[1], hi = Math.sqrt(BB / dens) * sizeRow[2];
    if (p.home && !tooSmallHome && cfg.home === 'hz'){ lo = Math.max(lo, Math.min(0.8, hi)); hi = Math.min(hi, Math.max(1.15, lo)); }
    var D = U(lo, hi), grav = dens * D, massE = dens * D * D * D;
    var radiusKm = D * REARTH_KM;
    // atmosphere (pressure factors by world type); worlds without a factor have none to speak of
    var factor = pressureFactor(sc, type), atmMass = factor ? roll(3) / 10 : 0;
    var pressure = atmMass * factor * grav, pcat = factor ? pressureCategory(pressure) : 'None';
    var hydro = type === 'Garden' ? Math.round(U(45, 88)) : type === 'Ocean' ? Math.round(U(88, 100)) : 0;
    var ab = absorption(sc, type, hydro);
    var surface = BB * ab[0] * (1 + atmMass * ab[1]);
    var climate = climateOf(surface);
    var breathable = type === 'Garden' && factor > 0 && pcat !== 'Trace' && pcat !== 'None';
    var marginal = breathable && rnd() < 0.3 ? lookup(T.marginalConstituents, roll(3))[1] : null;
    // tide-locked worlds have a hot day side and a cold night side (day and night factors)
    var tide = null;
    if (locked){
      var tideKey = (pcat === 'None' || pcat === 'Trace') ? 'None or Trace' : pcat;
      var tl = T.tideLocked.filter(function(r){ return r[0] === tideKey; })[0] || T.tideLocked[0];
      tide = {dayK:surface * tl[1], nightK:surface * tl[2], finalAtmosphere:tl[3], hydroPenalty:tl[4]};
    }
    var hab = habitability(pcat, breathable, marginal, type, hydro, climate);
    var roll3 = roll(3);     // resource value table, the column for ordinary worlds
    var rvmRow = T.resourceValue.filter(function(r){ return r[1] && roll3 >= r[1][0] && roll3 <= r[1][1]; })[0] || T.resourceValue[5];
    var volc = lookup(T.volcanic, roll(3) + Math.round(40 * grav / Math.max(systemAge, 0.1)))[1];
    var rotH = locked ? P * 24 : roll(3) + ({Large:6, Standard:10, Small:14, Tiny:18})[sc];     // 3d + a modifier by size, in hours
    var obl = locked ? U(0, 2) : axialTilt();
    var kindTxt = 'Planet, rocky (' + sc + ', ' + TYPE_NAMES[type] + ')' + (p.home ? ', your home world' : '');
    if (young) notes.push('The home world\'s system is too young (under ' + GARDEN_MIN_AGE + ' billion years) for a breathable atmosphere, so it is an ocean world instead of a temperate one.');
    return {id:id, name:pname, short:letters[planets.indexOf(p)], kind:kindTxt, radiusKm:radiusKm, rotH:rotH, obliq:+obl.toFixed(1), retro:false,
      lockNote:locked ? 'locked to its star (assumed)' : null, lockTo:locked ? 'sun' : null, periodDays:P, incl:el.I[0], ecc:+p.e.toFixed(3), color:TYPE_COLOR[type], key:null, rings:false,
      el:el, gen:{type:TYPE_GEN[type], seed:I(1, 99999), v1:rnd(), v2:rnd()}, home:p.home, giant:false, hot:false, sizeClass:sc, worldType:type, density:dens, gravity:grav,
      massEarth:massE, aAU:p.a, bbK:BB, surfaceK:surface, climate:climate, atmosphere:{category:pcat, pressureAtm:pressure, breathable:breathable, marginal:marginal, none:!factor},
      hydro:hydro, tide:tide, volcanic:volc, resources:{label:rvmRow[2], rvm:rvmRow[3]}, habitability:hab, affinity:rvmRow[3] + hab, zone:zone, young:young, moons:[], sizeAuto:scAuto, sizeSet:sc !== scAuto};
  }

  function classify(sc, BB){
    // world classification by size class and blackbody temperature
    if (sc === 'Tiny') return BB <= 140 ? (rnd() < 0.5 ? 'Ice' : 'Sulfur') : 'Rock';
    if (sc === 'Small') return BB <= 80 ? 'Hadean' : BB <= 140 ? 'Ice' : 'Rock';
    var large = sc === 'Large';
    if (BB <= (large ? 150 : 80)) return large ? 'Ice' : 'Hadean';
    if (BB <= 150) return 'Ice';
    if (BB <= 230) return rnd() < 0.5 ? 'Ammonia' : 'Ice';
    if (BB <= 240) return 'Ice';
    if (BB <= 320) return rnd() < 0.6 ? 'Garden' : 'Ocean';
    if (BB <= 500) return 'Greenhouse';
    return 'Chthonian';
  }
  function pressureFactor(sc, type){
    var tbl = T.pressureFactor;
    if (sc === 'Small' && type === 'Ice') return tbl[0][1];
    if (sc === 'Standard' && /^(Ammonia|Ice|Ocean|Garden)$/.test(type)) return tbl[1][1];
    if (sc === 'Standard' && type === 'Greenhouse') return tbl[2][1];
    if (sc === 'Large' && /^(Ammonia|Ice|Ocean|Garden)$/.test(type)) return tbl[3][1];
    if (sc === 'Large' && type === 'Greenhouse') return tbl[4][1];
    return 0;
  }
  function pressureCategory(atm){
    for (var i = 0; i < T.pressureCategories.length; i++){ var u = T.pressureCategories[i][0]; if (u == null || atm <= u) return T.pressureCategories[i][1]; }
    return 'Superdense';
  }
  function absorption(sc, type, hydro){
    var find = function(label){ return T.absorption.filter(function(r){ return r[0] === label; })[0]; }, r;
    if (sc === 'Tiny') r = find('Tiny (' + type + ')');
    else if (sc === 'Small') r = find('Small (' + type + ')');
    else if (type === 'Hadean') r = find('Standard (Hadean)');
    else if (type === 'Ocean' || type === 'Garden'){
      r = find('Standard or Large (Ocean or Garden) (Hydrographics ' + (hydro <= 20 ? '20% or less' : hydro <= 50 ? '21% to 50%' : hydro <= 90 ? '51% to 90%' : '91% or more') + ')');
    } else r = find('Standard or Large (' + type + ')');
    return r ? [r[1], r[2]] : [0.95, 0];
  }
  function climateOf(K){
    for (var i = 0; i < T.climate.length; i++){ var u = T.climate[i][0]; if (u == null || K < u) return T.climate[i][1]; }
    return 'Infernal';
  }
  // habitability modifiers
  function habitability(pcat, breathable, marginal, type, hydro, climate){
    var s = 0;
    if (breathable){
      s += pcat === 'Very Thin' ? 1 : pcat === 'Thin' ? 2 : (pcat === 'Standard' || pcat === 'Dense') ? 3 : (pcat === 'Very Dense' || pcat === 'Superdense') ? 1 : 0;
      if (!marginal) s += 1;
      s += /^(Frozen|Very Cold)$/.test(climate) ? 0 : climate === 'Cold' ? 1 : climate === 'Hot' ? 1 : /^(Very Hot|Infernal)$/.test(climate) ? 0 : 2;
    } else if (pcat !== 'None' && pcat !== 'Trace'){
      s += (type === 'Ammonia' || type === 'Greenhouse') ? -2 : 0;      // toxic and corrosive, against merely suffocating
    }
    if (type === 'Garden' || type === 'Ocean') s += hydro === 0 ? 0 : hydro <= 59 ? 1 : hydro <= 90 ? 2 : hydro <= 99 ? 1 : 0;
    return s;
  }

  /* moons: log-spaced between a minimum distance and a fraction of the Hill sphere */
  function makeMoons(body, p, id, pname, BB){
    var want = p.giant ? cfg.moonsOuter : cfg.moonsInner;
    moonsWanted += want;
    if (want <= 0) return;
    var rKm = body.radiusKm, massE = body.massEarth;
    var hillKm = p.a * (1 - p.e) * AU_KM * Math.cbrt(massE / 333000 / (3 * starM));
    var kMax = Math.min(0.33 * hillKm / rKm, p.giant ? 120 : 60), kMin = (body.rings ? 3.0 : 2.6) + (p.giant ? 0.4 : 0.8);
    var n = 0;       // slots at least 1.4 apart in distance, each moon jittered by at most 0.2 of a slot
    if (kMax > kMin * 1.3) n = Math.min(want, Math.max(1, Math.floor(Math.log(kMax / kMin) / Math.log(1.4))));
    if (n < want) hillTrimmed++;
    for (var mi = 0; mi < n; mi++){
      var k = n === 1 ? kMin * Math.pow(kMax / kMin, U(0.05, 0.9)) : kMin * Math.pow(kMax / kMin, (mi + 0.5 + U(-0.2, 0.2)) / n);
      var aKm = k * rKm, Pm = 2 * Math.PI * Math.sqrt(aKm * aKm * aKm / (MU_EARTH * massE)) / 86400;
      var mr = Math.min(0.35 * rKm, (p.giant ? 150 + Math.pow(rnd(), 2) * 2550 : 120 + Math.pow(rnd(), 2) * 1700));
      var cold = BB < 140;
      var mcol = cold ? 0xcfd6dc : [0x9a9690, 0xa89c8e, 0xb0a090][I(0, 2)];
      var moon = {
        id:id + 'm' + (mi + 1), name:pname + '-' + roman(mi + 1), short:roman(mi + 1), kind:'Moon of ' + pname + ' (' + (cold ? 'icy' : 'rocky') + ')', parent:id,
        radiusKm:mr, rotH:Pm * 24, lockNote:'locked to ' + pname + ' (assumed)', obliq:0, periodDays:Pm, incl:+U(0, 6).toFixed(1), ecc:0,
        color:mcol, key:null, gen:{type:cold ? 'iceMoon' : 'rockMoon', seed:I(1, 99999), v1:rnd()},
        moon:{aKm:aKm, phase0:U(0, 2 * Math.PI), kRadii:k}, isMoon:true, parentMassEarth:massE
      };
      bodies.push(moon); body.moons.push(moon.id); moonsMade++; if (!p.giant) rockyMoons++;
    }
  }

  var rockyAny = planets.some(function(p){ return !p.giant; });
  if (hillTrimmed) notes.push(hillTrimmed + (hillTrimmed === 1 ? ' planet has' : ' planets have') + ' fewer moons than you asked for: past a point a moon can\'t hold an orbit against the star\'s pull (Hill sphere).');
  if (cfg.moonsInner > 0 && rockyAny && !rockyMoons) notes.push('None of the rocky planets can keep a moon here; they sit too close to the star.');
  if (hz.rough) notes.push('The star here is outside the temperature range (2600 K to 7200 K) the habitable-zone fit was made for, so treat the zone as a rough guide.');
  if (cfg.star === 'B' || (cfg.star === 'X' && cfg.mass >= 300)) notes.push('A star this massive lives only a few hundred million years or less, which is not long for anything to get comfortable.');
  if (cfg.star === 'WD') notes.push('Real planets close to a white dwarf would have been rearranged or destroyed when the star shed its outer layers. This is a staged picture.');
  if (cfg.star === 'RG') notes.push('A red giant\'s habitable zone is temporary, and it swells as the star ages. Planets close in would already be gone.');

  // keys 1 to 9 pick the first nine planets
  var pk = 0;
  bodies.forEach(function(b){ if (!b.isStar && !b.isMoon && pk < 9){ pk++; b.key = String(pk); } });

  var home = bodies.filter(function(b){ return b.home; })[0] || null;
  var order = ['sun'];
  if (bin) order.push('sun2');
  if (home) order.push(home.id);
  bodies.filter(function(b){ return b.giant; }).sort(function(a, b){ return b.radiusKm - a.radiusKm; }).forEach(function(b){ order.push(b.id); });
  bodies.filter(function(b){ return !b.isStar && !b.isMoon && !b.giant && !b.home; }).sort(function(a, b){ return b.radiusKm - a.radiusKm; }).forEach(function(b){ order.push(b.id); });
  bodies.filter(function(b){ return b.isMoon; }).forEach(function(b){ order.push(b.id); });

  var reach = planets.length ? Math.max.apply(null, planets.map(function(p){ return p.a * (1 + p.e); })) : hz.outer * 1.5;
  belts.forEach(function(b){ reach = Math.max(reach, b.a * 1.12); });
  if (bin) reach = Math.max(reach, binary.max);
  var refP = home ? home.periodDays : (planets.length ? periodDays(planets[0].a, starM) : (bin ? binary.periodDays : 365.25));
  var beltOut = belts.map(function(b){ return {a:b.a, halfWidth:0.12 * b.a, icy:b.a > frost, slot:b.slot, periodDays:periodDays(b.a, starM), phase0:U(0, 6.2832), seed:I(1, 99999)}; });
  var starDef = {key:cfg.star, label:primary.label};
  return {
    cfg:cfg, name:name, star:starDef, primary:primary, companion:companionStar, binary:binary, bodies:bodies, order:order, notes:notes, belts:beltOut,
    unit:Math.sqrt(Lsys), L:Lsys, Lprimary:primary.L, Lcompanion:companionStar ? companionStar.L : 0, hz:hz, frost:frost, maxA:reach,
    innerLimit:aLo, outerLimit:aHi, epochJd:EPOCH_JD, refPeriodDays:refP, ageGyr:systemAge, homeId:home ? home.id : null,
    counts:{rocky:planets.filter(function(p){ return !p.giant; }).length, giants:planets.filter(function(p){ return p.giant; }).length, belts:belts.length,
            moons:moonsMade, moonsWanted:moonsWanted}
  };
}
function rgbToInt(c){ return (c[0] << 16) | (c[1] << 8) | c[2]; }

return {
  STARS:STARS, STAR_ORDER:STAR_ORDER, MASS_STAR:MASS_STAR, LIMITS:LIMITS, HOMES:HOMES, GIANT_LAYOUTS:GIANT_LAYOUTS, COMPANIONS:COMPANIONS, VERSION:VERSION, EPOCH_JD:EPOCH_JD,
  generate:generate, normalise:normalise, encodeCfg:encodeCfg, decodeCfg:decodeCfg,
  hzBounds:hzBounds, frostLine:frostLine, blackbody:blackbody, teq:teq, periodDays:periodDays, zoneOf:zoneOf, starProps:starProps, starAt:starAt, mainSequenceSpan:mainSequenceSpan,
  mulberry32:mulberry32, GAS_PALETTES:GAS_PALETTES, AU_KM:AU_KM, RSUN_KM:RSUN_KM, REARTH_KM:REARTH_KM, GARDEN_MIN_AGE:GARDEN_MIN_AGE, SIZE_ORDER:SIZE_ORDER, MAX_PLANETS:MAX_PLANETS
};
});
