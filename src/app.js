/* Solarify. Author: TABARC-Code. MIT licence.
 *
 * Two kinds of system live in this file.
 *
 * Our Solar System (the default):
 *   - Sizes, spin, tilt and orbit periods: NASA Planetary Fact Sheet
 *     (nssdc.gsfc.nasa.gov/planetary/factsheet).
 *   - Planet positions: the Keplerian elements and algorithm NASA JPL publishes
 *     in "Keplerian Elements for Approximate Positions of the Major Planets"
 *     (ssd.jpl.nasa.gov/planets/approx_pos.html), Table 1, valid 1800 to 2050.
 *   - The Moon is NOT an ephemeris. Its phase uses the mean synodic month and its
 *     orbit is a circle.
 *
 * A built system ("Build your own"): made up by src/system.js. Real star numbers, real
 * habitable-zone maths, invented planets. Nothing in it claims to be an actual place.
 * See README for what is real and what is staged.
 */
(function(){
'use strict';

var THREE = window.THREE, O = window.SolarifyOrbits, SYS = window.SolarifySystem;
var TAU = Math.PI * 2, DEG = Math.PI / 180;
var AU_KM = 149597870.7, C_KMS = 299792.458;
var SCENE_AU_TRUE = 20;               // scene units per 'system unit' when distances are true
var SQUEEZE_K = 8;                    // squeezed distance = 8 * sqrt(AU / system unit)
var JD_MIN = 2086307.5, JD_MAX = 2816787.5;   // years 1000 to 3000, our own system
var CUSTOM_SPAN_DAYS = 36525000;      // a built system runs 100,000 years either side of its start

function $(id){ return document.getElementById(id); }
function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
function mix(a, b, t){ return a + (b - a) * t; }
function smooth(a, b, x){ var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function fmtNum(n, digits){ return n.toLocaleString('en-GB', {maximumFractionDigits: digits == null ? 0 : digits}); }

/* ------------------------------------------------------------------
   1. Data
   The orbit elements for our own system live in orbits.js (JPL Table 1). 'earth' there is the
   Earth-Moon barycentre, as JPL tabulates it; the real Earth is under 5,000 km from it,
   far below a pixel here. A built system comes from system.js in the same shape.
------------------------------------------------------------------ */
function solarDef(){
  var bodies = [
    {id:'sun', name:'Sun', kind:'Star', isStar:true, radiusKm:695700, diameter:'1,391,400 km', rotH:609.12,
     rotNote:'at 16° latitude', obliq:7.25, color:0xffb040, key:null, gen:{type:'sol', id:'sun'},
     glowInner:'rgba(255,236,190,1)', glowOuter:'rgba(255,170,60,0.55)', lightColor:0xfff2dc, primary:true},
    {id:'mercury', name:'Mercury', kind:'Planet, rocky', radiusKm:2439.5, rotH:1407.6, obliq:0.034,
     periodDays:88.0, incl:7.0, ecc:0.206, color:0x9a8f84, key:'1', gen:{type:'sol', id:'mercury'}},
    {id:'venus', name:'Venus', kind:'Planet, rocky', radiusKm:6052, rotH:5832.5, retro:true, obliq:177.4,
     periodDays:224.7, incl:3.4, ecc:0.007, color:0xe0c690, key:'2', gen:{type:'sol', id:'venus'}},
    {id:'earth', name:'Earth', kind:'Planet, rocky', radiusKm:6378, rotH:23.9, obliq:23.4,
     periodDays:365.2, incl:0.0, ecc:0.017, color:0x3a74b8, key:'3', gen:{type:'sol', id:'earth'}},
    {id:'mars', name:'Mars', kind:'Planet, rocky', radiusKm:3396, rotH:24.6, obliq:25.2,
     periodDays:687.0, incl:1.8, ecc:0.094, color:0xb4623a, key:'4', gen:{type:'sol', id:'mars'}},
    {id:'jupiter', name:'Jupiter', kind:'Planet, gas giant', radiusKm:71492, trojans:true, rotH:9.9, obliq:3.1,
     periodDays:4331, incl:1.3, ecc:0.049, color:0xc8a07a, key:'5', gen:{type:'sol', id:'jupiter'}},
    {id:'saturn', name:'Saturn', kind:'Planet, gas giant', radiusKm:60268, rotH:10.7, obliq:26.7,
     periodDays:10747, incl:2.5, ecc:0.052, color:0xd8c08a, key:'6', rings:true, gen:{type:'sol', id:'saturn'}},
    {id:'uranus', name:'Uranus', kind:'Planet, ice giant', radiusKm:25559, rotH:17.2, retro:true, obliq:97.8,
     periodDays:30589, incl:0.8, ecc:0.047, color:0x98d6e0, key:'7', gen:{type:'sol', id:'uranus'}},
    {id:'neptune', name:'Neptune', kind:'Planet, ice giant', radiusKm:24764, rotH:16.1, obliq:28.3,
     periodDays:59800, incl:1.8, ecc:0.010, color:0x3a5fd0, key:'8', gen:{type:'sol', id:'neptune'}},
    {id:'moon', name:'Moon', kind:'Moon of Earth', isMoon:true, parent:'earth', radiusKm:1737.5, rotH:655.7, lockNote:'locked to Earth',
     obliq:6.7, periodDays:27.3, incl:5.145, ecc:0.055, color:0xaaaaaa, key:'9', gen:{type:'sol', id:'moon'},
     moon:{aKm:384400, real:true}}
  ];
  bodies.forEach(function(b){ if (O.ELEMENTS[b.id]) b.el = O.ELEMENTS[b.id]; });
  var nep = O.ELEMENTS.neptune;
  return {
    mode:'sol', name:'Solar System', bodies:bodies, unit:1, L:1, epochJd:null,
    hz:SYS.hzBounds(5772, 1), frost:SYS.frostLine(1), maxA:nep.a[0] * (1 + nep.e[0]),
    order:['sun', 'jupiter', 'saturn', 'earth', 'mars', 'venus', 'mercury', 'uranus', 'neptune', 'moon'],
    homeId:null, notes:[], belts:[{a:2.7, halfWidth:0.5, icy:false, periodDays:Math.sqrt(Math.pow(2.7, 3)) * 365.25, phase0:1.1, seed:77, label:'Main asteroid belt', spread:0.18}], binary:null
  };
}

var BODIES = [], byId = {}, PLANETS = [], MOONS = [];
var sys = null;        // the system on screen right now

var SPEEDS = [
  {days:1 / 86400, label:'Real time'},
  {days:1 / 24,    label:'1 hour/s'},
  {days:1,         label:'1 day/s'},
  {days:10,        label:'10 days/s'},
  {days:30.4375,   label:'1 month/s'},
  {days:91.3125,   label:'3 months/s'},
  {days:365.25,    label:'1 year/s'}
];

/* ------------------------------------------------------------------
   2. Orbital maths lives in orbits.js, so it can be tested without a browser.
------------------------------------------------------------------ */
var elementsAt = O.elementsAt, heliocentric = O.heliocentric, toEcliptic = O.toEcliptic;
var jdFromDate = O.jdFromDate, dateFromJd = O.dateFromJd, centuries = O.centuries;
var moonElongation = O.moonElongation, moonDirEcl = O.moonDirEcl;

/* ------------------------------------------------------------------
   3. State
------------------------------------------------------------------ */
var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
var state = {
  jd: jdFromDate(new Date()), speedIdx: 3, paused: !!reducedMotion, dir: 1,
  trueDist: false, trueSize: false, orbits: true, labels: true, stars: true, zone: true,
  focus: 'sun', overview: true
};
(function loadView(){
  try{
    var v = JSON.parse(localStorage.getItem('solarify.view') || '{}');
    ['trueDist','trueSize','orbits','labels','stars','zone'].forEach(function(k){ if (typeof v[k] === 'boolean') state[k] = v[k]; });
    if (typeof v.speedIdx === 'number' && v.speedIdx >= 0 && v.speedIdx < SPEEDS.length) state.speedIdx = Math.round(v.speedIdx);
  }catch(e){}
})();
var solarSpeedIdx = state.speedIdx;     // remembered separately so a built system doesn't overwrite it
function saveView(){
  try{
    localStorage.setItem('solarify.view', JSON.stringify({trueDist:state.trueDist, trueSize:state.trueSize,
      orbits:state.orbits, labels:state.labels, stars:state.stars, zone:state.zone, speedIdx:solarSpeedIdx}));
  }catch(e){}
}

/* ------------------------------------------------------------------
   4. Scene
------------------------------------------------------------------ */
var stage = $('stage');
var renderer;
try{
  renderer = new THREE.WebGLRenderer({antialias:true, preserveDrawingBuffer:true, logarithmicDepthBuffer:true});
}catch(err){
  stage.innerHTML = '<p style="padding:40px;max-width:46ch;line-height:1.5">Solarify needs WebGL, and this browser has it switched off or does not offer it. Try a current Chrome, Edge, Firefox or Safari, and check hardware acceleration is on.</p>';
  return;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.setClearColor(0x03050b, 1);
stage.appendChild(renderer.domElement);
var maxAniso = renderer.capabilities.getMaxAnisotropy();

var scene = new THREE.Scene();
var camera = new THREE.PerspectiveCamera(45, 1, 1e-5, 1e5);
var universe = new THREE.Group();     // everything lives in here; it is moved so the focus sits at the origin
scene.add(universe);

universe.add(new THREE.AmbientLight(0x2a3550, 0.55));

var stars = (function(){
  var n = 3500, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), s = 12345;
  function rnd(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
  for (var i = 0; i < n; i++){
    var u = rnd() * 2 - 1, th = rnd() * TAU, r = Math.sqrt(1 - u * u), R = 40000;
    pos[i*3] = R * r * Math.cos(th); pos[i*3+1] = R * u; pos[i*3+2] = R * r * Math.sin(th);
    var b = 0.45 + rnd() * 0.55, tint = rnd();
    col[i*3] = b * (0.85 + 0.15 * tint); col[i*3+1] = b * 0.92; col[i*3+2] = b * (1 - 0.15 * tint);
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  var pts = new THREE.Points(g, new THREE.PointsMaterial({size:1.6, sizeAttenuation:false, vertexColors:true, depthWrite:false}));
  pts.renderOrder = -1;
  scene.add(pts);
  return pts;
})();

/* ------------------------------------------------------------------
   5. Procedural textures. Seamless because the noise is sampled in 3D on the
   sphere itself, so there is no seam at the date line and no pinching at the poles.
------------------------------------------------------------------ */
function Noise(seed){
  var p = new Uint8Array(512), i, s = seed >>> 0;
  for (i = 0; i < 256; i++) p[i] = i;
  for (i = 255; i > 0; i--){ s = (s * 1664525 + 1013904223) >>> 0; var j = s % (i + 1), t = p[i]; p[i] = p[j]; p[j] = t; }
  for (i = 0; i < 256; i++) p[i + 256] = p[i];
  function fade(t){ return t * t * (3 - 2 * t); }
  function lerp(a, b, t){ return a + (b - a) * t; }
  this.n3 = function(x, y, z){
    var X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    var fx = x - X, fy = y - Y, fz = z - Z;
    X &= 255; Y &= 255; Z &= 255;
    var u = fade(fx), v = fade(fy), w = fade(fz);
    var A = p[X] + Y, AA = p[A] + Z, AB = p[A + 1] + Z, B = p[X + 1] + Y, BA = p[B] + Z, BB = p[B + 1] + Z;
    return lerp(
      lerp(lerp(p[AA] / 255, p[BA] / 255, u), lerp(p[AB] / 255, p[BB] / 255, u), v),
      lerp(lerp(p[AA + 1] / 255, p[BA + 1] / 255, u), lerp(p[AB + 1] / 255, p[BB + 1] / 255, u), v), w);
  };
  this.fbm = function(x, y, z, oct){
    var sum = 0, amp = 0.5, f = 1, norm = 0;
    for (var o = 0; o < oct; o++){ sum += amp * this.n3(x * f, y * f, z * f); norm += amp; amp *= 0.5; f *= 2.03; }
    return sum / norm;
  };
}

// Textures are painted in slices of a few milliseconds per frame, so the page never
// freezes while ten planets are being made. run(deadline) returns true when finished.
function paintJob(W, H, seed, fn, post){
  var cv = document.createElement('canvas'); cv.width = W; cv.height = H;
  var ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), d = img.data, o = [0, 0, 0], N = new Noise(seed), y = 0;
  var cosLon = new Float32Array(W), sinLon = new Float32Array(W);
  for (var x = 0; x < W; x++){ var lon = (x + 0.5) / W * TAU - Math.PI; cosLon[x] = Math.cos(lon); sinLon[x] = Math.sin(lon); }
  return {
    canvas: cv,
    run: function(deadline){
      while (y < H){
        var lat = Math.PI / 2 - (y + 0.5) / H * Math.PI, cl = Math.cos(lat), sl = Math.sin(lat);
        for (var xx = 0; xx < W; xx++){
          fn(N, cl * cosLon[xx], sl, -cl * sinLon[xx], lat, o);   // -sin: three's sphere runs u toward -z
          var i = (y * W + xx) * 4;
          d[i] = o[0]; d[i+1] = o[1]; d[i+2] = o[2]; d[i+3] = 255;
        }
        y++;
        if ((y & 3) === 0 && performance.now() > deadline) return false;
      }
      ctx.putImageData(img, 0, 0);
      if (post) post({canvas:cv, ctx:ctx, W:W, H:H, N:N});
      return true;
    }
  };
}
function craters(t, count, seed, strength){
  var ctx = t.ctx, W = t.W, H = t.H, s = seed >>> 0;
  function rnd(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
  for (var i = 0; i < count; i++){
    var lat = Math.asin(rnd() * 2 - 1), x = rnd() * W, y = (Math.PI / 2 - lat) / Math.PI * H;
    var r = (2 + Math.pow(rnd(), 3) * 22) * (W / 1024), sx = 1 / Math.max(0.25, Math.cos(lat));
    for (var k = -1; k <= 1; k++){
      ctx.save(); ctx.translate(x + k * W, y); ctx.scale(sx, 1);
      var g = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.2);
      g.addColorStop(0, 'rgba(0,0,0,' + (0.30 * strength) + ')');
      g.addColorStop(0.72, 'rgba(0,0,0,' + (0.16 * strength) + ')');
      g.addColorStop(0.86, 'rgba(255,255,255,' + (0.22 * strength) + ')');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r * 1.2, 0, TAU); ctx.fill(); ctx.restore();
    }
  }
}

var GEN = {
  sun: function(W, H){
    return paintJob(W, H, 11, function(N, x, y, z, lat, o){
      var g = N.fbm(x * 7, y * 7, z * 7, 5), t = Math.pow(g, 1.4);
      o[0] = mix(205, 255, t); o[1] = mix(80, 232, t); o[2] = mix(10, 130, t * t);
    });
  },
  earth: function(W, H){
    return paintJob(W, H, 23, function(N, x, y, z, lat, o){
      var h = N.fbm(x * 2.0 + 3, y * 2.0, z * 2.0, 6), r, g, b;
      if (h > 0.5){
        var e = clamp((h - 0.5) * 4, 0, 1), dry = N.fbm(x * 3 + 9, y * 3, z * 3 + 4, 4);
        var t = clamp(dry * 0.75 + e * 0.5, 0, 1);
        r = mix(64, 128, t); g = mix(122, 110, t); b = mix(54, 74, t);          // green lowlands, muted tan uplands
        if (e > 0.88){ r = g = b = mix(150, 235, (e - 0.88) / 0.12); }
      } else {
        var dpt = clamp((0.5 - h) * 3.2, 0, 1);
        r = mix(48, 8, dpt); g = mix(112, 38, dpt); b = mix(176, 100, dpt);
      }
      var alat = Math.abs(lat) + (N.n3(x * 7, y * 7, z * 7) - 0.5) * 0.28, ice = smooth(1.14, 1.30, alat);
      r = mix(r, 238, ice); g = mix(g, 244, ice); b = mix(b, 250, ice);
      var c = N.fbm(x * 3.1 + 20, y * 5.2, z * 3.1, 5), ca = smooth(0.54, 0.80, c) * 0.78;
      o[0] = mix(r, 255, ca); o[1] = mix(g, 255, ca); o[2] = mix(b, 255, ca);
    });
  },
  mars: function(W, H){
    return paintJob(W, H, 31, function(N, x, y, z, lat, o){
      var a = N.fbm(x * 2.4, y * 2.4, z * 2.4, 5), d = smooth(0.52, 0.62, N.fbm(x * 1.7 + 6, y * 1.7, z * 1.7, 4));
      var r = mix(190, 150, a) , g = mix(108, 76, a), b = mix(66, 46, a);
      r = mix(r, 92, d * 0.8); g = mix(g, 56, d * 0.8); b = mix(b, 42, d * 0.8);
      var cap = smooth(1.38, 1.46, Math.abs(lat) + (N.n3(x * 8, y * 8, z * 8) - 0.5) * 0.1);
      o[0] = mix(r, 240, cap); o[1] = mix(g, 240, cap); o[2] = mix(b, 245, cap);
    });
  },
  venus: function(W, H){
    return paintJob(W, H, 41, function(N, x, y, z, lat, o){
      var wx = N.fbm(x * 1.6, y * 3.2, z * 1.6, 3), v = N.fbm(x * 2 + wx * 1.4, y * 5 + wx, z * 2 + wx * 1.4, 5);
      o[0] = mix(236, 205, v); o[1] = mix(212, 168, v); o[2] = mix(158, 108, v);
    });
  },
  gasGiant: function(palette, seed, bands, spot){
    return function(W, H){
      return paintJob(W, H, seed, function(N, x, y, z, lat, o){
        var warp = N.fbm(x * 2, y * 7, z * 2, 4), v = 0.5 + 0.5 * Math.sin((y * bands + (warp - 0.5) * 1.5) * Math.PI);
        var storm = N.fbm(x * 6, y * 16, z * 6, 3);
        v = clamp(v * 0.85 + (storm - 0.5) * 0.5 + 0.08, 0, 1);
        o[0] = mix(palette[0][0], palette[1][0], v); o[1] = mix(palette[0][1], palette[1][1], v); o[2] = mix(palette[0][2], palette[1][2], v);
      }, spot ? function(t){
        var ctx = t.ctx, cx = W * 0.62, cy = (Math.PI / 2 + 22 * DEG) / Math.PI * H;
        var g = ctx.createRadialGradient(cx, cy, 0, cx, cy, W * 0.05);
        g.addColorStop(0, 'rgba(196,84,52,0.95)'); g.addColorStop(0.65, 'rgba(204,110,70,0.75)'); g.addColorStop(1, 'rgba(204,110,70,0)');
        ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.62); ctx.translate(-cx, -cy);
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, W * 0.05, 0, TAU); ctx.fill(); ctx.restore();
      } : null);
    };
  },
  iceGiant: function(base, seed, cloudy){
    return function(W, H){
      return paintJob(W, H, seed, function(N, x, y, z, lat, o){
        var v = N.fbm(x * 2, y * 9, z * 2, 4), c = cloudy ? smooth(0.6, 0.78, N.fbm(x * 4 + 5, y * 11, z * 4, 4)) : 0;
        o[0] = mix(base[0] - 14, base[0] + 12, v) ; o[1] = mix(base[1] - 14, base[1] + 12, v); o[2] = mix(base[2] - 10, base[2] + 10, v);
        o[0] = mix(o[0], 175, c * 0.7); o[1] = mix(o[1], 200, c * 0.7); o[2] = mix(o[2], 250, c * 0.7);
      });
    };
  },
  rock: function(base, seed, maria, craterCount){
    return function(W, H){
      return paintJob(W, H, seed, function(N, x, y, z, lat, o){
        var g = N.fbm(x * 4, y * 4, z * 4, 6), v = 0.62 + (g - 0.5) * 0.9;
        var m = maria ? smooth(0.54, 0.62, N.fbm(x * 1.5 + 5, y * 1.5, z * 1.5, 3)) : 0;
        v *= (1 - 0.45 * m);
        o[0] = clamp(base[0] * v, 0, 255); o[1] = clamp(base[1] * v, 0, 255); o[2] = clamp(base[2] * v, 0, 255);
      }, function(t){ craters(t, craterCount, seed + 7, 1); });
    };
  }
};
GEN.jupiter = GEN.gasGiant([[236, 212, 176], [168, 112, 72]], 51, 9, true);
GEN.saturn  = GEN.gasGiant([[230, 210, 158], [188, 160, 112]], 61, 7, false);
GEN.uranus  = GEN.iceGiant([152, 214, 224], 71, false);
GEN.neptune = GEN.iceGiant([50, 88, 208], 81, true);
GEN.mercury = GEN.rock([190, 178, 166], 91, false, 380);
GEN.moon    = GEN.rock([200, 200, 202], 101, true, 300);

function ringTexture(){
  var cv = document.createElement('canvas'); cv.width = 512; cv.height = 4;
  var ctx = cv.getContext('2d'), img = ctx.createImageData(512, 4), d = img.data, N = new Noise(5);
  for (var x = 0; x < 512; x++){
    var u = x / 511, a;
    if (u < 0.16) a = 0.10 + 0.10 * u / 0.16;                 // faint inner ring
    else if (u < 0.52) a = 0.78 - 0.18 * (u - 0.16) / 0.36;   // bright middle ring
    else if (u < 0.58) a = 0.04;                              // the gap
    else if (u < 0.97) a = 0.55;                              // outer ring
    else a = 0;
    a *= 0.75 + 0.5 * N.n3(u * 90, 0.3, 0.7);
    if (u > 0.82 && u < 0.835) a *= 0.2;                      // a narrow gap
    a = clamp(a, 0, 1);
    for (var y = 0; y < 4; y++){
      var i = (y * 512 + x) * 4;
      d[i] = 214; d[i+1] = 196; d[i+2] = 160; d[i+3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; return tex;
}
function glowTexture(inner, outer){
  var cv = document.createElement('canvas'); cv.width = cv.height = 256;
  var ctx = cv.getContext('2d'), g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, inner); g.addColorStop(0.18, outer); g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 256);
  var tex = new THREE.CanvasTexture(cv); tex.encoding = THREE.sRGBEncoding; return tex;
}
function dotTexture(){
  var cv = document.createElement('canvas'); cv.width = cv.height = 64;
  var ctx = cv.getContext('2d'), g = ctx.createRadialGradient(32, 32, 0, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.55, 'rgba(255,255,255,0.9)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
}

/* ---- generators for built systems. Each takes the small spec system.js makes (a seed and a couple of 0-1 knobs). ---- */
function ridge(n){ return 1 - Math.abs(2 * n - 1); }       // 1 along the 'creases' of a noise field, 0 away from them
function terranWorld(seed, thr, dry, cloudAmt){
  return function(W, H){
    return paintJob(W, H, seed, function(N, x, y, z, lat, o){
      var h = N.fbm(x * 2.0 + 3, y * 2.0, z * 2.0, 6), r, g, b;
      if (h > thr){
        var e = clamp((h - thr) * 4, 0, 1), dr = N.fbm(x * 3 + 9, y * 3, z * 3 + 4, 4);
        var t = clamp(dr * 0.75 + e * 0.5 + dry, 0, 1);
        r = mix(64, 128, t); g = mix(122, 110, t); b = mix(54, 74, t);
        if (e > 0.88){ r = g = b = mix(150, 235, (e - 0.88) / 0.12); }
      } else {
        var dpt = clamp((thr - h) * 3.2, 0, 1);
        r = mix(48, 8, dpt); g = mix(112, 38, dpt); b = mix(176, 100, dpt);
      }
      var alat = Math.abs(lat) + (N.n3(x * 7, y * 7, z * 7) - 0.5) * 0.28, ice = smooth(1.14, 1.30, alat);
      r = mix(r, 238, ice); g = mix(g, 244, ice); b = mix(b, 250, ice);
      var c = N.fbm(x * 3.1 + 20, y * 5.2, z * 3.1, 5), ca = smooth(0.54, 0.80, c) * cloudAmt;
      o[0] = mix(r, 255, ca); o[1] = mix(g, 255, ca); o[2] = mix(b, 255, ca);
    });
  };
}
function desertWorld(seed, base, dark){
  return function(W, H){
    return paintJob(W, H, seed, function(N, x, y, z, lat, o){
      var a = N.fbm(x * 2.4, y * 2.4, z * 2.4, 5), d = smooth(0.52, 0.62, N.fbm(x * 1.7 + 6, y * 1.7, z * 1.7, 4));
      var r = mix(base[0], base[0] * 0.78, a), g = mix(base[1], base[1] * 0.7, a), b = mix(base[2], base[2] * 0.7, a);
      r = mix(r, dark[0], d * 0.8); g = mix(g, dark[1], d * 0.8); b = mix(b, dark[2], d * 0.8);
      var cap = smooth(1.38, 1.46, Math.abs(lat) + (N.n3(x * 8, y * 8, z * 8) - 0.5) * 0.1);
      o[0] = mix(r, 240, cap * 0.8); o[1] = mix(g, 240, cap * 0.8); o[2] = mix(b, 245, cap * 0.8);
    });
  };
}
function iceWorld(seed, bright){
  return function(W, H){
    return paintJob(W, H, seed, function(N, x, y, z, lat, o){
      var v = N.fbm(x * 3, y * 3, z * 3, 5), crack = smooth(0.90, 0.97, ridge(N.fbm(x * 2.2 + 4, y * 2.2, z * 2.2, 3)));
      var k = bright * (0.82 + 0.18 * v);
      o[0] = mix(205 * k, 110, crack * 0.8); o[1] = mix(226 * k, 150, crack * 0.8); o[2] = mix(240 * k, 196, crack * 0.8);
    }, function(t){ craters(t, 90, 17, 0.5); });
  };
}
function lavaWorld(seed){
  return function(W, H){
    return paintJob(W, H, seed, function(N, x, y, z, lat, o){
      var c = N.fbm(x * 3, y * 3, z * 3, 5), crust = 24 + 46 * c;
      var glow = smooth(0.86, 0.96, ridge(N.fbm(x * 2.6 + 8, y * 2.6, z * 2.6, 4)));
      o[0] = mix(crust, 255, glow); o[1] = mix(crust * 0.55, 80 + 50 * glow, glow); o[2] = mix(crust * 0.45, 14, glow);
    });
  };
}
function cloudWorld(seed, pal){
  return function(W, H){
    return paintJob(W, H, seed, function(N, x, y, z, lat, o){
      var wx = N.fbm(x * 1.6, y * 3.2, z * 1.6, 3), v = N.fbm(x * 2 + wx * 1.4, y * 5 + wx, z * 2 + wx * 1.4, 5);
      o[0] = mix(pal[0][0], pal[1][0], v); o[1] = mix(pal[0][1], pal[1][1], v); o[2] = mix(pal[0][2], pal[1][2], v);
    });
  };
}
function starSurface(tint, seed){
  return function(W, H){
    return paintJob(W, H, seed, function(N, x, y, z, lat, o){
      var g = N.fbm(x * 7, y * 7, z * 7, 5), t = Math.pow(g, 1.4), k = 0.7 + 0.4 * t, w = t * t * 0.35;   // keeps the star's own hue, hot cells drift toward white
      o[0] = Math.min(255, tint[0] * k + (255 - tint[0]) * w); o[1] = Math.min(255, tint[1] * k + (255 - tint[1]) * w); o[2] = Math.min(255, tint[2] * k + (255 - tint[2]) * w);
    });
  };
}
function hadeanWorld(seed){
  return function(W, H){
    return paintJob(W, H, seed, function(N, x, y, z, lat, o){
      var g = N.fbm(x * 3.5, y * 3.5, z * 3.5, 6), v = 0.28 + 0.32 * g, frost = smooth(0.6, 0.75, N.fbm(x * 2 + 3, y * 2, z * 2, 4));
      o[0] = mix(v * 150, 214, frost * 0.7); o[1] = mix(v * 160, 224, frost * 0.7); o[2] = mix(v * 185, 236, frost * 0.7);
    }, function(t){ craters(t, 260, 29, 0.7); });
  };
}
function ammoniaWorld(seed){
  return function(W, H){
    return paintJob(W, H, seed, function(N, x, y, z, lat, o){
      var wx = N.fbm(x * 1.4, y * 2.8, z * 1.4, 3), v = N.fbm(x * 2.2 + wx, y * 3.5 + wx, z * 2.2 + wx, 5);
      o[0] = mix(150, 214, v); o[1] = mix(172, 226, v); o[2] = mix(118, 170, v);        // pale green-yellow haze over an icy surface
    });
  };
}
function sulfurWorld(seed){
  return function(W, H){
    return paintJob(W, H, seed, function(N, x, y, z, lat, o){
      var v = N.fbm(x * 3, y * 3, z * 3, 5), spot = smooth(0.62, 0.74, N.fbm(x * 5 + 7, y * 5, z * 5, 3));
      o[0] = mix(226, 255, v * 0.6) * (1 - 0.6 * spot); o[1] = mix(190, 230, v) * (1 - 0.7 * spot); o[2] = mix(40, 110, v * v) * (1 - 0.8 * spot);
    });
  };
}
var GAS_PAL = [[[236, 212, 176], [168, 112, 72]], [[230, 210, 158], [188, 160, 112]], [[205, 190, 225], [130, 108, 160]],
               [[225, 150, 120], [150, 70, 60]], [[190, 215, 215], [96, 140, 150]], [[232, 226, 196], [170, 160, 120]]];
var DESERT_BASES = [[[214, 170, 110], [120, 84, 52]], [[190, 108, 66], [92, 56, 42]], [[226, 196, 130], [150, 118, 76]], [[170, 96, 64], [76, 46, 36]]];
var CLOUD_PALS = [[[214, 206, 196], [170, 160, 150]], [[236, 190, 130], [196, 130, 76]], [[236, 212, 158], [205, 168, 108]]];
var ROCK_BASES = [[190, 178, 166], [176, 160, 140], [160, 156, 150], [200, 190, 170]];

// Turns the spec on a body into a function (width, height) > paint job.
function genFor(b){
  var g = b.gen; if (!g) return null;
  var v1 = g.v1 == null ? 0.5 : g.v1, v2 = g.v2 == null ? 0.5 : g.v2, pick = function(arr, v){ return arr[Math.min(arr.length - 1, Math.floor(v * arr.length))]; };
  switch (g.type){
    case 'sol': return GEN[g.id];
    case 'star': return starSurface(g.tint, g.seed);
    case 'terran': return terranWorld(g.seed, 0.46 + v1 * 0.10, (v2 - 0.5) * 0.5, 0.55 + 0.25 * v2);
    case 'ocean': return terranWorld(g.seed, 0.60 + v1 * 0.08, 0, 0.8);
    case 'desert': var d = pick(DESERT_BASES, v1); return desertWorld(g.seed, d[0], d[1]);
    case 'barren': return GEN.rock(pick(ROCK_BASES, v1), g.seed, v2 > 0.5, 220 + Math.floor(v2 * 200));
    case 'ice': return iceWorld(g.seed, 0.9 + 0.1 * v1);
    case 'lava': return lavaWorld(g.seed);
    case 'hadean': return hadeanWorld(g.seed);
    case 'ammonia': return ammoniaWorld(g.seed);
    case 'sulfur': return sulfurWorld(g.seed);
    case 'cloudy': return cloudWorld(g.seed, pick(CLOUD_PALS, v1));
    case 'gasGiant': return GEN.gasGiant(GAS_PAL[g.pal % GAS_PAL.length], g.seed, g.bands, g.spot);
    case 'iceGiant': return GEN.iceGiant(g.base, g.seed, g.cloudy);
    case 'rockMoon': return GEN.rock(pick(ROCK_BASES, v1), g.seed, v1 > 0.5, 200);
    case 'iceMoon': return iceWorld(g.seed, 0.85 + 0.15 * v1);
  }
  return null;
}

/* ------------------------------------------------------------------
   6. Bodies, orbit lines, labels. A system is a list of plain data objects; this part
   gives each one a mesh, a label and (if it moves) an orbit line, and takes them all
   away again when you switch system.
------------------------------------------------------------------ */
var dotTex = dotTexture(), labelsEl = $('labels');
var homeTex = (function(){
  var cv = document.createElement('canvas'); cv.width = cv.height = 96;
  var ctx = cv.getContext('2d'); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 6;
  ctx.beginPath(); ctx.arc(48, 48, 38, 0, TAU); ctx.stroke();
  ctx.lineWidth = 4; [[48, 2, 48, 16], [48, 80, 48, 94], [2, 48, 16, 48], [80, 48, 94, 48]].forEach(function(l){
    ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke();
  });
  return new THREE.CanvasTexture(cv);
})();
var tmpV = new THREE.Vector3(), tmpEcl = {x:0, y:0, z:0};
var SPH_HI = new THREE.SphereGeometry(1, 64, 48), SPH_LO = new THREE.SphereGeometry(1, 32, 24);
var zoneGroup = new THREE.Group(); universe.add(zoneGroup);

function rgbCss(c, a){ return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
function createBody(b){
  b.group = new THREE.Group();
  b.tilt = new THREE.Group();
  b.tilt.rotation.x = -(b.isMoon ? 0 : b.obliq) * DEG;      // pole leans toward ecliptic longitude 90 degrees
  b.group.add(b.tilt);
  b.material = b.isStar
    ? new THREE.MeshBasicMaterial({color:b.color})
    : new THREE.MeshStandardMaterial({color:b.color, roughness:0.95, metalness:0});
  b.mesh = new THREE.Mesh(b.isMoon ? SPH_LO : SPH_HI, b.material);
  b.tilt.add(b.mesh);
  b.spin = Math.random() * TAU;
  b.customTex = null; b.builtTex = null; b.texSize = 0;
  b.genFn = genFor(b);

  b.marker = new THREE.Sprite(new THREE.SpriteMaterial({map:dotTex, color:b.isStar ? 0xffd080 : b.color, sizeAttenuation:false, depthTest:false, transparent:true}));
  b.marker.scale.setScalar(b.isMoon && !b.moon.real ? 0.007 : 0.011); b.marker.renderOrder = 5; b.marker.visible = false;
  if (b.isMoon && !b.moon.real) b.marker.material.opacity = 0.75;
  b.group.add(b.marker);

  if (b.isStar){
    var tint = b.tint || [255, 236, 190];
    b.glowTex = glowTexture(b.glowInner || rgbCss(tint.map(function(v){ return Math.min(255, v + 25); }), 1), b.glowOuter || rgbCss(tint, 0.55));
    b.glow = new THREE.Sprite(new THREE.SpriteMaterial({map:b.glowTex, blending:THREE.AdditiveBlending, depthWrite:false, transparent:true}));
    b.group.add(b.glow);
    // every star lights the scene from where it is
    var lc = b.lightColor != null ? b.lightColor : new THREE.Color(tint[0] / 255, tint[1] / 255, tint[2] / 255).lerp(new THREE.Color(1, 1, 1), 0.55).getHex();
    b.light = new THREE.PointLight(lc, b.companion ? 1.6 : 2.2, 0);
    b.group.add(b.light);
  }
  if (b.rings){
    var rg = new THREE.RingGeometry(1.24, 2.27, 160, 1), pos = rg.attributes.position, uv = rg.attributes.uv;
    for (var i = 0; i < pos.count; i++){
      var r = Math.hypot(pos.getX(i), pos.getY(i));
      uv.setXY(i, (r - 1.24) / (2.27 - 1.24), 0.5);
    }
    b.ringMesh = new THREE.Mesh(rg, new THREE.MeshLambertMaterial({map:ringTexture(), transparent:true, side:THREE.DoubleSide, depthWrite:false}));
    b.ringMesh.rotation.x = -Math.PI / 2;
    b.tilt.add(b.ringMesh);
  }
  if (b.home){
    b.homeMark = new THREE.Sprite(new THREE.SpriteMaterial({map:homeTex, color:0xC89B4A, sizeAttenuation:false, depthTest:false, transparent:true}));
    b.homeMark.scale.setScalar(0.05); b.homeMark.renderOrder = 6; b.homeMark.visible = false;
    b.group.add(b.homeMark);
  }
  universe.add(b.group);

  b.label = document.createElement('button');
  b.label.className = 'tag'; b.label.textContent = b.name + (b.home ? ' (Home)' : ''); b.label.tabIndex = -1;
  b.label.setAttribute('aria-hidden', 'true');
  b.label.addEventListener('click', function(){ focusOn(b.id); });
  labelsEl.appendChild(b.label);
  b.labelW = 0;

  if (b.el){
    b.orbitLine = new THREE.LineLoop(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({color:b.home ? 0xC89B4A : b.isStar ? 0xE8B04A : 0x7fa8c8, transparent:true, opacity:b.home ? 0.7 : b.isStar ? 0.55 : 0.42, depthWrite:false}));
    b.orbitLine.frustumCulled = false;
    universe.add(b.orbitLine);
    b.orbitBuiltT = 1e9;
  }
  if (b.isMoon){
    var pts = new Float32Array(121 * 3), v = {x:0, y:0, z:0}, inc = b.incl * DEG;
    for (var k = 0; k <= 120; k++){
      moonDirEcl(k / 120 * TAU, v, inc);
      pts[k*3] = v.x; pts[k*3+1] = v.z; pts[k*3+2] = -v.y;
    }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    b.orbitLine = new THREE.Line(g, new THREE.LineBasicMaterial({color:0x9aa0aa, transparent:true, opacity:0.34, depthWrite:false}));
    b.orbitLine.frustumCulled = false; universe.add(b.orbitLine);
  }
}
function destroyBody(b){
  universe.remove(b.group);
  [b.material, b.marker && b.marker.material, b.glow && b.glow.material, b.homeMark && b.homeMark.material].forEach(function(m){ if (m) m.dispose(); });
  if (b.glowTex) b.glowTex.dispose();
  if (b.builtTex) b.builtTex.dispose();
  if (b.customTex) b.customTex.dispose();
  if (b.ringMesh){ b.ringMesh.geometry.dispose(); b.ringMesh.material.map.dispose(); b.ringMesh.material.dispose(); }
  if (b.orbitLine){ universe.remove(b.orbitLine); b.orbitLine.geometry.dispose(); b.orbitLine.material.dispose(); }
  if (b.label && b.label.parentNode) b.label.parentNode.removeChild(b.label);
}
function teardownSystem(){
  BODIES.forEach(destroyBody);
  BODIES = []; PLANETS = []; MOONS = []; byId = {};
  texQueue = []; texJob = null; texJobItem = null;
  clearBelts(); clearTrojans();
  while (zoneGroup.children.length){
    var c = zoneGroup.children[0]; zoneGroup.remove(c); if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose();
  }
}

/* Texture queue. Every body gets a small texture quickly (enough for the overview, where
   planets are a few dozen pixels wide). The sharp 1024 px version is only made for a
   body you actually select, and it jumps the queue. Painting is sliced across frames. */
var texQueue = [], texJob = null, texJobItem = null;
function pumpTextures(){
  if (!texJob){
    var it = texQueue.shift(); if (!it) return;
    var tb = byId[it.id];
    if (!tb || !tb.genFn) return;
    texJobItem = it; texJob = tb.genFn(it.size, it.size / 2);
  }
  if (!texJob.run(performance.now() + 6)) return;       // a few ms a frame, then let the page breathe
  var b = byId[texJobItem.id], tex = new THREE.CanvasTexture(texJob.canvas);
  tex.encoding = THREE.sRGBEncoding; tex.anisotropy = maxAniso;
  if (b.builtTex) b.builtTex.dispose();
  b.builtTex = tex; b.texSize = texJobItem.size;
  if (!b.customTex){ b.material.map = tex; b.material.color.set(0xffffff); b.material.needsUpdate = true; }
  texJob = null; texJobItem = null;
}
function prioritiseTexture(id, close){
  var b = byId[id], items = [];
  if (!b || !b.genFn) return;
  var li = -1; texQueue.forEach(function(it, i){ if (it.id === id && it.size < 1024) li = i; });
  if (li >= 0) items.push(texQueue.splice(li, 1)[0]);                 // its small one first
  var wantsSharp = close && (b.texSize || 0) < 1024 && !texQueue.some(function(it){ return it.id === id && it.size >= 1024; })
                   && !(texJobItem && texJobItem.id === id && texJobItem.size >= 1024);
  if (wantsSharp) items.push({id:id, size:1024});
  Array.prototype.unshift.apply(texQueue, items);
}
function queueTextures(){
  if (sys.mode === 'sol'){
    texQueue = ['earth', 'sun', 'jupiter', 'saturn', 'mars', 'moon', 'venus', 'mercury', 'uranus', 'neptune'].map(function(id){ return {id:id, size:512}; });
    return;
  }
  texQueue = [];
  sys.order.forEach(function(id){ if (!byId[id].isMoon) texQueue.push({id:id, size:512}); });
  sys.order.forEach(function(id){ if (byId[id].isMoon) texQueue.push({id:id, size:256}); });
}

/* ------------------------------------------------------------------
   7. Scale: where bodies are drawn, and how big. 'unit' is the distance (in AU) that
   gets the same scene length our Earth does: 1 AU for the Sun, and for a built system
   the distance at which a planet gets as much light as Earth does (the square root of
   the star's luminosity). That keeps a red dwarf's tiny system from collapsing into the star.
------------------------------------------------------------------ */
function sceneDist(rAU){
  return state.trueDist ? rAU * SCENE_AU_TRUE / sys.unit : SQUEEZE_K * Math.sqrt(rAU / sys.unit);
}
function viewPos(p, out){
  var r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  var s = r > 0 ? sceneDist(r) / r : 0;
  return out.set(p.x * s, p.z * s, -p.y * s);          // ecliptic z is up; three's y is up
}
function bodyRadius(b){
  var r = state.trueSize ? b.radiusKm / AU_KM * SCENE_AU_TRUE / sys.unit : 0.5 * Math.pow(b.radiusKm / 6378, 0.4);
  if (b.isStar && sys.mode === 'custom'){          // keep a puffed-up star off its closest planet, and off its companion
    if (sys.innerA) r = Math.min(r, 0.55 * sceneDist(sys.innerA));
    if (sys.binary) r = Math.min(r, 0.3 * sceneDist(sys.binary.min * 0.5));
  }
  return r;
}
function moonDistScene(m){
  if (state.trueSize) return m.moon.aKm / AU_KM * SCENE_AU_TRUE / sys.unit;
  return bodyRadius(m.parentBody) * (3.4 + 1.8 * m.parentBody.moonBodies.indexOf(m));
}
function overviewRadius(){ return sceneDist(sys.maxA); }

var camera3 = {theta:0.6, phi:0.5, dist:100, targetDist:100};
var focusView = new THREE.Vector3(), focusOffset = new THREE.Vector3();
var visible = {w:1, h:1, shiftX:0, shiftY:0};

// How far back to stand so the whole system fits the part of the screen you can see.
// The projection scale comes from the full canvas height, so the visible window's
// width and height are both measured against that, not against each other.
function overviewDist(){
  var tanHalf = Math.tan(camera.fov * DEG / 2), R = overviewRadius() * 1.18, H = stage.clientHeight || 1;
  var fitW = R / (tanHalf * Math.max(0.05, visible.w / H));          // sideways
  var fitH = R * 0.62 / (tanHalf * Math.max(0.05, visible.h / H));   // up and down, at the default tilt
  return Math.max(fitW, fitH);
}
function defaultDist(b){
  var R = bodyRadius(b);
  if (b.isStar) return R * 4;
  if (b.isMoon) return R * 5;
  if (b.moonBodies && b.moonBodies.length && !state.trueSize) return Math.min(Math.max(R * 4, moonDistScene(b.moonBodies[0]) * 2.5), R * 14);
  return R * 4;
}
function limitDist(d){
  var b = byId[state.focus];
  return clamp(d, bodyRadius(b) * 1.25, overviewDist() * 1.7);
}

/* ------------------------------------------------------------------
   8. Per-frame update
------------------------------------------------------------------ */
var plan = {};     // positions (AU, ecliptic, relative to the star) this frame
function updateBodies(dt){
  var T = centuries(state.jd);
  PLANETS.forEach(function(b){ plan[b.id] = heliocentric(b.el, T, plan[b.id] || {x:0, y:0, z:0}); });
  if (!byId.sun.el) plan.sun = {x:0, y:0, z:0};

  BODIES.forEach(function(b){
    var R = bodyRadius(b); b.R = R;
    b.mesh.scale.setScalar(R);
    if (b.ringMesh) b.ringMesh.scale.setScalar(R);
    if (b.el) viewPos(plan[b.id], b.group.position);
    else if (b.isStar) b.group.position.set(0, 0, 0);
  });
  // Moons. Ours uses the mean phase on a circular orbit (not an ephemeris); a built system's
  // moons are plain circles. Either way they are assumed tidally locked.
  MOONS.forEach(function(m){
    var pg = m.parentBody.group.position, md = moonDistScene(m), lam;
    if (m.moon.real){
      var e = plan[m.parentBody.id];
      lam = Math.atan2(-e.y, -e.x) + moonElongation(state.jd);
    } else {
      lam = m.moon.phase0 + TAU * (state.jd - sys.epochJd) / m.periodDays;
    }
    moonDirEcl(lam, tmpEcl, m.incl * DEG);
    m.group.position.set(pg.x + tmpEcl.x * md, pg.y + tmpEcl.z * md, pg.z - tmpEcl.y * md);
    m.orbitLine.position.copy(pg);
    m.orbitLine.scale.setScalar(md);
    var dx = pg.x - m.group.position.x, dz = pg.z - m.group.position.z;
    m.mesh.rotation.y = Math.atan2(-dz, dx);
  });
  // spin, capped so planets don't strobe at high speed. Anything locked just keeps one face to what it orbits.
  var daysPerSec = state.paused ? 0 : SPEEDS[state.speedIdx].days;
  BODIES.forEach(function(b){
    if (b.isMoon || !b.rotH) return;
    if (b.lockTo){
      var sp = byId[b.lockTo].group.position, ddx = sp.x - b.group.position.x, ddz = sp.z - b.group.position.z;
      b.mesh.rotation.y = Math.atan2(-ddz, ddx); return;
    }
    var cyc = daysPerSec * 24 / b.rotH;
    b.spin += state.dir * Math.min(cyc, 0.35) * TAU * dt;
    b.mesh.rotation.y = b.spin;
  });
  // orbit lines: our own planets creep, so rebuild when the date has moved on enough or the scale changed;
  // a built system's orbits never change shape, so they are only redrawn when the scale does.
  if (state.orbits){
    PLANETS.forEach(function(b){
      if (sys.mode === 'custom' ? b.orbitBuiltT === 1e9 : Math.abs(T - b.orbitBuiltT) > 0.05) buildOrbit(b, T);
    });
  }
  sys.stars.forEach(function(st){ st.glow.scale.setScalar(Math.max(st.R * 5.5, 0)); });
  updateBelts(); updateTrojans(T);
}
function buildOrbit(b, T){
  var s = elementsAt(b.el, T), n = 360, pts = new Float32Array(n * 3), p = {x:0, y:0, z:0};
  var w = s.lp - s.ln, bb = s.a * Math.sqrt(1 - s.e * s.e);
  for (var i = 0; i < n; i++){
    var E = i / n * TAU;
    toEcliptic(s.a * (Math.cos(E) - s.e), bb * Math.sin(E), w, s.I, s.ln, p);
    viewPos(p, tmpV);
    pts[i*3] = tmpV.x; pts[i*3+1] = tmpV.y; pts[i*3+2] = tmpV.z;
  }
  var old = b.orbitLine.geometry; b.orbitLine.geometry = new THREE.BufferGeometry();
  b.orbitLine.geometry.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  old.dispose();
  b.orbitBuiltT = T;
}
function rebuildOrbits(){ PLANETS.forEach(function(b){ b.orbitBuiltT = 1e9; }); }

/* Asteroid belts: a ring of points in the orbit plane, turning slowly at the belt's own pace.
   The particles are cosmetic (placed by a seeded generator); the belt's distance and width are what the system says. */
var BELTS = [], beltRoot = new THREE.Group(); universe.add(beltRoot);
var beltTmp = new THREE.Vector3(), beltAU = {x:0, y:0, z:0};
function beltAngle(bt){ return bt.def.phase0 + TAU * (state.jd - (sys.epochJd != null ? sys.epochJd : 2451545)) / bt.def.periodDays; }
function clearBelts(){
  BELTS.forEach(function(bt){ bt.points.geometry.dispose(); bt.points.material.dispose(); if (bt.label.parentNode) bt.label.parentNode.removeChild(bt.label); });
  while (beltRoot.children.length) beltRoot.remove(beltRoot.children[0]);
  BELTS = [];
}
function makeBelts(){
  clearBelts();
  (sys.belts || []).forEach(function(bd){
    var N = 1500, au = new Float32Array(N * 3), s = bd.seed >>> 0, spread = bd.spread || 0.06;
    function rnd(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
    for (var i = 0; i < N; i++){
      var r = bd.a + (rnd() * 2 - 1) * bd.halfWidth, th = rnd() * TAU;
      au[i*3] = r * Math.cos(th); au[i*3+1] = r * Math.sin(th); au[i*3+2] = (rnd() * 2 - 1) * spread * r;
    }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    var pts = new THREE.Points(g, new THREE.PointsMaterial({size:1.7, sizeAttenuation:false, color:bd.icy ? 0xb9c8d4 : 0xb8a58c, transparent:true, opacity:0.8, depthWrite:false}));
    pts.frustumCulled = false;
    var grp = new THREE.Group(); grp.add(pts); beltRoot.add(grp);
    var label = document.createElement('div'); label.className = 'tag belt'; label.textContent = bd.label || 'Asteroid belt'; label.setAttribute('aria-hidden', 'true');
    labelsEl.appendChild(label);
    BELTS.push({def:bd, au:au, points:pts, group:grp, label:label, labelW:0});
  });
  rebuildBelts();
}
function rebuildBelts(){
  BELTS.forEach(function(bt){
    var pos = bt.points.geometry.attributes.position.array, au = bt.au;
    for (var i = 0; i < au.length; i += 3){
      beltAU.x = au[i]; beltAU.y = au[i+1]; beltAU.z = au[i+2]; viewPos(beltAU, tmpV);
      pos[i] = tmpV.x; pos[i+1] = tmpV.y; pos[i+2] = tmpV.z;
    }
    bt.points.geometry.attributes.position.needsUpdate = true;
  });
}
function updateBelts(){ BELTS.forEach(function(bt){ bt.group.rotation.y = beltAngle(bt); bt.group.visible = state.orbits; }); }
function beltLabelPoint(bt){
  var th = beltAngle(bt); beltAU.x = bt.def.a * Math.cos(th); beltAU.y = bt.def.a * Math.sin(th); beltAU.z = 0;
  return viewPos(beltAU, beltTmp);
}

/* Trojans: two swarms sharing a planet's orbit, 60 degrees ahead (L4) and behind (L5). Cosmetic particles round each point,
   placed fresh every frame from the point's real position on the orbit, so they keep pace with the planet. */
var TROJANS = [], trojanRoot = new THREE.Group(); universe.add(trojanRoot);
var trojAU = {x:0, y:0, z:0}, trojTmp = {x:0, y:0, z:0};
function clearTrojans(){
  TROJANS.forEach(function(tr){ tr.points.geometry.dispose(); tr.points.material.dispose(); trojanRoot.remove(tr.points); });
  TROJANS = [];
}
function makeTrojans(){
  clearTrojans();
  PLANETS.forEach(function(b){
    if (!b.trojans || b.isStar) return;
    [60, -60].forEach(function(side, k){
      var N = 160, off = new Float32Array(N * 3), s = (b.id.charCodeAt(1) * 7919 + k * 104729 + 17) >>> 0;
      function rnd(){ s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }
      for (var i = 0; i < N; i++){
        var u = rnd() * 2 - 1;
        off[i*3] = u * Math.abs(u) * 0.35;              // along the orbit, radians, bunched towards the point
        off[i*3+1] = (rnd() * 2 - 1) * 0.06;            // in and out, fraction of the distance
        off[i*3+2] = (rnd() * 2 - 1) * 0.05;            // above and below
      }
      var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
      var pts = new THREE.Points(g, new THREE.PointsMaterial({size:1.5, sizeAttenuation:false, color:0xb8a58c, transparent:true, opacity:0.75, depthWrite:false}));
      pts.frustumCulled = false; trojanRoot.add(pts);
      var el = {a:b.el.a, e:b.el.e, I:b.el.I, L:[b.el.L[0] + side, b.el.L[1]], lp:b.el.lp, ln:b.el.ln};
      TROJANS.push({body:b, el:el, off:off, points:pts});
    });
  });
}
function updateTrojans(T){
  TROJANS.forEach(function(tr){
    tr.points.visible = state.orbits; if (!state.orbits) return;
    heliocentric(tr.el, T, trojTmp);
    var r = Math.hypot(trojTmp.x, trojTmp.y), th = Math.atan2(trojTmp.y, trojTmp.x), pos = tr.points.geometry.attributes.position.array, off = tr.off;
    for (var i = 0; i < off.length; i += 3){
      var rr = r * (1 + off[i+1]), tt = th + off[i];
      trojAU.x = rr * Math.cos(tt); trojAU.y = rr * Math.sin(tt); trojAU.z = trojTmp.z + off[i+2] * r;
      viewPos(trojAU, tmpV); pos[i] = tmpV.x; pos[i+1] = tmpV.y; pos[i+2] = tmpV.z;
    }
    tr.points.geometry.attributes.position.needsUpdate = true;
  });
}

/* The habitable zone (a green band) and the snow line (dashed), drawn flat in the orbit plane. */
var zoneMats = [];
function buildZone(){
  while (zoneGroup.children.length){
    var c = zoneGroup.children[0]; zoneGroup.remove(c); if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose();
  }
  var ri = sceneDist(sys.hz.inner), ro = sceneDist(sys.hz.outer), rf = sceneDist(sys.frost);
  var band = new THREE.RingGeometry(ri, ro, 180, 1); band.rotateX(-Math.PI / 2);
  var bm = new THREE.Mesh(band, new THREE.MeshBasicMaterial({color:0x6fa294, transparent:true, opacity:0.17, side:THREE.DoubleSide, depthWrite:false}));
  bm.renderOrder = -0.5; zoneGroup.add(bm); zoneMats = [bm.material];
  function circle(r, mat){
    var pts = new Float32Array(181 * 3);
    for (var i = 0; i <= 180; i++){ var a = i / 180 * TAU; pts[i*3] = Math.cos(a) * r; pts[i*3+1] = 0; pts[i*3+2] = Math.sin(a) * r; }
    var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
    var l = new THREE.Line(g, mat); l.frustumCulled = false; if (mat.isLineDashedMaterial) l.computeLineDistances(); return l;
  }
  var edge = function(){ var m = new THREE.LineBasicMaterial({color:0x6fa294, transparent:true, opacity:0.55, depthWrite:false}); zoneMats.push(m); return m; };
  zoneGroup.add(circle(ri, edge())); zoneGroup.add(circle(ro, edge()));
  zoneGroup.add(circle(rf, new THREE.LineDashedMaterial({color:0xa9c4d8, transparent:true, opacity:0.5, depthWrite:false, dashSize:rf * 0.012, gapSize:rf * 0.012})));
  zoneGroup.visible = state.zone;
}

function updateCamera(dt){
  var b = byId[state.focus];
  var target = b.group.position;
  focusOffset.multiplyScalar(Math.exp(-dt * 4));
  focusView.copy(target).add(focusOffset);
  universe.position.copy(focusView).negate();

  camera3.targetDist = limitDist(camera3.targetDist);
  camera3.dist += (camera3.targetDist - camera3.dist) * (1 - Math.exp(-dt * 7));
  camera3.dist = Math.max(camera3.dist, bodyRadius(b) * 1.2);
  // The zone is a flat translucent disc, which looks odd slicing through a planet you are studying, so it fades as you close in.
  if (zoneMats.length){
    var fade = smooth(0.12, 0.5, camera3.dist / overviewDist());
    zoneMats[0].opacity = mix(0.02, 0.17, fade);
    for (var zi = 1; zi < zoneMats.length; zi++) zoneMats[zi].opacity = mix(0.12, 0.55, fade);
  }
  var cp = Math.cos(camera3.phi);
  camera.position.set(camera3.dist * cp * Math.sin(camera3.theta), camera3.dist * Math.sin(camera3.phi), camera3.dist * cp * Math.cos(camera3.theta));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
}

var sizeW = 0, sizeH = 0, started = false;
function layoutView(){
  var W = stage.clientWidth || 1, H = stage.clientHeight || 1;
  var panel = $('drawer'), r = panel.getBoundingClientRect(), shiftX = 0, shiftY = 0, vw = W, vh = H;
  if (window.innerWidth >= 820){ vw = Math.max(1, r.left); shiftX = (W - vw) / 2; }
  else { vh = Math.max(1, r.top); shiftY = (H - vh) / 2; }
  if (sizeW !== W || sizeH !== H){ renderer.setSize(W, H); sizeW = W; sizeH = H; }
  if (visible.w !== vw || visible.h !== vh || camera.aspect !== W / H){
    var changed = visible.w !== vw || visible.h !== vh;
    visible.w = vw; visible.h = vh; visible.shiftX = shiftX; visible.shiftY = shiftY;
    if (changed && state.overview && started) camera3.targetDist = overviewDist();   // re-fit the whole system
    camera.aspect = W / H;
    camera.setViewOffset(W, H, shiftX, shiftY, W, H);
    camera.updateProjectionMatrix();
  }
}

var screenV = new THREE.Vector3();
// 'behind' is decided in view space (the camera looks down -z), not from the
// projected depth: with a near/far ratio this big, depth rounds to 1 for anything.
function projectToScreen(worldPos, out){
  screenV.copy(worldPos).applyMatrix4(camera.matrixWorldInverse);
  out.behind = screenV.z >= 0;
  screenV.applyMatrix4(camera.projectionMatrix);
  out.x = (screenV.x * 0.5 + 0.5) * stage.clientWidth;
  out.y = (-screenV.y * 0.5 + 0.5) * stage.clientHeight;
  return out;
}
var scrA = {x:0, y:0, behind:false}, wp = new THREE.Vector3();
function updateLabels(){
  var tanHalf = Math.tan(camera.fov * DEG / 2), H = stage.clientHeight;
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  BODIES.forEach(function(b){
    wp.copy(b.group.position).add(universe.position);
    projectToScreen(wp, scrA);
    b.screen = {x:scrA.x, y:scrA.y, behind:scrA.behind};
    var dist = wp.distanceTo(camera.position);
    b.pxRadius = b.R / (dist * tanHalf) * (H / 2);
    b.marker.visible = !b.isStar && b.pxRadius < 2.5;
    if (b.homeMark) b.homeMark.visible = !scrA.behind && b.pxRadius < 22;
    b.labelShow = state.labels && !scrA.behind && scrA.x > -20 && scrA.x < visible.w && scrA.y > -20 && scrA.y < visible.h + 20;
  });
  // a moon's name would sit on top of its planet's when the two are close on screen
  MOONS.forEach(function(m){
    if (!m.labelShow) return;
    var ps = m.parentBody.screen;
    if (Math.hypot(ps.x - m.screen.x, ps.y - m.screen.y) < 26) m.labelShow = false;
  });
  // Place labels in priority order (the selected body first) and drop any that would
  // sit on top of one already placed, so the crowd near the star stays readable.
  var order = [state.focus].concat(sys.order.filter(function(id){ return id !== state.focus; })), placed = [];
  order.forEach(function(id){
    var b = byId[id], el = b.label;
    el.classList.toggle('selected', id === state.focus);
    if (!b.labelShow){ el.style.transform = 'translate(-9999px,-9999px)'; return; }
    if (!b.labelW) b.labelW = el.offsetWidth || (b.name.length * 7 + 16);
    var gap = Math.max(10, b.pxRadius + 6), x = b.screen.x + gap, y = b.screen.y - 10, w = b.labelW, h = 20;
    if (x + w > visible.w - 6) x = b.screen.x - gap - w;               // flip to the left near the edge
    x = clamp(x, 4, Math.max(4, visible.w - w - 4));
    for (var i = 0; i < placed.length; i++){
      var q = placed[i];
      if (x < q.x + q.w + 3 && x + w + 3 > q.x && y < q.y + q.h + 2 && y + h + 2 > q.y){ el.style.transform = 'translate(-9999px,-9999px)'; return; }
    }
    placed.push({x:x, y:y, w:w, h:h});
    el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  });
  BELTS.forEach(function(bt){
    var p = beltLabelPoint(bt); wp.copy(p).add(universe.position); projectToScreen(wp, scrA);
    var el = bt.label, w = bt.labelW || (bt.labelW = el.offsetWidth || 110), x = scrA.x + 8, y = scrA.y - 10, ok = state.labels && state.orbits && !scrA.behind && scrA.x > 0 && scrA.x < visible.w && scrA.y > 0 && scrA.y < visible.h;
    if (ok){
      if (x + w > visible.w - 6) x = scrA.x - 8 - w;
      for (var i = 0; i < placed.length; i++){ var q = placed[i]; if (x < q.x + q.w + 3 && x + w + 3 > q.x && y < q.y + 22 && y + 22 > q.y){ ok = false; break; } }
    }
    if (!ok){ el.style.transform = 'translate(-9999px,-9999px)'; return; }
    placed.push({x:x, y:y, w:w, h:20});
    el.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  });
  // the star keeps a glow even when true size makes it a speck
  sys.stars.forEach(function(st){
    var starDist = wp.copy(st.group.position).add(universe.position).distanceTo(camera.position);
    st.glow.scale.setScalar(Math.max(st.R * 5.5, starDist * 0.045));
  });
}

/* ------------------------------------------------------------------
   9. Focus and scale changes
------------------------------------------------------------------ */
function focusOn(id, opts){
  var b = byId[id]; if (!b) return;
  opts = opts || {};
  var oldFocus = new THREE.Vector3().copy(focusView);
  state.focus = id; state.overview = !!opts.overview;
  prioritiseTexture(id, !opts.overview);
  if (!opts.overview && b.moonBodies) b.moonBodies.forEach(function(m){ prioritiseTexture(m.id, false); });
  // make sure group positions are current, then slide from the old focus point
  focusOffset.copy(oldFocus).sub(b.group.position);
  camera3.targetDist = opts.overview ? overviewDist() : defaultDist(b);
  if (opts.overview) camera3.phi = 0.5;
  refreshBodyButtons();
  $('rFocus').textContent = opts.overview ? 'Whole system' : b.name;
  $('overview').setAttribute('aria-pressed', String(!!opts.overview));
  showSelected(b);
}
function applyScaleChange(){
  focusOffset.set(0, 0, 0);
  updateBodies(0);
  rebuildOrbits();
  buildZone();
  rebuildBelts();
  var b = byId[state.focus];
  camera3.targetDist = state.overview ? overviewDist() : defaultDist(b);
  camera3.dist = camera3.targetDist;
  updateScaleHint();
}
function updateScaleHint(){
  var t = [];
  t.push(state.trueDist ? 'Distances are true to scale, so the planets are far apart and mostly there is nothing between them.'
                        : 'Distances are squeezed so the outer planets fit on screen.');
  t.push(state.trueSize ? 'Sizes are true. Planets are specks, which is accurate and not very helpful, so each gets a marker dot.'
                        : 'Planets are drawn bigger than life so you can see them.');
  if (sys && sys.mode === 'custom') t.push('Green band: habitable zone. Dashed line: snow line, where giants form.');
  else t.push('Green band: the Sun\'s habitable zone, by one published model. Dashed line: where water ice can form.');
  $('scaleHint').textContent = t.join(' ');
}

/* ------------------------------------------------------------------
   10. Selected-body panel
------------------------------------------------------------------ */
function fmtHours(h){ return h < 48 ? fmtNum(h, 1) + ' hours' : fmtNum(h / 24, 1) + ' days'; }
function fmtPeriod(d){ return d < 1000 ? fmtNum(d, 1) + ' days' : fmtNum(d / 365.25, 1) + ' years'; }
function fmtLight(sec){
  if (sec < 90) return fmtNum(sec, 0) + ' seconds';
  var t = Math.round(sec);                                   // round once, so it never says '60 s' or '60 min'
  if (sec < 5400) return Math.floor(t / 60) + ' min ' + (t % 60) + ' s';
  t = Math.round(sec / 60); return Math.floor(t / 60) + ' h ' + (t % 60) + ' min';
}
function fmtMass(me){ return me >= 100 ? fmtNum(me / 317.83, 2) + ' Jupiter masses' : fmtNum(me, me < 10 ? 2 : 1) + ' Earth masses'; }
function fmtGyr(g){ return g < 1 ? fmtNum(g * 1000, 0) + ' million years' : fmtNum(g, 1) + ' billion years'; }
function zoneText(a){
  var z = SYS.zoneOf(a, sys.hz);
  return z === 'in' ? 'Inside the zone' : z === 'inside' ? 'Closer in than the zone (too hot, by this model)' : 'Further out than the zone (too cold, by this model)';
}
var liveEls = {};
function kc(k){ return fmtNum(k) + ' K (' + fmtNum(k - 273.15) + ' °C)'; }
function showSelected(b){
  updateSizeRow(b); updateTravelRow(b);
  var custom = sys.mode === 'custom', primary = byId.sun;
  var pair = custom && sys.binary && sys.binary.regime === 'P';
  $('selName').textContent = b.name + (b.home ? ' (Home)' : ''); $('selKind').textContent = b.kind;
  var dl = $('facts'); dl.textContent = ''; liveEls = {};
  function add(k, v, live){
    var dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = k; dd.textContent = v; if (live){ dd.className = 'live'; liveEls[live] = dd; }
    dl.appendChild(dt); dl.appendChild(dd);
  }
  var dia = b.diameter || fmtNum(b.radiusKm * 2) + ' km';
  if (custom && b.isStar) dia += ' (' + fmtNum(b.radiusKm / 695700, b.radiusKm < 6e5 ? 3 : 2) + ' × the Sun)';
  else if (custom) dia += ' (' + fmtNum(b.radiusKm / 6378, 2) + ' × Earth)';
  if (custom && b.isStar){
    add('Type', b.spt);
    add('Surface temperature', fmtNum(b.Teff) + ' K');
    add('Brightness', fmtNum(b.L, b.L < 1 ? 4 : 1) + ' × the Sun');
    add('Mass', fmtNum(b.massSun, 2) + ' × the Sun');
  }
  add('Diameter', dia);
  if (custom && b.massEarth) add('Mass', b.giant ? fmtMass(b.massEarth) : fmtNum(b.massEarth, b.massEarth < 0.1 ? 3 : 2) + ' Earth masses');
  if (custom && b.giant){ add('Size class', b.ggClass + ' giant'); add('Density', fmtNum(b.density, 2) + ' × Earth\'s'); }
  if (custom && b.sizeClass){
    add('Size class', b.sizeClass + ' (' + b.worldType + ')');
    add('Density', fmtNum(b.density, 2) + ' × Earth\'s');
    add('Surface gravity', fmtNum(b.gravity, 2) + ' g');
  }
  var rot = fmtHours(b.rotH) + (b.retro ? ', backwards' : '') + (b.rotNote ? ' (' + b.rotNote + ')' : '') + (b.lockNote ? ', ' + b.lockNote : '')
          + (custom && b.isStar ? ' (typical for the type)' : '');
  add('Spin (one turn)', rot);
  add('Axial tilt', fmtNum(b.obliq, 2) + '°');
  if (b.periodDays){
    var yearLabel = b.isMoon ? 'Orbits ' + b.parentBody.name + ' in' : b.companion ? 'Orbits ' + primary.name + ' in' : b.primary ? 'Orbits the pair\'s centre in' : 'Year';
    if (!(b.primary && !pair)) add(yearLabel, fmtPeriod(b.periodDays));
  }
  if (b.incl != null && !b.isStar) add('Orbit tilt', fmtNum(b.incl, 1) + '°');
  if (b.ecc != null && !(b.isStar && b.primary)) add('Orbit stretch', fmtNum(b.ecc, 3));
  if (b.companion) add('Mean separation', fmtNum(b.aAU, b.aAU < 1 ? 3 : 1) + ' AU');
  if (b.isMoon){
    add('Distance from ' + b.parentBody.name, b.moon.real ? 'about 384,000 km' : fmtNum(b.moon.aKm) + ' km (' + fmtNum(b.moon.kRadii, 1) + ' planet radii)');
    if (b.moon.real) add('Phase now', '', 'phase');
  } else if (!b.isStar){
    add(pair ? 'Distance from the pair\'s centre now' : 'Distance from ' + primary.name + ' now', '', 'dist');
    add(custom ? 'Starlight takes' : 'Sunlight takes', '', 'light');
    if (custom) add('Starlight vs Earth', '', 'flux');
    add('Habitable zone', zoneText(b.el.a[0]));
    if (custom && b.sizeClass){
      var at = b.atmosphere;
      add('Atmosphere', at.none ? 'None to speak of' : at.category + ' (' + fmtNum(at.pressureAtm, at.pressureAtm < 10 ? 2 : 0) + ' atm)' + (at.breathable ? (at.marginal ? ', breathable but marginal: ' + at.marginal.toLowerCase() : ', breathable') : ', not breathable'));
      if (b.hydro) add('Liquid water', fmtNum(b.hydro) + '% of the surface');
      add('Surface temperature', kc(b.surfaceK) + ', ' + b.climate.toLowerCase());
      add('Blackbody temperature', kc(b.bbK) + ' (no atmosphere or reflection)');
      if (b.tide) add('Day side / night side', fmtNum(b.tide.dayK) + ' K / ' + fmtNum(b.tide.nightK) + ' K');
      add('Volcanic activity', b.volcanic);
      add('Resources', b.resources.label + ' (' + (b.resources.rvm > 0 ? '+' : '') + b.resources.rvm + ')');
      add('Habitability', (b.habitability > 0 ? '+' : '') + b.habitability + ', affinity ' + (b.affinity > 0 ? '+' : '') + b.affinity);
      add('Escape velocity', fmtNum(b.escapeKms, 1) + ' km/s');
      add('Can hold on to', b.gasesHeld.length ? b.gasesHeld.join(', ').replace(/(\d)/g, function(d){ return '₀₁₂₃₄₅₆₇₈₉'[d]; }) + ' (rough, at surface temperature)' : 'Nothing light; any air leaks away');
      add('Magnetic field', b.magnetic + (b.magnetic === 'None' ? ' (the star\'s wind strips the air over time)' : ''));
      add('Sky', b.sky);
    } else if (custom){
      add('Blackbody temperature', kc(b.bbK) + ' (cloud tops differ)');
      if (b.escapeKms) add('Escape velocity', fmtNum(b.escapeKms, 1) + ' km/s (at the cloud tops)');
    }
    if (custom && b.hillKm){
      add('Hill sphere', fmtNum(b.hillKm / 1e6, b.hillKm < 1e7 ? 2 : 1) + ' million km (moons stay inside about a third of it)');
      add('Roche limit', fmtNum(b.rocheKm) + ' km for an icy moon (closer in, it would break up into rings)');
    }
    if (b.trojans) add('Trojan asteroids', 'Two swarms, 60° ahead of it and 60° behind (L4 and L5)' + (custom ? '' : ', thousands known'));
    if (custom && b.moonBodies && b.moonBodies.length) add('Moons', String(b.moonBodies.length));
  }
  if (custom && b.isStar && b.primary){
    add('System age', fmtGyr(sys.ageGyr));
    add('Main-sequence life', b.evolved ? 'It has left the main sequence' : b.spanGyr > 100 ? 'Far longer than the age of the universe' : fmtGyr(b.spanGyr) + ' (rough)');
    add('Habitable zone', fmtNum(sys.hz.inner, 2) + ' to ' + fmtNum(sys.hz.outer, 2) + ' AU' + (sys.hz.rough ? ' (rough)' : ''));
    add('Snow line', fmtNum(sys.frost, 2) + ' AU');
    if (sys.binary){
      var bi = sys.binary, comp = byId.sun2;
      add('Companion star', comp.name + ' (' + comp.spt + ', ' + fmtNum(comp.massSun, 2) + ' × the Sun)');
      add('Companion distance', fmtNum(bi.sep, bi.sep < 1 ? 3 : 1) + ' AU (' + fmtNum(bi.min, bi.min < 1 ? 3 : 1) + ' to ' + fmtNum(bi.max, bi.max < 1 ? 3 : 1) + ')');
      add('Planets', bi.regime === 'S' ? 'Orbit this star only, inside ' + fmtNum(bi.aS * 0.95, 2) + ' AU' : bi.regime === 'P' ? 'Orbit both stars, beyond ' + fmtNum(bi.aP, 2) + ' AU' : 'None can orbit stably');
    }
  }
  $('factNote').textContent = custom
    ? 'A made-up system. Star figures are real data for the star type or table entry; the planets are plausible, not measured. Many of the rules are tabletop-style rules of thumb, not astrophysics. Habitable zone: Kopparapu et al. 2014.'
    : 'Sizes, spin and orbit figures: NASA Planetary Fact Sheet. Distance and light time are worked out live from the date. Habitable zone: Kopparapu et al. 2014.';
  $('mapReset').disabled = !b.customTex;
  $('mapBtn').textContent = 'Use my own map…';
  updateLive();
}
function updateLive(){
  var b = byId[state.focus]; if (!b) return;
  updateTravelLive(b);
  var r = plan[b.id];
  if (r && liveEls.dist){
    var au = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z), km = au * AU_KM;
    liveEls.dist.textContent = fmtNum(au, 3) + ' AU (' + fmtNum(km / 1e6, 1) + ' million km)';
    liveEls.light.textContent = fmtLight(km / C_KMS);
    if (liveEls.flux){
      var flux = 0;
      sys.stars.forEach(function(st){
        var q = plan[st.id] || {x:0, y:0, z:0}, dx = r.x - q.x, dy = r.y - q.y, dz = r.z - q.z, d2 = Math.max(dx * dx + dy * dy + dz * dz, 1e-9);
        flux += st.L / d2;
      });
      liveEls.flux.textContent = fmtNum(flux, flux < 10 ? 2 : 0) + ' × Earth\'s';
    }
  }
  if (liveEls.phase){
    var f = moonElongation(state.jd) / TAU, illum = (1 - Math.cos(f * TAU)) / 2;
    var name = f < 0.03 || f > 0.97 ? 'New' : f < 0.22 ? 'Waxing crescent' : f < 0.28 ? 'First quarter' : f < 0.47 ? 'Waxing gibbous'
             : f < 0.53 ? 'Full' : f < 0.72 ? 'Waning gibbous' : f < 0.78 ? 'Last quarter' : 'Waning crescent';
    liveEls.phase.textContent = name + ', ' + Math.round(illum * 100) + '% lit (mean)';
  }
}

/* Travel: from the selected body (a moon travels as its planet) to another planet. Hohmann figures depend only on the orbits;
   light delay and constant-thrust times use where the two are right now, so they tick over as time runs. */
var travelLive = {}, travelFrom = null, travelDest = null;
function orbiter(b){ return b ? (b.isMoon ? b.parentBody : b) : null; }
function updateTravelRow(b){
  var from = orbiter(b), row = $('travelRow');
  var dests = PLANETS.filter(function(p){ return !p.isStar && p !== from; });
  row.hidden = !from || from.isStar || !dests.length; if (row.hidden){ travelFrom = null; return; }
  var sel = $('travelTo'), keep = travelDest && dests.indexOf(travelDest) >= 0 ? travelDest : dests[0];
  sel.textContent = '';
  dests.forEach(function(p){ var o = document.createElement('option'); o.value = p.id; o.textContent = p.name + (p.home ? ' (home)' : ''); sel.appendChild(o); });
  sel.value = keep.id; travelFrom = from; travelDest = keep;
  showTravel();
}
function showTravel(){
  var dl = $('travelFacts'); dl.textContent = ''; travelLive = {};
  function add(k, v, live){
    var dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = k; dd.textContent = v; if (live){ dd.className = 'live'; travelLive[live] = dd; }
    dl.appendChild(dt); dl.appendChild(dd);
  }
  var M = sys.mode === 'custom' ? (sys.orbitMass || 1) : 1, h = O.hohmann(travelFrom.el.a[0], travelDest.el.a[0], M);
  add('Transfer (Hohmann)', fmtNum(h.dv1, 1) + ' + ' + fmtNum(h.dv2, 1) + ' = ' + fmtNum(h.total, 1) + ' km/s');
  add('Transfer time', fmtPeriod(h.days));
  add('Light delay now', '', 'light');
  add('At 1 g, now', '', 'g1');
  add('At 0.1 g, now', '', 'g01');
  updateTravelLive();
}
function fmtDuration(sec){ var h = sec / 3600; return h < 48 ? fmtNum(h, 1) + ' hours' : fmtNum(h / 24, 1) + ' days'; }
function updateTravelLive(){
  if (!travelFrom || !travelLive.light) return;
  var a = plan[travelFrom.id], c = plan[travelDest.id]; if (!a || !c) return;
  var d = Math.hypot(a.x - c.x, a.y - c.y, a.z - c.z);
  travelLive.light.textContent = fmtLight(O.lightSeconds(d)) + ' (' + fmtNum(d, 2) + ' AU apart)';
  travelLive.g1.textContent = fmtDuration(O.brachistochrone(d, 1));
  travelLive.g01.textContent = fmtDuration(O.brachistochrone(d, 0.1));
}
$('travelTo').addEventListener('change', function(){ travelDest = byId[this.value] || travelDest; showTravel(); });

/* Body buttons: the star and planets always; the moons of whichever planet you are looking at underneath. */
function buildBodyList(){
  var list = $('bodyList'); list.textContent = '';
  BODIES.forEach(function(b){
    if (b.isMoon) return;
    var btn = document.createElement('button');
    btn.className = 'action'; btn.dataset.id = b.id; btn.setAttribute('aria-pressed', 'false');
    btn.textContent = sys.mode === 'custom' && !b.isStar ? b.short + ', ' + (b.giant ? 'giant' : 'rocky') + (b.home ? ' (home)' : '') : b.name;
    btn.title = b.name + (b.kind ? ', ' + b.kind.toLowerCase() : '');
    btn.setAttribute('aria-label', b.name + (b.home ? ' (home world)' : ''));
    btn.addEventListener('click', function(){ focusOn(b.id); });
    list.appendChild(btn);
  });
}
function refreshBodyButtons(){
  var f = byId[state.focus], parent = f.isMoon ? f.parentBody : f, ms = (parent && parent.moonBodies) || [], ml = $('moonList');
  document.querySelectorAll('#bodyList .action').forEach(function(btn){ btn.setAttribute('aria-pressed', String(btn.dataset.id === state.focus)); });
  ml.textContent = '';
  $('moonWrap').hidden = !ms.length;
  if (ms.length){
    $('moonLabel').textContent = 'Moons of ' + parent.name;
    ms.forEach(function(m){
      var btn = document.createElement('button');
      btn.className = 'action'; btn.dataset.id = m.id; btn.textContent = m.short || m.name; btn.title = m.name; btn.setAttribute('aria-label', m.name);
      btn.setAttribute('aria-pressed', String(m.id === state.focus));
      btn.addEventListener('click', function(){ focusOn(m.id); });
      ml.appendChild(btn);
    });
  }
}

/* ------------------------------------------------------------------
   11. Controls: pointer, wheel, keys
------------------------------------------------------------------ */
var canvas = renderer.domElement, pointers = {}, dragInfo = null, pinch = 0;
canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
canvas.addEventListener('pointerdown', function(e){
  canvas.setPointerCapture(e.pointerId);
  pointers[e.pointerId] = {x:e.clientX, y:e.clientY};
  var ids = Object.keys(pointers);
  if (ids.length === 1){ dragInfo = {x0:e.clientX, y0:e.clientY, moved:0}; canvas.classList.add('dragging'); }
  else if (ids.length === 2){ pinch = pointerDist(); dragInfo = null; }
});
canvas.addEventListener('pointermove', function(e){
  var p = pointers[e.pointerId]; if (!p) return;
  var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  var ids = Object.keys(pointers);
  if (ids.length === 1 && dragInfo){
    dragInfo.moved += Math.abs(dx) + Math.abs(dy);
    camera3.theta -= dx * 0.006; camera3.phi = clamp(camera3.phi + dy * 0.006, -1.5, 1.5);
  } else if (ids.length === 2){
    var d = pointerDist();
    if (pinch > 0) camera3.targetDist = limitDist(camera3.targetDist * pinch / d);
    pinch = d;
  }
});
function pointerDist(){ var ids = Object.keys(pointers), a = pointers[ids[0]], b = pointers[ids[1]]; return Math.hypot(a.x - b.x, a.y - b.y) || 1; }
function endPointer(e){
  var was = pointers[e.pointerId]; delete pointers[e.pointerId];
  if (!Object.keys(pointers).length){ canvas.classList.remove('dragging'); }
  if (dragInfo && was && e.type === 'pointerup' && dragInfo.moved < 5){ pickAt(e.clientX, e.clientY); }
  if (Object.keys(pointers).length < 2) pinch = 0;
  dragInfo = null;
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('wheel', function(e){
  e.preventDefault();
  var d = e.deltaY * (e.deltaMode === 1 ? 16 : 1);
  camera3.targetDist = limitDist(camera3.targetDist * Math.exp(d * 0.0014));
}, {passive:false});
canvas.addEventListener('dblclick', function(e){ var b = pickAt(e.clientX, e.clientY); if (!b) focusOn('sun', {overview:true}); });

// The body under a screen point, or null. Points over the control panel never count.
function bodyAt(cx, cy){
  var rect = canvas.getBoundingClientRect(), x = cx - rect.left, y = cy - rect.top, best = null, bestScore = 1e9;
  if (!isFinite(x) || !isFinite(y) || x > visible.w || y > visible.h) return null;
  BODIES.forEach(function(b){
    if (!b.screen || b.screen.behind) return;
    var d = Math.hypot(b.screen.x - x, b.screen.y - y), reach = Math.max(b.pxRadius, 16);
    if (d <= reach){
      var score = d / reach;
      if (score < bestScore){ bestScore = score; best = b; }
    }
  });
  return best;
}
function pickAt(cx, cy){
  var best = bodyAt(cx, cy);
  if (best) focusOn(best.id);
  return best;
}

function setSpeed(i, keepSaved){
  state.speedIdx = clamp(i, 0, SPEEDS.length - 1);
  $('speed').value = state.speedIdx;
  $('speedLabel').textContent = SPEEDS[state.speedIdx].label; $('rSpeed').textContent = state.paused ? 'Paused' : SPEEDS[state.speedIdx].label;
  if (!keepSaved && sys && sys.mode === 'sol'){ solarSpeedIdx = state.speedIdx; saveView(); }
}
function setPaused(p){
  state.paused = p;
  var btn = $('playPause'); btn.textContent = p ? 'Play' : 'Pause'; btn.setAttribute('aria-pressed', String(p));
  $('rSpeed').textContent = p ? 'Paused' : SPEEDS[state.speedIdx].label;
}
function setDir(d){
  state.dir = d; var btn = $('reverse'); btn.setAttribute('aria-pressed', String(d < 0));
}
function goToday(){
  if (sys.mode === 'custom'){ state.jd = sys.epochJd; rebuildOrbits(); toast('Back to the start of the clock.'); return; }
  state.jd = jdFromDate(new Date()); rebuildOrbits(); toast('Back to today.');
}
function setToggle(id, key, on, apply){
  state[key] = on; $(id).setAttribute('aria-pressed', String(on)); if (apply) apply(); saveView();
}
function applyVisibility(){
  PLANETS.forEach(function(b){ b.orbitLine.visible = state.orbits; });
  MOONS.forEach(function(m){ m.orbitLine.visible = state.orbits; });
  labelsEl.style.display = state.labels ? '' : 'none';
  stars.visible = state.stars;
  zoneGroup.visible = state.zone;
  beltRoot.visible = state.orbits;
  BELTS.forEach(function(bt){ bt.label.style.display = state.orbits ? '' : 'none'; });
}

$('playPause').addEventListener('click', function(){ setPaused(!state.paused); });
$('reverse').addEventListener('click', function(){ setDir(-state.dir); });
$('speed').addEventListener('input', function(){ setSpeed(+this.value); });
$('today').addEventListener('click', goToday);
$('overview').addEventListener('click', function(){ focusOn('sun', {overview:true}); });
$('tOrbits').addEventListener('click', function(){ setToggle('tOrbits', 'orbits', !state.orbits, applyVisibility); });
$('tLabels').addEventListener('click', function(){ setToggle('tLabels', 'labels', !state.labels, applyVisibility); });
$('tStars').addEventListener('click', function(){ setToggle('tStars', 'stars', !state.stars, applyVisibility); });
$('tZone').addEventListener('click', function(){ setToggle('tZone', 'zone', !state.zone, applyVisibility); });
function setScaleMode(key, on, ids){
  if (state[key] === on) return;
  state[key] = on; $(ids[0]).setAttribute('aria-pressed', String(!on)); $(ids[1]).setAttribute('aria-pressed', String(on));
  applyScaleChange(); saveView();
}
$('distSqueezed').addEventListener('click', function(){ setScaleMode('trueDist', false, ['distSqueezed', 'distTrue']); });
$('distTrue').addEventListener('click', function(){ setScaleMode('trueDist', true, ['distSqueezed', 'distTrue']); });
$('sizeBig').addEventListener('click', function(){ setScaleMode('trueSize', false, ['sizeBig', 'sizeTrue']); });
$('sizeTrue').addEventListener('click', function(){ setScaleMode('trueSize', true, ['sizeBig', 'sizeTrue']); });
$('resetView').addEventListener('click', function(){ focusOn('sun', {overview:true}); toast('View reset.'); });
$('resetDisplay').addEventListener('click', function(){
  setToggle('tOrbits', 'orbits', true); setToggle('tLabels', 'labels', true); setToggle('tStars', 'stars', true); setToggle('tZone', 'zone', true);
  applyVisibility();
  setScaleMode('trueDist', false, ['distSqueezed', 'distTrue']); setScaleMode('trueSize', false, ['sizeBig', 'sizeTrue']);
  toast('Display reset.');
});

/* Drawer: a right-hand column on wide screens, a bottom sheet with a handle below that */
var drawer = $('drawer'), handleEl = $('handle');
function syncDrawer(){
  var wide = window.innerWidth >= 820, closed = !wide && drawer.classList.contains('closed');
  handleEl.setAttribute('aria-expanded', String(!closed));
  var h = wide ? 0 : closed ? 46 : drawer.getBoundingClientRect().height;     // closing slides it down; its height doesn't change, so use the handle's
  document.documentElement.style.setProperty('--drawer-h', wide ? '62px' : Math.round(Math.min(h, window.innerHeight * 0.66)) + 'px');
}
handleEl.addEventListener('click', function(){ drawer.classList.toggle('closed'); syncDrawer(); });
handleEl.addEventListener('keydown', function(e){
  if (e.key !== 'Enter' && e.key !== ' ') return;
  e.preventDefault(); e.stopPropagation(); drawer.classList.toggle('closed'); syncDrawer();     // Space here opens the drawer, not pause
});
if (window.innerWidth < 820) drawer.classList.add('closed');
window.addEventListener('resize', syncDrawer);
if (window.ResizeObserver) new ResizeObserver(syncDrawer).observe(drawer);
syncDrawer();

/* Toast */
var toastTimer = 0;
function toast(msg){
  var t = $('toast'); t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(function(){ t.classList.remove('show'); }, 3200);
}

/* Help overlay with a Tab trap */
var helpFocus = null;
function openHelp(){ helpFocus = document.activeElement; $('help').hidden = false; $('helpClose').focus(); }
function closeHelp(){ $('help').hidden = true; if (helpFocus && helpFocus.focus) helpFocus.focus(); }
$('helpOpen').addEventListener('click', openHelp);
$('helpClose').addEventListener('click', closeHelp);
$('help').addEventListener('click', function(e){ if (e.target === this) closeHelp(); });

function stepFocus(d){
  var i = BODIES.indexOf(byId[state.focus]);
  focusOn(BODIES[(i + d + BODIES.length) % BODIES.length].id);
}
window.addEventListener('keydown', function(e){
  var t = e.target, tag = t && t.tagName;
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (!$('help').hidden){
    if (e.key === 'Escape'){ closeHelp(); return; }
    if (e.key === 'Tab'){ e.preventDefault(); $('helpClose').focus(); return; }
    if (e.key !== '?') return;
  }
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  var k = e.key, step = 0.08;
  if (k === '?'){ if ($('help').hidden) openHelp(); else closeHelp(); e.preventDefault(); return; }
  if (k === ' '){ if (tag === 'BUTTON' || tag === 'SUMMARY' || tag === 'A') return; setPaused(!state.paused); e.preventDefault(); return; }
  if (k === '[') { setSpeed(state.speedIdx - 1); return; }
  if (k === ']') { setSpeed(state.speedIdx + 1); return; }
  if (k === 'r' || k === 'R'){ setDir(-state.dir); return; }
  if (k === 't' || k === 'T'){ goToday(); return; }
  if (k === 'o' || k === 'O'){ setToggle('tOrbits', 'orbits', !state.orbits, applyVisibility); return; }
  if (k === 'l' || k === 'L'){ setToggle('tLabels', 'labels', !state.labels, applyVisibility); return; }
  if (k === 'z' || k === 'Z'){ setToggle('tZone', 'zone', !state.zone, applyVisibility); return; }
  if (k === ','){ stepFocus(-1); return; }
  if (k === '.'){ stepFocus(1); return; }
  if (k === '0'){ focusOn('sun', {overview:true}); return; }
  if (k >= '1' && k <= '9'){
    var b = BODIES.filter(function(x){ return x.key === k; })[0];
    if (b) focusOn(b.id); return;
  }
  if (k === '+' || k === '='){ camera3.targetDist = limitDist(camera3.targetDist * 0.88); return; }
  if (k === '-' || k === '_'){ camera3.targetDist = limitDist(camera3.targetDist / 0.88); return; }
  if (k === 'ArrowLeft'){ camera3.theta += step; e.preventDefault(); }
  else if (k === 'ArrowRight'){ camera3.theta -= step; e.preventDefault(); }
  else if (k === 'ArrowUp'){ camera3.phi = clamp(camera3.phi + step, -1.5, 1.5); e.preventDefault(); }
  else if (k === 'ArrowDown'){ camera3.phi = clamp(camera3.phi - step, -1.5, 1.5); e.preventDefault(); }
});

/* ------------------------------------------------------------------
   12. Your own maps
------------------------------------------------------------------ */
// Your images are kept for as long as the page is open, separately for our Solar System and for built systems,
// keyed by body id. Rolling a new system keeps them on the same planet slots (b, c, d...); nothing is sent anywhere.
var userMaps = {sol:{}, custom:{}};
function fitSource(img){
  var maxT = renderer.capabilities.maxTextureSize || 4096, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height, src = img;
  if (w > maxT || h > maxT){
    var k = Math.min(maxT / w, maxT / h), c = document.createElement('canvas');
    c.width = Math.floor(w * k); c.height = Math.floor(h * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); src = c;
  }
  return {src:src, w:w, h:h};
}
function dress(b, src){
  var tex = new THREE.Texture(src);
  tex.encoding = THREE.sRGBEncoding; tex.anisotropy = maxAniso; tex.needsUpdate = true;
  if (b.customTex) b.customTex.dispose();
  b.customTex = tex; b.material.map = tex; b.material.color.set(0xffffff); b.material.needsUpdate = true;
}
function refreshMapButtons(){
  $('mapsClear').disabled = !Object.keys(userMaps[sys.mode]).length;
  var f = byId[state.focus]; if (f) $('mapReset').disabled = !f.customTex;
}
function applyMap(b, img, name, quiet){
  var fit = fitSource(img);
  dress(b, fit.src);
  userMaps[sys.mode][b.id] = {src:fit.src, name:name, ratio:fit.w / fit.h};
  if (!quiet){
    var msg = b.name + ' now wears ' + name + '. It stays in this tab; nothing is uploaded.';
    if (Math.abs(fit.w / fit.h - 2) > 0.1) msg += ' That image is ' + fmtNum(fit.w / fit.h, 2) + ':1, not 2:1, so it will look stretched.';
    $('mapMsg').textContent = msg;
    toast(b.name + ' has your image.');
  }
  refreshMapButtons();
}
function unDress(b){
  if (b.customTex){ b.customTex.dispose(); b.customTex = null; }
  if (b.builtTex){ b.material.map = b.builtTex; b.material.color.set(0xffffff); }
  else { b.material.map = null; b.material.color.set(b.color); }
  b.material.needsUpdate = true;
}
function resetMap(b){
  if (!b.customTex) return;
  unDress(b); delete userMaps[sys.mode][b.id];
  $('mapMsg').textContent = b.name + ' is back to its built-in look.';
  refreshMapButtons();
}
function clearAllMaps(){
  Object.keys(userMaps[sys.mode]).forEach(function(id){ if (byId[id]) unDress(byId[id]); });
  userMaps[sys.mode] = {};
  refreshMapButtons();
  toast('All your images removed.');
}
function restoreMaps(){
  var m = userMaps[sys.mode];
  Object.keys(m).forEach(function(id){ if (byId[id]) dress(byId[id], m[id].src); });
  refreshMapButtons();
}
function isImageFile(f){ return (f.type && f.type.indexOf('image/') === 0) || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(f.name || ''); }
function readImage(f, ok, fail){
  var url = URL.createObjectURL(f), img = new Image();
  img.onload = function(){ URL.revokeObjectURL(url); ok(img); };
  img.onerror = function(){ URL.revokeObjectURL(url); fail(); };
  img.src = url;
}
// One image dresses 'start'; more images dress the bodies after it, in the order they are listed.
function loadMapFiles(fileList, start){
  var files = Array.prototype.filter.call(fileList, isImageFile);
  if (!files.length){
    var one = fileList[0];
    $('mapMsg').textContent = (one ? one.name : 'That') + ' does not look like an image. Try a PNG or JPG.'; toast('That is not an image.'); return;
  }
  var i0 = BODIES.indexOf(start), total = Math.min(files.length, BODIES.length), done = 0, ok = 0, failed = [];
  function finish(){
    if (++done < total) return;
    if (total > 1) toast('Dressed ' + ok + ' bodies, starting with ' + start.name + (files.length > total ? '. Extra images were left over.' : '.'));
    if (failed.length) $('mapMsg').textContent = 'Could not read ' + failed.join(', ') + '. Try a PNG or JPG.';
    else if (total > 1) $('mapMsg').textContent = ok + ' images are on ' + ok + ' bodies, in order from ' + start.name + '.';
  }
  files.slice(0, total).forEach(function(f, k){
    var b = BODIES[(i0 + k) % BODIES.length];
    readImage(f, function(img){ applyMap(b, img, f.name, total > 1); ok++; finish(); }, function(){ failed.push(f.name); finish(); });
  });
}
function loadMapFile(f){ if (f) loadMapFiles([f], byId[state.focus]); }
$('mapFile').addEventListener('change', function(){ var files = Array.prototype.slice.call(this.files); this.value = ''; if (files.length) loadMapFiles(files, byId[state.focus]); });
$('mapFile').multiple = true;
$('mapReset').addEventListener('click', function(){ resetMap(byId[state.focus]); });
$('mapsClear').addEventListener('click', clearAllMaps);
// Paste an image straight onto the selected body
window.addEventListener('paste', function(e){
  var items = (e.clipboardData && e.clipboardData.files) || [];
  var imgs = Array.prototype.filter.call(items, function(f){ return /^image\//.test(f.type); });
  if (imgs.length){ e.preventDefault(); loadMapFiles(imgs, byId[state.focus]); }
});

// Drag an image over a body and the page says which one it will dress; drop it there. Dropped anywhere else, it dresses the selected body.
var dropHint = $('dropHint'), pausedByDrag = false, dragTimer = 0;
function endDragPause(){
  clearTimeout(dragTimer); dropHint.hidden = true; $('mapBtn').classList.remove('hot');
  if (pausedByDrag){ pausedByDrag = false; setPaused(false); }
}
function hasFiles(e){ return !!(e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') >= 0); }
['dragenter', 'dragover'].forEach(function(t){
  window.addEventListener(t, function(e){
    e.preventDefault();
    if (t !== 'dragover' || !hasFiles(e)) return;
    if (!state.paused){ pausedByDrag = true; setPaused(true); }        // hold still, so the planet you are aiming at stays put
    clearTimeout(dragTimer); dragTimer = setTimeout(endDragPause, 600);   // if the drag is abandoned, carry on
    var b = bodyAt(e.clientX, e.clientY) || byId[state.focus];
    $('mapBtn').classList.add('hot'); $('projOpen').classList.remove('hot');
    dropHint.hidden = false; dropHint.textContent = 'Drop to dress ' + b.name;
    dropHint.style.left = e.clientX + 'px'; dropHint.style.top = e.clientY + 'px';
  });
});
window.addEventListener('drop', function(e){
  e.preventDefault(); endDragPause();
  if (!e.dataTransfer || !e.dataTransfer.files.length) return;
  var b = bodyAt(e.clientX, e.clientY) || byId[state.focus];
  if (b.id !== state.focus) focusOn(b.id);
  loadMapFiles(e.dataTransfer.files, b);
});

/* ---- project files: the system and your images, in one file you can carry about ---- */
function srcToDataUrl(src){
  var w = src.naturalWidth || src.width, h = src.naturalHeight || src.height, k = Math.min(1, 2048 / w), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.9);
}
$('projSave').addEventListener('click', function(){
  var maps = Object.keys(userMaps[sys.mode]).map(function(id){ var m = userMaps[sys.mode][id]; return {id:id, name:m.name, data:srcToDataUrl(m.src)}; });
  var proj = {app:'solarify', version:1, mode:sys.mode, link:sys.mode === 'custom' ? SYS.encodeCfg(sys.cfg) : null, maps:maps};
  var blob = new Blob([JSON.stringify(proj)], {type:'application/json'}), a = document.createElement('a'), url = URL.createObjectURL(blob);
  a.href = url; a.download = 'solarify-' + (sys.mode === 'custom' ? sys.name.toLowerCase() : 'solar-system') + '.json';
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
  toast('Saved ' + a.download + (maps.length ? ' with ' + maps.length + (maps.length === 1 ? ' image.' : ' images.') : '.'));
});
$('projFile').addEventListener('change', function(){
  var f = this.files[0]; this.value = ''; if (!f) return;
  if (f.size > 80 * 1024 * 1024){ toast('That file is too big to be a Solarify project.'); return; }
  var rd = new FileReader();
  rd.onload = function(){ openProject(String(rd.result)); };
  rd.onerror = function(){ toast('Could not read that file.'); };
  rd.readAsText(f);
});
function openProject(text){
  var proj, cfg = null;
  try{ proj = JSON.parse(text); }catch(e){ proj = null; }
  if (!proj || proj.app !== 'solarify' || proj.version !== 1 || (proj.mode !== 'sol' && proj.mode !== 'custom')){ toast('That is not a Solarify project file.'); return false; }
  if (proj.mode === 'custom'){ cfg = SYS.decodeCfg(proj.link); if (!cfg){ toast('That project was made by a different version of the builder, so it cannot be opened.'); return false; } }
  var list = Array.isArray(proj.maps) ? proj.maps.filter(function(m){
    return m && typeof m.id === 'string' && typeof m.name === 'string' && typeof m.data === 'string' && /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]+$/.test(m.data);
  }).slice(0, 200) : [];
  var loaded = {}, left = list.length;
  function go(){
    userMaps[proj.mode] = loaded;
    if (proj.mode === 'custom') generateSystem(cfg); else showSolar();
    toast('Opened the project' + (Object.keys(loaded).length ? ' with ' + Object.keys(loaded).length + ' images.' : '.'));
  }
  if (!left){ go(); return true; }
  list.forEach(function(m){
    var img = new Image();
    img.onload = function(){ loaded[m.id] = {src:fitSource(img).src, name:m.name.slice(0, 200), ratio:img.width / img.height}; if (!--left) go(); };
    img.onerror = function(){ if (!--left) go(); };
    img.src = m.data;
  });
  return true;
}

/* ------------------------------------------------------------------
   13. Save a PNG of what you can see
------------------------------------------------------------------ */
$('savePng').addEventListener('click', function(){
  renderer.render(scene, camera);
  var sx = canvas.width / (stage.clientWidth || 1), sy = canvas.height / (stage.clientHeight || 1);
  var out = document.createElement('canvas');
  out.width = Math.round(visible.w * sx); out.height = Math.round(visible.h * sy);
  out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height, 0, 0, out.width, out.height);
  out.toBlob(function(blob){
    if (!blob){ toast('Could not make the PNG.'); return; }
    var a = document.createElement('a'), url = URL.createObjectURL(blob);
    var when = sys.mode === 'custom' ? 'day' + Math.round(state.jd - sys.epochJd) : dateFromJd(state.jd).toISOString().slice(0, 10);
    a.href = url; a.download = 'solarify-' + (sys.mode === 'custom' ? sys.name.toLowerCase() + '-' : '') + state.focus + '-' + when + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    toast('Saved ' + a.download);
  }, 'image/png');
});

/* ------------------------------------------------------------------
   14. Loading a system. Everything above works on whatever 'sys' is; this swaps it.
------------------------------------------------------------------ */
function loadSystem(def){
  if (sys) teardownSystem();
  sys = def;
  def.bodies.forEach(function(b){ BODIES.push(b); byId[b.id] = b; });
  BODIES.forEach(function(b){
    if (b.isMoon){
      b.parentBody = byId[b.parent];
      (b.parentBody.moonBodies = b.parentBody.moonBodies || []).push(b);
      MOONS.push(b);
    }
    if (b.el) PLANETS.push(b);
  });
  def.star = byId.sun;
  def.stars = BODIES.filter(function(b){ return b.isStar; });
  var rocks = PLANETS.filter(function(p){ return !p.isStar; });
  def.innerA = rocks.length ? Math.min.apply(null, rocks.map(function(p){ return p.el.a[0] * (1 - p.el.e[0]); })) : null;
  BODIES.forEach(createBody);
  makeBelts(); makeTrojans();
  queueTextures();

  // clock
  if (def.mode === 'sol'){
    state.jd = jdFromDate(new Date());
    setSpeed(solarSpeedIdx, true);
  } else {
    state.jd = def.epochJd;
    var want = def.refPeriodDays / 12, idx = 0;       // about twelve seconds for the home planet to go round
    SPEEDS.forEach(function(s, i){ if (s.days <= want) idx = i; });
    setSpeed(idx, true);
  }
  setDir(1); setPaused(!!reducedMotion);

  // interface
  $('sysName').hidden = def.mode !== 'custom';
  if (def.mode === 'custom') $('sysName').textContent = def.name + ', ' + def.primary.label + (def.binary ? ' with a companion star' : '');
  $('today').textContent = def.mode === 'custom' ? 'Back to the start' : 'Back to today';
  $('timeHint').textContent = def.mode === 'custom'
    ? 'This system starts at day 0 with the planets at random points on their orbits. Spin is slowed at high speeds so planets don\'t strobe.'
    : 'Planets sit where they really are on the date shown. Spin is slowed at high speeds so planets don\'t strobe.';
  $('rangeNote').hidden = true;
  buildBodyList();
  $('mapMsg').textContent = 'Drop an equirectangular map (2:1) anywhere to dress the selected body. It stays in this tab; nothing is uploaded.';
  buildZone();
  updateScaleHint();
  focusOffset.set(0, 0, 0);
  updateBodies(0);
  BODIES.forEach(function(b){ b.group.updateMatrixWorld(true); });
  focusOn('sun', {overview:true});
  camera3.theta = 0.6; camera3.phi = 0.5;
  camera3.dist = camera3.targetDist;
  applyVisibility();
  restoreMaps();
  lastDateText = '';
}

/* ------------------------------------------------------------------
   15. The "Build your own" form
------------------------------------------------------------------ */
var CFG_KEY = 'solarify.cfg', curSizes = {}, curDiam = {}, curTypes = {};   // per-planet size class and exact-diameter overrides, kept apart from the form controls
function randomSeed(){ return 1 + Math.floor(Math.random() * 99999); }
function formCfg(){
  return SYS.normalise({star:$('fStar').value, mass:+$('fMass').value, age:+$('fAge').value, inner:+$('fInner').value, outer:+$('fOuter').value, belts:+$('fBelts').value,
    moonsInner:+$('fMoonsInner').value, moonsOuter:+$('fMoonsOuter').value, home:$('fHome').value, giants:$('fGiants').value, companion:$('fCompanion').value, seed:+$('fSeed').value, sizes:curSizes, diam:curDiam, types:curTypes});
}
function updateOutputs(){
  $('oMass').textContent = fmtNum(+$('fMass').value / 100, 2) + ' × Sun';
  var age = +$('fAge').value; $('oAge').textContent = age === 0 ? 'rolled from the seed' : fmtNum(age / 10, 1) + ' billion years';
  $('massRow').hidden = $('fStar').value !== 'X';
  [['fInner', 'oInner'], ['fOuter', 'oOuter'], ['fBelts', 'oBelts'], ['fMoonsInner', 'oMoonsInner'], ['fMoonsOuter', 'oMoonsOuter']].forEach(function(r){ $(r[1]).textContent = $(r[0]).value; });
}
var giantMoonsTouched = false, buildTimer = 0;
function setForm(c){
  curSizes = c.sizes || {}; curDiam = c.diam || {}; curTypes = c.types || {};
  giantMoonsTouched = c.moonsOuter !== Math.min(8, 2 * c.moonsInner);
  $('fStar').value = c.star; $('fHome').value = c.home; $('fSeed').value = c.seed; $('fGiants').value = c.giants; $('fCompanion').value = c.companion;
  $('fMass').value = c.star === 'X' ? c.mass : 100; $('fAge').value = c.age;
  [['fInner', c.inner], ['fOuter', c.outer], ['fBelts', c.belts], ['fMoonsInner', c.moonsInner], ['fMoonsOuter', c.moonsOuter]].forEach(function(r){ $(r[0]).value = r[1]; });
  if (c.giants !== 'c' || c.companion !== 'n' || c.belts !== 1 || c.star === 'X') $('advanced').open = true;
  updateOutputs();
}
// Every control rebuilds the system as soon as you let go of it, so there is no Generate button to find.
function onFormChange(e){
  var id = e.target.id;
  // Overrides belong to planet slots. Anything but a moon count can reshuffle the planets, so they are dropped rather than landing on the wrong planet.
  if (id !== 'fMoonsInner' && id !== 'fMoonsOuter' && (Object.keys(curSizes).length || Object.keys(curDiam).length || Object.keys(curTypes).length)){
    curSizes = {}; curDiam = {}; curTypes = {};
    if (sys && sys.mode === 'custom') toast('Planet size, diameter and type choices cleared: that change reshuffles the planets.');
  }
  if (id === 'fMoonsOuter') giantMoonsTouched = true;
  if (id === 'fMoonsInner' && !giantMoonsTouched) $('fMoonsOuter').value = Math.min(8, 2 * (+$('fMoonsInner').value));
  if (id === 'fStar' && $('fStar').value === 'X') $('advanced').open = true;
  updateOutputs();
  if (!sys || sys.mode !== 'custom') return;
  clearTimeout(buildTimer);
  buildTimer = setTimeout(function(){ generateSystem(formCfg(), true); }, 160);
}
(function initForm(){
  SYS.STAR_ORDER.forEach(function(k){
    var o = document.createElement('option'); o.value = k; o.textContent = SYS.STARS[k].label; $('fStar').appendChild(o);
  });
  var xo = document.createElement('option'); xo.value = 'X'; xo.textContent = SYS.MASS_STAR.label; $('fStar').appendChild(xo);
  var saved = null;
  try{ var raw = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); if (raw && typeof raw === 'object' && raw.giants) saved = SYS.normalise(raw); }catch(e){}
  setForm(saved || SYS.normalise({star:'G', age:46, inner:4, outer:4, belts:1, moonsInner:1, moonsOuter:2, home:'hz', giants:'c', companion:'n', seed:randomSeed()}));
  var ids = ['fStar', 'fMass', 'fAge', 'fInner', 'fOuter', 'fBelts', 'fMoonsInner', 'fMoonsOuter', 'fHome', 'fGiants', 'fCompanion', 'fSeed'];
  ids.forEach(function(id){ $(id).addEventListener('input', updateOutputs); $(id).addEventListener('change', onFormChange); });
})();

/* Per-planet size: a class picker in the Selected section. Auto means whatever the rules rolled. */
var TYPE_LABELS = {Garden:'Garden (temperate)', Ocean:'Ocean', Rock:'Rock (barren)', Ice:'Ice', Hadean:'Hadean (frozen rock)', Ammonia:'Ammonia', Sulfur:'Sulfur', Greenhouse:'Greenhouse (runaway)', Chthonian:'Chthonian (scorched core)'};
var SIZE_NAMES = {rocky:['Tiny', 'Small', 'Standard', 'Large'], giant:['Small', 'Medium', 'Large']};
function sizeSlot(b){ return /^p(\d+)$/.test(b.id) ? +RegExp.$1 : 0; }
function updateSizeRow(b){
  var row = $('sizeRow'), ok = sys && sys.mode === 'custom' && !b.isStar && !b.isMoon && sizeSlot(b) > 0;
  row.hidden = !ok; if (!ok) return;
  var sel = $('sizeSel'), names = b.giant ? SIZE_NAMES.giant : SIZE_NAMES.rocky;
  sel.textContent = '';
  var auto = document.createElement('option'); auto.value = 'auto'; auto.textContent = 'Auto (' + b.sizeAuto + ')'; sel.appendChild(auto);
  names.forEach(function(n, i){
    var o = document.createElement('option'); o.value = String(b.giant ? i + 4 : i); o.textContent = n + (b.giant ? ' giant' : ''); sel.appendChild(o);
  });
  var cls = b.giant ? b.ggClass : b.sizeClass;
  sel.value = b.sizeSet ? String(names.indexOf(cls) + (b.giant ? 4 : 0)) : 'auto';
  var tw = $('typeWrap'); tw.hidden = !!b.giant;
  if (!b.giant){
    var ts = $('typeSel'); ts.textContent = '';
    var ta = document.createElement('option'); ta.value = 'auto'; ta.textContent = 'Auto: ' + TYPE_LABELS[b.typeAuto]; ts.appendChild(ta);
    b.typeOptions.forEach(function(t){ var o = document.createElement('option'); o.value = String(SYS.TYPE_LIST.indexOf(t)); o.textContent = TYPE_LABELS[t]; ts.appendChild(o); });
    ts.value = b.typeSet ? String(SYS.TYPE_LIST.indexOf(b.worldType)) : 'auto';
  }
  var sl = $('sizeDiam'); sl.value = String(Math.round(b.diamT * 1000)); $('diamReset').disabled = !b.diamSet; showDiam(b);
  $('sizeMsg').textContent = b.giant
    ? 'Size picks the kind of giant and the slider sets its diameter inside that range; mass and moons follow. Changing anything above except moon counts clears these.'
    : 'Size picks the class, World type picks what it is made of, and the slider sets the diameter inside the class. Air, temperature, gravity and moons follow. Other planets stay as they are. Changing anything above except moon counts clears these.';
}
function showDiam(b){
  var t = +$('sizeDiam').value / 1000, D = b.diamMin + t * (b.diamMax - b.diamMin);
  $('oDiam').textContent = fmtNum(D, D < 1 ? 3 : 2) + ' × Earth';
  $('sizeDiam').setAttribute('aria-valuetext', fmtNum(D * 12756) + ' km across');
}
function copyOf(o){ var c = {}; Object.keys(o).forEach(function(k){ c[k] = o[k]; }); return c; }
// Rebuild with one planet's overrides changed, then come back to that planet.
function applyOverride(change){
  var b = byId[state.focus], slot = b ? sizeSlot(b) : 0;
  if (!slot || !sys || sys.mode !== 'custom') return;
  var sizes = copyOf(curSizes), diam = copyOf(curDiam), types = copyOf(curTypes); change(sizes, diam, slot, types);
  var id = b.id, cfg = formCfg(); cfg.sizes = sizes; cfg.diam = diam; cfg.types = types; clearTimeout(buildTimer);
  generateSystem(SYS.normalise(cfg), true);
  if (byId[id]) focusOn(id);
}
$('sizeSel').addEventListener('change', function(){
  var v = this.value;
  applyOverride(function(sizes, diam, slot, types){ if (v === 'auto') delete sizes[slot]; else sizes[slot] = +v; delete diam[slot]; delete types[slot]; });   // a new class starts from its own rolled diameter and type
});
$('typeSel').addEventListener('change', function(){
  var v = this.value;
  applyOverride(function(sizes, diam, slot, types){ if (v === 'auto') delete types[slot]; else types[slot] = +v; });
});
$('sizeDiam').addEventListener('input', function(){ var b = byId[state.focus]; if (b && b.diamMin != null) showDiam(b); });
$('sizeDiam').addEventListener('change', function(){ var v = +this.value; applyOverride(function(sizes, diam, slot){ diam[slot] = v; }); });
$('diamReset').addEventListener('click', function(){ applyOverride(function(sizes, diam, slot){ delete diam[slot]; }); });
function describe(g){
  var c = g.counts, hz = g.hz, plural = function(n, one, many){ return n + ' ' + (n === 1 ? one : many); };
  var parts = [plural(c.rocky, 'rocky planet', 'rocky planets'), plural(c.giants, 'giant', 'giants')];
  if (c.belts) parts.push(plural(c.belts, 'asteroid belt', 'asteroid belts'));
  parts.push(plural(c.moons, 'moon', 'moons'));
  var txt = parts.join(', ') + '. ' + (g.binary ? 'Two stars. ' : '') + 'System age ' + fmtNum(g.ageGyr, 1) + ' billion years. Habitable zone ' + fmtNum(hz.inner, 2) + ' to ' + fmtNum(hz.outer, 2) + ' AU; snow line ' + fmtNum(g.frost, 2) + ' AU.';
  return txt;
}
function buildDef(g){ g.mode = 'custom'; return g; }
function showBuilt(cfg, g){
  $('sysSummary').textContent = describe(g);
  var ul = $('sysNotes'); ul.textContent = '';
  g.notes.forEach(function(n){ var li = document.createElement('li'); li.textContent = n; ul.appendChild(li); });
  setForm(cfg);
  try{ localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); }catch(e){}
  try{ history.replaceState(null, '', location.pathname + location.search + '#s=' + SYS.encodeCfg(cfg)); }catch(e){}
}
function generateSystem(cfg, quiet){
  var g = buildDef(SYS.generate(cfg));
  loadSystem(g);
  setMode('custom');
  showBuilt(g.cfg, g);
  var asked = g.counts.moonsWanted, got = g.counts.moons;
  if (asked !== got) toast('Built ' + g.name + ': ' + got + ' of ' + asked + ' moons could stay in orbit.');
  else if (!quiet) toast('Built ' + g.name + '. Drop an image on any planet to dress it.');
  return true;
}
function showSolar(){
  loadSystem(solarDef());
  setMode('sol');
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  return true;
}
function setMode(m){
  $('modeSol').setAttribute('aria-pressed', String(m === 'sol'));
  $('modeBuild').setAttribute('aria-pressed', String(m === 'custom'));
  $('buildForm').hidden = m !== 'custom';
}
$('modeSol').addEventListener('click', function(){ if (sys.mode !== 'sol') showSolar(); });
$('modeBuild').addEventListener('click', function(){ if (sys.mode !== 'custom') generateSystem(formCfg()); });
$('fRoll').addEventListener('click', function(){ clearTimeout(buildTimer); curSizes = {}; curDiam = {}; curTypes = {}; $('fSeed').value = randomSeed(); generateSystem(formCfg()); });
$('fCopy').addEventListener('click', function(){
  var url = location.href;
  function fallback(){ toast('Copy it from the address bar: ' + url); }
  try{
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(function(){ toast('Link copied. It rebuilds this exact system.'); }, fallback);
    else fallback();
  }catch(e){ fallback(); }
});

/* ------------------------------------------------------------------
   16. Frame loop
------------------------------------------------------------------ */
var last = performance.now(), liveClock = 0, lastDateText = '';
function frame(now){
  var dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!state.paused){
    var next = state.jd + state.dir * SPEEDS[state.speedIdx].days * dt;
    state.jd = sys.mode === 'custom' ? clamp(next, sys.epochJd - CUSTOM_SPAN_DAYS, sys.epochJd + CUSTOM_SPAN_DAYS) : clamp(next, JD_MIN, JD_MAX);
  }
  layoutView();
  updateBodies(dt);
  updateCamera(dt);
  updateLabels();
  var txt;
  if (sys.mode === 'custom'){
    var days = state.jd - sys.epochJd;
    txt = 'Day ' + fmtNum(days, 0) + '  (year ' + fmtNum(days / 365.25, 2) + ')';
  } else {
    var ds = dateFromJd(state.jd).toISOString();
    txt = ds.slice(0, 10) + ' ' + ds.slice(11, 16) + ' UTC';
  }
  if (txt !== lastDateText){
    $('dateText').textContent = txt; lastDateText = txt;
    if (sys.mode === 'sol') $('rangeNote').hidden = state.jd >= 2378496.5 && state.jd <= 2469807.5;   // 1800 to 2050
  }
  liveClock += dt; if (liveClock > 0.25){ liveClock = 0; updateLive(); }
  if (texJob || texQueue.length) pumpTextures();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------
   17. Start
------------------------------------------------------------------ */
['tOrbits:orbits', 'tLabels:labels', 'tStars:stars', 'tZone:zone'].forEach(function(p){ var q = p.split(':'); $(q[0]).setAttribute('aria-pressed', String(state[q[1]])); });
$('distSqueezed').setAttribute('aria-pressed', String(!state.trueDist)); $('distTrue').setAttribute('aria-pressed', String(state.trueDist));
$('sizeBig').setAttribute('aria-pressed', String(!state.trueSize)); $('sizeTrue').setAttribute('aria-pressed', String(state.trueSize));
setPaused(state.paused);
layoutView();
var startCfg = (function(){ var m = /^#s=([^&]+)/.exec(location.hash || ''); return m ? SYS.decodeCfg(m[1]) : null; })();
if (startCfg) generateSystem(startCfg); else showSolar();
started = true;
// Pasting a second share link into a tab that already has one open only changes the hash, so listen for that.
window.addEventListener('hashchange', function(){
  var m = /^#s=([^&]+)/.exec(location.hash || ''), c = m ? SYS.decodeCfg(m[1]) : null;
  if (!c || (sys.mode === 'custom' && SYS.encodeCfg(c) === SYS.encodeCfg(sys.cfg))) return;
  generateSystem(c);
});
window.addEventListener('resize', function(){ layoutView(); if (state.overview) camera3.targetDist = overviewDist(); });

// A small handle, mainly so the maths can be checked from the console and the tests.
window.solarify = {
  version: '0.7.0',
  positionsAU: function(when){
    var jd = typeof when === 'number' ? when : jdFromDate(new Date(when)), T = centuries(jd), out = {};
    PLANETS.forEach(function(b){
      var p = heliocentric(b.el, T, {}), r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
      out[b.id] = {x:p.x, y:p.y, z:p.z, r:r, lonDeg:((Math.atan2(p.y, p.x) / DEG) % 360 + 360) % 360};
    });
    return out;
  },
  moonElongationDeg: function(when){ var jd = typeof when === 'number' ? when : jdFromDate(new Date(when)); return moonElongation(jd) / DEG; },
  setDate: function(when){ state.jd = clamp(jdFromDate(new Date(when)), JD_MIN, JD_MAX); rebuildOrbits(); },
  setDay: function(d){ if (sys.mode === 'custom'){ state.jd = sys.epochJd + d; rebuildOrbits(); } },
  date: function(){ return dateFromJd(state.jd).toISOString(); },
  textureSizes: function(){ var r = {}; BODIES.forEach(function(b){ r[b.id] = b.texSize || 0; }); return r; },
  screenOf: function(id){ var b = byId[id]; return b && b.screen ? {x:b.screen.x, y:b.screen.y, behind:b.screen.behind, pxRadius:b.pxRadius} : null; },
  bodyScenePos: function(id){ var g = byId[id].group.position; return {x:g.x, y:g.y, z:g.z, r:Math.sqrt(g.x*g.x + g.y*g.y + g.z*g.z)}; },
  mode: function(){ return sys.mode; },
  system: function(){ return {mode:sys.mode, name:sys.name, trojanSwarms:TROJANS.length, unit:sys.unit, hz:sys.hz, frost:sys.frost, notes:sys.notes, counts:sys.counts || null, belts:(sys.belts || []).length, stars:sys.stars.length, regime:sys.binary ? sys.binary.regime : null, age:sys.ageGyr,
    bodies:BODIES.map(function(b){ return {id:b.id, name:b.name, kind:b.kind, parent:b.parent || null, home:!!b.home, key:b.key, aAU:b.aAU || null, ecc:b.ecc || 0, texSize:b.texSize || 0,
      radiusKm:b.radiusKm, sizeClass:b.sizeClass || null, ggClass:b.ggClass || null, worldType:b.worldType || null, diamMin:b.diamMin, diamMax:b.diamMax, diamT:b.diamT, diamSet:!!b.diamSet, trojans:!!b.trojans, typeSet:!!b.typeSet, typeAuto:b.typeAuto || null}; })}; },
  build: function(cfg){ return generateSystem(SYS.normalise(cfg)); },
  solar: function(){ return showSolar(); },
  openProject: openProject, maps: function(){ return Object.keys(userMaps[sys.mode]); }, hasMap: function(id){ return !!(byId[id] && byId[id].customTex); },
  state: state
};

requestAnimationFrame(frame);
})();
