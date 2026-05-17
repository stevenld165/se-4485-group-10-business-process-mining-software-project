// EventLogpanel.tsx
"use client"

import { useMemo } from "react"
import { EventLogRow } from "../hooks/useProcessFile"
import { DataTable } from "../event-logs/data-table"
import { generateColumns } from "../event-logs/columns"
import styles from "./EventLogpanel.module.css"

interface EventLogPanelProps {
  data: EventLogRow[]
  onRowClick?: (row: EventLogRow) => void
  selectedActivity?: string | null
  selectedRowIndex?: EventLogRow | null
}

export default function EventLogPanel({ 
  data, 
  onRowClick, 
  selectedActivity, 
  selectedRowIndex 
}: EventLogPanelProps) {
  
  // Memoize columns so TanStack table doesn't constantly re-render them
  const columns = useMemo(() => generateColumns(data), [data])

  if (!data || data.length === 0) {
    return <div className={styles.empty}>No data available.</div>
  }

  return (
    <div className="h-full w-full flex flex-col min-h-0">
      <DataTable
        columns={columns}
        data={data}
        onRowClick={onRowClick}
        selectedActivity={selectedActivity}
        selectedRowIndex={selectedRowIndex}
      />
    </div>
  )
}