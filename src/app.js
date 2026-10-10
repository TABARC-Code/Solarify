/* Solarify. Author: TABARC-Code. MIT licence.
 *
 * Where the numbers come from:
 *   - Sizes, spin, tilt and orbit periods: NASA Planetary Fact Sheet
 *     (nssdc.gsfc.nasa.gov/planetary/factsheet).
 *   - Planet positions: the Keplerian elements and algorithm NASA JPL publishes
 *     in "Keplerian Elements for Approximate Positions of the Major Planets"
 *     (ssd.jpl.nasa.gov/planets/approx_pos.html), Table 1, valid 1800 to 2050.
 *   - The Moon is NOT an ephemeris. Its phase uses the mean synodic month and its
 *     orbit is a circle. See README for what is real and what is staged.
 */
(function(){
'use strict';

var THREE = window.THREE, O = window.SolarifyOrbits;
var TAU = Math.PI * 2, DEG = Math.PI / 180;
var AU_KM = 149597870.7, C_KMS = 299792.458;
var SCENE_AU_TRUE = 20;               // scene units per AU when distances are true
var SQUEEZE_K = 8;                    // squeezed distance = 8 * sqrt(AU)
var JD_MIN = 2086307.5, JD_MAX = 2816787.5;   // years 1000 to 3000

function $(id){ return document.getElementById(id); }
function clamp(v, a, b){ return v < a ? a : (v > b ? b : v); }
function mix(a, b, t){ return a + (b - a) * t; }
function smooth(a, b, x){ var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
function fmtNum(n, digits){ return n.toLocaleString('en-GB', {maximumFractionDigits: digits == null ? 0 : digits}); }

/* ------------------------------------------------------------------
   1. Data
   The orbit elements themselves live in orbits.js (JPL Table 1). 'earth' there is the
   Earth-Moon barycentre, as JPL tabulates it; the real Earth is under 5,000 km from it,
   far below a pixel here.
------------------------------------------------------------------ */
var BODIES = [
  {id:'sun', name:'Sun', kind:'Star', radiusKm:695700, diameter:'1,391,400 km', rotH:609.12,
   rotNote:'at 16° latitude', obliq:7.25, color:0xffb040, key:null},
  {id:'mercury', name:'Mercury', kind:'Planet, rocky', radiusKm:2439.5, rotH:1407.6, obliq:0.034,
   periodDays:88.0, incl:7.0, ecc:0.206, color:0x9a8f84, key:'1'},
  {id:'venus', name:'Venus', kind:'Planet, rocky', radiusKm:6052, rotH:5832.5, retro:true, obliq:177.4,
   periodDays:224.7, incl:3.4, ecc:0.007, color:0xe0c690, key:'2'},
  {id:'earth', name:'Earth', kind:'Planet, rocky', radiusKm:6378, rotH:23.9, obliq:23.4,
   periodDays:365.2, incl:0.0, ecc:0.017, color:0x3a74b8, key:'3'},
  {id:'mars', name:'Mars', kind:'Planet, rocky', radiusKm:3396, rotH:24.6, obliq:25.2,
   periodDays:687.0, incl:1.8, ecc:0.094, color:0xb4623a, key:'4'},
  {id:'jupiter', name:'Jupiter', kind:'Planet, gas giant', radiusKm:71492, rotH:9.9, obliq:3.1,
   periodDays:4331, incl:1.3, ecc:0.049, color:0xc8a07a, key:'5'},
  {id:'saturn', name:'Saturn', kind:'Planet, gas giant', radiusKm:60268, rotH:10.7, obliq:26.7,
   periodDays:10747, incl:2.5, ecc:0.052, color:0xd8c08a, key:'6', rings:true},
  {id:'uranus', name:'Uranus', kind:'Planet, ice giant', radiusKm:25559, rotH:17.2, retro:true, obliq:97.8,
   periodDays:30589, incl:0.8, ecc:0.047, color:0x98d6e0, key:'7'},
  {id:'neptune', name:'Neptune', kind:'Planet, ice giant', radiusKm:24764, rotH:16.1, obliq:28.3,
   periodDays:59800, incl:1.8, ecc:0.010, color:0x3a5fd0, key:'8'},
  {id:'moon', name:'Moon', kind:'Moon of Earth', radiusKm:1737.5, rotH:655.7, lockNote:'locked to Earth',
   obliq:6.7, periodDays:27.3, incl:5.1, ecc:0.055, color:0xaaaaaa, key:'9', distNote:'about 384,000 km from Earth'}
];
var byId = {};
BODIES.forEach(function(b){ byId[b.id] = b; });
BODIES.forEach(function(b){ if (O.ELEMENTS[b.id]) b.el = O.ELEMENTS[b.id]; });
var PLANETS = BODIES.filter(function(b){ return b.el; });

var SPEEDS = [
  {days:1 / 86400, label:'Real time'},
  {days:1 / 24,    label:'1 hour per second'},
  {days:1,         label:'1 day per second'},
  {days:10,        label:'10 days per second'},
  {days:30.4375,   label:'1 month per second'},
  {days:91.3125,   label:'3 months per second'},
  {days:365.25,    label:'1 year per second'}
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
  trueDist: false, trueSize: false, orbits: true, labels: true, stars: true,
  focus: 'sun', overview: true
};
(function loadView(){
  try{
    var v = JSON.parse(localStorage.getItem('solarify.view') || '{}');
    ['trueDist','trueSize','orbits','labels','stars'].forEach(function(k){ if (typeof v[k] === 'boolean') state[k] = v[k]; });
    if (typeof v.speedIdx === 'number' && v.speedIdx >= 0 && v.speedIdx < SPEEDS.length) state.speedIdx = Math.round(v.speedIdx);
  }catch(e){}
})();
function saveView(){
  try{
    localStorage.setItem('solarify.view', JSON.stringify({trueDist:state.trueDist, trueSize:state.trueSize,
      orbits:state.orbits, labels:state.labels, stars:state.stars, speedIdx:state.speedIdx}));
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

var sunLight = new THREE.PointLight(0xfff2dc, 2.2, 0);
universe.add(sunLight);
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

/* ------------------------------------------------------------------
   6. Bodies, orbit lines, labels
------------------------------------------------------------------ */
var dotTex = dotTexture(), glowTex = glowTexture('rgba(255,236,190,1)', 'rgba(255,170,60,0.55)');
var labelsEl = $('labels');
var tmpV = new THREE.Vector3(), tmpEcl = {x:0, y:0, z:0};

BODIES.forEach(function(b){
  b.group = new THREE.Group();
  b.tilt = new THREE.Group();
  b.tilt.rotation.x = -(b.id === 'moon' ? 0 : b.obliq) * DEG;      // pole leans toward ecliptic longitude 90 degrees
  b.group.add(b.tilt);
  var geo = new THREE.SphereGeometry(1, 64, 48);
  b.material = b.id === 'sun'
    ? new THREE.MeshBasicMaterial({color:b.color})
    : new THREE.MeshStandardMaterial({color:b.color, roughness:0.95, metalness:0});
  b.mesh = new THREE.Mesh(geo, b.material);
  b.tilt.add(b.mesh);
  b.spin = Math.random() * TAU;
  b.customTex = null; b.builtTex = null; b.builtImage = null;

  b.marker = new THREE.Sprite(new THREE.SpriteMaterial({map:dotTex, color:b.id === 'sun' ? 0xffd080 : b.color, sizeAttenuation:false, depthTest:false, transparent:true}));
  b.marker.scale.setScalar(0.011); b.marker.renderOrder = 5; b.marker.visible = false;
  b.group.add(b.marker);

  if (b.id === 'sun'){
    b.glow = new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex, blending:THREE.AdditiveBlending, depthWrite:false, transparent:true}));
    b.group.add(b.glow);
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
  universe.add(b.group);

  b.label = document.createElement('button');
  b.label.className = 'label'; b.label.textContent = b.name; b.label.tabIndex = -1;
  b.label.setAttribute('aria-hidden', 'true');
  b.label.addEventListener('click', function(){ focusOn(b.id); });
  labelsEl.appendChild(b.label);

  if (b.el){
    b.orbitLine = new THREE.LineLoop(new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({color:0x7fa8c8, transparent:true, opacity:0.42, depthWrite:false}));
    b.orbitLine.frustumCulled = false;
    universe.add(b.orbitLine);
    b.orbitBuiltT = 1e9;
  }
});
var moonOrbitLine = (function(){
  var pts = new Float32Array(121 * 3), v = {x:0, y:0, z:0};
  for (var i = 0; i <= 120; i++){
    moonDirEcl(i / 120 * TAU, v);
    pts[i*3] = v.x; pts[i*3+1] = v.z; pts[i*3+2] = -v.y;
  }
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pts, 3));
  var l = new THREE.Line(g, new THREE.LineBasicMaterial({color:0x9aa0aa, transparent:true, opacity:0.5, depthWrite:false}));
  l.frustumCulled = false; universe.add(l); return l;
})();

/* Texture queue. Every body gets a small 512 px texture quickly (enough for the overview,
   where planets are a few dozen pixels wide). The sharp 1024 px version is only made for a
   body you actually select, and it jumps the queue. Painting is sliced across frames. */
var texQueue = ['earth', 'sun', 'jupiter', 'saturn', 'mars', 'moon', 'venus', 'mercury', 'uranus', 'neptune']
  .map(function(id){ return {id:id, size:512}; });
var GEN_IDS = {sun:GEN.sun, earth:GEN.earth, mars:GEN.mars, venus:GEN.venus, jupiter:GEN.jupiter, saturn:GEN.saturn,
               uranus:GEN.uranus, neptune:GEN.neptune, mercury:GEN.mercury, moon:GEN.moon};
var texJob = null, texJobItem = null;
function pumpTextures(){
  if (!texJob){
    var it = texQueue.shift(); if (!it) return;
    texJobItem = it; texJob = GEN_IDS[it.id](it.size, it.size / 2);
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
  var li = -1; texQueue.forEach(function(it, i){ if (it.id === id && it.size < 1024) li = i; });
  if (li >= 0) items.push(texQueue.splice(li, 1)[0]);                 // its small one first
  var wantsSharp = close && (b.texSize || 0) < 1024 && !texQueue.some(function(it){ return it.id === id && it.size >= 1024; })
                   && !(texJobItem && texJobItem.id === id && texJobItem.size >= 1024);
  if (wantsSharp) items.push({id:id, size:1024});
  Array.prototype.unshift.apply(texQueue, items);
}

/* ------------------------------------------------------------------
   7. Scale: where bodies are drawn, and how big
------------------------------------------------------------------ */
function viewPos(p, out){
  var r = Math.sqrt(p.x * p.x + p.y * p.y + p.z * p.z);
  var s = state.trueDist ? SCENE_AU_TRUE : (r > 0 ? SQUEEZE_K * Math.sqrt(r) / r : 0);
  return out.set(p.x * s, p.z * s, -p.y * s);          // ecliptic z is up; three's y is up
}
function bodyRadius(b){
  if (state.trueSize) return b.radiusKm / AU_KM * SCENE_AU_TRUE;
  return 0.5 * Math.pow(b.radiusKm / 6378, 0.4);
}
function moonDistScene(){ return state.trueSize ? 384400 / AU_KM * SCENE_AU_TRUE : 1.7; }
function overviewRadius(){
  var n = byId.neptune, a = n.el.a[0] * (1 + n.el.e[0]);
  return state.trueDist ? SCENE_AU_TRUE * a : SQUEEZE_K * Math.sqrt(a);
}

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
  if (b.id === 'sun') return R * 4;
  if (b.id === 'earth' && !state.trueSize) return Math.max(R * 4, moonDistScene() * 2.5);
  if (b.id === 'moon') return R * 5;
  return R * 4;
}
function limitDist(d){
  var b = byId[state.focus];
  return clamp(d, bodyRadius(b) * 1.25, overviewDist() * 1.7);
}

/* ------------------------------------------------------------------
   8. Per-frame update
------------------------------------------------------------------ */
var plan = {};     // heliocentric positions (AU, ecliptic) this frame
function updateBodies(dt){
  var T = centuries(state.jd);
  PLANETS.forEach(function(b){ plan[b.id] = heliocentric(b.el, T, plan[b.id] || {x:0, y:0, z:0}); });
  plan.sun = {x:0, y:0, z:0};

  BODIES.forEach(function(b){
    var R = bodyRadius(b); b.R = R;
    b.mesh.scale.setScalar(R);
    if (b.ringMesh) b.ringMesh.scale.setScalar(R);
    if (b.id === 'sun') b.group.position.set(0, 0, 0);
    else if (b.el) viewPos(plan[b.id], b.group.position);
  });
  // The Moon: mean phase, circular orbit. Not an ephemeris.
  var e = plan.earth, earthG = byId.earth.group, moon = byId.moon;
  var lamSun = Math.atan2(-e.y, -e.x), lamMoon = lamSun + moonElongation(state.jd);
  moonDirEcl(lamMoon, tmpEcl);
  var md = moonDistScene();
  moon.group.position.set(earthG.position.x + tmpEcl.x * md, earthG.position.y + tmpEcl.z * md, earthG.position.z - tmpEcl.y * md);
  moonOrbitLine.position.copy(earthG.position);
  moonOrbitLine.scale.setScalar(md);
  // tidal lock: the map centre faces the Earth
  var dx = earthG.position.x - moon.group.position.x, dz = earthG.position.z - moon.group.position.z;
  moon.mesh.rotation.y = Math.atan2(-dz, dx);

  // spin, capped so planets don't strobe at high speed
  var daysPerSec = state.paused ? 0 : SPEEDS[state.speedIdx].days;
  BODIES.forEach(function(b){
    if (b.id === 'moon' || !b.rotH) return;
    var cyc = daysPerSec * 24 / b.rotH;
    b.spin += state.dir * Math.min(cyc, 0.35) * TAU * dt;
    b.mesh.rotation.y = b.spin;
  });
  // orbit lines: rebuild when the date has moved on enough or the scale changed
  if (state.orbits){
    PLANETS.forEach(function(b){ if (Math.abs(T - b.orbitBuiltT) > 0.05) buildOrbit(b, T); });
  }
  byId.sun.glow.scale.setScalar(Math.max(byId.sun.R * 5.5, 0));
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

function updateCamera(dt){
  var b = byId[state.focus];
  var target = b.group.position;
  focusOffset.multiplyScalar(Math.exp(-dt * 4));
  focusView.copy(target).add(focusOffset);
  universe.position.copy(focusView).negate();

  camera3.targetDist = limitDist(camera3.targetDist);
  camera3.dist += (camera3.targetDist - camera3.dist) * (1 - Math.exp(-dt * 7));
  camera3.dist = Math.max(camera3.dist, bodyRadius(b) * 1.2);
  var cp = Math.cos(camera3.phi);
  camera.position.set(camera3.dist * cp * Math.sin(camera3.theta), camera3.dist * Math.sin(camera3.phi), camera3.dist * cp * Math.cos(camera3.theta));
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
}

var sizeW = 0, sizeH = 0, started = false;
function layoutView(){
  var W = stage.clientWidth || 1, H = stage.clientHeight || 1;
  var panel = $('panel'), r = panel.getBoundingClientRect(), shiftX = 0, shiftY = 0, vw = W, vh = H;
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
var scrA = {x:0, y:0, behind:false}, scrB = {x:0, y:0, behind:false}, wp = new THREE.Vector3();
var LABEL_PRIORITY = ['sun', 'jupiter', 'saturn', 'earth', 'mars', 'venus', 'mercury', 'uranus', 'neptune', 'moon'];
function updateLabels(){
  var tanHalf = Math.tan(camera.fov * DEG / 2), H = stage.clientHeight;
  camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
  BODIES.forEach(function(b){
    wp.copy(b.group.position).add(universe.position);
    projectToScreen(wp, scrA);
    b.screen = {x:scrA.x, y:scrA.y, behind:scrA.behind};
    var dist = wp.distanceTo(camera.position);
    b.pxRadius = b.R / (dist * tanHalf) * (H / 2);
    b.marker.visible = b.id !== 'sun' && b.pxRadius < 2.5;
    b.labelShow = state.labels && !scrA.behind && scrA.x > -20 && scrA.x < visible.w && scrA.y > -20 && scrA.y < visible.h + 20;
    if (b.id === 'moon' && b.labelShow){
      wp.copy(byId.earth.group.position).add(universe.position); projectToScreen(wp, scrB);
      if (Math.hypot(scrB.x - scrA.x, scrB.y - scrA.y) < 26) b.labelShow = false;
    }
  });
  // Place labels in priority order (the selected body first) and drop any that would
  // sit on top of one already placed, so the crowd near the Sun stays readable.
  var order = [state.focus].concat(LABEL_PRIORITY.filter(function(id){ return id !== state.focus; })), placed = [];
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
  // the Sun keeps a glow even when true size makes it a speck
  var sun = byId.sun, sunDist = wp.copy(sun.group.position).add(universe.position).distanceTo(camera.position);
  sun.glow.scale.setScalar(Math.max(sun.R * 5.5, sunDist * 0.045));
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
  // make sure group positions are current, then slide from the old focus point
  focusOffset.copy(oldFocus).sub(b.group.position);
  camera3.targetDist = opts.overview ? overviewDist() : defaultDist(b);
  if (opts.overview) camera3.phi = 0.5;
  document.querySelectorAll('#bodyList .btn').forEach(function(btn){ btn.setAttribute('aria-pressed', String(btn.dataset.id === id)); });
  $('overview').setAttribute('aria-pressed', String(!!opts.overview));
  showSelected(b);
}
function applyScaleChange(){
  focusOffset.set(0, 0, 0);
  updateBodies(0);
  rebuildOrbits();
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
  $('scaleHint').textContent = t.join(' ');
}

/* ------------------------------------------------------------------
   10. Selected-body panel
------------------------------------------------------------------ */
function fmtHours(h){ return h < 48 ? fmtNum(h, 1) + ' hours' : fmtNum(h / 24, 1) + ' days'; }
function fmtPeriod(d){ return d < 1000 ? fmtNum(d, 1) + ' days' : fmtNum(d / 365.25, 1) + ' years'; }
function fmtLight(sec){
  if (sec < 90) return fmtNum(sec, 0) + ' seconds';
  if (sec < 5400) return Math.floor(sec / 60) + ' min ' + Math.round(sec % 60) + ' s';
  return Math.floor(sec / 3600) + ' h ' + Math.round((sec % 3600) / 60) + ' min';
}
var liveEls = {};
function showSelected(b){
  $('selName').textContent = b.name; $('selKind').textContent = b.kind;
  var dl = $('facts'); dl.textContent = ''; liveEls = {};
  function add(k, v, live){
    var dt = document.createElement('dt'), dd = document.createElement('dd');
    dt.textContent = k; dd.textContent = v; if (live){ dd.className = 'live'; liveEls[live] = dd; }
    dl.appendChild(dt); dl.appendChild(dd);
  }
  add('Diameter', b.diameter || fmtNum(b.radiusKm * 2) + ' km');
  var rot = fmtHours(b.rotH) + (b.retro ? ', backwards' : '') + (b.rotNote ? ' (' + b.rotNote + ')' : '') + (b.lockNote ? ', ' + b.lockNote : '');
  add('Spin (one turn)', rot);
  add('Axial tilt', fmtNum(b.obliq, 2) + '°');
  if (b.periodDays) add(b.id === 'moon' ? 'Orbits Earth in' : 'Year', fmtPeriod(b.periodDays));
  if (b.incl != null) add('Orbit tilt', fmtNum(b.incl, 1) + '°');
  if (b.ecc != null) add('Orbit stretch', fmtNum(b.ecc, 3));
  if (b.id === 'moon') add('Distance from Earth', 'about 384,000 km');
  else if (b.id !== 'sun'){ add('Distance from Sun now', '', 'dist'); add('Sunlight takes', '', 'light'); }
  if (b.id === 'moon') add('Phase now', '', 'phase');
  var has = !!b.customTex;
  $('mapReset').disabled = !has;
  $('mapBtn').textContent = 'Use my own map…';
  updateLive();
}
function updateLive(){
  var b = byId[state.focus];
  var r = b.id === 'moon' ? plan.earth : plan[b.id];
  if (r && liveEls.dist){
    var au = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z), km = au * AU_KM;
    liveEls.dist.textContent = fmtNum(au, 3) + ' AU (' + fmtNum(km / 1e6, 1) + ' million km)';
    liveEls.light.textContent = fmtLight(km / C_KMS);
  }
  if (liveEls.phase){
    var f = moonElongation(state.jd) / TAU, illum = (1 - Math.cos(f * TAU)) / 2;
    var name = f < 0.03 || f > 0.97 ? 'New' : f < 0.22 ? 'Waxing crescent' : f < 0.28 ? 'First quarter' : f < 0.47 ? 'Waxing gibbous'
             : f < 0.53 ? 'Full' : f < 0.72 ? 'Waning gibbous' : f < 0.78 ? 'Last quarter' : 'Waning crescent';
    liveEls.phase.textContent = name + ', ' + Math.round(illum * 100) + '% lit (mean)';
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

function pickAt(cx, cy){
  var rect = canvas.getBoundingClientRect(), x = cx - rect.left, y = cy - rect.top, best = null, bestScore = 1e9;
  BODIES.forEach(function(b){
    if (!b.screen || b.screen.behind) return;
    var d = Math.hypot(b.screen.x - x, b.screen.y - y), reach = Math.max(b.pxRadius, 16);
    if (d <= reach){
      var score = d / reach;
      if (score < bestScore){ bestScore = score; best = b; }
    }
  });
  if (best) focusOn(best.id);
  return best;
}

function setSpeed(i){
  state.speedIdx = clamp(i, 0, SPEEDS.length - 1);
  $('speed').value = state.speedIdx;
  $('speedLabel').textContent = SPEEDS[state.speedIdx].label;
  saveView();
}
function setPaused(p){
  state.paused = p;
  var btn = $('playPause'); btn.textContent = p ? 'Play' : 'Pause'; btn.setAttribute('aria-pressed', String(p));
}
function setDir(d){
  state.dir = d; var btn = $('reverse'); btn.setAttribute('aria-pressed', String(d < 0));
}
function goToday(){ state.jd = jdFromDate(new Date()); rebuildOrbits(); toast('Back to today.'); }
function setToggle(id, key, on, apply){
  state[key] = on; $(id).setAttribute('aria-pressed', String(on)); if (apply) apply(); saveView();
}
function applyVisibility(){
  PLANETS.forEach(function(b){ b.orbitLine.visible = state.orbits; });
  moonOrbitLine.visible = state.orbits;
  labelsEl.style.display = state.labels ? '' : 'none';
  stars.visible = state.stars;
}

$('playPause').addEventListener('click', function(){ setPaused(!state.paused); });
$('reverse').addEventListener('click', function(){ setDir(-state.dir); });
$('speed').addEventListener('input', function(){ setSpeed(+this.value); });
$('today').addEventListener('click', goToday);
$('overview').addEventListener('click', function(){ focusOn('sun', {overview:true}); });
$('tOrbits').addEventListener('click', function(){ setToggle('tOrbits', 'orbits', !state.orbits, applyVisibility); });
$('tLabels').addEventListener('click', function(){ setToggle('tLabels', 'labels', !state.labels, applyVisibility); });
$('tStars').addEventListener('click', function(){ setToggle('tStars', 'stars', !state.stars, applyVisibility); });
function setScaleMode(key, on, ids){
  if (state[key] === on) return;
  state[key] = on; $(ids[0]).setAttribute('aria-pressed', String(!on)); $(ids[1]).setAttribute('aria-pressed', String(on));
  applyScaleChange(); saveView();
}
$('distSqueezed').addEventListener('click', function(){ setScaleMode('trueDist', false, ['distSqueezed', 'distTrue']); });
$('distTrue').addEventListener('click', function(){ setScaleMode('trueDist', true, ['distSqueezed', 'distTrue']); });
$('sizeBig').addEventListener('click', function(){ setScaleMode('trueSize', false, ['sizeBig', 'sizeTrue']); });
$('sizeTrue').addEventListener('click', function(){ setScaleMode('trueSize', true, ['sizeBig', 'sizeTrue']); });

// bodies list
BODIES.forEach(function(b){
  var btn = document.createElement('button');
  btn.className = 'btn'; btn.dataset.id = b.id; btn.textContent = b.name; btn.setAttribute('aria-pressed', 'false');
  btn.addEventListener('click', function(){ focusOn(b.id); });
  $('bodyList').appendChild(btn);
});

/* Panel as a bottom sheet on phones */
$('handle').addEventListener('click', function(){
  var open = !$('panel').classList.contains('open');
  $('panel').classList.toggle('open', open);
  this.setAttribute('aria-expanded', String(open));
  this.lastElementChild.textContent = open ? '−' : '+';
});

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
function applyMap(b, img, name){
  var src = img, maxT = renderer.capabilities.maxTextureSize || 4096, w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
  if (w > maxT || h > maxT){
    var k = Math.min(maxT / w, maxT / h), c = document.createElement('canvas');
    c.width = Math.floor(w * k); c.height = Math.floor(h * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); src = c;
  }
  var tex = new THREE.Texture(src);
  tex.encoding = THREE.sRGBEncoding; tex.anisotropy = maxAniso; tex.needsUpdate = true;
  if (b.customTex) b.customTex.dispose();
  b.customTex = tex; b.material.map = tex; b.material.color.set(0xffffff); b.material.needsUpdate = true;
  var ratio = w / h, msg = b.name + ' now wears ' + name + '. It stays in this tab; nothing is uploaded.';
  if (Math.abs(ratio - 2) > 0.1) msg += ' That image is ' + fmtNum(ratio, 2) + ':1, not 2:1, so it will look stretched.';
  $('mapMsg').textContent = msg;
  if (state.focus === b.id) $('mapReset').disabled = false;
  toast(b.name + ' has your map.');
}
function resetMap(b){
  if (!b.customTex) return;
  b.customTex.dispose(); b.customTex = null;
  if (b.builtTex){ b.material.map = b.builtTex; b.material.color.set(0xffffff); }
  else { b.material.map = null; b.material.color.set(b.color); }
  b.material.needsUpdate = true;
  $('mapMsg').textContent = b.name + ' is back to its built-in look.';
  if (state.focus === b.id) $('mapReset').disabled = true;
}
function loadMapFile(f){
  if (!f) return;
  var isImg = (f.type && f.type.indexOf('image/') === 0) || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(f.name || '');
  if (!isImg){ $('mapMsg').textContent = f.name + ' does not look like an image. Try a PNG or JPG.'; toast('That is not an image.'); return; }
  var b = byId[state.focus], url = URL.createObjectURL(f), img = new Image();
  img.onload = function(){ URL.revokeObjectURL(url); applyMap(b, img, f.name); };
  img.onerror = function(){ URL.revokeObjectURL(url); $('mapMsg').textContent = 'Could not read ' + f.name + '. Try a PNG or JPG.'; };
  img.src = url;
}
$('mapBtn').addEventListener('click', function(){ $('mapFile').click(); });
$('mapFile').addEventListener('change', function(){ var f = this.files[0]; this.value = ''; loadMapFile(f); });
$('mapReset').addEventListener('click', function(){ resetMap(byId[state.focus]); });
['dragenter', 'dragover'].forEach(function(t){ window.addEventListener(t, function(e){ e.preventDefault(); }); });
window.addEventListener('drop', function(e){ e.preventDefault(); if (e.dataTransfer && e.dataTransfer.files.length) loadMapFile(e.dataTransfer.files[0]); });

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
    a.href = url; a.download = 'solarify-' + state.focus + '-' + dateFromJd(state.jd).toISOString().slice(0, 10) + '.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    toast('Saved ' + a.download);
  }, 'image/png');
});

/* ------------------------------------------------------------------
   14. Frame loop
------------------------------------------------------------------ */
var last = performance.now(), liveClock = 0, lastDateText = '';
function frame(now){
  var dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!state.paused){
    state.jd = clamp(state.jd + state.dir * SPEEDS[state.speedIdx].days * dt, JD_MIN, JD_MAX);
  }
  layoutView();
  updateBodies(dt);
  updateCamera(dt);
  updateLabels();
  var ds = dateFromJd(state.jd).toISOString(), txt = ds.slice(0, 10) + ' ' + ds.slice(11, 16) + ' UTC';
  if (txt !== lastDateText){
    $('dateText').textContent = txt; lastDateText = txt;
    $('rangeNote').hidden = state.jd >= 2378496.5 && state.jd <= 2469807.5;   // 1800 to 2050
  }
  liveClock += dt; if (liveClock > 0.25){ liveClock = 0; updateLive(); }
  if (texJob || texQueue.length) pumpTextures();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------
   15. Start
------------------------------------------------------------------ */
setSpeed(state.speedIdx);
setPaused(state.paused);
['tOrbits:orbits', 'tLabels:labels', 'tStars:stars'].forEach(function(p){ var q = p.split(':'); $(q[0]).setAttribute('aria-pressed', String(state[q[1]])); });
$('distSqueezed').setAttribute('aria-pressed', String(!state.trueDist)); $('distTrue').setAttribute('aria-pressed', String(state.trueDist));
$('sizeBig').setAttribute('aria-pressed', String(!state.trueSize)); $('sizeTrue').setAttribute('aria-pressed', String(state.trueSize));
updateScaleHint();
layoutView();
updateBodies(0);
BODIES.forEach(function(b){ b.group.updateMatrixWorld(true); });
focusOn('sun', {overview:true});
camera3.dist = camera3.targetDist;
started = true;
applyVisibility();
window.addEventListener('resize', function(){ layoutView(); if (state.overview) camera3.targetDist = overviewDist(); });

// A small read-only handle, mainly so the maths can be checked from the console.
window.solarify = {
  version: '0.1.0',
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
  date: function(){ return dateFromJd(state.jd).toISOString(); },
  textureSizes: function(){ var r = {}; BODIES.forEach(function(b){ r[b.id] = b.texSize || 0; }); return r; },
  screenOf: function(id){ var b = byId[id]; return b && b.screen ? {x:b.screen.x, y:b.screen.y, behind:b.screen.behind, pxRadius:b.pxRadius} : null; },
  bodyScenePos: function(id){ var g = byId[id].group.position; return {x:g.x, y:g.y, z:g.z, r:Math.sqrt(g.x*g.x + g.y*g.y + g.z*g.z)}; },
  state: state
};

requestAnimationFrame(frame);
})();
