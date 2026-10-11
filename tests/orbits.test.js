#!/usr/bin/env node
/* Checks the orbit maths against real astronomical events.  Run:  node tests/orbits.test.js
 * No dependencies. Exits 1 if anything fails.
 *
 * How to read the tolerances: JPL's formula is an approximation (its own page lists
 * errors of seconds to minutes of arc for 1800-2050), so these are 'did we get the right
 * answer' checks, not 'to the last digit' checks.
 *
 * Two traps this file exists to remember, both of which the author fell into while writing it:
 *
 *  1. Equinoxes and solstices are defined against the equinox OF THE DATE. JPL's elements use
 *     the equinox of J2000. By 2025 they differ by about 0.35 degrees (precession). Compare
 *     raw and the March equinox looks 0.35 degrees 'wrong'; correct for precession and it is
 *     within a few hundredths of a degree. The raw error also grows the further you are
 *     from 2000, which is the giveaway.
 *
 *  2. Planet oppositions are easy to misdate. Jupiter's were 2024-12-07 and 2026-01-10,
 *     not 2025-01-10. A 'failure' of 31 degrees was just 34 days of Earth's orbit.
 */
'use strict';
function near2(a, b, tol){ return Math.abs(a - b) <= tol; }
var O = require('../src/orbits.js');
var DEG = O.DEG, results = [], failed = 0;

function check(name, ok, detail){
  results.push({name: name, ok: ok, detail: detail});
  console.log((ok ? 'PASS' : 'FAIL') + ' | ' + name + (detail ? '   [' + detail + ']' : ''));
  if (!ok) failed++;
}
function jd(iso){ return O.jdFromDate(new Date(iso)); }
function pos(id, iso){ return O.heliocentric(O.ELEMENTS[id], O.centuries(jd(iso)), {}); }
function lon(p){ return ((Math.atan2(p.y, p.x) / DEG) % 360 + 360) % 360; }
function dist(p){ return Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z); }
function diff(a, b){ return ((a - b + 540) % 360) - 180; }       // signed, in (-180, 180]

/* --- the table itself --- */
var names = ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'];
check('JPL table has all eight planets, six elements each, value and rate',
  names.every(function(n){ var e = O.ELEMENTS[n]; return ['a','e','I','L','lp','ln'].every(function(k){ return e[k] && e[k].length === 2 && e[k].every(isFinite); }); }));
check('planets get further from the Sun in order',
  names.every(function(n, i){ return i === 0 || O.ELEMENTS[n].a[0] > O.ELEMENTS[names[i - 1]].a[0]; }));

/* --- Kepler's equation --- */
(function(){
  var worst = 0, cases = 0;
  [0, 0.0167, 0.0934, 0.2056, 0.5, 0.9].forEach(function(e){
    for (var M = -3.1; M <= 3.1; M += 0.31){
      var E = O.solveKepler(M, e);                       // the shipped solver, not a copy of it
      worst = Math.max(worst, Math.abs(E - e * Math.sin(E) - M)); cases++;
    }
  });
  check('Kepler solver reproduces M = E - e sin E (eccentricities 0 to 0.9)', worst < 1e-9, cases + ' cases, worst residual ' + worst.toExponential(1));
})();

/* --- Earth: equinoxes and solstices, with the precession correction --- */
[['March equinox 2025',     '2025-03-20T09:01:00Z', 180],
 ['June solstice 2025',     '2025-06-21T02:42:00Z', 270],
 ['September equinox 2025', '2025-09-22T18:19:00Z', 0],
 ['December solstice 2025', '2025-12-21T15:03:00Z', 90],
 ['March equinox 2020',     '2020-03-20T03:50:00Z', 180],
 ['September equinox 2010', '2010-09-23T03:09:00Z', 0],
 ['March equinox 1900',     '1900-03-21T01:00:00Z', 180]].forEach(function(c){
  var l = lon(pos('earth', c[1])), raw = diff(l, c[2]), fixed = diff(l + O.precessionDeg(jd(c[1])), c[2]);
  check(c[0] + ': Earth lands on ' + c[2] + ' degrees once precession is allowed for', Math.abs(fixed) <= 0.06,
        'raw ' + raw.toFixed(3) + ' deg, corrected ' + fixed.toFixed(3) + ' deg');
});

/* --- Earth: nearest and furthest from the Sun --- */
(function(){
  var p = dist(pos('earth', '2025-01-04T13:28:00Z')), a = dist(pos('earth', '2025-07-03T19:54:00Z'));
  check('Perihelion 2025-01-04: about 0.9833 AU', Math.abs(p - 0.9833) < 0.0006, p.toFixed(5) + ' AU');
  check('Aphelion 2025-07-03: about 1.0167 AU', Math.abs(a - 1.0167) < 0.0006, a.toFixed(5) + ' AU');
  var min = 9, max = 0, minD, maxD;
  for (var d = 0; d < 366; d++){
    var t = new Date(Date.UTC(2025, 0, 1) + d * 864e5).toISOString(), r = dist(pos('earth', t));
    if (r < min){ min = r; minD = t.slice(0, 10); } if (r > max){ max = r; maxD = t.slice(0, 10); }
  }
  check('Scanning 2025: closest day is early January, furthest early July',
    minD >= '2025-01-02' && minD <= '2025-01-06' && maxD >= '2025-07-01' && maxD <= '2025-07-05', minD + ' / ' + maxD);
})();
check('J2000: Earth near heliocentric longitude 100.4 degrees', Math.abs(diff(lon(pos('earth', '2000-01-01T12:00:00Z')), 100.4)) < 0.25,
      lon(pos('earth', '2000-01-01T12:00:00Z')).toFixed(3));

/* --- Oppositions: Earth and the planet on the same side of the Sun --- */
[['Mars 2020-10-13',    '2020-10-13T12:00:00Z', 'mars'],
 ['Mars 2022-12-08',    '2022-12-08T12:00:00Z', 'mars'],
 ['Mars 2025-01-16',    '2025-01-16T02:38:00Z', 'mars'],
 ['Jupiter 2024-12-07', '2024-12-07T12:00:00Z', 'jupiter'],
 ['Jupiter 2026-01-10', '2026-01-10T12:00:00Z', 'jupiter'],
 ['Saturn 2024-09-08',  '2024-09-08T12:00:00Z', 'saturn'],
 ['Saturn 2025-09-21',  '2025-09-21T12:00:00Z', 'saturn']].forEach(function(c){
  var g = Math.abs(diff(lon(pos(c[2], c[1])), lon(pos('earth', c[1]))));
  check('Opposition ' + c[0] + ': heliocentric longitudes within 3 degrees', g < 3, g.toFixed(2) + ' deg');
});
(function(){
  var a = lon(pos('jupiter', '2020-01-01T00:00:00Z')), b = lon(pos('jupiter', '2021-01-01T00:00:00Z')), moved = diff(b, a);
  check("Jupiter moves about 30.3 degrees in a year (mean motion 3034.7 deg per century)", Math.abs(moved - 30.35) < 2.5, moved.toFixed(2) + ' deg');
})();

/* --- every planet stays between its own perihelion and aphelion --- */
(function(){
  var bad = [];
  names.forEach(function(n){
    var el = O.ELEMENTS[n];
    for (var y = 1850; y <= 2040; y += 7){
      var T = O.centuries(jd(y + '-06-15T00:00:00Z')), s = O.elementsAt(el, T), r = dist(O.heliocentric(el, T, {}));
      if (r < s.a * (1 - s.e) - 1e-9 || r > s.a * (1 + s.e) + 1e-9) bad.push(n + ' ' + y);
    }
  });
  check('Distances always lie between perihelion and aphelion (1850 to 2040)', bad.length === 0, bad.slice(0, 3).join(', '));
})();

/* --- the Moon: MEAN phase, so allow about eight degrees (half a day) --- */
function elong(iso){ return O.moonElongation(jd(iso)) / DEG; }
[['Full moon 2025-02-12',  '2025-02-12T13:53:00Z', 180], ['Full moon 2025-03-14 (lunar eclipse)', '2025-03-14T06:59:00Z', 180],
 ['Full moon 2025-09-07 (lunar eclipse)', '2025-09-07T18:11:00Z', 180],
 ['New moon 2025-03-29 (solar eclipse)',  '2025-03-29T10:48:00Z', 0], ['New moon 2025-04-27', '2025-04-27T19:31:00Z', 0]].forEach(function(c){
  var e = elong(c[1]);
  check(c[0] + ': mean elongation near ' + c[2] + ' degrees (within 8)', Math.abs(diff(e, c[2])) <= 8, e.toFixed(1) + ' deg');
});

/* --- travel maths, against textbook figures --- */
var O2 = require('../src/orbits.js'), hm = O2.hohmann(1, 1.524, 1);
check('Earth to Mars Hohmann transfer: about 2.94 + 2.65 = 5.59 km/s', near2(hm.dv1, 2.94, 0.02) && near2(hm.dv2, 2.65, 0.02) && near2(hm.total, 5.59, 0.03), hm.dv1.toFixed(3) + ' + ' + hm.dv2.toFixed(3));
check('Earth to Mars Hohmann transfer takes about 259 days', near2(hm.days, 259, 1.5), hm.days.toFixed(1) + ' days');
var hb = O2.hohmann(1.524, 1, 1);
check('The transfer costs the same and takes as long going inwards', near2(hb.total, hm.total, 1e-9) && near2(hb.days, hm.days, 1e-9));
check('Light takes about 499 seconds to cross one AU', near2(O2.lightSeconds(1), 499.0, 0.1));
check('One gravity, accelerate then decelerate, 1 AU: about 2.86 days (2 x sqrt(d / a))', near2(O2.brachistochrone(1, 1) / 86400, 2.86, 0.01), (O2.brachistochrone(1, 1) / 86400).toFixed(2) + ' days');

console.log(failed ? '\n' + failed + ' of ' + results.length + ' FAILED' : '\nAll ' + results.length + ' checks passed.');
process.exit(failed ? 1 : 0);
