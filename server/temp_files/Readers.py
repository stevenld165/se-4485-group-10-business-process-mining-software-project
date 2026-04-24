from abc import ABC, abstractmethod
from pathlib import Path
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

class ReaderFactory():
  @staticmethod
  def create_reader(source_type: str) -> Reader:
    if source_type == 'MetaData' or source_type == 'Bundle':
      return JsonReader()
    if source_type == 'Elog':
      return ParaquetReader()