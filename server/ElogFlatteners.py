from abc import ABC, abstractmethod

import numpy as np
import pm4py

from EventLogLogic import EventLog, OCEventLog, EventLogFactory
import pandas as pd
import re

from FormatConversion import ConverterFactory


class ElogFlattener(ABC):
  @abstractmethod
  def simplify_eLog(self, elog: EventLog, file_type: str) -> EventLog:
    pass

class OCELFlattener(ElogFlattener):
  def __init__(self):
    self.elog_to_df = ConverterFactory.create_df_converter('pqt')


  def simplify_eLog(self, elog: OCEventLog, file_type: str): # -> EventLog:
    elog_contents = elog.read_event_log()
    object_types = self._infer_object_types(elog_contents)
    oc_event_log = pm4py.convert_log_to_ocel(
      elog_contents,
      activity_column="activity",
      timestamp_column="timestamp",
      object_types = object_types,
    )
    ranking = self._find_object_for_simplification(oc_event_log)
    best_object_type = ranking[0][0]
    flat_df = pm4py.ocel.ocel_flattening(oc_event_log, best_object_type)
    return EventLogFactory.create_elog('CCEL', file_type, flat_df), flat_df

  def _find_object_for_simplification(self, oc_event_log) -> list:
    object_types = pm4py.ocel.ocel_get_object_types(oc_event_log)
    results = list()
    for ot in object_types:
        score = self._score_object_type(oc_event_log, ot)
        results.append((ot, score))
    results.sort(key=lambda x: x[1], reverse=True)
    return results

  def _score_object_type(self, oc_event_log, object_type) -> float:
    log_df = pm4py.ocel_flattening(oc_event_log, object_type=object_type)

    num_cases = len(log_df)
    if num_cases == 0:
        return -1e9

    case_lengths = log_df.groupby("case:concept:name").size().to_numpy()
    num_events = case_lengths.sum()
    coverage = num_events

    stability = 1 / (np.std(case_lengths) + 1e-6) if len(case_lengths) > 1 else 0

    avg_len = np.mean(case_lengths)
    fragmentation = -abs(avg_len - np.median(case_lengths))

    non_trivial = np.sum(case_lengths > 1) / num_cases
    long_tail = np.sum(case_lengths > np.percentile(case_lengths, 95)) / num_cases
    lifecycle = non_trivial - long_tail

    score = (
        0.4 * coverage +
        0.2 * stability +
        0.2 * avg_len +
        0.1 * fragmentation +
        0.3 * lifecycle
    )
    return score

  def _infer_object_types(self, df: pd.DataFrame) -> list:
    object_types = []
    if 'object_type' in df.columns:
      unique_types = df['object_type'].unique()
      for obj_type in unique_types:
        object_types.append((obj_type, 'object_type'))
    return object_types

