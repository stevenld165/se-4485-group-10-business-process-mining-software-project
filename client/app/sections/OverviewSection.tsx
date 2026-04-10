"use client"

import { useRef, useState, useCallback } from "react"
import BpmnViewer from "@/components/BpmnViewer"
import { DataTable } from "../event-logs/data-table"
import { ColumnDef } from "@tanstack/react-table"
import styles from "./OverviewSection.module.css"

interface OverviewSectionProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[]
  data: TData[]
  xml: string
  onSelectEventLog: () => void
  onSelectBpmn: () => void
}

export default function OverviewSection<TData, TValue>({
  columns,
  data,
  xml,
  onSelectEventLog,
  onSelectBpmn,
}: OverviewSectionProps<TData, TValue>) {
  const [leftPercent, setLeftPercent] = useState(50)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const onMouseDown = useCallback(() => {
    dragging.current = true
    document.body.style.cursor = "col-resize"
    document.body.style.userSelect = "none"
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newLeft = ((e.clientX - rect.left) / rect.width) * 100
    setLeftPercent(Math.min(Math.max(newLeft, 20), 80))
  }, [])

  const onMouseUp = useCallback(() => {
    dragging.current = false
    document.body.style.cursor = ""
    document.body.style.userSelect = ""
  }, [])

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>Overview</h2>
        <p className={styles.subtitle}>Drag the divider to resize panels</p>
      </div>

      <div
        ref={containerRef}
        className={styles.panelGroup}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        {/* Event log panel */}
        <div className={styles.panel} style={{ width: `${leftPercent}%` }}>
          <div className={styles.panelHeader} onClick={onSelectEventLog} style={{ cursor: "pointer" }}>
            <span className={styles.panelTitle}>Event log</span>
            <span className={styles.panelNav}>Open →</span>
          </div>
          <div className={styles.panelBody}>
            <DataTable columns={columns} data={data} />
          </div>
        </div>

        {/* Drag handle */}
        <div className={styles.resizeHandle} onMouseDown={onMouseDown}>
          <div className={styles.resizeBar} />
        </div>

        {/* BPMN panel */}
        <div className={styles.panel} style={{ width: `${100 - leftPercent}%` }}>
          <div className={styles.panelHeader} onClick={onSelectBpmn} style={{ cursor: "pointer" }}>
            <span className={styles.panelTitle}>BPMN diagram</span>
            <span className={styles.panelNav}>Open →</span>
          </div>
          <div className={styles.panelBody}>
            <BpmnViewer xml={xml} />
          </div>
        </div>

      </div>
    </div>
  )
}