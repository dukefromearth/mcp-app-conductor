#!/usr/bin/env node

import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  moduleManifestSchema,
  moduleProfileSchema,
  swapModeSchema,
  wiringEdgeSchema,
  type ModuleManifest,
  type ModuleRuntimeProfile,
  type WiringEdge,
} from '@mcp-app-conductor/contracts';
import { createConductor, JsonlRecorder } from 'mcp-app-conductor';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

type CommandName = 'help' | 'dev' | 'probe' | 'connect' | 'wire' | 'swap' | 'trace';

interface PersistedModule {
  id: string;
  url: string;
  manifest: ModuleManifest;
  profile?: ModuleRuntimeProfile;
  transportAdapterId?: string;
}

interface RuntimeConfig {
  modules: Record<string, PersistedModule>;
  wiring: WiringEdge[];
  traceFile: string;
}

interface ProbeReport {
  url: string;
  connected: boolean;
  server?: { name?: string; version?: string };
  tools?: string[];
  resources?: string[];
  probeTool?: string;
  callOk?: boolean;
  resourceReadOk?: boolean;
  errors: string[];
}

const runtimeFile = path.resolve(process.cwd(), '.mcp-canvas-runtime.json');
const defaultTraceFile = path.resolve(process.cwd(), 'flight-recorder.jsonl');

function printHelp(): void {
  console.log('mcp-canvas commands:');
  console.log('  dev                                      Show current module + wiring inventory.');
  console.log('  probe [--servers url1,url2]              Run protocol conformance probe.');
  console.log('  connect --id <id> --url <url> [--profile <file>]');
  console.log('                                           Register a module endpoint and profile.');
  console.log('  wire --from <module:port> --to <module:tool:arg> [--id <edge-id>]');
  console.log('                                           Create/update a wiring edge.');
  console.log('  swap --from <module-id> --to <module-id> [--mode auto|hot|warm|cold]');
  console.log('                                           Execute tiered module swap planning + rewiring.');
  console.log('  trace --tail <n>                          Print latest flight-recorder JSONL entries.');
  console.log('  help                                     Print this help output.');
}

function getFlag(args: string[], name: string): string | undefined {
  const idx = args.indexOf(name);
  if (idx < 0) {
    return undefined;
  }

  return args[idx + 1];
}

async function loadRuntime(): Promise<RuntimeConfig> {
  try {
    const text = await readFile(runtimeFile, 'utf8');
    const parsed = JSON.parse(text) as RuntimeConfig;

    return {
      modules: parsed.modules ?? {},
      wiring: (parsed.wiring ?? []).map((edge) => wiringEdgeSchema.parse(edge)),
      traceFile: parsed.traceFile ?? defaultTraceFile,
    };
  } catch {
    return {
      modules: {},
      wiring: [],
      traceFile: defaultTraceFile,
    };
  }
}

async function saveRuntime(runtime: RuntimeConfig): Promise<void> {
  await writeFile(runtimeFile, JSON.stringify(runtime, null, 2));
}

async function createHydratedConductor(runtime: RuntimeConfig) {
  const recorder = new JsonlRecorder({
    onLine: (line: string) => {
      void appendFile(runtime.traceFile, `${line}\n`);
    },
  });

  const conductor = createConductor({ recorder });

  const moduleEntries = Object.values(runtime.modules);
  for (const entry of moduleEntries) {
    await conductor.registerModule({
      id: entry.id,
      url: entry.url,
      manifest: entry.manifest,
      profile: entry.profile,
      transportAdapterId: entry.transportAdapterId,
    });
  }

  if (moduleEntries.length > 0) {
    await conductor.discoverCapabilities();
  }

  for (const edge of runtime.wiring) {
    conductor.connectPorts(edge);
  }

  return conductor;
}

function parseModulePort(value: string): { moduleId: string; port: string } {
  const [moduleId, port] = value.split(':');
  if (!moduleId || !port) {
    throw new Error(`Invalid --from value \"${value}\". Expected module:port.`);
  }

  return { moduleId, port };
}

function parseModuleToolArg(value: string): { moduleId: string; tool: string; arg: string } {
  const [moduleId, tool, arg] = value.split(':');
  if (!moduleId || !tool || !arg) {
    throw new Error(`Invalid --to value \"${value}\". Expected module:tool:arg.`);
  }

  return { moduleId, tool, arg };
}

function parseServerList(args: string[]): string[] {
  const serversFlag = getFlag(args, '--servers');
  if (!serversFlag) {
    return ['http://localhost:3001/mcp', 'http://localhost:3002/mcp'];
  }

  return serversFlag
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

function preferredProbeTool(tools: Array<{ name: string }>): string | undefined {
  const names = tools.map((tool) => tool.name);

  if (names.includes('display_pdf')) return 'display_pdf';
  if (names.includes('say')) return 'say';
  if (names.includes('list_voices')) return 'list_voices';
  return names[0];
}

function probeArgs(toolName: string): Record<string, unknown> {
  if (toolName === 'say') {
    return { text: 'Conformance probe.', autoPlay: false };
  }

  if (toolName === 'display_pdf') {
    return {};
  }

  return {};
}

async function runProbe(url: string): Promise<ProbeReport> {
  const report: ProbeReport = {
    url,
    connected: false,
    errors: [],
  };

  const client = new Client({ name: 'mcp-canvas-probe', version: '0.1.0' });

  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    report.connected = true;

    const version = client.getServerVersion();
    report.server = {
      name: version?.name,
      version: version?.version,
    };

    const tools = await client.listTools();
    report.tools = tools.tools.map((tool) => tool.name);

    const resources = await client.listResources();
    report.resources = resources.resources.map((resource) => resource.uri);

    if (resources.resources[0]) {
      try {
        await client.readResource({ uri: resources.resources[0].uri });
        report.resourceReadOk = true;
      } catch (error) {
        report.resourceReadOk = false;
        report.errors.push(`resources/read failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      report.resourceReadOk = false;
      report.errors.push('No resources available for resources/read probe.');
    }

    const toolName = preferredProbeTool(tools.tools);
    report.probeTool = toolName;

    if (toolName) {
      try {
        await client.callTool({ name: toolName, arguments: probeArgs(toolName) });
        report.callOk = true;
      } catch (error) {
        report.callOk = false;
        report.errors.push(`tools/call failed (${toolName}): ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      report.callOk = false;
      report.errors.push('No tools available for tools/call probe.');
    }

    await client.close();
  } catch (error) {
    report.errors.push(`connect failed: ${error instanceof Error ? error.message : String(error)}`);
    try {
      await client.close();
    } catch {
      // ignore cleanup failures
    }
  }

  return report;
}

async function run(): Promise<void> {
  const [commandArg = 'help', ...args] = process.argv.slice(2);
  const command = (['help', 'dev', 'probe', 'connect', 'wire', 'swap', 'trace'] as const)
    .find((entry) => entry === commandArg) as CommandName | undefined;

  if (!command) {
    printHelp();
    process.exitCode = 1;
    return;
  }

  if (command === 'help') {
    printHelp();
    return;
  }

  if (command === 'probe') {
    const serverUrls = parseServerList(args);
    const reports = await Promise.all(serverUrls.map((url) => runProbe(url)));
    const ok = reports.every((report) => report.connected && report.callOk && report.resourceReadOk);

    console.log(JSON.stringify({ ok, reports }, null, 2));

    if (!ok) {
      process.exitCode = 1;
    }

    return;
  }

  if (command === 'trace') {
    const tail = Number.parseInt(getFlag(args, '--tail') ?? '20', 10);
    const runtime = await loadRuntime();

    try {
      const text = await readFile(runtime.traceFile, 'utf8');
      const lines = text.split('\n').filter((line) => line.trim().length > 0);
      const output = lines.slice(Math.max(0, lines.length - Math.max(1, tail)));
      output.forEach((line) => console.log(line));
    } catch {
      console.log('No trace file found yet.');
    }

    return;
  }

  const runtime = await loadRuntime();
  const conductor = await createHydratedConductor(runtime);
  try {
    if (command === 'dev') {
      const state = conductor.getState();
      const moduleSummaries = Object.values(state.modules) as Array<{ id: string; url: string; status: string }>;
      console.log(JSON.stringify({
        modules: moduleSummaries.map((module) => ({
          id: module.id,
          url: module.url,
          status: module.status,
        })),
        wiring: state.wiring,
        viewCount: state.views.length,
        eventCount: state.events.length,
        traceFile: runtime.traceFile,
      }, null, 2));
      return;
    }

    if (command === 'connect') {
      const id = getFlag(args, '--id');
      const url = getFlag(args, '--url');
      const profilePath = getFlag(args, '--profile');

      if (!id || !url) {
        throw new Error('connect requires --id and --url');
      }

      let manifest: ModuleManifest;
      let profile: ModuleRuntimeProfile | undefined;

      if (profilePath) {
        const profileText = await readFile(path.resolve(process.cwd(), profilePath), 'utf8');
        const parsedProfile = moduleProfileSchema.parse(JSON.parse(profileText));
        manifest = moduleManifestSchema.parse(parsedProfile.manifest);
        profile = parsedProfile.runtime;
      } else {
        manifest = moduleManifestSchema.parse({
          id,
          version: '0.1.0',
          displayName: id,
        });
        profile = undefined;
      }

      await conductor.registerModule({ id, url, manifest, profile });
      const capabilities = await conductor.discoverCapabilities(id);

      runtime.modules[id] = {
        id,
        url,
        manifest,
        profile,
      };

      runtime.wiring = conductor.getState().wiring;
      await saveRuntime(runtime);

      console.log(JSON.stringify({ id, url, capabilities: capabilities[id] }, null, 2));
      return;
    }

    if (command === 'wire') {
      const from = getFlag(args, '--from');
      const to = getFlag(args, '--to');
      const id = getFlag(args, '--id');

      if (!from || !to) {
        throw new Error('wire requires --from module:port and --to module:tool:arg');
      }

      const fromParsed = parseModulePort(from);
      const toParsed = parseModuleToolArg(to);

      const edge = conductor.connectPorts({
        id,
        from: {
          moduleId: fromParsed.moduleId,
          port: fromParsed.port,
        },
        to: {
          moduleId: toParsed.moduleId,
          tool: toParsed.tool,
          arg: toParsed.arg,
        },
        enabled: true,
      });

      runtime.wiring = conductor.getState().wiring;
      await saveRuntime(runtime);

      console.log(JSON.stringify(edge, null, 2));
      return;
    }

    if (command === 'swap') {
      const fromModuleId = getFlag(args, '--from');
      const toModuleId = getFlag(args, '--to');
      const mode = swapModeSchema.parse(getFlag(args, '--mode') ?? 'auto');

      if (!fromModuleId || !toModuleId) {
        throw new Error('swap requires --from and --to module ids');
      }

      const plan = await conductor.swapModule({ fromModuleId, toModuleId, mode });
      runtime.wiring = conductor.getState().wiring;
      await saveRuntime(runtime);

      console.log(JSON.stringify(plan, null, 2));
      return;
    }
  } finally {
    await conductor.close();
  }
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
