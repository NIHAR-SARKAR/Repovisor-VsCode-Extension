# Repovisor AI - Code Review


<p align="center">
  <img src="https://i.ibb.co/qMb6HtV5/logo.png" width="80" alt="RepoVisor logo">
</p>


> **AI-powered Pull Request Reviews directly inside Visual Studio
> Code.**

Review GitHub Pull Requests with your preferred AI model without leaving
VS Code.

Whether you're reviewing your own pull request before creating it or
reviewing someone else's changes, RepoVisor helps you identify bugs,
code smells, security issues, performance problems, and improvement
opportunities in seconds.

------------------------------------------------------------------------

## ✨ Features

### 🔍 AI Pull Request Reviews

Analyze an entire pull request and receive a structured review with
actionable suggestions.

### 🤖 Multiple AI Providers

Use your preferred AI model.

Supported providers include:

-   OpenAI
-   Azure OpenAI
-   Anthropic Claude
-   Google Gemini
-   OpenRouter
-   Ollama (Local)
-   LM Studio
-   Any OpenAI-compatible API

### 🐙 GitHub Integration

Review:

-   Pull Requests
-   Changed files
-   Local Git changes
-   PR diffs

### 🛡️ Smart Code Analysis

RepoVisor automatically looks for:

-   Bugs
-   Security vulnerabilities
-   Performance issues
-   Code quality
-   Best practices
-   Readability
-   Maintainability
-   Edge cases

### 📝 Professional Review Reports

Generate clean Markdown reports that can easily be copied into GitHub
comments or shared with teammates.

------------------------------------------------------------------------

# 🚀 Quick Start

## 1. Install RepoVisor

Install the extension from the Visual Studio Code Marketplace.

## 2. Configure Your AI Provider

Open the Command Palette (`Ctrl+Shift+P`)

Run:

    RepoVisor: Configure AI Provider

Choose your provider and enter your API key.

## 3. Open a Git Repository

RepoVisor works inside any Git repository.

## 4. Start Reviewing

Run:

    RepoVisor: Review Pull Request

or click the RepoVisor icon in the Activity Bar.

------------------------------------------------------------------------

# Supported AI Providers

  Provider                 Supported
  ------------------------ -----------
  OpenAI                   ✅
  Azure OpenAI             ✅
  Claude                   ✅
  Gemini                   ✅
  OpenRouter               ✅
  Ollama                   ✅
  LM Studio                ✅
  OpenAI-Compatible APIs   ✅

------------------------------------------------------------------------

# Example Review

``` text
Overall Score
★★★★☆

High Priority
• Possible SQL Injection

Medium Priority
• Missing null validation

Low Priority
• Improve variable naming

Suggestions

✓ Improve error handling
✓ Reduce duplicate logic
✓ Add edge case tests
```

------------------------------------------------------------------------

# Commands

  Command                 Description
  ----------------------- --------------------------
  Review Pull Request     Analyze the current PR
  Review Current File     Analyze the active file
  Review Selected Code    Analyze selected code
  Configure AI Provider   Configure API provider
  Refresh Review          Refresh current analysis

------------------------------------------------------------------------

# Privacy

RepoVisor only sends the code required for analysis to the AI provider
you configure.

Your source code is never sent anywhere else.

When using Ollama or LM Studio, all analysis stays on your local
machine.

------------------------------------------------------------------------

# Requirements

-   Visual Studio Code
-   Git
-   Configured AI Provider
-   Internet connection (unless using a local model)

------------------------------------------------------------------------

# FAQ

### Does RepoVisor modify my code?

No. RepoVisor only analyzes your code and provides suggestions.

### Can it automatically create GitHub comments?

Only if you explicitly choose to publish the generated review.

### Can I use local LLMs?

Yes. Ollama, LM Studio, and any OpenAI-compatible local server are
supported.

### Which AI model is recommended?

Larger reasoning models generally produce higher-quality reviews, but
any supported provider can be used.

------------------------------------------------------------------------

# Feedback & Support

Found a bug or have a feature request?

Please open an issue on the project's GitHub repository.

------------------------------------------------------------------------

# License

MIT License

------------------------------------------------------------------------

⭐ **Install RepoVisor today and review your Pull Requests faster using
the AI model you already trust.**
