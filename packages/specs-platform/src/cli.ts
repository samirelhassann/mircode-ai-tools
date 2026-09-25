import { log } from '@mir-code/toolkit-core'
import { Command } from 'commander'
import { specsPlatformTool } from './tool.js'

const program = new Command()
  .name('specs')
  .description(specsPlatformTool.description)
  .version(specsPlatformTool.version, '-v, --version', 'Imprime a versão.')

specsPlatformTool.register(program)

program.parseAsync(process.argv).catch((err: Error) => {
  log.error(err.message)
  process.exit(1)
})
