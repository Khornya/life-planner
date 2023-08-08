import type { calendar_v3 } from 'googleapis'
import type { GetServerSidePropsContext } from 'next/types'
import type { Session } from 'next-auth/core/types'
import '@/styles/home.css'
import { useState } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { editEvent } from '@/lib/client/event'
import { getGoogleCalendar } from '@/lib/client/google/calendar'
import { Box, Button, Checkbox, Container, FormControlLabel, InputAdornment, Switch, TextField, Typography } from '@mui/material'
import { DateTimePicker, renderTimeViewClock } from '@mui/x-date-pickers'
import dayjs from 'dayjs'

interface ExtendedProperties {
  shared: {}
  private: {
    isFlexible: boolean
    duration?: number
    impact?: number
    dueDate?: Date
    maxDueDate?: Date
  }
}

const EventEdit: React.FC<{ event: calendar_v3.Schema$Event; extendedProperties: ExtendedProperties; session: Session }> = ({
  event,
  extendedProperties,
  session,
}) => {
  const [modifiedEvent, setModifiedEvent] = useState(event)
  const [modifiedExtendedProperties, setModifiedExtendedProperties] = useState(extendedProperties)

  const save: () => Promise<void> = async () => {
    const stringifiedPrivateProperties = Object.fromEntries(
      Object.entries(modifiedExtendedProperties.private || {}).map(([key, value]) => [key, JSON.stringify(value)])
    )
    const stringifiedSharedProperties = Object.fromEntries(
      Object.entries(modifiedExtendedProperties.shared || {}).map(([key, value]) => [key, JSON.stringify(value)])
    )
    await editEvent({
      ...modifiedEvent,
      extendedProperties: { private: stringifiedPrivateProperties, shared: stringifiedSharedProperties },
    })
  }

  return (
    <main>
      <Container>
        <Box component="form">
          <Typography variant="h1">Edit an event</Typography>
          <TextField
            label="Summary"
            value={modifiedEvent.summary}
            onChange={e => setModifiedEvent({ ...modifiedEvent, summary: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Description"
            multiline
            minRows={3}
            maxRows={3}
            value={modifiedEvent.description}
            onChange={e => setModifiedEvent({ ...modifiedEvent, description: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <DateTimePicker
            label="Start"
            viewRenderers={{
              hours: renderTimeViewClock,
              minutes: renderTimeViewClock,
              seconds: renderTimeViewClock,
            }}
            value={dayjs(modifiedEvent.start?.dateTime)}
            onChange={datetime =>
              setModifiedEvent({ ...modifiedEvent, start: { ...modifiedEvent.start, dateTime: datetime?.toISOString() } })
            }
          />
          <DateTimePicker
            label="End"
            viewRenderers={{
              hours: renderTimeViewClock,
              minutes: renderTimeViewClock,
              seconds: renderTimeViewClock,
            }}
            value={dayjs(modifiedEvent.end?.dateTime)}
            onChange={datetime =>
              setModifiedEvent({ ...modifiedEvent, start: { ...modifiedEvent.start, dateTime: datetime?.toISOString() } })
            }
          />
          <FormControlLabel
            control={
              <Switch
                checked={modifiedExtendedProperties.private.isFlexible}
                onChange={e =>
                  setModifiedExtendedProperties({
                    ...modifiedExtendedProperties,
                    private: {
                      ...modifiedExtendedProperties.private,
                      isFlexible: e.target.checked,
                    },
                  })
                }
              />
            }
            label="Flexible"
          />
          {modifiedExtendedProperties.private.isFlexible ? (
            <>
              <TextField
                type="number"
                label="Duration"
                inputProps={{
                  min: 0,
                  step: 5,
                }}
                InputProps={{
                  endAdornment: <InputAdornment position="end">min</InputAdornment>,
                }}
                value={(modifiedExtendedProperties.private.duration || 0) * 5}
                onChange={e =>
                  setModifiedExtendedProperties({
                    ...modifiedExtendedProperties,
                    private: {
                      ...modifiedExtendedProperties.private,
                      duration: parseInt(e.target.value) / 5,
                    },
                  })
                }
              />
              <TextField
                type="number"
                label="Impact"
                inputProps={{
                  min: 0,
                }}
                value={modifiedExtendedProperties.private.impact}
                onChange={e =>
                  setModifiedExtendedProperties({
                    ...modifiedExtendedProperties,
                    private: {
                      ...modifiedExtendedProperties.private,
                      impact: parseInt(e.target.value),
                    },
                  })
                }
              />
              <DateTimePicker
                label="Due date"
                viewRenderers={{
                  hours: renderTimeViewClock,
                  minutes: renderTimeViewClock,
                  seconds: renderTimeViewClock,
                }}
                value={dayjs(modifiedExtendedProperties.private.dueDate || '')}
                onChange={datetime =>
                  setModifiedExtendedProperties({
                    ...modifiedExtendedProperties,
                    private: {
                      ...modifiedExtendedProperties.private,
                      dueDate: datetime?.toDate(),
                    },
                  })
                }
              />
              <DateTimePicker
                label="Max due date"
                viewRenderers={{
                  hours: renderTimeViewClock,
                  minutes: renderTimeViewClock,
                  seconds: renderTimeViewClock,
                }}
                value={dayjs(modifiedExtendedProperties.private.maxDueDate || '')}
                onChange={datetime =>
                  setModifiedExtendedProperties({
                    ...modifiedExtendedProperties,
                    private: {
                      ...modifiedExtendedProperties.private,
                      maxDueDate: datetime?.toDate(),
                    },
                  })
                }
              />
            </>
          ) : null}
          <Button
            variant="contained"
            disabled={event === modifiedEvent && extendedProperties === modifiedExtendedProperties}
            onClick={() => save()}
          >
            Save
          </Button>
        </Box>
      </Container>
    </main>
  )
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { req, res, query } = context
  const { id } = query

  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return {
      redirect: {
        permanent: false,
        destination: '/',
      },
    }
  }

  const calendar = getGoogleCalendar(session)
  const result = await calendar.events.get({ calendarId: 'primary', eventId: id as string })
  const event = result.data
  const privateExtendedProperties = Object.fromEntries(
    Object.entries(event.extendedProperties?.private || {}).map(([key, value]) => [key, JSON.parse(value)])
  )
  const sharedExtendedProperties = Object.fromEntries(
    Object.entries(event.extendedProperties?.shared || {}).map(([key, value]) => [key, JSON.parse(value)])
  )

  return {
    props: {
      event,
      extendedProperties: {
        private: privateExtendedProperties,
        shared: sharedExtendedProperties,
      },
      session,
    },
  }
}

export default EventEdit
