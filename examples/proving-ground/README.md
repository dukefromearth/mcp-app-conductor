# Proving Ground

Scenario harness for validating conductor wiring and shared-canvas behavior.

## Scripts

- `pnpm --filter @mcp-app-conductor/proving-ground probe`
: Protocol conformance probe for local MCP servers (`3001` PDF, `3002` Say by default).

- `pnpm --filter @mcp-app-conductor/proving-ground scenario:a`
: Runs the Read + Listen proving-ground flow (register modules, connect wiring, mount views, emit routed event).

## Module Profiles

- `modules/pdf.profile.json`
: DocumentSource profile (selection output).

- `modules/say.profile.json`
: AudioSink profile (`text` input routed to `say` tool).

## Scenario Status

- Scenario A: PDF selection -> Say speech (implemented scaffold + routed event simulation)
- Scenario B: Video playback -> Transcript subtitles (planned)
- Scenario C: Hot-swap source modules (handled by conductor swap planner + CLI)
