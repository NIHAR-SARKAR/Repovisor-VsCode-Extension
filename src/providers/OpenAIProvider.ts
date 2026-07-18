import { BaseProvider } from './BaseProvider';

export class OpenAIProvider extends BaseProvider {
    async complete(prompt: string): Promise<string> {
        const response = await this.fetchWithAuth(
            `${this.provider.baseUrl}/chat/completions`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.provider.apiKey}`
                },
                body: JSON.stringify({
                    model: this.provider.defaultModel,
                    messages: [
                        { role: 'system', content: 'You are an expert code reviewer. Always respond with valid JSON arrays only.' },
                        { role: 'user', content: prompt }
                    ],
                    temperature: 0.2,
                    max_tokens: 4000,
                    response_format: { type: 'json_object' }
                })
            }
        );

        const data = await response.json() as any;
        const content = data.choices?.[0]?.message?.content;
        if (!content) {
            throw new Error('Empty response from OpenAI');
        }
        return content;
    }
}
