from abc import ABC, abstractmethod
from pathlib import Path
import json

from pandas import DataFrame


class FileWriter(ABC):
  @abstractmethod
  def write_to_file(self, f_loc: Path, f_cont, object_id: str, f_fmt: str) -> None:
    pass

class WriteAsParaquet(FileWriter):
  def write_to_file(self, f_loc: Path, f_cont, object_id: str, f_fmt: str) -> None:
    path = f_loc / f"{object_id}.{f_fmt}"
    f_cont.to_paraquet(path, index=False)

class WriteAsJson(FileWriter):
  def write_to_file(self, f_loc: Path, f_cont, object_id: str, f_fmt: str) -> None:
    f_loc.write_text(json.dumps(f_cont, indent=2))

class WriteAsTxt(FileWriter):
  def write_to_file(self, f_loc: Path, f_cont, object_id: str, f_fmt: str) -> None:
    path = f_loc / f"{object_id}.{f_fmt}"
    path.write_text(f_cont, encoding="utf-8")

class WriterFactory:
  @staticmethod
  def create_writer(file_type: str) -> FileWriter:
      if file_type == 'ELog':
        return WriteAsParaquet()
      elif file_type == 'MetaData' or file_type == 'Bundle':
        return WriteAsJson()
      elif file_type == 'Notes':
        return WriteAsTxt()