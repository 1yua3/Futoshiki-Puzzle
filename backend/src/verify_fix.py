import sys, os, time
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from backward_chaining import BackwardChainingSolver

class TinyPuzzle:
    size = 3
    given_cells = {(1, 1): 1}
    horizontal_constraints = [[0, 0], [0, 0], [0, 0]]
    vertical_constraints   = [[0, 0, 0], [0, 0, 0]]

def verify():
    with open("verification_results.txt", "w") as f:
        f.write("Running tiny test...\n")
        s = BackwardChainingSolver(TinyPuzzle())
        t0 = time.time()
        sol = s.solve(max_time=10)
        t1 = time.time()
        f.write(f"Time: {t1-t0:.3f}s\n")
        f.write(f"Solution: {sol}\n")
        
        # Check if correct (at least one cell from solution)
        if sol and (1, 2) in sol:
            f.write("Verification SUCCESS\n")
        else:
            f.write("Verification FAILURE\n")

if __name__ == "__main__":
    verify()
