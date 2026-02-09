import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { CacheManager } from './cache-manager.js';
import { Logger } from './logger.js';
import { getRequestInfo } from './request-hash.js';

export async function startProxyServer(options) {
  const app = express();
  const cacheManager = new CacheManager(options.cacheDir);
  const logger = new Logger(options.logDir);
  
  // Set global verbose flag
  global.verbose = options.verbose;
  
  // Create proxy middleware instance
  const proxyMiddleware = createProxyMiddleware({
    target: options.target,
    changeOrigin: true,
    selfHandleResponse: true, // We need to handle the response to cache it
    timeout: 30000, // 30 second timeout
    proxyTimeout: 30000,
    onProxyReq: (proxyReq, req, res) => {
      if (options.verbose) {
        logger.info(`→ Forwarding ${req.method} request to ${options.target}${req.originalUrl}`);
      }
    },
    onError: (err, req, res) => {
      logger.error(`Proxy error: ${err.message}`, err);
      if (!res.headersSent) {
        res.status(502).json({ 
          error: 'Bad Gateway', 
          message: err.message,
          target: options.target 
        });
      }
    },
    onProxyRes: async (proxyRes, req, res) => {
      const startTime = req.startTime || Date.now();
      const requestInfo = req.requestInfo;
      
      if (options.verbose) {
        logger.info(`← Received response: ${proxyRes.statusCode} ${proxyRes.statusMessage}`);
      }
      
      // Collect response data
      const responseChunks = [];
      proxyRes.on('data', chunk => responseChunks.push(chunk));
      
      proxyRes.on('end', async () => {
        const responseBody = Buffer.concat(responseChunks);
        const duration = Date.now() - startTime;
        
        if (options.verbose) {
          logger.info(`← Response size: ${responseBody.length} bytes, duration: ${duration}ms`);
        }
        
        // Set response headers
        res.status(proxyRes.statusCode);
        Object.entries(proxyRes.headers).forEach(([key, value]) => {
          if (key.toLowerCase() !== 'content-encoding' && 
              key.toLowerCase() !== 'content-length' &&
              key.toLowerCase() !== 'transfer-encoding') {
            res.setHeader(key, value);
          }
        });
        
        // Cache the response if in record or auto mode
        if (options.mode === 'record' || options.mode === 'auto') {
          const cacheData = {
            request: {
              method: requestInfo.method,
              url: requestInfo.fullUrl,
              path: requestInfo.path,
              query: requestInfo.query,
              headers: req.headers,
              body: req.rawBody ? req.rawBody.toString('base64') : null
            },
            response: {
              statusCode: proxyRes.statusCode,
              headers: proxyRes.headers,
              body: responseBody.toString('base64')
            }
          };
          
          await cacheManager.set(requestInfo.cacheKey, cacheData);
          if (options.verbose) {
            logger.success(`Cached response with key: ${requestInfo.cacheKey}`);
          }
        }
        
        // Send response
        res.send(responseBody);
        
        logger.logResponse(requestInfo, proxyRes, duration);
        await logger.saveRequestLog(requestInfo, req, proxyRes, duration);
      });
    }
  });
  
  // Middleware to capture body for caching
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'DELETE') {
      const chunks = [];
      req.on('data', chunk => chunks.push(chunk));
      req.on('end', () => {
        req.rawBody = Buffer.concat(chunks);
        // Restore the body for the proxy
        req.body = req.rawBody;
        next();
      });
    } else {
      next();
    }
  });
  
  // Main request handler
  app.use('*', async (req, res, next) => {
    const startTime = Date.now();
    req.startTime = startTime;
    
    // Get request info for caching
    const requestInfo = getRequestInfo(req, req.rawBody);
    req.requestInfo = requestInfo;
    
    // Check cache first in cache/auto mode
    if (options.mode === 'cache' || options.mode === 'auto') {
      if (options.verbose) {
        logger.info(`Checking cache for key: ${requestInfo.cacheKey}`);
      }
      const cached = await cacheManager.get(requestInfo.cacheKey);
      
      if (cached) {
        logger.logRequest(requestInfo, 'cache', true);
        
        // Send cached response
        res.status(cached.response.statusCode);
        Object.entries(cached.response.headers).forEach(([key, value]) => {
          if (key.toLowerCase() !== 'content-encoding' && 
              key.toLowerCase() !== 'content-length' &&
              key.toLowerCase() !== 'transfer-encoding') {
            res.setHeader(key, value);
          }
        });
        
        const responseBody = Buffer.from(cached.response.body, 'base64');
        res.send(responseBody);
        
        logger.logResponse(requestInfo, cached.response, Date.now() - startTime);
        await logger.saveRequestLog(requestInfo, req, cached.response, Date.now() - startTime);
        return;
      }
    }
    
    // No cache hit or in record mode - proxy the request
    if (options.mode === 'cache') {
      logger.error(`Cache miss for ${requestInfo.method} ${requestInfo.path} - returning 404`);
      res.status(404).json({ 
        error: 'Not found in cache', 
        cacheKey: requestInfo.cacheKey,
        mode: 'cache' 
      });
      return;
    }
    
    if (options.verbose) {
      logger.info(`Proxying request to: ${options.target}${requestInfo.fullUrl}`);
    }
    logger.logRequest(requestInfo, options.mode === 'record' ? 'record' : 'proxy', false);
    
    // Use the proxy middleware
    proxyMiddleware(req, res, next);
  });
  
  // Start server
  const server = app.listen(options.port, () => {
    logger.success(`Proxy server started on port ${options.port}`);
    logger.info(`Proxying to: ${options.target}`);
    logger.info(`Mode: ${options.mode}`);
    console.log('');
  });
  
  // Track active connections for graceful shutdown
  const connections = new Set();
  server.on('connection', (conn) => {
    connections.add(conn);
    conn.on('close', () => connections.delete(conn));
  });
  
  // Graceful shutdown
  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    logger.info('\nShutting down proxy server...');
    
    // Stop accepting new connections
    server.close(() => {
      logger.success('Server closed');
      process.exit(0);
    });
    
    // Close all active connections
    for (const conn of connections) {
      conn.destroy();
    }
    
    // Force exit after 5 seconds
    setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, 5000);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  // Handle uncaught errors
  process.on('unhandledRejection', (err) => {
    logger.error('Unhandled rejection:', err);
  });
  
  return server;
}