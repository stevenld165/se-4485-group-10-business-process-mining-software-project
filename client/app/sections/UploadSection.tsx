import FileInput from "@/components/FileInput"
import styles from "./UploadSection.module.css"

interface UploadSectionProps {
  onFileSubmit: (file: File) => void
}

export default function UploadSection({ onFileSubmit }: UploadSectionProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <h2 className={styles.title}>Upload event log</h2>
        <p className={styles.subtitle}>Upload a .csv file to begin process mining</p>
      </div>
      <div className={styles.body}>
        <FileInput onFileSubmit={onFileSubmit} />
      </div>
    </div>
  )
}