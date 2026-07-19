import { ReviewResult, ReviewHistory } from '../types';
import { IHistoryService } from './HistoryService';

export class MemoryHistoryService implements IHistoryService {
    private reviews: ReviewResult[] = [];

    saveReview(result: ReviewResult): void {
        this.reviews.unshift(result);
    }

    getHistory(page: number = 1, perPage: number = 10, query?: string): ReviewHistory {
        let filtered = this.reviews;
        if (query && query.trim()) {
            const q = query.trim().toLowerCase();
            filtered = this.reviews.filter(r =>
                (r.repo && r.repo.toLowerCase().includes(q)) ||
                r.summary.toLowerCase().includes(q) ||
                JSON.stringify(r.findings).toLowerCase().includes(q)
            );
        }
        const start = (page - 1) * perPage;
        return {
            reviews: filtered.slice(start, start + perPage),
            total: filtered.length,
            page,
            perPage
        };
    }

    getReviewById(id: string): ReviewResult | undefined {
        return this.reviews.find(r => r.id === id);
    }

    clearHistory(): void {
        this.reviews = [];
    }

    close(): void {
        // no-op
    }
}
