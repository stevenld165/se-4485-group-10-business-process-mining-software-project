"use client"

import { useRef, useState, useCallback, RefObject } from "react"
import BpmnViewer, { BpmnViewerHandle } from "@/components/BpmnViewer"
import { DataTable } from "../event-logs/data-table"
import { ColumnDef } from "@tanstack/react-table"
import styles from "./OverviewSection.module.css"
import { Entry } from "../event-logs/columns"
import EventLogPanel from "./EventLogpanel"
import { EventLogRow } from "../hooks/useProcessFile"

interface OverviewSectionProps<TData , TValue> {
  ccelData: EventLogRow[]
  ocelData: EventLogRow[] | null
  xml: string
  onSelectEventLog: () => void
  viewerRef: RefObject<BpmnViewerHandle | null>
  bpmnMaximized: boolean
  onBpmnMaximizedChange: (value: boolean) => void
}

export default function OverviewSection<TData extends Entry, TValue>({
  ccelData,
  ocelData,
  xml,
  onSelectEventLog,
  viewerRef,
  bpmnMaximized,
  onBpmnMaximizedChange,
}: OverviewSectionProps<TData, TValue>) {
  const [leftPercent, setLeftPercent] = useState(35)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    e.currentTarget.setPointerCapture(e.pointerId)
    dragging.current = true
    document.body.style.cursor = "col-resize"
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current || !containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const newLeft = ((e.clientX - rect.left) / rect.width) * 100
    setLeftPercent(Math.min(Math.max(newLeft, 20), 80))
  }, [])

  const onPointerUp = useCallback(() => {
    dragging.current = false
    document.body.style.cursor = ""
  }, [])

   const [selectedActivity, setSelectedActivity] = useState<string | null>(null)
 
  const handleRowClick = (row: EventLogRow) => {
    const activity = row["activity"] as string ?? null
    const next = selectedActivity === activity ? null : activity
    setSelectedActivity(next)
    viewerRef.current?.highlightActivity(next)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>Overview</h2>
        <p className={styles.subtitle}>
          {bpmnMaximized ? "BPMN diagram — expanded view" : "Drag the divider to resize panels"}
        </p>
      </div>

      <div ref={containerRef} className={styles.panelGroup}>

        {/* ----Left: event log panel(s) - hidden when BPMN is maximized ----- */}
        {!bpmnMaximized && (
          <>
            <div
              className={styles.panel}
              style={{ width: `${leftPercent}%`, flexShrink: 0 }}
            >
              <div
                className={styles.panelHeader}
                onClick={onSelectEventLog}
                style={{ cursor: "pointer" }}
              >
                <span className={styles.panelTitle}>Event log</span>
                <span className={styles.panelNav}>Expand ⌞ ⌝</span>
              </div>
              {/*
                Stacked tables:
                - OCEL table shown only if ocelData is present
                - CCEL table always shown
              */}
              <div className={styles.panelBody} style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {ocelData && ocelData.length > 0 && (
                  <div className={styles.logSubPanel}>
                    <div className={styles.logSubPanelLabel}>
                      Object-centric log (OCEL)
                    </div>
                    <div className={styles.logSubPanelBody}>
                      <EventLogPanel
                        data={ocelData}
                        onRowClick={handleRowClick}
                        selectedActivity={selectedActivity}
                      />
                    </div>
                  </div>
                )}
 
                <div className={styles.logSubPanel} style={{ flex: 1 }}>
                  <div className={styles.logSubPanelLabel}>
                    {ocelData ? "Flattened log (CCEL)" : "CCEL"}
                  </div>
                  <div className={styles.logSubPanelBody}>
                    <EventLogPanel
                      data={ccelData}
                      onRowClick={handleRowClick}
                      selectedActivity={selectedActivity}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Drag handle */}
            <div
              className={styles.resizeHandle}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          </>
        )}

        {/* Right: BPMN panel — takes full width when maximized */}
        <div className={styles.panel} style={{ flex: 1, minWidth: 0 }}>
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>BPMN diagram</span>
            <span
              className={styles.panelNav}
              onClick={() => onBpmnMaximizedChange(!bpmnMaximized)}
              style={{ cursor: "pointer" }}
            >
              {bpmnMaximized ? "Collapse ⌝ ⌞" : "Expand ⌞ ⌝"}
            </span>
          </div>
          <div className={styles.panelBody}>
            <BpmnViewer xml={xml} ref={viewerRef} />
          </div>
        </div>
      </div>
    </div>
  )
}