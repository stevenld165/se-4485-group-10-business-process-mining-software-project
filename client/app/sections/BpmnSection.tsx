import BpmnViewer from "@/components/BpmnViewer"
import { DataTable } from "../event-logs/data-table"
import { ColumnDef } from "@tanstack/react-table"
import styles from "./BpmnSection.module.css"

interface BpmnSectionProps<TData, TValue> {
  xml: string
  data: TData[]
  columns: ColumnDef<TData, TValue>[]
}

export default function BpmnSection<TData, TValue>({ xml, data, columns }: BpmnSectionProps<TData, TValue>) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>BPMN diagram</h2>
        <p className={styles.subtitle}>Generated process model alongside your event log</p>
      </div>
      <div className={styles.body}>
        <div className={styles.viewer}>
          <BpmnViewer xml={xml} />
        </div>
      </div>
    </div>
  )
}