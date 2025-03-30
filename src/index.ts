import { DirectClient } from "@elizaos/client-direct";
import {
  AgentRuntime,
  elizaLogger,
  settings,
  stringToUuid,
  type Character,
  type ModelProviderName,
  type Service,
  type ServiceType,
} from "@elizaos/core";
import { bootstrapPlugin } from "@elizaos/plugin-bootstrap";
import { createNodePlugin } from "@elizaos/plugin-node";
import { getGiftPlugin } from "./custom-plugins/index.ts";
import { evmPlugin } from "@elizaos/plugin-evm";
import fs from "fs";
import net from "net";
import path from "path";
import { fileURLToPath } from "url";
import { initializeDbCache } from "./cache/index.ts";
import { character } from "./character.ts";
import { startChat } from "./chat/index.ts";
import { initializeClients } from "./clients/index.ts";
import {
  getTokenForProvider,
  loadCharacters,
  parseArguments,
} from "./config/index.ts";
import { initializeDatabase } from "./database/index.ts";
import OpenAI from 'openai';

// 定义 OpenAIService 类
class OpenAIService implements Service {
    private openai: OpenAI;
    private model: string;
    public readonly serviceType: ServiceType = 'language' as ServiceType;  // 修改为 'language'

    constructor(apiKey: string, model: string = 'gpt-4') {
        this.openai = new OpenAI({
            apiKey: apiKey
        });
        this.model = model;
    }

    async initialize(): Promise<void> {
        elizaLogger.debug('Initializing OpenAI service');
        // 验证 API key
        try {
            await this.openai.models.list();
            elizaLogger.success('OpenAI service initialized successfully');
        } catch (error) {
            elizaLogger.error('Failed to initialize OpenAI service:', error);
            throw error;
        }
    }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const wait = (minTime: number = 1000, maxTime: number = 3000) => {
  const waitTime =
    Math.floor(Math.random() * (maxTime - minTime + 1)) + minTime;
  return new Promise((resolve) => setTimeout(resolve, waitTime));
};

let nodePlugin: any | undefined;

const OPENAI_PROVIDER: ModelProviderName = 'openai' as ModelProviderName;

export function createAgent(
  character: Character,
  db: any,
  cache: any,
  token: string
) {
  elizaLogger.success(
    elizaLogger.successesTitle,
    "Creating runtime for character",
    character.name,
  );

  nodePlugin ??= createNodePlugin();
  const openaiService = new OpenAIService(token);

  return new AgentRuntime({
    databaseAdapter: db,
    token,
    modelProvider: OPENAI_PROVIDER,
    evaluators: [],
    character,
    plugins: [
      bootstrapPlugin,
      nodePlugin,
      getGiftPlugin,
      evmPlugin,
    ].filter(Boolean),
    providers: [],
    actions: [],
    services: [openaiService],
    managers: [],
    cacheManager: cache,
  });
}

async function startAgent(character: Character, directClient: DirectClient) {
  try {
    character.id ??= stringToUuid(character.name);
    character.username ??= character.name;
    character.modelProvider = OPENAI_PROVIDER;

    const token = process.env.OPENAI_API_KEY;
    console.log(`Token provider is ${OPENAI_PROVIDER}`);
    
    if(!token) {
      throw new Error("OpenAI API key not found in environment variables");
    }

    const dataDir = path.join(__dirname, "../data");

    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    const db = initializeDatabase(dataDir);

    await db.init();

    const cache = initializeDbCache(character, db);
    const runtime = createAgent(character, db, cache, token);

    await runtime.initialize();

    runtime.clients = await initializeClients(character, runtime);

    directClient.registerAgent(runtime);

    elizaLogger.debug(`Started ${character.name} as ${runtime.agentId}`);

    return runtime;
  } catch (error) {
    elizaLogger.error(
      `Error starting agent for character ${character.name}:`,
      error,
    );
    console.error(error);
    throw error;
  }
}

const checkPortAvailable = (port: number): Promise<boolean> => {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        resolve(false);
      }
    });

    server.once("listening", () => {
      server.close();
      resolve(true);
    });

    server.listen(port);
  });
};

const startAgents = async () => {
  process.env.CURRENT_UTC_TIME = "2025-03-30 13:36:54";
  process.env.CURRENT_USER = "gunksd";

  const directClient = new DirectClient();
  let serverPort = parseInt(settings.SERVER_PORT || "3000");
  const args = parseArguments();

  let charactersArg = args.characters || args.character;
  let characters = [character];

  console.log("charactersArg", charactersArg);
  if (charactersArg) {
    characters = await loadCharacters(charactersArg);
  }

  characters = characters.map(char => ({
    ...char,
    modelProvider: OPENAI_PROVIDER
  }));

  console.log("characters", characters);
  try {
    for (const character of characters) {
      await startAgent(character, directClient as DirectClient);
    }
  } catch (error) {
    elizaLogger.error("Error starting agents:", error);
  }

  while (!(await checkPortAvailable(serverPort))) {
    elizaLogger.warn(`Port ${serverPort} is in use, trying ${serverPort + 1}`);
    serverPort++;
  }

  directClient.startAgent = async (character: Character) => {
    return startAgent(character, directClient);
  };

  directClient.start(serverPort);

  if (serverPort !== parseInt(settings.SERVER_PORT || "3000")) {
    elizaLogger.log(`Server started on alternate port ${serverPort}`);
  }

  const isDaemonProcess = process.env.DAEMON_PROCESS === "true";
  if(!isDaemonProcess) {
    elizaLogger.log("Chat started. Type 'exit' to quit.");
    const chat = startChat(characters);
    chat();
  }
};

startAgents().catch((error) => {
  elizaLogger.error("Unhandled error in startAgents:", error);
  process.exit(1);
});