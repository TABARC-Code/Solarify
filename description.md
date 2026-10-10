# Solarify: why it's built the way it is

This is the explanatory half. `README.md` tells you how to run it; this is for whoever changes it next, which is probably me in six months, annoyed.

## What it is for

Globify wraps your map on a globe. Solarify takes the same promise (a single file, no install, nothing uploaded, re-skin anything) and applies it to a whole solar system. Then it goes one step further: you can build a system that doesn't exist, choose what's in it, and still put your own image on any sphere you like.

It isn't a simulator, an ephemeris service, or a teaching product, and I've tried not to let it pretend to be any of them. The builder in particular is a toy with real numbers and a set of tabletop-style rules of thumb underneath. It is not a model of how planetary systems form, and nothing it shows is a claim about a real star.

## Simple on top, deep underneath

The brief for the interface was: simple in use, a little hidden depth, and images as easy as they are in Globify. That settled most of the layout.

What you see first is a star, three sliders (rocky planets, giants, moons), a home-world choice and a Roll button. Every control rebuilds the system the moment you let go, because a Generate button is a thing a person has to find, press, and wonder about. Everything else lives behind a folded "More options": star mass, system age, moons per giant, asteroid belts, giant layout, companion star, seed, share link. The giant-moons slider follows the simple one until you touch it, so the defaults are sensible and the control is still there. A star chosen "by mass" opens the extra options for you, because otherwise its slider would be invisible.

The same thinking runs through the panel. A built planet shows a dozen rows, but they are rows in a list you only read if you click the planet. Nothing in the first screen needs explaining.

For images, the rule was that dropping one should do what you meant. So it goes on the body under the pointer, with a small label naming which body that is as you drag. If you drop it in empty space it goes on the selected body. If you drop several they dress several bodies in order. Time pauses while you are dragging, because I found out the hard way that you can't aim at a planet that goes round in a second. And the images stay put: rolling a new system keeps them on the same planet slots, because throwing away someone's afternoon of dressing planets to give them a different seed is a poor trade.

## Shape of the thing

One page, five sources stitched together by `build.py`:

- `src/template.html`: markup and CSS, no network references.
- `src/orbits.js`: the orbit maths for our own system. No DOM, no Three.js. Works in a browser (`window.SolarifyOrbits`) and in Node (`require`), which is the only reason the tests can exist.
- `src/tables.js`: data only. The world-building lookup tables described below.
- `src/system.js`: the system builder. Same deal as `orbits.js`: no DOM, no Three.js, works in both places. It takes a handful of choices and a seed and returns plain data.
- `src/app.js`: scene, UI, input, textures, images.

The build inlines Three.js r128 (vendored from Globify, MIT) plus those four files into `index.html`. It's committed, deliberately, so a double-click works and Pages needs no pipeline. The cost is a ~750 KB diff whenever the sources change, and a stale-file risk that `build.py --check` exists to catch. There's no CI workflow in the repo. Pushing workflow files can be refused for lack of permission and I'd rather ship without than argue with a token.

## One renderer, two kinds of system

The first version had the Sun, the planets and the Moon wired in by name all over `app.js`. Building your own system meant that had to stop. So a system is now data: a list of plain objects (stars, planets, moons) plus a few facts about the whole (where the habitable zone is, how far out anything reaches, what unit distances are measured in, which belts there are). `loadSystem()` takes one, makes the meshes, labels, lights and orbit lines, and `teardownSystem()` takes them all away again. Our own solar system is one such object, from `solarDef()`; a built system is another, from `system.js`.

A built planet's orbit goes through the *same* function as a real one. The orbit code wants elements in the JPL shape: a value and a rate per century for each of six numbers. A built planet gets rates of zero for everything except the mean longitude, whose rate is just 360 degrees over its period. Kepler's equation, the rotation into the ecliptic and the orbit lines work unchanged. A companion star, or both stars of a pair circling their shared centre, are bodies with the same sort of elements, so they move by the same code. Each star carries its own light, so planets are lit from wherever the stars actually are.

## The decisions that took actual thought

**Positions (our system).** NASA JPL's approximate Keplerian elements, Table 1 (1800 to 2050). Cheap, closed form, and honestly sourced. The alternative was a full ephemeris, which would be more accurate and several hundred kilobytes heavier for no visible gain at this zoom. Earth is the Earth-Moon barycentre because the table says so. Pluto is left out because the table has no row for it and inventing one is exactly the kind of thing this project avoids.

**Precession is the trap.** The elements are measured against the J2000 equinox. Equinoxes and solstices are defined against the equinox of the date. By 2025 those differ by about 0.35 degrees, so if you test "Earth sits at 180 degrees at the March equinox" without correcting, you get a 0.35 degree "bug" that isn't one. I fell for it. The test file corrects with IAU 2006 precession, and the errors collapse to a few hundredths of a degree. The same file records my other mistake: I misdated a Jupiter opposition and spent a while blaming the maths.

**The Moon is theatre.** Mean synodic phase, circular orbit, 5.145 degree tilt, locked face. It looks right and phases correctly to within about half a day. Calling it an ephemeris would be false, so the code, the panel and the docs all say otherwise.

**Scale, and the system unit.** Honest scale is unusable: planets are specks, the star is a dot. So there are two switches. Distances: squeezed (8 times the square root of the distance) or true (20 scene units per unit of distance). Sizes: enlarged or true. When a body is sub-pixel it gets a marker dot so you can still find it.

That worked for the Sun. It fell over for a red dwarf, whose whole planetary system fits inside Mercury's orbit. So distances are measured in a *system unit*: one AU for the Sun, and for a built system the square root of the star's brightness, the distance where a planet gets as much light as Earth does. Every star's habitable zone then lands at roughly the same place on screen. A star drawn at the enlarged size can still swallow its innermost planet, or its companion, so in a built system it is capped at about half the distance to the nearest planet and under a third of the way to its companion.

**Floating point.** At true scale a far giant is hundreds of units out and a moon is a hair from its planet. Rather than move the camera, the `universe` group is shifted by minus the focus each frame, so whatever you're looking at sits at the origin and precision holds. A logarithmic depth buffer handles the near and far planes. `setViewOffset` centres the focus in the part of the screen the panel isn't covering, including the bottom sheet on phones.

## The builder: three kinds of number

A built system mixes numbers of three kinds, and I try to keep them labelled.

**Real science.** The six main-sequence star presets (Mamajek's table), the habitable zone (Kopparapu et al. 2014, the one Earth-mass coefficients, clamped and flagged outside 2600 K to 7200 K), and Kepler's third law. I checked the Kopparapu coefficients against the paper's own tables rather than trusting my memory, which turned out to be right this time but wasn't a safe bet: the earlier 2013 version of the same paper has different numbers, and the two circulate side by side. The red giant and white dwarf are rounded from Wikipedia's summaries, not primary papers, so they are the least solid rows.

**Rules of thumb.** Most of the world-building rules are tabletop-style lookup tables and procedures, in `tables.js`: star evolution, spacing, size classes, atmosphere, world types and so on. They are deliberately simple and internally consistent, not a current astrophysics dataset, and I've tried to use them as designed instead of quietly swapping in physics when I preferred it. `tables.js` was generated from a source spreadsheet by script and read back against it, and the main numeric tables were compared cell by cell. Where one of these rules and real science disagree, the code says which one it is using.

**Staged.** Everything the rules don't cover, which is what the system *looks* like around them.

### The pipeline

`generate()` runs these steps, in this order, and each depends on the one before:

1. **Age.** From the slider, or rolled from the seed on a table of typical system ages.
2. **Primary star.** A preset, or a star "by mass": the evolution table gives its temperature, its brightness at the start and end of its main sequence, and its lifetime, interpolated between rows. Its brightness *now* is a straight line between those, so older stars are brighter. Past the end of its life, a star is held at its end-of-main-sequence brightness and the notes say so, because the table has nothing for later stages.
3. **Companion star** (optional). Separation class, mean separation and eccentricity from the tables (eccentricity capped at 0.6 so it stays drawable), mass up to the primary's. The *forbidden zone* is the part of space where the companion would throw a planet out: from a third of the closest approach (anything inside is safe) to three times the furthest (anything outside orbits both stars). That gives two regimes. **S-type**: planets orbit the primary only and stay inside a third of its companion's closest approach. **P-type**: they circle the pair, outside three times the farthest approach, using the stars' combined brightness and a luminosity-weighted temperature (a rough approximation, and I say so). If the home world you asked for can only be reached in P-type, the builder uses it. If neither works, no planets, and the notes explain.
4. **Limits.** Planets form no closer than the larger of a tenth of a solar mass in AU and a hundredth of the square root of the star's brightness, and no further than 40 AU per solar mass. A companion tightens those. The giant-forming *snow line* is 4.85 AU times the square root of the star's brightness at the start of its life; that replaced my first, home-made 170 K blackbody rule, which put Jupiter's birthplace at about 2.7 AU for the Sun. 4.85 is closer to where Jupiter actually sits.
5. **Rocky planets.** The home world goes first, at a distance chosen so that the *Kopparapu habitable zone and the rules' temperature band for a temperate world* overlap. They are different models and don't agree everywhere, and the first version of this builder put a home in the outer habitable zone where the rules' own arithmetic called it a frozen rock. Choosing where both agree means what you asked for and what you got tell the same story. The other rocky planets are stepped inward and outward from it using the table's spacing ratios (1.4 to 2.0), widened where a planet's eccentricity would otherwise let neighbours cross. A home out near the snow line is made the outermost rocky planet, so four rocky planets don't end up spread across forty AU. Anything past the outer limit is dropped, with a note.
6. **Giants.** Conventional: a chain starting at the snow line. Eccentric: the first giant on a stretched orbit (0.15 to 0.4), placed so its closest approach clears every rocky planet. Hot: the first giant very close in, and every rocky planet pushed at least 1.6 times further out. The rest step outward until they hit the outer limit.
7. **Belts.** First between the rocky planets and the first giant, like ours (the giants are pushed out to leave room), then outside the outermost planet, inside the innermost, or in the widest gap. A belt must keep clear of every planet's orbit plus its own width.
8. **Planets as worlds.** For a rocky world: size class from an orbit-contents roll (re-rolled until it is a planet; a home is Standard or Large); world type from size class and *blackbody temperature* (278 K at one AU from the Sun, no albedo); density from a roll by core type; diameter from the square root of blackbody temperature over density, times a factor that sets the limits of the size class (a rule of thumb; I haven't tried to justify it physically); gravity is density times diameter, mass is density times diameter cubed. Atmosphere pressure is atmosphere mass times a factor from the world type times gravity, which gives Venus-like worlds their ninety-odd atmospheres. Surface temperature is blackbody temperature times absorption times one plus atmosphere mass times the greenhouse factor, so a temperate world's surface comes out a believable place, and the climate word comes from a table. Volcanic activity is a roll plus forty times gravity over age, so young worlds are volcanic. Resources, habitability and affinity use a table and a set of modifiers. A tide-locked world gets a hot day side and a cold night side from day and night factors. A giant is a size class and a row from the mass-and-density table; its diameter is the cube root of mass over density.
9. **Moons.** Log-spaced between a minimum distance and a third of the Hill sphere, which is where the builder says no to the user, and I think that's right: it is physics doing something visible. Rocky planets near a star usually get none.

Two of those rules are mine. A Garden world needs a system at least 2.5 billion years old (otherwise it comes out as an Ocean world, with a note), which is roughly how long Earth took to get oxygen. And the home placement overlap in step 5.

### Orbits never cross, by construction

Eccentricity comes from a table, capped at 0.15 for rocky planets and 0.2 for giants so orbits stay tidy (an eccentric giant is the deliberate exception). The step between neighbours is the table's spacing ratio or `1.06 * (1 + e_inner) / (1 - e_outer)`, whichever is larger. That is the rule the fuzz test checks on every system, with a margin of three per cent.

The first version of the moon spacing let two moons land almost on top of each other, caught by the fuzz test within its first few systems. The rule now is slots at least 1.4 apart in distance, each moon jittered by no more than a fifth of a slot. Writing the companion-star rules turned up three more: outer rocky planets were not being cut off at the limit, giants could start inside a circumbinary forbidden zone, and the limit applied to a planet's mean distance instead of its closest approach. That is why the fuzz exists.

## Your own images: how it works

Images are kept in memory in a table keyed by body id, one table for our Solar System and one for built systems. A body's id is stable in the way that matters: in a built system `p1` is always the innermost planet, `p2` the next, and so on, however the system is rolled. `loadSystem` ends by `restoreMaps()`, which puts any stored image back on whichever bodies with those ids exist now; ones that don't exist this time are kept for later. That is the entire mechanism behind "your images stay".

Targeting uses the same hit test as clicking (`bodyAt`), with the one difference that points over the control panel never count, so dropping on the panel dresses the selected body. A drag over the page shows a floating label with the name, pauses time if it isn't already paused, and resumes only if the drag itself paused it. A timeout resumes time if the drag is abandoned, because browsers are not reliable about telling a page that a drag has left.

A project file is a JSON object: `{app:'solarify', version:1, mode, link, maps:[{id, name, data}]}`, where `link` is the builder's share-link string (so it is rejected, with a reason, if a later version of the generator changes) and each image is a JPEG data URL shrunk to at most 2048 pixels wide. Opening one is defensive: the size is capped, the JSON is parsed in a try, anything that isn't this app and this version is refused, only PNG, JPEG and WebP data URLs are accepted (an SVG would be a script risk, and a plain URL would be a network request), at most 200 images are read, and an image for a body that doesn't exist is stored harmlessly. Nothing in a project file is ever evaluated.

Textures for your images are downscaled to the GPU's limit if they are bigger, and built-in textures are painted in time-sliced jobs so the page never freezes: 512 pixels for planets and stars, 256 for moons, 1024 for the one you select, with a queue that lets a clicked body jump ahead. A built system has a surface for each of the table's world types (temperate, ocean, barren rock, ice, Hadean, ammonia, sulfur, thick cloud, scorched) and gas giants in six palettes with optional storms, ice giants, and rock or ice moons. Stars are painted from a display tint per type, not a physical colour. Lava worlds are rare because you have to be very close in to be that hot; that's the physics, not a bug.

## What's verified and what isn't

- The orbit maths: 28 checks in `tests/orbits.test.js`, passing at last run. I also broke the Kepler solver on purpose to confirm the tests fail when they should.
- The builder: 40 checks in `tests/system.test.js`, passing at last run. They include the Sun's habitable zone against the published figure, entries from the star table, the arithmetic the builder promises, and a fuzz run of 864 random systems across every star, home setting, giant layout and companion class. A one-off run of 20,000 fully random systems also passed.
- The tables: `tables.js` was generated from a source spreadsheet by script and read back against it. For the main numeric tables (absorption and greenhouse factors, gas giant masses and densities, the stellar evolution table, density by core) I also compared every cell against the spreadsheet separately; the smaller tables (spacing, eccentricity, tilt, climate bands and so on) were checked by reading. Reading is weaker than a cell-by-cell comparison, and I'd say so.
- The star table was checked against Mamajek's published file. The red giant and white dwarf figures are rounded from Wikipedia's summaries (which cite Bond et al. 2017 for Sirius B), so they are the least solid numbers in it. My first guess at Sirius B's luminosity was wrong by more than a factor of two, which is why I looked them up instead of trusting memory.
- The interface: exercised with Playwright scripts against headless Chromium on software GL. For our own system, 37 functional checks, edge cases, texture timing, a phone-sized viewport and the no-WebGL fallback. For the builder: its form and every control, both binary regimes, belts, the full planet panel, share links, and a sweep of six extreme configurations. For images: dropping on a chosen planet, in empty space, several at once, surviving a reroll, a star change and a mode switch, clearing, saving and opening a project in a fresh page, and a set of hostile project files. Those scripts are not in the repo. So that's evidence I looked, not a suite you can run.
- Performance: my JavaScript stays under one 60 Hz frame even for the heaviest system the form allows. The much larger frame time in the sandbox is software rendering. I have not profiled on real GPU hardware or on a phone.

## Real versus staged, in code terms

Real: positions of our own planets (`ELEMENTS`, JPL values verbatim), the NASA fact-sheet numbers in `solarDef()`, star properties in `STARS`, the habitable-zone fit (`HZ_INNER`, `HZ_OUTER`), Kepler periods, derived distance and light time.

Rules of thumb: everything read from `tables.js`.

Staged: our Moon's position, spin phase, axis directions other than Earth's, enlarged scales, generated surfaces, belt particles, lighting, and in a built system the layout around your home world, the moons, the 2.5 billion year rule and the P-type approximations.

Each is a choice for legibility, and each is labelled where a user could mistake it for data.

## Limitations worth stating

- Accuracy of our own planets degrades outside 1800 to 2050; dates are clamped to 1000 to 3000 and a note appears. A built system has no real date, only a day count, and runs 100,000 years either side of its start.
- No Pluto, no dwarf planets, no individual asteroids, and no moons for our own planets other than Earth's. Adding the Galilean moons for Jupiter would need an orbit source and a small amount of code.
- The rules are rules of thumb. Eccentricity is capped for tidiness; star evolution stops at the end of the main sequence; tectonics aren't modelled; rotation is the simple roll without special slow-rotation cases. Settlement, technology, society and economy are not modelled at all.
- The two stars of a binary are drawn on simple Kepler orbits. In the S-type case the primary stays still and the companion orbits it, ignoring the barycentre's motion; in the P-type case both circle the shared centre, and planets circle that centre rather than being perturbed by either star.
- Asking for a lot can exceed what fits. The limits and forbidden zones are real constraints in the rules, so some requests return fewer planets, belts or moons than asked for. That is on purpose, and the notes say so.
- A built system's lighting is staged, so a red dwarf's planets are as brightly lit as ours.
- Phones work, but I only tested the layout, not the thermals of a three-year-old handset spinning a hundred procedural spheres.
- Reduced-motion users get a paused start. That's intentional.
- Images are kept for as long as the page is open, and in a project file if you save one. There is no automatic save.

## Where it could go

None of this is promised. Candidates: the Galilean moons and Titan for our own system, Pluto from a proper source, a settlement and economy layer as an optional "who lives here" panel, tectonics, a gallery of ready-made starter maps (I'd have to find ones with a licence I could actually ship), and browser tests committed to the repo. The tests one is the one I'd actually do.

## Provenance

Orbital elements: NASA JPL, ssd.jpl.nasa.gov/planets/approx_pos.html. Physical data: NASA Planetary Fact Sheet. Precession: IAU 2006. New moon epoch and synodic month: Meeus. Star properties: Mamajek, "A Modern Mean Dwarf Stellar Color and Effective Temperature Sequence", version 2022.04.16, with the red giant and white dwarf rounded from Wikipedia's figures for Aldebaran and Sirius B (Bond et al. 2017 is the source Wikipedia cites for Sirius B's mass, radius and luminosity; I did not read that paper). Habitable zone: Kopparapu et al. 2014, ApJL 787, L29 (arXiv:1404.5292). World-building rules and tables: tabletop-style rules of thumb, collected in `src/tables.js`; they are not a current astrophysics dataset. Three.js: MIT, the three.js authors.
