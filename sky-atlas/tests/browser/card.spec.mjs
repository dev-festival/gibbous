import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';

for (const [tab,width] of [['Calendar',194],['Artist reference',150]]) {
  test(tab+' exports a closed, face-up two-height card',async({page})=>{
    await page.goto('/');
    await page.locator('#tabs').getByRole('button',{name:tab,exact:true}).click();
    const pending=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download card STL'}).click();
    const download=await pending;
    mkdirSync('output/stl',{recursive:true});
    const path='output/stl/'+download.suggestedFilename();
    await download.saveAs(path);
    const stl=readFileSync(path), count=stl.readUInt32LE(80);
    expect(stl.length).toBe(84+count*50);
    const edges=new Map(), heights=new Set();
    let maxX=0,maxY=0;
    for(let i=0;i<count;i++){
      const tri=[];
      for(let j=0;j<3;j++){
        const p=96+i*50+j*12;
        const x=stl.readFloatLE(p),y=stl.readFloatLE(p+4),z=stl.readFloatLE(p+8);
        maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);heights.add(z.toFixed(1));
        tri.push([x,y,z].join(','));
      }
      for(let j=0;j<3;j++){
        const a=tri[j],b=tri[(j+1)%3],key=a<b?a+'/'+b:b+'/'+a;
        const edge=edges.get(key)??{count:0,balance:0};
        edge.count++;edge.balance+=a<b?1:-1;edges.set(key,edge);
      }
    }
    expect([maxX,maxY]).toEqual([width,238]);
    expect([...heights].sort()).toEqual(['0.0','2.0','2.6']);
    expect([...edges.values()].filter(e=>e.count!==2||e.balance!==0).length).toBe(0);
  });
}
