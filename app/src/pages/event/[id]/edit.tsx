import type { calendar_v3 } from 'googleapis'
import type { GetServerSidePropsContext } from 'next/types'
import type { Session } from 'next-auth/core/types'
import '@/styles/home.css'
import { useState } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { editEvent } from '@/lib/client/event'
import { getGoogleCalendar } from '@/lib/client/google/calendar'
import { Box, Button, Checkbox, Container, FormControlLabel, Switch, TextField, Typography } from '@mui/material'
import { DateTimePicker, renderTimeViewClock } from '@mui/x-date-pickers'
import dayjs from 'dayjs'

const EventEdit: React.FC<{ event: calendar_v3.Schema$Event; session: Session }> = ({ event, session }) => {
  const [modifiedEvent, setModifiedEvent] = useState(event)

  const setPrivateProperty: (property: string, value: string) => void = (property, value) => {
    const eventCopy = { ...modifiedEvent }
    if (!eventCopy.extendedProperties?.private) eventCopy.extendedProperties = { private: {} }
    ;(eventCopy.extendedProperties.private as any)[property] = value
    setModifiedEvent(eventCopy)
  }

  const save: () => Promise<void> = async () => {
    await editEvent(modifiedEvent)
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
                checked={JSON.parse(modifiedEvent.extendedProperties?.private?.isFlexible || 'false')}
                onChange={e =>
                  setPrivateProperty(
                    'isFlexible',
                    JSON.stringify(!JSON.parse(modifiedEvent.extendedProperties?.private?.isFlexible || 'false'))
                  )
                }
              />
            }
            label="Flexible"
          />
          {JSON.parse(modifiedEvent.extendedProperties?.private?.isFlexible || 'false') ? (
            <>
              <TextField
                type="number"
                label="Duration"
                value={modifiedEvent.extendedProperties?.private?.duration || 0}
                onChange={e => setPrivateProperty('duration', e.target.value)}
              />
            </>
          ) : null}
          <Button variant="contained" disabled={event === modifiedEvent} onClick={() => save()}>
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

  console.log('event', result.data)

  return {
    props: {
      event: result.data,
      session,
    },
  }
}

export default EventEdit
