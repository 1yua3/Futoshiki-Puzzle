from base_solver import BaseSolver
from solver_state import SolverState
import heapq
from copy import deepcopy
import time
import sys
from collections import deque

class AStarSolver(BaseSolver):
    def __init__(self, puzzle, socketio=None, game_id=None, heuristic_type='combined'):
        super().__init__(puzzle, socketio, game_id)
        self.heuristic_type = heuristic_type
        self.visited = {}
        self.heuristic_cache = {}
        self.reset_stats()
        
        self.start_heuristic = None
        self.best_heuristic = float('inf')
        
        self.max_depth = 0
        self.total_branching = 0
        self.branching_count = 0
    
    def reset_stats(self):
        """Reset hoàn toàn cho mỗi lần solve mới"""
        super().reset_stats()
        self.visited = {}
        self.heuristic_cache = {}
        self.start_heuristic = None
        self.best_heuristic = float('inf')
        self.max_depth = 0
        self.total_branching = 0
        self.branching_count = 0
    def solve(self, node_limit=1000000, max_time=300):
        self.reset_stats()
        self.start_time = time.time()
        self.last_progress_time = self.start_time
        self.expanded_nodes = 0
        
        initial_state = SolverState({}, self.puzzle)
        for (i, j), val in self.puzzle.given_cells.items():
            initial_state.assignment[(i, j)] = val
            
        initial_state.h = self.heuristic(initial_state)
        self.start_heuristic = initial_state.h
        self.best_heuristic = initial_state.h
        
        self._send_progress(initial_state, 0)
        
        frontier = []
        heapq.heappush(frontier, initial_state)
        g_score = {initial_state: 0}
        
        while frontier and self.expanded_nodes < node_limit:
            if time.time() - self.start_time > max_time:
                print(f" Time limit reached after {self.expanded_nodes} nodes")
                return None
                
            if self.cancelled:
                print(" Search cancelled")
                return None
                
            current = heapq.heappop(frontier)
            self.expanded_nodes += 1
            depth = len(self._get_path(current))
            if depth > self.max_depth:
                self.max_depth = depth
            
            if self.expanded_nodes % 500 == 0:
                self._send_progress(current, len(self._get_path(current)))
            
            if current.is_goal():
                elapsed = time.time() - self.start_time
                print(f" Solution found in {elapsed:.2f}s, {self.expanded_nodes} nodes")
                
                self._send_progress(current, len(self._get_path(current)), is_complete=True)
                if self.branching_count > 0:
                    self.total_branching /= self.branching_count

                return self.extract_solution(current)
                
            self.visited[current] = current.g

            successors = self.generate_successors(current)
            if len(successors) > 0:
                self.total_branching += len(successors)
                self.branching_count += 1
            
            for successor in successors:
                tentative_g = current.g + 1
                
                if successor not in g_score or tentative_g < g_score[successor]:
                    successor.parent = current
                    successor.g = tentative_g
                    successor.h = self.heuristic(successor)
                    g_score[successor] = tentative_g
                    
                    if successor.h < self.best_heuristic:
                        self.best_heuristic = successor.h
                    
                    heapq.heappush(frontier, successor)
        if self.branching_count > 0:
            self.total_branching /= self.branching_count
        print(f" No solution found after {self.expanded_nodes} nodes")
        return None
        
    # def heuristic(self, state):
    #     state_hash = hash(state)
    #     if state_hash in self.heuristic_cache:
    #         return self.heuristic_cache[state_hash]
            
    #     n = self.puzzle.size
    #     unassigned = n * n - len(state.assignment)
        
    #     if unassigned == 0:
    #         return 0
            
    #     h1 = unassigned
        
    #     h2 = state.count_constraint_violations() * 0.5
        
    #     domains = state.compute_domains()
    #     if self.ac3(domains):
    #         min_remaining = sum(1 for d in domains.values() if len(d) == 0)
    #         if min_remaining > 0:
    #             h = float('inf')
    #         else:
    #             h = unassigned
    #     else:
    #         h = float('inf')
            
    #     result = max(h1, h2) if h != float('inf') else float('inf')
    #     self.heuristic_cache[state_hash] = result
    #     return result
        
    def heuristic(self, state):
        """Admissible heuristic với chứng minh lý thuyết"""
        state_hash = hash(state)
        if state_hash in self.heuristic_cache:
            return self.heuristic_cache[state_hash]
        
        if self.heuristic_type == 'unassigned':
            h = self._heuristic_unassigned(state)
        elif self.heuristic_type == 'chains':
            h = self._heuristic_chains(state)
        elif self.heuristic_type == 'ac3':
            h = self._heuristic_ac3(state)
        else:
            h1 = self._heuristic_unassigned(state)
            h2 = self._heuristic_chains(state)
            h3 = self._heuristic_ac3(state)
            h = max(h1, h2, h3)
        
        self.heuristic_cache[state_hash] = h
        return h
    
    def _heuristic_unassigned(self, state):

        return self.puzzle.size ** 2 - len(state.assignment)
    
    def _heuristic_chains(self, state):

        unsatisfied_chains = 0
        n = self.puzzle.size
        
        for i in range(n):
            chain_active = False
            for j in range(n-1):
                if self.puzzle.horizontal_constraints[i][j] != 0:
                    if not self._is_inequality_satisfied(state, (i+1, j+1), (i+1, j+2), 'horiz'):
                        chain_active = True
                else:
                    if chain_active:
                        unsatisfied_chains += 1
                        chain_active = False
            if chain_active:
                unsatisfied_chains += 1
        
        for j in range(n):
            chain_active = False
            for i in range(n-1):
                if self.puzzle.vertical_constraints[i][j] != 0:
                    if not self._is_inequality_satisfied(state, (i+1, j+1), (i+2, j+1), 'vert'):
                        chain_active = True
                else:
                    if chain_active:
                        unsatisfied_chains += 1
                        chain_active = False
            if chain_active:
                unsatisfied_chains += 1
        
        return unsatisfied_chains
    
    def _heuristic_ac3(self, state):
        domains = state.compute_domains()
        
        if not self.ac3(domains):
            return float('inf')
        
        forced_count = 0
        min_domain_sum = 0
        
        for cell, domain in domains.items():
            if cell not in state.assignment:
                if len(domain) == 0:
                    return float('inf')
                elif len(domain) == 1:
                    forced_count += 1
                min_domain_sum += 1 
        return forced_count
    
    def _is_inequality_satisfied(self, state, cell1, cell2, direction):
        if cell1 not in state.assignment or cell2 not in state.assignment:
            return False
        
        val1, val2 = state.assignment[cell1], state.assignment[cell2]
        
        if direction == 'horiz':
            constraint = self.puzzle.horizontal_constraints[cell1[0]-1][cell1[1]-1]
        else:
            constraint = self.puzzle.vertical_constraints[cell1[0]-1][cell1[1]-1]
        
        if constraint == 1:
            return val1 < val2
        elif constraint == -1:
            return val1 > val2
        return True
    def _get_path(self, state):
        path = []
        current = state
        while current.parent:
            path.append(current)
            current = current.parent
        return path[::-1]
        
    def _get_progress(self, current_heuristic):
        if self.start_heuristic == 0:
            return 100.0
            
        improvement = self.start_heuristic - current_heuristic
        max_possible = self.start_heuristic
        progress = (improvement / max_possible) * 100
        
        return max(0, min(99, progress))
        
    def _send_progress(self, current_state, depth, is_complete=False):
        if not self.socketio:
            return
            
        current_time = time.time()
        
        if not is_complete:
            time_diff = current_time - self.last_progress_time
            nodes_diff = self.expanded_nodes - self.last_sent_nodes
            
            if time_diff < self.progress_interval and nodes_diff < 1000:
                return
                
        current_heuristic = self.heuristic(current_state)
        progress = 100 if is_complete else self._get_progress(current_heuristic)
        
        elapsed = current_time - self.start_time if self.start_time else 1
        rate = self.expanded_nodes / elapsed if elapsed > 0 else 0
        
        filled_cells = len(current_state.assignment)
        total_cells = self.puzzle.size * self.puzzle.size
        
        try:
            self.socketio.emit('solver_progress', {
                'game_id': self.game_id,
                'solver': 'A* (Futoshiki)',
                'progress': round(progress, 1),
                'nodes_explored': self.expanded_nodes,
                'current_depth': depth,
                'best_heuristic': round(self.best_heuristic, 2),
                'current_heuristic': round(current_heuristic, 2),
                'filled_cells': f"{filled_cells}/{total_cells}",
                'exploration_rate': round(rate, 1),
                'estimated_remaining': self._estimate_remaining(rate, current_heuristic),
                'is_complete': is_complete
            })
            
            self.last_progress_time = current_time
            self.last_sent_nodes = self.expanded_nodes
            
        except Exception as e:
            print(f"Error sending progress: {e}")
            
    def _estimate_remaining(self, rate, current_heuristic):
        if rate <= 0 or current_heuristic == float('inf'):
            return "calculating..."
            
        estimated_nodes = current_heuristic * 50 
        estimated_seconds = estimated_nodes / rate
        
        if estimated_seconds < 60:
            return f"~{int(estimated_seconds)}s"
        elif estimated_seconds < 3600:
            return f"~{int(estimated_seconds/60)}m"
        else:
            return f"~{int(estimated_seconds/3600)}h"
            
    def ac3(self, domains):
        n = self.puzzle.size
        queue = deque()
        
        for i in range(1, n+1):
            for j in range(1, n+1):
                for j2 in range(1, n+1):
                    if j2 != j:
                        queue.append(((i, j), (i, j2), 'row'))
                for i2 in range(1, n+1):
                    if i2 != i:
                        queue.append(((i, j), (i2, j), 'col'))
                if j < n and self.puzzle.horizontal_constraints[i-1][j-1] != 0:
                    queue.append(((i, j), (i, j+1), 'horiz'))
                if j > 1 and self.puzzle.horizontal_constraints[i-1][j-2] != 0:
                    queue.append(((i, j), (i, j-1), 'horiz'))
                if i < n and self.puzzle.vertical_constraints[i-1][j-1] != 0:
                    queue.append(((i, j), (i+1, j), 'vert'))
                if i > 1 and self.puzzle.vertical_constraints[i-2][j-1] != 0:
                    queue.append(((i, j), (i-1, j), 'vert'))
                    
        while queue:
            (cell1, cell2, constraint_type) = queue.popleft()
            
            if self.revise(domains, cell1, cell2, constraint_type):
                if len(domains[cell1]) == 0:
                    return False
                    
                for neighbor in self._get_neighbors(cell1, cell2):
                    queue.append((neighbor, cell1, self._get_constraint_type(neighbor, cell1)))
                    
        return True
        
    def _get_neighbors(self, cell, exclude_cell):
        n = self.puzzle.size
        i, j = cell
        neighbors = []
        
        for j2 in range(1, n+1):
            if j2 != j and (i, j2) != exclude_cell:
                neighbors.append((i, j2))
        for i2 in range(1, n+1):
            if i2 != i and (i2, j) != exclude_cell:
                neighbors.append((i2, j))
        if j < n and (i, j+1) != exclude_cell:
            neighbors.append((i, j+1))
        if j > 1 and (i, j-1) != exclude_cell:
            neighbors.append((i, j-1))
        if i < n and (i+1, j) != exclude_cell:
            neighbors.append((i+1, j))
        if i > 1 and (i-1, j) != exclude_cell:
            neighbors.append((i-1, j))
            
        return neighbors
        
    def _get_constraint_type(self, cell1, cell2):
        i1, j1 = cell1
        i2, j2 = cell2
        
        if i1 == i2:
            if abs(j1 - j2) == 1:
                return 'horiz'
            return 'row'
        elif j1 == j2:
            if abs(i1 - i2) == 1:
                return 'vert'
            return 'col'
        return None
        
    def revise(self, domains, cell1, cell2, constraint_type):
        revised = False
        to_remove = []
        
        for v1 in domains[cell1]:
            found = False
            for v2 in domains[cell2]:
                if self.check_constraint(cell1, cell2, v1, v2, constraint_type):
                    found = True
                    break
            if not found:
                to_remove.append(v1)
                revised = True
                
        for v in to_remove:
            domains[cell1].remove(v)
            
        return revised
        
    def check_constraint(self, cell1, cell2, v1, v2, constraint_type):
        if constraint_type in ('row', 'col'):
            return v1 != v2
            
        i1, j1 = cell1
        i2, j2 = cell2
        
        if constraint_type == 'horiz':
            if j2 == j1 + 1:
                constraint = self.puzzle.horizontal_constraints[i1-1][j1-1]
                if constraint == 1:
                    return v1 < v2
                elif constraint == -1:
                    return v1 > v2
            else:
                constraint = self.puzzle.horizontal_constraints[i1-1][j2-1]
                if constraint == 1:
                    return v2 < v1
                elif constraint == -1:
                    return v2 > v1
                    
        elif constraint_type == 'vert':
            if i2 == i1 + 1:
                constraint = self.puzzle.vertical_constraints[i1-1][j1-1]
                if constraint == 1:
                    return v1 < v2
                elif constraint == -1:
                    return v1 > v2
            else:
                constraint = self.puzzle.vertical_constraints[i2-1][j1-1]
                if constraint == 1:
                    return v2 < v1
                elif constraint == -1:
                    return v2 > v1
                    
        return True
        
    def generate_successors(self, state):
        successors = []
        n = self.puzzle.size
        
        best_cell = None
        min_domain_size = float('inf')
        
        domains = state.compute_domains()
        
        for i in range(1, n+1):
            for j in range(1, n+1):
                if (i, j) not in state.assignment:
                    domain_size = len(domains[(i, j)])
                    if domain_size < min_domain_size:
                        min_domain_size = domain_size
                        best_cell = (i, j)
                        
        if not best_cell:
            return successors
            
        row, col = best_cell
        values = list(domains[best_cell])
        values.sort(key=lambda v: self._count_conflicts(state, row, col, v))
        
        for value in values:
            if state.is_valid_assignment(row, col, value):
                # Dùng apply_move của SolverState
                new_state = state.apply_move(row, col, value)
                successors.append(new_state)
                
        return successors      
    def _count_conflicts(self, state, i, j, v):
        conflicts = 0
        n = self.puzzle.size
        
        temp_assignment = deepcopy(state.assignment)
        temp_assignment[(i, j)] = v
        
        temp_state = SolverState(temp_assignment, self.puzzle)
        conflicts = temp_state.count_constraint_violations()
        
        return conflicts
        
    def extract_solution(self, state):
        return state.assignment
        
    def get_stats(self):
        elapsed = time.time() - self.start_time if self.start_time else 0
        avg_branching = self.total_branching / self.branching_count if self.branching_count > 0 else 0
        
        return {
            'expansions': self.expanded_nodes,
            'visited': len(self.visited),
            'time': elapsed,
            'max_depth': self.max_depth,
            'avg_branching': avg_branching,
            'best_heuristic': self.best_heuristic,
            'start_heuristic': self.start_heuristic if self.start_heuristic else 0,
            'memory_used': sys.getsizeof(self.visited) + sys.getsizeof(self.heuristic_cache)
        }