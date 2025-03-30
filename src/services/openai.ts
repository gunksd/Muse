import OpenAI from 'openai';
import { elizaLogger } from "@elizaos/core";
import { MemeCoinSuggestion } from '../light_twitter-clients/environment.js';

export class OpenAIService {
    private openai: OpenAI;
    private model: string;

    constructor(apiKey: string, model: string = 'gpt-4') {
        this.openai = new OpenAI({
            apiKey: apiKey
        });
        this.model = model;
    }

    async generateMemeCoinSuggestion(tweetContent: string): Promise<MemeCoinSuggestion> {
        try {
            const prompt = `As a meme coin name generator, analyze the following tweet content and create a creative, catchy, and relevant meme coin name. Consider the sentiment, keywords, and cultural references in the content.

Tweet content: "${tweetContent}"

Please provide:
1. A creative meme coin name (should end with "coin", "token", or a cryptocurrency-related suffix)
2. A brief explanation of why this name fits the content

Format your response as JSON:
{
    "coinName": "suggested name",
    "reasoning": "explanation"
}`;

            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: "system",
                        content: "You are a creative meme coin name generator that creates relevant and catchy names based on tweet content."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 500
            });

            const result = response.choices[0]?.message?.content;
            
            if (!result) {
                throw new Error("No suggestion generated from OpenAI");
            }

            try {
                const parsed = JSON.parse(result);
                return {
                    coinName: parsed.coinName,
                    reasoning: parsed.reasoning
                };
            } catch (parseError: any) {
                elizaLogger.error("Error parsing OpenAI response:", parseError);
                return {
                    coinName: "DefaultCoin",
                    reasoning: "Could not generate a specific suggestion at this time."
                };
            }

        } catch (error: any) {
            elizaLogger.error("Error generating meme coin suggestion:", error);
            throw new Error(`Failed to generate meme coin suggestion: ${error?.message || 'Unknown error'}`);
        }
    }

    async validateSuggestion(suggestion: MemeCoinSuggestion): Promise<boolean> {
        try {
            const response = await this.openai.chat.completions.create({
                model: this.model,
                messages: [
                    {
                        role: "system",
                        content: "You are a content moderator for meme coin names. Validate if the suggested name is appropriate and not offensive."
                    },
                    {
                        role: "user",
                        content: `Please validate this meme coin suggestion:
Name: ${suggestion.coinName}
Reasoning: ${suggestion.reasoning}

Is this name:
1. Not offensive or inappropriate
2. Related to cryptocurrency or meme culture
3. Easy to remember and pronounce

Reply with just "true" or "false".`
                    }
                ],
                temperature: 0.1,
                max_tokens: 10
            });

            const result = response.choices[0]?.message?.content?.toLowerCase();
            return result === 'true';

        } catch (error: any) {
            elizaLogger.error("Error validating suggestion:", error);
            return false;
        }
    }

    formatResponse(suggestion: MemeCoinSuggestion, template: string): string {
        return template
            .replace("{coinName}", suggestion.coinName)
            .replace("{reasoning}", suggestion.reasoning);
    }
}