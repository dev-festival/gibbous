import test from 'node:test';
import assert from 'node:assert/strict';
import {calculate,referenceInput,possibleInstants,local} from '../astronomy.mjs';
import {chartGeometry} from '../geometry.mjs';
import {pages} from '../pages.mjs';
const iso=ms=>new Date(ms).toISOString();
test('curve endpoints, monotonic control points, wraps and signed clock steps',()=>{
  for(const [date,lat,lon,zone,shift] of [
    ['1989-09-01',33.83001385,-84.39994938,'America/New_York',0],
    ['1989-10-13',33.83001385,-84.39994938,'America/New_York',-1],
    ['2024-03-10',33.83001385,-84.39994938,'America/New_York',1],
    ['2024-10-12',-31.55,159.08,'Australia/Lord_Howe',0.5],
  ]){
    const r=calculate({...referenceInput,date,lat,lon,zone});
    const traces=chartGeometry(r).layers.traces;
    for(const [,key,path] of traces.matchAll(/data-trace="(\w+)" d="([^"]*)"/g)){
      let x,y,steps=0;
      const endpoints=[];
      for(const [,op,args] of path.matchAll(/([MCH])([^MCH]*)/g)){
        const v=args.trim().split(/\s+/).map(Number);
        if(op==='H'){
          assert.ok(Math.abs(v[0]-x-275*shift/24)<.002);
          if(date==='1989-10-13')assert.ok(Math.abs(y-(140+27.5*549/30))<.002);
          x=v[0];steps++;continue;
        }
        if(op==='C'){
          for(const cx of [v[0],v[2]])assert.ok(cx>=Math.min(x,v[4])-.001&&cx<=Math.max(x,v[4])+.001);
          assert.ok(v[1]>y && v[3]>v[1] && v[5]>v[3]);
          assert.ok(v[5]-y<=549/(r.days.length-1)+.002);
          assert.ok(Math.abs(v[4]-x)<275/2);
        }
        [x,y]=v.slice(-2);
        endpoints.push([x,y]);
      }
      for(const row of r.days)for(const e of row.events[key]){
        assert.ok(endpoints.some(([px,py])=>Math.abs(px-(62+275*e.hour/24))<.001&&Math.abs(py-(140+(row.day-1)*549/(r.days.length-1)))<.001),key+' '+row.day);
      }
      if(!key.startsWith('moon') || date.startsWith('1989'))assert.equal(steps,Number(shift!==0));
    }
  }
});
test('Lawrenceville report matches the named acceptance values',()=>{
  const r=calculate(referenceInput),b=r.birth;
  assert.equal(iso(b.ms),'1987-07-14T11:15:00.000Z');
  assert.equal(b.hour,7.25);
  assert.deepEqual([b.lit,b.sun.alt,b.sun.az,b.moon.alt,b.moon.az,r.days[13].noon.lit].map(n=>n.toFixed(1)),['84.2','6.7','68.3','33.2','223.8','82.5']);
  assert.equal(b.name,'Waning gibbous');
  assert.deepEqual(r.phases.map(p=>[p.day,p.time]),[[4,'04:35'],[10,'23:33'],[17,'16:17'],[25,'16:38']]);
  assert.equal(r.days[0].events.moonset.length,0);
  assert.equal(r.standard,-300);
  assert.equal(r.annual.length,365);
  const a=chartGeometry(r).layers,c=chartGeometry(r,{sparse:true}).layers;
  for(const k of ['traces','markers','analemma','heading'])assert.equal(a[k],c[k]);
  assert.notEqual(a.phaseSymbols,c.phaseSymbols);
  assert.equal(pages(r).length,3);
});
test('Sydney leap February uses southern standard time for the analemma',()=>{
  const r=calculate({...referenceInput,date:'2024-02-29',time:'00:10',lat:-33.8688,lon:151.2093,zone:'Australia/Sydney'});
  assert.equal(iso(r.birth.ms),'2024-02-28T13:10:00.000Z');
  assert.equal(r.days.length,29);assert.equal(r.annual.length,366);assert.equal(r.standard,600);
  for(const row of r.days) for(const events of Object.values(row.events))for(const e of events)assert.equal(local(e.ms,r.input.zone).date(),row.day);
});
test('spring gap, both fall occurrences and a DST-changing month',()=>{
  const z='America/New_York';
  assert.deepEqual(possibleInstants('2024-03-10','02:30',z),[]);
  assert.deepEqual(possibleInstants('2024-11-03','01:30',z).map(iso),['2024-11-03T05:30:00.000Z','2024-11-03T06:30:00.000Z']);
  assert.throws(()=>calculate({...referenceInput,date:'2024-11-03',time:'01:30'}),/occurrence/);
  const r=calculate({...referenceInput,date:'2024-03-10',time:'03:30'});
  assert.match(r.abbrs,/EST\/EDT/);
  assert.ok(r.days[9].events.rise[0].hour-r.days[8].events.rise[0].hour>0.9);
});
test('polar night explicitly has missing solar events',()=>{
  const r=calculate({...referenceInput,zone:'Arctic/Longyearbyen',lat:78.2232,lon:15.6469,date:'2020-12-21'});
  assert.ok(r.days.every(d=>['rise','set','dawn','dusk'].every(k=>!d.events[k].length)));
  assert.ok(r.days.some(d=>d.events.moonrise.length));
  assert.ok(!pages(r).join('').includes('NaN'));
});
test('birth and conjunction on same date retain separate symbols and instants',()=>{
  const r=calculate({...referenceInput,date:'1987-07-25'});
  const g=chartGeometry(r).layers;
  assert.equal((g.phaseSymbols.match(/<circle/g)||[]).length,2*(r.days.length+1));
  assert.match(g.markers,/data-marker="birth"/);assert.match(g.markers,/data-marker="new-moon"/);
  assert.notEqual(r.birth.ms,r.phases.find(p=>p.quarter===0).ms);
});
test('range validation and a skipped local calendar day',()=>{
  assert.throws(()=>calculate({...referenceInput,date:'1899-01-01'}),/1900/);
  assert.throws(()=>calculate({...referenceInput,date:'2023-02-29'}),/valid/);
  assert.throws(()=>calculate({...referenceInput,lat:91}),/latitude/);
  const r=calculate({...referenceInput,zone:'Pacific/Apia',lat:-13.83,lon:-171.76,date:'2011-12-31'});
  assert.equal(r.days[29].noon,null);assert.equal(r.days[29].events.rise.length,0);
});

