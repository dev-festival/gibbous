"""Build January 1 standard-offset runs for the fixed-noon analemma."""
from datetime import datetime
from zoneinfo import ZoneInfo, available_timezones
from pathlib import Path
import json
import tzdata

offsets = {}
for name in sorted(available_timezones()):
    zone = ZoneInfo(name)
    runs = []
    for year in range(1900, 2101):
        sample = datetime(year, 1, 1, 12, tzinfo=zone)
        minutes = (sample.utcoffset() - sample.dst()).total_seconds() / 60
        if not runs or runs[-1][1] != minutes:
            runs.append([year, minutes])
    offsets[name] = runs
Path(__file__).resolve().parents[1].joinpath("standard-offsets.json").write_text(
    json.dumps({"version": tzdata.IANA_VERSION, "zones": offsets}, separators=(",", ":"))
)
