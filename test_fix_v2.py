import os
import sys

# Redirection at the VERY TOP
with open("test_results.txt", "w") as f:
    class Logger:
        def __init__(self, *files): self.files = files
        def write(self, obj):
            for f in self.files: f.write(obj); f.flush()
        def flush(self):
            for f in self.files: f.flush()
    sys.stdout = Logger(sys.stdout, f)
    sys.stderr = sys.stdout

    print("--- TEST START ---", flush=True)
    
    try:
        # Add src to path
        sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), 'backend/src')))

        from puzzle_reader import Puzzle
        from backward_chaining import BackwardChainingSolver

        def test_minimal():
            # 4x4 blank puzzle
            p = Puzzle(4)
            solver = BackwardChainingSolver(p)
            
            print("Testing 4x4 Blank Puzzle...", flush=True)
            res = solver.solve(max_time=15)
            if res:
                print("SUCCESS", flush=True)
            else:
                print("FAILURE - 4x4 Blank failed", flush=True)

        def test_single_ineq():
            # 4x4 with 1 < 2 at (1, 1) and (1, 2)
            p = Puzzle(4)
            p.horizontal_constraints[0][0] = 1
            solver = BackwardChainingSolver(p)
            
            print("Testing 4x4 with 1 < 2 at (1,1)-(1,2)...", flush=True)
            res = solver.solve(max_time=15)
            if res:
                print("SUCCESS", flush=True)
            else:
                print("FAILURE - 4x4 single ineq failed", flush=True)

        test_minimal()
        test_single_ineq()
        
    except Exception as e:
        print(f"CRASH: {e}", flush=True)
        import traceback
        traceback.print_exc()

    print("--- TEST END ---", flush=True)
