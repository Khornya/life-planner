import { combineIntervals, combineOneInterval } from '@/lib/server/api/services/scheduler'

describe('Scheduler service', () => {
  describe('combineIntervals helper', () => {
    it('should return same intervals if they do not overlap', () => {
      const intervals = [
        { id: '0', start: 0, end: 5, tags: ['First'] },
        { id: '6', start: 6, end: 10, tags: ['Second'] },
      ]

      const result = combineIntervals(intervals)

      expect(result).toEqual(intervals)
    })

    it('should return intervals combined if they overlap', () => {
      const intervals = [
        { id: 'a', start: 0, end: 5, tags: ['First'] },
        { id: 'b', start: 3, end: 10, tags: ['Second'] },
      ]

      const result = combineIntervals(intervals)

      expect(result).toEqual([
        { id: '0', start: 0, end: 2, tags: ['First'] },
        { id: '3', start: 3, end: 5, tags: expect.arrayContaining(['First', 'Second']) },
        { id: '6', start: 6, end: 10, tags: ['Second'] },
      ])
    })
  })
})
