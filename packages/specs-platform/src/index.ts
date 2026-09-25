// API pública do @mir-code/specs-platform — consumida pelo `mircode-ai`.
export { specsPlatformTool } from './tool.js'
export { runInstall } from './commands/install.js'
export type { InstallOptions, InstallResult } from './commands/install.js'
export { runStart, runStatus, runStop } from './commands/start.js'
export type { StartOptions } from './commands/start.js'
export type { ToolAction, ToolActionContext, ToolDefinition } from '@mir-code/toolkit-core'
