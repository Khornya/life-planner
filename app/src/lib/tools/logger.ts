export type LogLevelType = 'debug' | 'error' | 'info' | 'log' | 'trace' | 'warn'

/* eslint no-console: "off" */
export const logger = (logLevel: LogLevelType, log: string, ...args: any[]) => {
  if (logLevel === 'error' || process.env.NODE_ENV !== 'production') {
    const timestamp = new Date().toISOString().slice(0, -5).replace('T', ' ')
    console[logLevel](`${timestamp} - ${log}`, ...args)
  }
}
