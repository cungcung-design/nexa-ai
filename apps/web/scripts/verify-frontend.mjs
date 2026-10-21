import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const required = [
  'src/app/login/page.tsx', 'src/app/register/page.tsx',
  'src/app/dashboard/layout.tsx', 'src/app/dashboard/page.tsx',
  'src/app/dashboard/organizations/[organizationId]/layout.tsx',
  'src/app/dashboard/organizations/[organizationId]/page.tsx',
  'src/app/dashboard/organizations/[organizationId]/agents/page.tsx',
  'src/app/dashboard/organizations/[organizationId]/agents/[agentId]/page.tsx',
  'src/app/dashboard/organizations/[organizationId]/playground/page.tsx',
  'src/app/dashboard/organizations/[organizationId]/conversations/page.tsx',
  'src/app/dashboard/organizations/[organizationId]/knowledge/page.tsx',
  'src/app/dashboard/organizations/[organizationId]/workflows/page.tsx',
  'src/app/dashboard/organizations/[organizationId]/approvals/page.tsx',
  'src/app/dashboard/organizations/[organizationId]/deployments/page.tsx',
  'src/app/dashboard/organizations/[organizationId]/billing/page.tsx',
  'src/app/dashboard/organizations/[organizationId]/analytics/page.tsx',
  'src/app/embed/[deploymentId]/page.tsx',
  'src/app/api/auth/login/route.ts','src/app/api/auth/logout/route.ts',
  'src/app/api/auth/register/route.ts',
  'src/app/api/auth/password-reset/request/route.ts',
  'src/app/api/auth/password-reset/validate/route.ts',
  'src/app/api/auth/password-reset/confirm/route.ts',
  'src/app/password-recovery/page.tsx',
  'src/app/api/workspace/[orgId]/agents/route.ts',
  'src/app/api/workspace/[orgId]/agents/[agentId]/chat/route.ts',
  'src/app/api/workspace/[orgId]/conversations/route.ts',
  'src/app/api/workspace/[orgId]/knowledge/route.ts',
  'src/app/api/workspace/[orgId]/workflows/approvals/route.ts',
  'src/app/api/workspace/[orgId]/deployments/route.ts',
  'src/app/api/workspace/[orgId]/billing/checkout/route.ts',
  'src/lib/api.ts','src/lib/proxy.ts','src/lib/workspace.ts','src/lib/org-redirect.ts',
  'src/components/dashboard-shell.tsx','public/widget.js'
];
let failures=0;
for(const file of required){
 const ok=existsSync(join(root,file));
 console.log(`${ok?'PASS':'FAIL'} source file: ${file}`);
 if(!ok)failures++;
}
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
for(const name of ['dev','typecheck','build']){
 const ok=Boolean(pkg.scripts?.[name]);
 console.log(`${ok?'PASS':'FAIL'} npm script: ${name}`);
 if(!ok)failures++;
}
console.log(`\nStatic checks: ${required.length+3-failures}/${required.length+3} passed.`);
console.log('This does not test TypeScript, Next.js compilation, authentication, or FastAPI integration.');
if(failures)process.exitCode=1;
