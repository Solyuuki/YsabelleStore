#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT=resolve(".");
export const sha256=(text)=>createHash("sha256").update(text,"utf8").digest("hex");
export const stripSqlComments=(sql)=>sql.replace(/\/\*[\s\S]*?\*\//g,"").replace(/^\s*--[^\n]*/gm,"");
export function readMigrationMap(directory){const out=new Map();if(!existsSync(directory))return out;for(const e of readdirSync(directory,{withFileTypes:true})){if(!e.isDirectory())continue;const f=join(directory,e.name,"migration.sql");if(existsSync(f))out.set(e.name,readFileSync(f,"utf8"));}return out;}
export function inspectGeneration2({schema,active,archiveNames,state,checksums}){
 const findings=[];
 if(state.migrationEpoch!==2)findings.push("BLOCK: canonical state is not Migration Generation 2.");
 if(state.baselineMigration!=="0000_generation2_baseline")findings.push("BLOCK: canonical baseline identifier is unexpected.");
 const names=[...active.keys()].sort();
 if(names[0]!==state.baselineMigration)findings.push(`BLOCK: active lineage must start with ${state.baselineMigration}.`);
 for(const name of names)if(archiveNames.has(name))findings.push(`BLOCK: legacy migration ${name} is active again.`);
 const models=new Map();
 for(const m of schema.matchAll(/\bmodel\s+(\w+)\s*\{([\s\S]*?)^\}/gm)){const map=m[2].match(/@@map\("([a-z_][a-z\d_]*)"\)/i);models.set((map?.[1]??m[1]).toLowerCase(),m[1]);}
 const creators=new Map(), re=/\bCREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?[`"]?([a-z_][a-z\d_]*)[`"]?/gi;
 for(const [migration,raw] of active)for(const m of stripSqlComments(raw).matchAll(re)){const table=m[1].toLowerCase(),prev=creators.get(table);if(prev)findings.push(`BLOCK: ${table} is created twice (${prev}, ${migration}).`);else creators.set(table,migration);}
 for(const [table,model] of models)if(!creators.has(table))findings.push(`BLOCK: Prisma model ${model} maps to ${table}, but active migrations never create it.`);
 for(const [table,migration] of creators)if(!models.has(table))findings.push(`BLOCK: active migration ${migration} creates ${table}, absent from schema.prisma.`);
 const frozen=checksums?.migrations??{};
 for(const [name,sql] of active){if(!frozen[name])findings.push(`BLOCK: active migration ${name} has no frozen checksum. Run migration:checksums:add only after review.`);else if(sha256(sql)!==frozen[name])findings.push(`BLOCK: frozen migration checksum changed: ${name}.`);}
 for(const name of Object.keys(frozen))if(!active.has(name))findings.push(`BLOCK: checksum manifest references missing active migration ${name}.`);
 const all=[...active.values()].join("\n");
 if(!/CONSTRAINT\s+`?chk_product_reviews_rating`?\s+CHECK\s*\(\s*`?rating`?\s+BETWEEN\s+1\s+AND\s+5\s*\)/i.test(all))findings.push("BLOCK: product review rating CHECK contract is missing.");
 if(!/`updated_at`\s+DATETIME\(3\)\s+NOT\s+NULL\s+DEFAULT\s+CURRENT_TIMESTAMP\(3\)\s+ON\s+UPDATE\s+CURRENT_TIMESTAMP\(3\)/i.test(all))findings.push("BLOCK: customer_saved_addresses.updated_at ON UPDATE contract is missing.");
 return findings;
}
export function inspectRepository(root=ROOT){
 const schema=join(root,"database","prisma","schema.prisma"),activeDir=join(root,"database","prisma","migrations"),archiveDir=join(root,"database","prisma","migration-history-archive","generation-1"),statePath=join(root,"database","prisma","state","canonical-state.json"),checksumsPath=join(root,"database","prisma","state","migration-checksums.json");
 for(const p of [schema,activeDir,archiveDir,statePath,checksumsPath])if(!existsSync(p))return[`BLOCK: required migration-security source is missing: ${p}`];
 const active=readMigrationMap(activeDir);if(active.size===0)return["BLOCK: no active migrations found."];
 return inspectGeneration2({schema:readFileSync(schema,"utf8"),active,archiveNames:new Set(readMigrationMap(archiveDir).keys()),state:JSON.parse(readFileSync(statePath,"utf8")),checksums:JSON.parse(readFileSync(checksumsPath,"utf8"))});
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const f=inspectRepository();if(f.length){for(const x of f)console.error(x);console.error(`MIGRATION_SECURITY=BLOCKED (${f.length} findings)`);process.exitCode=1;}else{console.log("MIGRATION_SECURITY=PASS");console.log("Generation 1 is isolated, active migration coverage is complete, frozen checksums match, and required raw-SQL contracts are present.");}}
