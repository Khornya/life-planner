import '@/styles/index.css'

import type { GetServerSidePropsContext } from 'next/types'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './api/auth/[...nextauth]'

import * as React from 'react'
import { alpha } from '@mui/material/styles'
import Box from '@mui/material/Box'
import Table from '@mui/material/Table'
import TableBody from '@mui/material/TableBody'
import TableCell from '@mui/material/TableCell'
import TableContainer from '@mui/material/TableContainer'
import TableHead from '@mui/material/TableHead'
import TablePagination from '@mui/material/TablePagination'
import TableRow from '@mui/material/TableRow'
import TableSortLabel from '@mui/material/TableSortLabel'
import Toolbar from '@mui/material/Toolbar'
import Typography from '@mui/material/Typography'
import Paper from '@mui/material/Paper'
import Checkbox from '@mui/material/Checkbox'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DeleteIcon from '@mui/icons-material/Delete'
import FilterListIcon from '@mui/icons-material/FilterList'
import EditIcon from '@mui/icons-material/Edit'
import { visuallyHidden } from '@mui/utils'
import { Event, parseGoogleEvent } from '@/lib/server/api/services/scheduler'
import { getGoogleCalendar } from '@/lib/server/api/google/calendar'
import { useRouter } from 'next/router'
import moment from 'moment'
import { MouseEventHandler, useCallback, useEffect, useState } from 'react'
import { deleteEvents } from '@/lib/client/event'
import { ClickAwayListener, Menu, MenuItem } from '@mui/material'
import { redirect } from 'next/navigation'

function descendingComparator(a: Event, b: Event, orderBy: string) {
  switch (orderBy) {
    case 'summary':
      if (!b.event.summary || (a.event.summary && b.event.summary < a.event.summary)) {
        return -1
      }
      if (!a.event.summary || (b.event.summary && b.event.summary > a.event.summary)) {
        return 1
      }
      return 0
    case 'duration':
      if (
        !b.extendedProperties.private.duration ||
        (a.extendedProperties.private.duration && b.extendedProperties.private.duration < a.extendedProperties.private.duration)
      ) {
        return -1
      }
      if (
        !a.extendedProperties.private.duration ||
        (b.extendedProperties.private.duration && b.extendedProperties.private.duration > a.extendedProperties.private.duration)
      ) {
        return 1
      }
      return 0
    case 'impact':
      if (
        !b.extendedProperties.private.impact ||
        (a.extendedProperties.private.impact && b.extendedProperties.private.impact < a.extendedProperties.private.impact)
      ) {
        return -1
      }
      if (
        !a.extendedProperties.private.impact ||
        (b.extendedProperties.private.impact && b.extendedProperties.private.impact > a.extendedProperties.private.impact)
      ) {
        return 1
      }
      return 0
    case 'dueDate':
      if (
        !b.extendedProperties.private.dueDate ||
        (a.extendedProperties.private.dueDate && b.extendedProperties.private.dueDate < a.extendedProperties.private.dueDate)
      ) {
        return -1
      }
      if (
        !a.extendedProperties.private.dueDate ||
        (b.extendedProperties.private.dueDate && b.extendedProperties.private.dueDate > a.extendedProperties.private.dueDate)
      ) {
        return 1
      }
      return 0
    case 'maxDueDate':
      if (
        !b.extendedProperties.private.maxDueDate ||
        (a.extendedProperties.private.maxDueDate && b.extendedProperties.private.maxDueDate < a.extendedProperties.private.maxDueDate)
      ) {
        return -1
      }
      if (
        !a.extendedProperties.private.maxDueDate ||
        (b.extendedProperties.private.maxDueDate && b.extendedProperties.private.maxDueDate > a.extendedProperties.private.maxDueDate)
      ) {
        return 1
      }
      return 0
    default:
      return 0
  }
}

type Order = 'asc' | 'desc'

function getComparator<Key>(order: Order, orderBy: string): (a: Event, b: Event) => number {
  return order === 'desc' ? (a, b) => descendingComparator(a, b, orderBy) : (a, b) => -descendingComparator(a, b, orderBy)
}

interface HeadCell {
  disablePadding: boolean
  id: string
  label: string
  numeric: boolean
}

const headCells: readonly HeadCell[] = [
  {
    id: 'summary',
    numeric: false,
    disablePadding: true,
    label: 'Title',
  },
  {
    id: 'duration',
    numeric: true,
    disablePadding: false,
    label: 'Duration',
  },
  {
    id: 'impact',
    numeric: true,
    disablePadding: false,
    label: 'Impact',
  },
  {
    id: 'dueDate',
    numeric: false,
    disablePadding: false,
    label: 'Due date',
  },
  {
    id: 'maxDueDate',
    numeric: false,
    disablePadding: false,
    label: 'Max due date',
  },
  {
    id: 'edit',
    numeric: false,
    disablePadding: true,
    label: '',
  },
]

interface EnhancedTableProps {
  numSelected: number
  onRequestSort: (event: React.MouseEvent<unknown>, property: string) => void
  onSelectAllClick: (event: React.ChangeEvent<HTMLInputElement>) => void
  order: Order
  orderBy: string
  rowCount: number
}

function EnhancedTableHead(props: EnhancedTableProps) {
  const { onSelectAllClick, order, orderBy, numSelected, rowCount, onRequestSort } = props
  const createSortHandler = (property: string) => (event: React.MouseEvent<unknown>) => {
    onRequestSort(event, property)
  }

  return (
    <TableHead>
      <TableRow>
        <TableCell padding="checkbox">
          <Checkbox
            color="primary"
            indeterminate={numSelected > 0 && numSelected < rowCount}
            checked={rowCount > 0 && numSelected === rowCount}
            onChange={onSelectAllClick}
            inputProps={{
              'aria-label': 'select all desserts',
            }}
          />
        </TableCell>
        {headCells.map(headCell => (
          <TableCell
            key={headCell.id}
            align={headCell.numeric ? 'right' : 'left'}
            padding={headCell.disablePadding ? 'none' : 'normal'}
            sortDirection={orderBy === headCell.id ? order : false}
          >
            <TableSortLabel
              active={orderBy === headCell.id}
              direction={orderBy === headCell.id ? order : 'asc'}
              onClick={createSortHandler(headCell.id)}
            >
              {headCell.label}
              {orderBy === headCell.id ? (
                <Box component="span" sx={visuallyHidden}>
                  {order === 'desc' ? 'sorted descending' : 'sorted ascending'}
                </Box>
              ) : null}
            </TableSortLabel>
          </TableCell>
        ))}
        <TableCell padding="checkbox"></TableCell>
      </TableRow>
    </TableHead>
  )
}

interface EnhancedTableToolbarProps {
  selected: (string | null | undefined)[]
  onFilterRows: (filterType: 'all' | 'planned' | 'unplanned') => void
}

function EnhancedTableToolbar(props: EnhancedTableToolbarProps) {
  const { selected, onFilterRows } = props
  const router = useRouter()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose: MouseEventHandler = (event, reason?: string) => {
    setAnchorEl(null)
  }

  const handleDelete = useCallback(async () => {
    await deleteEvents(selected.filter(item => !!item) as string[])
    router.reload()
  }, [selected])

  return (
    <Toolbar
      sx={{
        pl: { sm: 2 },
        pr: { xs: 1, sm: 1 },
        ...(selected.length > 0 && {
          bgcolor: theme => alpha(theme.palette.primary.main, theme.palette.action.activatedOpacity),
        }),
      }}
    >
      {selected.length > 0 ? (
        <Typography sx={{ flex: '1 1 100%' }} color="inherit" variant="subtitle1" component="div">
          {selected.length} selected
        </Typography>
      ) : (
        <Typography sx={{ flex: '1 1 100%' }} variant="h6" id="tableTitle" component="div">
          Flexible events
        </Typography>
      )}
      {selected.length > 0 ? (
        <Tooltip title="Delete">
          <IconButton onClick={handleDelete}>
            <DeleteIcon />
          </IconButton>
        </Tooltip>
      ) : (
        <Tooltip title="Filter list">
          <>
            <IconButton onClick={handleClick}>
              <FilterListIcon />
            </IconButton>

            <Menu open={!!anchorEl} anchorEl={anchorEl} onClose={handleClose}>
              <MenuItem
                onClick={e => {
                  onFilterRows('all')
                  handleClose(e)
                }}
              >
                Show all events
              </MenuItem>
              <MenuItem
                onClick={e => {
                  onFilterRows('planned')
                  handleClose(e)
                }}
              >
                Show only planned events
              </MenuItem>
              <MenuItem
                onClick={e => {
                  onFilterRows('unplanned')
                  handleClose(e)
                }}
              >
                Show only unplanned events
              </MenuItem>
            </Menu>
          </>
        </Tooltip>
      )}
    </Toolbar>
  )
}

export const EnhancedTable: React.FC<{ rows: Event[] }> = ({ rows }) => {
  const router = useRouter()

  const [order, setOrder] = React.useState<Order>('asc')
  const [orderBy, setOrderBy] = React.useState<string>('dueDate')
  const [selected, setSelected] = React.useState<(string | null | undefined)[]>([])
  const [page, setPage] = React.useState(0)
  const [rowsPerPage, setRowsPerPage] = React.useState(5)
  const [filteredRows, setFilteredRows] = useState(rows)
  const [filterType, setFilterType] = useState<'all' | 'planned' | 'unplanned'>('all')

  const handleRequestSort = (event: React.MouseEvent<unknown>, property: string) => {
    const isAsc = orderBy === property && order === 'asc'
    setOrder(isAsc ? 'desc' : 'asc')
    setOrderBy(property)
  }

  const handleSelectAllClick = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      const newSelected = rows.map(n => n.event.id)
      setSelected(newSelected)
      return
    }
    setSelected([])
  }

  const handleClick = (event: React.MouseEvent<unknown>, id: string | null | undefined) => {
    const selectedIndex = selected.indexOf(id)
    let newSelected: (string | null | undefined)[] = []

    if (selectedIndex === -1) {
      newSelected = newSelected.concat(selected, id)
    } else if (selectedIndex === 0) {
      newSelected = newSelected.concat(selected.slice(1))
    } else if (selectedIndex === selected.length - 1) {
      newSelected = newSelected.concat(selected.slice(0, -1))
    } else if (selectedIndex > 0) {
      newSelected = newSelected.concat(selected.slice(0, selectedIndex), selected.slice(selectedIndex + 1))
    }

    setSelected(newSelected)
  }

  const handleChangePage = (event: unknown, newPage: number) => {
    setPage(newPage)
  }

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10))
    setPage(0)
  }

  const isSelected = (id: string | null | undefined) => selected.indexOf(id) !== -1

  // Avoid a layout jump when reaching the last page with empty rows.
  const emptyRows = page > 0 ? Math.max(0, (1 + page) * rowsPerPage - rows.length) : 0

  const visibleRows = React.useMemo(
    () => rows.sort(getComparator(order, orderBy)).slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [order, orderBy, page, rowsPerPage]
  )

  const onFilterRows = useCallback(
    (filterType: 'all' | 'planned' | 'unplanned') => {
      switch (filterType) {
        case 'all':
          setFilteredRows(visibleRows)
          break
        case 'planned':
          setFilteredRows(visibleRows.filter(row => row.extendedProperties.private.isFlexible))
          break
        case 'unplanned':
          setFilteredRows(visibleRows.filter(row => !row.extendedProperties.private.isFlexible))
          break
        default:
      }
    },
    [visibleRows]
  )

  useEffect(() => {
    onFilterRows(filterType) //TODO keep filter on page change
  }, [visibleRows, filterType])

  return (
    <Box sx={{ width: '100%' }}>
      <Paper sx={{ width: '100%', mb: 2 }}>
        <EnhancedTableToolbar selected={selected} onFilterRows={onFilterRows} />
        <TableContainer>
          <Table sx={{ minWidth: 750 }} aria-labelledby="tableTitle" size={'medium'}>
            <EnhancedTableHead
              numSelected={selected.length}
              order={order}
              orderBy={orderBy}
              onSelectAllClick={handleSelectAllClick}
              onRequestSort={handleRequestSort}
              rowCount={rows.length}
            />
            <TableBody>
              {filteredRows.map((row, index) => {
                const isItemSelected = isSelected(row.event.id)
                const labelId = `enhanced-table-checkbox-${index}`

                return (
                  <TableRow
                    hover
                    onClick={event => handleClick(event, row.event.id)}
                    role="checkbox"
                    aria-checked={isItemSelected}
                    tabIndex={-1}
                    key={row.event.id}
                    selected={isItemSelected}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        color="primary"
                        checked={isItemSelected}
                        inputProps={{
                          'aria-labelledby': labelId,
                        }}
                      />
                    </TableCell>
                    <TableCell component="th" id={labelId} scope="row" padding="none">
                      {row.event.summary}
                    </TableCell>
                    <TableCell align="right">{row.extendedProperties.private.duration || 'N/A'}</TableCell>
                    <TableCell align="right">{row.extendedProperties.private.impact || 'N/A'}</TableCell>
                    <TableCell align="right">
                      {row.extendedProperties.private.isFlexible ? moment().to(row.extendedProperties.private.dueDate) : 'N/A'}
                    </TableCell>
                    <TableCell align="right">
                      {row.extendedProperties.private.isFlexible ? moment().to(row.extendedProperties.private.maxDueDate) : 'N/A'}
                    </TableCell>
                    <TableCell padding="checkbox">
                      <Tooltip title={'Edit'}>
                        <IconButton onClick={() => router.push(`/event/${row.event.id}/edit`)}>
                          <EditIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                )
              })}
              {emptyRows > 0 && (
                <TableRow
                  style={{
                    height: 53 * emptyRows,
                  }}
                >
                  <TableCell colSpan={6} />
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={rows.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  )
}

const EventsPage: React.FC<{ rows: Event[] }> = ({ rows }) => {
  return EnhancedTable({ rows })
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
