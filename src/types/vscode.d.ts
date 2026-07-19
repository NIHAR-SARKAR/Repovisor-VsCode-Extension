import * as vscode from 'vscode';

export interface WebviewMessage {
    command: string;
    data?: any;
}

export interface ReviewRequestMessage extends WebviewMessage {
    command: 'review';
    data: {
        repo: string;
        prNumber: number;
        platform: 'github' | 'gitlab';
        provider: string;
        profile: string;
        autoPost: boolean;
    };
}

export interface FileReviewRequestMessage extends WebviewMessage {
    command: 'reviewFile';
    data: {
        content: string;
        fileName: string;
        provider: string;
        profile: string;
    };
}

export interface ConfigUpdateMessage extends WebviewMessage {
    command: 'updateConfig';
    data: {
        provider: string;
        profile: string;
        autoPost: boolean;
        githubToken?: string;
        gitlabToken?: string;
    };
}

export interface GetHistoryMessage extends WebviewMessage {
    command: 'getHistory';
    data: {
        page: number;
        perPage: number;
        repo?: string;
    };
}

export interface GetPRsMessage extends WebviewMessage {
    command: 'getPRs';
    data: {
        repo: string;
        platform: 'github' | 'gitlab';
        state?: 'open' | 'closed' | 'all';
    };
}

export interface PostCommentMessage extends WebviewMessage {
    command: 'postComment';
    data: {
        reviewId: string;
        repo: string;
        prNumber: number;
        platform: 'github' | 'gitlab';
    };
}

export interface GetProvidersMessage extends WebviewMessage {
    command: 'getProviders';
}

export interface AddRuleMessage extends WebviewMessage {
    command: 'addRule';
    data: CustomRule;
}

export interface DeleteRuleMessage extends WebviewMessage {
    command: 'deleteRule';
    data: { ruleId: string };
}

export interface GetRulesMessage extends WebviewMessage {
    command: 'getRules';
}

export type PanelMessage = 
    | ReviewRequestMessage 
    | FileReviewRequestMessage 
    | ConfigUpdateMessage 
    | GetHistoryMessage
    | GetPRsMessage
    | PostCommentMessage
    | GetProvidersMessage
    | AddRuleMessage
    | DeleteRuleMessage
    | GetRulesMessage;
