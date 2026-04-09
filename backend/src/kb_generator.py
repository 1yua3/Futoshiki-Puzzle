
class KnowledgeBaseGenerator:
    
    def __init__(self, size, puzzle=None):
        self.size = size
        self.puzzle = puzzle
        self.clauses = []
        
    def generate_all_clauses(self):
        self.clauses = []
        self.generate_cell_clauses()
        self.generate_row_clauses()
        self.generate_column_clauses()
        self.generate_horizontal_constraint_clauses()
        self.generate_vertical_constraint_clauses()
        self.generate_given_clauses()
        return self.clauses
    
    def generate_cell_clauses(self):
        for i in range(1, self.size+1):
            for j in range(1, self.size+1):
                clause = [f"Val({i},{j},{v})" for v in range(1, self.size+1)]
                self.clauses.append(clause)
                
                for v1 in range(1, self.size+1):
                    for v2 in range(v1+1, self.size+1):
                        clause = [f"¬Val({i},{j},{v1})", f"¬Val({i},{j},{v2})"]
                        self.clauses.append(clause)
                        
    def generate_row_clauses(self):
        for i in range(1, self.size+1):
            for v in range(1, self.size+1):
                clause = [f"Val({i},{j},{v})" for j in range(1, self.size+1)]
                self.clauses.append(clause)
                
                for j1 in range(1, self.size+1):
                    for j2 in range(j1+1, self.size+1):
                        clause = [f"¬Val({i},{j1},{v})", f"¬Val({i},{j2},{v})"]
                        self.clauses.append(clause)
                        
    def generate_column_clauses(self):
        for j in range(1, self.size+1):
            for v in range(1, self.size+1):
                clause = [f"Val({i},{j},{v})" for i in range(1, self.size+1)]
                self.clauses.append(clause)
                
                for i1 in range(1, self.size+1):
                    for i2 in range(i1+1, self.size+1):
                        clause = [f"¬Val({i1},{j},{v})", f"¬Val({i2},{j},{v})"]
                        self.clauses.append(clause)
                        
    def generate_horizontal_constraint_clauses(self):
        for i in range(1, self.size+1):
            for j in range(1, self.size):
                if self.puzzle:
                    h_type = self.puzzle.horizontal_constraints[i-1][j-1]
                    if h_type != 0:
                        self.clauses.append([f"LessH({i},{j})" if h_type == 1 else f"GreaterH({i},{j})"])

                for v1 in range(1, self.size+1):
                    for v2 in range(1, self.size+1):
                        if v1 >= v2:
                            clause = [f"¬LessH({i},{j})", f"¬Val({i},{j},{v1})", f"¬Val({i},{j+1},{v2})"]
                            self.clauses.append(clause)
                        if v1 <= v2:
                            clause = [f"¬GreaterH({i},{j})", f"¬Val({i},{j},{v1})", f"¬Val({i},{j+1},{v2})"]
                            self.clauses.append(clause)
                            
    def generate_vertical_constraint_clauses(self):
        for i in range(1, self.size):
            for j in range(1, self.size+1):
                if self.puzzle:
                    v_type = self.puzzle.vertical_constraints[i-1][j-1]
                    if v_type != 0:
                        self.clauses.append([f"LessV({i},{j})" if v_type == -1 else f"GreaterV({i},{j})"])

                for v1 in range(1, self.size+1):
                    for v2 in range(1, self.size+1):
                        if v1 >= v2:
                            clause = [f"¬LessV({i},{j})", f"¬Val({i},{j},{v1})", f"¬Val({i+1},{j},{v2})"]
                            self.clauses.append(clause)
                        if v1 <= v2:
                            clause = [f"¬GreaterV({i},{j})", f"¬Val({i},{j},{v1})", f"¬Val({i+1},{j},{v2})"]
                            self.clauses.append(clause)
                            
    def generate_given_clauses(self):
        if self.puzzle:
            for (i, j), val in self.puzzle.given_cells.items():
                self.clauses.append([f"Val({i},{j},{val})"])
                
    def to_string(self):
        return "\n".join([" ∨ ".join(c) for c in self.clauses])
