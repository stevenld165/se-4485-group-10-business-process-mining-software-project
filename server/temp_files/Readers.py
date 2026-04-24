from abc import ABC, abstractmethod
from pathlib import Path
import xml.etree.ElementTree as ET
import json

class Reader(ABC):
  @abstractmethod
  def read_file(self, f_loc: Path) -> bytes:
    pass

class JsonReader(Reader):
  def read_file(self, f_loc: Path) -> bytes:
    return f_loc.read_bytes()

class ParaquetReader(Reader):
  def read_file(self, f_loc: Path) -> bytes:
    return f_loc.read_bytes()

class BPMNReader(Reader):
  def read_file(self, f_loc: Path):
    tree = ET.parse(f_loc)
    root = tree.getroot()
    return root

class ReaderFactory():
  @staticmethod
  def create_reader(source_type: str) -> Reader:
    if source_type == 'MetaData' or source_type == 'Bundle':
      return JsonReader()
    elif source_type == 'Elog':
      return ParaquetReader()
    elif source_type == 'Diagram':
      return BPMNReader()