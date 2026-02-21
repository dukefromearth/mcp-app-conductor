import type { EventEnvelope } from '@mcp-app-conductor/contracts';

export interface JsonlRecorderOptions {
  maxLines?: number;
  onLine?: (line: string, event: EventEnvelope) => void;
}

export class JsonlRecorder {
  private readonly lines: string[];
  private readonly maxLines: number;
  private readonly onLine?: (line: string, event: EventEnvelope) => void;

  constructor(options: JsonlRecorderOptions = {}) {
    this.lines = [];
    this.maxLines = options.maxLines ?? 5_000;
    this.onLine = options.onLine;
  }

  record(event: EventEnvelope): string {
    const line = JSON.stringify(event);
    this.lines.push(line);

    if (this.lines.length > this.maxLines) {
      this.lines.splice(0, this.lines.length - this.maxLines);
    }

    this.onLine?.(line, event);
    return line;
  }

  tail(limit = 100): string[] {
    return this.lines.slice(-limit);
  }

  toString(): string {
    return this.lines.join('\n');
  }
}
