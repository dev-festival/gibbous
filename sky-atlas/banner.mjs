import {calculate, eventKeys, local, lunar, phaseName, possibleInstants, zones} from './astronomy.mjs';
import {chartGeometry, num, phaseSymbol, txt, mono, center} from './geometry.mjs';

const radius = 10;
const dateOffsets = Array.from({length: radius * 2 + 1}, (_, index) => index - radius);
const daySpacing = 41;
const hourTop = 16;
const hourHeight = 116;
const hourBottom = hourTop + hourHeight;

export function startBanner(findCities, placeName) {
  const el = id => document.getElementById(id);
  const chart = el('chart-data');
  const locate = el('banner-locate');
  const choose = el('banner-choose');
  const search = el('banner-search');
  const city = el('banner-city');
  const matches = el('banner-matches');
  const message = el('banner-message');
  const monthly = new Map();
  let location, locationRequest = 0;
  let renderedMinute, renderedZone;

  function zoneForDevice() {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zones.includes(zone) ? zone : 'UTC';
  }

  function traces(dates, nowPhase, zone) {
    const needed = new Set(dates.map(date => date.format('YYYY-MM')));
    for (const month of monthly.keys()) if (!needed.has(month)) monthly.delete(month);
    const days = dates.map((date, index) => {
      const month = date.format('YYYY-MM');
      if (!monthly.has(month)) {
        monthly.set(month, calculate({...location, zone, date: month+'-15', time: '12:00', occurrence: 0}));
      }
      const day = index + 1;
      const source = monthly.get(month).days[date.date() - 1];
      const events = Object.fromEntries(eventKeys.map(key => [key,
        key.startsWith('moon') ? source.events[key].map(event => ({...event, day})) : []]));
      return {day, noon: source.noon, events};
    });
    const report = monthly.values().next().value;
    const birth = {...report.birth, ...nowPhase, day: radius + 1};
    const layer = chartGeometry({...report, days, birth, phases: []}).layers.traces;
    const dayScale = daySpacing * (days.length - 1) / 549;
    const hourScale = hourHeight / 275;
    return `<g class="atlas-traces" transform="matrix(0 ${hourScale} ${dayScale} 0 ${-414.5 * dayScale} ${hourTop - 62 * hourScale})">${layer}</g>`;
  }

  function refresh(force = false) {
    const time = Date.now();
    const minute = Math.floor(time / 60000);
    const zone = location?.zone ?? zoneForDevice();
    const renderKey = zone + ':' + minute;
    if (!force && renderedMinute === renderKey) return;
    if (zone !== renderedZone) monthly.clear();
    const today = local(minute * 60000, zone);
    const nowPhase = lunar(today.valueOf());
    const dates = dateOffsets.map(offset => today.clone().add(offset, 'day'));
    const markers = dates.map((date, index) => {
      const offset = dateOffsets[index];
      const x = daySpacing * offset;
      const noon = possibleInstants(date.format('YYYY-MM-DD'), '12:00', zone)[0];
      const phase = offset === 0 ? nowPhase : noon === undefined ? null : lunar(noon);
      return `<path class="atlas-day-rule" d="M${x} ${hourTop}V${hourBottom}" stroke="#aeb7bd" stroke-width=".8"/>` +
        (phase ? phaseSymbol(x, 161, offset === 0 ? 9 : 6.8, phase.lit, phase.angle) : '') +
        txt(x, 181, date.format('DD MMM').toUpperCase(), 11, `${mono} ${center} class="chart-date" fill="#485663"`);
    }).join('');
    const nowY = num(hourTop + (today.hour() * 60 + today.minute()) * hourHeight / 1440);
    let lines = '';
    if (location) {
      try { lines = traces(dates, nowPhase, zone); }
      catch {
        message.textContent = 'Rise and set times are unavailable for this location.';
      }
    }
    chart.innerHTML = markers + lines + `<g id="chart-now" fill="#45647a">
      <path class="atlas-day-rule" d="M0 ${hourTop}V${hourBottom}" stroke="#45647a" stroke-width="1.25"/>
      <circle cy="${nowY}" r="3.5" stroke="white" stroke-width="1"/>
    </g>` + txt(0, 145, 'NOW · '+today.format('HH:mm'), 10, `${mono} ${center} fill="#45647a" font-weight="bold"`);
    chart.querySelectorAll('[data-trace]').forEach(trace => trace.setAttribute('vector-effect','non-scaling-stroke'));
    el('banner-legend').hidden = !lines;
    el('clock').dateTime = today.format();
    el('clock').textContent = 'NOW · ' + today.format('DD MMM YYYY · HH:mm z').toUpperCase();
    el('phase').textContent = phaseName(nowPhase.angle)+' · '+nowPhase.lit.toFixed(1)+'% illuminated';
    renderedMinute = renderKey;
    renderedZone = zone;
  }

  function setLocation(next) {
    ++locationRequest;
    locate.disabled = false;
    location = next;
    monthly.clear();
    el('banner-place').textContent = next.place;
    message.textContent = '';
    search.hidden = true;
    choose.setAttribute('aria-expanded', 'false');
    refresh(true);
  }

  choose.onclick = () => {
    search.hidden = !search.hidden;
    choose.setAttribute('aria-expanded', String(!search.hidden));
    if (!search.hidden) city.focus();
  };
  search.onkeydown = event => {
    if (event.key === 'Escape') { choose.click(); choose.focus(); }
  };
  city.oninput = () => {
    matches.replaceChildren();
    if (!city.value.trim()) return;
    const results = findCities(city.value);
    for (const result of results) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = placeName(result);
      button.onclick = () => {
        setLocation({lat: result.lat, lon: result.lng, zone: result.timezone, place: placeName(result)});
        choose.focus();
      };
      matches.append(button);
    }
    if (!results.length) matches.textContent = 'No matching city.';
  };
  locate.onclick = () => {
    const request = ++locationRequest;
    const unavailable = () => {
      if (locationRequest !== request) return;
      locate.disabled = false;
      message.textContent = 'Location unavailable. Choose a city for rise and set times.';
    };
    if (!navigator.geolocation) { unavailable(); return; }
    locate.disabled = true;
    message.textContent = 'Finding your location…';
    navigator.geolocation.getCurrentPosition(({coords}) => {
      if (locationRequest !== request) return;
      setLocation({
        lat: Number(coords.latitude.toFixed(2)),
        lon: Number(coords.longitude.toFixed(2)),
        place: 'Current location'
      });
    }, unavailable, {enableHighAccuracy: false, timeout: 10000, maximumAge: 300000});
  };

  function refreshOnMinute() {
    refresh();
    setTimeout(refreshOnMinute, 60000 - Date.now() % 60000);
  }
  refreshOnMinute();
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
}
