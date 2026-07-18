import { AIProvider } from '../types';
import { Logger } from '../utils/logger';

export abstract class BaseProvider {
    protected provider: AIProvider;

    constructor(provider: AIProvider) {
        this.provider = provider;
    }

    abstract complete(prompt: string): Promise<string>;

    protected async fetchWithAuth(url: string, options: RequestInit): Promise<Response> {
        const logger = Logger.getInstance();
        const source = this.provider.name || this.provider.alias;
        logger.debug(source, `Request: ${options.method || 'POST'} ${url}`);
        if (typeof options.body === 'string') {
            logger.debug(source, `Body: ${options.body.substring(0, 2000)}${options.body.length > 2000 ? '...' : ''}`);
        }

        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...(this.provider.customHeaders || {}),
            ...(options.headers as Record<string, string> || {})
        };

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            if (!response.ok) {
                const errorBody = await response.text();
                logger.error(source, `API request failed (${response.status})`, errorBody);
                throw new Error(`[${source}] API error (${response.status}): ${errorBody}`);
            }

            logger.debug(source, `Response: ${response.status}`);
            return response;
        } catch (error) {
            logger.error(source, `Network or API request failed`, error);
            throw error;
        }
    }
}
