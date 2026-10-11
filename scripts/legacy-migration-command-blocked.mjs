#!/usr/bin/env node
console.error("BLOCK: the Generation 1 migration-history doctor/repair command is retired.");
console.error(
  "Legacy migrations are read-only recovery evidence. Use npm run migration:security and the Generation 2 sync/recovery workflow."
);
process.exit(1);
