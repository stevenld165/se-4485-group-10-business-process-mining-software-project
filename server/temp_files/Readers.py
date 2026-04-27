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

class XMLReader(Reader):
  def read_file(self, f_loc: Path):
    tree = ET.parse(f_loc)
    root = tree.getroot()
    return root

class ReaderFactory():
  @staticmethod
  def create_reader(source_type: str) -> Reader:
    if (source_type == 'pqt'
        or source_type == 'txt'
        or source_type == 'json'):
      return ByteReader()
    elif source_type == 'bpmn':
      return XMLReader()