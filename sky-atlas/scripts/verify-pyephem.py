"""Cross-check the reference report or one of the Atlanta rendering regressions."""
import argparse
import json
import subprocess
from datetime import datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo
import ephem

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument("date", nargs="?", default="1987-07-14",
                    choices=["1987-07-14", "1989-09-01", "1989-10-13"])
date = parser.parse_args().date
overrides = {} if date == "1987-07-14" else dict(date=date, lat=33.83001385, lon=-84.39994938, place="Atlanta")
command = "import {calculate,referenceInput} from './astronomy.mjs'; console.log(JSON.stringify(calculate({...referenceInput,...JSON.parse(process.argv[1])})))"
report = json.loads(subprocess.check_output(["node", "--input-type=module", "-e", command,json.dumps(overrides)], cwd=root))
zone = ZoneInfo(report["input"]["zone"])
observer = ephem.Observer()
observer.lat, observer.lon = str(report["input"]["lat"]), str(report["input"]["lon"])
observer.elevation = observer.pressure = 0
start = datetime.fromisoformat(date).replace(day=1,tzinfo=zone)

def as_local(t):
    return t.datetime().replace(tzinfo=timezone.utc).astimezone(zone)

def minute(dt):
    return (dt + timedelta(seconds=30)).strftime("%H:%M")

pairs, differences, phase_results = [], [], []
for row in report["days"]:
    date = start + timedelta(days=row["day"]-1)
    observer.date = date.astimezone(timezone.utc)
    for key, events in row["events"].items():
        twilight = key in ("dawn", "dusk")
        observer.horizon = "-6" if twilight else "-0:34"
        body = ephem.Moon() if key.startswith("moon") else ephem.Sun()
        search = observer.next_rising if key in ("dawn", "rise", "moonrise") else observer.next_setting
        dt = as_local(search(body, use_center=twilight))
        assert len(events) == int(dt.date() == date.date()), (date, key, dt, events)
        if events:
            event = events[0]
            delta = event["ms"]/1000 - dt.timestamp()
            pairs.append(abs(delta))
            if event["time"] != minute(dt):
                differences.append([date.day,key,event["time"],minute(dt)])
functions = [ephem.next_new_moon, ephem.next_first_quarter_moon, ephem.next_full_moon, ephem.next_last_quarter_moon]
for p in report["phases"]:
    dt = as_local(functions[p["quarter"]]((start+timedelta(days=p["day"]-2)).astimezone(timezone.utc)))
    assert dt.day == p["day"]
    phase_results.append([p["name"],p["time"],minute(dt),round(p["ms"]/1000-dt.timestamp(),1)])
observer.date = start.astimezone(timezone.utc)
observer.horizon = "-0:34"
boundary = as_local(observer.previous_setting(ephem.Moon()))
print(json.dumps(dict(pyephem=ephem.__version__,paired=len(pairs),maximum_seconds=round(max(pairs),1),
    different_rounded_events=differences, phases=phase_results, preceding_moonset=boundary.isoformat()),indent=2))

