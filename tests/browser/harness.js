/* Shared set-up for the browser checks. Author: TABARC-Code.
 *
 * Each check file asks for { chromium, BASE, TMP } and gets:
 *   chromium  Playwright's Chromium, launched with SOLARIFY_CHROME as the executable if you set it
 *             (handy where Playwright's own download doesn't match), otherwise Playwright's own.
 *   BASE      the address index.html is served from. If SOLARIFY_URL is set it is used as is;
 *             otherwise a tiny static server for the repository starts on a spare local port.
 *   TMP       a fresh temporary folder for downloads, project files and screenshots.
 *
 * Needs Playwright (npm install). Nothing here touches the network beyond localhost.
 */
'use strict';
var path = require('path'), fs = require('fs'), os = require('os'), http = require('http');

var pw;
try { pw = require('playwright'); }
catch (e) { console.error('Playwright is not installed. Run: npm install'); process.exit(2); }

var ROOT = path.resolve(__dirname, '..', '..');
var TYPES = {'.html':'text/html; charset=utf-8', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.css':'text/css'};

var BASE = process.env.SOLARIFY_URL;
if (!BASE){
  // A port picked from the process id, so two checks running side by side don't collide.
  var port = 20000 + (process.pid % 20000);
  var server = http.createServer(function(req, res){
    var p = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
    var file = path.resolve(ROOT, '.' + (p === '/' ? '/index.html' : p));
    if (file.indexOf(ROOT) !== 0 || !fs.existsSync(file) || !fs.statSync(file).isFile()){ res.writeHead(404); res.end(); return; }
    res.writeHead(200, {'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream'});
    fs.createReadStream(file).pipe(res);
  });
  server.listen(port, '127.0.0.1');
  server.unref();     // don't keep the process alive once the check is done
  BASE = 'http://127.0.0.1:' + port;
}

var TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'solarify-'));

var chromium = {
  launch: function(opts){
    opts = Object.assign({}, opts);
    if (process.env.SOLARIFY_CHROME) opts.executablePath = process.env.SOLARIFY_CHROME;
    else delete opts.executablePath;
    return pw.chromium.launch(opts);
  }
};

module.exports = {chromium: chromium, BASE: BASE, TMP: TMP};
