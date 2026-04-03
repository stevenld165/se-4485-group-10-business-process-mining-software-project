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
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>Overview</h2>
        <p className={styles.subtitle}>Click either panel to expand it</p>
      </div>
      <div className={styles.grid}>

        {/* Event log panel */}
        <button className={styles.panel} onClick={onSelectEventLog} aria-label="Expand event log">
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>Event log</span>
            <svg className={styles.expandIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 3h3v3M9 7l4-4M6 13H3v-3M7 9l-4 4"/>
            </svg>
          </div>
          <div className={styles.panelBody}>
            <DataTable columns={columns} data={data} />
          </div>
        </button>

        {/* BPMN panel */}
        <button className={styles.panel} onClick={onSelectBpmn} aria-label="Expand BPMN diagram">
          <div className={styles.panelHeader}>
            <span className={styles.panelTitle}>BPMN diagram</span>
            <svg className={styles.expandIcon} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M10 3h3v3M9 7l4-4M6 13H3v-3M7 9l-4 4"/>
            </svg>
          </div>
          <div className={styles.panelBody}>
            <BpmnViewer xml={xml} />
          </div>
        </button>

      </div>
    </div>
  )
}