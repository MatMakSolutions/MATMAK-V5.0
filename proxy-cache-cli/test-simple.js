#!/usr/bin/env node

import http from 'http';

const options = {
  hostname: 'localhost',
  port: 8080,
  path: '/api/userversion/35f21a7abdb7522813afab51631c5082?authToken=NjMyNjEwOTAyNTc1ODAwNzA3MDkzNTcwMTY=',
  method: 'GET'
};

console.log('Testing proxy...');
console.log(`Request: ${options.method} http://${options.hostname}:${options.port}${options.path}`);

const req = http.request(options, (res) => {
  console.log(`Status: ${res.statusCode}`);
  console.log('Headers:', res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('Response length:', data.length);
    console.log('First 200 chars:', data.substring(0, 200));
  });
});

req.on('error', (e) => {
  console.error(`Problem with request: ${e.message}`);
});

req.end();