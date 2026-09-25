import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  sourcemap: true,
  // toolkit-core é privado: entra no bundle. As tools (@mir-code/*) ficam externas.
  noExternal: ['@mir-code/toolkit-core'],
  banner: { js: '#!/usr/bin/env node' },
})
