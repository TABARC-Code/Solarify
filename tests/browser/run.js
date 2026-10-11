#!/usr/bin/env node
/* Runs the browser checks one after another. Author: TABARC-Code.
 *
 *   node tests/browser/run.js                 every check
 *   node tests/browser/run.js overrides       just the named ones (file names without .js)
 *
 * A check fails if it exits non-zero, never prints ALL PASSED, or the page threw an error.
 * Exits 1 if any check failed. They're slow (a minute or two each under software rendering),
 * so this prints each check's result as it finishes.
 */
'use strict';
var path = require('path'), spawnSync = require('child_process').spawnSync;

var ALL = ['basics', 'builder', 'builder-options', 'project-files', 'panels-clean', 'edge-cases', 'textures', 'overrides', 'details-travel', 'review-fixes'];
var pick = process.argv.slice(2), names = pick.length ? pick : ALL;
var unknown = names.filter(function(n){ return ALL.indexOf(n) < 0; });
if (unknown.length){ console.error('No such check: ' + unknown.join(', ') + '\nChecks: ' + ALL.join(', ')); process.exit(2); }

var failed = [];
names.forEach(function(n){
  var t0 = Date.now();
  var r = spawnSync(process.execPath, [path.join(__dirname, n + '.js')], {encoding: 'utf8', timeout: 600000});
  var out = (r.stdout || '') + (r.stderr || '');
  var bad = r.status !== 0 || !/ALL PASSED/.test(out) || /pageerror:/.test(out);
  var secs = ((Date.now() - t0) / 1000).toFixed(0);
  console.log((bad ? 'FAIL ' : 'ok   ') + n + '  (' + secs + ' s)');
  if (bad){
    failed.push(n);
    out.split('\n').filter(function(l){ return l && !/^PASS/.test(l); }).forEach(function(l){ console.log('       ' + l); });
  }
});
console.log(failed.length ? '\n' + failed.length + ' of ' + names.length + ' browser checks FAILED: ' + failed.join(', ') : '\nAll ' + names.length + ' browser checks passed.');
process.exit(failed.length ? 1 : 0);
