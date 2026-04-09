
class BaseState:
    def __init__(self, assignment, puzzle):
        self.assignment = assignment
        self.puzzle = puzzle
        
    def is_goal(self):
        if len(self.assignment) != self.puzzle.size * self.puzzle.size:
            return False
        return self.count_constraint_violations() == 0
        
    def count_constraint_violations(self):
        violations = 0
        n = self.puzzle.size
        
        for i in range(1, n+1):
            for j in range(1, n):
                if (i, j) in self.assignment and (i, j+1) in self.assignment:
                    constraint = self.puzzle.horizontal_constraints[i-1][j-1]
                    if constraint == 1:
                        if self.assignment[(i, j)] >= self.assignment[(i, j+1)]:
                            violations += 1
                    elif constraint == -1:
                        if self.assignment[(i, j)] <= self.assignment[(i, j+1)]:
                            violations += 1
                            
        for i in range(1, n):
            for j in range(1, n+1):
                if (i, j) in self.assignment and (i+1, j) in self.assignment:
                    constraint = self.puzzle.vertical_constraints[i-1][j-1]
                    if constraint == 1:
                        if self.assignment[(i, j)] >= self.assignment[(i+1, j)]:
                            violations += 1
                    elif constraint == -1:
                        if self.assignment[(i, j)] <= self.assignment[(i+1, j)]:
                            violations += 1
                            
        return violations