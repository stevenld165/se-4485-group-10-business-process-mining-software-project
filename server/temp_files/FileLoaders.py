from abc import ABC, abstractmethod
from pathlib import Path

from Readers import ReaderFactory
from FormatConversion import ConverterFactory

class FileLoader(ABC):
  @staticmethod
  def load(path: Path, fmt: str):
    pass

class TextLoader(FileLoader):
  @staticmethod
  def load(path: Path, fmt: str) -> str:
    reader = ReaderFactory.create_reader(fmt)
    byte_converter = ConverterFactory.create_byte_converter(fmt)
    return byte_converter.convert_to(
      reader.read_file(path)
    )

class ParquetLoader(FileLoader):
  @staticmethod
  def load(path: Path, fmt: str) -> bytes:
    reader = ReaderFactory.create_reader(fmt)
    return reader.read_file(path)

class LoaderFactory:
  @staticmethod
  def create_loader(fmt: str):
    if fmt == "parquet":
      return ParquetLoader()
    elif fmt in ("json", "txt", "bpmn"):
      return TextLoader()