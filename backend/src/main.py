from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_socketio import SocketIO, emit
import os
import random
import glob
import sys
import threading
import time

current_dir = os.path.dirname(__file__)
backend_dir = os.path.dirname(current_dir)
sys.path.append(current_dir)

from puzzle_reader import PuzzleReader, Puzzle
from gamestate import BaseState
from solver_state import SolverState
from game_state import GameState
from astar_solver import AStarSolver
from forward_chaining import ForwardChainingSolver
from backward_chaining import BackwardChainingSolver
from backtracking_solver import BacktrackingSolver
from kb_generator import KnowledgeBaseGenerator
from puzzle_generator import FutoshikiGenerator

app = Flask(__name__)
CORS(app, supports_credentials=True)
socketio = SocketIO(app, cors_allowed_origins="*")

active_solvers = {}

def create_puzzle_from_request(data):
    size = data.get('size', 4)
    grid = data.get('grid', [])
    original_grid = data.get('originalGrid')
    h_c = data.get('horizontalConstraints', [])
    v_c = data.get('verticalConstraints', [])
    
    puzzle = Puzzle(size)
    puzzle.horizontal_constraints = h_c
    puzzle.vertical_constraints = v_c
    
    grid_for_fixed = original_grid if original_grid else grid
    
    for i in range(size):
        for j in range(size):
            val = grid[i][j] if i < len(grid) and j < len(grid[i]) else 0
            puzzle.grid[i][j] = val
            
            fixed_val = grid_for_fixed[i][j] if i < len(grid_for_fixed) and j < len(grid_for_fixed[i]) else 0
            if fixed_val != 0:
                puzzle.given_cells[(i+1, j+1)] = fixed_val
                
    return puzzle

@app.route('/api/puzzle/solve', methods=['POST'])
def solve_puzzle():
    try:
        data = request.json
        algorithm = data.get('algorithm', 'astar')
        heuristic_type = data.get('heuristic', 'combined')
        puzzle = create_puzzle_from_request(data)
        puzzle_id = data.get('id')
        
        if puzzle_id in active_solvers:
            active_solvers[puzzle_id].cancelled = True
            print(f" Cancelling previous {algorithm} for puzzle {puzzle_id}")
            time.sleep(0.1)

        def solve_in_background():
            solver = None
            try:
                if algorithm == 'astar':
                    solver = AStarSolver(puzzle, socketio=socketio, game_id=puzzle_id, heuristic_type=heuristic_type)
                elif algorithm == 'backtracking':
                    solver = BacktrackingSolver(puzzle)
                elif algorithm == 'forward':
                    solver = ForwardChainingSolver(puzzle)
                elif algorithm == 'backward':
                    solver = BackwardChainingSolver(puzzle)
                else:
                    solver = AStarSolver(puzzle, socketio=socketio, game_id=puzzle_id, heuristic_type=heuristic_type)
                
                solver.game_id = puzzle_id
                solver.socketio = socketio
                solver.cancelled = False
                
                active_solvers[puzzle_id] = solver
                
                print(f" Starting {algorithm} solver for puzzle {puzzle_id}")
                
                if algorithm == 'astar':
                    solution_dict = solver.solve(node_limit=1000000, max_time=300)
                else:
                    solution_dict = solver.solve()
                
                if solution_dict and not solver.cancelled:
                    size = data.get('size', 4)
                    solution_grid = [[0 for _ in range(size)] for _ in range(size)]
                    for (i, j), val in solution_dict.items():
                        solution_grid[i-1][j-1] = val
                    
                    if puzzle_id:
                        outputs_dir = os.path.join(backend_dir, 'src', 'outputs')
                        os.makedirs(outputs_dir, exist_ok=True)
                        output_file = os.path.join(outputs_dir, f'output-{puzzle_id}.txt')
                        with open(output_file, 'w', encoding='utf-8') as f:
                            f.write(f"{size}\n")
                            for row in solution_grid:
                                f.write(','.join(str(cell) for cell in row) + '\n')
                    
                    stats = solver.get_stats() if hasattr(solver, 'get_stats') else {}
                    nodes_explored = stats.get('expansions', stats.get('nodes_explored', stats.get('inferences', 0)))
                    elapsed_time = stats.get('time', time.time() - solver.start_time if hasattr(solver, 'start_time') else 0)
                    visited_nodes = stats.get('visited', len(solver.visited) if hasattr(solver, 'visited') else 0)
                    best_heuristic = getattr(solver, 'best_heuristic', 0)
                    start_heuristic = getattr(solver, 'start_heuristic', 0)
                    max_depth = stats.get('max_depth', 0)
                    avg_branching = stats.get('avg_branching', 0)
                    socketio.emit('solver_complete', {
                        'puzzle_id': puzzle_id,
                        'solver': algorithm,
                        'success': True,
                        'solution': solution_grid,
                        'results': {
                            'nodes_explored': nodes_explored,
                            'visited_nodes': visited_nodes,
                            'time_taken': round(elapsed_time, 3),
                            'solution_found': True,
                            'solution_length': len(solution_dict),
                            'best_heuristic': round(best_heuristic, 2),
                            'start_heuristic': round(start_heuristic, 2),
                            'max_depth': max_depth,
                            'avg_branching': round(avg_branching, 2),
                            'memory_used': stats.get('memory_used', 0),
                            'puzzle_size': size,
                            'given_cells': len(puzzle.given_cells),
                        }
                    })
                elif solver.cancelled:
                    socketio.emit('solver_cancelled', {
                        'puzzle_id': puzzle_id,
                        'solver': algorithm
                    })
                else:
                    socketio.emit('solver_complete', {
                        'puzzle_id': puzzle_id,
                        'solver': algorithm,
                        'success': False,
                        'results': {
                            'solution_found': False
                        }
                    })
                    
            except Exception as e:
                import traceback
                error_msg = str(e)
                print(f" Solver Crash for puzzle {puzzle_id}: {error_msg}")
                traceback.print_exc()
                
                size = data.get('size', 4)
                stats = solver.get_stats() if solver and hasattr(solver, 'get_stats') else {}
                nodes_explored = stats.get('expansions', stats.get('nodes_explored', stats.get('inferences', 0)))
                elapsed_time = stats.get('time', time.time() - solver.start_time if solver and hasattr(solver, 'start_time') else 0)
                visited_nodes = stats.get('visited', len(solver.visited) if solver and hasattr(solver, 'visited') else 0)
                best_heuristic = getattr(solver, 'best_heuristic', 0) if solver else 0
                start_heuristic = getattr(solver, 'start_heuristic', 0) if solver else 0
                max_depth = stats.get('max_depth', 0)
                avg_branching = stats.get('avg_branching', 0)
                
                socketio.emit('solver_error', {
                    'puzzle_id': puzzle_id,
                    'solver': algorithm,
                    'success': False,
                    'error': error_msg,
                    'results': {
                        'nodes_explored': nodes_explored,
                        'visited_nodes': visited_nodes,
                        'time_taken': round(elapsed_time, 3),
                        'solution_found': False,
                        'solution_length': 0,
                        'best_heuristic': round(best_heuristic, 2),
                        'start_heuristic': round(start_heuristic, 2),
                        'max_depth': max_depth,
                        'avg_branching': round(avg_branching, 2),
                        'memory_used': stats.get('memory_used', 0),
                        'puzzle_size': size,
                        'given_cells': len(puzzle.given_cells) if puzzle else 0,
                    }
                })
            finally:
                if puzzle_id in active_solvers and active_solvers.get(puzzle_id) == solver:
                    del active_solvers[puzzle_id]
                print(f" Solver finished for puzzle {puzzle_id}")

        thread = threading.Thread(target=solve_in_background)
        thread.daemon = True
        thread.start()
        
        return jsonify({
            'success': True, 
            'message': f'Solver {algorithm} started for puzzle {puzzle_id}'
        })
        
    except Exception as e:
        import traceback
        error_msg = str(e)
        traceback.print_exc()
        
        return jsonify({
            'success': False,
            'error': error_msg,
            'results': {
                'nodes_explored': 0,
                'visited_nodes': 0,
                'time_taken': 0,
                'solution_found': False,
                'solution_length': 0,
                'best_heuristic': 0,
                'start_heuristic': 0,
                'max_depth': 0,
                'avg_branching': 0,
                'memory_used': 0,
                'puzzle_size': data.get('size', 4) if data else 4,
                'given_cells': 0
            }
        }), 500

@app.route('/api/puzzle/validate-move', methods=['POST'])
def validate_move():
    try:
        data = request.json
        row = data.get('row')
        col = data.get('col')
        value = data.get('value')
        
        if value == 0:
             return jsonify({'valid': True})

        puzzle = create_puzzle_from_request(data)
        
        state = SolverState({}, puzzle)
        for (i, j), val in puzzle.given_cells.items():
            state.assignment[(i, j)] = val
            
        for i in range(puzzle.size):
            for j in range(puzzle.size):
                if data['grid'][i][j] != 0 and (i, j) != (row, col):
                    state.assignment[(i+1, j+1)] = data['grid'][i][j]
                    
        valid = state.is_valid_assignment(row+1, col+1, value)
        if not valid:
             return jsonify({'valid': False, 'error': 'Nước đi vi phạm quy tắc / ràng buộc!'})
        return jsonify({'valid': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/puzzle/move', methods=['POST'])
def handle_manual_move():
    try:
        data = request.json
        row = data.get('row')
        col = data.get('col')
        value = data.get('value')
        size = data.get('size', 4)
        
        puzzle = create_puzzle_from_request(data)
        
        if (row + 1, col + 1) in puzzle.given_cells:
            return jsonify({
                'valid': False,
                'error': 'Không thể sửa ô dữ liệu cố định của đề bài!'
            }), 400

        if value == 0:
            return jsonify({
                'valid': True,
                'isComplete': False,
                'isSolved': False
            })

        state = SolverState({}, puzzle)
        for i in range(size):
            for j in range(size):
                if data['grid'][i][j] != 0 and (i, j) != (row, col):
                    state.assignment[(i + 1, j + 1)] = data['grid'][i][j]
        
        valid = state.is_valid_assignment(row + 1, col + 1, value)
        
        if not valid:
            return jsonify({
                'valid': False,
                'error': 'Nước đi không hợp lệ (trùng hàng/cột hoặc vi phạm ràng buộc)'
            })
            
        state.assignment[(row + 1, col + 1)] = value
        is_complete = len(state.assignment) == size * size
        is_solved = is_complete and state.is_goal()
        
        return jsonify({
            'valid': True,
            'isComplete': is_complete,
            'isSolved': is_solved
        })
        
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/puzzle/validate-complete', methods=['POST'])
def validate_complete():
    try:
        data = request.json
        puzzle = create_puzzle_from_request(data)
        
        state = BaseState({}, puzzle)
        for i in range(puzzle.size):
            for j in range(puzzle.size):
                state.assignment[(i+1, j+1)] = data['grid'][i][j]
                
        is_complete = state.is_goal()
        return jsonify({'valid': is_complete, 'error': '' if is_complete else 'Bảng chưa đúng hoặc chưa hoàn thành'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/puzzle/list/<int:size>', methods=['GET'])
def get_puzzles(size):
    try:
        puzzles = []
        inputs_dir = os.path.join(backend_dir, 'src', 'Inputs')
        for file in glob.glob(os.path.join(inputs_dir, 'input-*.txt')):
            if not file.endswith('_output.txt'):
                try:
                    reader = PuzzleReader()
                    p = reader.read(file)
                    if p.size == size:
                        puzzles.append({
                            'id': os.path.basename(file).split('-')[1].split('.')[0],
                            'size': p.size,
                            'grid': p.grid,
                            'horizontalConstraints': p.horizontal_constraints,
                            'verticalConstraints': p.vertical_constraints
                        })
                except Exception as e:
                    print(f" Skipping corrupted file {file}: {e}")
        return jsonify({'puzzles': puzzles})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/puzzle/<id>', methods=['GET'])
def get_puzzle(id):
    try:
        inputs_dir = os.path.join(backend_dir, 'src', 'Inputs')
        file = os.path.join(inputs_dir, f'input-{id}.txt')
        if os.path.exists(file):
            reader = PuzzleReader()
            p = reader.read(file)
            return jsonify({
                'puzzle': {
                    'id': id,
                    'size': p.size,
                    'grid': p.grid,
                    'horizontalConstraints': p.horizontal_constraints,
                    'verticalConstraints': p.vertical_constraints
                }
            })
        return jsonify({'error': 'Không tìm thấy puzzle'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/puzzle/random', methods=['POST'])
def random_puzzle():
    try:
        data = request.json
        size = data.get('size', 4)
        inputs_dir = os.path.join(backend_dir, 'src', 'input')
        candidates = []
        for file in glob.glob(os.path.join(inputs_dir, 'input-*.txt')):
            if not file.endswith('_output.txt'):
                reader = PuzzleReader()
                try:
                    p = reader.read(file)
                    if p.size == size:
                        candidates.append({
                            'id': os.path.basename(file).split('-')[1].split('.')[0],
                            'size': p.size,
                            'grid': p.grid,
                            'horizontalConstraints': p.horizontal_constraints,
                            'verticalConstraints': p.vertical_constraints
                        })
                except:
                    pass
        
        if not candidates:
            return jsonify({'error': f'Không có puzzle nào cỡ {size} trong thư mục Inputs'}), 404
            
        pInfo = random.choice(candidates)
        return jsonify({'puzzle': pInfo})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/puzzle/generate-random', methods=['POST'])
def generate_random_puzzle():
    try:
        data = request.json
        size = int(data.get('size', 4))
        
        generator = FutoshikiGenerator(size)
        puzzle = generator.generate()
        
        inputs_dir = os.path.join(backend_dir, 'src', 'Inputs')
        os.makedirs(inputs_dir, exist_ok=True)
        
        puzzle_id = f"gen_{int(time.time())}"
        file_path = os.path.join(inputs_dir, f'input-{puzzle_id}.txt')
        
        with open(file_path, 'w') as f:
            f.write(f"{size}\n")
            for i in range(size):
                f.write(",".join(map(str, puzzle.grid[i])) + "\n")
            for i in range(size):
                f.write(",".join(map(str, puzzle.horizontal_constraints[i])) + "\n")
            for i in range(size-1):
                f.write(",".join(map(str, puzzle.vertical_constraints[i])) + "\n")
        
        return jsonify({
            'puzzle': {
                'id': puzzle_id,
                'size': puzzle.size,
                'grid': puzzle.grid,
                'horizontalConstraints': puzzle.horizontal_constraints,
                'verticalConstraints': puzzle.vertical_constraints
            }
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/api/kb/generate', methods=['POST'])
def generate_kb():
    try:
        data = request.json
        size = int(data.get('size', 4))
        puzzle_id = data.get('puzzleId')
        
        puzzle = None
        if puzzle_id:
            inputs_dir = os.path.join(backend_dir, 'src', 'Inputs')
            file = os.path.join(inputs_dir, f'input-{puzzle_id}.txt')
            if os.path.exists(file):
                reader = PuzzleReader()
                puzzle = reader.read(file)
        
        generator = KnowledgeBaseGenerator(size, puzzle)
        clauses = generator.generate_all_clauses()
        
        formatted_clauses = [" ∨ ".join(c) for c in clauses]
        
        return jsonify({
            'size': size,
            'puzzle_id': puzzle_id,
            'clause_count': len(clauses),
            'clauses': formatted_clauses
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@socketio.on('cancel_solver')
def handle_cancel(data):
    puzzle_id = data.get('puzzle_id')
    if puzzle_id in active_solvers:
        active_solvers[puzzle_id].cancelled = True
        print(f" Received cancel request from client for puzzle {puzzle_id}")
    else:
        print(f" Received cancel but puzzle {puzzle_id} not running")

if __name__ == '__main__':
    socketio.run(app, debug=True, port=5000, allow_unsafe_werkzeug=True)