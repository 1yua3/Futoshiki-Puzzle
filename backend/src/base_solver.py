from abc import ABC, abstractmethod
from typing import List, Tuple, Optional, Any
import time
import tracemalloc

class BaseSolver(ABC):
    def __init__(self, puzzle, socketio=None, game_id=None, **kwargs):
        self.puzzle = puzzle
        self.socketio = socketio
        self.game_id = game_id
        
        self.solution = None
        self.expanded_nodes = 0
        self.search_time = 0
        self.memory_usage = 0
        
        self.start_time = None
        self.last_progress_time = 0
        self.progress_interval = kwargs.get('progress_interval', 0.5)
        self.last_sent_nodes = 0
        self.cancelled = False
        self.reset_stats()
        
    def reset_stats(self):
        self.solution = None
        self.expanded_nodes = 0
        self.search_time = 0
        self.memory_usage = 0
        self.start_time = None
        self.last_progress_time = 0
        self.last_sent_nodes = 0
        
    @abstractmethod
    def solve(self, **kwargs) -> Optional[Any]:
        pass
    
    def measure_performance(self, **kwargs) -> dict:
        tracemalloc.start()
        self.start_time = time.time()
        
        self.solution = self.solve(**kwargs)
        
        end_time = time.time()
        
        _, peak_traced = tracemalloc.get_traced_memory()
        tracemalloc.stop()
        
        self.search_time = end_time - self.start_time
        self.memory_usage = peak_traced / 1024 / 1024
        
        return {
            'expanded_nodes': self.expanded_nodes,
            'search_time': self.search_time,
            'memory_usage': self.memory_usage,
            'solution_found': self.solution is not None
        }

    def _should_send_progress(self, current_nodes: int) -> bool:
        if not self.socketio:
            return False
            
        current_time = time.time()
        time_diff = current_time - self.last_progress_time
        nodes_diff = current_nodes - self.last_sent_nodes
        
        if time_diff >= self.progress_interval or nodes_diff >= 500:
            self.last_progress_time = current_time
            self.last_sent_nodes = current_nodes
            return True
        return False
