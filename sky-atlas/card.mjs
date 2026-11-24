import {contours} from 'd3-contour';
import earcut from 'earcut';

const base = 2, top = 2.6, pixelsPerMM = 8;

// Canvas coordinates have their origin at the upper left. The STL is face up
// and reads from the same side as the screen preview.
async function artwork(svg, artist) {
  const width = artist ? 150 : 194, height = 238;
  svg.removeAttribute('hidden');
  svg.setAttribute('viewBox', artist ? '125 36 510 797' : '53 38 654 804');
  svg.setAttribute('width', width * pixelsPerMM);
  svg.setAttribute('height', height * pixelsPerMM);
  svg.querySelector('rect').remove();
  const style = document.createElementNS(svg.namespaceURI, 'style');
  style.textContent = `
    line, path[stroke], circle { stroke: black !important; stroke-width: 1.7 !important; }
    [data-trace="moonrise"] { stroke-width: 3 !important; }
    [stroke-dasharray="1 2.5"] { stroke-dasharray: 2 3; }
    text { fill: black; font-weight: bold; }
    [data-layer="heading"] text:first-child { font-weight: normal; }
  `;
  svg.prepend(style);
  const canvas = document.createElement('canvas');
  canvas.width = width * pixelsPerMM;
  canvas.height = height * pixelsPerMM;
  const ctx = canvas.getContext('2d');
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(svg)], {type:'image/svg+xml'}));
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  } finally { URL.revokeObjectURL(url); }
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const mask = new Uint8Array(canvas.width * canvas.height);
  // Keep a continuous rim even for unusually long custom event names.
  for (let y = 16; y < canvas.height - 16; y++) {
    for (let x = 16; x < canvas.width - 16; x++) {
      const i = y * canvas.width + x;
      mask[i] = 255 - rgba[i * 4];
    }
  }
  const polys = contours().size([canvas.width, canvas.height]).contour(mask, 127.5).coordinates;
  return {width, height, polys};
}

function inside([x,y], ring) {
  let hit = false;
  for (let i=0,j=ring.length-1; i<ring.length; j=i++) {
    const [a,b]=ring[i], [c,d]=ring[j];
    if ((b>y)!==(d>y) && x<(c-a)*(y-b)/(d-b)+a) hit=!hit;
  }
  return hit;
}

export async function cardSTL(svg, artist) {
  const {width,height,polys} = await artwork(svg,artist);
  const plate = [[0,0],[width,0],[width,height],[0,height]];
  const faces = [], recesses = [], outlines = [];
  function cap(rings,z,up) {
    const points = rings.flat(), holes = [];
    let offset = rings[0].length;
    for (const ring of rings.slice(1)) { holes.push(offset); offset += ring.length; }
    const mesh = earcut(points.flat(),holes);
    for (let i=0; i<mesh.length; i+=3) {
      const order = up ? [i,i+1,i+2] : [i,i+2,i+1];
      faces.push(order.map(k=>[...points[mesh[k]],z]));
    }
  }
  function walls(ring,lo,hi) {
    ring.forEach(([x,y],i)=>{
      const [u,v]=ring[(i+1)%ring.length];
      faces.push([[x,y,lo],[u,v,lo],[u,v,hi]], [[x,y,lo],[u,v,hi],[x,y,hi]]);
    });
  }
  for (const poly of polys) {
    const rings = poly.map(closed=>{
      // Snap to a binary grid before triangulation so STL float32 vertices
      // and collinearity tests use exactly the same coordinates.
      const raw = closed.slice(0,-1).map(p=>p.map(n=>Math.round(n*1024)/1024));
      return raw.filter(([x,y],i)=>{
        const a=raw[(i+raw.length-1)%raw.length], b=raw[(i+1)%raw.length];
        return (x-a[0])*(b[1]-y)!==(y-a[1])*(b[0]-x);
      }).map(([x,y])=>[x/pixelsPerMM,height-y/pixelsPerMM]);
    });
    cap(rings,top,true);
    rings.forEach(r=>walls(r,base,top));
    outlines.push(rings[0]);
    for (const hole of rings.slice(1)) {
      const xs=hole.map(p=>p[0]), ys=hole.map(p=>p[1]);
      recesses.push({rings:[hole],left:Math.min(...xs),right:Math.max(...xs),bottom:Math.min(...ys),upper:Math.max(...ys)});
    }
  }
  // Assign islands to the innermost surrounding recess (e.g. text counters
  // or chart marks enclosed by intersecting traces).
  recesses.sort((a,b)=>(a.right-a.left)*(a.upper-a.bottom)-(b.right-b.left)*(b.upper-b.bottom));
  const field=[plate];
  for (const ring of outlines) {
    const [x,y]=ring[0];
    const owner=recesses.find(r=>x>r.left && x<r.right && y>r.bottom && y<r.upper && inside(ring[0],r.rings[0]));
    (owner?.rings ?? field).push(ring);
  }
  for (const r of recesses) cap(r.rings,base,true);
  cap(field,base,true);
  walls(plate,0,base);
  cap([plate],0,false);
  const bytes = new ArrayBuffer(84+50*faces.length), out=new DataView(bytes);
  out.setUint32(80,faces.length,true);
  faces.forEach(([a,b,c],i)=>{
    let pos=84+50*i;
    const u=b.map((v,k)=>v-a[k]), v=c.map((n,k)=>n-a[k]);
    const n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const length=Math.hypot(...n);
    for(const value of [...n.map(k=>k/length),...a,...b,...c]) {
      out.setFloat32(pos,value,true); pos+=4;
    }
  });
  return new Blob([bytes],{type:'model/stl'});
}
