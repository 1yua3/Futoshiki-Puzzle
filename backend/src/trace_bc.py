import sys, os, time
# Ensure we can import from the current directory
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from puzzle_reader import PuzzleReader
from backward_chaining import BackwardChainingSolver

def trace_solve():
    print("Loading puzzle...", flush=True)
    try:
        p = PuzzleReader().read(os.path.join(os.path.dirname(__file__), "Inputs", "input-01.txt"))
    except Exception as e:
        print(f"Error loading puzzle: {e}", flush=True)
        return
        
    print(f"Puzzle size: {p.size}", flush=True)
    
    solver = BackwardChainingSolver(p)
    solver.start_time = time.time()
    
    print("Initializing KB...", flush=True)
    solver._initialize_kb()
    print("KB initialized.", flush=True)
    
    # Override _send_progress to print to console
    def print_progress(is_initial=False, is_complete=False):
        if is_initial: return
        print(f"| Progress: {len(solver.solution)} cells filled, inf: {solver.inferences}, bt: {solver.backtracks} |", flush=True)
    
    solver._send_progress = print_progress
    solver.progress_interval = 0.1 # Very frequent for debugging
    
    print("Starting solve...", flush=True)
    t0 = time.time()
    result = solver.solve(max_time=30)
    t1 = time.time()
    
    if result:
        print(f"SUCCESS: Solution found in {t1-t0:.3f}s!", flush=True)
    else:
        print(f"FAILURE: No solution found in {t1-t0:.3f}s.", flush=True)
        # Check why it failed - look at initial domains
        empty_cells = [ (i, j) for i in range(1, p.size + 1) for j in range(1, p.size + 1) if (i, j) not in p.given_cells ]
        domains = solver._compute_domains(empty_cells)
        print(f"Initial domains for empty cells: {domains}", flush=True)
        print(f"Stats: {solver.get_stats()}", flush=True)

if __name__ == "__main__":
    trace_solve()
