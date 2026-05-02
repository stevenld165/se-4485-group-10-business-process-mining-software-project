import pandas as pd

class Normalizer:
  @staticmethod
  def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    column_mapping = {
      # Case-centric
      'Case_ID': 'case_id',
      'case:concept:name': 'case_id',

      # Object-centric
      'Event_ID': 'event_id',
      'Object_ID': 'object_id',
      'Object_Type': 'object_type',

      # OCEL 2.0 Format
      'ocel:id': 'event_id',
      'ocel:oid': 'object_id',
      'ocel:type': 'object_type',
      'ocel:activity': 'activity',
      'ocel:timestamp': 'timestamp',
      'ocel:omap': 'object_id',  # Multi-object references

      # Shared
      'Activity': 'activity',
      'concept:name': 'activity',
      'Timestamp': 'timestamp',
      'time:timestamp': 'timestamp',
      'Role': 'actor',
      'Actor': 'actor',
      'resource': 'actor'
    }

    return df.rename(columns={
      k: v for k, v in column_mapping.items() if k in df.columns
    })

class DeNormalizer:
  @staticmethod
  def denormalize_for_pm4py(df: pd.DataFrame) -> pd.DataFrame:
    if ('object_id' in df.columns and
        'object_type' in df.columns and
        'event_id' in df.columns):
      reverse_mapping_ocel = {
        'event_id': 'ocel:id',
        'object_id': 'ocel:oid',
        'object_type': 'ocel:type',
        'activity': 'ocel:activity',
        'timestamp': 'ocel:timestamp',
        'actor': 'resource'
      }
      return df.rename(columns={
        k: v for k, v in reverse_mapping_ocel.items() if k in df.columns
      })
    else:
      reverse_mapping = {
        'case_id': 'case:concept:name',
        'activity': 'concept:name',
        'timestamp': 'time:timestamp',
        'actor': 'resource'
      }
      return df.rename(columns={
        k: v for k, v in reverse_mapping.items() if k in df.columns
      })