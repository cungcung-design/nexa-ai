// Usage: node scripts/check-backend-contract.mjs http://127.0.0.1:8000
// Read-only contract probe: never sends credentials or modifies backend data.
const base = (process.argv[2] ?? 'http://127.0.0.1:8000').replace(/\/$/,'');
const checks = [
  ['/openapi.json','FastAPI OpenAPI schema'],
  ['/health','Health endpoint (optional)']
];
let spec;
for (const [path,label] of checks){
 try{
  const response=await fetch(base+path,{signal:AbortSignal.timeout(5000)});
  console.log(`${response.ok?'OK':'WARN'} ${label}: HTTP ${response.status}`);
  if(path==='/openapi.json'&&response.ok)spec=await response.json();
 }catch(e){console.log(`UNREACHABLE ${label}: ${e.message}`);}
}
if(!spec?.paths){console.error('OpenAPI unavailable: cannot check API contracts.');process.exitCode=1;}
else{
 const patterns = [
  ['POST','/api/v1/auth/register','Registration'],
  ['POST','/api/v1/auth/login','Login'],
  ['GET','/api/v1/auth/me','Current user'],
  ['GET','/api/v1/organizations','Organizations'],
  ['GET','/api/v1/organizations/{organization_id}/agents','Agent listing'],
  ['GET','/api/v1/organizations/{organization_id}/agents/{agent_id}/versions','Agent versions'],
  ['GET','/api/v1/organizations/{organization_id}/conversations','Conversations'],
  ['GET','/api/v1/organizations/{organization_id}/knowledge','Knowledge bases'],
  ['GET','/api/v1/organizations/{organization_id}/workflows/approvals','Approvals'],
  ['GET','/api/v1/organizations/{organization_id}/deployments','Deployments'],
  ['GET','/api/v1/organizations/{organization_id}/billing/plan','Billing plan'],
  ['GET','/api/v1/public/deployments/{public_id}/config','Public widget config']
 ];
 for(const [method,path,label] of patterns){
  const matches=Object.entries(spec.paths).filter(([p,methods])=>p.replace(/\{[^}]+\}/g,'{}')===path.replace(/\{[^}]+\}/g,'{}')&&methods[method.toLowerCase()]);
  console.log(`${matches.length?'FOUND':'MISSING'} ${method} ${path} — ${label}`);
 }
 console.log('A FOUND route only verifies the declared method and path, not its request/response schema or authorization.');
}
