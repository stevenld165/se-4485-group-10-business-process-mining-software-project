"use client"

import { useRef, useState, useCallback, RefObject } from "react"
import BpmnViewer, { BpmnViewerHandle } from "@/components/BpmnViewer"
import styles from "./OverviewSection.module.css"
import EventLogPanel from "./EventLogpanel"
import { EventLogRow } from "../hooks/useProcessFile"

interface OverviewSectionProps {
  ccelData: EventLogRow[]
  ocelData: EventLogRow[] | null
  xml: string
  onSelectEventLog: () => void
  viewerRef: RefObject<BpmnViewerHandle | null>
  bpmnMaximized: boolean
  onBpmnMaximizedChange: (value: boolean) => void
  onSaveUpdatedBpmn: (xml: string) => void
  isEdited: boolean
}

export default function OverviewSection({
  ccelData,
  ocelData,
  xml,
  onSelectEventLog,
  viewerRef,
  bpmnMaximized,
  onBpmnMaximizedChange,
  onSaveUpdatedBpmn,
  isEdited,
}: OverviewSectionProps) {
  const [leftPercent, setLeftPercent] = useState(35)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null)
  const [selectedRowIndex, setSelectedRowIndex] = useState<EventLogRow | null>(
    null,
  )

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

  const handleRowClick = (row: EventLogRow) => {
    const activityKey = Object.keys(row).find((key) =>
      key.toLowerCase().includes("activity"),
    )
    const activity = activityKey ? String(row[activityKey]) : null
    if (selectedRowIndex === row) {
      setSelectedActivity(null)
      setSelectedRowIndex(null)
      viewerRef.current?.highlightActivity(null)
    } else {
      setSelectedActivity(activity)
      setSelectedRowIndex(row)
      viewerRef.current?.highlightActivity(activity)
    }
  }

  const handleDiagramClick = (activityName: string) => {
    const next = selectedActivity === activityName ? null : activityName
    setSelectedActivity(next)
    setSelectedRowIndex(null)
    viewerRef.current?.highlightActivity(next)
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>Overview</h2>
        <p className={styles.subtitle}>
          {bpmnMaximized
            ? "BPMN diagram — expanded view"
            : "Drag the divider to resize panels"}
        </p>
      </div>

      <div ref={containerRef} className={styles.panelGroup}>
        {/* Left: event log panel(s) — hidden when BPMN is maximized */}
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
                Two independent sub-panels.
                If only CCEL: it takes full height.
                If both: each takes 50% with a divider between.
                Scrolling happens inside EventLogPanel via the virtualizer.
              */}
              <div className={styles.panelBody}>
                {ocelData && ocelData.length > 0 ? (
                  <>
                    <div className={styles.logSubPanel}>
                      <div className={styles.logSubPanelLabel}>
                        Object-centric log (OCEL)
                      </div>
                      <div className={styles.logSubPanelBody}>
                        <EventLogPanel
                          data={ocelData}
                          onRowClick={handleRowClick}
                          selectedActivity={selectedActivity}
                          selectedRowIndex={selectedRowIndex}
                        />
                      </div>
                    </div>

                    <div className={styles.logSubDivider} />

                    <div className={styles.logSubPanel}>
                      <div className={styles.logSubPanelLabel}>
                        Flattened log (CCEL)
                      </div>
                      <div className={styles.logSubPanelBody}>
                        <EventLogPanel
                          data={ccelData}
                          onRowClick={handleRowClick}
                          selectedActivity={selectedActivity}
                          selectedRowIndex={selectedRowIndex}
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className={styles.logSubPanel}>
                    <div className={styles.logSubPanelLabel}>CCEL</div>
                    <div className={styles.logSubPanelBody}>
                      <EventLogPanel
                        data={ccelData}
                        onRowClick={handleRowClick}
                        selectedActivity={selectedActivity}
                        selectedRowIndex={selectedRowIndex}
                      />
                    </div>
                  </div>
                )}
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
            <BpmnViewer
              xml={xml}
              ref={viewerRef}
              onNodeClick={handleDiagramClick}
              onSaveUpdatedBpmn={onSaveUpdatedBpmn}
              runAutoLayout={!isEdited}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
