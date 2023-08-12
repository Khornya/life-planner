import { calendar_v3 } from 'googleapis'
import { getTaskSchedulerClient } from '../taskSchedulerClient'
import { ExtendedProperties, parseExtendedProperties } from '../google/calendar'

interface Task {
  delay: number
  duration: number
  id: string
  isLate: boolean
  isPresent: boolean
  priority: number
  start: number
}

interface ScheduleRawResult {
  found: boolean
  tasks: Task[]
}

interface ScheduleEventResult {
  event: calendar_v3.Schema$Event
  extendedProperties: ExtendedProperties
  scheduledEvent: Task
}

export const schedule: (events: calendar_v3.Schema$Event[]) => Promise<ScheduleEventResult[]> = async events => {
  const client = getTaskSchedulerClient()

  const scheduleResponse = await client.post('/', {
    events: events //TODO clean code
      .map(event => {
        const extendedProperties = parseExtendedProperties(event)
        if (!extendedProperties.private.isFlexible) return undefined
        return {
          id: event.id,
          impact: extendedProperties.private.impact || 0,
          duration: extendedProperties.private.duration || 1,
          dueDate: Math.ceil((extendedProperties.private.dueDate || 0) / 300),
          maxDueDate: Math.ceil((extendedProperties.private.maxDueDate || 0) / 300),
          tags: extendedProperties.private.tags || [],
        }
      })
      .filter(event => !!event),
    reservedIntervals: events
      .map(event => {
        const extendedProperties = parseExtendedProperties(event)
        if (extendedProperties.private.isFlexible) return undefined
        return {
          id: event.id,
          start: Math.ceil(Date.parse(event.start?.dateTime || `${event.start?.date}T00:00:00+02:00`) / 300),
          end: Math.ceil(Date.parse(event.end?.dateTime || `${event.end?.date}T00:00:00+02:00`) / 300),
        }
      })
      .filter(event => !!event),
    reservedTags: [], //TODO pass reserved tags
    timestamp: Date.now(),
  })

  const scheduleResult: ScheduleRawResult = scheduleResponse.data

  if (!scheduleResult.found) throw new Error('No solution found')

  return events.map(event => {
    const scheduledEvent: Task = scheduleResult.tasks[event.id]
    const extendedProperties = parseExtendedProperties(event)
    return {
      event,
      extendedProperties,
      scheduledEvent: scheduledEvent ? { ...scheduledEvent, start: scheduledEvent.start * 300 } : null,
    }
  })
}
