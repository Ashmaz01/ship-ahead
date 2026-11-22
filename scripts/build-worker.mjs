import {build} from 'vite';
import fs from 'node:fs/promises';
import path from 'node:path';
const root='dist';
const assets={};
async function pack(dir){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())await pack(file);
    else assets['/'+path.relative(root,file)]=(await fs.readFile(file)).toString('base64');
  }
}
await pack(root);
await build({configFile:false,build:{ssr:'server/room.js',outDir:'dist/server',emptyOutDir:true,rollupOptions:{output:{entryFileNames:'rooms.js'}}}});
const rooms=await fs.readFile('dist/server/rooms.js','utf8');
await fs.writeFile('dist/server/index.js',rooms+'\nconst files='+JSON.stringify(assets)+';\n'+`
export default {async fetch(request,env){
 const pathname=new URL(request.url).pathname;
 if(pathname==='/api/rooms'||/^\\/api\\/rooms\\/[A-Z0-9]{8}$/.test(pathname))return roomRequest(request,env.DB);
 const file=pathname==='/'?'/index.html':pathname;
 const bytes=files[file];if(typeof bytes!=='string')return new Response('Not found',{status:404});
 const mime={html:'text/html',js:'text/javascript',css:'text/css',png:'image/png',mp4:'video/mp4',mp3:'audio/mpeg',webp:'image/webp',svg:'image/svg+xml'};
 const data=Uint8Array.from(atob(bytes),c=>c.charCodeAt(0));
 const headers={'Content-Type':mime[file.split('.').pop()]||'application/octet-stream','Cache-Control':file.startsWith('/assets/')?'public, max-age=31536000, immutable':'no-cache'};
 if(file.endsWith('.mp3')||file.endsWith('.mp4')){
   headers['Accept-Ranges']='bytes';
   const range=request.headers.get('Range');
   if(range){
     const match=/^bytes=([0-9]*)-([0-9]*)$/.exec(range);
     const start=match && match[1]?Number(match[1]):Math.max(0,data.length-Number(match?.[2]));
     const end=match && match[1] && match[2]?Math.min(Number(match[2]),data.length-1):data.length-1;
     if(!match||(!match[1]&&!match[2])||start>end)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+data.length}});
     headers['Content-Range']='bytes '+start+'-'+end+'/'+data.length;
     headers['Content-Length']=String(end-start+1);
     return new Response(request.method==='HEAD'?null:data.slice(start,end+1),{status:206,headers});
   }
 }
 headers['Content-Length']=String(data.length);
 return new Response(request.method==='HEAD'?null:data,{headers});
}};
`);
await fs.rm('dist/server/rooms.js');
await fs.mkdir('dist/.openai',{recursive:true});
await fs.copyFile('.openai/hosting.json','dist/.openai/hosting.json');
