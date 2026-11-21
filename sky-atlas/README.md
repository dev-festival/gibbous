# Gibbous — Birth sky atlas

Generate a three-page US Letter astronomical report in a browser. The calendar, artist reference and source table use one calculated report. City search, historical time conversion, ephemeris calculations and vector PDF export run on the device. The application has no accounts, analytics, database, external map service or birth-detail logging.

## Run locally

Install Node.js 22.12 or later. From the `sky-atlas` directory run:

```sh
npm ci
npm run dev
```

Open the localhost URL printed by Vite (normally **http://127.0.0.1:5173**). No API keys or environment variables are required. To serve a production build, run `npm run build` and serve the contents of `dist/` from the root of any static HTTP server. Dependency installation requires internet access; the built site is self-contained.

The initial preview is the Lawrenceville example. Enter a date and local time, select a city, check the displayed coordinates and time zone, confirm the location, and generate the report. Use the three preview tabs to inspect the pages. Download PDF exports all three sheets together. Print at actual size on US Letter. The downloaded example is in `output/pdf/Gibbous-1987-07-14.pdf`.

## Calculations

- Supported local dates are 1900–2100 inclusive. Full historical IANA rules from moment-timezone (2026f in the lockfile) resolve the wall clock. Repeated times require choosing an occurrence. Skipped birth times are rejected. Historical records may be approximate, particularly before 1970; future offsets reflect currently projected rules.
- The city-timezones catalog is bundled locally, with the supplied Lawrenceville coordinates added. Latitude and longitude are signed decimal degrees, north and east positive. Manual coordinates and IANA zone selection support places outside the catalog.
- MIT-licensed Astronomy Engine 2.1.19 supplies the ephemeris. This allows static, browser-local distribution and introduces small numerical differences from the reference's Swiss Ephemeris/Moshier path. The dependency lock fixes the model version.
- Rise/set uses the upper limb with 34 arcminutes of standard refraction and a sea-level unobstructed horizon. Civil twilight uses the geometric solar center at -6°. Each event is found in UTC and assigned to its local civil date before minute rounding. Tables retain multiple events of the same type. A trailing + denotes rounding into the next day. A dash marks an absent event or noon sample.
- The birth snapshot uses geometric topocentric coordinates of date with north-clockwise azimuth. Illumination is the visible fraction derived from the phase angle between the apparent Moon-to-Sun and Moon-to-Earth vectors. Primary phases use the geocentric ecliptic longitude difference. Phase names use the waxing/waning quadrant, with the primary name within 0.25° of its defining longitude.
- Daily illumination is sampled at local noon (the first occurrence for a repeated noon). On the charts the birth row uses the birth instant; a conjunction row shows the new moon. When both occur on the same day, the new-moon symbol is on the left and the birth disk on the right. Their chart time markers remain independent.
- The analemma samples every calendar date at noon at the **January 1 standard UTC offset**, fixed throughout the year. The static standard-offset table comes from Python tzdata 2026c and can be rebuilt with `scripts/standard-offsets.py`. This explicitly handles southern-hemisphere DST and negative DST conventions. The horizontal coordinate is apparent minus mean solar time in minutes, calculated using apparent sidereal time and geocentric solar right ascension of date. The vertical coordinate is solar declination of date. The analemma cross marks the selected calendar day's fixed-noon sample.

[Ephemeris methods](https://github.com/cosinekitty/astronomy/blob/master/source/js/README.md) · [IANA time zones](https://www.iana.org/time-zones) · [City catalog](https://github.com/kevinroberts/city-timezones)

## Chart reuse

`astronomy.mjs` returns data without page coordinates. `geometry.mjs` exports `chartGeometry(report, {sparse})` with a local coordinate system, dimensions, named vector groups, individually named traces, phase symbols, marker types, labels and an optional legend. The month/year and coordinates belong to its heading layer. `pages.mjs` places those groups on each sheet and adds page-specific notes, margins and footers. PDF export renders the same SVG page descriptions used by the preview. Plaque export and physical print validation are deferred.

## Checks

```sh
npm test
npm run test:e2e
npm run build
```

The browser tests require installed Google Chrome and Poppler's `pdftoppm` on PATH. Set `BROWSER_CHANNEL=msedge` to use Edge. The browser suite opens the app in a Tokyo-zone browser, searches for the Georgia location, confirms the form, inspects all three tabs, downloads the PDF and opens it with Poppler to render all three pages. It also exercises the New York DST gap and fold. The calculation suite covers the reference snapshot, a Sydney leap day, a DST-changing month, polar night in Longyearbyen, the skipped Apia calendar day, and simultaneous birth/new-moon rows.


The [reference verification record](VERIFICATION.md) includes the independent PyEphem comparison, the midnight boundary, all displayed differences from the supplied table and reproducibility instructions.
