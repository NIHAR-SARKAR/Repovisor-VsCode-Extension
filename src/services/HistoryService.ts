import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import Database from 'better-sqlite3';
import { ReviewResult, Finding, RuleResult, ReviewHistory } from '../types';

export interface IHistoryService {
    saveReview(result: ReviewResult): void;
    getHistory(page?: number, perPage?: number, query?: string): ReviewHistory;
    getReviewById(id: string): ReviewResult | undefined;
    clearHistory(): void;
    close(): void;
}

export class HistoryService implements IHistoryService {
    private db: Database.Database;

    constructor(globalStorageUri: vscode.Uri) {
        const dbDir = globalStorageUri.fsPath;
        const dbPath = path.join(dbDir, 'repovisor-history.db');
        if (!fs.existsSync(dbDir)) {
            fs.mkdirSync(dbDir, { recursive: true });
        }
        this.db = new Database(dbPath);
        this.initialize();
    }

    private initialize(): void {
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS reviews (
                id TEXT PRIMARY KEY,
                repo TEXT,
                prNumber INTEGER,
                platform TEXT,
                providerUsed TEXT NOT NULL,
                modelUsed TEXT NOT NULL,
                summary TEXT NOT NULL,
                riskLevel TEXT NOT NULL,
                findings TEXT NOT NULL,
                rulesTriggered TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                duration INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_reviews_timestamp ON reviews(timestamp DESC);
            CREATE INDEX IF NOT EXISTS idx_reviews_repo ON reviews(repo);
        `);
    }

    saveReview(result: ReviewResult): void {
        const stmt = this.db.prepare(`
            INSERT INTO reviews (
                id, repo, prNumber, platform, providerUsed, modelUsed,
                summary, riskLevel, findings, rulesTriggered, timestamp, duration
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            result.id,
            result.repo || null,
            result.prNumber || null,
            result.repo ? (result.platform || 'github') : null,
            result.providerUsed,
            result.modelUsed,
            result.summary,
            result.riskLevel,
            JSON.stringify(result.findings),
            JSON.stringify(result.rulesTriggered),
            result.timestamp instanceof Date ? result.timestamp.toISOString() : new Date(result.timestamp).toISOString(),
            result.duration
        );
    }

    getHistory(page: number = 1, perPage: number = 10, query?: string): ReviewHistory {
        let countSql = 'SELECT COUNT(*) as total FROM reviews';
        let dataSql = 'SELECT * FROM reviews';
        const whereParams: (string | number)[] = [];

        if (query && query.trim()) {
            const q = `%${query.trim()}%`;
            countSql += ' WHERE repo LIKE ? OR summary LIKE ? OR findings LIKE ?';
            dataSql += ' WHERE repo LIKE ? OR summary LIKE ? OR findings LIKE ?';
            whereParams.push(q, q, q);
        }

        dataSql += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';

        const total = this.db.prepare(countSql).get(...whereParams) as { total: number };
        const rows = this.db.prepare(dataSql).all(...whereParams, perPage, (page - 1) * perPage) as any[];

        return {
            reviews: rows.map(row => this.rowToReviewResult(row)),
            total: total?.total ?? 0,
            page,
            perPage
        };
    }

    getReviewById(id: string): ReviewResult | undefined {
        const row = this.db.prepare('SELECT * FROM reviews WHERE id = ?').get(id) as any;
        return row ? this.rowToReviewResult(row) : undefined;
    }

    clearHistory(): void {
        this.db.exec('DELETE FROM reviews');
    }

    close(): void {
        this.db.close();
    }

    private rowToReviewResult(row: any): ReviewResult {
        return {
            id: row.id,
            repo: row.repo || undefined,
            prNumber: row.prNumber || undefined,
            platform: row.platform || undefined,
            providerUsed: row.providerUsed,
            modelUsed: row.modelUsed,
            summary: row.summary,
            riskLevel: row.riskLevel,
            findings: JSON.parse(row.findings) as Finding[],
            rulesTriggered: JSON.parse(row.rulesTriggered) as RuleResult[],
            timestamp: new Date(row.timestamp),
            duration: row.duration
        };
    }
}
