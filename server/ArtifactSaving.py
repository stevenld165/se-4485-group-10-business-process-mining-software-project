from abc import ABC, abstractmethod
import os
import uuid
from cProfile import label

import pandas as pd
from pathlib import Path
from datetime import datetime

from Writers import WriterFactory
from Storage import FileStorage
from EventLogLogic import EventLog
from DiagramLogic import BPMNGraph
from FormatConversion import ConverterFactory
from Readers import ReaderFactory


class Saver(ABC):
  pass

class InstanceSaver(Saver):

  def __init__(self):
    self._object_factory()
    self.storage_path = FileStorage()
    self.storage_path.init_store()


  def _object_factory(self):
    self.metadata_writer = WriterFactory.create_writer('json')
    self.metadata_reader = ReaderFactory.create_reader('json')
    self.json_transformer = ConverterFactory.create_json_converter('txt')
    self.note_writer = WriterFactory.create_writer('txt')

  def _save_meta_data(self, object_id: str, meta: dict) -> None:
    metadata_dict = self._load_metadata()
    metadata_dict[object_id] = meta
    self.metadata_writer.write_to_file(
      self.storage_path.METADATA_FILE,
      metadata_dict,
      object_id,
      'json'
    )

  def _load_metadata(self) -> dict:
    return self.json_transformer.convert_to(self.metadata_reader.read_file(self.storage_path.METADATA_FILE))

  def save_elog(self, elog: EventLog, contents: pd.DataFrame, meta: dict) -> str:
    object_id = str(uuid.uuid4())
    meta["id"] = object_id
    label = meta.get("source_filename", None)

    path_name = self.storage_path.determine_directory(elog)
    meta["storage_subdir"] = str(path_name.relative_to(self.storage_path.STORE_DIR))

    elog.write_event_log(
      path_name,
      contents,
      object_id,
      meta['format'],
      label = label
    )
    self._save_meta_data(object_id, meta)
    return object_id

  def save_graph(self, diagram: BPMNGraph, contents, meta: dict, role_map: dict) -> str:
    object_id = str(uuid.uuid4())
    meta["id"] = object_id

    path_name = self.storage_path.determine_directory(diagram)
    meta["storage_subdir"] = str(path_name.relative_to(self.storage_path.STORE_DIR))

    diagram.write_graph(
      path_name,
      contents,
      object_id,
      meta['format'],
      role_map = role_map,
      label = label
    )
    self._save_meta_data(object_id, meta)
    return object_id

  # def save_notes(self, contents, meta: dict) -> str:
  #   object_id = str(uuid.uuid4())
  #   self.note_writer.write_to_file(self.STORE_DIR, contents, object_id, meta['format'])
  #   metadata_dict = self.json_transformer.convert_to_json(self.metadata_reader.read_file(self.METADATA_FILE))
  #   metadata_dict[object_id] = meta
  #   self.metadata_writer.write_to_file(self.METADATA_FILE, meta, object_id, 'json')
  #   return object_id