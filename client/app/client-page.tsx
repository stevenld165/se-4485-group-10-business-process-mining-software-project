"use client"

import BpmnViewer, { BpmnViewerHandle } from "@/components/BpmnViewer"
import { useRef, useState } from "react"
import { DataTable } from "./event-logs/data-table"
import { columns, Entry } from "./event-logs/columns"
import FileInput from "@/components/FileInput"

//Imports of the hooks
import { useProcessFile } from "./hooks/useProcessFile"
import { UploadRecord, useUploadHistory } from "./hooks/useUploadHistory"

//Imports of all the sections
import UploadHistorySection from "./sections/UploadHistorySection"
import UploadSection from "./sections/UploadSection"
import EventLogSection from "./sections/EventLogSection"
import BpmnSection from "./sections/BpmnSection"
import OverviewSection from "./sections/OverviewSection"
import styles from "./ClientPage.module.css"

type Section = "overview" | "eventlog" | "bpmn" | "history"

export default function ClientPage() {
  const { eventLogData, bpmnXml, processFile, loadFromRecord } = useProcessFile()
  const {history, addRecord, removeRecord, clearHistory } = useUploadHistory()
  const [activeSection, setActiveSection] = useState<Section>("overview")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)

  const viewerRef = useRef<BpmnViewerHandle>(null)

  const handleFileSubmit = async (file: File) => {
    const result = await processFile(file)
    if(result) {
      addRecord({
        fileName: file.name,
        fileSize: file.size,
        rowCount: result.entries.length,
        bpmnXml: result.xml,
        eventLogJson: JSON.stringify(result.entries),
      })
    }
    setIsUploadOpen(false)
    setActiveSection("bpmn")
  }

  const handleLoadRecord = (record: UploadRecord) => {
    loadFromRecord({
      entries: JSON.parse(record.eventLogJson) as Entry[],
      xml: record.bpmnXml,
    })
    setActiveSection("bpmn")
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.appBody}>
        <UploadSection
          onFileSubmit={handleFileSubmit}
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
        />
          {/*Sidebar*/}
        <nav
          className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ""}`}
        >
          <div className={styles.sidebarLogoRow}>
            {!sidebarCollapsed && (
              <>
                <img
                  src="/Logo.png"
                  alt="FCG"
                  className={styles.sidebarLogoImg}
                />
                <span className={styles.sidebarLogoText}></span>
              </>
            )}
            <button
              className={styles.collapseBtn}
              onClick={() => setSidebarCollapsed((prev) => !prev)}
              aria-label={
                sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"
              }
            >
              <svg
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className={`${styles.collapseIcon} ${sidebarCollapsed ? styles.collapseIconFlipped : ""}`}
              >
                <path d="M10 3L6 8l4 5" />
              </svg>
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className={styles.sidebarSection}>Workspace</div>
          )}

          {/*Upload opens modal */}
          <button
            className={styles.sidebarItem}
            onClick={() => setIsUploadOpen(true)}
            title="Upload event log"
          >
            <svg
              className={styles.sidebarIcon}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path d="M8 10V4M5 7l3-3 3 3" />
              <path d="M3 12h10" />
            </svg>
            {!sidebarCollapsed && <span>Upload event log</span>}
          </button>
          {/*Upload History*/}
          <button
            className={`${styles.sidebarItem} ${activeSection === "history" ? styles.sidebarItemActive : ""}`}
            onClick={() => setActiveSection("history")}
            title="Upload history"
          >
            <svg
              className={styles.sidebarIcon}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="8" cy="8" r="5.5" />
              <path d="M8 5v3.5l2 2" />
            </svg>
            {!sidebarCollapsed && (
              <span className={styles.sidebarItemInner}>
                Upload history
                {history.length > 0 && (
                  <span className={styles.badge}>{history.length}</span>
                )}
              </span>
            )}
          </button>

          {/*Overview*/}
          <button
            className={`${styles.sidebarItem} ${activeSection === "overview" ? styles.sidebarItemActive : ""}`}
            onClick={() => setActiveSection("overview")}
            title="Overview"
          >
            <svg
              className={styles.sidebarIcon}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="2" y="2" width="5" height="5" rx="1" />
              <rect x="9" y="2" width="5" height="5" rx="1" />
              <rect x="2" y="9" width="5" height="5" rx="1" />
              <rect x="9" y="9" width="5" height="5" rx="1" />
            </svg>
            {!sidebarCollapsed && <span>Overview</span>}
          </button>

          {/*Event Log*/}
          <button
            className={`${styles.sidebarItem} ${activeSection === "eventlog" ? styles.sidebarItemActive : ""}`}
            onClick={() => setActiveSection("eventlog")}
            title="Event log"
          >
            <svg
              className={styles.sidebarIcon}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <rect x="2" y="2" width="12" height="12" rx="1.5" />
              <path d="M5 6h6M5 9h4" />
            </svg>
            {!sidebarCollapsed && <span>Event log</span>}
          </button>

          {/*Bpmn diagram */}
          <button
            className={`${styles.sidebarItem} ${activeSection === "bpmn" ? styles.sidebarItemActive : ""}`}
            onClick={() => setActiveSection("bpmn")}
            title="BPMN diagram"
          >
            <svg
              className={styles.sidebarIcon}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <circle cx="4" cy="8" r="1.5" />
              <circle cx="12" cy="4" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <path d="M5.4 7.3L10 4.8M5.4 8.7L10 11.2" />
            </svg>
            {!sidebarCollapsed && <span>BPMN diagram</span>}
          </button>
        </nav>
        {/*Main Page */}
        <main className={styles.main}>
          <div
            className={`${styles.page} ${activeSection === "overview" ? styles.pageActive : ""}`}
          >
            <OverviewSection
              columns={columns}
              data={eventLogData}
              xml={bpmnXml || ""}
              onSelectEventLog={() => setActiveSection("eventlog")}
              onSelectBpmn={() => setActiveSection("bpmn")}
              viewerRef={viewerRef}
            />
          </div>
          <div
            className={`${styles.page} ${activeSection === "eventlog" ? styles.pageActive : ""}`}
          >
            <EventLogSection columns={columns} data={eventLogData} />
          </div>
          <div
            className={`${styles.page} ${activeSection === "bpmn" ? styles.pageActive : ""}`}
          >
            <BpmnSection
              xml={bpmnXml || ""}
              data={eventLogData}
              columns={columns}
              viewerRef={viewerRef}
            />
          </div>

          <div className={`${styles.page} ${activeSection === "history" ? styles.pageActive : ""}`}>
            <UploadHistorySection
              history={history}
              onLoad={handleLoadRecord}
              onDelete={removeRecord}
              onClear={clearHistory}
            />
          </div>
        </main>
      </div>
    </div>
  )
}
