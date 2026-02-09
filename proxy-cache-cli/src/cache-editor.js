#!/usr/bin/env node

import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const program = new Command();

program
  .name('cache-editor')
  .description('Edit proxy cache entries')
  .version('1.0.0');

program
  .command('show <cacheKey>')
  .description('Show cache entry in human-readable format')
  .option('-c, --cache-dir <dir>', 'cache directory', './cache')
  .action(async (cacheKey, options) => {
    try {
      const cachePath = path.join(options.cacheDir, `${cacheKey}.json`);
      const data = await fs.readFile(cachePath, 'utf-8');
      const cache = JSON.parse(data);
      
      console.log(chalk.cyan('\n=== Cache Entry ==='));
      console.log(chalk.gray('Key:'), cacheKey);
      console.log(chalk.gray('Timestamp:'), cache.timestamp);
      console.log(chalk.gray('URL:'), cache.request.url);
      console.log(chalk.gray('Method:'), cache.request.method);
      
      // Filter sensitive headers for display
      const requestHeaders = { ...cache.request.headers };
      const sensitiveHeaders = ['authorization', 'Authorization', 'cookie', 'Cookie', 'x-api-key', 'X-Api-Key', 'api-key', 'Api-Key'];
      sensitiveHeaders.forEach(header => {
        if (requestHeaders[header]) {
          requestHeaders[header] = header.toLowerCase().includes('authorization') && requestHeaders[header].startsWith('Bearer ')
            ? 'Bearer [HIDDEN]'
            : '[HIDDEN]';
        }
      });
      
      console.log(chalk.gray('Headers:'), JSON.stringify(requestHeaders, null, 2));
      
      console.log(chalk.cyan('\n=== Response ==='));
      console.log(chalk.gray('Status:'), cache.response.statusCode);
      console.log(chalk.gray('Headers:'), JSON.stringify(cache.response.headers, null, 2));
      
      const body = Buffer.from(cache.response.body, 'base64').toString('utf-8');
      console.log(chalk.cyan('\n=== Body (decoded) ==='));
      
      // Try to pretty-print JSON
      try {
        const jsonBody = JSON.parse(body);
        console.log(JSON.stringify(jsonBody, null, 2));
      } catch {
        console.log(body);
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

program
  .command('edit-body <cacheKey>')
  .description('Edit response body of a cache entry')
  .option('-c, --cache-dir <dir>', 'cache directory', './cache')
  .option('-f, --file <file>', 'read new body from file')
  .option('-t, --text <text>', 'set body as text')
  .option('-j, --json <json>', 'set body as JSON')
  .action(async (cacheKey, options) => {
    try {
      const cachePath = path.join(options.cacheDir, `${cacheKey}.json`);
      const data = await fs.readFile(cachePath, 'utf-8');
      const cache = JSON.parse(data);
      
      let newBody;
      
      if (options.file) {
        newBody = await fs.readFile(options.file, 'utf-8');
      } else if (options.text) {
        newBody = options.text;
      } else if (options.json) {
        newBody = JSON.stringify(JSON.parse(options.json)); // Validate JSON
      } else {
        console.error(chalk.red('Error: Must specify --file, --text, or --json'));
        process.exit(1);
      }
      
      // Update the cache entry
      cache.response.body = Buffer.from(newBody).toString('base64');
      cache.modified = new Date().toISOString();
      
      // Update content-length header if present
      if (cache.response.headers['content-length']) {
        cache.response.headers['content-length'] = Buffer.byteLength(newBody).toString();
      }
      
      await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
      console.log(chalk.green('✓'), `Updated cache entry: ${cacheKey}`);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

program
  .command('list')
  .description('List all cache entries')
  .option('-c, --cache-dir <dir>', 'cache directory', './cache')
  .action(async (options) => {
    try {
      const files = await fs.readdir(options.cacheDir);
      const cacheFiles = files.filter(f => f.endsWith('.json'));
      
      console.log(chalk.cyan(`\nFound ${cacheFiles.length} cache entries:\n`));
      
      for (const file of cacheFiles) {
        try {
          const data = await fs.readFile(path.join(options.cacheDir, file), 'utf-8');
          const cache = JSON.parse(data);
          const cacheKey = path.basename(file, '.json');
          
          // Skip OPTIONS requests
          if (cache.request.method === 'OPTIONS') continue;
          
          console.log(
            chalk.gray(cacheKey),
            chalk.green(cache.request.method),
            chalk.cyan(cache.request.path || cache.request.url),
            chalk.gray(cache.timestamp)
          );
        } catch (err) {
          console.log(chalk.red(file), 'Error reading file');
        }
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

program
  .command('decode <cacheKey>')
  .description('Decode and save response body to file')
  .option('-c, --cache-dir <dir>', 'cache directory', './cache')
  .option('-o, --output <file>', 'output file', 'decoded-body.txt')
  .action(async (cacheKey, options) => {
    try {
      const cachePath = path.join(options.cacheDir, `${cacheKey}.json`);
      const data = await fs.readFile(cachePath, 'utf-8');
      const cache = JSON.parse(data);
      
      const body = Buffer.from(cache.response.body, 'base64');
      await fs.writeFile(options.output, body);
      
      console.log(chalk.green('✓'), `Decoded body saved to: ${options.output}`);
      console.log(chalk.gray('Size:'), body.length, 'bytes');
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

program
  .command('validate')
  .description('Validate all cache entries')
  .option('-c, --cache-dir <dir>', 'cache directory', './cache')
  .action(async (options) => {
    try {
      const files = await fs.readdir(options.cacheDir);
      const cacheFiles = files.filter(f => f.endsWith('.json'));
      
      let valid = 0;
      let invalid = 0;
      
      for (const file of cacheFiles) {
        try {
          const data = await fs.readFile(path.join(options.cacheDir, file), 'utf-8');
          const cache = JSON.parse(data);
          
          // Validate base64
          Buffer.from(cache.response.body, 'base64');
          if (cache.request.body) {
            Buffer.from(cache.request.body, 'base64');
          }
          
          valid++;
        } catch (err) {
          invalid++;
          console.log(chalk.red('✗'), file, chalk.gray(err.message));
        }
      }
      
      console.log(chalk.green(`\n✓ Valid: ${valid}`));
      if (invalid > 0) {
        console.log(chalk.red(`✗ Invalid: ${invalid}`));
      }
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
    }
  });

program.parse();