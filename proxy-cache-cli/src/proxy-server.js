import http from 'http';
import https from 'https';
import { URL } from 'url';
import { CacheManager } from './cache-manager.js';
import { Logger } from './logger.js';
import { getRequestInfo } from './request-hash.js';

export async function startProxyServer(options) {
  const cacheManager = new CacheManager(options.cacheDir);
  const logger = new Logger(options.logDir);
  
  const server = http.createServer(async (req, res) => {
    const startTime = Date.now();
    let body = Buffer.alloc(0);
    
    // Collect request body
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    
    req.on('end', async () => {
      if (chunks.length > 0) {
        body = Buffer.concat(chunks);
      }
      
      // Get request info for caching
      const requestInfo = getRequestInfo(req, body);
      
      // Check cache first in cache/auto mode
      if (options.mode === 'cache' || options.mode === 'auto') {
        const cached = await cacheManager.get(requestInfo.cacheKey);
        
        if (cached) {
          try {
            logger.logRequest(requestInfo, 'cache', true);
            
            // Validate and decode base64 body
            let responseBody;
            try {
              responseBody = Buffer.from(cached.response.body, 'base64');
            } catch (decodeError) {
              logger.error(`Invalid base64 in cache for key ${requestInfo.cacheKey}`, decodeError);
              // Fall through to proxy the request
              cached = null;
            }
            
            if (cached) {
              // Send cached response
              res.writeHead(cached.response.statusCode, cached.response.headers);
              res.end(responseBody);
              
              logger.logResponse(requestInfo, cached.response, Date.now() - startTime);
              return;
            }
          } catch (error) {
            logger.error(`Error serving from cache: ${error.message}`, error);
            // Fall through to proxy the request
          }
        }
      }
      
      // Cache miss in cache-only mode
      if (options.mode === 'cache') {
        logger.error(`Cache miss for ${requestInfo.method} ${requestInfo.path}`);
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Not found in cache', 
          cacheKey: requestInfo.cacheKey 
        }));
        return;
      }
      
      // Proxy the request
      logger.logRequest(requestInfo, options.mode === 'record' ? 'record' : 'proxy', false);
      
      const targetUrl = new URL(req.url, options.target);
      const isHttps = targetUrl.protocol === 'https:';
      
      const proxyOptions = {
        hostname: targetUrl.hostname,
        port: targetUrl.port || (isHttps ? 443 : 80),
        path: targetUrl.pathname + targetUrl.search,
        method: req.method,
        headers: {
          ...req.headers,
          host: targetUrl.host
        }
      };
      
      if (options.verbose) {
        logger.info(`Proxying to: ${targetUrl.href}`);
      }
      
      const proxyReq = (isHttps ? https : http).request(proxyOptions, (proxyRes) => {
        const responseChunks = [];
        
        proxyRes.on('data', chunk => responseChunks.push(chunk));
        
        proxyRes.on('end', async () => {
          const responseBody = Buffer.concat(responseChunks);
          const duration = Date.now() - startTime;
          
          // Send response to client
          res.writeHead(proxyRes.statusCode, proxyRes.headers);
          res.end(responseBody);
          
          // Cache if needed
          if (options.mode === 'record' || options.mode === 'auto') {
            const cacheData = {
              request: {
                method: requestInfo.method,
                url: requestInfo.fullUrl,
                path: requestInfo.path,
                query: requestInfo.query,
                headers: req.headers,
                body: body.length > 0 ? body.toString('base64') : null
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
          
          logger.logResponse(requestInfo, proxyRes, duration);
        });
      });
      
      proxyReq.on('error', (err) => {
        logger.error(`Proxy error: ${err.message}`);
        res.writeHead(502, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ 
          error: 'Bad Gateway', 
          message: err.message 
        }));
      });
      
      // Write body if present
      if (body.length > 0) {
        proxyReq.write(body);
      }
      
      proxyReq.end();
    });
  });
  
  server.listen(options.port, () => {
    logger.success(`Proxy server started on port ${options.port}`);
    logger.info(`Proxying to: ${options.target}`);
    logger.info(`Mode: ${options.mode}`);
    console.log('');
  });
  
  // Graceful shutdown
  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    logger.info('\nShutting down proxy server...');
    server.close(() => {
      logger.success('Server closed');
      process.exit(0);
    });
    
    setTimeout(() => {
      process.exit(1);
    }, 3000);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  
  return server;
}