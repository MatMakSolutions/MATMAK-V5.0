import crypto from 'crypto';
import { URL } from 'url';

function extractBodyParameters(body) {
  if (!body) return {};
  
  try {
    const parsed = typeof body === 'string' ? JSON.parse(body) : body;
    const params = {};
    
    // Extract parameters based on the rules:
    // 1. Root level keys with primitive values
    // 2. One level nested keys when root value is object
    for (const [key, value] of Object.entries(parsed)) {
      if (value === null || value === undefined) {
        params[key] = 'null';
      } else if (Array.isArray(value)) {
        // For arrays, use length and type of first element
        params[key] = `array[${value.length}]`;
      } else if (typeof value === 'object') {
        // For objects, include nested keys with primitive values
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (nestedValue === null || nestedValue === undefined) {
            params[`${key}.${nestedKey}`] = 'null';
          } else if (typeof nestedValue !== 'object') {
            params[`${key}.${nestedKey}`] = String(nestedValue);
          } else if (Array.isArray(nestedValue)) {
            params[`${key}.${nestedKey}`] = `array[${nestedValue.length}]`;
          }
        }
      } else {
        // Primitive values
        params[key] = String(value);
      }
    }
    
    return params;
  } catch (e) {
    // If not JSON, return empty
    return {};
  }
}

// Endpoints that should ignore all parameters for caching
const PARAMETERLESS_ENDPOINTS = [
  '/api/usercuttes'
];

// Export for configuration access
export { PARAMETERLESS_ENDPOINTS };

export function generateCacheKey(method, url, body = null) {
  const parsedUrl = new URL(url, 'http://localhost');
  
  // Check if this endpoint should ignore all parameters
  const ignoreAllParams = PARAMETERLESS_ENDPOINTS.some(endpoint => 
    parsedUrl.pathname === endpoint || parsedUrl.pathname.startsWith(endpoint + '/')
  );
  
  let sortedParams = '';
  
  if (!ignoreAllParams) {
    // Get URL query parameters
    const urlParams = Object.fromEntries(parsedUrl.searchParams.entries());
    
    // Get body parameters for POST/PUT/PATCH
    let bodyParams = {};
    if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
      bodyParams = extractBodyParameters(body);
    }
    
    // Merge all parameters
    const allParams = { ...urlParams, ...bodyParams };
    
    // Remove authToken parameter from cache key generation
    delete allParams.authToken;
    
    // Sort all parameters for consistent hashing
    sortedParams = Object.entries(allParams)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
  }
  
  const cacheString = `${method}:${parsedUrl.pathname}:${sortedParams}`;
  
  return crypto
    .createHash('sha256')
    .update(cacheString)
    .digest('hex')
    .substring(0, 16);
}

export function getRequestInfo(req, body = null) {
  const fullUrl = req.originalUrl || req.url;
  const method = req.method;
  const parsedUrl = new URL(fullUrl, `http://${req.headers.host || 'localhost'}`);
  
  // Check if this endpoint ignores all parameters
  const ignoreAllParams = PARAMETERLESS_ENDPOINTS.some(endpoint => 
    parsedUrl.pathname === endpoint || parsedUrl.pathname.startsWith(endpoint + '/')
  );
  
  return {
    method,
    path: parsedUrl.pathname,
    query: Object.fromEntries(parsedUrl.searchParams),
    body: body ? extractBodyParameters(body) : {},
    fullUrl,
    cacheKey: generateCacheKey(method, fullUrl, body),
    ignoreAllParams
  };
}