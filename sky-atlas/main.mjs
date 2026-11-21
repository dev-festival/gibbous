import {calculate,referenceInput,possibleInstants,local,zones} from './astronomy.mjs';
import {pages,pageNames} from './pages.mjs';
import {coordinates} from './geometry.mjs';
import cities from 'city-timezones/data/cityMap.json';
const el=id=>document.getElementById(id);
let report, selected=0, cityChosen=true, matchButtons=[];
const catalog=[{city:'Lawrenceville',province:'Georgia',country:'USA',lat:referenceInput.lat,lng:referenceInput.lon,timezone:referenceInput.zone},...cities.filter(c=>zones.includes(c.timezone))];
const placeName=c=>[c.city,c.province,c.country].filter(Boolean).join(', ');
const tabButtons=[...el('tabs').querySelectorAll('button')];
function selectPage(n){
  selected=n;
  [...el('sheets').children].forEach((s,i)=>s.toggleAttribute('hidden',i!==n));
  tabButtons.forEach((b,i)=>i===n?b.setAttribute('aria-current','page'):b.removeAttribute('aria-current'));
  el('pageLabel').textContent=pageNames[n];
}
tabButtons.forEach((b,i)=>b.onclick=()=>selectPage(i));
function showReport(input,example=false){
  const next=calculate(input);
  const svgs=pages(next);
  el('sheets').innerHTML=svgs.join('');
  report=next;
  el('kind').textContent=example?'REFERENCE PREVIEW':'YOUR REPORT';
  el('reportTitle').textContent=next.monthName+' '+next.year;
  selectPage(0);
  el('status').textContent='Three-page report ready for '+input.place+'.';
}
function clearResults(){el('matches').replaceChildren();matchButtons=[];}
function details(){
  el('coords').textContent=coordinates({lat:+el('lat').value,lon:+el('lon').value});
  el('timezone').textContent=el('zone').value;
}
function setCity(c){
  el('city').value=c.city;
  el('lat').value=c.lat;el('lon').value=c.lng;el('zone').value=c.timezone;
  el('place').textContent=placeName(c);cityChosen=true;el('confirm').checked=false;
  clearResults();details();checkClock();
}
function checkClock(){
  const instants=possibleInstants(el('date').value,el('time').value,el('zone').value);
  const repeated=instants.length===2;
  el('fold').hidden=!repeated;
  el('occurrence').required=repeated;
  el('occurrence').replaceChildren(new Option('Choose occurrence',''));
  if(repeated) instants.forEach((ms,j)=>el('occurrence').add(new Option((j?'Second':'First')+' · '+local(ms,el('zone').value).format('z (Z)')+' · '+new Date(ms).toISOString().slice(11,16)+' UTC',String(j))));
  el('error').textContent=(!instants.length && el('date').value && el('time').value)?'This local time was skipped or is invalid. Enter a valid time.':'';
}
zones.forEach(z=>el('zone').add(new Option(z,z)));
el('city').oninput=()=>{
  cityChosen=false;el('confirm').checked=false;el('place').textContent='Select a city or enter coordinates';el('coords').textContent='';el('timezone').textContent='';
  clearResults();
  const q=el('city').value.trim().toLowerCase();
  if(!q)return;
  const terms=q.split(/[\s,]+/).filter(Boolean);
  const matches=catalog.filter(c=>terms.every(t=>(placeName(c)+' '+c.city_ascii+' '+c.iso2).toLowerCase().includes(t))).sort((a,b)=>Number(b.city.toLowerCase()===q)-Number(a.city.toLowerCase()===q)||(b.pop||0)-(a.pop||0)).slice(0,12);
  for(const c of matches){
    const b=document.createElement('button');b.type='button';b.textContent=placeName(c);b.onclick=()=>setCity(c);matchButtons.push(b);el('matches').append(b);
  }
  if(!matches.length)el('matches').textContent='No city found. Enter coordinates and a time zone below.';
};
el('city').onkeydown=e=>{if(e.key==='ArrowDown'&&matchButtons.length){e.preventDefault();matchButtons[0].focus();}};
for(const id of ['lat','lon','zone']) el(id).oninput=()=>{
  el('place').textContent='Manual coordinates';cityChosen=true;el('city').value='';el('confirm').checked=false;clearResults();details();checkClock();
};
for(const id of ['date','time']) el(id).oninput=checkClock;
el('form').oninput=()=>{if(report)el('kind').textContent='PREVIOUS PREVIEW';};
el('form').onsubmit=e=>{
  e.preventDefault();
  if(!cityChosen){el('error').textContent='Choose a birthplace result or enter coordinates manually.';return;}
  try{
    showReport({date:el('date').value,time:el('time').value,zone:el('zone').value,lat:el('lat').valueAsNumber,lon:el('lon').valueAsNumber,place:el('place').textContent,occurrence:el('occurrence').value===''?undefined:Number(el('occurrence').value)});
    el('error').textContent='';
  }catch(e){el('error').textContent=e.message||String(e);}
};
el('download').onclick=async()=>{
  const button=el('download'), captured=report;
  button.disabled=true;
  try{
    const {jsPDF}=await import('jspdf');
    await import('svg2pdf.js');
    const doc=new jsPDF({unit:'pt',format:'letter',compress:true,putOnlyUsedFonts:true});
    doc.setProperties({title:captured.monthName+' '+captured.year+' | Birth sky atlas',creator:'Gibbous'});
    // Render from the captured report even if the user switches tabs during export.
    const holder=document.createElement('div');holder.style.cssText='position:fixed;left:-5000px;top:0;width:742px;pointer-events:none';
    holder.innerHTML=pages(captured).join('');document.body.append(holder);
    try{
      for(const [i,svg] of [...holder.children].entries()){
        if(i)doc.addPage('letter');
        await doc.svg(svg,{x:0,y:0,width:612,height:792});
      }
    }finally{holder.remove();}
    doc.save('Gibbous-'+captured.input.date+'.pdf');
    el('status').textContent='Three-page PDF downloaded.';
  }catch(e){el('error').textContent='PDF export failed: '+(e.message||e);}
  finally{button.disabled=false;}
};
setCity(catalog[0]);
showReport(referenceInput,true);

