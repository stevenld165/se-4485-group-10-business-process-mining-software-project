"use client"

import Image from "next/image"
import { useRef, useState } from "react"
import { useProcessFile } from "./hooks/useProcessFile"
import UploadSection from "./sections/UploadSection"
import EventLogSection from "./sections/EventLogSection"
import {BpmnViewerHandle} from "@/components/BpmnViewer"
import { useUploadHistory, UploadRecord } from "./hooks/useUploadhistory"
import UploadHistorySection from "./sections/UploadHistorySection"
import ErrorModal from "@/components/ErrorModal"

import OverviewSection from "./sections/OverviewSection"
import styles from "./ClientPage.module.css"

type Section = "overview" | "eventlog" | "history"

export default function ClientPage() {
  const { result, isLoading, error, processFile, loadFromRecord, clearError } =
    useProcessFile()
  const {history, addRecord, removeRecord, clearHistory, mounted} = useUploadHistory()
  const [activeSection, setActiveSection] = useState<Section>("overview") 
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const [bpmnMaximized, setBpmnMaximized] = useState(false)
  

  const viewerRef = useRef<BpmnViewerHandle | null>(null)
  //-----Handlers --------------------------------------------------------------------------------
  
  //Handles fileSubmit 
  const handleFileSubmit = async (file: File) => {
  console.log("Processing file:", file.name)
  const processed = await processFile(file)
  if (processed) {
    addRecord({
      fileName: file.name,
      fileSize: file.size,
      rowCount: processed.ccelData.length,
      savedResult: processed,
    })
    setActiveSection("overview")
    setBpmnMaximized(true)
  }
  setIsUploadOpen(false)
}

  const handleLoadRecord = (record: UploadRecord) => {
    loadFromRecord(record.savedResult)
    setActiveSection("overview")
    setBpmnMaximized(false)
  }

  //Clicking "BPMN diagram" in the sidebar restores the split view with BPMN
  const handleSelectBpmn  = () => {
    setActiveSection("overview")
    setBpmnMaximized(true)
  } 
  //Clicking "Overview" in the sidebar restores the split view with BPMN
  const handleSelectOverview = () => {
    setActiveSection("overview")
    setBpmnMaximized(false)
  }
  

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.appBody}>

        <UploadSection
          onFileSubmit={handleFileSubmit}
          isOpen={isUploadOpen}
          isLoading={isLoading}
          onClose={() => setIsUploadOpen(false)}
        />

        <ErrorModal error={error?.message ?? null} onClose={clearError} />

        {/*Sidebar */}
        <nav className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ""}`}>
          <div className={styles.sidebarLogoRow}>
            {!sidebarCollapsed && (
              <>
                <Image src="/Logo.webp" alt="FCG" width={120} height={40} className={styles.sidebarLogoImg} />
                <span className={styles.sidebarLogoText}></span>
              </>
            )}
            <button
              className={styles.collapseBtn}
              onClick={() => setSidebarCollapsed(prev => !prev)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
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
            <svg className={styles.sidebarIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 10V4M5 7l3-3 3 3"/><path d="M3 12h10"/>
            </svg>
            {!sidebarCollapsed && <span>Upload event log</span>}
          </button>

          {/*History - active when on overview with split view or event log, but not when BPMN maximized */}
          <button
            className={`${styles.sidebarItem} ${activeSection === "history" ? styles.sidebarItemActive : ""}`}
            onClick={() => setActiveSection("history")} title="Upload history"
          >
            <svg className={styles.sidebarIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.5l2 2" />
            </svg>

            {!sidebarCollapsed && (
              <span className={styles.sidebarItemInner}>
                Upload history
                {mounted && history.length > 0 && <span className={styles.badge}>{history.length}</span>}
              </span>
            )}
          </button>

          {/*Overview - actiuve when on overview with split view */}
          <button
            className={`${styles.sidebarItem} ${activeSection === "overview" && !bpmnMaximized ? styles.sidebarItemActive : ""}`}
            onClick={handleSelectOverview}
            title="Overview"
          >
            <svg className={styles.sidebarIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>
              <rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>
            </svg>
            {!sidebarCollapsed && <span>Overview</span>}
          </button>

          {/*Event log - active when on event log */}
          <button
            className={`${styles.sidebarItem} ${activeSection === "eventlog" ? styles.sidebarItemActive : ""}`}
            onClick={() => setActiveSection("eventlog")}
            title="Event log"
          >
            <svg className={styles.sidebarIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 6h6M5 9h4"/>
            </svg>
            {!sidebarCollapsed && <span>Event log</span>}
          </button>

            {/*BPMN - active when on BPMN or overview with BPMN maximized */}
          <button
            className={`${styles.sidebarItem} ${activeSection === "overview" && bpmnMaximized ? styles.sidebarItemActive : ""}`}
            onClick={handleSelectBpmn}
            title="BPMN diagram"
          >
            <svg className={styles.sidebarIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
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
          <div className={`${styles.page} ${activeSection === "overview" ? styles.pageActive : ""}`}>
            <OverviewSection
              ccelData = {result?.ccelData ?? []}
              ocelData = {result?.ocelData ?? null}
              xml={result?.bpmnXml || ""}
              onSelectEventLog={() => setActiveSection("eventlog")}
              viewerRef={viewerRef}
              bpmnMaximized={bpmnMaximized}
              onBpmnMaximizedChange={setBpmnMaximized}
            />
          </div>
          <div className={`${styles.page} ${activeSection === "eventlog" ? styles.pageActive : ""}`}>
            <EventLogSection
              ccelData={result?.ccelData ?? []}
              ocelData={result?.ocelData ?? null}
            />
          </div>

          {/*Upload History - active when on upload history */}
         {<div className={`${styles.page} ${activeSection === "history" ? styles.pageActive : ""}`}>
            <UploadHistorySection
              history={history}
              onLoad={handleLoadRecord}
              onDelete={removeRecord}
              onClear={clearHistory}
              mounted={mounted}
            />
          </div> }
        </main>

      </div>
    </div>
  )
}