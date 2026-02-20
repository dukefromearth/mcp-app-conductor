#!/usr/bin/env node

import { moduleManifestSchema } from '@mcp-app-conductor/contracts';
import { greet } from 'mcp-app-conductor';

const [command = 'help'] = process.argv.slice(2);

function printHelp(): void {
  console.log('mcp-canvas commands:');
  console.log('  dev      Start the local conductor workflow (placeholder).');
  console.log('  connect  Connect a module endpoint (placeholder).');
  console.log('  help     Print this help output.');
}

switch (command) {
  case 'dev': {
    console.log(greet('Conductor CLI'));
    console.log('Starting dev workflow scaffolding...');
    break;
  }
  case 'connect': {
    const sample = moduleManifestSchema.parse({
      id: 'sample-module',
      version: '0.1.0',
      displayName: 'Sample Module'
    });

    console.log(`Connect flow placeholder for ${sample.id}.`);
    break;
  }
  default: {
    printHelp();
    break;
  }
}
