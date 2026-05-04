from abc import ABC, abstractmethod
from pathlib import Path
import json
import xml.etree.ElementTree as ET
from pathlib import Path

import pm4py
from pm4py import BPMN


class FileWriter(ABC):
  @abstractmethod
  def write_to_file(self, f_loc: Path, f_cont, object_id: str, f_fmt: str, label: str or None) -> Path:
    pass

class WriteAsParquet(FileWriter):
  def write_to_file(self, f_loc: Path, f_cont, object_id: str, f_fmt: str, label: str = None) -> Path:
    name = f"{label}_{object_id}" if label else object_id
    path = f_loc / f"{name}.{f_fmt}"
    f_cont.to_parquet(path, index=False)
    return path

class WriteAsJson(FileWriter):
  def write_to_file(self, f_loc: Path, f_cont, object_id: str, f_fmt: str, label: str = None) -> Path:
    f_loc.write_text(json.dumps(f_cont, indent=2))
    return f_loc

class WriteAsTxt(FileWriter):
  def write_to_file(self, f_loc: Path, f_cont, object_id: str, f_fmt: str, label: str = None) -> Path:
    name = f"{label}_{object_id}" if label else object_id
    path = f_loc / f"{name}.{f_fmt}"
    path.write_text(f_cont, encoding="utf-8")
    return path

class WriteAsBPMN(FileWriter):
  def write_to_file(self, f_loc: Path, f_cont: BPMN, object_id: str, f_fmt: str, label: str = None) -> Path:
    name = f"{label}_{object_id}" if label else object_id
    path = f_loc / f"{name}.{f_fmt}"
    pm4py.write_bpmn(f_cont, str(path))
    return path


class WriterFactory:
  @staticmethod
  def create_writer(file_type: str) -> FileWriter:
      if file_type == 'csv' or file_type == 'parquet':
        return WriteAsParquet()
      elif file_type == 'json':
        return WriteAsJson()
      elif file_type == 'txt':
        return WriteAsTxt()
      elif file_type == 'bpmn':
        return WriteAsBPMN()
      else:
        raise ValueError(f"Unknown file type: {file_type}")