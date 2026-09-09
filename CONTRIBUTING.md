# Contributing to Civic Relay

Thank you for your interest in contributing to Civic Relay! This document provides guidelines for contributing to the project.

## Code of Conduct

This project adheres to a Code of Conduct. By participating, you are expected to uphold this code.

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues. When creating a bug report, include:

- **Clear title** and description
- **Steps to reproduce** the issue
- **Expected behavior** vs actual behavior
- **Screenshots** if applicable
- **Environment details** (OS, browser, Node version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. Include:

- **Use case**: Why is this enhancement needed?
- **Proposed solution**: How should it work?
- **Alternatives considered**: What other approaches did you think about?

### Pull Requests

1. **Fork** the repository
2. **Create a branch** from `develop`: `git checkout -b feature/your-feature-name`
3. **Make your changes**:
   - Follow existing code style
   - Add tests if applicable
   - Update documentation
4. **Commit** with clear messages: `git commit -m "feat: add feature X"`
5. **Push** to your fork: `git push origin feature/your-feature-name`
6. **Open a Pull Request** to `develop` branch

#### Commit Message Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc.)
- `refactor:` Code refactoring
- `test:` Adding or updating tests
- `chore:` Maintenance tasks

### Development Setup

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/civic-relay.git
cd civic-relay

# Enable Corepack (for pnpm)
corepack enable

# Install dependencies
pnpm install

# Build packages
pnpm build

# Run dev server
pnpm dev
```

### Project Structure

```
civic-relay/
├── packages/          # Shared packages
│   ├── schemas/       # Zod schemas
│   ├── transports/    # Transport layer
│   └── core/          # Business logic
├── apps/
│   └── web/           # React web app
├── fixtures/          # Demo data
└── docs/              # Documentation
```

### Testing

```bash
# Run all tests
pnpm test

# Type check
pnpm type-check

# Lint (when configured)
pnpm lint
```

### Documentation

- Update README.md if adding new features
- Add JSDoc comments to public APIs
- Update relevant docs/ files

## Security

Please report security vulnerabilities to **security@civic-relay.example.com** (not via public issues).

See [SECURITY.txt](SECURITY.txt) for our security policy.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Questions?

Open a [Discussion](https://github.com/civic-relay/civic-relay/discussions) for questions or ideas.

---

Thank you for contributing! 🚀
