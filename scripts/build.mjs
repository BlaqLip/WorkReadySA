import {cp,rm,mkdir} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist');await cp('public','dist',{recursive:true});
console.log('Built WorkReadySA public assets. API is packaged separately as a Netlify Function.');
