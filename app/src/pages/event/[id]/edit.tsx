import type { calendar_v3 } from 'googleapis'
import type { GetServerSidePropsContext } from 'next/types'
import type { Session } from 'next-auth/core/types'
import '@/styles/edit.css'
import { useState } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { editEvent } from '@/lib/client/event'
import { ExtendedProperties, getGoogleCalendar, parseExtendedProperties } from '@/lib/server/api/google/calendar'
import { Box, Button, Container, FormControlLabel, InputAdornment, Switch, TextField, Typography } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { DateTimePicker, renderTimeViewClock } from '@mui/x-date-pickers'
import dayjs from 'dayjs'

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
        <Typography variant="h1">Edit an event</Typography>
        <Box component="form">
          <Grid container spacing={2}>
            <Grid xs={12}>
              <TextField
                label="Summary"
                value={modifiedEvent.summary}
                onChange={e => setModifiedEvent({ ...modifiedEvent, summary: e.target.value })}
                className="input"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid xs={12}>
              <TextField
                label="Description"
                multiline
                minRows={3}
                maxRows={3}
                value={modifiedEvent.description}
                onChange={e => setModifiedEvent({ ...modifiedEvent, description: e.target.value })}
                className="input"
                InputLabelProps={{ shrink: true }}
              />
            </Grid>
            <Grid xs={3}>
              <DateTimePicker
                label="Start date"
                className="input"
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
            </Grid>
            <Grid xs={3}>
              <DateTimePicker
                label="End date"
                className="input"
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
            </Grid>
            <Grid xs={12}>
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
            </Grid>
            {modifiedExtendedProperties.private.isFlexible ? (
              <>
                <Grid xs={3}>
                  <TextField
                    type="number"
                    label="Duration"
                    className="input"
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
                </Grid>
                <Grid xs={3}>
                  <TextField
                    type="number"
                    label="Impact"
                    className="input"
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
                </Grid>
                <Grid xs={6}></Grid>
                <Grid xs={3}>
                  <DateTimePicker
                    label="Due date"
                    className="input"
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
                          dueDate: datetime?.toDate().valueOf(),
                        },
                      })
                    }
                  />
                </Grid>
                <Grid xs={3}>
                  <DateTimePicker
                    label="Max due date"
                    className="input"
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
                          maxDueDate: datetime?.toDate().valueOf(),
                        },
                      })
                    }
                  />
                </Grid>
              </>
            ) : null}
            <Grid xs={12}>
              <Button
                variant="contained"
                disabled={event === modifiedEvent && extendedProperties === modifiedExtendedProperties}
                onClick={() => save()}
              >
                Save
              </Button>
            </Grid>
          </Grid>
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
  const extendedProperties = parseExtendedProperties(event)

  return {
    props: {
      event,
      extendedProperties,
      session: {
        user: session.user,
        expires: session.expires,
      },
    },
  }
}

export default EventEdit
