# Contributing to Nexus Cursor Plugin

First off, thank you for considering contributing to Nexus Cursor Plugin! It's people like you that make this project such a great tool.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [How Can I Contribute?](#how-can-i-contribute)
- [Style Guidelines](#style-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Requests](#pull-requests)

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm or yarn
- Git
- A code editor (VS Code, Cursor, etc.)

### Setting Up Your Development Environment

1. **Fork the repository**

   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/nexus-cursor-plugin.git
   cd nexus-cursor-plugin
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Create a branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

5. **Build the project**

   ```bash
   npm run build
   ```

6. **Run tests**

   ```bash
   npm test
   ```

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates.

When creating a bug report, include:

- **Clear title** describing the issue
- **Steps to reproduce** the behavior
- **Expected behavior** vs. actual behavior
- **Environment details** (OS, Node.js version, Cursor version)
- **Error messages** and stack traces if applicable
- **Screenshots** if relevant

Use the bug report template when available.

### Suggesting Features

Feature suggestions are welcome! When suggesting:

- **Check existing issues** for similar suggestions
- **Provide a clear use case** for the feature
- **Explain the expected behavior**
- **Consider potential drawbacks**

### Contributing Code

1. **Pick an issue** or create one for discussion
2. **Comment on the issue** to let others know you're working on it
3. **Follow the style guidelines** below
4. **Write tests** for your changes
5. **Update documentation** as needed
6. **Submit a pull request**

### Improving Documentation

Documentation improvements are always welcome:

- Fix typos and grammar
- Add examples and clarifications
- Update outdated information
- Translate documentation

## Style Guidelines

### TypeScript Style

We follow a strict TypeScript style:

```typescript
// Use explicit types
function processFile(path: string): Promise<ParsedFile | null> {
  // Implementation
}

// Use interfaces over type aliases when possible
interface UserConfig {
  apiKey: string;
  endpoint?: string;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

// Use descriptive variable names
const repositoryIndexer = new RepositoryIndexer(config);

// Prefer const over let
const results = await indexer.indexRepository(path);

// Use async/await over callbacks
async function fetchData(): Promise<Data> {
  const response = await fetch(url);
  return response.json();
}
```

### Code Organization

- **One class/component per file**
- **Group related functionality** into directories
- **Use barrel exports** (index.ts) for public APIs
- **Keep files focused** and under 300 lines when possible

### Testing

- **Write tests for all new features**
- **Maintain existing test coverage**
- **Use descriptive test names**
- **Test edge cases**

```typescript
describe('TreeSitterService', () => {
  describe('parseFile', () => {
    it('should parse TypeScript files and return AST nodes', async () => {
      // Test implementation
    });

    it('should return null for unsupported file types', async () => {
      // Test implementation
    });
  });
});
```

### Error Handling

- **Use typed errors** when possible
- **Provide context** in error messages
- **Don't swallow errors** silently

```typescript
class IndexingError extends Error {
  constructor(
    message: string,
    public readonly filePath: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'IndexingError';
  }
}
```

## Commit Messages

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation only
- **style**: Code style (formatting, etc.)
- **refactor**: Code refactoring
- **test**: Adding or updating tests
- **chore**: Maintenance tasks

### Examples

```
feat(parser): add support for Rust language

fix(indexer): handle empty directories gracefully

docs(readme): update installation instructions

test(git): add integration tests for GitService

refactor(graphrag): extract common client logic
```

## Pull Requests

### Before Submitting

1. **Update your branch** with the latest main
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run all checks**
   ```bash
   npm run lint
   npm run typecheck
   npm test
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

### PR Guidelines

- **Fill out the PR template** completely
- **Link related issues** using keywords (Fixes #123)
- **Keep PRs focused** - one feature/fix per PR
- **Add screenshots** for UI changes
- **Request review** from maintainers

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Tests added/updated
- [ ] All tests passing

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-reviewed code
- [ ] Documentation updated
- [ ] No new warnings
```

### Review Process

1. **Automated checks** run on all PRs
2. **Maintainer review** required for merge
3. **Address feedback** in a timely manner
4. **Squash commits** before merge (if needed)

## Questions?

- Open a [Discussion](https://github.com/adverant/nexus-cursor-plugin/discussions)
- Join our [Discord](https://discord.gg/adverant)
- Email: dev@adverant.ai

Thank you for contributing!
