import test from 'node:test';import assert from 'node:assert/strict';import {createAPI} from '../server/core.mjs';
function memory(){const records=new Map;return {get:async k=>structuredClone(records.get(k)||null),put:async(k,v,o={})=>{if(o.new&&records.has(k))return false;records.set(k,structuredClone(v));return true},del:async k=>records.delete(k),entries:async p=>[...records].filter(([k])=>k.startsWith(p)).map(([key,value])=>({key,value:structuredClone(value)})),async list(p){return (await this.entries(p)).map(x=>x.value)},ping:async()=> 'connected'}}
const adminKey='local-only-test-administrator-key';
function client(api){let cookie='';return {async request(path,method='GET',body){const response=await api(new Request('http://localhost/api'+path,{method,headers:{'content-type':'application/json',origin:'http://localhost',cookie},...(body?{body:JSON.stringify(body)}:{})}),{ip:'test-'+this.id});if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0];const data=response.headers.get('content-type')?.includes('application/json')?await response.json():await response.arrayBuffer();return {status:response.status,data,response}},id:Math.random().toString()}}
async function register(c,role,email){const r=await c.request('/register','POST',{name:role+' User',email,password:'correct horse battery staple',role,company:role==='employer'?'Example Test Employer':'',consent:true});assert.equal(r.status,201);return r.data.user}
const pdf=Buffer.from('%PDF-1.4\n% synthetic test CV\n%%EOF').toString('base64');
const vacancy={title:'Test-only Software Developer',location:'Pretoria',province:'Gauteng',type:'Permanent',salary:'R15,000 per month',description:'Build useful web interfaces for a synthetic test employer. This is a test fixture.',requirements:'HTML, JavaScript and clear communication.',closesOn:'2099-12-31'};
test('complete recruiting flow with persistence, moderation, role isolation and private CVs',async()=>{
 const store=memory(),api=createAPI(store,{adminKey,secure:false}),employer=client(api),candidate=client(api),otherEmployer=client(api),otherCandidate=client(api),admin=client(api),anon=client(api);
 await register(employer,'employer','employer@example.test');await register(candidate,'candidate','candidate@example.test');await register(otherEmployer,'employer','other-employer@example.test');await register(otherCandidate,'candidate','other-candidate@example.test');await register(admin,'candidate','admin@example.test');
 assert.equal((await candidate.request('/jobs','POST',vacancy)).status,403);
 const created=await employer.request('/jobs','POST',vacancy);assert.equal(created.status,201);const job=created.data.job;
 assert.equal((await anon.request('/jobs')).data.jobs.length,0);
 assert.equal((await employer.request('/jobs/'+job.id,'PATCH',{status:'published'})).status,403);
 assert.equal((await otherEmployer.request('/jobs/'+job.id,'PATCH',{status:'closed'})).status,403);
 assert.equal((await admin.request('/admin/overview')).status,403);
 assert.equal((await admin.request('/admin/unlock','POST',{key:adminKey})).status,200);
 assert.equal((await admin.request('/jobs/'+job.id,'PATCH',{status:'published'})).status,200);
 assert.equal((await anon.request('/jobs?q=Developer&province=Gauteng')).data.jobs.length,1);
 assert.equal((await anon.request('/jobs?province=Limpopo')).data.jobs.length,0);
 const application={jobId:job.id,cover:'I am applying with this synthetic test fixture.',cv:pdf,consent:true};
 assert.equal((await candidate.request('/applications','POST',{...application,cv:Buffer.from('not a pdf').toString('base64')})).status,400);
 const applied=await candidate.request('/applications','POST',application);assert.equal(applied.status,201);const id=applied.data.application.id;
 assert.equal((await candidate.request('/applications','POST',application)).status,409);
 assert.equal((await otherEmployer.request('/applications')).data.applications.length,0);
 assert.equal((await otherCandidate.request('/applications/'+id+'/cv')).status,403);
 assert.equal((await otherEmployer.request('/applications/'+id+'/cv')).status,403);
 assert.equal((await anon.request('/applications/'+id+'/cv')).status,401);
 const cv=await employer.request('/applications/'+id+'/cv');assert.equal(cv.status,200);assert.match(cv.response.headers.get('content-disposition'),/^attachment/);assert.equal(Buffer.from(cv.data).toString(),Buffer.from(pdf,'base64').toString());
 assert.equal((await employer.request('/applications/'+id,'PATCH',{status:'shortlisted'})).status,200);
 assert.equal((await candidate.request('/applications')).data.applications[0].status,'shortlisted');
 assert.equal('cv' in (await employer.request('/applications')).data.applications[0],false);
 // Recreate handler against the same persistent adapter, then sign in again.
 const restarted=client(createAPI(store,{adminKey,secure:false}));assert.equal((await restarted.request('/login','POST',{email:'candidate@example.test',password:'correct horse battery staple'})).status,200);assert.equal((await restarted.request('/applications')).data.applications.length,1);
 assert.equal((await candidate.request('/applications/'+id,'PATCH',{status:'withdrawn'})).status,200);
 assert.equal((await employer.request('/applications/'+id,'PATCH',{status:'shortlisted'})).status,409);
 const enquiry=await anon.request('/enquiries','POST',{name:'Test Sender',email:'sender@example.test',message:'This is a synthetic test enquiry only.',consent:true});assert.equal(enquiry.status,201);assert.equal((await admin.request('/admin/overview')).data.enquiries.length,1);
 assert.equal((await candidate.request('/profile','PATCH',{name:'Candidate Updated',phone:'',location:'Pretoria',skills:'JavaScript',summary:'A synthetic test profile'})).status,200);
 assert.equal((await candidate.request('/password','POST',{current:'correct horse battery staple',password:'another strong passphrase'})).status,200);assert.equal((await restarted.request('/me')).data.user,null);
 await candidate.request('/login','POST',{email:'candidate@example.test',password:'another strong passphrase'});
 assert.equal((await candidate.request('/account','DELETE',{password:'another strong passphrase'})).status,200);assert.equal((await employer.request('/applications')).data.applications.length,0);
});
test('rejects cross-origin writes and unbounded requests; auth attempts are limited',async()=>{
 const api=createAPI(memory(),{rateLimit:40,secure:false});
 const r=await api(new Request('http://localhost/api/register',{method:'POST',headers:{origin:'https://other.example','content-type':'application/json'},body:'{}'}));assert.equal(r.status,403);
 const c=client(api);for(let i=0;i<15;i++)assert.equal((await c.request('/login','POST',{email:'missing@example.test',password:'bad'})).status,401);assert.equal((await c.request('/login','POST',{email:'missing@example.test',password:'bad'})).status,429);
 assert.equal((await api(new Request('http://localhost/api/register',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(2900001)}),{ip:'different'})).status,413);
});
test('no default admin or fake vacancies, and account creation is atomic',async()=>{
 const api=createAPI(memory(),{secure:false}),a=client(api),b=client(api);assert.deepEqual((await a.request('/jobs')).data.jobs,[]);
 const data={name:'Same Account',email:'same@example.test',password:'twelve characters or more',role:'candidate',consent:true};const attempts=await Promise.all([a.request('/register','POST',data),b.request('/register','POST',data)]);assert.deepEqual(attempts.map(r=>r.status).sort(),[201,409]);
 const logged=attempts[0].status===201?a:b;assert.equal((await logged.request('/admin/unlock','POST',{key:'anything'})).status,503);
});
