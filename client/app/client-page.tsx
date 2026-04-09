"use client"

import { useState } from "react"
import { columns } from "./event-logs/columns"
import { useProcessFile } from "./hooks/useProcessFile"
import UploadSection from "./sections/UploadSection"
import EventLogSection from "./sections/EventLogSection"
import BpmnSection from "./sections/BpmnSection"
import OverviewSection from "./sections/OverviewSection"
import styles from "./ClientPage.module.css"

type Section = "upload" | "overview" | "eventlog" | "bpmn"

export default function ClientPage() {
  const { eventLogData, bpmnXml, processFile } = useProcessFile()
  const [activeSection, setActiveSection] = useState<Section>("upload")
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isUploadOpen, setIsUploadOpen] = useState(false)
  const handleFileSubmit = (file: File) => {
    processFile(file)
    setActiveSection("overview")
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.appBody}>
        {/*Upload modal*/}
        <UploadSection
          onFileSubmit={handleFileSubmit}
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
        />
        {/* Sidebar */}
        <nav className={`${styles.sidebar} ${sidebarCollapsed ? styles.sidebarCollapsed : ""}`}>

          {/* Logo row */}
          <div className={styles.sidebarLogoRow}>
            {!sidebarCollapsed && (
              <>
                <img src="/logo-removebg.png" alt="FCG" className={styles.sidebarLogoImg} />
                <span className={styles.sidebarLogoText}>FCG</span>
              </>
            )}
            <button
              className={styles.collapseBtn}
              onClick={() => setSidebarCollapsed(prev => !prev)}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`${styles.collapseIcon} ${sidebarCollapsed ? styles.collapseIconFlipped : ""}`}>
                <path d="M10 3L6 8l4 5"/>
              </svg>
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className={styles.sidebarSection}>Workspace</div>
          )}

          <button
            className={`${styles.sidebarItem} ${activeSection === "upload" ? styles.sidebarItemActive : ""}`}
            onClick={() => setIsUploadOpen(true)}
            title="Upload event log"
          >
            <svg className={styles.sidebarIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M8 10V4M5 7l3-3 3 3"/><path d="M3 12h10"/>
            </svg>
            {!sidebarCollapsed && <span>Upload event log</span>}
          </button>

          <button
            className={`${styles.sidebarItem} ${activeSection === "overview" ? styles.sidebarItemActive : ""}`}
            onClick={() => setActiveSection("overview")}
            title="Overview"
          >
            <svg className={styles.sidebarIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/>
              <rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/>
            </svg>
            {!sidebarCollapsed && <span>Overview</span>}
          </button>
          
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

          <button
            className={`${styles.sidebarItem} ${activeSection === "bpmn" ? styles.sidebarItemActive : ""}`}
            onClick={() => setActiveSection("bpmn")}
            title="BPMN diagram"
          >
            <svg className={styles.sidebarIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="4" cy="8" r="1.5"/><circle cx="12" cy="4" r="1.5"/><circle cx="12" cy="12" r="1.5"/>
              <path d="M5.4 7.3L10 4.8M5.4 8.7L10 11.2"/>
            </svg>
            {!sidebarCollapsed && <span>BPMN diagram</span>}
          </button>

        </nav>

        {/* Main content */}
        <main className={styles.main}>
          <div className={`${styles.page} ${activeSection === "upload" ? styles.pageActive : ""}`}>
            <OverviewSection
              columns={columns}
              data={eventLogData}
              xml={bpmnXml || ""}
              onSelectEventLog={() => setActiveSection("eventlog")}
              onSelectBpmn={() => setActiveSection("bpmn")}
            />
          </div>
          <div className={`${styles.page} ${activeSection === "overview" ? styles.pageActive : ""}`}>
            <OverviewSection
              columns={columns}
              data={eventLogData}
              xml={bpmnXml || ""}
              onSelectEventLog={() => setActiveSection("eventlog")}
              onSelectBpmn={() => setActiveSection("bpmn")}
            />
          </div>
          <div className={`${styles.page} ${activeSection === "eventlog" ? styles.pageActive : ""}`}>
            <EventLogSection columns={columns} data={eventLogData} />
          </div>
          <div className={`${styles.page} ${activeSection === "bpmn" ? styles.pageActive : ""}`}>
            <BpmnSection xml={bpmnXml || ""} data={eventLogData} columns={columns} />
          </div>
        </main>

      </div>
    </div>
  )
}