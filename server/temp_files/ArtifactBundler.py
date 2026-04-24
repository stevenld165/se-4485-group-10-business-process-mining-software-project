from abc import ABC, abstractmethod
import os
import uuid
import json
import pandas as pd
from pathlib import Path
from datetime import datetime

from Writers import WriterFactory
from Storage import FileStorage
class Bundler(ABC):
  @abstractmethod
  def bundle_artifacts(self, *object_ids: str, label: str = "") -> str:
    pass

class ArtifactBundler(Bundler):
  def __init__(self):
    self.S = FileStorage()
    self.S.init_store()

  def bundle_artifacts(self, *object_ids: str, label: str = "") -> str:
    self.S.METADATA_FILE.read_text()

class UnBundler(ABC):
  @abstractmethod
  def types(self) -> list[str]:
    pass

  @abstractmethod
  def all(self) -> dict:
    pass

