import type { ConfigEnv, UserConfig } from 'vite';
import { defineConfig } from 'vite';
import { pluginExposeRenderer } from './vite.base.config';

// https://vitejs.dev/config
export default defineConfig((env) => {
  const forgeEnv = env as ConfigEnv<'renderer'>;
  const { root, mode, forgeConfigSelf } = forgeEnv;
  const name = forgeConfigSelf.name ?? '';

  console.log(`Building renderer: ${name} in mode: ${mode}`);

  return {
    root,
    mode,
    base: './',
    build: {
      outDir: `.vite/renderer/${name}`,
    },
    plugins: [pluginExposeRenderer(name)],
    resolve: {
      preserveSymlinks: true,
    },
    server: {
      proxy: {
        // Proxy requests starting with '/api' (change prefix if preferred).
        '/api': {
          target: 'https://nesting-server.matmaksolutions.com',  // Nesting server URL
          changeOrigin: true,  // Rewrites the origin header to match the target.
          secure: false,  // Allow self-signed certificates if needed
          rewrite: (path) => path.replace(/^\/api/, ''),  // Removes '/api' prefix before forwarding.
        },
      },
    },
    clearScreen: false,
  } as UserConfig;
});
