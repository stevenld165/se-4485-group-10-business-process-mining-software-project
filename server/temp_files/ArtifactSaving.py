from abc import ABC, abstractmethod
import os
import uuid
import pandas as pd
from pathlib import Path
from datetime import datetime

from Writers import WriterFactory
from Storage import FileStorage
from EventLogLogic import EventLog
from server.temp_files.FormatConversion import ConverterFactory
from Readers import ReaderFactory


class Saver(ABC):
  pass

class InstanceSaver(Saver):
  STORE_DIR = Path(".store/objects")
  METADATA_FILE = Path(".store/metadata.json")
  BUNDLE_FILE = Path(".store/bundles.json")

  def __init__(self):
    self._object_factory()
    self.storage_path = FileStorage()
    self.storage_path.init_store()


  def _object_factory(self):
    self.metadata_writer = WriterFactory.create_writer('MetaData')
    self.metadata_reader = ReaderFactory.create_reader('MetaData')
    self.json_transformer = ConverterFactory.create_json_converter('txt')
    self.note_writer = WriterFactory.create_writer('Notes')

  def _save_meta_data(self, object_id: str, meta: dict) -> None:
    metadata_dict = self.json_transformer.convert_to_json(self.metadata_reader.read_file(self.METADATA_FILE))
    metadata_dict[object_id] = meta
    self.metadata_writer.write_to_file(
      self.storage_path.METADATA_FILE,
      metadata_dict,
      object_id,
      'json'
    )

  def save_elog(self, elog: EventLog, contents, meta: dict) -> str:
    object_id = str(uuid.uuid4())
    meta["id"] = object_id
    elog.write_event_log(
      self.storage_path.STORE_DIR,
      contents,
      object_id,
      meta['format']
    )
    self._save_meta_data(object_id, meta)
    return object_id

  def save_graph(self, contents, meta: dict) -> str:
    pass

  # def save_notes(self, contents, meta: dict) -> str:
  #   object_id = str(uuid.uuid4())
  #   self.note_writer.write_to_file(self.STORE_DIR, contents, object_id, meta['format'])
  #   metadata_dict = self.json_transformer.convert_to_json(self.metadata_reader.read_file(self.METADATA_FILE))
  #   metadata_dict[object_id] = meta
  #   self.metadata_writer.write_to_file(self.METADATA_FILE, meta, object_id, 'json')
  #   return object_id