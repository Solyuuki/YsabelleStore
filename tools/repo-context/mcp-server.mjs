#!/usr/bin/env node

import readline from 'node:readline';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { handleMcpRequest } from './lib/mcp-handler.mjs';
import { createRepositoryContextRuntime } from './lib/repository-runtime.mjs';

function parseError() {
  return {
    jsonrpc: '2.0',
    id: null,
    error: { code: -32700, message: 'Parse error' },
  };
}

function invalidRequest() {
  return {
    jsonrpc: '2.0',
    id: null,
    error: { code: -32600, message: 'Invalid Request' },
  };
}

async function processMessage(message, runtime) {
  if (Array.isArray(message)) {
    if (message.length === 0) return invalidRequest();
    const responses = await Promise.all(message.map((entry) => handleMcpRequest(entry, runtime)));
    const filtered = responses.filter((entry) => entry !== null);
    return filtered.length > 0 ? filtered : null;
  }
  if (!message || typeof message !== 'object') return invalidRequest();
  return handleMcpRequest(message, runtime);
}

export async function serveStdio({
  input = process.stdin,
  output = process.stdout,
  errorOutput = process.stderr,
  runtime,
} = {}) {
  if (!runtime) throw new Error('runtime is required');
  const lines = readline.createInterface({ input, crlfDelay: Infinity, terminal: false });

  for await (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      output.write(`${JSON.stringify(parseError())}\n`);
      continue;
    }

    try {
      const response = await processMessage(message, runtime);
      if (response !== null) output.write(`${JSON.stringify(response)}\n`);
    } catch (error) {
      errorOutput.write(`ysabelle-repo-context internal error: ${error instanceof Error ? error.message : String(error)}\n`);
      output.write(
        `${JSON.stringify({
          jsonrpc: '2.0',
          id: message?.id ?? null,
          error: { code: -32603, message: 'Internal error' },
        })}\n`,
      );
    }
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  const rootDir = process.env.YSABELLE_REPO_ROOT
    ? path.resolve(process.env.YSABELLE_REPO_ROOT)
    : process.cwd();
  const runtime = await createRepositoryContextRuntime({ rootDir });
  console.error(`ysabelle-repo-context MCP ready for ${runtime.index.repository}`);
  await serveStdio({ runtime });
}
