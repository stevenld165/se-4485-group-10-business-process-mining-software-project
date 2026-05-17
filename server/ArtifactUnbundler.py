from abc import ABC, abstractmethod
from pathlib import Path

from Writers import WriterFactory
from Storage import FileStorage
from Readers import ReaderFactory
from FileLoaders import LoaderFactory
from FormatConversion import ConverterFactory

class UnBundler(ABC):
  @abstractmethod
  def types(self) -> list[str]:
    pass

  @abstractmethod
  def all(self) -> dict:
    pass

class BundleUnpacker(UnBundler):
  """
  Loads all objects in a bundle, regardless of their format or storage location.
  Reads metadata to determine WHERE each file is stored, then loads it.
  """

  def __init__(self, bundle_id: str):
    self.store = FileStorage()
    self.from_json_converter = ConverterFactory.create_json_converter('txt')
    self.json_reader = ReaderFactory.create_reader('json')
    self.json_writer = WriterFactory.create_writer('json')

    bundles = self.from_json_converter.convert_to(
      self.json_reader.read_file(self.store.BUNDLE_FILE)
    )

    metadata = self.from_json_converter.convert_to(
      self.json_reader.read_file(self.store.METADATA_FILE)
    )
    if bundle_id not in bundles:
      raise KeyError(f"No bundle found: {bundle_id}")

    self.bundle_id = bundle_id
    self._objects = {}
    self._load_bundle_members(bundles, metadata)

  def _load_bundle_members(self, bundles, metadata):
    for object_type, object_id in bundles[self.bundle_id]["members"].items():
      meta = metadata[object_id]
      fmt = meta["format"]
      path = self._determine_file_location(meta.get("storage_subdir", ""), object_id, fmt)
      data = self._read_file(path, fmt)
      self._objects[object_type] = {
        "id": object_id,
        "data": data,
        "meta": meta,
      }

  def _determine_file_location(self, storage_subdir: str, object_id: str, fmt: str) -> Path:
    if storage_subdir != "":
      return self.store.STORE_DIR / storage_subdir / f"{object_id}.{fmt}"
    else:
      return self.store.STORE_DIR / f"{object_id}.{fmt}"

  def _read_file(self, path: Path, fmt: str):
    if not path.exists():
      raise FileNotFoundError(f"File not found: {path}")
    file_loader = LoaderFactory.create_loader(fmt)
    return file_loader.load(path, fmt)

  def types(self) -> list[str]:
    """Return all member type names."""
    return list(self._objects.keys())

  def all(self) -> dict:
    """Return all members as a plain dict."""
    return {t: v["data"] for t, v in self._objects.items()}

  def __getitem__(self, object_type: str):
    """Access by type name: loader["ocel"]"""
    if object_type not in self._objects:
      raise KeyError(f"No member of type: {object_type}")
    return self._objects[object_type]["data"]

  def __getattr__(self, object_type: str):
    if object_type.startswith("_"):
      raise AttributeError(object_type)
    if object_type not in self._objects:
      raise AttributeError(f"No member of type: {object_type}")
    return self._objects[object_type]["data"]

  def meta(self, object_type: str) -> dict:
    return self._objects[object_type]["meta"]