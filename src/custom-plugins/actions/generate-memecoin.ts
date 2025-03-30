import { 
    Action, 
    Content, 
    IAgentRuntime, 
    Memory, 
    State, 
    HandlerCallback, 
    elizaLogger,
    Service
  } from "@elizaos/core";
  
  export interface MemeCoinSuggestion {
    coinName: string;
    reasoning: string;
  }
  
  export interface ActionExample {
    user: string;
    content: Content;
  }
  
  // 定义语言服务接口
  interface LanguageService extends Service {
    generateText(prompt: string): Promise<string>;
  }
  
  const PROHIBITED_TERMS = [
    "scam",
    "rug",
    "ponzi",
  ];
  
  export const generateMemeCoinAction: Action = {
    name: 'GENERATE_MEMECOIN',
    similes: ['CREATE_MEMECOIN', 'MEMECOIN_NAME', 'COIN_SUGGESTION'],
    description: 'Analyzes content and generates creative meme coin names based on current trends and cultural references.',
  
    async validate(runtime: IAgentRuntime, message: Memory, state?: State): Promise<boolean> {
      // 检查是否有 OpenAI 服务可用
      const services = Array.from(runtime.services.values());
      const hasOpenAIService = services.some(s => 'language' in s);
      // 检查消息是否包含文本内容
      const hasContent = message?.content?.text?.length > 0;
      return hasOpenAIService && hasContent;
    },
  
    async handler(
      runtime: IAgentRuntime,
      message: Memory,
      state?: State,
      options?: any,
      callback?: HandlerCallback
    ): Promise<boolean> {
      try {
        const currentTime = "2025-03-30 14:05:25";
        const currentUser = "gunksd";
        
        elizaLogger.debug(`Generating meme coin for content from ${currentUser} at ${currentTime}`);
  
        // 使用 OpenAI 服务生成建议
        const services = Array.from(runtime.services.values());
        const openaiService = services.find(s => 'generateText' in s) as LanguageService;
        
        if (!openaiService) {
          const responseContent: Content = {
            thought: "OpenAI service is not available",
            text: "Sorry, I cannot generate meme coin names at the moment.",
            actions: ['GENERATE_MEMECOIN']
          };
          if (callback) await callback(responseContent);
          return false;
        }
  
        const suggestion = await generateSuggestion(message.content.text, openaiService);
        
        if (isValidSuggestion(suggestion)) {
          const responseContent: Content = {
            thought: `Generated a meme coin name based on the content: ${suggestion.reasoning}`,
            text: `🎯 Generated Meme Coin: ${suggestion.coinName}\n📝 Reasoning: ${suggestion.reasoning}`,
            actions: ['GENERATE_MEMECOIN'],
            attachments: []
          };
          if (callback) await callback(responseContent);
          return true;
        } else {
          const responseContent: Content = {
            thought: "Generated name contained prohibited terms",
            text: "I couldn't generate an appropriate meme coin name. Let me try again with different parameters.",
            actions: ['GENERATE_MEMECOIN']
          };
          if (callback) await callback(responseContent);
          return false;
        }
  
      } catch (error) {
        elizaLogger.error("Error in generateMemeCoin handler:", error);
        const responseContent: Content = {
          thought: `Error occurred: ${error instanceof Error ? error.message : String(error)}`,
          text: "Sorry, I encountered an error while generating the meme coin name.",
          actions: ['GENERATE_MEMECOIN']
        };
        if (callback) await callback(responseContent);
        return false;
      }
    },
  
    examples: [
      [
        {
          user: "{{user1}}",
          content: { 
            text: "Can you create a meme coin based on space exploration?",
            actions: []
          }
        },
        {
          user: "{{assistant}}",
          content: {
            text: "🎯 Generated Meme Coin: MOONSHOT\n📝 Reasoning: Combines space exploration theme with crypto terminology, suggesting upward momentum.",
            thought: "Using space exploration theme to create a memorable and trendy name",
            actions: ["GENERATE_MEMECOIN"]
          }
        }
      ],
      [
        {
          user: "{{user2}}",
          content: { 
            text: "Generate a cat-themed meme coin",
            actions: []
          }
        },
        {
          user: "{{assistant}}",
          content: {
            text: "🎯 Generated Meme Coin: PURRCOIN\n📝 Reasoning: Playful combination of cat sound with crypto, appeals to pet lovers and meme culture.",
            thought: "Leveraging popular pet theme with wordplay",
            actions: ["GENERATE_MEMECOIN"]
          }
        }
      ]
    ]
  };
  
  async function generateSuggestion(text: string, service: LanguageService): Promise<MemeCoinSuggestion> {
    try {
      const prompt = `As a meme coin name generator, analyze the following content and create a creative, catchy, and relevant meme coin name:
  
  Content: "${text}"
  
  Consider:
  1. Cultural references
  2. Current trends
  3. Memorable and unique naming
  4. Positive associations
  
  Format your response as JSON:
  {
      "coinName": "suggested name",
      "reasoning": "brief explanation"
  }`;
  
      const response = await service.generateText(prompt);
      
      try {
        const parsed = JSON.parse(response);
        return {
          coinName: parsed.coinName,
          reasoning: parsed.reasoning
        };
      } catch (parseError) {
        elizaLogger.error("Error parsing service response:", parseError);
        return {
          coinName: "GenericCoin",
          reasoning: "Fallback due to parsing error"
        };
      }
  
    } catch (error) {
      elizaLogger.error("Error generating suggestion:", error);
      throw error;
    }
  }
  
  function isValidSuggestion(suggestion: MemeCoinSuggestion): boolean {
    const lowercaseContent = suggestion.coinName.toLowerCase();
    return !PROHIBITED_TERMS.some(term => lowercaseContent.includes(term));
  }
  
  export default generateMemeCoinAction;