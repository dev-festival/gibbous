# Lawrenceville verification

Input: 1987-07-14 07:15, America/New_York, 33.9562 N, 83.9880 W. Calculations are from the release's pinned Astronomy Engine dependency.

## Supplied PDF

All three reference pages were rendered before implementation. The three exported pages were opened with Poppler and visually inspected beside those reference renders. Checks included chart placement, wrap gaps, reference/artist-page trace registration, phase columns, markers, analemma, table rows and footers. A PDF reader confirmed three 612 × 792 point sheets with text and vector drawing commands.

Compared the displayed table values for all 31 dates. Of 184 paired horizon times, 181 matched the supplied PDF to the minute. Both missing events matched. All 31 daily noon illumination percentages matched to one decimal place.

| Local date and event | Generated | Supplied PDF |
|---|---:|---:|
| July 6 sunrise | 06:31 | 06:30 |
| July 7 moonrise | 17:32 | 17:31 |
| July 22 moonset | 18:50 | 18:51 |
| July 4 first quarter | 04:35 | 04:34 |

The other three primary phase times matched: July 10 at 23:33, July 17 at 16:17, and July 25 at 16:38 EDT. The birth crosshair is at 07:15 on July 14. The birth instant is 11:15 UTC, the Sun is at altitude +6.7° and azimuth 68.3°, and the Moon is at altitude +33.2° and azimuth 223.8°. The waning gibbous Moon is 84.2% illuminated at birth and 82.5% at noon.

## Independent ephemeris

Ran PyEphem 4.2.1 for every July horizon event at the specified coordinates and for all four primary phases. Used a sea-level observer, zero atmospheric pressure and a fixed -34 arcminute upper-limb horizon to model standard refraction; civil twilight uses the geometric solar center at -6°. [PyEphem's documented almanac conventions](https://rhodesmill.org/pyephem/rise-set.html)

All 184 paired horizon events agreed to the minute. The greatest unrounded difference was approximately 0.4 seconds. Both engines put the preceding moonset at **23:59:39 EDT on June 30**. It rounds to midnight on July 1, but belongs to June. July 1 therefore has no moonset in this report.

| Phase | Generated EDT | PyEphem EDT | Generated minus PyEphem, seconds |
|---|---:|---:|---:|
| First quarter | 04:35 | 04:34 | +42.0 |
| Full moon | 23:33 | 23:33 | +30.9 |
| Last quarter | 16:17 | 16:17 | +38.7 |
| New moon | 16:38 | 16:37 | +45.4 |

To repeat the independent calculation, install Python 3.10 or later and run the following from the project directory after installing the JavaScript dependencies.

```sh
python -m pip install ephem==4.2.1 tzdata
python scripts/verify-pyephem.py
```

The application prints the verification summary only for the supplied reference input. Generating a report never calls an external verification service.


## Atlanta curve and clock-change checks

Reproduced the September 1 and October 13, 1989 reports at 07:15 using the Atlanta catalog coordinates (33.83001385, -84.39994938), America/New_York. PyEphem 4.2.1 agreed with every displayed rise, set and civil twilight minute, including the missing-event dates. There were 178 paired events in September and 184 in October. The maximum absolute difference in each month rounded to 0.3 seconds. The four primary phase instants per month differed by 34.4 to 46.8 seconds. First quarter and new moon rounded one minute later in the September report; first quarter, last quarter and new moon rounded one minute later in October.

September moonrise advanced from 08:26 to 10:17 between September 1 and 3 (111 minutes over two days). Between September 15 and 18 it advanced from 19:47 to 21:34 (107 minutes over three days). This varying rate accounts for the broad curvature. The vector interpolation now passes through each unrounded event with a continuous tangent during ordinary runs. Missing events and midnight wraps split the curve. Clock-offset changes create a horizontal step halfway between adjacent event rows. This position represents the boundary between samples on the date axis. The signed step width represents the change in clock time. In Atlanta the step is one hour left between October 28 and 29.

The regression suite checks every plotted time, bounded cubic controls, wrap gaps and step width, including spring forward and Lord Howe Island’s half-hour shift. Chrome generated both Atlanta reports through the form and downloaded their PDFs. Poppler rendered all six pages. Both chart pages in each month passed a two-way dark-pixel comparison between the browser preview and exported PDF (greater than 99% within two pixels at a 742 × 960 page size, allowing for antialiasing).

Repeat the independent runs with:

```sh
python scripts/verify-pyephem.py 1989-09-01
python scripts/verify-pyephem.py 1989-10-13
```
