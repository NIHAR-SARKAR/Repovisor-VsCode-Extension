import { BaseProvider } from './BaseProvider';

export class AnthropicProvider extends BaseProvider {
    async complete(prompt: string): Promise<string> {
        const response = await this.fetchWithAuth(
            `${this.provider.baseUrl}/v1/messages`,
            {
                method: 'POST',
                headers: {
                    'x-api-key': this.provider.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: this.provider.defaultModel,
                    max_tokens: 4000,
                    temperature: 0.2,
                    system: 'You are an expert code reviewer. Always respond with valid JSON arrays only. No markdown formatting.',
                    messages: [
                        { role: 'user', content: prompt }
                    ]
                })
            }
        );

        const data = await response.json() as any;
        const content = data.content?.[0]?.text;
        if (!content) {
            throw new Error('Empty response from Anthropic');
        }
        return content;
    }
}
