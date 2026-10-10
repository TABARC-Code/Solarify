# Solarify

A solar system in one HTML file, and a workshop for building your own. It's the bigger sibling of [Globify](https://github.com/TABARC-Code/globified): same trick, more spheres.

Open the file and you get our Solar System, planets in the places NASA's formulae give for today. Press **Build your own** and you get an invented one: pick a star, move a few sliders, say where your home world should sit, and it builds the lot. Drag an image onto any planet and the planet wears it.

Nothing is uploaded. There's no server to upload to.

Author: TABARC-Code. Licence: MIT.

## Status

It works, it's tested in the ways listed under [Tests](#tests), and the awkward parts are listed under [Known limitations](#known-limitations).

Two things I haven't done. I haven't tried it on a real graphics card or a phone beyond checking the layout, because the machine I built it on only has software rendering. And I haven't switched on GitHub Pages. The repository is laid out for it (`index.html` at the root, plus a `.nojekyll` file), but whether Pages serves it properly is unverified.

## Run it

Download `index.html` and double-click it. Or clone the repository and open the same file:

```
git clone https://github.com/TABARC-Code/Solarify
```

That's all. There's nothing to install and nothing to configure, which is the nicest thing I can say about configuration. Three.js is bundled inside the page, so it works offline.

You need a browser with WebGL. If yours hasn't got it, the page says so in plain text instead of showing a black rectangle.

## What a first run looks like

A dark page. "Solarify" top left with a date and time under it. The Sun in the middle, orbit rings, labelled planets, and a control panel down the right-hand side (a bottom sheet on phones). The planets move, and the inner ones move fast, because the default is ten days per second.

Press **Build your own** and a toast tells you "Built" followed by a made-up name. The panel grows a short form and a summary line such as "4 rocky planets, 4 giants, 1 asteroid belt, 16 moons". If instead you see only a paragraph about WebGL, that's the fallback message, and the fix is in [Troubleshooting](#troubleshooting).

## Ten seconds of use

1. Open the page. That's our Solar System.
2. Press **Build your own**.
3. Move a slider or pick another star. It rebuilds the moment you let go.
4. Drag any image onto a planet.

Everything below is for when you go looking. It stays out of the way until you do.

## Our Solar System

The eight planets, the Sun and the Moon, plus the main asteroid belt between Mars and Jupiter. Time runs from real time up to one year per second, forwards or backwards, from the year 1000 to 3000, with a **Back to today** button.

Click a body for its panel: diameter, day length, axis tilt, orbit period, live distance from the Sun, how long its light takes to arrive, and where it sits relative to the Sun's habitable zone. **Squeezed** distances and **Enlarged** sizes make it viewable; the **True** buttons show you how empty it really is. A green band marks the habitable zone and a dashed line marks the snow line.

## Build your own

### What you see

| Control | What it does |
|---|---|
| Star | Red dwarf, orange dwarf, Sun-like, yellow-white, white, blue-white, red giant, white dwarf, or "Star by mass". |
| Rocky planets | 0 to 8. |
| Giant planets | 0 to 8, gas and ice, some with rings. |
| Moons per planet | 0 to 4 for rocky planets. Giants get twice that unless you say otherwise underneath. |
| Your home world | In the habitable zone, too close, too far, or none. It gets a gold ring, "(Home)" in its name and a gold orbit. |
| Roll a new system | New seed, new system. |

Every control rebuilds the system as you release it. There's no Generate button, because a button is one more thing to find.

Ask for more than fits and you get less, with a note saying why. Six moons round a planet that hugs a red dwarf comes back with fewer, because past a certain distance a moon can't hold an orbit against the star. A home world with no rocky planets gets you one rocky planet.

### What's underneath ("More options")

| Control | What it does |
|---|---|
| Star mass | Appears when you choose "Star by mass". 0.1 to 10 times the Sun. |
| System age | 0.1 to 12 billion years, or "rolled from the seed". Older stars are brighter, young systems are volcanic, and a home world needs about 2.5 billion years to get a breathable atmosphere. |
| Moons per giant | 0 to 8. Follows the simple slider until you touch it. |
| Asteroid belts | 0 to 3. |
| Giant planet layout | Conventional, eccentric (first giant on a stretched orbit, nearer in), or hot (first giant very close to the star). |
| Companion star | None, or very close, close, moderate, wide, or distant. |
| Seed | Same settings and same seed give the same system, every time. |
| Copy link | A short address that rebuilds this system, for example `#s=3.G.0.46.4.4.1.1.2.hz.c.n.12345`. |

Pasting a link into a tab that already has one open rebuilds the system. The link holds settings and a seed, never your images.

With a companion star, planets either orbit the primary alone and stay clear of the companion's forbidden zone, or circle the pair when the stars are too close for that. If neither works there are no planets, and the notes under the sliders say so.

### What a built world tells you

Click any body. A rocky planet shows its size class and world type, density, gravity, mass, atmosphere (how thick, and whether you could breathe it), how much of the surface is liquid water, surface temperature with a climate word, the temperature it would have without an atmosphere, volcanic activity, resources, habitability, and a combined affinity score. A tide-locked world adds day-side and night-side temperatures. Giants show size class, mass and density. A star shows its type, age, lifetime, habitable zone, snow line, and its companion if it has one.

## Your own images

The Globify trick, on every body in both modes: stars, planets, moons.

- **Drop an image on a body** and that body wears it. While you drag, a small label names the body it will go to, and time pauses so you can aim at something that goes round in a second.
- **Drop it anywhere else** and it goes on the selected body.
- **Drop several at once** and they dress several bodies in order, starting with the one under the pointer.
- **2:1 equirectangular** wraps cleanest. Other shapes work but look stretched, and the panel tells you.
- **Your images stay while the page is open.** Roll a new system, change the star, or switch to our Solar System and back, and each image stays on the same slot (planet b is always planet b). The two kinds of system keep separate sets.
- **Built-in look** (in the Selected panel) removes one image. **Clear all my images** (under Project) removes the lot.
- **Project files** (under Project, **Save to a file** and **Open a file**) hold the system and its images in one file you can carry to another browser.

For maps, NASA and USGS publish plenty, and the Solar System Scope textures are popular. Check each source's licence before you reuse or redistribute anything. NASA's media guidelines are generally permissive, and "generally" is doing a fair amount of work in that sentence. I haven't bundled any.

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
| `T` | Back to today, or to day 0 in a built system |
| `O`, `L` and `Z` | Orbits, labels, habitable zone |
| `?` | Help. `Esc` closes it |

Moons are listed under their planet's button whenever that planet or one of its moons is selected. **Save as PNG** (under View) saves what you can see, minus the panel.

## What's real and what's staged

Our Solar System runs on real numbers: NASA JPL's approximate orbital elements for planet positions (stated accuracy covers 1800 to 2050), and the NASA Planetary Fact Sheet for sizes, spins, tilts and periods. Distance and light time are worked out live from those.

The Moon is staged. It shows the mean phase on a circular orbit, so it can be about half a day out. Spin phase is invented, planets turn at the right rate but from a made-up starting angle. Textures are generated by noise functions, so they're impressions, not photographs. There's no Pluto, because the orbit table doesn't include one.

A built system is never a real place. Three things feed it:

- **Real science:** the star presets (Mamajek's dwarf sequence, plus a red giant and a white dwarf I took from Wikipedia, so those two are the shakiest rows), the habitable zone (Kopparapu et al. 2014), and Kepler's third law.
- **Tabletop-style rules of thumb:** most of the world-building, held in `src/tables.js`. Star life and evolution, orbit spacing, world types, atmosphere, surface temperature, climate, volcanism, resources and habitability. They make believable systems, not accurate ones.
- **Staged by me:** what sits where around your home world, plus belts, moons, surfaces and lighting. Every star lights its planets equally, so a dim red dwarf's planets are still visible.

The reasoning behind those choices is in `description.md`.

## Privacy and security

Nothing leaves your machine. None of the code I wrote makes a network request, and the only URL in it is an SVG namespace inside the favicon. Three.js is bundled unmodified and I don't call its loaders.

The browser stores two small things in `localStorage`: your view settings (orbits, labels, stars, zone, scale modes, speed for our own system) and the last builder settings. No images, no dates, no personal data. The address bar changes to the share link when you build a system; it holds only settings and a seed.

Your images live in memory until you close the page, or in a project file if you save one. Opening a project file is treated as untrusted input. It must be under 80 MB, parse as JSON, say it's a Solarify project of this version, and contain images only as PNG, JPEG or WebP data URLs (at most 200). Anything else is dropped, and nothing in the file is ever evaluated. That's a description of what the code does, not a promise that it's flawless.

## Troubleshooting

**The page shows a paragraph about WebGL and nothing else.** The browser has WebGL switched off or doesn't offer it. Try a current Chrome, Edge, Firefox or Safari and check that hardware acceleration is on.

**It's slow or choppy.** Probably software rendering, meaning no graphics card is being used. It works but won't be smooth, and the busiest built systems are a hundred-odd spheres. Slow time with `[`, or ask for fewer bodies.

**An image looks stretched.** It isn't 2:1. Use an equirectangular map, or live with it.

**"That is not an image."** The file wasn't recognised. Try a PNG or JPEG.

**Copy link does nothing.** Some browsers block clipboard access, especially from a `file://` page. The toast shows the address instead. Copy it from the address bar.

**A project file is refused.** Either it isn't a Solarify project file or it was made by a different version of the builder. The message says which.

**Keyboard shortcuts stopped working.** A slider or dropdown has focus, and shortcuts are ignored while one does. Click an empty part of the scene and they return.

**I asked for eight giants and got five.** The star's planet-forming limits (and a companion's forbidden zone) are real constraints in the rules. The notes under the sliders say what was dropped.

## Tests

```
node tests/orbits.test.js
node tests/system.test.js
```

No dependencies, no network. I ran them on Node 22. Other versions are untested.

`orbits.test.js` has 28 checks on the orbit maths against real events: equinoxes and solstices (with a precession correction, explained in the file header), Earth's perihelion and aphelion, planetary oppositions, Kepler's equation, and Moon phase against real full and new moons.

`system.test.js` has 40 checks: published numbers, arithmetic the builder promises, and a fuzz run of 864 random systems checking what must always hold. Orbits never cross, nothing sits inside its star, planets stay out of a companion's forbidden zone, belts keep clear, moons stay inside the stability limit, and the same seed gives the same system. Both files passed when I last ran them. I also pushed 20,000 fully random systems through the same checks once, and those passed too.

The interface has no automated tests in this repository. I checked it with throwaway Playwright scripts in headless Chromium, covering selection, keys, time, scale modes, the builder form, both companion-star cases, belts, the planet panel, share links, dropping images, project files (including hostile ones), a phone-sized viewport and the no-WebGL fallback. Those scripts aren't included, so treat the interface as looked at, not covered.

## Build

`index.html` is generated and committed, so double-clicking works without a build step.

```
python3 build.py          # writes index.html
python3 build.py --check  # fails if index.html is stale
```

Source lives in `src/` (`template.html`, `app.js`, `orbits.js`, `tables.js`, `system.js`) with Three.js r128 in `vendor/`. Edit the sources, never the built file. Python 3, standard library only; I used 3.13.

## Known limitations

- Our own planets lose accuracy outside 1800 to 2050. A note appears, and deserves the suspicion it implies.
- A built system has a day count, not a date.
- No Pluto, no individual asteroids, and no moons for our planets other than ours.
- Built textures are painted in the background after you build. Planets pop in over a few seconds, and the one you select sharpens when you do.
- If I change how systems are generated, old share links stop matching. They carry a version number, so they're refused, not quietly turned into something else.
- Images aren't saved automatically. Use a project file.
- The date readout can sit over a body in close-ups.

`description.md` has the reasoning, the trade-offs, and the parts I'd change first.
