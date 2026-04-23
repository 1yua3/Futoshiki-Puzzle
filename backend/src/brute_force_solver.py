from base_solver import BaseSolver
from solver_state import SolverState
import time
import sys


class BruteForceSolver(BaseSolver):
    """
    Brute Force Solver
    """

    def __init__(self, puzzle, socketio=None, game_id=None):
        super().__init__(puzzle, socketio, game_id)
        self.backtracks = 0
        self.solution_found = False
        self.max_depth = 0
        self.total_branches = 0
        self.branchings = 0

    def solve(self, max_time=300):
        self.reset_stats()
        self.backtracks = 0
        self.solution_found = False
        self.max_depth = 0
        self.total_branches = 0
        self.branchings = 0

        self.start_time = time.time()
        self.last_progress_time = self.start_time

        # Khởi tạo state
        initial_state = SolverState({}, self.puzzle)
        for (i, j), val in self.puzzle.given_cells.items():
            initial_state.assignment[(i, j)] = val

        self._send_progress(state=initial_state, is_initial=True)

        result_state = self._brute_force(initial_state, max_time)

        if result_state:
            self.solution_found = True
            elapsed = time.time() - self.start_time
            print(f"[BruteForce] Solution found in {elapsed:.2f}s, "
                  f"{self.expanded_nodes} nodes, {self.backtracks} backtracks")
            self._send_progress(state=result_state, is_complete=True)
            return result_state.assignment

        print(f"[BruteForce] No solution found after {self.expanded_nodes} nodes")
        return None

    def get_stats(self):
        elapsed = time.time() - self.start_time if self.start_time else 0
        avg_branching = self.total_branches / self.branchings if self.branchings > 0 else 0

        return {
            'nodes_explored': self.expanded_nodes,
            'visited': self.expanded_nodes,
            'backtracks': self.backtracks,
            'max_depth': self.max_depth,
            'time': elapsed,
            'solution_found': self.solution_found,
            'avg_branching': avg_branching,
            'memory_used': sys.getsizeof(self) + (self.max_depth * 512),
        }

    def _brute_force(self, state, max_time):
        # Kiểm tra timeout và cancel
        if time.time() - self.start_time > max_time:
            return None
        if self.cancelled:
            return None

        self.expanded_nodes += 1

        # Cập nhật độ sâu tối đa
        current_depth = len(state.assignment)
        if current_depth > self.max_depth:
            self.max_depth = current_depth

        # Gửi tiến trình
        if self.expanded_nodes % 1000 == 0:
            self._send_progress(state=state)

        if state.is_goal():
            return state

        # chọn ô tiếp theo theo thứ tự tuần tự
        cell = self._select_next_cell(state)
        if not cell:
            # tất cả ô đã điền nhưng không thỏa mãn ràng buộc
            return None

        i, j = cell
        n = self.puzzle.size
        self.branchings += 1

        # thử các giá trị từ 1 - N theo thứ tự
        for v in range(1, n + 1):
            if state.is_valid_assignment(i, j, v):
                new_state = state.apply_move(i, j, v)
                self.total_branches += 1

                result = self._brute_force(new_state, max_time)
                if result:
                    return result

                # Quay lui — không tìm được lời giải với nhánh này
                self.backtracks += 1

        return None

    def _select_next_cell(self, state):
        """
        Chọn ô chưa gán tiếp theo theo thứ tự row
        """
        n = self.puzzle.size
        for i in range(1, n + 1):
            for j in range(1, n + 1):
                if (i, j) not in state.assignment:
                    return (i, j)
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
                'solver': 'Brute Force',
                'progress': round(progress, 1),
                'nodes_explored': self.expanded_nodes,
                'backtracks': self.backtracks,
                'filled_cells': f"{filled_cells}/{total_cells}",
                'current_depth': filled_cells,
                'max_depth': self.max_depth,
                'exploration_rate': round(rate, 1),
                'estimated_remaining': self._estimate_remaining(rate, filled_cells, total_cells),
                'is_complete': is_complete,
            })

            self.last_progress_time = current_time
            self.last_sent_nodes = self.expanded_nodes

        except Exception as e:
            print(f"[BruteForce] Error sending progress: {e}")

    def _estimate_remaining(self, rate, filled_cells, total_cells):
        if rate <= 0 or filled_cells >= total_cells:
            return "calculating..."

        remaining_cells = total_cells - filled_cells
        
        estimated_nodes = remaining_cells * (self.puzzle.size ** 2)
        estimated_seconds = estimated_nodes / rate if rate > 0 else 60

        if estimated_seconds < 60:
            return f"~{int(estimated_seconds)}s"
        elif estimated_seconds < 3600:
            return f"~{int(estimated_seconds / 60)}m"
        else:
            return f"~{int(estimated_seconds / 3600)}h"
