from pathlib import Path
import json

from DiagramLogic import SwimlaneDiagram
from EventLogLogic import OCEventLog, CCEventLog


class FileStorage:
  def __init__(self):
    self.STORE_DIR = Path(".store/objects")
    self.METADATA_FILE = Path(".store/metadata.json")
    self.BUNDLE_FILE = Path(".store/bundles.json")
    self.OCEL_DIR = Path(".store/objects/OCEL")
    self.CCEL_DIR = Path(".store/objects/CCEL")
    self.BPMN_DIR = Path(".store/objects/BPMN")

  def init_store(self):
    self.STORE_DIR.mkdir(parents=True, exist_ok=True)
    self.OCEL_DIR.mkdir(parents=True, exist_ok=True)
    self.CCEL_DIR.mkdir(parents=True, exist_ok=True)
    self.BPMN_DIR.mkdir(parents=True, exist_ok=True)
    if not self.METADATA_FILE.exists():
      self.METADATA_FILE.write_text(json.dumps({}))
    if not self.BUNDLE_FILE.exists():
      self.BUNDLE_FILE.write_text(json.dumps({}))

  def determine_directory(self, artifact):
    if isinstance(artifact, OCEventLog):
      return self.OCEL_DIR
    elif isinstance(artifact, CCEventLog):
      return self.CCEL_DIR
    elif isinstance(artifact, SwimlaneDiagram):
      return self.BPMN_DIR


  def get_subdir(self, subdir: str = "") -> Path:
    if subdir:
      path = self.STORE_DIR / subdir
    else:
      path = self.STORE_DIR
    path.mkdir(parents=True, exist_ok=True)
    return path
