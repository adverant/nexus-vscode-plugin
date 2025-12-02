// src/tools/security-scanner.ts
import { promises as fs } from 'fs';
import path from 'path';
import axios, { AxiosError } from 'axios';
import pino from 'pino';
import { glob } from 'glob';

const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'UNKNOWN';

export type Ecosystem =
  | 'npm'
  | 'PyPI'
  | 'Go'
  | 'crates.io'
  | 'Maven'
  | 'Packagist'
  | 'RubyGems'
  | 'NuGet';

export interface Dependency {
  name: string;
  version: string;
  ecosystem: Ecosystem;
  filePath: string;
  lineNumber?: number;
}

export interface Vulnerability {
  id: string;
  summary: string;
  details?: string;
  severity: Severity;
  cvss?: number;
  cveIds: string[];
  affectedVersions: string[];
  fixedVersions: string[];
  references: string[];
  publishedAt?: string;
  modifiedAt?: string;
}

export interface VulnerabilityReport {
  dependency: Dependency;
  vulnerabilities: Vulnerability[];
}

export interface ScanResult {
  timestamp: Date;
  projectPath: string;
  totalDependencies: number;
  vulnerableDependencies: number;
  totalVulnerabilities: number;
  severityCounts: Record<Severity, number>;
  reports: VulnerabilityReport[];
  scanDuration: number;
}

interface OSVQuery {
  package: {
    name: string;
    ecosystem: string;
  };
  version?: string;
}

interface OSVVulnerability {
  id: string;
  summary: string;
  details?: string;
  aliases?: string[];
  severity?: Array<{
    type: string;
    score: string;
  }>;
  affected?: Array<{
    package: {
      name: string;
      ecosystem: string;
    };
    ranges?: Array<{
      type: string;
      events: Array<{
        introduced?: string;
        fixed?: string;
      }>;
    }>;
    versions?: string[];
  }>;
  references?: Array<{
    type: string;
    url: string;
  }>;
  published?: string;
  modified?: string;
}

interface OSVResponse {
  vulns?: OSVVulnerability[];
}

/**
 * SecurityScanner scans project dependencies for known vulnerabilities using OSV.dev API
 */
export class SecurityScanner {
  private readonly osvApiUrl = 'https://api.osv.dev/v1';
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  constructor(private projectPath: string) {}

  /**
   * Scan project for security vulnerabilities
   */
  async scan(): Promise<ScanResult> {
    const startTime = Date.now();
    logger.info({ projectPath: this.projectPath }, 'Starting security scan');

    try {
      // Discover dependency files
      const dependencyFiles = await this.discoverDependencyFiles();
      logger.info(
        { fileCount: dependencyFiles.length },
        'Discovered dependency files'
      );

      // Parse dependencies from all files
      const allDependencies: Dependency[] = [];
      for (const filePath of dependencyFiles) {
        const deps = await this.parseDependencyFile(filePath);
        allDependencies.push(...deps);
      }

      logger.info(
        { dependencyCount: allDependencies.length },
        'Parsed dependencies'
      );

      // Query OSV.dev for vulnerabilities
      const reports = await this.queryVulnerabilities(allDependencies);

      // Calculate statistics
      const severityCounts: Record<Severity, number> = {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0,
        UNKNOWN: 0,
      };

      let totalVulnerabilities = 0;
      const vulnerableDependencies = reports.filter(
        (r) => r.vulnerabilities.length > 0
      ).length;

      for (const report of reports) {
        totalVulnerabilities += report.vulnerabilities.length;
        for (const vuln of report.vulnerabilities) {
          severityCounts[vuln.severity]++;
        }
      }

      const scanDuration = Date.now() - startTime;

      const result: ScanResult = {
        timestamp: new Date(),
        projectPath: this.projectPath,
        totalDependencies: allDependencies.length,
        vulnerableDependencies,
        totalVulnerabilities,
        severityCounts,
        reports: reports.filter((r) => r.vulnerabilities.length > 0), // Only include vulnerable deps
        scanDuration,
      };

      logger.info(
        {
          totalDependencies: result.totalDependencies,
          vulnerableDependencies: result.vulnerableDependencies,
          totalVulnerabilities: result.totalVulnerabilities,
          duration: scanDuration,
        },
        'Security scan completed'
      );

      return result;
    } catch (error) {
      logger.error({ error }, 'Security scan failed');
      throw new Error(`Security scan failed: ${(error as Error).message}`);
    }
  }

  /**
   * Discover dependency files in project
   */
  private async discoverDependencyFiles(): Promise<string[]> {
    const patterns = [
      '**/package.json',
      '**/package-lock.json',
      '**/requirements.txt',
      '**/Pipfile',
      '**/Pipfile.lock',
      '**/Cargo.toml',
      '**/Cargo.lock',
      '**/go.mod',
      '**/go.sum',
      '**/pom.xml',
      '**/build.gradle',
      '**/composer.json',
      '**/Gemfile',
      '**/Gemfile.lock',
      '**/*.csproj',
    ];

    const ignorePatterns = [
      '**/node_modules/**',
      '**/vendor/**',
      '**/dist/**',
      '**/build/**',
      '**/.git/**',
      '**/target/**',
    ];

    const files: string[] = [];

    for (const pattern of patterns) {
      try {
        const matches = await glob(pattern, {
          cwd: this.projectPath,
          absolute: true,
          ignore: ignorePatterns,
        });
        files.push(...matches);
      } catch (error) {
        logger.warn({ pattern, error }, 'Failed to match pattern');
      }
    }

    return [...new Set(files)]; // Deduplicate
  }

  /**
   * Parse dependencies from a dependency file
   */
  private async parseDependencyFile(filePath: string): Promise<Dependency[]> {
    const fileName = path.basename(filePath);
    logger.debug({ filePath, fileName }, 'Parsing dependency file');

    try {
      const content = await fs.readFile(filePath, 'utf-8');

      if (fileName === 'package.json') {
        return this.parsePackageJson(content, filePath);
      } else if (fileName === 'package-lock.json') {
        return this.parsePackageLockJson(content, filePath);
      } else if (fileName === 'requirements.txt') {
        return this.parseRequirementsTxt(content, filePath);
      } else if (fileName === 'Pipfile' || fileName === 'Pipfile.lock') {
        return this.parsePipfile(content, filePath);
      } else if (fileName === 'Cargo.toml') {
        return this.parseCargoToml(content, filePath);
      } else if (fileName === 'Cargo.lock') {
        return this.parseCargoLock(content, filePath);
      } else if (fileName === 'go.mod') {
        return this.parseGoMod(content, filePath);
      } else if (fileName === 'pom.xml') {
        return this.parsePomXml(content, filePath);
      } else if (fileName === 'build.gradle') {
        return this.parseBuildGradle(content, filePath);
      } else if (fileName === 'composer.json') {
        return this.parseComposerJson(content, filePath);
      } else if (fileName === 'Gemfile' || fileName === 'Gemfile.lock') {
        return this.parseGemfile(content, filePath);
      } else if (fileName.endsWith('.csproj')) {
        return this.parseCsproj(content, filePath);
      }

      logger.warn({ fileName }, 'Unsupported dependency file type');
      return [];
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to parse dependency file');
      return [];
    }
  }

  /**
   * Parse package.json (npm)
   */
  private parsePackageJson(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    try {
      const pkg = JSON.parse(content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };

      for (const [name, version] of Object.entries(deps)) {
        const cleanVersion = this.cleanNpmVersion(version as string);
        if (cleanVersion) {
          dependencies.push({
            name,
            version: cleanVersion,
            ecosystem: 'npm',
            filePath,
          });
        }
      }
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to parse package.json');
    }
    return dependencies;
  }

  /**
   * Parse package-lock.json (npm)
   */
  private parsePackageLockJson(
    content: string,
    filePath: string
  ): Dependency[] {
    const dependencies: Dependency[] = [];
    try {
      const lock = JSON.parse(content);

      // Handle lockfileVersion 2 and 3
      if (lock.packages) {
        for (const [pkgPath, pkg] of Object.entries(lock.packages)) {
          if (pkgPath === '' || !pkg) continue; // Skip root
          const name = pkgPath.replace(/^node_modules\//, '');
          const version = (pkg as any).version;
          if (name && version) {
            dependencies.push({
              name,
              version,
              ecosystem: 'npm',
              filePath,
            });
          }
        }
      }

      // Handle lockfileVersion 1
      if (lock.dependencies && dependencies.length === 0) {
        for (const [name, dep] of Object.entries(lock.dependencies)) {
          const version = (dep as any).version;
          if (version) {
            dependencies.push({
              name,
              version,
              ecosystem: 'npm',
              filePath,
            });
          }
        }
      }
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to parse package-lock.json');
    }
    return dependencies;
  }

  /**
   * Parse requirements.txt (Python)
   */
  private parseRequirementsTxt(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('#')) continue;

      // Parse "package==version" or "package>=version"
      const match = line.match(/^([a-zA-Z0-9_-]+)\s*([=><~!]+)\s*([0-9.]+)/);
      if (match) {
        const [, name, operator, version] = match;
        dependencies.push({
          name: name.toLowerCase(),
          version,
          ecosystem: 'PyPI',
          filePath,
          lineNumber: i + 1,
        });
      }
    }

    return dependencies;
  }

  /**
   * Parse Pipfile (Python)
   */
  private parsePipfile(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    try {
      // Simple TOML-like parsing for [packages] section
      const packageSection = content.match(/\[packages\]([\s\S]*?)(\[|$)/);
      if (packageSection) {
        const lines = packageSection[1].split('\n');
        for (const line of lines) {
          const match = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*"==([0-9.]+)"/);
          if (match) {
            const [, name, version] = match;
            dependencies.push({
              name: name.toLowerCase(),
              version,
              ecosystem: 'PyPI',
              filePath,
            });
          }
        }
      }
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to parse Pipfile');
    }
    return dependencies;
  }

  /**
   * Parse Cargo.toml (Rust)
   */
  private parseCargoToml(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    try {
      // Simple TOML-like parsing for [dependencies] section
      const depSection = content.match(/\[dependencies\]([\s\S]*?)(\[|$)/);
      if (depSection) {
        const lines = depSection[1].split('\n');
        for (const line of lines) {
          // Match: package = "version" or package = { version = "version" }
          const simpleMatch = line.match(/^([a-zA-Z0-9_-]+)\s*=\s*"([0-9.]+)"/);
          const objectMatch = line.match(
            /^([a-zA-Z0-9_-]+)\s*=\s*\{[^}]*version\s*=\s*"([0-9.]+)"/
          );

          if (simpleMatch) {
            const [, name, version] = simpleMatch;
            dependencies.push({
              name,
              version,
              ecosystem: 'crates.io',
              filePath,
            });
          } else if (objectMatch) {
            const [, name, version] = objectMatch;
            dependencies.push({
              name,
              version,
              ecosystem: 'crates.io',
              filePath,
            });
          }
        }
      }
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to parse Cargo.toml');
    }
    return dependencies;
  }

  /**
   * Parse Cargo.lock (Rust)
   */
  private parseCargoLock(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    try {
      // Simple TOML-like parsing for [[package]] sections
      const packageSections = content.match(/\[\[package\]\]([\s\S]*?)(?=\[\[package\]\]|$)/g);
      if (packageSections) {
        for (const section of packageSections) {
          const nameMatch = section.match(/name\s*=\s*"([^"]+)"/);
          const versionMatch = section.match(/version\s*=\s*"([^"]+)"/);

          if (nameMatch && versionMatch) {
            dependencies.push({
              name: nameMatch[1],
              version: versionMatch[1],
              ecosystem: 'crates.io',
              filePath,
            });
          }
        }
      }
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to parse Cargo.lock');
    }
    return dependencies;
  }

  /**
   * Parse go.mod (Go)
   */
  private parseGoMod(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Match: require module/path v1.2.3
      const match = line.match(/^\s*([a-zA-Z0-9._/-]+)\s+v([0-9.]+)/);
      if (match) {
        const [, name, version] = match;
        dependencies.push({
          name,
          version,
          ecosystem: 'Go',
          filePath,
          lineNumber: i + 1,
        });
      }
    }

    return dependencies;
  }

  /**
   * Parse pom.xml (Maven/Java)
   */
  private parsePomXml(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    try {
      // Simple XML parsing for <dependency> elements
      const dependencyMatches = content.matchAll(
        /<dependency>([\s\S]*?)<\/dependency>/g
      );

      for (const match of dependencyMatches) {
        const depContent = match[1];
        const groupIdMatch = depContent.match(/<groupId>([^<]+)<\/groupId>/);
        const artifactIdMatch = depContent.match(
          /<artifactId>([^<]+)<\/artifactId>/
        );
        const versionMatch = depContent.match(/<version>([^<]+)<\/version>/);

        if (groupIdMatch && artifactIdMatch && versionMatch) {
          const name = `${groupIdMatch[1]}:${artifactIdMatch[1]}`;
          dependencies.push({
            name,
            version: versionMatch[1],
            ecosystem: 'Maven',
            filePath,
          });
        }
      }
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to parse pom.xml');
    }
    return dependencies;
  }

  /**
   * Parse build.gradle (Gradle/Java)
   */
  private parseBuildGradle(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Match: implementation 'group:artifact:version'
      const match = line.match(/['"]([\w.-]+):([\w.-]+):([0-9.]+)['"]/);
      if (match) {
        const [, group, artifact, version] = match;
        dependencies.push({
          name: `${group}:${artifact}`,
          version,
          ecosystem: 'Maven',
          filePath,
          lineNumber: i + 1,
        });
      }
    }

    return dependencies;
  }

  /**
   * Parse composer.json (PHP)
   */
  private parseComposerJson(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    try {
      const composer = JSON.parse(content);
      const deps = { ...composer.require, ...composer['require-dev'] };

      for (const [name, version] of Object.entries(deps)) {
        if (name === 'php') continue; // Skip PHP itself
        const cleanVersion = this.cleanComposerVersion(version as string);
        if (cleanVersion) {
          dependencies.push({
            name,
            version: cleanVersion,
            ecosystem: 'Packagist',
            filePath,
          });
        }
      }
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to parse composer.json');
    }
    return dependencies;
  }

  /**
   * Parse Gemfile (Ruby)
   */
  private parseGemfile(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Match: gem 'name', '~> 1.2.3'
      const match = line.match(/gem\s+['"]([^'"]+)['"]\s*,\s*['"]([~>=<\d.]+)['"]/);
      if (match) {
        const [, name, version] = match;
        const cleanVersion = version.replace(/[~>=<]/g, '').trim();
        if (cleanVersion) {
          dependencies.push({
            name,
            version: cleanVersion,
            ecosystem: 'RubyGems',
            filePath,
            lineNumber: i + 1,
          });
        }
      }
    }

    return dependencies;
  }

  /**
   * Parse .csproj (NuGet/.NET)
   */
  private parseCsproj(content: string, filePath: string): Dependency[] {
    const dependencies: Dependency[] = [];
    try {
      // Parse <PackageReference Include="Name" Version="1.0.0" />
      const packageMatches = content.matchAll(
        /<PackageReference\s+Include="([^"]+)"\s+Version="([^"]+)"\s*\/>/g
      );

      for (const match of packageMatches) {
        const [, name, version] = match;
        dependencies.push({
          name,
          version,
          ecosystem: 'NuGet',
          filePath,
        });
      }
    } catch (error) {
      logger.error({ filePath, error }, 'Failed to parse .csproj');
    }
    return dependencies;
  }

  /**
   * Query OSV.dev for vulnerabilities
   */
  private async queryVulnerabilities(
    dependencies: Dependency[]
  ): Promise<VulnerabilityReport[]> {
    const reports: VulnerabilityReport[] = [];
    const batchSize = 10; // Process in batches to avoid overwhelming API

    for (let i = 0; i < dependencies.length; i += batchSize) {
      const batch = dependencies.slice(i, i + batchSize);
      const batchReports = await Promise.all(
        batch.map((dep) => this.queryDependency(dep))
      );
      reports.push(...batchReports);

      // Small delay between batches to be respectful to OSV API
      if (i + batchSize < dependencies.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    return reports;
  }

  /**
   * Query single dependency for vulnerabilities
   */
  private async queryDependency(
    dependency: Dependency
  ): Promise<VulnerabilityReport> {
    const query: OSVQuery = {
      package: {
        name: dependency.name,
        ecosystem: this.mapEcosystem(dependency.ecosystem),
      },
      version: dependency.version,
    };

    let attempt = 0;
    while (attempt < this.maxRetries) {
      try {
        const response = await axios.post<OSVResponse>(
          `${this.osvApiUrl}/query`,
          query,
          {
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000,
          }
        );

        const vulnerabilities = this.parseOSVResponse(response.data);
        return { dependency, vulnerabilities };
      } catch (error) {
        attempt++;
        const axiosError = error as AxiosError;

        if (axiosError.response?.status === 404) {
          // No vulnerabilities found
          return { dependency, vulnerabilities: [] };
        }

        if (attempt >= this.maxRetries) {
          logger.error(
            { dependency: dependency.name, error },
            'Failed to query OSV after retries'
          );
          return { dependency, vulnerabilities: [] };
        }

        // Exponential backoff
        await new Promise((resolve) =>
          setTimeout(resolve, this.retryDelay * attempt)
        );
      }
    }

    return { dependency, vulnerabilities: [] };
  }

  /**
   * Parse OSV API response into structured vulnerabilities
   */
  private parseOSVResponse(response: OSVResponse): Vulnerability[] {
    if (!response.vulns || response.vulns.length === 0) {
      return [];
    }

    return response.vulns.map((vuln) => {
      const severity = this.extractSeverity(vuln);
      const cvss = this.extractCVSS(vuln);
      const cveIds = this.extractCVEIds(vuln);
      const { affectedVersions, fixedVersions } =
        this.extractVersionInfo(vuln);

      return {
        id: vuln.id,
        summary: vuln.summary || 'No summary available',
        details: vuln.details,
        severity,
        cvss,
        cveIds,
        affectedVersions,
        fixedVersions,
        references: vuln.references?.map((r) => r.url) || [],
        publishedAt: vuln.published,
        modifiedAt: vuln.modified,
      };
    });
  }

  /**
   * Extract severity from OSV vulnerability
   */
  private extractSeverity(vuln: OSVVulnerability): Severity {
    if (!vuln.severity || vuln.severity.length === 0) {
      return 'UNKNOWN';
    }

    // Look for CVSS v3 score
    const cvssV3 = vuln.severity.find((s) => s.type === 'CVSS_V3');
    if (cvssV3) {
      const score = parseFloat(cvssV3.score.split(':')[1] || '0');
      if (score >= 9.0) return 'CRITICAL';
      if (score >= 7.0) return 'HIGH';
      if (score >= 4.0) return 'MEDIUM';
      if (score > 0) return 'LOW';
    }

    return 'UNKNOWN';
  }

  /**
   * Extract CVSS score from OSV vulnerability
   */
  private extractCVSS(vuln: OSVVulnerability): number | undefined {
    if (!vuln.severity || vuln.severity.length === 0) {
      return undefined;
    }

    const cvssV3 = vuln.severity.find((s) => s.type === 'CVSS_V3');
    if (cvssV3) {
      const score = parseFloat(cvssV3.score.split(':')[1] || '0');
      return score > 0 ? score : undefined;
    }

    return undefined;
  }

  /**
   * Extract CVE IDs from OSV vulnerability
   */
  private extractCVEIds(vuln: OSVVulnerability): string[] {
    if (!vuln.aliases || vuln.aliases.length === 0) {
      return [];
    }

    return vuln.aliases.filter((alias) => alias.startsWith('CVE-'));
  }

  /**
   * Extract affected and fixed versions from OSV vulnerability
   */
  private extractVersionInfo(vuln: OSVVulnerability): {
    affectedVersions: string[];
    fixedVersions: string[];
  } {
    const affectedVersions: string[] = [];
    const fixedVersions: string[] = [];

    if (!vuln.affected || vuln.affected.length === 0) {
      return { affectedVersions, fixedVersions };
    }

    for (const affected of vuln.affected) {
      if (affected.versions) {
        affectedVersions.push(...affected.versions);
      }

      if (affected.ranges) {
        for (const range of affected.ranges) {
          if (range.events) {
            for (const event of range.events) {
              if (event.fixed) {
                fixedVersions.push(event.fixed);
              }
            }
          }
        }
      }
    }

    return {
      affectedVersions: [...new Set(affectedVersions)],
      fixedVersions: [...new Set(fixedVersions)],
    };
  }

  /**
   * Map internal ecosystem to OSV ecosystem name
   */
  private mapEcosystem(ecosystem: Ecosystem): string {
    const mapping: Record<Ecosystem, string> = {
      npm: 'npm',
      PyPI: 'PyPI',
      Go: 'Go',
      'crates.io': 'crates.io',
      Maven: 'Maven',
      Packagist: 'Packagist',
      RubyGems: 'RubyGems',
      NuGet: 'NuGet',
    };

    return mapping[ecosystem] || ecosystem;
  }

  /**
   * Clean npm version string (remove ^, ~, etc.)
   */
  private cleanNpmVersion(version: string): string | null {
    const match = version.match(/[0-9]+\.[0-9]+\.[0-9]+/);
    return match ? match[0] : null;
  }

  /**
   * Clean Composer version string
   */
  private cleanComposerVersion(version: string): string | null {
    const match = version.match(/[0-9]+\.[0-9]+\.[0-9]+/);
    return match ? match[0] : null;
  }

  /**
   * Format scan result as human-readable text
   */
  static formatScanResult(result: ScanResult): string {
    const lines: string[] = [];

    lines.push('═══════════════════════════════════════════════════════');
    lines.push('         SECURITY VULNERABILITY SCAN REPORT');
    lines.push('═══════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`Project: ${result.projectPath}`);
    lines.push(`Scanned: ${result.timestamp.toISOString()}`);
    lines.push(`Duration: ${(result.scanDuration / 1000).toFixed(2)}s`);
    lines.push('');
    lines.push('─────────────────────────────────────────────────────');
    lines.push('  SUMMARY');
    lines.push('─────────────────────────────────────────────────────');
    lines.push(`Total Dependencies:        ${result.totalDependencies}`);
    lines.push(`Vulnerable Dependencies:   ${result.vulnerableDependencies}`);
    lines.push(`Total Vulnerabilities:     ${result.totalVulnerabilities}`);
    lines.push('');
    lines.push('Severity Breakdown:');
    lines.push(`  CRITICAL: ${result.severityCounts.CRITICAL}`);
    lines.push(`  HIGH:     ${result.severityCounts.HIGH}`);
    lines.push(`  MEDIUM:   ${result.severityCounts.MEDIUM}`);
    lines.push(`  LOW:      ${result.severityCounts.LOW}`);
    lines.push(`  UNKNOWN:  ${result.severityCounts.UNKNOWN}`);
    lines.push('');

    if (result.reports.length > 0) {
      lines.push('─────────────────────────────────────────────────────');
      lines.push('  VULNERABILITIES');
      lines.push('─────────────────────────────────────────────────────');
      lines.push('');

      for (const report of result.reports) {
        const dep = report.dependency;
        lines.push(`📦 ${dep.name}@${dep.version} (${dep.ecosystem})`);
        lines.push(`   File: ${path.relative(result.projectPath, dep.filePath)}`);
        lines.push('');

        for (const vuln of report.vulnerabilities) {
          const severityIcon =
            vuln.severity === 'CRITICAL'
              ? '🔴'
              : vuln.severity === 'HIGH'
              ? '🟠'
              : vuln.severity === 'MEDIUM'
              ? '🟡'
              : vuln.severity === 'LOW'
              ? '🟢'
              : '⚪';

          lines.push(`   ${severityIcon} [${vuln.severity}] ${vuln.id}`);
          lines.push(`      ${vuln.summary}`);

          if (vuln.cvss) {
            lines.push(`      CVSS: ${vuln.cvss.toFixed(1)}`);
          }

          if (vuln.cveIds.length > 0) {
            lines.push(`      CVEs: ${vuln.cveIds.join(', ')}`);
          }

          if (vuln.fixedVersions.length > 0) {
            lines.push(`      Fixed in: ${vuln.fixedVersions.join(', ')}`);
          }

          if (vuln.references.length > 0) {
            lines.push(`      References:`);
            for (const ref of vuln.references.slice(0, 2)) {
              lines.push(`        - ${ref}`);
            }
          }

          lines.push('');
        }

        lines.push('');
      }
    } else {
      lines.push('✅ No vulnerabilities found!');
      lines.push('');
    }

    lines.push('═══════════════════════════════════════════════════════');

    return lines.join('\n');
  }
}
