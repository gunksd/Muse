export * from "./providers/wallet.ts";
export * from "./types/index.ts";

import type { Plugin } from "@elizaos/core";
import { evmWalletProvider } from "./providers/wallet.ts";
import { generateMemeCoinAction } from "./actions/generate-memecoin.ts";  // 修改导入路径

export const getGiftPlugin: Plugin = {
    name: "memeCoinPlugin",
    description: "Meme Coin generation and blockchain integration plugin",
    providers: [evmWalletProvider],
    evaluators: [],
    services: [],
    actions: [generateMemeCoinAction],
};

export default getGiftPlugin;