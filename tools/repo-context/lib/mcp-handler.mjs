import { getRelevantContext } from './context-core.mjs';

const MODERN_PROTOCOL = '2026-07-28';
const LEGACY_PROTOCOL = '2025-11-25';
const LEGACY_PROTOCOLS = new Set(['2024-11-05', '2025-03-26', '2025-06-18', LEGACY_PROTOCOL]);

const toolDefinitions = [
  {
    name: 'repo_overview',
    description: 'Return a compact YsabelleStore repository context overview without scanning source files.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'find_relevant_context',
    description: 'Route a task to likely subsystems, files, invariants, guidance, and verification tier.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['task'],
      properties: { task: { type: 'string', minLength: 1 } },
    },
  },
  {
    name: 'get_subsystem',
    description: 'Return compact stored context for one named subsystem.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: { name: { type: 'string', minLength: 1 } },
    },
  },
  {
    name: 'trace_flow',
    description: 'Return a stored cross-subsystem flow by name.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['name'],
      properties: { name: { type: 'string', minLength: 1 } },
    },
  },
  {
    name: 'changed_since_index',
    description: 'Report Git changes since the persistent context index was built and affected subsystems.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} },
  },
  {
    name: 'refresh_context',
    description: 'Refresh stale or changed repository context using the persistent index runtime.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        paths: { type: 'array', items: { type: 'string' } },
        subsystems: { type: 'array', items: { type: 'string' } },
      },
    },
  },
  {
    name: 'report_context_mismatch',
    description: 'Record a concise mismatch between stored repository context and current implementation.',
    inputSchema: {
      type: 'object',
      additionalProperties: false,
      required: ['summary'],
      properties: {
        summary: { type: 'string', minLength: 1 },
        storedExpectation: { type: 'string' },
        currentReality: { type: 'string' },
        affectedSubsystems: { type: 'array', items: { type: 'string' } },
      },
    },
  },
];

function resultEnvelope(id, result, { modern = true } = {}) {
  const response = { jsonrpc: '2.0', id, result };
  if (modern) {
    response.result = {
      ...result,
      _meta: {
        ...(result?._meta ?? {}),
        'io.modelcontextprotocol/serverInfo': { name: 'ysabelle-repo-context', version: '0.1.0' },
      },
    };
  }
  return response;
}

function errorEnvelope(id, code, message, data) {
  return {
    jsonrpc: '2.0',
    id: id ?? null,
    error: { code, message, ...(data === undefined ? {} : { data }) },
  };
}

function textToolResult(value) {
  return {
    content: [{ type: 'text', text: JSON.stringify(value) }],
    isError: false,
  };
}

function compactOverview(runtime) {
  return {
    repository: runtime.index.repository,
    indexedCommit: runtime.index.source?.commit ?? null,
    subsystems: Object.entries(runtime.index.subsystems ?? {}).map(([name, subsystem]) => ({
      name,
      description: subsystem.description,
      fileCount: subsystem.files?.length ?? 0,
      verificationTier: subsystem.verificationTier ?? 1,
    })),
    flows: Object.keys(runtime.index.flows ?? {}),
  };
}

async function callTool(name, args, runtime) {
  switch (name) {
    case 'repo_overview':
      return compactOverview(runtime);
    case 'find_relevant_context':
      if (typeof args?.task !== 'string' || !args.task.trim()) throw new Error('task is required');
      return getRelevantContext(args.task, runtime.index, runtime.config);
    case 'get_subsystem': {
      const subsystem = runtime.index.subsystems?.[args?.name];
      if (!subsystem) throw new Error(`Unknown subsystem: ${String(args?.name ?? '')}`);
      return { name: args.name, ...subsystem };
    }
    case 'trace_flow': {
      const flow = runtime.index.flows?.[args?.name];
      if (!flow) throw new Error(`Unknown flow: ${String(args?.name ?? '')}`);
      return { name: args.name, ...flow };
    }
    case 'changed_since_index':
      return runtime.getStatus();
    case 'refresh_context':
      return runtime.refresh(args ?? {});
    case 'report_context_mismatch':
      if (!runtime.reportMismatch) {
        return { recorded: false, reason: 'Mismatch reporting is not configured in this runtime.' };
      }
      return runtime.reportMismatch(args ?? {});
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export async function handleMcpRequest(request, runtime) {
  const id = request?.id ?? null;
  const method = request?.method;
  const modern = method === 'server/discover' || Boolean(request?.params?._meta?.['io.modelcontextprotocol/protocolVersion']);

  try {
    if (method === 'server/discover') {
      return resultEnvelope(id, {
        resultType: 'complete',
        supportedVersions: [MODERN_PROTOCOL],
        capabilities: { tools: {} },
        instructions:
          'Before exploratory scans, query repository context and freshness first. Open only the returned likely files and direct dependencies. Refresh changed subsystems when stale. Treat current source, schema, migrations, and executable config as authoritative when cached context disagrees. Use repository-wide discovery only as a last-resort escalation.',
        ttlMs: 60_000,
        cacheScope: 'private',
      });
    }

    if (method === 'initialize') {
      const requested = request?.params?.protocolVersion;
      const protocolVersion = LEGACY_PROTOCOLS.has(requested) ? requested : LEGACY_PROTOCOL;
      return resultEnvelope(
        id,
        {
          protocolVersion,
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'ysabelle-repo-context', version: '0.1.0' },
          instructions:
            'Before exploratory scans, query repository context and freshness first. Open only the returned likely files and direct dependencies. Refresh changed subsystems when stale. Treat current source, schema, migrations, and executable config as authoritative when cached context disagrees. Use repository-wide discovery only as a last-resort escalation.',
        },
        { modern: false },
      );
    }

    if (method === 'ping') return resultEnvelope(id, {}, { modern });

    if (method === 'tools/list') {
      return resultEnvelope(
        id,
        {
          tools: toolDefinitions,
          ttlMs: 60_000,
          cacheScope: 'private',
        },
        { modern },
      );
    }

    if (method === 'tools/call') {
      const name = request?.params?.name;
      const args = request?.params?.arguments ?? {};
      const value = await callTool(name, args, runtime);
      return resultEnvelope(id, textToolResult(value), { modern });
    }

    if (typeof method === 'string' && method.startsWith('notifications/')) return null;

    return errorEnvelope(id, -32601, `Method not found: ${String(method ?? '')}`);
  } catch (error) {
    return resultEnvelope(
      id,
      {
        content: [{ type: 'text', text: error instanceof Error ? error.message : String(error) }],
        isError: true,
      },
      { modern },
    );
  }
}

export { toolDefinitions };
