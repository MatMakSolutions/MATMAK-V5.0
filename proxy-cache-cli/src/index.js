#!/usr/bin/env node

import { Command } from 'commander';
import { startProxyServer } from './proxy-server.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('proxy-cache')
  .description('HTTP proxy with recording and caching capabilities')
  .version('1.0.0')
  .option('-p, --port <port>', 'local proxy server port', '8080')
  .option('-t, --target <url>', 'target server URL (where to redirect in record mode)', 'http://localhost:3000')
  .option('-m, --mode <mode>', 'operation mode: record, cache, or auto', 'auto')
  .option('-c, --cache-dir <dir>', 'cache directory', './cache')
  .option('-l, --log-dir <dir>', 'logs directory', './logs')
  .option('--clear-cache', 'clear cache before starting')
  .option('-v, --verbose', 'enable verbose logging')
  .action(async (options) => {
    console.log(chalk.cyan.bold('\n🚀 Proxy Cache CLI\n'));
    console.log(chalk.gray('Mode:'), chalk.yellow(options.mode));
    console.log(chalk.gray('Proxy Port:'), chalk.green(options.port));
    console.log(chalk.gray('Target:'), chalk.blue(options.target));
    console.log(chalk.gray('Cache Dir:'), options.cacheDir);
    console.log(chalk.gray('Log Dir:'), options.logDir);
    console.log('');

    if (options.clearCache) {
      const { clearCache } = await import('./cache-manager.js');
      await clearCache(options.cacheDir);
      console.log(chalk.yellow('✓ Cache cleared\n'));
    }

    try {
      await startProxyServer(options);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();