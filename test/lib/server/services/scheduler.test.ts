import { combineIntervals } from '@/lib/server/api/services/scheduler'

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
        { id: 'a', start: 10, end: 15, tags: ['First'] },
        { id: 'b', start: 13, end: 20, tags: ['Second'] },
      ]

      const result = combineIntervals(intervals)

      expect(result).toEqual([
        { id: '0', start: 10, end: 12, tags: ['First'] },
        { id: '3', start: 13, end: 15, tags: expect.arrayContaining(['First', 'Second']) },
        { id: '6', start: 16, end: 20, tags: ['Second'] },
      ])
    })
  })
})
