import '@/styles/index.css'

import type { GetServerSidePropsContext } from 'next/types'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './api/auth/[...nextauth]'

import * as React from 'react'
import Box from '@mui/material/Box'
import { DataGrid, GridActionsCellItem, GridColDef, GridRowId, GridValueGetterParams } from '@mui/x-data-grid'
import { getGoogleCalendar } from '@/lib/server/api/google/calendar'
import { parseGoogleEvent } from '@/lib/server/api/services/scheduler'
import { Event } from '@/lib/server/api/services/scheduler'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import moment from 'moment'
import { useRouter } from 'next/router'
import { deleteEvents } from '@/lib/client/event'

const EventsPage: React.FC<{ rows: Event[] }> = ({ rows }) => {
  const router = useRouter()

  const handleEditClick = (id: string) => {
    router.push(`/event/${id}/edit`)
  }

  const handleDeleteClick = async (id: string) => {
    await deleteEvents([id])
  }

  const columns: GridColDef[] = [
    { field: 'title', headerName: 'Title', width: 300 },
    {
      field: 'duration',
      headerName: 'Duration',
      width: 150,
    },
    {
      field: 'impact',
      headerName: 'Impact',
      width: 150,
    },
    {
      field: 'priority',
      headerName: 'Priority',
      type: 'number',
      width: 110,
      valueGetter: (params: GridValueGetterParams) => params.row.impact / params.row.duration || 'N/A',
    },
    {
      field: 'dueDate',
      headerName: 'Due date',
      type: 'number',
      width: 110,
      valueGetter: (params: GridValueGetterParams) => (params.row.isFlexible ? moment().to(params.row.dueDate) : 'N/A'),
    },
    {
      field: 'maxDueDate',
      headerName: 'Max due date',
      type: 'number',
      width: 110,
      valueGetter: (params: GridValueGetterParams) => (params.row.isFlexible ? moment().to(params.row.maxDueDate) : 'N/A'),
    },
    {
      field: 'actions',
      type: 'actions',
      headerName: 'Actions',
      width: 100,
      cellClassName: 'actions',
      getActions: ({ id }) => {
        return [
          <GridActionsCellItem
            icon={<EditIcon />}
            label="Edit"
            className="textPrimary"
            onClick={() => handleEditClick(id as string)}
            color="inherit"
          />,
          <GridActionsCellItem icon={<DeleteIcon />} label="Delete" onClick={() => handleDeleteClick(id as string)} color="inherit" />,
        ]
      },
    },
  ]

  return (
    <Box sx={{ height: 400, width: '100%' }}>
      <DataGrid
        rows={rows.map(row => ({
          id: row.event.id,
          title: row.event.summary,
          duration: row.extendedProperties?.private.duration,
          impact: row.extendedProperties?.private.impact,
          dueDate: row.extendedProperties?.private.dueDate,
          maxDueDate: row.extendedProperties?.private.maxDueDate,
          isFlexible: row.extendedProperties?.private.isFlexible,
        }))}
        columns={columns}
        initialState={{
          pagination: {
            paginationModel: {
              pageSize: 5,
            },
          },
        }}
        pageSizeOptions={[5]}
        checkboxSelection
        disableRowSelectionOnClick
      />
    </Box>
  )
}

export const getServerSideProps = async (context: GetServerSidePropsContext) => {
  const { req, res } = context
  const session = await getServerSession(req, res, authOptions)

  if (!session) {
    return {
      redirect: {
        permanent: false,
        destination: '/',
      },
    }
  }

  if ((session as any).error) {
    return {
      redirect: {
        permanent: false,
        destination: '/logout',
      },
    }
  }

  const calendar = getGoogleCalendar(session)

  const flexibleEvents = await calendar.events.list({
    calendarId: 'primary',
    timeMin: '1900-01-01T00:00:00Z',
    timeMax: '1900-01-02T00:00:00Z',
  })

  return {
    props: {
      rows: parseGoogleEvent(flexibleEvents.data.items || []),
    },
  }
}

export default EventsPage
