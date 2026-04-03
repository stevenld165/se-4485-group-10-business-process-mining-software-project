"use client"

import BpmnViewer, { BpmnViewerHandle } from "@/components/BpmnViewer"
import { useRef, useState } from "react"

import { DataTable } from "./event-logs/data-table"
import { columns, Entry } from "./event-logs/columns"
import FileInput from "@/components/FileInput"
import { useProcessFile } from "./hooks/useProcessFile"
import styles from "./ClientPage.module.css"

export default function ClientPage() {
  const { eventLogData, bpmnXml, processFile } = useProcessFile()
  const [isEventLogOpen, setIsEventLogOpen] = useState(true)

  const viewerRef = useRef<BpmnViewerHandle>(null)
  const [selectedRow, setSelectedRow] = useState<string | null>(null)

  const handleUploadFile = (file: File) => {
    processFile(file)
  }

  const handleRowClick = (entry: Entry) => {
    const newActivity = selectedRow === entry.Activity ? null : entry.Activity

    console.log(newActivity)

    setSelectedRow(newActivity)
    viewerRef.current?.highlightActivity(newActivity)
  }

  return (
    <div className={styles.pageWrapper}>
      {/* Fixed Header */}
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>Process Mining Application</h1>
      </header>

      {/* Main Content: Split Screen */}
      <main className={styles.main}>
        {/* LEFT COLUMN: Event Log — collapses when hidden */}
        <section
          className={`${styles.eventLogSection} ${!isEventLogOpen ? styles.eventLogSectionClosed : ""}`}
        >
          <div className={styles.eventLogHeader}>
            <h2 className={styles.eventLogTitle}>Event Log</h2>
            <button
              onClick={() => setIsEventLogOpen(false)}
              className={styles.toggleButton}
              aria-label='Hide Event Log'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className={styles.toggleIcon}
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <polyline points='15 18 9 12 15 6' />
              </svg>
              Hide
            </button>
          </div>

          <div className={styles.eventLogTableWrapper}>
            <div className={styles.eventLogTableScroll}>
              <DataTable
                columns={columns}
                data={eventLogData}
                handleRowClick={handleRowClick}
              />
            </div>
          </div>
        </section>

        {/* Show Event Log button — visible only when panel is collapsed */}
        {!isEventLogOpen && (
          <div className={styles.showLogStrip}>
            <button
              onClick={() => setIsEventLogOpen(true)}
              className={styles.toggleButton}
              aria-label='Show Event Log'
            >
              <svg
                xmlns='http://www.w3.org/2000/svg'
                className={styles.toggleIcon}
                viewBox='0 0 24 24'
                fill='none'
                stroke='currentColor'
                strokeWidth='2'
                strokeLinecap='round'
                strokeLinejoin='round'
              >
                <polyline points='9 18 15 12 9 6' />
              </svg>
              Show Log
            </button>
          </div>
        )}

        {/* RIGHT COLUMN: Control Panel (Top) & BPMN Diagram (Bottom) */}
        <aside
          className={`${styles.bpmnAside} ${!isEventLogOpen ? styles.bpmnAsideExpanded : ""}`}
        >
          <div className={styles.controlPanel}>
            <FileInput onFileSubmit={handleUploadFile} />
          </div>

          <div className={styles.bpmnArea}>
            <div className={styles.bpmnAreaHeader}>
              <h2 className={styles.bpmnTitle}>BPMN Diagram</h2>
            </div>

            <div className={styles.bpmnViewerWrapper}>
              <div id='#canvas' className={styles.bpmnCanvas}>
                <BpmnViewer xml={bpmnXml} ref={viewerRef} />
              </div>
            </div>
          </div>
        </aside>
      </main>
    </div>
  )
}
