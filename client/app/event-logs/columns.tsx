"use client"

import { ColumnDef } from "@tanstack/react-table"
import { EventLogRow } from "../hooks/useProcessFile"

export function generateColumns(data: EventLogRow[]): ColumnDef<EventLogRow, any>[] {
  if (!data || data.length === 0) return []

  // Get the keys from the first object
  const keys = Object.keys(data[0])

  // Map them into TanStack ColumnDef format
  return keys.map((key) => ({
    accessorKey: key,
    header: key,
    // Add cell formatting if needed in the future
  }))
}