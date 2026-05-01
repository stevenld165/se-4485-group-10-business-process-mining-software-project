import pandas as pd
from abc import abstractmethod, ABCMeta
from Writers import WriterFactory, FileWriter
from pathlib import Path
from typing import Union

from Readers import ReaderFactory
from FormatConversion import ConverterFactory


class EventLog(metaclass=ABCMeta):

  @abstractmethod
  def read_event_log(self) -> pd.DataFrame:
    pass

  @abstractmethod
  def write_event_log(self, file_location: Path, file_contents: pd.DataFrame, object_id: str, file_format: str) -> None:
    pass


class OCEventLog(EventLog):
  allowed_structures_ocel = ['event_id', 'object_id', 'object_type', 'activity', 'timestamp', 'actor']

  def __init__(self, contents: pd.DataFrame = None, location: Path = None, file_format: str = None):
    self._file_contents = contents
    self.file_location = location
    self._file_format = file_format
    self.file_writer = WriterFactory.create_writer(f'{file_format}')
    self.file_reader = ReaderFactory.create_reader(f'{file_format}')
    self.to_df = ConverterFactory.create_df_converter(self.file_format)
    pass

  def read_event_log(self) -> pd.DataFrame:
    return self.to_df.convert_from(
      self.file_reader.read_file(self.file_location)
    )

  def write_event_log(self, file_location: Path, file_contents: pd.DataFrame, object_id: str, file_format: str) -> None:
    self.file_writer.write_to_file(file_location, file_contents, object_id, file_format)
    self.file_contents = file_contents
    self.file_location = file_location

  @property
  def file_format(self):
    return self._file_format

  @file_format.setter
  def file_format(self, value):
    self._file_format = value

  @property
  def file_contents(self):
    return self._file_contents

  @file_contents.setter
  def file_contents(self, df: pd.DataFrame):
    self._file_contents = df



class CCEventLog(EventLog):
  allowed_structures_ccel = ['case_id', 'activity', 'timestamp', 'actor']

  def __init__(self, contents: pd.DataFrame = None, location: Path = None, file_format: str = None):
    self._file_contents = contents
    self.file_location = location
    self._file_format = file_format
    self.file_writer = WriterFactory.create_writer(self.file_format)
    self.file_reader = ReaderFactory.create_reader(self.file_format)
    self.to_df = ConverterFactory.create_df_converter(self.file_format)
    pass

  def read_event_log(self) -> pd.DataFrame:
    return self.to_df.convert_from(
      self.file_reader.read_file(self.file_location)
    )

  def write_event_log(self, file_location: Path, file_contents: pd.DataFrame, object_id: str, file_format: str) -> None:
    self.file_writer.write_to_file(file_location, file_contents, object_id, file_format)
    self.file_contents = file_contents
    self.file_location = file_location
    return

  @property
  def file_format(self):
    return self._file_format

  @file_format.setter
  def file_format(self, value):
    self._file_format = value

  @property
  def file_contents(self):
    return self._file_contents

  @file_contents.setter
  def file_contents(self, df: pd.DataFrame):
    self._file_contents = df


class EventLogFactory:
  @staticmethod
  def create_elog(elog_type: str, file_type: str, file_contents: pd.DataFrame) -> Union[CCEventLog, OCEventLog]:
    if elog_type == 'OCEL':
      return OCEventLog(contents = file_contents, file_format = file_type)
    if elog_type == 'CCEL':
      return CCEventLog(contents = file_contents, file_format = file_type)