/* Solarify orbital maths. Author: TABARC-Code. MIT licence.
 *
 * Planet positions use the Keplerian elements and the algorithm NASA JPL publishes in
 * "Keplerian Elements for Approximate Positions of the Major Planets"
 * (ssd.jpl.nasa.gov/planets/approx_pos.html), Table 1, valid 1800 AD to 2050 AD.
 *
 * Things worth knowing:
 *   - Angles in that table are measured against the ecliptic and equinox of J2000.
 *     Equinoxes and solstices are defined by the equinox of the DATE, which has drifted
 *     since 2000 (precession, about 0.0140 degrees a year). So 'Earth is at heliocentric
 *     longitude 180 degrees at the March equinox' is only true in the date's frame.
 *     precessionDeg() converts. tests/orbits.test.js does exactly that.
 *   - 'earth' below is the Earth-Moon barycentre, as JPL tabulates it. The real Earth is
 *     under 5,000 km from it.
 *   - The Moon is NOT an ephemeris. moonElongation() is the MEAN phase (mean synodic month),
 *     so it can be off by up to about half a day against the true phase.
 *
 * Works in a browser (window.SolarifyOrbits) and in Node (require), with no dependencies.
 */
(function(root, factory){
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.SolarifyOrbits = api;
})(typeof window !== 'undefined' ? window : this, function(){
'use strict';

var TAU = Math.PI * 2, DEG = Math.PI / 180;
var J2000 = 2451545.0, JD_UNIX = 2440587.5;
var JD_NEW_MOON = 2451550.09766;      // 2000-01-06 18:14 UT, a new moon (Meeus)
var SYNODIC = 29.530588861;           // mean days between new moons
var MOON_INCL = 5.145 * DEG;

// [value at J2000, change per Julian century]: a (au), e, I (deg), L (deg), long.peri (deg), long.node (deg)
var ELEMENTS = {
  mercury: {a:[0.38709927,0.00000037], e:[0.20563593,0.00001906], I:[7.00497902,-0.00594749],
            L:[252.25032350,149472.67411175], lp:[77.45779628,0.16047689], ln:[48.33076593,-0.12534081]},
  venus:   {a:[0.72333566,0.00000390], e:[0.00677672,-0.00004107], I:[3.39467605,-0.00078890],
            L:[181.97909950,58517.81538729], lp:[131.60246718,0.00268329], ln:[76.67984255,-0.27769418]},
  earth:   {a:[1.00000261,0.00000562], e:[0.01671123,-0.00004392], I:[-0.00001531,-0.01294668],
            L:[100.46457166,35999.37244981], lp:[102.93768193,0.32327364], ln:[0.0,0.0]},
  mars:    {a:[1.52371034,0.00001847], e:[0.09339410,0.00007882], I:[1.84969142,-0.00813131],
            L:[-4.55343205,19140.30268499], lp:[-23.94362959,0.44441088], ln:[49.55953891,-0.29257343]},
  jupiter: {a:[5.20288700,-0.00011607], e:[0.04838624,-0.00013253], I:[1.30439695,-0.00183714],
            L:[34.39644051,3034.74612775], lp:[14.72847983,0.21252668], ln:[100.47390909,0.20469106]},
  saturn:  {a:[9.53667594,-0.00125060], e:[0.05386179,-0.00050991], I:[2.48599187,0.00193609],
            L:[49.95424423,1222.49362201], lp:[92.59887831,-0.41897216], ln:[113.66242448,-0.28867794]},
  uranus:  {a:[19.18916464,-0.00196176], e:[0.04725744,-0.00004397], I:[0.77263783,-0.00242939],
            L:[313.23810451,428.48202785], lp:[170.95427630,0.40805281], ln:[74.01692503,0.04240589]},
  neptune: {a:[30.06992276,0.00026291], e:[0.00859048,0.00005105], I:[1.77004347,0.00035372],
            L:[-55.12002969,218.45945325], lp:[44.96476227,-0.32241464], ln:[131.78422574,-0.00508664]}
};

function norm180(r){ r = r % TAU; if (r > Math.PI) r -= TAU; if (r < -Math.PI) r += TAU; return r; }

function elementsAt(el, T){
  return {
    a:  el.a[0]  + el.a[1]  * T,
    e:  el.e[0]  + el.e[1]  * T,
    I:  (el.I[0]  + el.I[1]  * T) * DEG,
    L:  (el.L[0]  + el.L[1]  * T) * DEG,
    lp: (el.lp[0] + el.lp[1] * T) * DEG,
    ln: (el.ln[0] + el.ln[1] * T) * DEG
  };
}
function solveKepler(M, e){
  var E = M + e * Math.sin(M);
  for (var i = 0; i < 30; i++){
    var dE = (M - (E - e * Math.sin(E))) / (1 - e * Math.cos(E));
    E += dE;
    if (Math.abs(dE) < 1e-11) break;
  }
  return E;
}
// Orbital-plane point to J2000 ecliptic (x toward the equinox, z toward ecliptic north).
function toEcliptic(xp, yp, w, I, ln, out){
  var cw = Math.cos(w), sw = Math.sin(w), cn = Math.cos(ln), sn = Math.sin(ln), ci = Math.cos(I), si = Math.sin(I);
  out.x = (cw * cn - sw * sn * ci) * xp + (-sw * cn - cw * sn * ci) * yp;
  out.y = (cw * sn + sw * cn * ci) * xp + (-sw * sn + cw * cn * ci) * yp;
  out.z = (sw * si) * xp + (cw * si) * yp;
  return out;
}
// Heliocentric position in au, J2000 ecliptic. T is Julian centuries since J2000.
function heliocentric(el, T, out){
  var s = elementsAt(el, T);
  var M = norm180(s.L - s.lp);
  var E = solveKepler(M, s.e);
  var xp = s.a * (Math.cos(E) - s.e), yp = s.a * Math.sqrt(1 - s.e * s.e) * Math.sin(E);
  return toEcliptic(xp, yp, s.lp - s.ln, s.I, s.ln, out || {});
}

function jdFromDate(d){ return d.getTime() / 86400000 + JD_UNIX; }
function dateFromJd(jd){ return new Date((jd - JD_UNIX) * 86400000); }
function centuries(jd){ return (jd - J2000) / 36525; }

// General precession in longitude since J2000, in degrees (IAU 2006: 5028.796195 arcsec per century,
// plus 1.1054348 arcsec per century squared).
function precessionDeg(jd){
  var T = centuries(jd);
  return (5028.796195 * T + 1.1054348 * T * T) / 3600;
}

// Mean angle from the Sun to the Moon, as seen from Earth, in radians (0 new, pi full).
function moonElongation(jd){ var f = ((jd - JD_NEW_MOON) / SYNODIC) % 1; if (f < 0) f += 1; return f * TAU; }
function moonDirEcl(lambda, out){
  var beta = MOON_INCL * Math.sin(lambda);
  out.x = Math.cos(beta) * Math.cos(lambda);
  out.y = Math.cos(beta) * Math.sin(lambda);
  out.z = Math.sin(beta);
  return out;
}

return {
  ELEMENTS: ELEMENTS, elementsAt: elementsAt, solveKepler: solveKepler, heliocentric: heliocentric, toEcliptic: toEcliptic,
  jdFromDate: jdFromDate, dateFromJd: dateFromJd, centuries: centuries, precessionDeg: precessionDeg,
  moonElongation: moonElongation, moonDirEcl: moonDirEcl,
  J2000: J2000, JD_UNIX: JD_UNIX, DEG: DEG, TAU: TAU
};
});
