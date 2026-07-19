import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class Logger {
    private static instance: Logger | undefined;
    private outputChannel: vscode.OutputChannel | undefined;
    private logFilePath: string | undefined;
    private isDev: boolean;

    static initialize(context: vscode.ExtensionContext): void {
        Logger.instance = new Logger(context);
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    static initializeConsoleLogger(): Logger {
        Logger.instance = new Logger();
        return Logger.instance;
    }

    private constructor(context?: vscode.ExtensionContext) {
        this.isDev = context ? context.extensionMode === vscode.ExtensionMode.Development : false;

        if (this.isDev && context) {
            this.outputChannel = vscode.window.createOutputChannel('Repovisor AI Logs');
            const logDir = context.globalStorageUri.fsPath;
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
            this.logFilePath = path.join(logDir, 'repovisor.log');
            this.info('Logger', `Logger initialized in development mode. Log file: ${this.logFilePath}`);
        }
    }

    private write(level: string, source: string, message: string, error?: any): void {
        const timestamp = new Date().toISOString();
        let line = `[${timestamp}] [${level}] [${source}] ${message}`;

        if (error !== undefined && error !== null) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            line += `\n  Error: ${errorMessage}`;
            if (error instanceof Error && error.stack) {
                line += `\n  Stack: ${error.stack}`;
            }
        }

        console.log(line);

        if (this.isDev) {
            this.outputChannel?.appendLine(line);
            if (this.logFilePath) {
                try {
                    fs.appendFileSync(this.logFilePath, line + '\n');
                } catch (err) {
                    console.error('Failed to write to log file:', err);
                }
            }
        }
    }

    info(source: string, message: string): void {
        this.write('INFO', source, message);
    }

    debug(source: string, message: string): void {
        this.write('DEBUG', source, message);
    }

    warn(source: string, message: string, error?: any): void {
        this.write('WARN', source, message, error);
    }

    error(source: string, message: string, error?: any): void {
        this.write('ERROR', source, message, error);
    }
}

export function formatError(source: string, error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return `[${source}] ${message}`;
}
