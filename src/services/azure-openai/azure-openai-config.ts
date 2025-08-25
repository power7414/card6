/**
 * Azure OpenAI API 設定
 */

export interface AzureOpenAIConfig {
  endpoint: string;
  apiKey: string;
  deploymentName: string;
  apiVersion: string;
}

export const azureOpenAIConfig: AzureOpenAIConfig = {
  endpoint: process.env.REACT_APP_AZURE_OPENAI_ENDPOINT || 'https://9h00100.openai.azure.com',
  apiKey: process.env.REACT_APP_AZURE_OPENAI_API_KEY || '',
  deploymentName: process.env.REACT_APP_AZURE_OPENAI_DEPLOYMENT_NAME || '9h00100-voicebot-gpt-4.1',
  apiVersion: process.env.REACT_APP_AZURE_OPENAI_API_VERSION || '2025-01-01-preview',
};

/**
 * 建立 Azure OpenAI API URL
 */
export function createAzureOpenAIUrl(config: AzureOpenAIConfig, endpoint: string = 'chat/completions'): string {
  return `${config.endpoint}/openai/deployments/${config.deploymentName}/${endpoint}?api-version=${config.apiVersion}`;
}

/**
 * 建立 Azure OpenAI API Headers
 */
export function createAzureOpenAIHeaders(config: AzureOpenAIConfig): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'api-key': config.apiKey,
  };
}