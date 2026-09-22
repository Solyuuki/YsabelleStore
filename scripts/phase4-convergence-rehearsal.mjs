#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseMysqlDatabaseUrl } from "./canonical-database-recovery.mjs";
const ROOT=resolve("."),PULL=join(ROOT,"scripts","canonical-pull-sync.mjs"),PRISMA=join(ROOT,"node_modules","prisma","build","index.js"),SCHEMA=join(ROOT,"database","prisma","schema.prisma"),STATE=join(ROOT,"database","prisma","state","canonical-state.json"),SENTINEL="phase4-runtime-sentinel";
function fail(m){throw new Error("PHASE4_CONVERGENCE_REHEARSAL_BLOCKED: "+m);}
function run(cmd,args,{capture=false,allowFailure=false,env=process.env}={}){const r=spawnSync(cmd,args,{cwd:ROOT,env,encoding:"utf8",stdio:capture?["ignore","pipe","pipe"]:"inherit",maxBuffer:32*1024*1024,windowsHide:true});if(r.error)throw r.error;if(r.status!==0&&!allowFailure)throw new Error(cmd+" failed: "+(r.stderr||r.stdout||"").trim());return r;}
function mysql(url,sql){const c=parseMysqlDatabaseUrl(url),args=["--host",c.host,"--port",c.port,"--user",c.user,"--batch","--skip-column-names"];if(c.database)args.push(c.database);args.push("--execute",sql);return run(process.env.MYSQL_EXECUTABLE?.trim()||"mysql",args,{capture:true,env:{...process.env,MYSQL_PWD:c.password}}).stdout.trim();}
function adminUrl(url){const p=new URL(url);p.pathname="/mysql";return p.toString();}
function recreate(url){const c=parseMysqlDatabaseUrl(url);if(!/^[A-Za-z0-9_]+$/.test(c.database))fail("unsafe database name");mysql(adminUrl(url),"DROP DATABASE IF EXISTS `"+c.database+"`; CREATE DATABASE `"+c.database+"` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;");}
function deploy(url){run(process.execPath,[PRISMA,"migrate","deploy","--schema",SCHEMA],{env:{...process.env,DATABASE_URL:url}});}
function pull(url,tmp,name,expectFailure=false){const assets=join(tmp,"assets-"+name),backups=join(tmp,"backups-"+name),r=run(process.execPath,[PULL,"--force","--confirm-recovery","--allow-unready-rehearsal"],{capture:true,allowFailure:expectFailure,env:{...process.env,DATABASE_URL:url,YSABELLE_CATALOG_IMAGE_ROOT:assets,YSABELLE_CANONICAL_BACKUP_ROOT:backups,YSABELLE_CANONICAL_RECOVERY_CONFIRM:"1",YSABELLE_PHASE4_ALLOW_UNREADY_REHEARSAL:"1"}});if(expectFailure&&r.status===0)fail(name+" should fail closed");if(!expectFailure&&r.status!==0)fail(name+" failed: "+(r.stderr||r.stdout||"").trim());return {...r,assets};}
function marker(url){return mysql(url,"SELECT CONCAT(migration_epoch,'|',schema_version,'|',catalog_version,'|',asset_version,'|',release_id) FROM system_canonical_state WHERE id=1;");}
function files(root){let n=0;const walk=d=>{for(const e of readdirSync(d,{withFileTypes:true})){const p=join(d,e.name);if(e.isDirectory())walk(p);else if(e.isFile())n++;}};const c=join(root,"candidates");if(existsSync(c))walk(c);return n;}
function backup(out){const m=out.match(/^CANONICAL_RECOVERY_BACKUP=(.+)$/m);return m&&m[1].trim();}
async function main(){
  if(process.env.PHASE4_REHEARSAL_ALLOW!=="1")fail("PHASE4_REHEARSAL_ALLOW=1 required");const url=process.env.DATABASE_URL;if(!url)fail("DATABASE_URL required");const c=parseMysqlDatabaseUrl(url);if(!/(?:^|_)(?:ci|test|rehearsal)(?:_|$)/i.test(c.database))fail("refusing non-disposable database "+c.database);if(!existsSync(PRISMA))fail("Prisma CLI missing");
  const state=JSON.parse(readFileSync(STATE,"utf8")),target=[state.migrationEpoch,state.schemaVersion,state.catalogVersion,state.assetVersion,state.releaseId].join("|"),tmp=mkdtempSync(join(tmpdir(),"ysabelle-phase4-"));
  try{
    recreate(url);const empty=pull(url,tmp,"empty");if(marker(url)!==target||files(empty.assets)!==200)fail("EMPTY convergence mismatch");const eb=backup(empty.stdout);if(!eb||!existsSync(eb))fail("EMPTY backup missing");
    recreate(url);mysql(url,"CREATE TABLE legacy_private_sentinel(id VARCHAR(80) PRIMARY KEY,note VARCHAR(255)); INSERT INTO legacy_private_sentinel VALUES('legacy','preserve-me-in-backup');");const legacy=pull(url,tmp,"legacy");if(marker(url)!==target)fail("LEGACY marker mismatch");const lb=backup(legacy.stdout);if(!lb||!readFileSync(lb,"utf8").includes("preserve-me-in-backup"))fail("LEGACY backup sentinel missing");
    recreate(url);deploy(url);mysql(url,"INSERT INTO users(id,name,email,password_hash,role,status,created_at,updated_at) VALUES('"+SENTINEL+"','Phase 4 Sentinel','phase4-sentinel@invalid.local','not-a-login','STAFF','ACTIVE',CURRENT_TIMESTAMP(3),CURRENT_TIMESTAMP(3));");const old=pull(url,tmp,"gen2-old");if(marker(url)!==target||files(old.assets)!==200)fail("GEN2-old convergence mismatch");if(Number(mysql(url,"SELECT COUNT(*) FROM users WHERE id='"+SENTINEL+"';"))!==1)fail("runtime/private sentinel changed");
    const current=pull(url,tmp,"gen2-old");if(!/assetsResult=NOOP/.test(current.stdout))fail("CURRENT is not idempotent");
    mysql(url,"UPDATE system_canonical_state SET catalog_version=catalog_version+1 WHERE id=1;");const ahead=pull(url,tmp,"ahead",true);if(!/ahead/i.test(ahead.stdout+"\n"+ahead.stderr))fail("AHEAD protection mismatch");
    mysql(url,"UPDATE system_canonical_state SET migration_epoch="+(state.migrationEpoch-1)+", catalog_version="+state.catalogVersion+" WHERE id=1;");const drift=pull(url,tmp,"drifted",true);if(!/different migration epoch/i.test(drift.stdout+"\n"+drift.stderr))fail("DRIFTED protection mismatch");
    console.log("PHASE4_CONVERGENCE_REHEARSAL=PASS empty=1 legacy=1 gen2Old=1 current=1 ahead=blocked drifted=blocked assets=200");
  }finally{recreate(url);rmSync(tmp,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
