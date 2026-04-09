from base_solver import BaseSolver
from collections import deque
import time
import sys

class ForwardChainingSolver(BaseSolver):
    def __init__(self, puzzle, socketio=None, game_id=None):
        super().__init__(puzzle, socketio, game_id)
        self.facts = set()
        self.contradiction = False
        
        # Stats
        self.max_facts = 0
        self.inference_cycles = 0
        
    def solve(self, max_time=300):
        self.reset_stats()
        self.start_time = time.time()
        self.last_progress_time = self.start_time
        
        self.initialize_facts()
        self._send_progress(is_initial=True)
        
        self.inference_cycles = 0
        changed = True
        
        while changed and not self.contradiction and not self.cancelled:
            if time.time() - self.start_time > max_time:
                print(f"Time limit reached after {self.inference_cycles} cycles")
                return None
                
            changed = False
            self.inference_cycles += 1
            
            new_facts = self.apply_inference_rules()
            if new_facts:
                changed = True
                self.facts.update(new_facts)
                self.expanded_nodes = len(self.facts)
                
                if len(self.facts) > self.max_facts:
                    self.max_facts = len(self.facts)
                    
                if self.inference_cycles % 5 == 0:
                    self._send_progress()
                    
        if self.is_complete() and not self.contradiction:
            elapsed = time.time() - self.start_time
            print(f"Solution found in {elapsed:.2f}s, {self.inference_cycles} cycles, {self.expanded_nodes} facts")
            self._send_progress(is_complete=True)
            return self.extract_solution()
            
        if self.contradiction:
            print("Contradiction detected - no solution exists")
        else:
            print(f"No solution found after {self.inference_cycles} cycles")
            
        return None
        
    def _send_progress(self, is_initial=False, is_complete=False):
        if not self.socketio:
            return
            
        current_time = time.time()
        
        if not is_complete and not is_initial:
            time_diff = current_time - self.last_progress_time
            facts_diff = self.expanded_nodes - self.last_sent_nodes
            
            if time_diff < self.progress_interval and facts_diff < 500:
                return
                
        elapsed = current_time - self.start_time if self.start_time else 1
        rate = self.expanded_nodes / elapsed if elapsed > 0 else 0
        
        total_cells = self.puzzle.size * self.puzzle.size
        filled_cells = self.count_filled_cells()
        
        progress = 100 if is_complete else (filled_cells / total_cells * 100)
        
        try:
            self.socketio.emit('solver_progress', {
                'game_id': self.game_id,
                'solver': 'Forward Chaining',
                'progress': round(progress, 1),
                'nodes_explored': self.expanded_nodes,
                'inference_cycles': self.inference_cycles,
                'filled_cells': f"{filled_cells}/{total_cells}",
                'facts_count': self.expanded_nodes,
                'exploration_rate': round(rate, 1),
                'estimated_remaining': self._estimate_remaining(rate, filled_cells, total_cells),
                'is_complete': is_complete,
                'contradiction': self.contradiction
            })
            
            self.last_progress_time = current_time
            self.last_sent_nodes = self.expanded_nodes
            
        except Exception as e:
            print(f"Error sending progress: {e}")
            
    def _estimate_remaining(self, rate, filled_cells, total_cells):
        if rate <= 0 or filled_cells >= total_cells:
            return "calculating..."
            
        remaining_cells = total_cells - filled_cells
        estimated_seconds = (remaining_cells * 10) / rate if rate > 0 else 60
        
        if estimated_seconds < 60:
            return f"~{int(estimated_seconds)}s"
        elif estimated_seconds < 3600:
            return f"~{int(estimated_seconds/60)}m"
        else:
            return f"~{int(estimated_seconds/3600)}h"
            
    def count_filled_cells(self):
        """Đếm số ô đã được điền"""
        count = 0
        for fact in self.facts:
            if fact.startswith("Val("):
                count += 1
        return count
        
    def initialize_facts(self):
        for (i, j), val in self.puzzle.given_cells.items():
            self.facts.add(f"Val({i},{j},{val})")
            
        for i in range(self.puzzle.size):
            for j in range(self.puzzle.size-1):
                if self.puzzle.horizontal_constraints[i][j] == 1:
                    self.facts.add(f"LessH({i+1},{j+1})")
                elif self.puzzle.horizontal_constraints[i][j] == -1:
                    self.facts.add(f"GreaterH({i+1},{j+1})")
                    
        for i in range(self.puzzle.size-1):
            for j in range(self.puzzle.size):
                if self.puzzle.vertical_constraints[i][j] == 1:
                    self.facts.add(f"LessV({i+1},{j+1})")
                elif self.puzzle.vertical_constraints[i][j] == -1:
                    self.facts.add(f"GreaterV({i+1},{j+1})")
                    
    def apply_inference_rules(self):
        new_facts = set()
        
        new_facts.update(self.apply_row_uniqueness())
        new_facts.update(self.apply_column_uniqueness())
        new_facts.update(self.apply_inequality_constraints())
        new_facts.update(self.apply_elimination())
        
        return new_facts - self.facts
        
    def apply_row_uniqueness(self):
        new_facts = set()
        n = self.puzzle.size
        
        for i in range(1, n+1):
            for v in range(1, n+1):
                possible_cells = []
                for j in range(1, n+1):
                    if f"Val({i},{j},{v})" not in self.facts:
                        if self.can_assign(i, j, v):
                            possible_cells.append(j)
                            
                if len(possible_cells) == 1:
                    j = possible_cells[0]
                    new_facts.add(f"Val({i},{j},{v})")
                    
        return new_facts
        
    def apply_column_uniqueness(self):
        new_facts = set()
        n = self.puzzle.size
        
        for j in range(1, n+1):
            for v in range(1, n+1):
                possible_cells = []
                for i in range(1, n+1):
                    if f"Val({i},{j},{v})" not in self.facts:
                        if self.can_assign(i, j, v):
                            possible_cells.append(i)
                            
                if len(possible_cells) == 1:
                    i = possible_cells[0]
                    new_facts.add(f"Val({i},{j},{v})")
                    
        return new_facts
        
    def apply_inequality_constraints(self):
        new_facts = set()
        n = self.puzzle.size
        
        # Horizontal constraints
        for i in range(1, n+1):
            for j in range(1, n):
                if f"LessH({i},{j})" in self.facts:
                    for v1 in range(1, n+1):
                        if f"Val({i},{j},{v1})" in self.facts:
                            for v2 in range(1, v1+1):
                                if f"Val({i},{j+1},{v2})" in self.facts:
                                    self.contradiction = True
                                    return new_facts
                            for v2 in range(1, v1+1):
                                new_facts.add(f"¬Val({i},{j+1},{v2})")
                                
                if f"GreaterH({i},{j})" in self.facts:
                    for v1 in range(1, n+1):
                        if f"Val({i},{j},{v1})" in self.facts:
                            for v2 in range(v1, n+1):
                                if f"Val({i},{j+1},{v2})" in self.facts:
                                    self.contradiction = True
                                    return new_facts
                            for v2 in range(v1, n+1):
                                new_facts.add(f"¬Val({i},{j+1},{v2})")
                                
        # Vertical constraints
        for i in range(1, n):
            for j in range(1, n+1):
                if f"LessV({i},{j})" in self.facts:
                    for v1 in range(1, n+1):
                        if f"Val({i},{j},{v1})" in self.facts:
                            for v2 in range(1, v1+1):
                                if f"Val({i+1},{j},{v2})" in self.facts:
                                    self.contradiction = True
                                    return new_facts
                            for v2 in range(1, v1+1):
                                new_facts.add(f"¬Val({i+1},{j},{v2})")
                                
                if f"GreaterV({i},{j})" in self.facts:
                    for v1 in range(1, n+1):
                        if f"Val({i},{j},{v1})" in self.facts:
                            for v2 in range(v1, n+1):
                                if f"Val({i+1},{j},{v2})" in self.facts:
                                    self.contradiction = True
                                    return new_facts
                            for v2 in range(v1, n+1):
                                new_facts.add(f"¬Val({i+1},{j},{v2})")
                                
        return new_facts
        
    def apply_elimination(self):
        new_facts = set()
        n = self.puzzle.size
        
        for i in range(1, n+1):
            for j in range(1, n+1):
                possible_values = []
                for v in range(1, n+1):
                    if self.can_assign(i, j, v):
                        possible_values.append(v)
                        
                if len(possible_values) == 1:
                    new_facts.add(f"Val({i},{j},{possible_values[0]})")
                    
        return new_facts
        
    def can_assign(self, i, j, v):
        if any(f"Val({i},{j},{v2})" in self.facts for v2 in range(1, self.puzzle.size+1)):
            return False
            
        if f"¬Val({i},{j},{v})" in self.facts:
            return False
            
        for j2 in range(1, self.puzzle.size+1):
            if j2 != j and f"Val({i},{j2},{v})" in self.facts:
                return False
                
        for i2 in range(1, self.puzzle.size+1):
            if i2 != i and f"Val({i2},{j},{v})" in self.facts:
                return False
                
        return True
        
    def is_complete(self):
        for i in range(1, self.puzzle.size+1):
            for j in range(1, self.puzzle.size+1):
                if not any(f"Val({i},{j},{v})" in self.facts for v in range(1, self.puzzle.size+1)):
                    return False
        return True
        
    def extract_solution(self):
        solution = {}
        for fact in self.facts:
            if fact.startswith("Val("):
                parts = fact.replace("Val(", "").replace(")", "").split(",")
                i, j, v = int(parts[0]), int(parts[1]), int(parts[2])
                solution[(i, j)] = v
        return solution
        
    def get_stats(self):
        elapsed = time.time() - self.start_time if self.start_time else 0
        
        return {
            'nodes_explored': self.expanded_nodes,
            'inference_cycles': self.inference_cycles,
            'max_facts': self.max_facts,
            'time': elapsed,
            'contradiction': self.contradiction,
            'solution_found': self.is_complete() and not self.contradiction
        }