import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/cli.ts', 'src/index.ts'],
  format: ['esm'],
  target: 'node20',
  clean: true,
  // `resolve` embute os tipos do toolkit-core (privado) no .d.ts publicado.
  dts: { entry: 'src/index.ts' },
  sourcemap: true,
  // Pacotes internos (private) entram no bundle; as deps de runtime deles
  // continuam externas e estão declaradas no package.json deste pacote.
  noExternal: ['@mir-code/specs-server', '@mir-code/toolkit-core'],
  // Só o cli.js precisa, mas o shebang é inofensivo no index.js (Node o ignora).
  banner: { js: '#!/usr/bin/env node' },
})
