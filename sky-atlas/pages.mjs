import {chartGeometry,txt,line,mono,center,bold,ink,slate,esc} from './geometry.mjs';
import {eventKeys,local,referenceInput} from './astronomy.mjs';
export const pageNames=['Calendar and legend','Tattoo artist reference','Source data and verification'];
const pad=n=>String(n).padStart(2,'0');
function footer(i){
  const name=[pageNames[0],'Tattoo artist reference  /  reduced day labels and phase symbols','Calculation notes and verification'][i];
  return line(67,863,675,863,'style="stroke:#c7ced3;stroke-width:.7"')+txt(67,886,name,9.5,`fill="${slate}"`)+txt(675,886,pad(i+1)+' / 03',9,mono+' text-anchor="end"');
}
function calendar(r,sparse) {
  const chart=chartGeometry(r,{sparse});
  let s=`<g transform="translate(${sparse?145:72} 60)">${Object.values(chart.layers).join('')}</g>`;
  if(!sparse){
    const b=r.birth;
    s+=`<g transform="translate(552 203)">${chart.legend}</g>`;
    s+=txt(72,810,local(b.ms,r.input.zone).format('DD MMM  ·  HH:mm z').toUpperCase(),11,mono);
    s+=txt(72,832,b.name+'  /  Sun '+(b.sun.alt>=0?'above':'below')+' horizon  /  Moon '+(b.moon.alt>=0?'above':'below')+' horizon',10.5);
  }
  return s;
}
const deg=n=>(n>=0?'+':'')+n.toFixed(1)+'°';
function sourcePage(r) {
  const short=r.monthName.slice(0,3).toUpperCase(),b=r.birth,i=r.input;
  let s=txt(66,66,r.monthName.toUpperCase()+' '+r.year+'  /  SOURCE DATA',27,'font-family="serif"');
  s+=txt(66,94,'Daily horizon events in '+r.abbrs+'  ·  Phase illumination sampled at 12:00 local',11,`fill="${slate}"`);
  const cols=[67,135,220,307,393,478,565,655];
  [short,'DAWN','SUNRISE','SUNSET','DUSK','MOONRISE','MOONSET','LIT %'].forEach((h,j)=>s+=txt(cols[j],126,h,10,bold+(j?' '+center:'')));
  const isNew=d=>r.phases.some(p=>p.quarter===0&&p.day===d);
  const step=436/(r.days.length-1);
  for(const row of r.days){
    const y=149+(row.day-1)*step;
    if(row.day===b.day||isNew(row.day)) s+=`<rect x="61" y="${y-11}" width="618" height="14.5" fill="#e9eef0"/>`;
    const values=[pad(row.day),...eventKeys.map(k=>row.events[k].map(e=>e.time).join('/')||'—'),row.noon?row.noon.lit.toFixed(1):'—'];
    values.forEach((v,j)=>s+=txt(cols[j],y,v,v.length>8?7.8:9.5,mono+(j?' '+center:'')));
  }
  s+=txt(67,613,'PRIMARY PHASES  /  '+r.abbrs,11,bold);
  s+=txt(372,613,'BIRTH MOMENT  /  '+new Date(b.ms).toISOString().slice(11,16)+' UTC',11,bold);
  r.phases.forEach((p,j)=>s+=txt(67,631+j*15,pad(p.day)+' '+short+'  '+p.time+'   '+p.name,10,mono+' xml:space="preserve"'));
  const snap=['Sun   '+deg(b.sun.alt)+' altitude  /  '+b.sun.az.toFixed(1)+'° azimuth','Moon  '+deg(b.moon.alt)+' altitude  /  '+b.moon.az.toFixed(1)+'° azimuth',b.lit.toFixed(1)+'% illuminated  /  '+b.name.toLowerCase(),new Date(b.ms).toISOString().replace('T',' ').replace('.000Z',' UTC')];
  snap.forEach((a,j)=>s+=txt(372,631+j*15,a,10,mono+' xml:space="preserve"'));
  const notes=[
    'Astronomy Engine 2.1.19  ·  IANA zone '+i.zone+'  ·  sea-level, unobstructed horizon.',
    'Rise/set: upper limb, standard refraction (34 arcmin). Civil twilight: geometric solar center at -6°.',
    'Snapshot: geometric topocentric altitude; azimuth clockwise from north. Illumination: apparent disk fraction.',
    'Phase symbols: local noon, birth instant on birth day, conjunction on new-moon days.',
    isNew(b.day)?'Both symbols on birth row: new moon at left, birth disk at right. Dot = conjunction; cross = birth.':'Cross marks birth; dots mark conjunctions. Curves break at missing events and midnight wraps.',
    'Analemma: equation of time (minutes) vs. solar declination (degrees); noon at fixed Jan 1 standard offset.',
    'Events are assigned before rounding to minutes. + means rounded into next day; a dash means no event/sample.',
    ...(r.days.some(row=>Object.values(row.events).flat().some(ev=>ev.offsetMinutes!==b.offsetMinutes))
      ? ['Horizontal steps between daily samples show the change in local UTC offset.'] : []),
    ...(['date','time','zone','lat','lon'].every(k=>i[k]===referenceInput[k])
      ? ['PyEphem 4.2.1 check: 184 horizon events matched to the minute. Four phase times agreed within 46 seconds.',
         'First quarter and new moon rounded 1 minute later here. Preceding moonset: June 30, 23:59:39 EDT.',
         'Sources: Astronomy Engine (cosinekitty/astronomy) and rhodesmill.org/pyephem/rise-set.html.']
      : ['1989-09-01','1989-10-13'].includes(i.date) && i.time==='07:15' && i.zone==='America/New_York'
          && i.lat===33.83001385 && i.lon===-84.39994938
        ? [`PyEphem 4.2.1: all ${i.date==='1989-09-01'?178:184} horizon times matched to the minute. Four primary phases agreed within 47 seconds.`]
        : ['Independent source comparison has not been run for these birth details.'])
  ];
  notes.forEach((n,j)=>s+=txt(67,713+j*14,n,9.6,`fill="${slate}"`));
  return s;
}
export function pages(r){
  return pageNames.map((name,i)=>`<svg xmlns="http://www.w3.org/2000/svg" width="742" height="960" viewBox="0 0 742 960" role="img" aria-label="${esc(name)}" fill="${ink}" font-family="sans-serif"><rect width="742" height="960" fill="white"/>${i===2?sourcePage(r):calendar(r,i===1)}${footer(i)}</svg>`);
}

