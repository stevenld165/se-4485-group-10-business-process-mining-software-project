import pandas as pd
from abc import abstractmethod, ABCMeta
from Writers import WriterFactory, FileWriter
from pathlib import Path

from Readers import ReaderFactory


class EventLog(metaclass=ABCMeta):

  @abstractmethod
  def read_event_log(self) -> bytes:
    pass

  @abstractmethod
  def write_event_log(self, file_location: Path, file_contents: pd.DataFrame, object_id: str, file_format: str) -> None:
    pass

class OCEventLog(EventLog):
  allowed_structures_ocel = ['event_id', 'object_id', 'object_type', 'activity', 'timestamp', 'actor']

  def __init__(self, contents: pd.DataFrame = None, location: Path = None, file_format: str = None):
    self.file_contents = contents
    self.file_location = location
    self.file_format = file_format
    self.file_writer = WriterFactory.create_writer('ELog')
    self.file_reader = ReaderFactory.create_reader(f'{file_format}')
    pass

  def read_event_log(self) -> bytes:
    return self.file_reader.read_file(self.file_location)


  def write_event_log(self, file_location: Path, file_contents: pd.DataFrame, object_id: str, file_format: str) -> None:
    self.file_writer.write_to_file(file_location, file_contents, object_id, file_format)
    self.file_location = file_location
    pass

class CCEventLog(EventLog):
  allowed_structures_ccel = ['case_id', 'activity', 'timestamp', 'actor']

  def __init__(self, contents: pd.DataFrame = None, location: Path = None, file_format: str = None):
    self.file_contents = contents
    self.file_location = location
    self.file_format = file_format
    self.file_writer = WriterFactory.create_writer('ELog')
    self.file_reader = ReaderFactory.create_reader(f'{file_format}')
    pass

  def read_event_log(self) -> bytes:
    return self.file_reader.read_file(self.file_location)

  def write_event_log(self, file_location: Path, file_contents: pd.DataFrame, object_id: str, file_format: str) -> None:
    self.file_writer.write_to_file(file_location, file_contents, object_id, file_format)
    self.file_location = file_location
    return

class EventLogFactory:
  @staticmethod
  def create_elog(elog_type: str, file_type: str, file_contents: pd.DataFrame) -> EventLog:
    if elog_type == 'OCEL':
      return OCEventLog(contents = file_contents, file_format = file_type)
    if elog_type == 'CCEL':
      return CCEventLog(contents = file_contents, file_format = file_type)