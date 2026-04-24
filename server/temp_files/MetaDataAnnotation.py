from datetime import datetime
from typing import Optional

class MetaDataAggregator:
    @staticmethod
    def formulate(
        object_type: str,
        file_format: str,
        source_filename: str = "",
        object_id: str = None,
        attached_to: Optional[str] = None,
        extra_fields: dict = {},
    ) -> dict:
        return {
            "id": object_id,
            "type": object_type,
            "format": file_format,
            "source_file": source_filename,
            "created_at": datetime.utcnow().isoformat(),
            "bundle_id": None,
            "attached_to": attached_to,
            **extra_fields,
        }