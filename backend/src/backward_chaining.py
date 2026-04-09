from base_solver import BaseSolver
from copy import deepcopy
import time
import sys

class BackwardChainingSolver(BaseSolver):
    def __init__(self, puzzle, socketio=None, game_id=None):
        super().__init__(puzzle, socketio, game_id)
        self.facts = set()
        self.rules = []
        self.solution = {}
        self.backtracks = 0
        self.max_depth = 10000
        
        # Stats
        self.max_depth_reached = 0
        
    def solve(self, max_time=300):
        self.reset_stats()
        self.start_time = time.time()
        self.last_progress_time = self.start_time
        
        print("\n[Backward Chaining] Bắt đầu giải...")
        
        self.initialize_facts()
        self._send_progress(is_initial=True)
        
        for (i, j), val in self.puzzle.given_cells.items():
            self.solution[(i, j)] = val
            
        empty_cells = self.get_empty_cells()
        
        if not empty_cells:
            return self.solution
            
        if self.backtrack_search(empty_cells, 0, max_time):
            elapsed = time.time() - self.start_time
            print(f"[Backward Chaining] Thành công! Số lần mở rộng: {self.expanded_nodes}")
            self._send_progress(is_complete=True)
            return self.solution
            
        print(f"[Backward Chaining] Thất bại! Số lần mở rộng: {self.expanded_nodes}")
        return None
        
    def _send_progress(self, is_initial=False, is_complete=False):
        if not self.socketio:
            return
            
        current_time = time.time()
        
        if not is_complete and not is_initial:
            time_diff = current_time - self.last_progress_time
            expansions_diff = self.expanded_nodes - self.last_sent_nodes
            
            if time_diff < self.progress_interval and expansions_diff < 500:
                return
                
        elapsed = current_time - self.start_time if self.start_time else 1
        rate = self.expanded_nodes / elapsed if elapsed > 0 else 0
        
        total_cells = self.puzzle.size * self.puzzle.size
        filled_cells = len(self.solution)
        
        progress = 100 if is_complete else (filled_cells / total_cells * 100)
        
        try:
            self.socketio.emit('solver_progress', {
                'game_id': self.game_id,
                'solver': 'Backward Chaining',
                'progress': round(progress, 1),
                'nodes_explored': self.expanded_nodes,
                'backtracks': self.backtracks,
                'filled_cells': f"{filled_cells}/{total_cells}",
                'current_depth': len(self.solution),
                'max_depth': self.max_depth_reached,
                'exploration_rate': round(rate, 1),
                'estimated_remaining': self._estimate_remaining(rate, filled_cells, total_cells),
                'is_complete': is_complete
            })
            
            self.last_progress_time = current_time
            self.last_sent_nodes = self.expanded_nodes
            
        except Exception as e:
            print(f"Error sending progress: {e}")
            
    def _estimate_remaining(self, rate, filled_cells, total_cells):
        if rate <= 0 or filled_cells >= total_cells:
            return "calculating..."
            
        remaining_cells = total_cells - filled_cells
        estimated_nodes = remaining_cells * (self.puzzle.size / 2)
        estimated_seconds = estimated_nodes / rate if rate > 0 else 60
        
        if estimated_seconds < 60:
            return f"~{int(estimated_seconds)}s"
        elif estimated_seconds < 3600:
            return f"~{int(estimated_seconds/60)}m"
        else:
            return f"~{int(estimated_seconds/3600)}h"
            
    def initialize_facts(self):
        for (i, j), val in self.puzzle.given_cells.items():
            self.facts.add(f"val({i},{j},{val})")
            
        for i in range(self.puzzle.size):
            for j in range(self.puzzle.size - 1):
                if self.puzzle.horizontal_constraints[i][j] == 1:
                    self.facts.add(f"less_h({i+1},{j+1})")
                elif self.puzzle.horizontal_constraints[i][j] == -1:
                    self.facts.add(f"greater_h({i+1},{j+1})")
                    
        for i in range(self.puzzle.size - 1):
            for j in range(self.puzzle.size):
                if self.puzzle.vertical_constraints[i][j] == 1:
                    self.facts.add(f"less_v({i+1},{j+1})")
                elif self.puzzle.vertical_constraints[i][j] == -1:
                    self.facts.add(f"greater_v({i+1},{j+1})")
                    
        print(f"[Backward Chaining] Khởi tạo {len(self.facts)} facts")
        
    def get_empty_cells(self):
        empty_cells = []
        for i in range(1, self.puzzle.size + 1):
            for j in range(1, self.puzzle.size + 1):
                if (i, j) not in self.solution:
                    empty_cells.append((i, j))
        return empty_cells
        
    def backtrack_search(self, empty_cells, index, max_time):
        if time.time() - self.start_time > max_time:
            return False
            
        if self.cancelled:
            return False
            
        self.expanded_nodes += 1
        
        if len(self.solution) > self.max_depth_reached:
            self.max_depth_reached = len(self.solution)
            
        if self.expanded_nodes % 1000 == 0:
            self._send_progress()
        
        if index >= len(empty_cells):
            return self.check_complete_solution()
            
        i, j = empty_cells[index]
        
        possible_values = self.get_possible_values(i, j)
        possible_values = self.order_values_by_constraints(i, j, possible_values)
        
        for v in possible_values:
            if self.is_valid_assignment(i, j, v):
                self.solution[(i, j)] = v
                self.facts.add(f"val({i},{j},{v})")
                
                if self.forward_check():
                    if self.backtrack_search(empty_cells, index + 1, max_time):
                        return True
                        
                del self.solution[(i, j)]
                self.facts.discard(f"val({i},{j},{v})")
                self.backtracks += 1
                
        return False
        
    def get_possible_values(self, i, j):
        n = self.puzzle.size
        possible = []
        
        for v in range(1, n + 1):
            if self.is_valid_assignment(i, j, v):
                possible.append(v)
                
        return possible
        
    def is_valid_assignment(self, i, j, v):
        n = self.puzzle.size
        
        for j2 in range(1, n + 1):
            if j2 != j and (i, j2) in self.solution:
                if self.solution[(i, j2)] == v:
                    return False
                    
        for i2 in range(1, n + 1):
            if i2 != i and (i2, j) in self.solution:
                if self.solution[(i2, j)] == v:
                    return False
                    
        if j > 1 and (i, j - 1) in self.solution:
            left_val = self.solution[(i, j - 1)]
            constraint = self.puzzle.horizontal_constraints[i - 1][j - 2]
            if constraint == 1:
                if left_val >= v:
                    return False
            elif constraint == -1:
                if left_val <= v:
                    return False
                    
        if j < n and (i, j + 1) in self.solution:
            right_val = self.solution[(i, j + 1)]
            constraint = self.puzzle.horizontal_constraints[i - 1][j - 1]
            if constraint == 1:
                if v >= right_val:
                    return False
            elif constraint == -1:
                if v <= right_val:
                    return False
                    
        if i > 1 and (i - 1, j) in self.solution:
            up_val = self.solution[(i - 1, j)]
            constraint = self.puzzle.vertical_constraints[i - 2][j - 1]
            if constraint == 1:
                if up_val >= v:
                    return False
            elif constraint == -1:
                if up_val <= v:
                    return False
                    
        if i < n and (i + 1, j) in self.solution:
            down_val = self.solution[(i + 1, j)]
            constraint = self.puzzle.vertical_constraints[i - 1][j - 1]
            if constraint == 1:
                if v >= down_val:
                    return False
            elif constraint == -1:
                if v <= down_val:
                    return False
                    
        return True
        
    def order_values_by_constraints(self, i, j, values):
        n = self.puzzle.size
        value_scores = []
        
        for v in values:
            score = 0
            for j2 in range(1, n + 1):
                if j2 != j and (i, j2) not in self.solution:
                    if self.puzzle.horizontal_constraints[i - 1][min(j, j2) - 1] != 0:
                        score += 1
            for i2 in range(1, n + 1):
                if i2 != i and (i2, j) not in self.solution:
                    if self.puzzle.vertical_constraints[min(i, i2) - 1][j - 1] != 0:
                        score += 1
            value_scores.append((v, score))
            
        value_scores.sort(key=lambda x: x[1])
        return [v for v, _ in value_scores]
        
    def forward_check(self):
        n = self.puzzle.size
        
        for i in range(1, n + 1):
            for j in range(1, n + 1):
                if (i, j) not in self.solution:
                    has_possible = False
                    for v in range(1, n + 1):
                        if self.is_valid_assignment(i, j, v):
                            has_possible = True
                            break
                    if not has_possible:
                        return False
        return True
        
    def check_complete_solution(self):
        n = self.puzzle.size
        
        if len(self.solution) != n * n:
            return False
            
        for i in range(1, n + 1):
            row_values = []
            for j in range(1, n + 1):
                val = self.solution[(i, j)]
                if val in row_values:
                    return False
                row_values.append(val)
                
        for j in range(1, n + 1):
            col_values = []
            for i in range(1, n + 1):
                val = self.solution[(i, j)]
                if val in col_values:
                    return False
                col_values.append(val)
                
        for i in range(1, n + 1):
            for j in range(1, n):
                constraint = self.puzzle.horizontal_constraints[i - 1][j - 1]
                if constraint == 1:
                    if self.solution[(i, j)] >= self.solution[(i, j + 1)]:
                        return False
                elif constraint == -1:
                    if self.solution[(i, j)] <= self.solution[(i, j + 1)]:
                        return False
                        
        for i in range(1, n):
            for j in range(1, n + 1):
                constraint = self.puzzle.vertical_constraints[i - 1][j - 1]
                if constraint == 1:
                    if self.solution[(i, j)] >= self.solution[(i + 1, j)]:
                        return False
                elif constraint == -1:
                    if self.solution[(i, j)] <= self.solution[(i + 1, j)]:
                        return False
                        
        return True
        
    def get_stats(self):
        elapsed = time.time() - self.start_time if self.start_time else 0
        
        return {
            'nodes_explored': self.expanded_nodes,
            'backtracks': self.backtracks,
            'max_depth': self.max_depth_reached,
            'time': elapsed,
            'solution_found': len(self.solution) == self.puzzle.size * self.puzzle.size
        }