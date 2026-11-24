export const ink='#151a1e', slate='#485663', grid='#c7ced3';
export const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export const num=n=>Number(n.toFixed(3));
export const line=(x1,y1,x2,y2,style='')=>`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" ${style}/>`;
export const txt=(x,y,s,size=10,style='')=>`<text x="${x}" y="${y}" font-size="${size}" ${style}>${esc(s)}</text>`;
export const mono='font-family="monospace"';
export const center='text-anchor="middle"';
export const bold='font-weight="bold"';
const circ=(x,y,r,fill)=>`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${ink}" stroke-width="1"/>`;
const cross=(x,y,r)=>line(x-r,y,x+r,y)+line(x,y-r,x,y+r);
const group=(id,body)=>`<g data-layer="${id}">${body}</g>`;
const point=(x,y)=>num(x)+' '+num(y);
const pad=n=>String(n).padStart(2,'0');
export function coordinates(i) {
  return Math.abs(i.lat).toFixed(4)+'° '+(i.lat<0?'S':'N')+'   /   '+Math.abs(i.lon).toFixed(4)+'° '+(i.lon<0?'W':'E');
}
export const styles={moonrise:'stroke-width="2.1"',moonset:'stroke-width="1.8" stroke-dasharray="5 3"',rise:'stroke-width="1.1"',set:'stroke-width="1.1"',dawn:'stroke-width=".9" stroke-dasharray="1 2.5"',dusk:'stroke-width=".9" stroke-dasharray="1 2.5"'};

// Interpolate clock hour as a function of day. Each cubic ends at the measured
// time; the harmonic mean of adjoining slopes prevents overshoot at a bend.
function smoothRun(samples,x,y) {
  const slopes=samples.slice(1).map((p,i)=>(p.hour-samples[i].hour)/(p.day-samples[i].day));
  function tangent(i) {
    if(i===0)return slopes[0];
    if(i===samples.length-1)return slopes[i-1];
    const left=slopes[i-1], right=slopes[i];
    return left*right>0?2*left*right/(left+right):0;
  }
  let path='';
  for(let i=1;i<samples.length;i++){
    const a=samples[i-1], b=samples[i], third=(b.day-a.day)/3;
    path+=' C '+point(x(a.hour+third*tangent(i-1)),y(a.day+third))
      +' '+point(x(b.hour-third*tangent(i)),y(b.day-third))
      +' '+point(x(b.hour),y(b.day));
  }
  return path;
}

function eventTrace(days,key,x,y) {
  let path='', dots='',run=[];
  function flush(){
    if(run.length===1)dots+=circ(x(run[0].hour),y(run[0].day),0.8,ink);
    if(run.length)path+=smoothRun(run,x,y);
    run=[];
  }
  for(const row of days){
    const events=row.events[key];
    if(events.length!==1){
      flush();
      for(const ev of events)dots+=circ(x(ev.hour),y(row.day),0.8,ink);
      continue;
    }
    const ev=events[0], prev=run.at(-1);
    if(prev){
      const shift=(ev.offsetMinutes-prev.offsetMinutes)/60;
      const drift=ev.hour-shift-prev.hour;
      const before=prev.hour+drift/2, after=before+shift;
      if(Math.abs(drift)>=12||Math.min(before,after)<0||Math.max(before,after)>24){
        flush();
      }else if(shift){
        // Rows denote calendar dates. Place the discrete clock change between
        // the two event rows; its signed width is the actual offset difference.
        const day=(prev.day+ev.day)/2;
        run.push({day,hour:before});
        flush();
        path+=' H '+num(x(after));
        run.push({day,hour:after});
      }
    }
    if(!run.length)path+=' M '+point(x(ev.hour),y(row.day));
    run.push(ev);
  }
  flush();
  return `<path data-trace="${key}" d="${path}" stroke="${ink}" fill="none" ${styles[key]}/>`+dots;
}
export function phaseSymbol(x,y,r,lit,angle) {
  const sign=angle<180?1:-1, boundary=1-2*lit/100, pts=[];
  for(const side of [1,0]) for(let j=0;j<=32;j++){
    const a=-Math.PI/2+Math.PI*(side?j:32-j)/32;
    pts.push(point(x+sign*r*Math.cos(a)*(side?1:boundary),y+r*Math.sin(a)));
  }
  return circ(x,y,r,ink)+`<path d="M ${pts.join(' L ')} Z" fill="white"/>`+circ(x,y,r,'none');
}
export function chartLegend(birthDay,shortMonth,isBirth=true) {
  const entries=[['Moonrise',line(0,0,30,0,styles.moonrise)],['Moonset',line(0,0,30,0,styles.moonset)],['Sunrise / sunset',line(0,0,30,0,styles.rise)],['Civil dawn / dusk',line(0,0,30,0,styles.dawn)],[isBirth?'Birth moment':'Event moment',cross(14,0,5)],['New moon',circ(14,0,4.5,ink)],['Lunar phase',phaseSymbol(5,0,4,0,0)+phaseSymbol(16,0,4,50,90)+phaseSymbol(27,0,4,100,180)]];
  return group('legend',txt(0,0,'CHART KEY',14,bold)+entries.map(([name,icon],i)=>`<g transform="translate(0 ${32+i*38.5})">${icon}${txt(41,3,name,10.5)}</g>`).join('')+txt(0,314,'SOLAR ANALEMMA',10,bold)+['Horizontal · equation of time','Vertical · solar declination',`Cross · ${shortMonth} ${birthDay} noon sample`].map((s,i)=>txt(0,336+i*17,s,9.5,`fill="${slate}"`)).join(''));
}
// Local chart coordinates, independent of sheet dimensions, translation and footer.
export function chartGeometry(r,{sparse=false}={}) {
  const {days,birth,phases,input}=r, last=days.length;
  const x=h=>62+h*275/24, y=d=>140+(d-1)*549/(last-1);
  const newMoons=phases.filter(p=>p.quarter===0);
  const special=new Set([1,7,14,21,last,birth.day,...newMoons.map(p=>p.day)]);
  let axes='',labels='',icons='',markers='',traces='';
  for(const h of [0,6,12,18,24]){
    axes+=line(x(h),135,x(h),695,`style="stroke:${h%24?grid:slate};stroke-width:.7"`);
    labels+=txt(x(h),125,pad(h),9,mono+' '+center);
  }
  for(const row of days){
    const d=row.day, yy=y(d), isNew=newMoons.some(p=>p.day===d);
    axes+=line(59,yy,65,yy,`style="stroke:${slate};stroke-width:.6"`);
    if(special.has(d)) axes+=line(62,yy,337,yy,`style="stroke:${grid};stroke-width:.7"`);
    if(!sparse||special.has(d)) labels+=txt(50,yy+3,pad(d),8.5,mono+' text-anchor="end"');
    const phase=isNew?{lit:0,angle:0}:birth.day===d?birth:row.noon;
    if(phase&&(!sparse||special.has(d)||[4,10,17,25,28].includes(d))){
      icons+=phaseSymbol(18,yy,5.4,phase.lit,phase.angle);
      if(isNew&&birth.day===d) icons+=phaseSymbol(33,yy,4,birth.lit,birth.angle);
    }
  }
  for(const key of Object.keys(styles))traces+=eventTrace(days,key,x,y);
  const bx=x(birth.hour), by=y(birth.day);
  markers+=`<g data-marker="birth">${cross(bx,by,6)}</g>`;
  labels+=txt(346,by+(newMoons.some(p=>p.day===birth.day)?-4:2),birth.time,8.5,mono);
  for(const p of newMoons){
    markers+=`<g data-marker="new-moon">${circ(x(p.hour),y(p.day),4.4,ink)}</g>`;
    labels+=txt(346,y(p.day)+(p.day===birth.day?8:2),p.time,8.5,mono);
  }
  // Fixed scales retain physical orientation and proportions across years.
  const ax=p=>413+p.eot*2.55, ay=p=>414-p.dec*11.03;
  const sample=r.annual.find(p=>p.date===input.date);
  const analemma=`<path data-trace="analemma" d="M ${r.annual.map(p=>point(ax(p),ay(p))).join(' L ')} Z" fill="none" stroke="${ink}" stroke-width="1.45"/><g data-marker="fixed-noon">${cross(ax(sample),ay(sample),4.5)}</g>`;
  const seconds=Math.round(Math.abs(r.standard)*60);
  const clock=(r.standard<0?'-':'+')+pad(Math.floor(seconds/3600))+':'+pad(Math.floor(seconds/60)%60)+(seconds%60?':'+pad(seconds%60):'');
  labels+=txt(18,108,'PHASE',10,center+' '+bold)+txt(200,108,'LOCAL TIME  /  '+r.abbrs,10,center+' '+bold)+txt(415,108,'ANALEMMA',10,center+' '+bold)+txt(415,713,r.year+' / 12:00 UTC'+clock,7.8,center+' '+mono);
  const title=[r.monthName.toUpperCase().split('').join(' '),'/',String(r.year).split('').join(' ')].join('    ');
  const heading=txt(0,30,title,r.monthName.length>7?31:37,'font-family="serif" xml:space="preserve"')+txt(0,63,coordinates(input),13,mono+' xml:space="preserve"')+line(0,83,466,83);
  return {width:466,height:721,layers:{heading:group('heading',heading),axes:group('axes',axes),traces:group('traces',traces),phaseSymbols:group('phase-symbols',icons),labels:group('labels',labels),markers:group('markers',markers),analemma:group('analemma',analemma)},legend:chartLegend(birth.day,r.monthName.slice(0,3),(input.eventType??'Birth')==='Birth')};
}

