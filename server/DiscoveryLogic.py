from abc import ABC, abstractmethod

from EventLogLogic import EventLog, OCEventLog, CCEventLog
import pandas as pd

import pm4py
from pm4py.objects.conversion.log import converter as log_converter


class GraphConstructor:
  @staticmethod
  def start(self):
    return

class DiscoveryAlg(ABC):
  @abstractmethod
  def discover_process(self, log: EventLog):
    pass
  # figure out what it outputs; either a graph object, or a file formatted to be written to a graph

# class OCELDiscovery(DiscoveryAlg):
#   def discover_process(self, log: OCEL):
#     # mining algorithm specific to object centric event log
#     return

class CCELDiscovery(DiscoveryAlg):
  def __init__(self):
    self._role_to_activities = None

  def discover_process(self, df: pd.DataFrame):
    event_log = log_converter.apply(df)
    return pm4py.discover_bpmn_inductive(event_log)

  def get_role_activities(self, df: pd.DataFrame) -> dict:
    if 'actor' not in df.columns or 'activity' not in df.columns:
      return {}

    role_map = (
      df.groupby('actor')['activity']
      .apply(set)
      .to_dict()
    )

    self._role_to_activities = {
      k: list(v) for k, v in role_map.items()
    }

    return self._role_to_activities

class DiscoveryFactory:
  @staticmethod
  def create(log: str):
    # if isinstance(log, OCEventLog):
    #   return OCELDiscovery()
    # elif isinstance(log, CCEventLog):
    return CCELDiscovery()