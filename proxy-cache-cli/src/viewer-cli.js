#!/usr/bin/env node

import { Command } from 'commander';
import { startCacheViewer } from './cache-viewer.js';
import chalk from 'chalk';

const program = new Command();

program
  .name('cache-viewer')
  .description('Visual web-based cache editor')
  .version('1.0.0')
  .option('-p, --port <port>', 'web server port', '3001')
  .option('-c, --cache-dir <dir>', 'cache directory', './cache')
  .action((options) => {
    console.log(chalk.cyan.bold('\n🎨 Starting Cache Viewer\n'));
    
    try {
      startCacheViewer(parseInt(options.port), options.cacheDir);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

program.parse();