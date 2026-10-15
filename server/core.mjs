import {randomBytes,randomUUID,scrypt as rawScrypt,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
const scrypt=promisify(rawScrypt),sha=s=>createHash('sha256').update(s).digest('hex');
const now=()=>new Date().toISOString();
class HttpError extends Error{constructor(status,message){super(message);this.status=status}}
const fail=(status,message)=>{throw new HttpError(status,message)};
const text=(v,name,min=1,max=200)=>{if(typeof v!=='string'||v.trim().length<min||v.trim().length>max)fail(400,`${name} must be ${min}–${max} characters.`);return v.trim()};
const email=v=>{const s=text(v,'Email',3,254).toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))fail(400,'Enter a valid email address.');return s};
const cleanUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,company:u.company||'',phone:u.phone||'',location:u.location||'',skills:u.skills||'',summary:u.summary||''});
const types=['Permanent','Contract','Temporary','Internship','Learnership','Part-time'];
const provinces=['Eastern Cape','Free State','Gauteng','KwaZulu-Natal','Limpopo','Mpumalanga','North West','Northern Cape','Western Cape','Remote'];
export function createAPI(store,{adminKey='',secure=true,rateLimit=40}={}){
 const headers={'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'};
 const json=(data,status=200,extra={})=>new Response(JSON.stringify(data),{status,headers:{...headers,...extra}});
 const cookie=(token,age=604800)=>`wr_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${age}${secure?'; Secure':''}`;
 async function rate(ip,action,limit=rateLimit){const prefix=`limits/${sha(ip+'|'+action)}/${Math.floor(Date.now()/900000)}/`;for(let i=0;i<limit;i++){if(await store.put(prefix+i,{at:now()},{new:true}))return}fail(429,'Too many requests. Try again in 15 minutes.');}
 async function readBody(req){if(!req.headers.get('content-type')?.startsWith('application/json'))fail(415,'Send JSON data.');const body=await req.text();if(Buffer.byteLength(body)>2900000)fail(413,'Request too large. PDF limit is 2 MB.');try{return JSON.parse(body)}catch{fail(400,'Invalid request data.')}}
 async function session(req){const token=req.headers.get('cookie')?.match(/(?:^|;\s*)wr_session=([a-f0-9]{64})/)?.[1];if(!token)return null;const s=await store.get('sessions/'+sha(token));if(!s||s.expires<Date.now())return null;const u=await store.get('users/'+s.userId);if(!u||u.disabled)return null;return {u,s,key:'sessions/'+sha(token)};}
 function requireRole(auth,roles){if(!auth)fail(401,'Please sign in.');if(!roles.includes(auth.s.admin?'admin':auth.u.role))fail(403,'You do not have access to this action.');}
 async function newSession(u,admin=false){const token=randomBytes(32).toString('hex');await store.put('sessions/'+sha(token),{userId:u.id,expires:Date.now()+604800000,admin});return token;}
 async function jobById(id){if(!/^[a-f0-9-]{36}$/.test(id))fail(404,'Job not found.');const j=await store.get('jobs/'+id);if(!j)fail(404,'Job not found.');return j;}
 const open=j=>j.status==='published'&&j.closesOn>=now().slice(0,10);
 async function jobs(){return (await store.list('jobs/')).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));}
 const safeJob=j=>({id:j.id,title:j.title,company:j.company,location:j.location,province:j.province,type:j.type,salary:j.salary,description:j.description,requirements:j.requirements,closesOn:j.closesOn,status:j.status,createdAt:j.createdAt});
 async function canReadApplication(auth,a){requireRole(auth,['candidate','employer','admin']);if(auth.s.admin||a.candidateId===auth.u.id)return;const j=await store.get('jobs/'+a.jobId);if(j?.employerId!==auth.u.id)fail(403,'This application is private.');}
 return async function handle(req,{ip='unknown'}={}){try{
  const url=new URL(req.url),path=url.pathname.replace(/^\/(?:\.netlify\/functions\/api|api)/,'').replace(/\/$/,'')||'/',method=req.method;
  if(!['GET','HEAD','POST','PATCH','DELETE'].includes(method))fail(405,'Method not allowed.');
  if(!['GET','HEAD'].includes(method)){
   const origin=req.headers.get('origin');if(origin&&origin!==url.origin)fail(403,'Cross-site requests are not allowed.');
   const fetchSite=req.headers.get('sec-fetch-site');if(fetchSite==='cross-site')fail(403,'Cross-site requests are not allowed.');
  }
  if(path==='/health')return json({ok:true,storage:await store.ping(),adminConfigured:Boolean(adminKey),version:'1.0.0'});
  if(path==='/meta')return json({types,provinces});
  if(path==='/register'&&method==='POST'){
   await rate(ip,'register',10);const b=await readBody(req);if(b.consent!==true)fail(400,'Please agree to the privacy notice.');
   const address=email(b.email),name=text(b.name,'Name',2,100),password=text(b.password,'Password',12,128);if(!['candidate','employer'].includes(b.role))fail(400,'Choose a candidate or employer account.');
   const company=b.role==='employer'?text(b.company,'Company',2,120):'';
   const id=sha(address),salt=randomBytes(16).toString('hex'),hash=(await scrypt(password,salt,64)).toString('hex');
   const u={id,name,email:address,role:b.role,company,salt,hash,createdAt:now()};
   if(!await store.put('users/'+id,u,{new:true}))fail(409,'An account already exists. Please sign in.');
   return json({user:cleanUser(u),admin:false},201,{'set-cookie':cookie(await newSession(u))});
  }
  if(path==='/login'&&method==='POST'){
   await rate(ip,'login',15);const b=await readBody(req),address=email(b.email),password=text(b.password,'Password',1,128),u=await store.get('users/'+sha(address));
   const computed=await scrypt(password,u?.salt||'dummy-salt-for-timing',64);
   if(!u||u.disabled||!timingSafeEqual(Buffer.from(u.hash,'hex'),computed))fail(401,'Email or password is incorrect.');
   return json({user:cleanUser(u),admin:false},200,{'set-cookie':cookie(await newSession(u))});
  }
  const auth=await session(req);
  if(path==='/me'&&method==='GET')return json({user:auth?cleanUser(auth.u):null,admin:auth?.s.admin||false});
  if(path==='/logout'&&method==='POST'){if(auth)await store.del(auth.key);return json({ok:true},200,{'set-cookie':cookie('',0)});}
  if(path==='/admin/unlock'&&method==='POST'){
   requireRole(auth,['candidate','employer','admin']);await rate(ip,'admin',5);const b=await readBody(req);
   if(!adminKey)fail(503,'Administrator access has not been configured by the site owner.');
   if(typeof b.key!=='string'||!timingSafeEqual(Buffer.from(sha(b.key)),Buffer.from(sha(adminKey))))fail(403,'Administrator key is incorrect.');
   await store.put(auth.key,{...auth.s,admin:true});return json({ok:true,admin:true});
  }
  if(path==='/profile'&&method==='PATCH'){
   requireRole(auth,['candidate','employer','admin']);const b=await readBody(req),u={...auth.u,name:text(b.name,'Name',2,100),phone:text(b.phone||'','Phone',0,30),location:text(b.location||'','Location',0,120),skills:text(b.skills||'','Skills',0,1000),summary:text(b.summary||'','Summary',0,2000)};
   if(u.role==='employer')u.company=text(b.company,'Company',2,120);await store.put('users/'+u.id,u);return json({user:cleanUser(u)});
  }
  if(path==='/password'&&method==='POST'){
   requireRole(auth,['candidate','employer','admin']);await rate(ip,'password',10);const b=await readBody(req),old=text(b.current,'Current password',1,128),next=text(b.password,'New password',12,128);
   if(!timingSafeEqual(Buffer.from(auth.u.hash,'hex'),await scrypt(old,auth.u.salt,64)))fail(403,'Current password is incorrect.');
   const salt=randomBytes(16).toString('hex');await store.put('users/'+auth.u.id,{...auth.u,salt,hash:(await scrypt(next,salt,64)).toString('hex')});
   for(const s of await store.entries('sessions/'))if(s.value.userId===auth.u.id)await store.del(s.key);
   return json({ok:true},200,{'set-cookie':cookie('',0)});
  }
  if(path==='/account'&&method==='DELETE'){
   requireRole(auth,['candidate','employer','admin']);const b=await readBody(req),password=text(b.password,'Password',1,128);
   if(!timingSafeEqual(Buffer.from(auth.u.hash,'hex'),await scrypt(password,auth.u.salt,64)))fail(403,'Password is incorrect.');
   // Close employer jobs before removing their account; applicants retain their own history.
   for(const j of await jobs())if(j.employerId===auth.u.id)await store.put('jobs/'+j.id,{...j,status:'closed'});
   for(const a of await store.list('applications/'))if(a.candidateId===auth.u.id)await store.del('applications/'+a.id);
   for(const s of await store.entries('sessions/'))if(s.value.userId===auth.u.id)await store.del(s.key);
   await store.del('users/'+auth.u.id);return json({ok:true},200,{'set-cookie':cookie('',0)});
  }
  if(path==='/jobs'&&method==='GET'){
   const q=(url.searchParams.get('q')||'').toLowerCase(),province=url.searchParams.get('province'),type=url.searchParams.get('type');
   return json({jobs:(await jobs()).filter(open).filter(j=>(!q||[j.title,j.company,j.description,j.location].join(' ').toLowerCase().includes(q))&&(!province||j.province===province)&&(!type||j.type===type)).map(safeJob)});
  }
  if(path==='/jobs/mine'&&method==='GET'){requireRole(auth,['employer','admin']);return json({jobs:(await jobs()).filter(j=>auth.s.admin||j.employerId===auth.u.id).map(safeJob)});}
  if(path==='/jobs'&&method==='POST'){
   requireRole(auth,['employer','admin']);await rate(auth.u.id,'jobs',10);const b=await readBody(req);
   if(!types.includes(b.type)||!provinces.includes(b.province))fail(400,'Choose a valid employment type and province.');
   if(!/^\d{4}-\d{2}-\d{2}$/.test(b.closesOn)||Number.isNaN(Date.parse(b.closesOn))||b.closesOn<now().slice(0,10)||b.closesOn>'2100-12-31')fail(400,'Choose a valid future closing date.');
   const j={id:randomUUID(),employerId:auth.u.id,company:auth.u.company||auth.u.name,title:text(b.title,'Job title',3,140),location:text(b.location,'Location',2,120),province:b.province,type:b.type,salary:text(b.salary||'Not disclosed','Salary',1,100),description:text(b.description,'Description',40,8000),requirements:text(b.requirements,'Requirements',10,4000),closesOn:b.closesOn,status:'pending',createdAt:now()};await store.put('jobs/'+j.id,j,{new:true});return json({job:safeJob(j)},201);
  }
  const jobMatch=path.match(/^\/jobs\/([a-f0-9-]+)$/);
  if(jobMatch){const j=await jobById(jobMatch[1]);
   if(method==='GET'){if(!open(j)&&!auth?.s.admin&&j.employerId!==auth?.u.id)fail(404,'Job is unavailable or closed.');return json({job:safeJob(j)});}
   if(method==='PATCH'){
    requireRole(auth,['employer','admin']);if(!auth.s.admin&&j.employerId!==auth.u.id)fail(403,'This job belongs to another employer.');
    const b=await readBody(req);if(auth.s.admin){if(!['published','rejected','closed'].includes(b.status))fail(400,'Invalid review status.');}else if(b.status!=='closed')fail(403,'Only an administrator can publish a job.');
    await store.put('jobs/'+j.id,{...j,status:b.status,reviewedAt:now()});return json({ok:true});
   }
  }
  if(path==='/applications'&&method==='POST'){
   requireRole(auth,['candidate']);await rate(auth.u.id,'apply',20);const b=await readBody(req),j=await jobById(b.jobId);if(!open(j))fail(409,'This job is no longer accepting applications.');
   if(b.consent!==true)fail(400,'Please consent to share your application with this employer.');
   const id=j.id+'-'+auth.u.id,cover=text(b.cover,'Application note',20,4000);
   if(typeof b.cv!=='string'||b.cv.length>2800000||!/^[A-Za-z0-9+/]+={0,2}$/.test(b.cv))fail(400,'Upload a PDF CV up to 2 MB.');
   const pdf=Buffer.from(b.cv,'base64');if(pdf.length>2097152||pdf.length<10||pdf.subarray(0,5).toString()!=='%PDF-')fail(400,'Upload a valid PDF up to 2 MB.');
   const a={id,jobId:j.id,candidateId:auth.u.id,name:auth.u.name,email:auth.u.email,phone:auth.u.phone||'',cover,cv:b.cv,status:'submitted',createdAt:now(),jobTitle:j.title,company:j.company};
   if(!await store.put('applications/'+id,a,{new:true}))fail(409,'You have already applied for this job.');return json({application:{id,status:a.status}},201);
  }
  if(path==='/applications'&&method==='GET'){
   requireRole(auth,['candidate','employer','admin']);const owned=new Set((auth.u.role==='employer'&&!auth.s.admin?(await jobs()).filter(j=>j.employerId===auth.u.id):[]).map(j=>j.id));
   const rows=(await store.list('applications/')).filter(a=>auth.s.admin||(auth.u.role==='candidate'?a.candidateId===auth.u.id:owned.has(a.jobId))).map(({cv,...a})=>a).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));return json({applications:rows});
  }
  const appMatch=path.match(/^\/applications\/([a-f0-9-]+)(\/cv)?$/);
  if(appMatch){const a=await store.get('applications/'+appMatch[1]);if(!a)fail(404,'Application not found.');await canReadApplication(auth,a);
   if(appMatch[2]&&method==='GET')return new Response(Buffer.from(a.cv,'base64'),{headers:{'content-type':'application/pdf','content-disposition':'attachment; filename="candidate-cv.pdf"','cache-control':'private, no-store','x-content-type-options':'nosniff','content-security-policy':"sandbox; default-src 'none'"}});
   if(method==='PATCH'){
    const b=await readBody(req);if(a.candidateId===auth.u.id&&!auth.s.admin){if(b.status!=='withdrawn')fail(403,'Candidates can only withdraw their own application.');}
    else if(!['reviewing','shortlisted','unsuccessful'].includes(b.status))fail(400,'Invalid application status.');
    if(a.status==='withdrawn')fail(409,'This application has been withdrawn.');await store.put('applications/'+a.id,{...a,status:b.status,updatedAt:now()});return json({ok:true});
   }
  }
  if(path==='/enquiries'&&method==='POST'){
   await rate(ip,'enquiries',5);const b=await readBody(req);if(b.website)fail(400,'Unable to submit enquiry.');if(b.consent!==true)fail(400,'Please agree to the privacy notice.');
   const e={id:randomUUID(),name:text(b.name,'Name',2,100),email:email(b.email),message:text(b.message,'Message',20,4000),status:'new',createdAt:now()};await store.put('enquiries/'+e.id,e,{new:true});return json({ok:true,reference:e.id},201);
  }
  if(path==='/admin/overview'&&method==='GET'){requireRole(auth,['admin']);return json({jobs:(await jobs()).map(safeJob),enquiries:await store.list('enquiries/')});}
  if(path.startsWith('/admin/enquiries/')&&method==='PATCH'){requireRole(auth,['admin']);const key='enquiries/'+path.split('/').at(-1),e=await store.get(key);if(!e)fail(404,'Enquiry not found.');await store.put(key,{...e,status:'resolved'});return json({ok:true});}
  fail(404,'Endpoint not found.');
 }catch(e){if(!e.status)console.error('WorkReadySA API error:',e.message);return json({error:e.status?e.message:'Service temporarily unavailable. Please try again.'},e.status||503)}};
}
