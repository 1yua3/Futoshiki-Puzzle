from base_solver import BaseSolver
from solver_state import SolverState
import time
import sys

class BacktrackingSolver(BaseSolver):
    def __init__(self, puzzle, socketio=None, game_id=None):
        super().__init__(puzzle, socketio, game_id)
        self.backtracks = 0
        self.solution_found = False
        
        # Stats
        self.max_depth = 0
        
    def solve(self, max_time=300):
        self.reset_stats()
        self.start_time = time.time()
        self.last_progress_time = self.start_time
        
        initial_state = SolverState({}, self.puzzle)
        for (i, j), val in self.puzzle.given_cells.items():
            initial_state.assignment[(i, j)] = val
            
        self._send_progress(state=initial_state, is_initial=True)
        
        result_state = self.backtrack(initial_state, max_time)
        if result_state:
            self.solution_found = True
            elapsed = time.time() - self.start_time
            print(f"Solution found in {elapsed:.2f}s, {self.expanded_nodes} nodes")
            self._send_progress(state=result_state, is_complete=True)
            return result_state.assignment
            
        print(f"No solution found after {self.expanded_nodes} nodes")
        return None
        
    def _send_progress(self, state=None, is_initial=False, is_complete=False):
        if not self.socketio:
            return
            
        current_time = time.time()
        
        if not is_complete and not is_initial:
            time_diff = current_time - self.last_progress_time
            nodes_diff = self.expanded_nodes - self.last_sent_nodes
            
            if time_diff < self.progress_interval and nodes_diff < 500:
                return
                
        elapsed = current_time - self.start_time if self.start_time else 1
        rate = self.expanded_nodes / elapsed if elapsed > 0 else 0
        
        total_cells = self.puzzle.size * self.puzzle.size
        filled_cells = len(state.assignment) if state else 0
        
        progress = 100 if is_complete else (filled_cells / total_cells * 100)
        
        try:
            self.socketio.emit('solver_progress', {
                'game_id': self.game_id,
                'solver': 'Backtracking',
                'progress': round(progress, 1),
                'nodes_explored': self.expanded_nodes,
                'backtracks': self.backtracks,
                'filled_cells': f"{filled_cells}/{total_cells}",
                'current_depth': filled_cells,
                'max_depth': self.max_depth,
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
            
    def backtrack(self, state, max_time):
        if time.time() - self.start_time > max_time:
            return None
            
        if self.cancelled:
            return None
            
        self.expanded_nodes += 1
        
        if len(state.assignment) > self.max_depth:
            self.max_depth = len(state.assignment)
            
        if self.expanded_nodes % 1000 == 0:
            self._send_progress(state=state)
        
        if state.is_goal():
            return state
            
        cell = self.select_unassigned_cell(state)
        if not cell:
            return None
            
        i, j = cell
        values = self.order_domain_values(i, j, state)
        
        for v in values:
            if state.is_valid_assignment(i, j, v):
                new_state = state.apply_move(i, j, v)
                
                if self.forward_check(new_state, i, j):
                    result = self.backtrack(new_state, max_time)
                    if result:
                        return result
                
                self.backtracks += 1
                
        return None
        
    def select_unassigned_cell(self, state):
        n = self.puzzle.size
        min_domain_size = n + 1
        best_cell = None
        
        for i in range(1, n+1):
            for j in range(1, n+1):
                if (i, j) not in state.assignment:
                    domain_size = self.count_possible_values(i, j, state)
                    if domain_size < min_domain_size:
                        min_domain_size = domain_size
                        best_cell = (i, j)
                        if min_domain_size == 1:
                            return best_cell
                            
        return best_cell
        
    def count_possible_values(self, i, j, state):
        n = self.puzzle.size
        count = 0
        
        for v in range(1, n+1):
            if state.is_valid_assignment(i, j, v):
                count += 1
                
        return count
        
    def order_domain_values(self, i, j, state):
        n = self.puzzle.size
        values = []
        
        for v in range(1, n+1):
            if state.is_valid_assignment(i, j, v):
                constraints = self.count_constraints_affected(i, j, v, state)
                values.append((v, constraints))
                
        values.sort(key=lambda x: x[1])
        return [v for v, _ in values]
        
    def count_constraints_affected(self, i, j, v, state):
        n = self.puzzle.size
        count = 0
        
        for j2 in range(1, n+1):
            if j2 != j and (i, j2) not in state.assignment:
                if self.puzzle.horizontal_constraints[i-1][min(j, j2)-1] != 0:
                    count += 1
                    
        for i2 in range(1, n+1):
            if i2 != i and (i2, j) not in state.assignment:
                if self.puzzle.vertical_constraints[min(i, i2)-1][j-1] != 0:
                    count += 1
                    
        return count
        
    def forward_check(self, state, last_i=None, last_j=None):
        """
        Kiểm tra sau khi gán (last_i, last_j).
        Chỉ duyệt các ô trong hàng last_i và cột last_j
        thay vì toàn bộ N² ô → giảm từ O(N³) xuống O(N²).
        """
        n = self.puzzle.size
        
        if last_i is not None and last_j is not None:
            # Chỉ check các ô bị ảnh hưởng: cùng hàng hoặc cùng cột
            cells_to_check = set()
            for j in range(1, n + 1):
                if (last_i, j) not in state.assignment:
                    cells_to_check.add((last_i, j))
            for i in range(1, n + 1):
                if (i, last_j) not in state.assignment:
                    cells_to_check.add((i, last_j))
        else:
            # Fallback: check toàn bộ (khi không biết ô vừa gán)
            cells_to_check = {
                (i, j) for i in range(1, n + 1)
                for j in range(1, n + 1)
                if (i, j) not in state.assignment
            }
        
        for (i, j) in cells_to_check:
            if not any(state.is_valid_assignment(i, j, v) for v in range(1, n + 1)):
                return False
                
        return True
        
    def get_stats(self):
        elapsed = time.time() - self.start_time if self.start_time else 0
        
        return {
            'nodes_explored': self.expanded_nodes,
            'backtracks': self.backtracks,
            'max_depth': self.max_depth,
            'time': elapsed,
            'solution_found': self.solution_found
        }