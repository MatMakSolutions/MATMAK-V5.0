#!/usr/bin/env node

import fetch from 'node-fetch';

const proxyUrl = process.argv[2] || 'http://localhost:8080';
const testPath = process.argv[3] || '/';

console.log(`Testing proxy at ${proxyUrl}${testPath}`);

try {
  const response = await fetch(`${proxyUrl}${testPath}`, {
    headers: {
      'User-Agent': 'proxy-cache-cli-test'
    }
  });
  
  console.log(`Status: ${response.status} ${response.statusText}`);
  console.log(`Headers:`, Object.fromEntries(response.headers.entries()));
  
  const text = await response.text();
  console.log(`Body length: ${text.length} bytes`);
  console.log(`First 200 chars:`, text.substring(0, 200));
} catch (error) {
  console.error('Error:', error.message);
}