import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

export class Logger {
  constructor(logDir) {
    this.logDir = path.resolve(logDir);
    this.initPromise = this.init();
  }

  async init() {
    await fs.mkdir(this.logDir, { recursive: true });
  }

  async ensureReady() {
    await this.initPromise;
  }

  formatSize(bytes) {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  }

  formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  logRequest(info, mode, cached = false) {
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    const method = info.method.padEnd(6);
    const statusIcon = cached ? '💾' : '🌐';
    const modeColor = mode === 'cache' ? chalk.green : chalk.yellow;
    
    // Build parameter display (excluding authToken)
    const allParams = { ...info.query, ...info.body };
    const filteredParams = Object.entries(allParams)
      .filter(([key]) => key !== 'authToken')
      .reduce((acc, [key, value]) => ({ ...acc, [key]: value }), {});
    
    const paramCount = Object.keys(filteredParams).length;
    const authTokenPresent = 'authToken' in allParams;
    const paramDisplay = info.ignoreAllParams 
      ? chalk.gray(' [no-params]') 
      : (paramCount > 0 ? chalk.gray(` (${paramCount} params)`) : '');
    const authDisplay = authTokenPresent ? chalk.gray(' [auth]') : '';
    
    console.log(
      chalk.gray(`[${timestamp}]`),
      statusIcon,
      chalk.bold[method === 'GET   ' ? 'green' : 'yellow'](method),
      chalk.cyan(info.path),
      paramDisplay + authDisplay,
      modeColor(`[${mode.toUpperCase()}]`),
      cached ? chalk.green('HIT') : chalk.red('MISS')
    );
    
    // Show key parameters for debugging (excluding authToken)
    if (!info.ignoreAllParams && paramCount > 0 && paramCount <= 5) {
      const paramStr = Object.entries(filteredParams)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      console.log(chalk.gray(`  → params: ${paramStr}`));
    }
  }

  logResponse(info, response, duration) {
    const size = response.headers?.['content-length'] || 0;
    const status = response.statusCode;
    const statusColor = status < 300 ? 'green' : status < 400 ? 'yellow' : 'red';
    
    console.log(
      chalk.gray('  →'),
      chalk[statusColor](`${status}`),
      chalk.gray(`${this.formatDuration(duration)}`),
      chalk.gray(`${this.formatSize(parseInt(size))}`),
      chalk.gray(`[${info.cacheKey}]`)
    );
  }

  async saveRequestLog(info, request, response, duration) {
    await this.ensureReady();
    const logFile = path.join(this.logDir, `requests-${new Date().toISOString().split('T')[0]}.jsonl`);
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      cacheKey: info.cacheKey,
      method: info.method,
      url: info.fullUrl,
      path: info.path,
      query: info.query,
      requestHeaders: request.headers,
      responseStatus: response.statusCode,
      responseHeaders: response.headers,
      duration,
      size: response.headers?.['content-length'] || 0
    };
    
    await fs.appendFile(logFile, JSON.stringify(logEntry) + '\n');
  }

  error(message, error) {
    console.error(chalk.red('✗'), chalk.red(message), error?.message || '');
    if (error?.stack && process.env.DEBUG) {
      console.error(chalk.gray(error.stack));
    }
  }

  info(message) {
    console.log(chalk.blue('ℹ'), message);
  }

  success(message) {
    console.log(chalk.green('✓'), message);
  }
}