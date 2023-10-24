import type { calendar_v3 } from 'googleapis'
import type { GetServerSidePropsContext } from 'next/types'
import type { Session } from 'next-auth/core/types'
import '@/styles/edit.css'
import { useState } from 'react'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/pages/api/auth/[...nextauth]'
import { editEvent } from '@/lib/client/event'
import { ExtendedProperties, getGoogleCalendar, parseExtendedProperties } from '@/lib/server/api/google/calendar'
import { Autocomplete, Box, Button, Container, FormControlLabel, Switch, TextField, Typography } from '@mui/material'
import Grid from '@mui/material/Unstable_Grid2'
import { DateTimePicker, renderTimeViewClock } from '@mui/x-date-pickers'
import dayjs from 'dayjs'
import { isTransparent } from '@/lib/shared/google/calendar'

export const availableTags = ['Travail', 'Indisponible', 'Ouvré']

const ReservedIntervalEdit: React.FC<{ event: calendar_v3.Schema$Event; extendedProperties: ExtendedProperties; session: Session }> = ({
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
    await editEvent(
      {
        ...modifiedEvent,
        summary: modifiedExtendedProperties.private.tags.join(','),
        extendedProperties: { private: stringifiedPrivateProperties, shared: stringifiedSharedProperties },
      },
      process.env.NEXT_PUBLIC_RESERVED_CALENDAR_ID
    )
  }

  return (
    <main>
      <Container>
        <Typography variant="h1">Edit a reserved interval</Typography>
        <Box component="form">
          <Grid container spacing={2}>
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
                  setModifiedEvent({ ...modifiedEvent, end: { ...modifiedEvent.end, dateTime: datetime?.toISOString() } })
                }
              />
            </Grid>
            <Grid xs={6}></Grid>
            <Grid xs={6}>
              <Autocomplete
                multiple
                id="tags-standard"
                options={availableTags} // TODO dynamic tags
                value={modifiedExtendedProperties.private.tags}
                onChange={(event: any, newValue: string[]) =>
                  setModifiedExtendedProperties({
                    ...modifiedExtendedProperties,
                    private: {
                      ...modifiedExtendedProperties.private,
                      tags: newValue,
                    },
                  })
                }
                renderInput={params => <TextField {...params} variant="standard" label="Tags" />}
              />
            </Grid>
            <Grid xs={12}>
              <FormControlLabel
                control={
                  <Switch
                    checked={isTransparent(modifiedEvent)}
                    onChange={e => setModifiedEvent({ ...modifiedEvent, transparency: e.target.checked ? 'transparent' : undefined })}
                  />
                }
                label="Transparent"
              />
            </Grid>
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
  const result = await calendar.events.get({
    calendarId: process.env.NEXT_PUBLIC_RESERVED_CALENDAR_ID,
    eventId: id as string,
  })
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

export default ReservedIntervalEdit
