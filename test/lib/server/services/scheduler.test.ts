import { combineIntervals, combineIntervalsInternal } from '@/lib/server/api/services/scheduler'

describe('Scheduler service', () => {
  describe('combineIntervalsInternal helper', () => {
    it('should return same intervals if they do not overlap', () => {
      const intervals = [
        { id: '0', start: 0, end: 5, tags: ['First'] },
        { id: '6', start: 6, end: 10, tags: ['Second'] },
      ]

      const result = combineIntervalsInternal(intervals)

      expect(result).toEqual(intervals)
    })

    it('should return intervals combined if they overlap', () => {
      const intervals = [
        { id: 'a', start: 10, end: 15, tags: ['First'] },
        { id: 'b', start: 13, end: 20, tags: ['Second'] },
      ]

      const result = combineIntervalsInternal(intervals)

      expect(result).toEqual([
        { id: '0', start: 10, end: 12, tags: ['First'] },
        { id: '3', start: 13, end: 15, tags: expect.arrayContaining(['First', 'Second']) },
        { id: '6', start: 16, end: 20, tags: ['Second'] },
      ])
    })

    it('should not merge intervals with same tags', () => {
      const intervals = [
        { id: 'a', start: 10, end: 15, tags: ['First'] },
        { id: 'b', start: 20, end: 25, tags: ['First'] },
      ]

      const result = combineIntervalsInternal(intervals)

      expect(result).toEqual([
        { id: '0', start: 10, end: 15, tags: ['First'] },
        { id: '6', start: 20, end: 25, tags: ['First'] },
      ])
    })

    it('should merge transparent intervals', () => {
      const intervals = [
        {
          id: 'a',
          start: 5659272,
          end: 5659392,
          tags: ['Ouvré'],
          isTransparent: true,
        },
        {
          id: 'b',
          start: 5659382,
          end: 5659402,
          tags: ['Other'],
          isTransparent: true,
        },
      ]

      const result = combineIntervalsInternal(intervals)

      expect(result).toEqual([
        {
          id: '0',
          start: 5659272,
          end: 5659381,
          tags: ['Ouvré'],
          isTransparent: true,
        },
        {
          id: '110',
          start: 5659382,
          end: 5659392,
          tags: ['Ouvré', 'Other'],
          isTransparent: true,
        },
        {
          id: '121',
          start: 5659393,
          end: 5659402,
          tags: ['Other'],
          isTransparent: true,
        },
      ])
    })
  })

  describe('combineIntervals helper', () => {
    it('should combine transparent intervals together and opaque intervals together', () => {
      const intervals = [
        {
          id: 'a',
          start: 5659272,
          end: 5659392,
          tags: ['Ouvré'],
          isTransparent: true,
        },
        {
          id: 'b',
          start: 5659382,
          end: 5659402,
          tags: ['Other'],
        },
      ]

      const result = combineIntervals(intervals)

      expect(result).toEqual([
        {
          id: '0',
          start: 5659272,
          end: 5659392,
          tags: ['Ouvré'],
          isTransparent: true,
        },
        {
          id: '0',
          start: 5659382,
          end: 5659402,
          tags: ['Other'],
          isTransparent: undefined,
        },
      ])
    })
  })
})
