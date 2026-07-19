import { RuleResult, ChangedFile } from '../types';

export class RuleEngine {
    private builtInRules = [
        {
            name: 'forbid_console_logs',
            type: 'regex',
            pattern: /console\.log|print\(|debugger;|fmt\.Println\(/g,
            severity: 'low' as const,
            message: 'Debug logging statement found'
        },
        {
            name: 'no_secrets',
            type: 'regex', 
            pattern: /(api[_-]?key|password|secret|token)\s*[:=]\s*["'][^"']{8,}["']/gi,
            severity: 'critical' as const,
            message: 'Potential secret exposure detected'
        },
        {
            name: 'require_tests',
            type: 'file_presence',
            pattern: /\.test\.|\.spec\.|_test\./,
            severity: 'medium' as const,
            message: 'Source file changes without corresponding test updates'
        }
    ];

    evaluate(diffContent: string, files: ChangedFile[]): RuleResult[] {
        return this.builtInRules.map(rule => {
            if (rule.type === 'regex') {
                const matches = diffContent.match(rule.pattern) || [];
                return {
                    ruleName: rule.name,
                    ruleType: rule.type,
                    severity: rule.severity,
                    matched: matches.length > 0,
                    matches: matches.slice(0, 10)
                };
            }
            const sourceFiles = files.filter(f => 
                !f.filename.includes('test') && 
                !f.filename.includes('spec') &&
                /\.(js|ts|py|java|go|rs|cpp|c|rb|php)$/.test(f.filename)
            );
            const hasTests = files.some(f => 
                /\.(test|spec)\./.test(f.filename) || /_test\./.test(f.filename)
            );
            return {
                ruleName: rule.name,
                ruleType: rule.type,
                severity: rule.severity,
                matched: sourceFiles.length > 0 && !hasTests,
                matches: sourceFiles.map(f => f.filename)
            };
        });
    }
}
