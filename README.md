# Solarify

A solar system in one HTML file, and a workshop for building your own. Sibling of [Globify](https://github.com/TABARC-Code/globified): same idea, bigger room. Open it, watch the planets go round, drop an image on one, and it wears it.

Nothing to install. Nothing is uploaded anywhere. Three.js is bundled inside the page, so it works offline once you've got the file.

Author: TABARC-Code. Licence: MIT.

## Status, honestly

Built and tested locally. The GitHub repository could not be created from the build session (the integration got a 403), so at the time of writing this lives on disk and has not been pushed. If you're reading it on GitHub, that got sorted.

## Run it

Download `index.html` and double-click it. That's the lot.

You need a browser with WebGL. If it hasn't got any, the page says so rather than showing a black rectangle.

If you'd rather serve it (GitHub Pages, say), the repository has a `.nojekyll` file and `index.html` at the root, so nothing else is required.

## Ten seconds

1. Open the page. That's our Solar System, where the planets really are today.
2. Press **Build your own**. A system appears.
3. Move a slider, or pick another star. It rebuilds the moment you let go.
4. Drag any image onto a planet. It wears it.

That is the whole front of house. Everything below is there when you go looking, and stays out of the way when you don't.

## Our Solar System

- The eight planets, the Sun and the Moon, moving on a date you control, plus the main asteroid belt between Mars and Jupiter.
- Time from real time up to one year per second, forwards or backwards, pausable, with a "today" button. Dates run from the year 1000 to 3000.
- Pick any body for a panel of facts: diameter, day length, axis tilt, orbit period, live distance from the Sun, light travel time, and where it sits relative to the Sun's habitable zone.
- Squeezed or true distances. Enlarged or true sizes. True is accurate and, as you'd expect, mostly empty.
- A green band for the habitable zone and a dashed line for the snow line, if you want them.

## Build your own

### What you see

| Control | What it does |
|---|---|
| Star | Red dwarf, orange dwarf, Sun-like, yellow-white, white, blue-white, red giant, white dwarf, or "Star by mass". Sets the brightness, and so where the habitable zone is. |
| Rocky planets | 0 to 8. |
| Giant planets | 0 to 8. Gas and ice giants, some with rings. |
| Moons per planet | 0 to 4 for rocky planets. Giants get twice that, unless you say otherwise underneath. |
| Your home world | In the habitable zone, too hot, too far, or none. It gets a gold ring, "(Home)" in its name, and a gold orbit line. |
| Roll a new system | New seed, new system. |

Every control rebuilds the system as soon as you let go of it. There is no Generate button because there shouldn't need to be one.

The summary underneath says what you got, plus any honest complaints. Ask for six moons round a planet that hugs a red dwarf and you'll get fewer, because past a certain distance a moon can't hold an orbit against the star's pull (the Hill sphere). Ask for a home world but no rocky planets and you get one rocky planet; a home has to live somewhere.

### What's underneath ("More options")

| Control | What it does |
|---|---|
| Star mass | Appears when you choose "Star by mass". 0.1 to 10 times the Sun. The star's type, temperature, brightness and lifetime come from the table, and its brightness changes with the system's age. |
| System age | 0.1 to 12 billion years, or "rolled from the seed". Older stars are brighter. Young systems are volcanic. A home world needs about 2.5 billion years before it has a breathable atmosphere. |
| Moons per giant | 0 to 8. Follows the simple moons slider until you touch it. |
| Asteroid belts | 0 to 3. One between the rocky planets and the giants, like ours, then outside and inside as room allows. |
| Giant planet layout | Conventional (beyond the snow line), eccentric (the first giant on a stretched orbit, nearer in, with the rocky planets kept clear of it), or hot (the first giant very close to the star, everything else well outside it). |
| Companion star | None, or very close, close, moderate, wide, or distant. Planets then orbit the primary alone, staying clear of the companion's forbidden zone, or circle the pair if the stars are too close for that. If neither fits, there are no planets and the notes say why. |
| Seed | The same settings and seed always make the same system. |
| Copy link | A short address that rebuilds this exact system, something like `#s=3.G.0.46.4.4.1.1.2.hz.c.n.12345`. Paste a different link into a tab that already has one open and it rebuilds. The link carries only settings, never your images. |

### What a built world tells you

Click any body. A rocky planet's panel gives its size class (Tiny, Small, Standard or Large) and world type, density, surface gravity, mass, atmosphere (how thick, and whether you could breathe it), how much of the surface is liquid water, surface temperature with the climate word that goes with it, the blackbody temperature without an atmosphere for comparison, volcanic activity, resources, habitability and a combined affinity score. A tide-locked world also shows its day-side and night-side temperatures. Giants show their size class, mass and density. The star shows its type, age, lifetime, habitable zone, snow line, and its companion if it has one.

Surface temperature includes the atmosphere (absorption and greenhouse), so a home world in the habitable zone comes out as a believable place to be, from cold to warm depending on where in the zone it sits.

## Your own images

This is the Globify trick, and it works on every body in both modes: stars, planets, moons.

- **Drop an image on a body** and that body wears it. Drag one over the page and a small label says which body it will go to. Time pauses while you drag so you can aim at a moving planet, and carries on when you let go.
- **Drop it anywhere else** and it goes on the body you have selected.
- **Drop several at once** and they dress several bodies in order, starting with the one you dropped on.
- **Equirectangular, 2:1** wraps most cleanly. Other shapes work but look stretched, and the panel says so.
- **Your images stay while the page is open.** Roll a new system, change the star, switch to our Solar System and back: your images stay on the same slots (planet b is always planet b). Our Solar System and built systems keep separate sets.
- **Built-in look** (in the Selected panel) takes one image off. **Clear all my images** (under Project) takes them all off.
- **Project files** (also under Project) save the system and its images into one file and open it again, in any browser. Images in it are shrunk to a sensible size. Only PNG, JPEG and WebP images are accepted when opening one, and anything else in the file is ignored.

Where to find maps: NASA and USGS publish plenty of planetary maps, and the Solar System Scope textures are popular. Check each source's licence before you reuse or redistribute anything. NASA's media guidelines are generally permissive but "generally" is doing work in that sentence, so read them. I haven't bundled any.

## Controls

| Input | Does |
|---|---|
| Drag, or arrow keys | Look around |
| Wheel, pinch, `+` and `-` | Zoom |
| `1` to `9` | Planets in order (in our system, `9` is the Moon) |
| `,` and `.` | Previous and next body |
| `0` | Whole system |
| `Space` | Pause or play |
| `[` and `]` | Slower and faster |
| `R` | Reverse time |
| `T` | Back to today (or to day 0 in a built system) |
| `O`, `L` and `Z` | Orbits, labels, habitable zone |
| `?` | Help, `Esc` closes it |

Moons are listed under their planet's button whenever that planet (or one of its moons) is selected. You can also click a moon in the scene, or its label. On phones the panel becomes a bottom sheet.

## What's real and what's staged

This matters, so it gets its own section.

### Our Solar System

**Real**

- Planet positions come from NASA JPL's "Keplerian Elements for Approximate Positions of the Major Planets", Table 1, which NASA gives for 1800 to 2050. The values are copied as published. JPL's own page quotes longitude errors of roughly 10 arc-seconds up to 600 arc-seconds across the planets in that window. Outside it, expect it to drift.
- Body sizes, day lengths, axis tilts, orbital periods, inclinations and eccentricities come from the NASA Planetary Fact Sheet.
- The distance and light-time figures in the panel are computed from those positions on the date shown.

**Staged**

- The Moon shows the *mean* phase on a circular orbit. It is not an ephemeris and can be off from the true phase by up to about half a day. The tidal lock is real; the exact position is approximate.
- "Earth" is the Earth-Moon barycentre, because that is what the JPL table gives. The real Earth is under 5,000 km from it.
- Spin phase is invented. Planets turn at the right *rate* (capped, so fast spinners don't strobe) but not from a true starting angle.
- Axis tilt amounts are NASA's. The direction each axis leans is only correct for Earth.
- The asteroid belt is real in extent (roughly 2.2 to 3.2 AU) and made of invented particles.
- Default sizes and distances are squeezed so you can see things. The "true" buttons undo that.
- Surface textures are generated procedurally. They are tidy impressions, not photographs.
- No Pluto. The JPL table doesn't cover it and I didn't want to invent an orbit.

### A built system

Nothing in a built system is a real place. The numbers it leans on come from three kinds of source, and it matters which is which.

**Real science**

- The six main-sequence star presets are Mamajek's mean dwarf sequence (version 2022.04.16). The red giant and white dwarf are rounded from Wikipedia's figures for Aldebaran and Sirius B, which makes them the shakiest numbers here.
- The habitable zone is the Kopparapu et al. 2014 fit for a one Earth-mass planet. For the Sun it gives about 0.95 to 1.68 AU. The authors made it for stars between 2600 K and 7200 K; outside that, the code clamps the temperature and says the zone is rough.
- Orbital periods follow Kepler's third law.

**Tabletop-style world-building rules**

Most of the world-building rules are lookup tables and procedures of the kind a tabletop system uses to make believable worlds, held in `src/tables.js`. They are rules of thumb, not a current astrophysics dataset. They decide: star mass, age and evolution (brightness changing over a star's life, and how long it lives); the giant-forming snow line (4.85 AU times the square root of the star's starting brightness); orbit spacing and eccentricity; size classes, and the diameter limits that come from temperature and density; density by core type; world types from size and temperature (Hadean, Ice, Ammonia, Garden, Ocean, Greenhouse, Chthonian, Rock, Sulfur); atmosphere pressure; absorption and greenhouse factors, and so surface temperature; climate classes; volcanic activity; resource value and habitability; companion-star separations and eccentricities with their forbidden zones; gas giant masses and densities; axial tilt; and day and night temperatures on tide-locked worlds.

**Staged by me**

- How many planets there are, where they sit around your home world, and what the belts, moons, textures and lighting look like. None of that is a model of how planets form.
- The rule that a home world needs about 2.5 billion years to get a breathable atmosphere. That one is mine, from roughly when Earth's atmosphere gained oxygen.
- The home world's placement: it is put where *both* the Kopparapu habitable zone and the rules' temperature band for a temperate world agree, so what you ask for and what the planet turns out to be tell the same story.
- Moons: spaced logarithmically between a minimum distance and about a third of the Hill sphere, on circular orbits, assumed locked to their planet. A planet very close to its star is assumed locked too.
- The two stars of a binary are drawn on simple Kepler orbits. In the "planets round one star" case the primary sits still and the companion orbits it; in the circumbinary case both circle their shared centre.
- Lighting is deliberately not realistic: every star lights its planets at the same brightness, tinted towards its colour, so a dim red dwarf's planets are still visible.
- What isn't modelled: tectonics, special slow-rotation cases, and anything about settlement, technology, society or economy, which don't change what a system looks like.

## Privacy

`localStorage` holds your view settings (orbits, labels, stars, zone, scale modes, speed for our own system) and the last settings you used in the builder form. No image, no date, no personal data. The address in the browser bar changes to the share link when you build a system; it contains only those settings and the seed. Your images live in memory until you close the page, or in a project file if you save one.

## Tests

```
node tests/orbits.test.js
node tests/system.test.js
```

No dependencies, no network.

`orbits.test.js` has 28 checks on the orbit maths against real events: equinoxes and solstices (with the precession correction, see the file header for why that's needed), Earth's perihelion and aphelion for 2025, planetary oppositions, Jupiter's mean motion, Kepler's equation, and Moon phase against real full and new moons (within eight degrees).

`system.test.js` has 40 checks. Some compare against published numbers (the Sun's habitable zone, Kepler's third law for Jupiter, entries from the star table). Some check arithmetic the builder promises (gravity is density times diameter, mass is density times diameter cubed, climate follows surface temperature, diameters stay inside their size class). The big one generates 864 random systems across every star type, home setting, giant layout, and companion class, and checks what must always be true: the counts match what was asked for (or a note says why not), orbits never cross, nothing is inside its star, planets stay out of a companion's forbidden zone, belts keep clear of planets, moons stay inside the Hill limit, home worlds land where requested, ages never exceed a star's lifetime, the same seed gives the same system, and share links survive a round trip. I also ran the same checks over 20,000 fully random systems once; they passed. That run, and writing the rules in the first place, turned up a handful of real bugs, which is rather the point of having it.

All 68 passed when I last ran them.

There are no automated browser tests in this repository. I checked the interface with throwaway Playwright scripts in headless Chromium: selection, keys, time, scale modes, the builder form and every control in it, both binary regimes, belts, the full planet panel, share links, dropping images on a chosen planet, several at once, images surviving a reroll, the project file round trip and hostile project files, every body in a spread of systems (including empty ones, giants-only and the heaviest the form allows), a phone-sized viewport, and the no-WebGL fallback. Those scripts are not included, so treat the UI as "looked at", not "covered".

## Building

`index.html` is generated and committed, so that double-clicking and Pages both work.

```
python3 build.py          # writes index.html
python3 build.py --check  # fails if index.html is stale
```

Source is in `src/` (`template.html`, `app.js`, `orbits.js`, `tables.js`, `system.js`). Three.js r128 is in `vendor/`. Edit the sources, never the built file. Python 3, standard library only.

## Known rough edges

- Software rendering (no GPU) is slow. The page works but won't be smooth, and the heaviest built system is a lot of spheres. On a real GPU that should be fine; I haven't tried a weak phone.
- In a built system, every texture is painted in the background after you build it. Planets pop in over a few seconds, and the one you select sharpens when you do.
- Asking for a lot can exceed what fits. The star's planet-forming limits (and a companion's forbidden zone) are real constraints in the rules, so some requests come back with fewer giants, rocky planets, belts or moons than you asked for. The notes under the sliders say which and why.
- The date readout can sit over a body in close-ups.
- Dates outside 1800 to 2050 in our own system show a note, and deserve the suspicion it implies.
- Share links carry a version number. If I ever change how systems are generated, old links get rejected rather than quietly producing a different system, and the page falls back to our own.

See `description.md` for why it's built the way it is.
