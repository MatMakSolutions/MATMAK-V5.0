#!/usr/bin/env node

import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function startCacheViewer(port = 3001, cacheDir = './cache') {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  
  // API endpoint to get all cache entries
  app.get('/api/cache', async (req, res) => {
    try {
      const files = await fs.readdir(cacheDir);
      const cacheFiles = files.filter(f => f.endsWith('.json'));
      const entries = [];
      
      for (const file of cacheFiles) {
        try {
          const data = await fs.readFile(path.join(cacheDir, file), 'utf-8');
          const cache = JSON.parse(data);
          const cacheKey = path.basename(file, '.json');
          
          // Decode body for display
          let decodedBody = '';
          try {
            decodedBody = Buffer.from(cache.response.body, 'base64').toString('utf-8');
            // Try to parse as JSON for better display
            try {
              decodedBody = JSON.parse(decodedBody);
            } catch {}
          } catch {}
          
          entries.push({
            cacheKey,
            method: cache.request.method,
            path: cache.request.path,
            query: cache.request.query,
            timestamp: cache.timestamp,
            request: cache.request,
            response: {
              ...cache.response,
              decodedBody
            }
          });
        } catch (err) {
          console.error(`Error reading ${file}:`, err);
        }
      }
      
      res.json(entries);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // API endpoint to update cache entry
  app.post('/api/cache/:cacheKey', async (req, res) => {
    try {
      const { cacheKey } = req.params;
      const { responseBody, responseHeaders, statusCode } = req.body;
      
      const cachePath = path.join(cacheDir, `${cacheKey}.json`);
      const data = await fs.readFile(cachePath, 'utf-8');
      const cache = JSON.parse(data);
      
      // Update response
      if (responseBody !== undefined) {
        const bodyString = typeof responseBody === 'object' 
          ? JSON.stringify(responseBody, null, 2)
          : responseBody;
        cache.response.body = Buffer.from(bodyString).toString('base64');
      }
      
      if (responseHeaders) {
        cache.response.headers = responseHeaders;
      }
      
      if (statusCode) {
        cache.response.statusCode = statusCode;
      }
      
      cache.modified = new Date().toISOString();
      
      await fs.writeFile(cachePath, JSON.stringify(cache, null, 2));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });
  
  // Serve HTML interface
  app.get('/', (req, res) => {
    res.send(HTML_CONTENT);
  });
  
  const server = app.listen(port, () => {
    console.log(chalk.cyan('\n🎨 Cache Viewer\n'));
    console.log(chalk.green('✓'), `Server started at http://localhost:${port}`);
    console.log(chalk.gray('Cache directory:'), path.resolve(cacheDir));
    console.log('');
  });
  
  return server;
}

const HTML_CONTENT = `
<!DOCTYPE html>
<html>
<head>
  <title>Proxy Cache Viewer</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #f5f5f5;
      color: #333;
    }
    .container { max-width: 1400px; margin: 0 auto; padding: 20px; }
    h1 { margin-bottom: 20px; color: #2563eb; }
    
    .controls {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      margin-bottom: 20px;
    }
    
    .endpoint-group {
      display: flex;
      gap: 20px;
      align-items: center;
    }
    
    select {
      padding: 8px 12px;
      border: 1px solid #ddd;
      border-radius: 4px;
      font-size: 14px;
      background: white;
    }
    
    .viewer {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      display: flex;
      flex-direction: column;
    }
    
    .tabs {
      display: flex;
      border-bottom: 2px solid #e5e7eb;
      background: #f9fafb;
      border-radius: 8px 8px 0 0;
      height: 50px;
      align-items: stretch;
    }
    
    .tab {
      padding: 0 30px;
      cursor: pointer;
      font-weight: 500;
      color: #6b7280;
      border-bottom: 2px solid transparent;
      margin-bottom: -2px;
      transition: all 0.2s;
      display: flex;
      align-items: center;
    }
    
    .tab:hover {
      color: #374151;
    }
    
    .tab.active {
      color: #2563eb;
      border-bottom-color: #2563eb;
      background: white;
    }
    
    .tab-content {
      flex: 1;
      overflow: auto;
      padding: 20px;
      display: none;
    }
    
    .tab-content.active {
      display: block;
    }
    
    .tab-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    }
    
    pre {
      background: #f9fafb;
      padding: 15px;
      border-radius: 4px;
      overflow: auto;
      font-size: 13px;
      line-height: 1.5;
    }
    
    .metadata {
      margin-bottom: 15px;
      padding: 10px;
      background: #f3f4f6;
      border-radius: 4px;
    }
    
    .metadata div {
      margin: 5px 0;
      font-size: 13px;
    }
    
    .metadata strong {
      display: inline-block;
      width: 100px;
      color: #6b7280;
    }
    
    button {
      background: #2563eb;
      color: white;
      border: none;
      padding: 8px 16px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 14px;
    }
    
    button:hover { background: #1d4ed8; }
    button:disabled { background: #9ca3af; cursor: not-allowed; }
    
    #responseEditor {
      width: 100%;
      min-height: 400px;
      padding: 15px;
      border: 1px solid #e5e7eb;
      border-radius: 4px;
      font-family: 'Monaco', 'Consolas', monospace;
      font-size: 13px;
      resize: vertical;
    }
    
    h3 {
      margin: 0;
      font-size: 18px;
      color: #1f2937;
    }
    
    h4 {
      margin-top: 20px;
      margin-bottom: 10px;
      color: #4b5563;
      font-size: 14px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    
    .status-line {
      display: flex;
      gap: 10px;
      margin-bottom: 15px;
    }
    
    .status-line input {
      padding: 8px;
      border: 1px solid #ddd;
      border-radius: 4px;
      width: 100px;
    }
    
    .no-data {
      text-align: center;
      color: #9ca3af;
      padding: 40px;
    }
    
    .loading {
      text-align: center;
      padding: 40px;
      color: #6b7280;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🔍 Proxy Cache Viewer</h1>
    
    <div class="controls">
      <div class="endpoint-group">
        <label>
          <strong>Endpoint:</strong>
          <select id="endpointSelect">
            <option value="">Select an endpoint...</option>
          </select>
        </label>
        
        <label>
          <strong>Parameters:</strong>
          <select id="paramsSelect" disabled>
            <option value="">Select parameters...</option>
          </select>
        </label>
      </div>
    </div>
    
    <div class="viewer" id="viewer" style="display: none;">
      <div class="tabs">
        <div class="tab active" onclick="switchTab('request')">📤 Request</div>
        <div class="tab" onclick="switchTab('response')">📥 Response</div>
      </div>
      
      <div class="tab-content active" id="requestTab">
        <div id="requestPanel">
          <div class="no-data">Select an endpoint and parameters to view</div>
        </div>
      </div>
      
      <div class="tab-content" id="responseTab">
        <div class="tab-header">
          <h3>Response Editor</h3>
          <button id="saveBtn" onclick="saveResponse()" disabled>💾 Save Changes</button>
        </div>
        <div id="responsePanel">
          <div class="no-data">Select an endpoint and parameters to view</div>
        </div>
      </div>
    </div>
  </div>
  
  <script>
    let cacheData = [];
    let currentEntry = null;
    
    function switchTab(tabName) {
      // Update tab buttons
      document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
      });
      event.target.classList.add('active');
      
      // Update tab content
      document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(tabName + 'Tab').classList.add('active');
    }
    
    async function loadCache() {
      try {
        const response = await fetch('/api/cache');
        cacheData = await response.json();
        
        // Group by endpoint (excluding OPTIONS)
        const endpoints = {};
        cacheData.forEach(entry => {
          // Skip OPTIONS requests
          if (entry.method === 'OPTIONS') return;
          
          const key = \`\${entry.method} \${entry.path}\`;
          if (!endpoints[key]) {
            endpoints[key] = [];
          }
          endpoints[key].push(entry);
        });
        
        // Populate endpoint dropdown
        const endpointSelect = document.getElementById('endpointSelect');
        endpointSelect.innerHTML = '<option value="">Select an endpoint...</option>';
        
        Object.keys(endpoints).sort().forEach(endpoint => {
          const option = document.createElement('option');
          option.value = endpoint;
          option.textContent = \`\${endpoint} (\${endpoints[endpoint].length} entries)\`;
          endpointSelect.appendChild(option);
        });
        
        endpointSelect.onchange = () => loadParams(endpoints);
      } catch (error) {
        console.error('Error loading cache:', error);
      }
    }
    
    function loadParams(endpoints) {
      const endpointSelect = document.getElementById('endpointSelect');
      const paramsSelect = document.getElementById('paramsSelect');
      const selectedEndpoint = endpointSelect.value;
      
      if (!selectedEndpoint) {
        paramsSelect.disabled = true;
        paramsSelect.innerHTML = '<option value="">Select parameters...</option>';
        return;
      }
      
      paramsSelect.disabled = false;
      paramsSelect.innerHTML = '<option value="">Select parameters...</option>';
      
      const entries = endpoints[selectedEndpoint];
      entries.forEach((entry, index) => {
        const option = document.createElement('option');
        option.value = entry.cacheKey;
        
        // Build parameter description
        const params = { ...entry.query };
        const paramStr = Object.keys(params).length > 0
          ? Object.entries(params).map(([k, v]) => \`\${k}=\${v}\`).join(', ')
          : 'No parameters';
        
        option.textContent = \`\${paramStr} [\${entry.cacheKey}]\`;
        paramsSelect.appendChild(option);
      });
      
      paramsSelect.onchange = () => loadEntry();
    }
    
    function loadEntry() {
      const cacheKey = document.getElementById('paramsSelect').value;
      if (!cacheKey) {
        document.getElementById('viewer').style.display = 'none';
        return;
      }
      
      currentEntry = cacheData.find(e => e.cacheKey === cacheKey);
      if (!currentEntry) return;
      
      document.getElementById('viewer').style.display = 'grid';
      
      // Display request
      const requestPanel = document.getElementById('requestPanel');
      
      // Filter sensitive headers
      const filteredHeaders = { ...currentEntry.request.headers };
      if (filteredHeaders.authorization) {
        filteredHeaders.authorization = filteredHeaders.authorization.startsWith('Bearer ')
          ? 'Bearer [HIDDEN]'
          : '[HIDDEN]';
      }
      if (filteredHeaders.Authorization) {
        filteredHeaders.Authorization = filteredHeaders.Authorization.startsWith('Bearer ')
          ? 'Bearer [HIDDEN]'
          : '[HIDDEN]';
      }
      // Hide other sensitive headers
      ['cookie', 'Cookie', 'x-api-key', 'X-Api-Key', 'api-key', 'Api-Key'].forEach(header => {
        if (filteredHeaders[header]) {
          filteredHeaders[header] = '[HIDDEN]';
        }
      });
      
      requestPanel.innerHTML = \`
        <div class="metadata">
          <div><strong>Method:</strong> \${currentEntry.method}</div>
          <div><strong>URL:</strong> \${currentEntry.request.url}</div>
          <div><strong>Timestamp:</strong> \${new Date(currentEntry.timestamp).toLocaleString()}</div>
          <div><strong>Cache Key:</strong> \${currentEntry.cacheKey}</div>
        </div>
        <h4>Query Parameters</h4>
        <pre>\${JSON.stringify(currentEntry.query, null, 2)}</pre>
        <h4>Headers</h4>
        <pre>\${JSON.stringify(filteredHeaders, null, 2)}</pre>
        \${currentEntry.request.body ? \`
          <h4>Body</h4>
          <pre>\${JSON.stringify(JSON.parse(atob(currentEntry.request.body)), null, 2)}</pre>
        \` : ''}
      \`;
      
      // Display response
      const responsePanel = document.getElementById('responsePanel');
      const responseBody = typeof currentEntry.response.decodedBody === 'object'
        ? JSON.stringify(currentEntry.response.decodedBody, null, 2)
        : currentEntry.response.decodedBody;
      
      responsePanel.innerHTML = \`
        <div class="status-line">
          <strong>Status:</strong>
          <input type="number" id="statusCode" value="\${currentEntry.response.statusCode}" />
        </div>
        <h4>Response Body</h4>
        <textarea id="responseEditor">\${responseBody}</textarea>
        <h4>Response Headers</h4>
        <pre>\${JSON.stringify(currentEntry.response.headers, null, 2)}</pre>
      \`;
      
      document.getElementById('saveBtn').disabled = false;
    }
    
    async function saveResponse() {
      if (!currentEntry) return;
      
      const saveBtn = document.getElementById('saveBtn');
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
      
      try {
        const responseBody = document.getElementById('responseEditor').value;
        const statusCode = parseInt(document.getElementById('statusCode').value);
        
        // Try to parse as JSON
        let bodyToSave = responseBody;
        try {
          bodyToSave = JSON.parse(responseBody);
        } catch {}
        
        const response = await fetch(\`/api/cache/\${currentEntry.cacheKey}\`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            responseBody: bodyToSave,
            statusCode: statusCode
          })
        });
        
        if (response.ok) {
          saveBtn.textContent = '✅ Saved!';
          setTimeout(() => {
            saveBtn.textContent = '💾 Save Changes';
            saveBtn.disabled = false;
          }, 2000);
        } else {
          throw new Error('Failed to save');
        }
      } catch (error) {
        saveBtn.textContent = '❌ Error!';
        setTimeout(() => {
          saveBtn.textContent = '💾 Save Changes';
          saveBtn.disabled = false;
        }, 2000);
      }
    }
    
    // Load cache on page load
    loadCache();
  </script>
</body>
</html>
`;