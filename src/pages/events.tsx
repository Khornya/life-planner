import '@/styles/index.css'

import type { GetServerSidePropsContext } from 'next/types'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './api/auth/[...nextauth]'

import Box from '@mui/material/Box'
import { DataGrid, GridActionsCellItem, GridColDef } from '@mui/x-data-grid'
import { getGoogleCalendar } from '@/lib/server/api/google/calendar'
import { parseGoogleEvents } from '@/lib/server/api/services/scheduler'
import { Event } from '@/lib/server/api/services/scheduler'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import moment from 'moment'
import { useRouter } from 'next/router'
import { deleteEvents } from '@/lib/client/event'
import { useState } from 'react'
import { Button, Modal, Typography } from '@mui/material'
import { modalStyle } from '@/components/modal/modal'

const EventsPage: React.FC<{ rows: Event[] }> = ({ rows }) => {
  const router = useRouter()
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<Event | undefined>(undefined)

  const handleEditClick = (id: string) => {
    router.push(`/event/${id}/edit`)
  }

  const handleDeleteClick = async (id: string) => {
    setEventToDelete(rows.find(row => row.event.id === id))
    setIsDeleteModalOpen(true)
  }

  const handleCloseDeleteModal = () => setIsDeleteModalOpen(false)

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
      valueGetter: params => params.row.impact / params.row.duration || undefined,
      valueFormatter: params => {
        if (!params.id) return params.value
        const row = params.api.getRow(params.id)
        return row.isFlexible ? params.value : 'N/A'
      },
    },
    {
      field: 'dueDate',
      headerName: 'Due date',
      type: 'dateTime',
      width: 110,
      valueGetter: params => (params.row.dueDate ? new Date(params.row.dueDate) : undefined),
      valueFormatter: params => {
        if (!params.id) return params.value
        const row = params.api.getRow(params.id)
        return row.isFlexible ? moment().to(row.dueDate) : 'N/A'
      },
    },
    {
      field: 'maxDueDate',
      headerName: 'Max due date',
      type: 'dateTime',
      width: 110,
      valueGetter: params => (params.row.maxDueDate ? new Date(params.row.maxDueDate) : undefined),
      valueFormatter: params => {
        if (!params.id) return params.value
        const row = params.api.getRow(params.id)
        return row.isFlexible ? moment().to(row.maxDueDate) : 'N/A'
      },
    },
    {
      field: 'tags',
      headerName: 'Tags',
      width: 150,
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
    <>
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
            tags: row.extendedProperties?.private.tags,
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
      <Modal
        open={isDeleteModalOpen}
        onClose={handleCloseDeleteModal}
        aria-labelledby="modal-modal-title"
        aria-describedby="modal-modal-description"
      >
        <Box sx={modalStyle}>
          <Typography id="modal-modal-title" variant="h6" component="h2">
            Delete event
          </Typography>
          <Typography id="modal-modal-description" sx={{ mt: 2 }}>
            Are you sure you want to delete event '{eventToDelete?.event.summary}' ?
          </Typography>
          <Button
            onClick={async () => {
              if (eventToDelete?.event.id) await deleteEvents([eventToDelete.event.id])
              router.reload()
            }}
          >
            Delete
          </Button>
          <Button onClick={handleCloseDeleteModal}>Cancel</Button>
        </Box>
      </Modal>
    </>
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
      rows: parseGoogleEvents(flexibleEvents.data.items || []),
    },
  }
}

export default EventsPage
