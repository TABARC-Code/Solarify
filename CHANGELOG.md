# Changelog

Author: TABARC-Code. Earlier versions are in the git log; this file starts at 0.7.0.

## 0.7.0

It's late and I'm tired, so this is short.

### Added

- Travel panel. Pick a planet (or a moon, which travels as its planet) and another planet, and it gives the Hohmann transfer (both burns, total, time), light delay right now, and constant-thrust times at 1 g and 0.1 g. Works in our system and in built ones.
- Planet details: escape velocity, which gases a rocky world can hold on to, magnetic field, sky colour, Hill sphere and Roche limit.
- Trojan asteroids, drawn as two swarms 60 degrees either side of the planet. Jupiter has them in our system, because it does.

### Fixed

I went through the code looking for trouble and found four bugs worth fixing:

- A share link naming `constructor` (or `toString`, `__proto__`) as the star got past the checks and blanked the page, on every reload. Links like that are now refused.
- Size, diameter and type choices stuck to planet slots after the planets were reshuffled, so a rocky planet's diameter could land on a giant. Any change except the moon sliders now clears them, with a toast saying so.
- On phones the date readout floated mid-screen while the drawer was closed. It now sits just above the handle.
- Space on the drawer handle paused time instead of opening the drawer, and Enter did nothing. Both now open and close it.

While I was at it: choosing the size class the rules had already rolled now counts as a choice, and the light-time readout can no longer say "60 s".

### Checked and corrected from the studio workbook

The new workbook sheets had a few formula slips, fixed here rather than copied: the Hohmann travel time, the Hohmann delta-v (it gave the first burn only), and the Hill sphere (it mixed Earth and solar masses). `description.md` has the details.

Tests: 33 orbit checks and 80 builder checks.

### Since 0.7.0

- The browser checks are in the repository now, in `tests/browser/`, with a runner (`node tests/browser/run.js`) and a `package.json` that pulls in Playwright. They used to live on my machine only, which was no use to anyone else.
