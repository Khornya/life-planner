import { calendar_v3 } from 'googleapis'
import { getTaskSchedulerClient } from '../taskSchedulerClient'
import { ExtendedProperties, parseExtendedProperties } from '../google/calendar'
import { groupBy, isEqual } from 'lodash'
import moment from 'moment'

type SchedulerInputEvent = {
  id: string
  impact: number
  duration: number
  dueDate: number
  maxDueDate: number
  tags: string[]
}

type SchedulerInputInterval = {
  id: string
  start: number
  end: number
  isTransparent?: boolean
  tags?: string[]
}

export type Task = {
  delay: number
  id: string
  isLate: boolean
  isPresent: boolean
  priority: number
  start: number
  end: number
}

type ScheduleRawResult = {
  found: boolean
  tasks: Task[]
}

export type ScheduleEventResult = Event & {
  scheduledEvent: Task | null
}

export type Event = {
  event: calendar_v3.Schema$Event
  extendedProperties?: ExtendedProperties
}

export const parseGoogleEvents: (events: calendar_v3.Schema$Event[]) => Event[] = events =>
  events.map(event => {
    const extendedProperties = parseExtendedProperties(event)
    return {
      event,
      extendedProperties,
    }
  })

const getTagsByTimeUnit = (intervals: SchedulerInputInterval[]) => {
  const tagsByTimeUnit: { [key: number]: string[] | undefined } = {}
  for (const interval of intervals) {
    for (let i = interval.start; i <= interval.end; i++) {
      if (!tagsByTimeUnit[i]) {
        tagsByTimeUnit[i] = interval.tags
      } else {
        tagsByTimeUnit[i] = (tagsByTimeUnit[i] || []).concat(interval.tags || [])
      }
    }
  }
  return tagsByTimeUnit
}

export const combineIntervalsInternal: (intervals: SchedulerInputInterval[]) => SchedulerInputInterval[] = intervals => {
  if (!intervals.length) return []
  const isTransparent = intervals[0].isTransparent || false
  const tagsByTimeUnit = getTagsByTimeUnit(intervals)
  const sortedTimeUnits = Object.keys(tagsByTimeUnit)
    .map(value => parseInt(value))
    .sort((a, b) => a - b)
  let currentIndex = 0
  const result: SchedulerInputInterval[] = []
  for (let i = 1; i < sortedTimeUnits.length; i++) {
    if (
      sortedTimeUnits[i] === sortedTimeUnits[i - 1] + 1 &&
      isEqual(tagsByTimeUnit[sortedTimeUnits[i]], tagsByTimeUnit[sortedTimeUnits[currentIndex]])
    )
      continue
    else {
      result.push({
        id: currentIndex.toString(),
        tags: tagsByTimeUnit[sortedTimeUnits[currentIndex]],
        start: sortedTimeUnits[currentIndex],
        end: sortedTimeUnits[i - 1],
        isTransparent,
      })
      currentIndex = i
    }
  }
  result.push({
    id: currentIndex.toString(),
    tags: tagsByTimeUnit[sortedTimeUnits[currentIndex]],
    start: sortedTimeUnits[currentIndex],
    end: sortedTimeUnits[sortedTimeUnits.length - 1],
    isTransparent,
  })
  return result
}

export const combineIntervals = (intervals: SchedulerInputInterval[]) => {
  const groupedIntervals = groupBy(intervals, 'isTransparent')
  const transparentIntervals = groupedIntervals['true'] || []
  const opaqueIntervals = (groupedIntervals['false'] || []).concat(groupedIntervals['undefined'] || [])
  return combineIntervalsInternal(transparentIntervals).concat(combineIntervalsInternal(opaqueIntervals))
}

const isEventEnded = (event: calendar_v3.Schema$Event) =>
  (event.end?.date && event.end?.date <= moment().format('yyyy-MM-DD')) ||
  (event.end?.dateTime && event.end?.dateTime <= moment().toISOString())

export const schedule: (
  regularEvents: calendar_v3.Schema$Event[],
  flexibleEvents: calendar_v3.Schema$Event[],
  reservedTags: calendar_v3.Schema$Event[]
) => Promise<ScheduleEventResult[] | null> = async (regularEvents, flexibleEvents, reservedTags) => {
  const parsedRegularEvents = parseGoogleEvents(regularEvents)
  const filteredRegularEvents = parsedRegularEvents.filter(
    parsedEvent => !isEventEnded(parsedEvent.event) && parsedEvent.event.transparency !== 'transparent'
  )
  const scheduleEventResults: ScheduleEventResult[] = parsedRegularEvents.map(parsedEvent => ({
    ...parsedEvent,
    scheduledEvent: null,
  }))

  if (!flexibleEvents.length) return scheduleEventResults

  const startTime = Math.ceil(Math.ceil(Date.now() / 1000) / 300)

  const parsedFlexibleEvents = parseGoogleEvents(flexibleEvents).filter(
    event => event.extendedProperties?.private.isFlexible && (event.extendedProperties?.private.maxDueDate || 0) > Date.now()
  )

  const schedulerInputEvents: SchedulerInputEvent[] = parsedFlexibleEvents.map(parsedEvent => {
    const { event, extendedProperties } = parsedEvent
    return {
      id: event.id as string,
      impact: extendedProperties?.private.impact || 0,
      duration: extendedProperties?.private.duration || 1,
      dueDate: Math.ceil((extendedProperties?.private.dueDate || 0) / 300 / 1000),
      maxDueDate: Math.ceil((extendedProperties?.private.maxDueDate || 0) / 300 / 1000),
      tags: extendedProperties?.private.tags || [],
    }
  })

  const reservedEventIntervals: SchedulerInputInterval[] = filteredRegularEvents
    .map(parsedEvent => {
      const { event } = parsedEvent
      return {
        id: event.id as string,
        start: Math.ceil(Date.parse(event.start?.dateTime || `${event.start?.date}T00:00:00+02:00`) / 300 / 1000),
        end: Math.ceil(Date.parse(event.end?.dateTime || `${event.end?.date}T00:00:00+02:00`) / 300 / 1000),
        isTransparent: event.transparency === 'transparent',
      }
    })
    .filter(event => event.end > startTime)

  const reservedTagIntervals: SchedulerInputInterval[] = combineIntervals(
    parseGoogleEvents(reservedTags)
      .filter(parsedEvent => !isEventEnded(parsedEvent.event))
      .map(parsedEvent => {
        const { event, extendedProperties } = parsedEvent
        return {
          id: event.id as string,
          start: Math.ceil(Date.parse(event.start?.dateTime || `${event.start?.date}T00:00:00+02:00`) / 300 / 1000),
          end: Math.ceil(Date.parse(event.end?.dateTime || `${event.end?.date}T00:00:00+02:00`) / 300 / 1000),
          tags: extendedProperties?.private.tags || [],
          isTransparent: event.transparency === 'transparent',
        }
      })
  )

  const scheduleResponse = await getTaskSchedulerClient().post('/', {
    events: schedulerInputEvents,
    reservedIntervals: reservedEventIntervals,
    reservedTags: reservedTagIntervals,
    start: startTime,
  })

  const scheduleResult: ScheduleRawResult = scheduleResponse.data

  if (!scheduleResult.found) return scheduleEventResults

  return scheduleEventResults.concat(
    parsedFlexibleEvents.map(parsedFlexibleEvent => {
      const { event, extendedProperties } = parsedFlexibleEvent
      const scheduledEvent: Task = scheduleResult.tasks[event.id as any]
      return {
        event,
        extendedProperties,
        scheduledEvent: scheduledEvent
          ? { ...scheduledEvent, start: scheduledEvent.start * 300 * 1000, end: scheduledEvent.end * 300 * 1000 }
          : null,
      }
    })
  )
}
