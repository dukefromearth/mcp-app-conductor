import { moduleManifestSchema } from '@mcp-app-conductor/contracts';
import { greet } from 'mcp-app-conductor';
import './style.css';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing #app mount point');
}

const manifest = moduleManifestSchema.parse({
  id: 'demo-module',
  version: '0.1.0',
  displayName: 'Demo Module',
  views: [{ resourceUri: 'ui://demo/view', displayModes: ['main'] }]
});

app.innerHTML = `
  <section>
    <h1>${greet('Canvas Host')}</h1>
    <p>Loaded manifest for <strong>${manifest.displayName}</strong>.</p>
    <p>This app is the scaffold for the shared multi-view canvas host.</p>
  </section>
`;
