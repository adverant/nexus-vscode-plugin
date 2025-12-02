# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |
| < 0.1   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

### How to Report

**Do NOT open a public GitHub issue for security vulnerabilities.**

Instead, please send a report to: **security@adverant.ai**

Include the following information:

1. **Description** of the vulnerability
2. **Steps to reproduce** the issue
3. **Potential impact** of the vulnerability
4. **Any suggested fixes** (if you have them)

### What to Expect

- **Acknowledgment**: We will acknowledge receipt of your report within 48 hours
- **Assessment**: We will investigate and validate the vulnerability within 5 business days
- **Resolution**: We aim to address critical vulnerabilities within 30 days
- **Credit**: We will credit researchers who report valid vulnerabilities (unless you prefer to remain anonymous)

### Scope

The following are in scope for security reports:

- The Nexus Cursor Plugin codebase
- Dependencies with exploitable vulnerabilities
- Configuration issues that could lead to security problems
- Authentication and authorization issues

The following are out of scope:

- Issues in third-party services (report these to the service provider)
- Social engineering attacks
- Physical attacks
- DoS attacks that don't reveal underlying vulnerabilities

## Security Best Practices

When using the Nexus Cursor Plugin:

1. **Protect your API key**: Never commit your API key to version control
2. **Use environment variables**: Store credentials in environment variables
3. **Keep dependencies updated**: Run `npm audit` regularly
4. **Review permissions**: Only grant necessary permissions to the plugin

## Dependency Security

We use the following tools to maintain dependency security:

- **npm audit**: Run on every CI build
- **Dependabot**: Automated dependency updates
- **OSSF Scorecard**: Security health metrics

## Security Updates

Security updates will be released as patch versions. We recommend:

1. Subscribe to GitHub release notifications
2. Use semantic versioning constraints (e.g., `^0.1.0`)
3. Review the [CHANGELOG](CHANGELOG.md) for security-related changes

## Contact

- Security reports: security@adverant.ai
- General inquiries: support@adverant.ai
