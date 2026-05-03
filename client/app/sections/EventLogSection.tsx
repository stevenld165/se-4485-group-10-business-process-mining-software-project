import { DataTable } from "../event-logs/data-table"
import { ColumnDef } from "@tanstack/react-table"
import styles from "./EventLogSection.module.css"
import { EventLogRow } from "../hooks/useProcessFile"
import EventLogPanel from "./EventLogpanel"

interface EventLogSectionProps {
  ccelData: EventLogRow[]
  ocelData: EventLogRow[] | null
}

export default function EventLogSection({ ccelData, ocelData }: EventLogSectionProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>Event log</h2>
        <p className={styles.subtitle}>
          {ocelData
            ? "Showing both the original object-centric log and the flattened case-centric log"
            : "Showing all events from the uploaded file"}
        </p>
      </div>
 
      <div className={styles.body}>
        {/* OCEL table — shown only when present */}
        {ocelData && ocelData.length > 0 && (
          <div className={styles.tableBlock}>
            <div className={styles.tableBlockLabel}>Object-centric log (OCEL)</div>
            <div className={styles.tableWrapper}>
              <EventLogPanel data={ocelData} />
            </div>
          </div>
        )}
 
        {/* CCEL table — always shown */}
        <div className={styles.tableBlock} style={{ flex: 1 }}>
          <div className={styles.tableBlockLabel}>
            {ocelData ? "Flattened log (CCEL)" : "CCEL"}
          </div>
          <div className={styles.tableWrapper}>
            <EventLogPanel data={ccelData} />
          </div>
        </div>
      </div>
    </div>
  )
}