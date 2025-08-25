import { GoogleGenAI } from "@google/genai";
import { Message } from "../../types/chat";

/**
 * Configuration options for the GeminiChatService class.
 * Adapted from GTTS project for React frontend use.
 */
interface GeminiChatConfig {
  /** API key for accessing the Google Generative AI service. */
  apiKey: string;
  /** Model type to be used with the Google Generative AI service. */
  model?:
    | "gemini-2.5-flash"
    | "gemini-2.5-flash-lite" 
    | "gemini-2.5-pro"
    | "gemini-1.5-pro-latest"
    | "gemini-1.5-flash-latest" 
    | "gemini-1.5-pro"
    | "gemini-1.5-flash"
    | "gemini-1.0-pro"
    | "gemini-pro-vision"
    | "gemini-pro";
  /** Whether to enable logging. Defaults to false. */
  enableLogging?: boolean;
}

/**
 * Service class for interacting with Google's Generative AI service (Gemini).
 * Adapted from GTTS project for our React application.
 * Provides methods for generating text responses based on prompts.
 */
export class GeminiChatService {
  private readonly client: GoogleGenAI;
  private readonly enableLogging: boolean;
  private conversationHistory: Array<{ role: 'user' | 'model'; parts: string }> = [];

  /**
   * Creates a new GeminiChatService instance.
   * @param config - Configuration options for the service.
   * @throws {Error} If the API key is missing.
   */
  constructor(config: GeminiChatConfig) {
    if (!config.apiKey) {
      throw new Error("API key is missing. Please provide a valid API key.");
    }

    this.client = new GoogleGenAI({ apiKey: config.apiKey });
    this.enableLogging = config.enableLogging ?? false;
  }

  /**
   * Generates a response based on the given prompt using the Google Generative AI service.
   * @param prompt - The input prompt for generating the response.
   * @returns A Promise that resolves to the generated response text.
   */
  public async generateResponse(prompt: string): Promise<string> {
    try {
      const result = await this.client.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ 
          role: 'user',
          parts: [{ text: prompt }] 
        }]
      });
      
      const response = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";

      // Store conversation history
      this.conversationHistory.push(
        { role: 'user', parts: prompt },
        { role: 'model', parts: response }
      );

      this.log([`User Prompt: ${prompt}`, `Generated Response: ${response}`]);

      return response;
    } catch (error) {
      this.log(`Error generating response: ${error}`);
      throw new Error(`Failed to generate response: ${error}`);
    }
  }

  /**
   * Generates a response with conversation context using chat session.
   * @param message - The input message for generating the response.
   * @param chatHistory - Previous messages from the current chat room for context
   * @returns A Promise that resolves to the generated response text.
   */
  public async chat(message: string, chatHistory: Message[] = []): Promise<string> {
    try {
      return this.generateResponseWithHistory(message, chatHistory);
    } catch (error) {
      this.log(`Error in chat: ${error}`);
      throw new Error(`Failed to generate chat response: ${error}`);
    }
  }

  /**
   * Generates a response with conversation context from chat history.
   * @param message - The input message for generating the response.
   * @param chatHistory - Previous messages from the current chat room
   * @returns A Promise that resolves to the generated response text.
   */
  public async generateResponseWithHistory(message: string, chatHistory: Message[] = []): Promise<string> {
    try {
      this.log(`Generating response with ${chatHistory.length} previous messages`);

      // Convert chat history to Gemini API format
      const contents = this.buildConversationContents(chatHistory, message);

      const result = await this.client.models.generateContent({
        model: "gemini-1.5-flash",
        contents: contents
      });
      
      const response = result.candidates?.[0]?.content?.parts?.[0]?.text || "Sorry, I couldn't generate a response.";

      // Update internal conversation history
      this.conversationHistory.push(
        { role: 'user', parts: message },
        { role: 'model', parts: response }
      );

      this.log([
        `User Prompt: ${message}`,
        `Generated Response: ${response}`,
        `Total history items: ${this.conversationHistory.length}`
      ]);

      return response;
    } catch (error) {
      this.log(`Error generating response with history: ${error}`);
      throw new Error(`Failed to generate response: ${error}`);
    }
  }

  /**
   * Builds conversation contents from chat history for Gemini API.
   * @param chatHistory - Previous messages from the chat room
   * @param currentMessage - The current user message
   * @returns Array of contents for Gemini API
   */
  private buildConversationContents(chatHistory: Message[], currentMessage: string) {
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    // Add chat history (limit to last 20 messages for context window management)
    const recentHistory = chatHistory.slice(-20);
    
    for (const msg of recentHistory) {
      if (msg.type === 'user' || msg.type === 'assistant') {
        contents.push({
          role: msg.type === 'user' ? 'user' : 'model',
          parts: [{ text: msg.content }]
        });
      }
    }

    // Add current message
    contents.push({
      role: 'user',
      parts: [{ text: currentMessage }]
    });

    this.log(`Built conversation with ${contents.length} messages (${recentHistory.length} from history + 1 current)`);
    
    return contents;
  }

  /**
   * Clears the conversation history.
   */
  public clearHistory(): void {
    this.conversationHistory = [];
    this.log('Conversation history cleared');
  }

  /**
   * Gets the current conversation history.
   * @returns Array of conversation history items.
   */
  public getHistory(): Array<{ role: 'user' | 'model'; parts: string }> {
    return [...this.conversationHistory];
  }

  /**
   * Sets the conversation history (useful for resuming conversations).
   * @param history - Array of conversation history items.
   */
  public setHistory(history: Array<{ role: 'user' | 'model'; parts: string }>): void {
    this.conversationHistory = [...history];
    this.log(`Conversation history set with ${history.length} items`);
  }

  /**
   * Logs information if logging is enabled.
   * @param info - Information to be logged. Can be a string or an array of strings.
   */
  private log(info: string | string[]): void {
    if (!this.enableLogging) return;

    const logMessage = Array.isArray(info)
      ? info.map((line) => `* ${line}`).join("\n")
      : `* ${info}`;

    console.log(`[DEBUG GeminiChatService]\n${logMessage}`);
  }
}

// Export types for use in other parts of the application
export type { GeminiChatConfig };