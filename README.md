# Solarify

A solar system in one HTML file. Sibling of [Globify](https://github.com/TABARC-Code/globified): same idea, bigger room. Open it, watch the planets go round, pick one, and (if you fancy) dress it in your own map.

Nothing to install. Nothing is uploaded anywhere. Three.js is bundled inside the page, so it works offline once you've got the file.

Author: TABARC-Code. Licence: MIT.

## Status, honestly

Built and tested locally. The GitHub repository could not be created from the build session (the integration got a 403), so at the time of writing this lives on disk and has not been pushed. If you're reading it on GitHub, that got sorted.

## Run it

Download `index.html` and double-click it. That's the lot.

You need a browser with WebGL. If it hasn't got any, the page says so rather than showing a black rectangle.

If you'd rather serve it (GitHub Pages, say), the repository has a `.nojekyll` file and `index.html` at the root, so nothing else is required.

## What you get

- The eight planets plus the Sun and the Moon, moving on a date you control.
- Time from real time up to one year per second, forwards or backwards, pausable, with a "today" button. Dates run from the year 1000 to 3000.
- Pick any body for a panel of facts: diameter, day length, axis tilt, orbit period, and live distance from the Sun and light travel time.
- Squeezed or true distances. Enlarged or true sizes. True is accurate and, as you'd expect, mostly empty.
- Orbit lines, labels and stars each switch on and off.
- Your own map on any body. Drop an image on the page or use the button. It stays in your browser.
- "Save as PNG" captures what you're looking at.
- On phones the panel becomes a bottom sheet.

## Controls

| Input | Does |
|---|---|
| Drag, or arrow keys | Look around |
| Wheel, pinch, `+` and `-` | Zoom |
| `1` to `8` | Mercury to Neptune |
| `9` | Moon |
| `0` | Whole system |
| `Space` | Pause or play |
| `[` and `]` | Slower and faster |
| `R` | Reverse time |
| `T` | Back to today |
| `O` and `L` | Orbits and labels |
| `?` | Help, `Esc` closes it |

## What's real and what's staged

This matters, so it gets its own section.

**Real**

- Planet positions come from NASA JPL's "Keplerian Elements for Approximate Positions of the Major Planets", Table 1, which NASA gives for 1800 to 2050. The values are copied as published. JPL's own page quotes longitude errors of roughly 10 arc-seconds up to 600 arc-seconds across the planets in that window. Outside it, expect it to drift.
- Body sizes, day lengths, axis tilts, orbital periods, inclinations and eccentricities come from the NASA Planetary Fact Sheet.
- The distance and light-time figures in the panel are computed from those positions on the date shown.

**Staged**

- The Moon shows the *mean* phase on a circular orbit. It is not an ephemeris and can be off from the true phase by up to about half a day. The tidal lock is real; the exact position is approximate.
- "Earth" is the Earth-Moon barycentre, because that is what the JPL table gives. The real Earth is under 5,000 km from it. Invisible at this scale, but it's still a fudge.
- Spin phase is invented. Planets turn at the right *rate* (capped, so fast spinners don't strobe) but not from a true starting angle.
- Axis tilt amounts are NASA's. The direction each axis leans is only correct for Earth.
- Default sizes and distances are squeezed so you can see things. The "true" buttons undo that.
- Surface textures are generated procedurally. They are tidy impressions, not photographs.
- No Pluto. The JPL table doesn't cover it and I didn't want to invent an orbit.

## Your own maps

Select a body, then drop an image on the page (or use "Use my own map…"). Equirectangular, 2:1, is what wraps onto a sphere cleanly. The image is read by your browser and used as a texture. It is never sent anywhere, and it isn't kept after you close the page.

Where to find maps: NASA and USGS publish plenty of planetary maps, and the Solar System Scope textures are popular. Check each source's licence before you reuse or redistribute anything. NASA's media guidelines are generally permissive but "generally" is doing work in that sentence, so read them. I haven't bundled any.

## Privacy

`localStorage` holds a handful of view settings (orbits, labels, stars, scale modes, speed). No map, no date, no personal data.

## Tests

```
node tests/orbits.test.js
```

28 checks, no dependencies, no network. They test the orbit maths against real events: equinoxes and solstices (with the precession correction, see the file header for why that's needed), Earth's perihelion and aphelion for 2025, planetary oppositions, Jupiter's mean motion, Kepler's equation, and Moon phase against real full and new moons (within eight degrees). All 28 passed when I last ran them.

There are no automated browser tests in this repository. I checked the interface by hand and with throwaway Playwright scripts in headless Chromium; those scripts are not included, so treat the UI as "looked at", not "covered".

## Building

`index.html` is generated and committed, so that double-clicking and Pages both work.

```
python3 build.py          # writes index.html
python3 build.py --check  # fails if index.html is stale
```

Source is in `src/` (`template.html`, `app.js`, `orbits.js`). Three.js r128 is in `vendor/`. Edit the sources, never the built file. Python 3, standard library only.

## Known rough edges

- Software rendering (no GPU) is slow. The page works but won't be smooth.
- The date readout can sit over a body in close-ups.
- Dates outside 1800 to 2050 show a note, and deserve the suspicion it implies.

See `description.md` for why it's built the way it is.
