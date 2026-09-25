import pc from 'picocolors'

export const log = {
  title: (msg: string) => console.log(pc.bold(pc.cyan(msg))),
  step: (msg: string) => console.log(`${pc.cyan('→')} ${msg}`),
  added: (msg: string) => console.log(pc.green(`  + ${msg}`)),
  kept: (msg: string) => console.log(pc.dim(`  · ${msg}`)),
  removed: (msg: string) => console.log(pc.yellow(`  - ${msg}`)),
  warn: (msg: string) => console.log(pc.yellow(`  ! ${msg}`)),
  success: (msg: string) => console.log(pc.bold(pc.green(`✓ ${msg}`))),
  error: (msg: string) => console.error(pc.red(`✗ ${msg}`)),
  blank: () => console.log(''),
}
