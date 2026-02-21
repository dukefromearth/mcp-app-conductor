import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

interface ProbeReport {
  url: string;
  connected: boolean;
  server?: { name?: string; version?: string };
  tools: string[];
  resources: string[];
  probeTool?: string;
  callOk: boolean;
  resourceReadOk: boolean;
  errors: string[];
}

function preferredProbeTool(tools: string[]): string | undefined {
  if (tools.includes('display_pdf')) return 'display_pdf';
  if (tools.includes('say')) return 'say';
  if (tools.includes('list_voices')) return 'list_voices';
  return tools[0];
}

function probeArgs(toolName: string): Record<string, unknown> {
  if (toolName === 'say') {
    return { text: 'Conformance probe.', autoPlay: false };
  }

  return {};
}

async function probeServer(url: string): Promise<ProbeReport> {
  const report: ProbeReport = {
    url,
    connected: false,
    tools: [],
    resources: [],
    callOk: false,
    resourceReadOk: false,
    errors: [],
  };

  const client = new Client({ name: 'mcp-canvas-probe', version: '0.1.0' });

  try {
    await client.connect(new StreamableHTTPClientTransport(new URL(url)));
    report.connected = true;
    report.server = {
      name: client.getServerVersion()?.name,
      version: client.getServerVersion()?.version,
    };

    const tools = await client.listTools();
    report.tools = tools.tools.map((tool) => tool.name);

    const resources = await client.listResources();
    report.resources = resources.resources.map((resource) => resource.uri);

    if (resources.resources[0]) {
      await client.readResource({ uri: resources.resources[0].uri });
      report.resourceReadOk = true;
    } else {
      report.errors.push('No resources available for read probe.');
    }

    const toolName = preferredProbeTool(report.tools);
    report.probeTool = toolName;

    if (toolName) {
      await client.callTool({ name: toolName, arguments: probeArgs(toolName) });
      report.callOk = true;
    } else {
      report.errors.push('No tools available for call probe.');
    }

    await client.close();
  } catch (error) {
    report.errors.push(error instanceof Error ? error.message : String(error));
    try {
      await client.close();
    } catch {
      // ignore
    }
  }

  return report;
}

async function main() {
  const urls = process.argv.slice(2);
  const targets = urls.length > 0 ? urls : ['http://localhost:3001/mcp', 'http://localhost:3002/mcp'];

  const reports = await Promise.all(targets.map((url) => probeServer(url)));
  const ok = reports.every((report) => report.connected && report.callOk && report.resourceReadOk);

  console.log(JSON.stringify({ ok, reports }, null, 2));

  if (!ok) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
