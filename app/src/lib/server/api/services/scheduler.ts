import { calendar_v3 } from 'googleapis'
import { getTaskSchedulerClient } from '../taskSchedulerClient'
import { ExtendedProperties, parseExtendedProperties } from '../google/calendar'

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

export const parseGoogleEvent: (events: calendar_v3.Schema$Event[]) => Event[] = events =>
  events.map(event => {
    const extendedProperties = parseExtendedProperties(event)
    return {
      event,
      extendedProperties,
    }
  })

export const schedule: (
  regularEvents: calendar_v3.Schema$Event[],
  flexibleEvents: calendar_v3.Schema$Event[]
) => Promise<ScheduleEventResult[] | null> = async (regularEvents, flexibleEvents) => {
  const parsedRegularEvents = parseGoogleEvent(regularEvents)
  const scheduleEventResults: ScheduleEventResult[] = parsedRegularEvents.map(parsedEvent => ({
    ...parsedEvent,
    scheduledEvent: null,
  }))

  if (!flexibleEvents.length) return scheduleEventResults

  const startTime = Math.ceil(Math.ceil(Date.now() / 1000) / 300)

  const parsedFlexibleEvents = parseGoogleEvent(flexibleEvents)

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

  const reservedIntervals: SchedulerInputInterval[] = parsedRegularEvents
    .map(parsedEvent => {
      const { event } = parsedEvent
      return {
        id: event.id as string,
        start: Math.ceil(Date.parse(event.start?.dateTime || `${event.start?.date}T00:00:00+02:00`) / 300 / 1000),
        end: Math.ceil(Date.parse(event.end?.dateTime || `${event.end?.date}T00:00:00+02:00`) / 300 / 1000),
      }
    })
    .filter(event => event.end > startTime)

  const scheduleResponse = await getTaskSchedulerClient().post('/', {
    events: schedulerInputEvents,
    reservedIntervals,
    reservedTags: [], //TODO pass reserved tags
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
