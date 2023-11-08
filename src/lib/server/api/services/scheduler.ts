import { calendar_v3 } from 'googleapis'
import { getTaskSchedulerClient } from '../taskSchedulerClient'
import { ExtendedProperties, isEventEnded, parseExtendedProperties } from '../google/calendar'
import { groupBy, isEqual } from 'lodash'
import moment from 'moment'
import { isTransparent } from '@/lib/shared/google/calendar'

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

const unixTimeTo5minIntervals = (datetime: number) => Math.ceil(datetime / 300000)

const minIntervalsToUnixTime = (units: number) => units * 300000

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
  let currentIntervalStartIndex = 0
  let currentIntervalStart = sortedTimeUnits[currentIntervalStartIndex]
  let currentIntervalTags = tagsByTimeUnit[sortedTimeUnits[currentIntervalStartIndex]]
  const result: SchedulerInputInterval[] = []
  for (let currentTimeUnitIndex = 1; currentTimeUnitIndex < sortedTimeUnits.length; currentTimeUnitIndex++) {
    const currentTimeUnit = sortedTimeUnits[currentTimeUnitIndex]
    if (
      currentTimeUnit === sortedTimeUnits[currentTimeUnitIndex - 1] + 1 && // time units are consecutive
      isEqual(tagsByTimeUnit[currentTimeUnit], tagsByTimeUnit[currentIntervalStart]) // tags are equal
    )
      continue
    else {
      result.push({
        id: currentIntervalStartIndex.toString(),
        tags: currentIntervalTags,
        start: sortedTimeUnits[currentIntervalStartIndex],
        end: sortedTimeUnits[currentTimeUnitIndex - 1],
        isTransparent,
      })
      currentIntervalStartIndex = currentTimeUnitIndex
      currentIntervalStart = sortedTimeUnits[currentIntervalStartIndex]
      currentIntervalTags = tagsByTimeUnit[currentIntervalStart]
    }
  }
  result.push({
    id: currentIntervalStartIndex.toString(),
    tags: currentIntervalTags,
    start: currentIntervalStart,
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

export const schedule: (
  regularEvents: calendar_v3.Schema$Event[],
  flexibleEvents: calendar_v3.Schema$Event[],
  reservedTags: calendar_v3.Schema$Event[]
) => Promise<ScheduleEventResult[] | null> = async (regularEvents, flexibleEvents, reservedTags) => {
  const parsedRegularEvents = parseGoogleEvents(regularEvents)
  const filteredRegularEvents = parsedRegularEvents.filter(
    parsedEvent => !isEventEnded(parsedEvent.event) && parsedEvent.event.transparency !== 'transparent'
  )
  const regularScheduleEventResults: ScheduleEventResult[] = parsedRegularEvents.map(parsedEvent => ({
    ...parsedEvent,
    scheduledEvent: null,
  }))

  if (!flexibleEvents.length) return regularScheduleEventResults

  const startTime = unixTimeTo5minIntervals(Date.now())

  const parsedFlexibleEvents = parseGoogleEvents(flexibleEvents).filter(
    event => event.extendedProperties?.private.isFlexible && (event.extendedProperties?.private.maxDueDate || 0) > Date.now()
  )

  const schedulerInputEvents: SchedulerInputEvent[] = parsedFlexibleEvents.map(parsedEvent => {
    const { event, extendedProperties } = parsedEvent
    return {
      id: event.id as string,
      impact: extendedProperties?.private.impact || 0,
      duration: extendedProperties?.private.duration || 1,
      dueDate: unixTimeTo5minIntervals(extendedProperties?.private.dueDate || 0),
      maxDueDate: unixTimeTo5minIntervals(extendedProperties?.private.maxDueDate || 0),
      tags: extendedProperties?.private.tags || [],
    }
  })

  const reservedEventIntervals: SchedulerInputInterval[] = filteredRegularEvents
    .map(parsedEvent => {
      const { event } = parsedEvent
      return {
        id: event.id as string,
        start: unixTimeTo5minIntervals(Date.parse(event.start?.dateTime || moment(event.start?.date).toISOString())),
        end: unixTimeTo5minIntervals(Date.parse(event.end?.dateTime || moment(event.end?.date).toISOString())),
        isTransparent: isTransparent(event),
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
          start: unixTimeTo5minIntervals(Date.parse(event.start?.dateTime || moment(event.start?.date).toISOString())),
          end: unixTimeTo5minIntervals(Date.parse(event.end?.dateTime || moment(event.end?.date).toISOString())),
          tags: extendedProperties?.private.tags || [],
          isTransparent: isTransparent(event),
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

  if (!scheduleResult.found) return regularScheduleEventResults

  const scheduledEvents = parsedFlexibleEvents.map(parsedFlexibleEvent => {
    const { event, extendedProperties } = parsedFlexibleEvent
    const scheduledEvent: Task = scheduleResult.tasks[event.id as any]
    return {
      event,
      extendedProperties,
      scheduledEvent: scheduledEvent
        ? { ...scheduledEvent, start: minIntervalsToUnixTime(scheduledEvent.start), end: minIntervalsToUnixTime(scheduledEvent.end) }
        : null,
    }
  })

  return regularScheduleEventResults.concat(scheduledEvents)
}
