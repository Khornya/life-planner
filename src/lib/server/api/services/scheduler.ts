import { calendar_v3 } from 'googleapis'
import { getTaskSchedulerClient } from '../taskSchedulerClient'
import { ExtendedProperties, parseExtendedProperties } from '../google/calendar'
import { isEqual } from 'lodash'

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
  tags?: string[]
}

export type Task = {
  delay: number
  duration: number
  id: string
  isLate: boolean
  isPresent: boolean
  priority: number
  start: number
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

export const combineIntervals: (intervals: SchedulerInputInterval[]) => SchedulerInputInterval[] = intervals => {
  const tagsByTimeUnit = getTagsByTimeUnit(intervals)
  const sortedTimeUnits = Object.keys(tagsByTimeUnit)
    .map(value => parseInt(value))
    .sort((a, b) => a - b)
  let currentIndex = 0
  const result: SchedulerInputInterval[] = []
  for (let i = 1; i < sortedTimeUnits.length; i++) {
    if (isEqual(tagsByTimeUnit[sortedTimeUnits[i]], tagsByTimeUnit[sortedTimeUnits[currentIndex]])) continue
    else {
      result.push({
        id: currentIndex.toString(),
        tags: tagsByTimeUnit[sortedTimeUnits[currentIndex]],
        start: sortedTimeUnits[currentIndex],
        end: sortedTimeUnits[i - 1],
      })
      currentIndex = i
    }
  }
  result.push({
    id: currentIndex.toString(),
    tags: tagsByTimeUnit[sortedTimeUnits[currentIndex]],
    start: sortedTimeUnits[currentIndex],
    end: sortedTimeUnits[sortedTimeUnits.length - 1],
  })
  return result
}

export const schedule: (
  regularEvents: calendar_v3.Schema$Event[],
  flexibleEvents: calendar_v3.Schema$Event[],
  reservedTags: calendar_v3.Schema$Event[]
) => Promise<ScheduleEventResult[] | null> = async (regularEvents, flexibleEvents, reservedTags) => {
  const parsedRegularEvents = parseGoogleEvents(regularEvents)
  const scheduleEventResults: ScheduleEventResult[] = parsedRegularEvents.map(parsedEvent => ({
    ...parsedEvent,
    scheduledEvent: null,
  }))

  if (!flexibleEvents.length) return scheduleEventResults

  const startTime = Math.ceil(Math.ceil(Date.now() / 1000) / 300)

  const parsedFlexibleEvents = parseGoogleEvents(flexibleEvents)

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

  const reservedEventIntervals: SchedulerInputInterval[] = parsedRegularEvents
    .map(parsedEvent => {
      const { event } = parsedEvent
      return {
        id: event.id as string,
        start: Math.ceil(Date.parse(event.start?.dateTime || `${event.start?.date}T00:00:00+02:00`) / 300 / 1000),
        end: Math.ceil(Date.parse(event.end?.dateTime || `${event.end?.date}T00:00:00+02:00`) / 300 / 1000),
      }
    })
    .filter(event => event.end > startTime)

  const reservedTagIntervals: SchedulerInputInterval[] = combineIntervals(
    parseGoogleEvents(reservedTags).map(parsedEvent => {
      const { event, extendedProperties } = parsedEvent
      return {
        id: event.id as string,
        start: Math.ceil(Date.parse(event.start?.dateTime || `${event.start?.date}T00:00:00+02:00`) / 300 / 1000),
        end: Math.ceil(Date.parse(event.end?.dateTime || `${event.end?.date}T00:00:00+02:00`) / 300 / 1000),
        tags: extendedProperties?.private.tags || [],
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
          ? { ...scheduledEvent, start: scheduledEvent.start * 300 * 1000, duration: scheduledEvent.duration * 300 }
          : null,
      }
    })
  )
}
