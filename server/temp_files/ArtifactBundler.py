from abc import ABC, abstractmethod
import uuid
from datetime import datetime
from pathlib import Path
import pandas as pd

from Writers import WriterFactory
from Storage import FileStorage
from Readers import ReaderFactory
from FormatConversion import ConverterFactory


class Bundler(ABC):
  @abstractmethod
  def bundle_artifacts(self, *object_ids: str, label: str = "") -> str:
    pass

class ArtifactBundler(Bundler):
  def __init__(self):
    self.json_reader = ReaderFactory.create_reader('json')
    self.json_converter = ConverterFactory.create_json_converter('txt')
    self.json_writer = WriterFactory.create_writer('json')
    self.S = FileStorage()
    self.S.init_store()

  def bundle_artifacts(self, *object_ids: str, label: str = "") -> str:
    metadata = self.json_converter.convert_to(
      self.json_reader.read_file(self.S.METADATA_FILE)
    )
    bundle_id = str(uuid.uuid4())
    for oid in object_ids:
      metadata[oid]["bundle_id"] = bundle_id
    self.json_writer.write_to_file(
      self.S.METADATA_FILE,
      metadata,
      bundle_id,
      'json'
    )

    members = {
      metadata[oid]["type"]: oid
      for oid in object_ids
    }
    bundles = self.json_converter.convert_to(
      self.json_reader.read_file(self.S.BUNDLE_FILE)
    )
    bundles[bundle_id] = {
      "id": bundle_id,
      "label": label,
      "created_at": datetime.utcnow().isoformat(),
      "members": members,
    }
    self.json_writer.write_to_file(
      self.S.BUNDLE_FILE,
      bundles,
      bundle_id,
      'json'
    )
    return bundle_id