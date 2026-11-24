import * as A from 'astronomy-engine';
import moment from 'moment-timezone';
import standards from './standard-offsets.json' with { type: 'json' };

export const referenceInput = {date:'1987-07-14', time:'07:15', lat:33.9562, lon:-83.9880, zone:'America/New_York', place:'Lawrenceville, Georgia, USA'};
export const eventKeys = ['dawn','rise','set','dusk','moonrise','moonset'];
export const phaseNames = ['New moon','First quarter','Full moon','Last quarter'];
export const zones = moment.tz.names().filter(z => standards.zones[z]);
const dayMS = 86400000;
const pad = n => String(n).padStart(2,'0');
export function possibleInstants(date, time, zone) {
  const rules = moment.tz.zone(zone);
  const wall = moment.utc(date+' '+time, 'YYYY-MM-DD HH:mm', true);
  if (!rules || !wall.isValid()) return [];
  return [...new Set(rules.offsets)].map(offset => Math.round(+wall + offset*60000))
    .filter(ms => moment.tz(ms,zone).format('YYYY-MM-DD HH:mm:ss') === date+' '+time+':00').sort((a,b)=>a-b);
}
export const local = (ms, zone) => moment.tz(ms,zone);
function stamp(ms, zone) {
  const civil = local(ms,zone);
  const withinMinute = civil.second()*1000+civil.millisecond();
  const rounded = local(ms-withinMinute+(withinMinute>=30000?60000:0),zone);
  const dayShift = rounded.format('YYYYMMDD') !== civil.format('YYYYMMDD');
  return {ms,day:civil.date(),offsetMinutes:civil.utcOffset(),time:rounded.format('HH:mm')+(dayShift?'+':''),hour:civil.hour()+civil.minute()/60+(civil.second()+civil.millisecond()/1000)/3600};
}
export function lunar(ms) {
  const t = new Date(ms);
  // Apparent geocentric Sun and Moon vectors form the Sun-Moon-observer triangle.
  const sun=A.GeoVector('Sun',t,true), moon=A.GeoVector('Moon',t,true);
  const toSun=new A.Vector(sun.x-moon.x,sun.y-moon.y,sun.z-moon.z,sun.t);
  const toEarth=new A.Vector(-moon.x,-moon.y,-moon.z,moon.t);
  const phase=A.AngleBetween(toSun,toEarth)*Math.PI/180;
  return {lit:50*(1+Math.cos(phase)), angle:A.MoonPhase(t)};
}
export function phaseName(angle) {
  for(let i=0;i<4;i++) if(Math.abs((angle-i*90+540)%360-180)<0.25) return phaseNames[i];
  return ['Waxing crescent','Waxing gibbous','Waning gibbous','Waning crescent'][Math.floor(angle/90)];
}
function horizontal(body,date,observer) {
  const eq = A.Equator(body,date,observer,true,true);
  const h = A.Horizon(date,observer,eq.ra,eq.dec,null);
  return {alt:h.altitude, az:h.azimuth};
}
function annual(year, offset) {
  const samples=[];
  for(let dt=Date.UTC(year,0,1);dt<Date.UTC(year+1,0,1);dt+=dayMS){
    const t=new Date(dt+(720-offset)*60000);
    const v=A.RotateVector(A.Rotation_EQJ_EQD(t),A.GeoVector('Sun',t,true));
    const eq=A.EquatorFromVector(v);
    const utcHour=((+t%dayMS+dayMS)%dayMS)/3600000;
    const diff=A.SiderealTime(t)-eq.ra+12-utcHour;
    samples.push({date:new Date(dt).toISOString().slice(0,10),dec:eq.dec,eot:(((diff+60)%24)-12)*60});
  }
  return samples;
}
export function calculate(input) {
  const {date,time,zone,lat,lon,occurrence}=input;
  const year=Number(date.slice(0,4));
  if(!zones.includes(zone) || year<1900 || year>2100) throw Error('Choose a listed time zone and a date from 1900 through 2100.');
  if(!Number.isFinite(lat)||Math.abs(lat)>90||!Number.isFinite(lon)||Math.abs(lon)>180) throw Error('Check latitude (−90 to 90) and longitude (−180 to 180).');
  const options=possibleInstants(date,time,zone);
  if(!options.length) throw Error('This local time does not exist. Choose a valid local date and time.');
  if(options.length>1 && ![0,1].includes(occurrence)) throw Error('Select the first or second occurrence of this local time.');
  const ms=options[options.length>1?occurrence:0], t=new Date(ms), observer=new A.Observer(lat,lon,0);
  const birth={...stamp(ms,zone),...lunar(ms),sun:horizontal('Sun',t,observer),moon:horizontal('Moon',t,observer)};
  birth.name=phaseName(birth.angle);
  const month=date.slice(0,7), first=moment.utc(month+'-01'), count=first.daysInMonth();
  const days=Array.from({length:count},(_,i)=>{
    const day=i+1, noon=possibleInstants(month+'-'+pad(day),'12:00',zone)[0];
    return {day,noon:noon===undefined?null:lunar(noon),events:Object.fromEntries(eventKeys.map(k=>[k,[]]))};
  });
  // Search in physical time. Assign the unrounded result to its civil calendar date.
  const begin=+first-2*dayMS, end=+first.clone().add(1,'month')+2*dayMS;
  for(const key of eventKeys){
    const dir=['rise','dawn','moonrise'].includes(key)?1:-1;
    const body=key.startsWith('moon')?'Moon':'Sun';
    for(let start=begin;start<end;){
      const limit=(end-start)/dayMS;
      const found=(key==='dawn'||key==='dusk')?A.SearchAltitude(body,observer,dir,new Date(start),limit,-6):A.SearchRiseSet(body,observer,dir,new Date(start),limit);
      if(!found) break;
      const instant=+found.date;
      if(local(instant,zone).format('YYYY-MM')===month){
        const ev=stamp(instant,zone); days[ev.day-1].events[key].push(ev);
      }
      start=instant+1000;
    }
  }
  const phases=[];
  for(let q=A.SearchMoonQuarter(new Date(begin));+q.time.date<end;q=A.NextMoonQuarter(q)){
    const instant=+q.time.date;
    if(local(instant,zone).format('YYYY-MM')===month) phases.push({...stamp(instant,zone),quarter:q.quarter,name:phaseNames[q.quarter]});
  }
  const standard=standards.zones[zone].filter(([y])=>y<=year).at(-1)[1];
  const abbrs=[...new Set(days.flatMap(({day})=>{const at=possibleInstants(month+'-'+pad(day),'12:00',zone);return at.length?[local(at[0],zone).zoneAbbr()]:[]}))].join('/');
  return {input:{...input},year,monthName:first.format('MMMM'),abbrs,standard,annual:annual(year,standard),birth,days,phases};
}

