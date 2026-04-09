
from gamestate import BaseState
from copy import deepcopy

class SolverState(BaseState):
    def __init__(self, assignment, puzzle, g=0, h=0, parent=None):
        super().__init__(assignment, puzzle)
        self.g = g
        self.h = h
        self.parent = parent
        self._hash = None
        
    def __lt__(self, other):
        return (self.g + self.h) < (other.g + other.h)
        
    def __eq__(self, other):
        return self.assignment == other.assignment
        
    def __hash__(self):
        if self._hash is None:
            self._hash = hash(frozenset(self.assignment.items()))
        return self._hash
        
    def apply_move(self, row, col, value):
        new_assignment = self.assignment.copy()
        new_assignment[(row, col)] = value
        return SolverState(new_assignment, self.puzzle)
        
    def is_valid_assignment(self, i, j, v):
        n = self.puzzle.size
        
        for j2 in range(1, n+1):
            if j2 != j and (i, j2) in self.assignment:
                if self.assignment[(i, j2)] == v:
                    return False
                    
        for i2 in range(1, n+1):
            if i2 != i and (i2, j) in self.assignment:
                if self.assignment[(i2, j)] == v:
                    return False
                    
        if j > 1 and (i, j-1) in self.assignment:
            constraint = self.puzzle.horizontal_constraints[i-1][j-2]
            if constraint == 1 and self.assignment[(i, j-1)] >= v:
                return False
            if constraint == -1 and self.assignment[(i, j-1)] <= v:
                return False
                
        if j < n and (i, j+1) in self.assignment:
            constraint = self.puzzle.horizontal_constraints[i-1][j-1]
            if constraint == 1 and v >= self.assignment[(i, j+1)]:
                return False
            if constraint == -1 and v <= self.assignment[(i, j+1)]:
                return False
                
        if i > 1 and (i-1, j) in self.assignment:
            constraint = self.puzzle.vertical_constraints[i-2][j-1]
            if constraint == 1 and self.assignment[(i-1, j)] >= v:
                return False
            if constraint == -1 and self.assignment[(i-1, j)] <= v:
                return False
                
        if i < n and (i+1, j) in self.assignment:
            constraint = self.puzzle.vertical_constraints[i-1][j-1]
            if constraint == 1 and v >= self.assignment[(i+1, j)]:
                return False
            if constraint == -1 and v <= self.assignment[(i+1, j)]:
                return False
                
        return True
        
    def compute_domains(self):
        n = self.puzzle.size
        domains = {}
        
        for i in range(1, n+1):
            for j in range(1, n+1):
                if (i, j) in self.assignment:
                    domains[(i, j)] = {self.assignment[(i, j)]}
                else:
                    domains[(i, j)] = set(range(1, n+1))
                    
        return domains