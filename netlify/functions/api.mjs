import {getStore} from '@netlify/blobs';
import {createAPI} from '../../server/core.mjs';
export default async (req,context)=>{
 const name=process.env.CONTEXT==='production'?'workready-production':'workready-'+(process.env.DEPLOY_ID||'development');
 const blob=getStore({name,consistency:'strong'});
 const adapter={
  get:key=>blob.get(key,{type:'json'}),
  async put(key,value,options={}){const r=await blob.setJSON(key,value,options.new?{onlyIfNew:true}:{});return r.modified;},
  del:key=>blob.delete(key),
  async entries(prefix){const all=[];for await(const page of blob.list({prefix,paginate:true})){for(const item of page.blobs){const value=await blob.get(item.key,{type:'json'});if(value)all.push({key:item.key,value});}}return all;},
  async list(prefix){return (await this.entries(prefix)).map(x=>x.value);},
  async ping(){await blob.get('health');return 'connected';}
 };
 return createAPI(adapter,{adminKey:process.env.WORKREADY_ADMIN_KEY||'',secure:true})(req,{ip:context.ip||'unknown'});
};
