import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export class CacheManager {
  constructor(cacheDir) {
    this.cacheDir = path.resolve(cacheDir);
    this.initPromise = this.init();
  }

  async init() {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  async ensureReady() {
    await this.initPromise;
  }

  getCachePath(cacheKey) {
    return path.join(this.cacheDir, `${cacheKey}.json`);
  }

  async get(cacheKey) {
    await this.ensureReady();
    try {
      const cachePath = this.getCachePath(cacheKey);
      const data = await fs.readFile(cachePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async set(cacheKey, data) {
    await this.ensureReady();
    const cachePath = this.getCachePath(cacheKey);
    const cacheData = {
      ...data,
      timestamp: new Date().toISOString(),
      cacheKey
    };
    await fs.writeFile(cachePath, JSON.stringify(cacheData, null, 2));
    return cacheData;
  }

  async has(cacheKey) {
    await this.ensureReady();
    try {
      await fs.access(this.getCachePath(cacheKey));
      return true;
    } catch {
      return false;
    }
  }

  async clear() {
    await this.ensureReady();
    const files = await fs.readdir(this.cacheDir);
    await Promise.all(
      files
        .filter(f => f.endsWith('.json'))
        .map(f => fs.unlink(path.join(this.cacheDir, f)))
    );
  }

  async list() {
    await this.ensureReady();
    const files = await fs.readdir(this.cacheDir);
    const cacheEntries = [];
    
    for (const file of files.filter(f => f.endsWith('.json'))) {
      try {
        const data = await fs.readFile(path.join(this.cacheDir, file), 'utf-8');
        const entry = JSON.parse(data);
        cacheEntries.push({
          cacheKey: entry.cacheKey,
          method: entry.request.method,
          url: entry.request.url,
          timestamp: entry.timestamp
        });
      } catch (error) {
        console.error(`Error reading cache file ${file}:`, error);
      }
    }
    
    return cacheEntries;
  }
}

export async function clearCache(cacheDir) {
  const manager = new CacheManager(cacheDir);
  await manager.clear();
}