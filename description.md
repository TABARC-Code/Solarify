# Solarify: why it's built the way it is

This is the explanatory half. `README.md` tells you how to run it; this is for whoever changes it next, which is probably me in six months, annoyed.

## What it is for

Globify wraps your map on a globe. Solarify takes the same promise (a single file, no install, nothing uploaded, re-skin anything) and applies it to a whole solar system. That's the entire brief. It isn't a simulator, an ephemeris service, or a teaching product, and I've tried not to let it pretend to be any of them.

## Shape of the thing

One page, three sources stitched together by `build.py`:

- `src/template.html`: markup and CSS, no network references.
- `src/orbits.js`: the maths. No DOM, no Three.js. Works in a browser (`window.SolarifyOrbits`) and in Node (`require`), which is the only reason the tests can exist.
- `src/app.js`: scene, UI, input, textures.

The build inlines Three.js r128 (vendored from Globify, MIT) plus those two files into `index.html`. It's committed, deliberately, so a double-click works and Pages needs no pipeline. The cost is a ~650 KB diff whenever the sources change, and a stale-file risk that `build.py --check` exists to catch. There's no CI workflow in the repo. Pushing workflow files can be refused for lack of permission and I'd rather ship without than argue with a token.

Three.js is pinned at r128 because that's what Globify uses and what I've tested. Upgrading is possible, not free.

## The decisions that took actual thought

**Positions.** NASA JPL's approximate Keplerian elements, Table 1 (1800 to 2050). Cheap, closed form, and honestly sourced. The alternative was a full ephemeris, which would be more accurate and several hundred kilobytes heavier for no visible gain at this zoom. Earth is the Earth-Moon barycentre because the table says so. Pluto is left out because the table has no row for it and inventing one is exactly the kind of thing this project avoids.

**Precession is the trap.** The elements are measured against the J2000 equinox. Equinoxes and solstices are defined against the equinox of the date. By 2025 those differ by about 0.35 degrees, so if you test "Earth sits at 180 degrees at the March equinox" without correcting, you get a 0.35 degree "bug" that isn't one. I fell for it. The test file corrects with IAU 2006 precession, and the errors collapse to a few hundredths of a degree. The same file records my other mistake: I misdated a Jupiter opposition and spent a while blaming the maths.

**The Moon is theatre.** Mean synodic phase, circular orbit, 5.145 degree tilt, locked face. It looks right and phases correctly to within about half a day. Calling it an ephemeris would be false, so the code, the panel and the docs all say otherwise.

**Scale.** Honest scale is unusable: planets are specks, the Sun is a dot. So there are two switches. Distances: squeezed (8 times the square root of the AU) or true (20 scene units per AU). Sizes: enlarged (0.5 times (radius / 6378 km) to the power 0.4) or true. When a body is sub-pixel it gets a marker dot so you can still find it. The curve choices are taste; the points they're anchored to are not.

**Floating point.** At true scale, Neptune is 600 units out and the Moon is a hair from Earth. Rather than move the camera, the `universe` group is shifted by minus the focus each frame, so whatever you're looking at sits at the origin and precision holds. A logarithmic depth buffer handles the near and far planes. `setViewOffset` centres the focus in the part of the screen the panel isn't covering, including the bottom sheet on phones.

**Textures.** There are none shipped. Surfaces are generated from seamless 3D noise, painted in time-sliced jobs so the page never freezes: 512 pixels for everything first, 1024 for the body you select, and a queue that lets a clicked planet jump ahead. This came from measuring a first version that stalled for nearly 800 ms. User maps replace the generated texture per body and are downscaled if they exceed the GPU limit.

**Labels and picking.** DOM labels, placed greedily by priority with overlap removal and edge flipping; picking is in screen space, so it works the same at any scale. Behind-camera tests use view-space depth, because with a log depth buffer the NDC value lies to you.

## What's verified and what isn't

- The orbit maths: 28 checks in `tests/orbits.test.js`, passing at last run. I also broke the Kepler solver on purpose to confirm the tests fail when they should.
- The interface: exercised by hand and with Playwright scripts against headless Chromium on software GL (37 functional checks, edge cases, texture timing, a phone-sized viewport, and the no-WebGL fallback). Those scripts are not in the repo. So that's evidence I looked, not a suite you can run.
- Performance: my JavaScript costs roughly 0.2 ms a frame. The much larger frame time in the sandbox was software rendering and didn't change with window size. I have not profiled on real GPU hardware or on a phone.

## Real versus staged, in code terms

Real: positions (`ELEMENTS`, JPL values verbatim), the NASA fact-sheet numbers in the body table, derived distance and light time.
Staged: Moon position, spin phase, axis directions other than Earth's, enlarged scales, generated surfaces. Each is a choice for legibility, and each is labelled where a user could mistake it for data.

## Limitations worth stating

- Accuracy degrades outside 1800 to 2050; dates are clamped to 1000 to 3000 and a note appears.
- No Pluto, no dwarf planets, no asteroids, no other moons. Adding Pluto needs an orbit source, not a code change.
- Phones work, but I only tested the layout, not the thermals of a three-year-old handset spinning eight procedural spheres.
- Reduced-motion users get a paused start. That's intentional.

## Where it could go

None of this is promised. Candidates: more moons (Galilean first), Pluto from a proper source, a shareable view link, and browser tests committed to the repo. The tests one is the one I'd actually do.

## Provenance

Orbital elements: NASA JPL, ssd.jpl.nasa.gov/planets/approx_pos.html. Physical data: NASA Planetary Fact Sheet. Precession: IAU 2006. New moon epoch and synodic month: Meeus. Three.js: MIT, the three.js authors.
