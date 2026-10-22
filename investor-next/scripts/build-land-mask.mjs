#!/usr/bin/env node
/**
 * One-off, reproducible conversion of Natural Earth 1:110m land polygons
 * (public domain, https://www.naturalearthdata.com/about/terms-of-use/)
 * into a compact JSON ring list used to paint the globe texture.
 *
 * Usage: node scripts/build-land-mask.mjs <path-to-ne_110m_land.geojson>
 * Output: public/geo/land-110m.json  ({source, license, rings:[[lon,lat,...]]})
 * Coordinates are rounded to 0.1° — cartographic context only, never a navigation source.
 */
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const input=process.argv[2];
if(!input){console.error('Usage: node scripts/build-land-mask.mjs <ne_110m_land.geojson>');process.exit(2);}
const app=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const geo=JSON.parse(readFileSync(input,'utf8'));
const rings=[];
for(const feature of geo.features){
  const g=feature.geometry;
  const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
  for(const poly of polys){
    const outer=poly[0];
    const flat=[];
    let last='';
    for(const [lon,lat] of outer){
      const key=lon.toFixed(1)+','+lat.toFixed(1);
      if(key===last)continue;
      last=key;
      flat.push(Math.round(lon*10)/10,Math.round(lat*10)/10);
    }
    if(flat.length>=6)rings.push(flat);
  }
}
const out={source:'Natural Earth 1:110m land (ne_110m_land)',license:'Public domain — naturalearthdata.com/about/terms-of-use',precision:'0.1 degree, cartographic context only',rings};
mkdirSync(resolve(app,'public/geo'),{recursive:true});
writeFileSync(resolve(app,'public/geo/land-110m.json'),JSON.stringify(out));
console.log('rings',rings.length,'points',rings.reduce((n,r)=>n+r.length/2,0));
