# Solarify: why it's built the way it is

This is the half of the documentation that explains. `README.md` says how to run and use it. This says why it looks the way it does, which parts to trust, and what to understand before changing anything. Mostly it's for me in six months, annoyed.

## The short version

Solarify is a single HTML file that does two things with the same renderer. It shows our Solar System with the planets where NASA's formulae put them, and it builds invented systems from a few choices. Either way you can drop your own image onto any body.

It is not a simulator, an ephemeris service or a teaching product. I've tried to stop it pretending to be one. The invented systems in particular are a toy with real numbers and some tabletop-style rules of thumb underneath.

## The problem

I wanted what Globify does for a globe, but for a whole system. Globify's promise is narrow and good: one file, no install, nothing uploaded, and your own map on the sphere. Keeping that promise sets most of the constraints. The interface follows Globify's too: same tokens, same drawer and handle, same readout bezel, same row, toggle and button patterns. Where Globify loads Atkinson Hyperlegible from Google Fonts, Solarify embeds it, because "no network requests" is easier to defend without an exception.

One file means everything is inlined, Three.js included. No upload means no server, no cloud fonts, no analytics, and nowhere to put anything. It also means the page has to cope with whatever browser it lands in, with no way for me to see what happened.

The second half of the brief came later: build a system that doesn't exist, and keep it simple. Simple was the harder constraint. The generator has dozens of knobs, and the interface is meant to look like it has five.

## The approach

Three decisions govern the rest.

**A system is data.** The first version had the Sun, the planets and the Moon wired in by name all over `app.js`. That had to stop the moment a second kind of system arrived. A system is now a list of plain objects (stars, planets, moons) plus facts about the whole: where the habitable zone is, how far out anything reaches, which belts exist. `loadSystem()` turns one into meshes, labels, lights and orbit lines. `teardownSystem()` removes them all and disposes the textures. Our Solar System is one such object, written by `solarDef()`. A built system is another, written by `system.js`.

**Three kinds of number, labelled.** Real measurements, tabletop-style rules of thumb, and things I made up to fill the gaps. The docs, the panel's footnote and the code comments all try to say which is which. The rules of thumb are the dangerous middle one, because they look like data. They're simple and internally consistent. They're not a current astrophysics dataset, and I've avoided quietly swapping in physics when I preferred it.

**Simple on top, depth underneath.** The first screen is a star, three sliders, a home-world choice and a Roll button. Every control rebuilds the system on release, because a Generate button is a thing people have to find, press, and then wonder about. Everything else sits behind a folded "More options". Choosing a star by mass opens that fold, because otherwise its slider would be invisible.

## Architecture

Five source files, stitched into `index.html` by `build.py`:

- `src/template.html` is markup and CSS, with no network references.
- `src/orbits.js` is the orbit maths for our system. No DOM and no Three.js, so Node can run it. It exists as a separate file mostly so the tests can.
- `src/tables.js` is data only: the lookup tables the builder reads.
- `src/system.js` is the builder. Same rule as `orbits.js`. It takes settings and a seed and returns plain data.
- `src/app.js` is the scene, UI, input, textures and images.

Three.js r128 is vendored from Globify because that's the version I tested. The built `index.html` is committed on purpose, so a double-click works without a pipeline. The price is a diff of roughly 750 KB whenever sources change, and a stale-file risk that `build.py --check` is there to catch. There's no CI workflow. Pushing workflow files can be refused for lack of token permission, and I'd rather ship without one than argue with a token.

A built planet goes through the same orbit code as a real one. That code wants elements in the shape NASA publishes: a value and a rate per century for each of six numbers. A built planet gets rates of zero for everything except mean longitude, whose rate is 360 degrees over its period. Kepler's equation, the rotation into the ecliptic and the orbit lines then work unchanged. A companion star, or two stars circling a shared centre, are bodies with the same sort of elements. Each star carries its own light.

## Design decisions

### Our Solar System

**Positions come from NASA JPL's approximate Keplerian elements** (Table 1, stated valid for 1800 to 2050). Cheap, closed form, honestly sourced. The alternative was a full ephemeris, which would be more accurate and several hundred kilobytes heavier for no visible gain at this zoom. "Earth" is the Earth-Moon barycentre because that's what the table gives. Pluto is missing because the table has no row for it, and inventing one is the kind of thing this project avoids.

**Precession is the trap.** The elements are measured against the J2000 equinox. Equinoxes and solstices are defined against the equinox of the date. By 2025 those differ by about 0.35 degrees, so testing "Earth sits at 180 degrees at the March equinox" without correcting gives a 0.35 degree "bug" that isn't one. I fell for it. The test file now corrects with IAU 2006 precession and the errors drop to a few hundredths of a degree. The same file records my other mistake: I misdated a Jupiter opposition and blamed the maths for a while.

**The Moon is theatre.** Mean synodic phase, circular orbit, 5.145 degree tilt, locked face. It looks right and phases correctly to within about half a day. Calling it an ephemeris would be false, so the code, the panel and the docs say otherwise.

### Scale

Honest scale is unusable: planets are specks. So distances can be squeezed (eight times the square root of the distance) or true, and sizes enlarged or true. A body that falls below a couple of pixels gets a marker dot.

That worked for the Sun and fell over for a red dwarf, whose whole system would fit inside Mercury's orbit. So distances are measured in a *system unit*: one AU for the Sun, and for a built system the square root of the star's brightness, which is the distance where a planet gets as much light as Earth does. Every habitable zone then lands in roughly the same place on screen. A star drawn at the enlarged size could swallow its innermost planet or its companion, so in a built system it's capped at about half the distance to the nearest planet and under a third of the way to its companion.

At true scale a far giant is hundreds of units out and a moon is a hair from its planet. Rather than move the camera, the whole `universe` group shifts by minus the focus each frame, so whatever you're looking at sits at the origin and precision holds. A logarithmic depth buffer handles near and far planes.

### The builder

`generate()` runs these steps in this order, and each depends on the one before.

1. **Age.** From the slider, or rolled from the seed on a table of typical ages.
2. **Primary star.** A preset, or a star by mass: the table gives temperature, brightness at the start and end of its main sequence, and lifetime, interpolated between rows. Brightness now is a straight line between start and end, so older stars are brighter. Past the end of its life a star is held at its end-of-main-sequence brightness and the notes say so, because the table has nothing for later stages.
3. **Companion star**, optionally. The *forbidden zone* is where the companion would throw a planet out: from a third of its closest approach to three times its furthest. Inside the inner edge, planets orbit the primary (S-type). Outside the outer edge, they circle both (P-type), using combined brightness and a luminosity-weighted temperature, which is a rough approximation and labelled as one. If your requested home world is only reachable one way, the builder uses that way. If neither works there are no planets, and it explains.
4. **Limits.** Planets form no closer than the larger of 0.1 AU per solar mass and 0.01 AU times the square root of brightness, and no further than 40 AU per solar mass. A companion tightens both. The giant-forming snow line is 4.85 AU times the square root of the star's starting brightness.
5. **Rocky planets.** The home world goes first. The rest step inward and outward from it using the table's spacing ratios, widened where eccentricity would let neighbours cross. A home out near the snow line becomes the outermost rocky planet, so four rocky planets don't end up scattered over forty AU. Anything past the outer limit is dropped, with a note.
6. **Giants.** Conventional is a chain from the snow line. Eccentric puts the first giant on a stretched orbit whose closest approach clears every rocky planet. Hot puts it very close in and pushes every rocky planet at least 1.6 times further out.
7. **Belts.** One between the rocky planets and the first giant, like ours, then outside, inside, or in the widest gap, each kept clear of every planet's orbit plus its own width.
8. **Worlds.** Size class, then world type from size and blackbody temperature, then density, diameter, gravity, mass, atmosphere, surface temperature, climate, volcanism, resources and habitability, each from its table. A tide-locked world gets day and night temperatures.
9. **Moons.** Log-spaced between a minimum distance and a third of the planet's Hill sphere.

The order is the design. Age feeds the star, the star sets the limits and the zone, the zone places the home, the home anchors everything else. Laying a system out first and looking for the habitable zone afterwards would leave your home world wherever a planet happened to fall, which is rarely where you asked.

### Choices I'd defend

**Home placement uses two models.** The habitable zone (Kopparapu et al. 2014) and the tables' own temperature band for a temperate world are different models and don't agree everywhere. My first builder put a home in the outer habitable zone where the tables' arithmetic called it a frozen rock. Now the home goes where both agree. What you asked for and what the planet turns out to be tell the same story.

**Surface temperature includes the atmosphere.** Earlier I showed only a blackbody temperature, and a home world "inside the zone" looked frozen. The panel now shows both, with surface temperature as the headline.

**Orbits never cross, by construction.** Eccentricity comes from a table, capped at 0.15 for rocky planets and 0.2 for giants. The step between neighbours is the table's spacing ratio or `1.06 * (1 + e_inner) / (1 - e_outer)`, whichever is larger. The fuzz test checks that on every system, with a three per cent margin. An eccentric giant is the deliberate exception, and everything else is placed to clear it.

**The snow line moved.** My first version used a home-made 170 K blackbody rule, which put the Sun's at about 2.7 AU. The tables use 4.85 AU times the square root of starting brightness, which is much closer to where Jupiter sits. I took the table's.

**Two rules are mine.** A temperate world needs a system at least 2.5 billion years old, otherwise it comes out as an ocean world with a note, which is roughly how long Earth took to grow oxygen. And the home placement overlap above.

**Resizing a planet without disturbing the rest.** Size overrides needed one property: change planet 3 and planets 1, 2, 4 and 5 must not move. A single random stream can't give that, because a different size class changes how many numbers the world and its moons consume, and everything after it shifts. So each planet's body and moons now draw from their own stream seeded from the system seed and the planet's slot. The orbits still come from the main stream. The price was bumping the link version, which broke every old link, and I decided that was acceptable at this stage. The override rides in the share link as slot and class (rocky 0 to 3, giants 4 to 6, so a layout change can never apply a rocky size to a giant), and the tests check that nothing else changes, byte for byte.

**Exact diameter is a fraction, not a number.** The diameter limits depend on the planet's temperature and a rolled density, so a stored value in kilometres would mean something different after any change upstream. The slider stores where the diameter sits between the class limits (0 to 1000). The generator always draws its usual random diameter first and only then replaces it, so setting one never shifts a later roll. **A type override beats the rules, with one exception I made noise about.** The generator still runs its normal type choice first (so the random draws are unchanged), then swaps in the override if the size class permits it. Forced types mostly just flow through the tables: a hot Garden world gets the Garden atmosphere factor and reports a hot climate. The exception is a temperate world in a system under 2.5 billion years old, which my own staged rule would turn into an ocean world. Silently ignoring the override seemed worse than honouring it, so it's honoured with a note.

That's also why the extra link field is optional: with it absent, generation is unchanged and version 4 links still open.

**The studio workbook's additions, checked before use.** A later version of the TABARC-Studio workbook added orbital mechanics, planetary details and travel calculators. I took what was sound and fixed what wasn't. The workbook's Hohmann travel-time formula multiplies by pi and divides by 365.25, which gives nonsense; the right one is half the transfer orbit's period, 0.5 x ((r1 + r2) / 2)^1.5 / sqrt(M) years. Its Hohmann delta-v is the first burn only, so I added the arrival burn. Its Hill sphere mixes Earth and solar masses, which is out by a factor of about 69; the generator already did it properly. Its habitable zone (0.95 and 1.37 times the square root of brightness) is an older approximation, so I kept Kopparapu. The gas-retention rule, magnetic field, sky colours and Trojan roll went in as rules of thumb, labelled as such, with my own fill-ins where the tables left gaps (an F star's sky, for one). The light-delay and constant-thrust formulas were right as they stood. Settlement and factions stay out for now, because Solarify has no people in it yet.

**New detail had to leave old systems alone.** Trojans need a dice roll, and a roll in the wrong place shifts every number after it. So it comes after the moons, in the planet's own stream, and a test pins a fingerprint of a system made by the previous version to prove nothing earlier moved. A comparison of 200 systems against that version found no difference apart from the new fields.

**Moons say no.** A moon holds an orbit only within a fraction of its planet's Hill sphere, so you get fewer than you asked for, with a note. Rocky planets near a star usually get none. This is the one place the builder refuses the user, and I think that's right: it's physics doing something visible.

### Rejected

- **A Generate button.** More to find, and it invites the question of what's unsaved.
- **A confirm prompt before replacing a system that has images on it.** I built that first. It's wrong: it makes people choose between exploring and keeping their work. Images are stored by body slot and survive rerolls instead.
- **Putting images in the share link.** Links would be megabytes and the images would travel everywhere the link did.
- **Laying planets out first and finding the habitable zone after.** See above.
- **A full ephemeris.** See above.
- **Physically honest lighting.** Every star lights its planets at the same strength, tinted towards its colour. Honest would put a red dwarf's planets in near darkness, which is accurate and no use to anyone trying to look at them.

## Images

Images sit in an in-memory table keyed by body id, one table for our Solar System and one for built systems. A body id is stable in the way that matters: in a built system `p1` is always the innermost planet, `p2` the next, however the system is rolled. `loadSystem` ends by calling `restoreMaps()`, which puts any stored image back on whichever bodies with those ids exist now. Ones that don't exist this time are kept for later. That's the whole mechanism behind "your images stay".

Targeting uses the same hit test as clicking (`bodyAt`), except that points over the control panel never count. A drag over the page shows a label naming the target and pauses time if it isn't already paused, resuming only if the drag paused it. A timeout resumes time if the drag is abandoned, because browsers aren't reliable about telling a page that a drag has left. The pause exists because I discovered the hard way that you can't aim at a planet that goes round in a second.

A project file is `{app, version, mode, link, maps:[{id, name, data}]}`, where `link` is the builder's share-link string (so it's refused with a reason if a later generator changes) and each image is a JPEG data URL shrunk to at most 2048 pixels wide.

## Trust and boundaries

Nothing crosses the machine boundary. My code makes no network request, and the dependencies are one bundled copy of Three.js whose loaders I don't call.

The one untrusted input is a project file, so that's the strict path. The size is capped, the JSON is parsed inside a try, and anything that isn't this app and this version is refused. Images are accepted only as PNG, JPEG or WebP data URLs, because an SVG is a script risk and a plain URL is a network request. Nothing in the file is ever evaluated. I tested it with garbage, other apps' JSON, wrong versions and hostile image URLs. I haven't had it independently reviewed.

Images users drop in are downscaled to the GPU's limit if they're bigger, and read through object URLs that are revoked straight away.

## Current state

**Working, observed:** our Solar System (positions, panel, scales, time); the builder with every control in it, both companion regimes, belts, hot and eccentric giants, the full planet panel; share links; images on any body, several at once, surviving rerolls; project files in and out; the phone layout; the no-WebGL fallback.

**Checked less well:** the dice-range and smaller tables in `tables.js`. The main numeric tables were compared against the source cell by cell. The rest were checked by reading, which is weaker. The red giant and white dwarf figures came from Wikipedia's summaries, not the primary papers.

**Unverified:** behaviour on a real GPU, on a weak phone, and on GitHub Pages. Everything I've seen was software-rendered.

**Not modelled:** tectonics (the workbook has the table but not the modifiers that feed it, and I'd rather leave it out than invent them), special slow-rotation cases, and anything about settlement, technology, society or economy, which wouldn't change what a system looks like.

## Limitations and awkward bits

- The builder's rules are rules of thumb. Star evolution stops at the end of the main sequence. Eccentricity is capped for tidiness.
- In the S-type case the primary stays still and the companion orbits it, ignoring the barycentre's motion. In the P-type case both circle the centre and planets circle that centre rather than being perturbed by either star.
- Asking for a lot can exceed what fits. That's deliberate, and the notes say what was dropped.
- Lighting is staged, so a red dwarf's planets are as bright as ours.
- Two of my own bugs are worth remembering as classes. Truncation limits applied to a planet's mean distance when they should have applied to its closest approach. And a visibility toggle that I edited in the wrong function because two functions ended with the same line.
- The first screen hides a lot of depth. Some people will never find "More options". I'm fine with that, but it's a trade.

## Future direction

None of this exists yet; it's what I'd consider.

- The Galilean moons and Titan for our own system, which needs an orbit source and a little code.
- Pluto, from a proper source.
- A "who lives here" panel, if settlement and economy tables turn out to be worth wiring in.
- Tectonics.
- More per-planet overrides now that sizes and types work: atmosphere and moon count. The per-planet random streams were built so these stay cheap.
- A gallery of starter maps, if I can find ones whose licence lets me ship them.

## Provenance

Orbital elements: NASA JPL, ssd.jpl.nasa.gov/planets/approx_pos.html. Physical data: NASA Planetary Fact Sheet. Precession: IAU 2006. New moon epoch and synodic month: Meeus. Star presets: Mamajek, "A Modern Mean Dwarf Stellar Color and Effective Temperature Sequence", version 2022.04.16, with the red giant and white dwarf rounded from Wikipedia's figures for Aldebaran and Sirius B (Wikipedia cites Bond et al. 2017 for Sirius B; I didn't read that paper). Habitable zone: Kopparapu et al. 2014, ApJL 787, L29 (arXiv:1404.5292). World-building rules: tabletop-style tables in `src/tables.js`, not a current astrophysics dataset. Three.js: MIT, the three.js authors.
