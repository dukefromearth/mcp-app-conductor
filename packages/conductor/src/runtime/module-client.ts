import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult, ReadResourceResult } from '@modelcontextprotocol/sdk/types.js';
import type { CapabilityInventory, PromptLike, ResourceLike, ToolLike } from '../types';

const IMPLEMENTATION = {
  name: 'mcp-app-conductor',
  version: '0.1.0'
};

export class ModuleClient {
  private readonly url: string;
  private client: Client | null;

  constructor(url: string) {
    this.url = url;
    this.client = null;
  }

  async connect(): Promise<void> {
    if (this.client) {
      return;
    }

    const client = new Client(IMPLEMENTATION);
    await client.connect(new StreamableHTTPClientTransport(new URL(this.url)));
    this.client = client;
  }

  async close(): Promise<void> {
    if (!this.client) {
      return;
    }

    await this.client.close();
    this.client = null;
  }

  async discoverCapabilities(): Promise<CapabilityInventory> {
    const client = await this.requireClient();

    const toolsResponse = await client.listTools();
    const tools: ToolLike[] = toolsResponse.tools.map((tool) => ({
      name: tool.name,
      inputSchema: tool.inputSchema as Record<string, unknown> | undefined,
      outputSchema: tool.outputSchema as Record<string, unknown> | undefined,
      _meta: tool._meta as Record<string, unknown> | undefined,
    }));

    const resourcesResponse = await client.listResources();
    const resources: ResourceLike[] = resourcesResponse.resources.map((resource) => ({
      uri: resource.uri,
      mimeType: resource.mimeType,
      _meta: resource._meta as Record<string, unknown> | undefined,
    }));

    let prompts: PromptLike[] = [];

    try {
      const promptsResponse = await client.listPrompts();
      prompts = promptsResponse.prompts.map((prompt) => ({
        name: prompt.name,
        description: prompt.description,
      }));
    } catch {
      prompts = [];
    }

    return {
      tools,
      resources,
      prompts,
      discoveredAt: new Date().toISOString(),
    };
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult> {
    const client = await this.requireClient();
    return client.callTool({ name, arguments: args }) as Promise<CallToolResult>;
  }

  async readResource(uri: string): Promise<ReadResourceResult> {
    const client = await this.requireClient();
    return client.readResource({ uri });
  }

  private async requireClient(): Promise<Client> {
    if (!this.client) {
      await this.connect();
    }

    if (!this.client) {
      throw new Error(`Failed to connect module client for ${this.url}`);
    }

    return this.client;
  }
}
