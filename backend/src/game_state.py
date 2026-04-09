
from gamestate import BaseState
from copy import deepcopy

class GameState(BaseState):
    def __init__(self, assignment, puzzle):
        super().__init__(assignment, puzzle)
        self.history = []
        self.future = []
        self.selected_cell = None
        self.invalid_cells = set()
        self.constraint_status = {}
        
    def apply_move(self, row, col, value):
        old_value = self.assignment.get((row, col), 0)
        
        self.history.append({
            'row': row,
            'col': col,
            'old_value': old_value,
            'new_value': value
        })
        self.future = [] 
        
        if value == 0:
            if (row, col) in self.assignment:
                del self.assignment[(row, col)]
        else:
            self.assignment[(row, col)] = value
            
        self._update_validation(row, col)
        
        return True
        
    def undo(self):
        if not self.history:
            return False
            
        move = self.history.pop()
        self.future.append(move)
        
        if move['old_value'] == 0:
            if (move['row'], move['col']) in self.assignment:
                del self.assignment[(move['row'], move['col'])]
        else:
            self.assignment[(move['row'], move['col'])] = move['old_value']
            
        self._update_validation(move['row'], move['col'])
        return True
        
    def redo(self):
        if not self.future:
            return False
            
        move = self.future.pop()
        self.history.append(move)
        
        if move['new_value'] == 0:
            if (move['row'], move['col']) in self.assignment:
                del self.assignment[(move['row'], move['col'])]
        else:
            self.assignment[(move['row'], move['col'])] = move['new_value']
            
        self._update_validation(move['row'], move['col'])
        return True
        
    def _update_validation(self, row, col):
        n = self.puzzle.size
        
        self.invalid_cells = {cell for cell in self.invalid_cells 
                             if cell[0] != row and cell[1] != col}
        
        row_values = {}
        for j in range(1, n+1):
            if (row, j) in self.assignment:
                val = self.assignment[(row, j)]
                if val in row_values:
                    self.invalid_cells.add((row, j))
                    self.invalid_cells.add(row_values[val])
                else:
                    row_values[val] = (row, j)
                    
        col_values = {}
        for i in range(1, n+1):
            if (i, col) in self.assignment:
                val = self.assignment[(i, col)]
                if val in col_values:
                    self.invalid_cells.add((i, col))
                    self.invalid_cells.add(col_values[val])
                else:
                    col_values[val] = (i, col)
                    
        self._update_constraint_status()
        
    def _update_constraint_status(self):
        n = self.puzzle.size
        self.constraint_status = {}
        
        for i in range(1, n+1):
            for j in range(1, n):
                if (i, j) in self.assignment and (i, j+1) in self.assignment:
                    v1 = self.assignment[(i, j)]
                    v2 = self.assignment[(i, j+1)]
                    constraint = self.puzzle.horizontal_constraints[i-1][j-1]
                    
                    if constraint == 1:
                        self.constraint_status[(i, j, 'h')] = v1 < v2
                    elif constraint == -1:
                        self.constraint_status[(i, j, 'h')] = v1 > v2
                        
        for i in range(1, n):
            for j in range(1, n+1):
                if (i, j) in self.assignment and (i+1, j) in self.assignment:
                    v1 = self.assignment[(i, j)]
                    v2 = self.assignment[(i+1, j)]
                    constraint = self.puzzle.vertical_constraints[i-1][j-1]
                    
                    if constraint == 1:
                        self.constraint_status[(i, j, 'v')] = v1 < v2
                    elif constraint == -1:
                        self.constraint_status[(i, j, 'v')] = v1 > v2
                        
    def is_cell_valid(self, row, col):
        return (row, col) not in self.invalid_cells
        
    def get_invalid_reason(self, row, col):
        if (row, col) not in self.assignment:
            return None
            
        value = self.assignment[(row, col)]
        n = self.puzzle.size
        
        for j in range(1, n+1):
            if j != col and (row, j) in self.assignment:
                if self.assignment[(row, j)] == value:
                    return f"Duplicate {value} in row {row}"
                    
        for i in range(1, n+1):
            if i != row and (i, col) in self.assignment:
                if self.assignment[(i, col)] == value:
                    return f"Duplicate {value} in column {col}"
                    
        return None
        
    def reset(self):
        self.assignment = {}
        self.history = []
        self.future = []
        self.invalid_cells = set()
        self.constraint_status = {}
        
        for (i, j), val in self.puzzle.given_cells.items():
            self.assignment[(i, j)] = val