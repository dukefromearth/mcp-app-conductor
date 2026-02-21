import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { moduleProfileSchema } from '@mcp-app-conductor/contracts';
import { createConductor, JsonlRecorder } from 'mcp-app-conductor';

async function readProfile(filePath: string) {
  const text = await readFile(filePath, 'utf8');
  return moduleProfileSchema.parse(JSON.parse(text));
}

async function main() {
  const root = path.resolve(import.meta.dirname, '..');
  const pdfProfile = await readProfile(path.join(root, 'modules/pdf.profile.json'));
  const sayProfile = await readProfile(path.join(root, 'modules/say.profile.json'));

  const conductor = createConductor({
    recorder: new JsonlRecorder(),
  });

  await conductor.registerModule({
    id: 'pdf',
    url: 'http://localhost:3001/mcp',
    manifest: pdfProfile.manifest,
    profile: pdfProfile.runtime,
  });

  await conductor.registerModule({
    id: 'say',
    url: 'http://localhost:3002/mcp',
    manifest: sayProfile.manifest,
    profile: sayProfile.runtime,
  });

  await conductor.discoverCapabilities();

  conductor.connectPorts({
    from: { moduleId: 'pdf', port: 'selectionText' },
    to: { moduleId: 'say', tool: 'say', arg: 'text' },
    enabled: true,
  });

  await conductor.mountView({
    moduleId: 'pdf',
    toolName: 'display_pdf',
    mountPoint: 'main',
    args: {},
  });

  await conductor.mountView({
    moduleId: 'say',
    toolName: 'say',
    mountPoint: 'pip',
    args: { text: 'Read + Listen scenario is live.', autoPlay: false },
  });

  await conductor.emitPortEvent({
    moduleId: 'pdf',
    port: 'selectionText',
    data: 'This text was routed from PDF DocumentSource to Say AudioSink.',
  });

  const state = conductor.getState();

  console.log(JSON.stringify({
    moduleCount: Object.keys(state.modules).length,
    wiringCount: state.wiring.length,
    viewCount: state.views.length,
    eventCount: state.events.length,
    latestEvents: state.events.slice(-5).map((event) => ({
      type: event.type,
      traceId: event.traceId,
      source: event.source,
    })),
  }, null, 2));

  await conductor.close();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
