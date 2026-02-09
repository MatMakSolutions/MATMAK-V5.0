# Proxy Cache CLI

A simple HTTP proxy server with recording and caching capabilities. Perfect for development, testing, and API mocking.

**Key Concept**: Configure your application to always call `localhost:8080`, then use this tool to control where those calls go and whether they're cached.

## Features

- 🎯 **Three Operation Modes**:
  - `record` - Always proxies to the real server and saves responses
  - `cache` - Serves from cache, returns 404 for cache misses
  - `auto` (default) - Serves from cache when available, proxies and records on miss

- 📦 **Smart Caching**:
  - Cache key based on HTTP method + URL path + query parameters
  - Headers are stored but not used for cache matching
  - File-based storage for easy inspection

- 🎨 **Developer Friendly**:
  - Colored console output
  - Clear cache hit/miss indicators
  - Request/response logging

## Installation

```bash
npm install
npm link  # Optional: to use globally as 'proxy-cache'
```

## Usage

### Setup Your Application

1. **Configure your app** to always call `http://localhost:8080` instead of the real API
2. **Start the proxy** with the real API target
3. **Control behavior** with modes: record, cache, or auto

### Basic Usage

```bash
# Your app is configured to call http://localhost:8080
# Now you decide where those calls actually go:

# Record mode - all calls go to the real API and get saved
node src/index.js --target https://api.example.com --mode record

# Cache mode - all calls served from local cache (offline mode)
node src/index.js --target https://api.example.com --mode cache

# Auto mode (default) - use cache when available, fetch & save when not
node src/index.js --target https://api.example.com

# Change the target without touching your app config
node src/index.js --target https://staging-api.example.com --mode record
```

### Command Line Options

```
Options:
  -V, --version          output the version number
  -p, --port <port>      proxy server port (default: "8080")
  -t, --target <url>     target server URL (default: "http://localhost:3000")
  -m, --mode <mode>      operation mode: record, cache, or auto (default: "auto")
  -c, --cache-dir <dir>  cache directory (default: "./cache")
  -l, --log-dir <dir>    logs directory (default: "./logs")
  --clear-cache          clear cache before starting
  -h, --help             display help for command
```

### Real-World Example

Let's say your app makes calls to `https://api.myservice.com/v1/users`:

```javascript
// In your app config:
const API_BASE = 'http://localhost:8080';  // Always use the proxy

// Your API calls:
fetch(`${API_BASE}/v1/users`);  // This will go through the proxy
```

Now control the behavior without changing your app:

```bash
# First time - record all real API responses
node src/index.js --target https://api.myservice.com --mode record
# Make requests through your app - they'll be saved

# Development - work offline with cached data
node src/index.js --target https://api.myservice.com --mode cache
# Your app works perfectly without internet

# Testing - point to staging environment
node src/index.js --target https://staging-api.myservice.com --mode record

# Mixed mode - use cache but fetch new endpoints as needed
node src/index.js --target https://api.myservice.com --mode auto
```

## How It Works

1. **Cache Key Generation**: Each request gets a unique hash based on:
   - HTTP method (GET, POST, etc.)
   - URL path
   - Query parameters (sorted for consistency)
   - Request body parameters for POST/PUT/PATCH (sorted for consistency)

2. **Storage Format**: Cached responses are stored as JSON files:
   ```
   cache/
   ├── a1b2c3d4e5f6.json
   ├── f6e5d4c3b2a1.json
   └── ...
   ```

3. **Body-Aware Caching** (for POST/PUT/PATCH):
   - Extracts root-level keys with primitive values
   - Extracts nested keys (one level) when root value is an object
   - All parameters are sorted alphabetically for consistent hashing
   - Arrays are represented as `array[length]` in the cache key
   - **authToken parameter is ignored** in both query and body for cache keys
   - **Special endpoints** like `/api/usercuttes` ignore ALL parameters

   Example: These requests share the same cache entry:
   ```
   GET /api/users?page=1&authToken=abc123
   GET /api/users?page=1&authToken=xyz789
   ```
   
   Special endpoints that ignore ALL parameters:
   ```
   GET /api/usercuttes?page=1&filter=active
   GET /api/usercuttes?page=2&filter=inactive
   # Both use the same cache entry!
   ```

   Example POST bodies that generate different cache keys:
   ```json
   // Different pagination (same cache key regardless of authToken)
   { "page": 1, "limit": 10, "authToken": "abc" }
   { "page": 2, "limit": 10, "authToken": "xyz" }
   
   // Different nested values
   { "query": { "user": "john", "type": "admin" } }
   { "query": { "user": "jane", "type": "user" } }
   ```

4. **Request Flow**:
   - In `cache`/`auto` mode: Check cache first
   - Cache hit: Return cached response immediately
   - Cache miss: Proxy to target server
   - In `record`/`auto` mode: Save response to cache

## Use Cases

- **Development**: Cache external API calls to work offline
- **Testing**: Record real API responses for consistent tests
- **Performance**: Reduce load on backend during development
- **Debugging**: Inspect all API calls and responses

## Cache Editing

### Visual Web Interface

Start the visual cache viewer for easy editing:

```bash
# Start web interface on port 3001
node src/viewer-cli.js

# Custom port
node src/viewer-cli.js --port 4000

# Open in browser
http://localhost:3001
```

Features:
- 📊 Groups cache entries by endpoint
- 🔍 Dropdown selection of parameter combinations
- 📝 Side-by-side request/response viewer
- ✏️ Edit response body and status code
- 💾 Save changes back to cache

### Command Line Tools

The tool also includes command-line utilities for cache editing:

### View cache entries:
```bash
# List all cached entries
node src/cache-editor.js list

# Show specific entry in readable format
node src/cache-editor.js show a1b2c3d4e5f6

# Decode body to file
node src/cache-editor.js decode a1b2c3d4e5f6 -o response.json
```

### Edit cache entries:
```bash
# Replace body with text
node src/cache-editor.js edit-body a1b2c3d4e5f6 --text "New response"

# Replace body with JSON
node src/cache-editor.js edit-body a1b2c3d4e5f6 --json '{"status":"ok"}'

# Replace body from file
node src/cache-editor.js edit-body a1b2c3d4e5f6 --file new-response.json

# Validate all cache entries
node src/cache-editor.js validate
```

### Why manual edits might fail:
1. **Invalid base64**: The body must be valid base64 encoded
2. **Malformed JSON**: The cache file itself must be valid JSON
3. **Missing fields**: Required fields like `response.body` must exist

The cache editor handles base64 encoding automatically and updates content-length headers.

## License

MIT