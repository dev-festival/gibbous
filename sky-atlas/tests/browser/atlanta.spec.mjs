import {test,expect} from '@playwright/test';
import {mkdirSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {decode} from 'fast-png';

// Compare dark ink only. White paper would conceal displaced traces in an
// ordinary whole-page similarity score. Allow two pixels for rasterization.
function inkCoverage(source,target,left) {
  const luminance=(im,x,y)=>{
    const k=(y*im.width+x)*im.channels;
    return .299*im.data[k]+.587*im.data[k+1]+.114*im.data[k+2];
  };
  let count=0, matched=0;
  for(let y=200;y<=749;y++)for(let x=left+2;x<=left+273;x++){
    if(luminance(source,x,y)>=140)continue;
    count++;
    let found=false;
    for(let dy=-2;dy<=2&&!found;dy++)for(let dx=-2;dx<=2;dx++){
      if(luminance(target,x+dx,y+dy)<200){found=true;break;}
    }
    if(found)matched++;
  }
  expect(count).toBeGreaterThan(1500);
  return matched/count;
}

for(const date of ['1989-09-01','1989-10-13']){
  test('Atlanta preview and downloaded chart ink agree for '+date,async({page},info)=>{
    await page.setViewportSize({width:1600,height:1100});
    await page.goto('/');
    await page.locator('#city').fill('Atlanta');
    await page.locator('#matches button').filter({hasText:'Georgia'}).click();
    await page.locator('#date').fill(date);
    await page.locator('#confirm').check();
    await page.getByRole('button',{name:'Generate report'}).click();
    await expect(page.locator('#kind')).toHaveText('YOUR REPORT');
    await page.addStyleTag({content:'#sheets > svg {width:742px!important;height:960px!important;max-width:none!important}'});
    const download=page.waitForEvent('download');
    await page.getByRole('button',{name:'Download PDF'}).click();
    mkdirSync('output/pdf',{recursive:true});
    const file='output/pdf/Atlanta-'+date+'.pdf';
    await (await download).saveAs(file);
    const prefix=info.outputPath('pdf');
    execFileSync('pdftoppm',['-png','-scale-to','960',file,prefix]);
    for(const [i,name] of ['Calendar','Artist reference','Source data'].entries()){
      await page.locator('#tabs').getByRole('button',{name,exact:true}).click();
      const sheet=page.locator('#sheets > svg').nth(i);
      const preview=decode(await sheet.screenshot({path:info.outputPath('preview-'+(i+1)+'.png'),
        style:'#sheets > svg {position:fixed;top:0;left:0;z-index:10}'}));
      const printed=decode(readFileSync(prefix+'-'+(i+1)+'.png'));
      expect([preview.width,preview.height,printed.width,printed.height]).toEqual([742,960,742,960]);
      if(i===2){await expect(sheet).toContainText('horizon times matched');continue;}
      const left=i===0?134:207;
      expect(inkCoverage(preview,printed,left)).toBeGreaterThan(.99);
      expect(inkCoverage(printed,preview,left)).toBeGreaterThan(.99);
    }
  });
}
