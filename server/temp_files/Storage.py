from pathlib import Path
import json

class FileStorage:
  def __init__(self):
    self.STORE_DIR = Path(".store/objects")
    self.METADATA_FILE = Path(".store/metadata.json")
    self.BUNDLE_FILE = Path(".store/bundles.json")

  def init_store(self):
    self.STORE_DIR.mkdir(parents=True, exist_ok=True)
    if not self.METADATA_FILE.exists():
      self.METADATA_FILE.write_text(json.dumps({}))
    if not self.BUNDLE_FILE.exists():
      self.BUNDLE_FILE.write_text(json.dumps({}))

  def get_subdir(self, subdir: str = "") -> Path:
    if subdir:
      path = self.STORE_DIR / subdir
    else:
      path = self.STORE_DIR
    path.mkdir(parents=True, exist_ok=True)
    return path
