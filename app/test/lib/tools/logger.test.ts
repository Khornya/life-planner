/* eslint-disable no-console */
import type { LogLevelType } from '@/lib/tools/logger'
import { logger } from '@/lib/tools/logger'

jest.unmock('@/lib/tools/logger')

describe('Logger wrapper', () => {
  const testCases: { target: LogLevelType; log: string }[] = [
    { target: 'log', log: 'SomeLog' },
    { target: 'debug', log: 'SomeDebug' },
    { target: 'error', log: 'SomeError' },
    { target: 'info', log: 'SomeInfo' },
    { target: 'trace', log: 'SomeTrace' },
    { target: 'warn', log: 'SomeWarn' }
  ]

  testCases.forEach(test =>
    it(`should call console.${test.target} with ${test.log}`, () => {
      jest.spyOn(console, test.target).mockImplementationOnce(() => {})

      logger(test.target, test.log)

      expect(console[test.target]).toHaveBeenCalledTimes(1)
      expect(console[test.target]).toHaveBeenCalledWith(expect.stringContaining(test.log))
    })
  )
})
