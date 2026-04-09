
class Puzzle:
    def __init__(self, size):
        self.size = size
        self.grid = [[0]*size for _ in range(size)]
        self.horizontal_constraints = [[0]*(size-1) for _ in range(size)]
        self.vertical_constraints = [[0]*size for _ in range(size-1)]
        self.given_cells = {}
        
    def print_grid(self):
        for i in range(self.size):
            row = []
            for j in range(self.size):
                val = self.grid[i][j]
                row.append(str(val) if val != 0 else '.')
                if j < self.size-1:
                    if self.horizontal_constraints[i][j] == 1:
                        row.append('<')
                    elif self.horizontal_constraints[i][j] == -1:
                        row.append('>')
                    else:
                        row.append(' ')
            print(' '.join(row))
            
            if i < self.size-1:
                vert_row = []
                for j in range(self.size):
                    if self.vertical_constraints[i][j] == 1:
                        vert_row.append('v')
                    elif self.vertical_constraints[i][j] == -1:
                        vert_row.append('^')
                    else:
                        vert_row.append(' ')
                    if j < self.size-1:
                        vert_row.append(' ')
                print(' '.join(vert_row))

class PuzzleReader:
    def read(self, filename):
        with open(filename, 'r') as f:
            lines = [line.strip() for line in f.readlines() if line.strip()]
            
        size = int(lines[0])
        puzzle = Puzzle(size)
        
        idx = 1
        for i in range(size):
            row = lines[idx].split(',')
            for j in range(size):
                val = int(row[j].strip())
                puzzle.grid[i][j] = val
                if val != 0:
                    puzzle.given_cells[(i+1, j+1)] = val
            idx += 1
            
        for i in range(size):
            constraints = lines[idx].split(',')
            for j in range(size-1):
                puzzle.horizontal_constraints[i][j] = int(constraints[j].strip())
            idx += 1
            
        for i in range(size-1):
            constraints = lines[idx].split(',')
            for j in range(size):
                puzzle.vertical_constraints[i][j] = int(constraints[j].strip())
            idx += 1
            
        return puzzle