from abc import ABC, abstractmethod
from collections import defaultdict

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
    if 'resource' not in df.columns or 'concept:name' not in df.columns:
      return {}

    dominant = (
      df.groupby(['concept:name', 'resource'])
      .size()
      .reset_index(name='count')
      .sort_values('count', ascending=False)
      .drop_duplicates(subset='concept:name')  # keep top actor per activity
      .set_index('resource')['concept:name']
    )

    role_map = defaultdict(list)
    for actor, activity in dominant.items():
      role_map[actor].append(activity)

    self._role_to_activities = dict(role_map)
    return self._role_to_activities

class DiscoveryFactory:
  @staticmethod
  def create(log: str):
    # if isinstance(log, OCEventLog):
    #   return OCELDiscovery()
    # elif isinstance(log, CCEventLog):
    return CCELDiscovery()