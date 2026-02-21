#!/usr/bin/env node

import { appendFile, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  CONTRACT_VERSION,
  createDefaultRuntimeConfig,
  defaultValidationPolicy,
  moduleManifestSchema,
  modulePortSpecifierSchema,
  moduleProfileSchema,
  moduleToolArgSpecifierSchema,
  persistedModuleSchema,
  runtimeConfigSchema,
  swapModeSchema,
  validationOutcomeSchema,
  type ModuleManifest,
  type ModuleRuntimeProfile,
  type RuntimeConfig,
  type ValidationBoundary,
  type ValidationIssue,
  type ValidationMode,
  type ValidationOutcome,
  type WiringEdge,
} from '@mcp-app-conductor/contracts';
import { createConductor, JsonlRecorder } from 'mcp-app-conductor';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

type CommandName = 'help' | 'dev' | 'probe' | 'connect' | 'wire' | 'swap' | 'trace';

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

class CliValidationError extends Error {
  readonly outcome: ValidationOutcome;

  constructor(outcome: ValidationOutcome) {
    super(outcome.message);
    this.name = 'CliValidationError';
    this.outcome = outcome;
  }
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

function toValidationIssues(error: { issues: Array<{ path: Array<string | number>; message: string; code: string }> }): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '<root>',
    message: issue.message,
    code: issue.code,
  }));
}

function createValidationOutcome(
  boundary: ValidationBoundary,
  mode: ValidationMode,
  message: string,
  issues: ValidationIssue[] = [],
): ValidationOutcome {
  return validationOutcomeSchema.parse({
    boundary,
    mode,
    ok: false,
    message,
    issues,
  });
}

function createValidationError(
  boundary: ValidationBoundary,
  mode: ValidationMode,
  message: string,
  issues: ValidationIssue[] = [],
): CliValidationError {
  return new CliValidationError(createValidationOutcome(boundary, mode, message, issues));
}

async function loadRuntime(): Promise<RuntimeConfig> {
  let text: string;

  try {
    text = await readFile(runtimeFile, 'utf8');
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      return createDefaultRuntimeConfig(defaultTraceFile);
    }

    throw error;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(text);
  } catch {
    throw createValidationError(
      'cli.runtimeConfig',
      defaultValidationPolicy['cli.runtimeConfig'],
      `Runtime config at ${runtimeFile} is not valid JSON.`,
      [{ path: '<root>', message: 'Invalid JSON document.', code: 'invalid_json' }],
    );
  }

  const parsed = runtimeConfigSchema.safeParse(parsedJson);
  if (!parsed.success) {
    throw createValidationError(
      'cli.runtimeConfig',
      defaultValidationPolicy['cli.runtimeConfig'],
      `Runtime config at ${runtimeFile} failed schema validation.`,
      toValidationIssues(parsed.error),
    );
  }

  return parsed.data;
}

async function saveRuntime(runtime: RuntimeConfig): Promise<void> {
  const parsed = runtimeConfigSchema.parse(runtime);
  await writeFile(runtimeFile, JSON.stringify(parsed, null, 2));
}

async function createHydratedConductor(runtime: RuntimeConfig) {
  const recorder = new JsonlRecorder({
    onLine: (line: string) => {
      void appendFile(runtime.traceFile, `${line}\n`);
    },
  });

  const conductor = createConductor({ recorder, validationPolicy: runtime.validationPolicy });

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

function parseModulePort(value: string, mode: ValidationMode): { moduleId: string; port: string } {
  const parsed = modulePortSpecifierSchema.safeParse(value);
  if (!parsed.success) {
    throw createValidationError(
      'cli.flags',
      mode,
      `Invalid --from value "${value}". Expected module:port.`,
      toValidationIssues(parsed.error),
    );
  }

  const [moduleId, port] = parsed.data.split(':');
  return { moduleId, port };
}

function parseModuleToolArg(value: string, mode: ValidationMode): { moduleId: string; tool: string; arg: string } {
  const parsed = moduleToolArgSpecifierSchema.safeParse(value);
  if (!parsed.success) {
    throw createValidationError(
      'cli.flags',
      mode,
      `Invalid --to value "${value}". Expected module:tool:arg.`,
      toValidationIssues(parsed.error),
    );
  }

  const [moduleId, tool, arg] = parsed.data.split(':');
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

async function readModuleProfile(profilePath: string, mode: ValidationMode) {
  let profileText: string;
  try {
    profileText = await readFile(path.resolve(process.cwd(), profilePath), 'utf8');
  } catch (error) {
    throw createValidationError(
      'cli.profile',
      mode,
      `Unable to read profile file "${profilePath}".`,
      [{ path: '<root>', message: error instanceof Error ? error.message : String(error), code: 'read_error' }],
    );
  }

  let profileJson: unknown;
  try {
    profileJson = JSON.parse(profileText);
  } catch {
    throw createValidationError(
      'cli.profile',
      mode,
      `Profile file "${profilePath}" is not valid JSON.`,
      [{ path: '<root>', message: 'Invalid JSON document.', code: 'invalid_json' }],
    );
  }

  const parsedProfile = moduleProfileSchema.safeParse(profileJson);
  if (!parsedProfile.success) {
    throw createValidationError(
      'cli.profile',
      mode,
      `Profile file "${profilePath}" failed schema validation.`,
      toValidationIssues(parsedProfile.error),
    );
  }

  return parsedProfile.data;
}

function defaultManifest(id: string): ModuleManifest {
  return moduleManifestSchema.parse({
    contractVersion: CONTRACT_VERSION,
    kind: 'module.manifest',
    extensions: {},
    id,
    version: '0.1.0',
    displayName: id,
  });
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

  const runtime = await loadRuntime();
  const flagsMode = runtime.validationPolicy['cli.flags'];
  const profileMode = runtime.validationPolicy['cli.profile'];

  if (command === 'trace') {
    const tail = Number.parseInt(getFlag(args, '--tail') ?? '20', 10);

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
        throw createValidationError(
          'cli.flags',
          flagsMode,
          'connect requires --id and --url',
          [{ path: '<root>', message: 'Missing required flags.', code: 'missing_flag' }],
        );
      }

      let manifest: ModuleManifest;
      let profile: ModuleRuntimeProfile | undefined;

      if (profilePath) {
        const parsedProfile = await readModuleProfile(profilePath, profileMode);
        manifest = moduleManifestSchema.parse(parsedProfile.manifest);
        profile = parsedProfile.runtime;
      } else {
        manifest = defaultManifest(id);
        profile = undefined;
      }

      await conductor.registerModule({ id, url, manifest, profile });
      const capabilities = await conductor.discoverCapabilities(id);

      runtime.modules[id] = persistedModuleSchema.parse({
        contractVersion: CONTRACT_VERSION,
        kind: 'canvas.persistedModule',
        extensions: {},
        id,
        url,
        manifest,
        profile,
      });

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
        throw createValidationError(
          'cli.flags',
          flagsMode,
          'wire requires --from module:port and --to module:tool:arg',
          [{ path: '<root>', message: 'Missing required flags.', code: 'missing_flag' }],
        );
      }

      const fromParsed = parseModulePort(from, flagsMode);
      const toParsed = parseModuleToolArg(to, flagsMode);

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
        throw createValidationError(
          'cli.flags',
          flagsMode,
          'swap requires --from and --to module ids',
          [{ path: '<root>', message: 'Missing required flags.', code: 'missing_flag' }],
        );
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
  if (error instanceof CliValidationError) {
    console.error(JSON.stringify(error.outcome, null, 2));
    process.exit(1);
    return;
  }

  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
