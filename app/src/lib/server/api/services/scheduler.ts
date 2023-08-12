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

  const scheduleResult: ScheduleRawResult = await client.post('/', {
    events: events.map(event => {
      const extendedProperties = parseExtendedProperties(event)
      return {
        id: event.id,
        impact: extendedProperties.private.impact || 0,
        duration: extendedProperties.private.duration,
        dueDate: (extendedProperties.private.dueDate || 0) / 100,
        maxDueDate: (extendedProperties.private.maxDueDate || 0) / 100,
        tags: extendedProperties.private.tags || [],
      }
    }),
    reservedTags: [], //TODO pass reserved tags
  })

  if (!scheduleResult.found) throw new Error('No solution found')

  return events.map(event => {
    const scheduledEvent = scheduleResult.tasks[event.id]
    const extendedProperties = parseExtendedProperties(event)
    return {
      event,
      extendedProperties,
      scheduledEvent,
    }
  })
}
