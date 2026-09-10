import {spawn} from 'node:child_process';
process.loadEnvFile('.env.test.local');
if(!['localhost','127.0.0.1'].includes(new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname))throw new Error('Local configuration must point to local Supabase.');
const command=process.argv[2]??'dev';if(!['dev','build','start'].includes(command))throw new Error('Expected dev, build, or start');
const args=['node_modules/next/dist/bin/next',command];if(command!=='build')args.push('--hostname','127.0.0.1');
const child=spawn(process.execPath,args,{env:process.env,stdio:'inherit'});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>child.kill(signal));child.on('exit',code=>process.exit(code??1));
