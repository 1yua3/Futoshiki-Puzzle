import random
from puzzle_reader import Puzzle
from solver_state import SolverState

class FutoshikiGenerator:
    def __init__(self, size):
        self.size = size
        
    def generate(self, clue_ratio=0.3, constraint_ratio=0.4):

        solution = self._generate_solution()
        if not solution:
            solution = [[((i + j) % self.size) + 1 for j in range(self.size)] for i in range(self.size)]
            random.shuffle(solution)
            solution = list(map(list, zip(*solution)))
            random.shuffle(solution)

        puzzle = Puzzle(self.size)
        
        for i in range(self.size):
            for j in range(self.size - 1):
                if random.random() < constraint_ratio:
                    if solution[i][j] < solution[i][j+1]:
                        puzzle.horizontal_constraints[i][j] = 1 # <
                    else:
                        puzzle.horizontal_constraints[i][j] = -1
                        
        for i in range(self.size - 1):
            for j in range(self.size):
                if random.random() < constraint_ratio:
                    if solution[i][j] < solution[i+1][j]:
                        puzzle.vertical_constraints[i][j] = -1 
                    else:
                        puzzle.vertical_constraints[i][j] = 1 
                        
        for i in range(self.size):
            for j in range(self.size):
                if random.random() < clue_ratio:
                    puzzle.grid[i][j] = solution[i][j]
                    puzzle.given_cells[(i+1, j+1)] = solution[i][j]
                    
        return puzzle

    def _generate_solution(self):
        grid = [[0 for _ in range(self.size)] for _ in range(self.size)]
        
        def is_valid(r, c, val):
            for j in range(self.size):
                if grid[r][j] == val: return False
            for i in range(self.size):
                if grid[i][c] == val: return False
            return True

        def backtrack(r, c):
            if r == self.size: return True
            
            next_r, next_c = (r, c + 1) if c < self.size - 1 else (r + 1, 0)
            
            nums = list(range(1, self.size + 1))
            random.shuffle(nums)
            
            for v in nums:
                if is_valid(r, c, v):
                    grid[r][c] = v
                    if backtrack(next_r, next_c):
                        return True
                    grid[r][c] = 0
            return False

        if backtrack(0, 0):
            return grid
        return None

if __name__ == "__main__":
    gen = FutoshikiGenerator(4)
    p = gen.generate()
    p.print_grid()
