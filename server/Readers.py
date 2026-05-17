from abc import ABC, abstractmethod
from pathlib import Path
import xml.etree.ElementTree as ET
import json

class Reader(ABC):
  @abstractmethod
  def read_file(self, f_loc: Path) -> bytes:
    pass

class ByteReader(Reader):
  def read_file(self, f_loc: Path) -> bytes:
    return f_loc.read_bytes()

class ReaderFactory:
  @staticmethod
  def create_reader(source_type: str) -> Reader:
    if (source_type == 'parquet'
        or source_type == 'csv'
        or source_type == 'txt'
        or source_type == 'json'
        or source_type == 'bpmn'
        or source_type == 'xml'):
      return ByteReader()
    else:
      raise ValueError(f"Unsupported Reader: {source_type}")