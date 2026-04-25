"""
Backward Chaining Solver for Futoshiki — TRUE HYBRID (CSP Pre-filter + Pure SLD Proof)
=========================================================================================
Architecture:
  - CSP Layer: Uses Forward Checking / O(1) Native sets to aggressively prune the search space.
  - SLD Layer: The core logical inference engine. Every assignment MUST pass a formal 
               backward_chain() proof against the Knowledge Base to be strictly academically correct.
"""

from base_solver import BaseSolver
import time
import sys

# ─────────────────────────────────────────────────────────────────────────────
# Term utilities & SLD Engine
# ─────────────────────────────────────────────────────────────────────────────

def is_var(x):
    return isinstance(x, str) and x.startswith('?')

def apply_sub(term, theta):
    if isinstance(term, tuple):
        return tuple(apply_sub(a, theta) for a in term)
    while isinstance(term, str) and term.startswith('?') and term in theta:
        term = theta[term]
    if isinstance(term, tuple):
        return apply_sub(term, theta)
    return term

# Inline Unify Optimization (Micro-optimized for hot loop)
def unify(x, y, theta):
    x = apply_sub(x, theta)
    y = apply_sub(y, theta)
    if x == y: return theta
    if is_var(x): return {**theta, x: y}
    if is_var(y): return {**theta, y: x}
    if isinstance(x, tuple) and isinstance(y, tuple):
        if x[0] != y[0] or len(x) != len(y): return None
        res = theta
        for xi, yi in zip(x[1:], y[1:]):
            res = unify(xi, yi, res)
            if res is None: return None
        return res
    return None

_var_counter = 0

def rename_vars(head, body):
    # Dùng _depth counter đơn giản để tránh overhead tạo object liên tục
    global _var_counter
    _var_counter += 1
    sfx = f"_{_var_counter}"
    def r(term):
        if is_var(term): return term + sfx
        if isinstance(term, tuple): return tuple(r(a) for a in term)
        return term
    return r(head), [r(b) for b in body]

# ─────────────────────────────────────────────────────────────────────────────
# Knowledge Base (Strongly Indexed)
# ─────────────────────────────────────────────────────────────────────────────

class KnowledgeBase:
    def __init__(self):
        self._facts = set()
        self._fact_idx = {}
        self._fact_idx1 = {} # Index by Arg1
        self._fact_idx2 = {} # Index by Arg1, Arg2
        
        self._rule_idx = {}
        self._rule_idx1 = {}
        self._rule_idx2 = {}
        self._rule_idx_var = {}

    def add_fact(self, fact):
        if fact not in self._facts:
            self._facts.add(fact)
            self._fact_idx.setdefault(fact[0], []).append(fact)
            if len(fact) > 1 and not is_var(fact[1]):
                self._fact_idx1.setdefault((fact[0], fact[1]), []).append(fact)
            if len(fact) > 2 and not is_var(fact[1]) and not is_var(fact[2]):
                self._fact_idx2.setdefault((fact[0], fact[1], fact[2]), []).append(fact)

    def retract_fact(self, fact):
        if fact in self._facts:
            self._facts.discard(fact)
            self._fact_idx[fact[0]].remove(fact)
            if len(fact) > 1 and not is_var(fact[1]):
                self._fact_idx1[(fact[0], fact[1])].remove(fact)
            if len(fact) > 2 and not is_var(fact[1]) and not is_var(fact[2]):
                self._fact_idx2[(fact[0], fact[1], fact[2])].remove(fact)

    def add_rule(self, head, body):
        entry = (head, body)
        self._rule_idx.setdefault(head[0], []).append(entry)
        if len(head) > 1 and not is_var(head[1]):
            self._rule_idx1.setdefault((head[0], head[1]), []).append(entry)
        if len(head) > 2 and not is_var(head[1]) and not is_var(head[2]):
            self._rule_idx2.setdefault((head[0], head[1], head[2]), []).append(entry)
        if len(head) == 1 or is_var(head[1]):
            self._rule_idx_var.setdefault(head[0], []).append(entry)

    def facts_for(self, name, arg1=None, arg2=None):
        if arg1 is not None and arg2 is not None:
            return self._fact_idx2.get((name, arg1, arg2), [])
        if arg1 is not None:
            return self._fact_idx1.get((name, arg1), [])
        return self._fact_idx.get(name, [])

    def rules_for(self, name, arg1=None, arg2=None):
        var_rules = self._rule_idx_var.get(name, [])
        if arg1 is not None and arg2 is not None:
            ground = self._rule_idx2.get((name, arg1, arg2), [])
            return ground + var_rules if var_rules else ground
        if arg1 is not None:
            ground = self._rule_idx1.get((name, arg1), [])
            return ground + var_rules if var_rules else ground
        return self._rule_idx.get(name, [])

# ─────────────────────────────────────────────────────────────────────────────
# Solver
# ─────────────────────────────────────────────────────────────────────────────

class BackwardChainingSolver(BaseSolver):
    def __init__(self, puzzle, socketio=None, game_id=None):
        super().__init__(puzzle, socketio, game_id)
        self.kb               = KnowledgeBase()
        self.backtracks       = 0
        self.inferences       = 0
        self.max_depth_reached = 0
        self.solution         = {}
        self.memo             = {}
        
        # O(1) Trackers for CSP
        self.row_vals = {}
        self.col_vals = {}

    def solve(self, max_time=300):
        self.max_time = max_time
        old_rlimit = sys.getrecursionlimit()
        sys.setrecursionlimit(max(old_rlimit, 20000))

        self.reset_stats()
        self.start_time       = time.time()
        self.last_progress_time = self.start_time
        self.solution         = {}
        self.backtracks       = 0
        self.inferences       = 0
        self.memo             = {}

        self.row_vals = {i: set() for i in range(1, self.puzzle.size + 1)}
        self.col_vals = {j: set() for j in range(1, self.puzzle.size + 1)}
        for (i, j), v in self.puzzle.given_cells.items():
            self.row_vals[i].add(v)
            self.col_vals[j].add(v)

        print("\n[Hybrid BC/CSP] Initialising Knowledge Base & Solvers …")
        self._initialize_kb()
        self._send_progress(is_initial=True)

        empty_cells = [
            (i, j) for i in range(1, self.puzzle.size + 1)
            for j in range(1, self.puzzle.size + 1)
            if (i, j) not in self.puzzle.given_cells
        ]

        result = self._sld_solve(empty_cells, max_time)
        sys.setrecursionlimit(old_rlimit)

        if result:
            elapsed = time.time() - self.start_time
            print(f"[Hybrid BC/CSP] SUCCESS — inferences={self.inferences}, backtracks={self.backtracks}, time={elapsed:.3f}s")
            self._send_progress(is_complete=True)
            full_solution = dict(self.puzzle.given_cells)
            full_solution.update(self.solution)
            return full_solution

        print(f"[Hybrid BC/CSP] FAILED — inferences={self.inferences}, backtracks={self.backtracks}")
        return None

    def _initialize_kb(self):
        n = self.puzzle.size
        for v in range(1, n + 1): self.kb.add_fact(("Domain", v))
        for v1 in range(1, n + 1):
            for v2 in range(v1 + 1, n + 1): self.kb.add_fact(("Less", v1, v2))
        for (i, j), v in self.puzzle.given_cells.items():
            self.kb.add_fact(("Given", i, j, v))
            self.kb.add_fact(("Val", i, j, v))

        self.kb.add_rule(("ExistsInRow", "?i", "?j", "?v"), [("Val", "?i", "?j2", "?v"), ("neq", "?j2", "?j")])
        self.kb.add_rule(("ExistsInCol", "?i", "?j", "?v"), [("Val", "?i2", "?j", "?v"), ("neq", "?i2", "?i")])
        
        # Core Rule to be proven by SLD
        self.kb.add_rule(
            ("CanAssign", "?i", "?j", "?v"),
            [
                ("Domain",   "?v"),
                ("not", ("ExistsInRow", "?i", "?j", "?v")),
                ("not", ("ExistsInCol", "?i", "?j", "?v")),
                ("HLeftOK",  "?i", "?j", "?v"),
                ("HRightOK", "?i", "?j", "?v"),
                ("VUpOK",    "?i", "?j", "?v"),
                ("VDownOK",  "?i", "?j", "?v"),
            ]
        )

        for i in range(1, n + 1):
            for j in range(1, n + 1):
                self._build_neighbor_rules(i, j, n)

    def _build_neighbor_rules(self, i, j, n):
        kb = self.kb
        def _ineq_body(nbr_i, nbr_j, nbr_less_than_me, val_var="?v"):
            if nbr_less_than_me: return [("Val", nbr_i, nbr_j, "?nbr"), ("Less", "?nbr", val_var)]
            else: return [("Val", nbr_i, nbr_j, "?nbr"), ("Less", val_var, "?nbr")]

        def add_resilient_rule(pred, nbr_i, nbr_j, c, is_backward):
            val_var = "?v"
            head = (pred, i, j, val_var)
            if c == 0: kb.add_rule(head, []); return
            kb.add_rule(head, [("not", ("ExistsVal", nbr_i, nbr_j))])
            nbr_less = (c == 1) if is_backward else (c == -1)
            kb.add_rule(head, _ineq_body(nbr_i, nbr_j, nbr_less, val_var))

        if j > 1: add_resilient_rule("HLeftOK", i, j-1, self.puzzle.horizontal_constraints[i-1][j-2], True)
        else: kb.add_rule(("HLeftOK", i, j, "?v"), [])
        
        if j < n: add_resilient_rule("HRightOK", i, j+1, self.puzzle.horizontal_constraints[i-1][j-1], False)
        else: kb.add_rule(("HRightOK", i, j, "?v"), [])
        
        if i > 1: add_resilient_rule("VUpOK", i-1, j, self.puzzle.vertical_constraints[i-2][j-1], True)
        else: kb.add_rule(("VUpOK", i, j, "?v"), [])
        
        if i < n: add_resilient_rule("VDownOK", i+1, j, self.puzzle.vertical_constraints[i-1][j-1], False)
        else: kb.add_rule(("VDownOK", i, j, "?v"), [])

    # ─────────────────────────────────────────────────────────────────────────────
    # SLD ENGINE (Core Academic Engine)
    # ─────────────────────────────────────────────────────────────────────────────

    def order_goals(self, goals, theta):
        """Goal Ordering (Fail-fast SLD). Grounds first, Domains last."""
        def score(g):
            g_bound = apply_sub(g, theta)
            grounded = sum(1 for x in g_bound[1:] if not is_var(x))
            # not and native predicates get highest priority to fail fast
            priority = 0
            if g_bound[0] == "not": priority = -2
            elif g_bound[0] in ("Val", "Less", "neq", "ExistsInRow", "ExistsInCol"): priority = -1
            elif g_bound[0] == "Domain": priority = 5 # Easiest to prove, push to back
            return (priority, -grounded)
        return sorted(goals, key=score)

    def backward_chain(self, goals, theta, _depth=0):
        if _depth > 2000 or self.cancelled: return 
        self.inferences += 1
        
        if not goals:
            yield theta
            return

        if len(goals) > 1: goals = self.order_goals(goals, theta)

        goal = apply_sub(goals[0], theta)
        rest = goals[1:]
        is_ground = not any(is_var(x) for x in goal[1:])
        
        name = goal[0]
        is_builtin = True
        found_ground = False

        # 🔥 HOT PREDICATE SPECIALIZATION (Bypass Recursion for Native Facts)
        if name == "ExistsInRow" and is_ground:
            found_ground = goal[3] in self.row_vals[goal[1]]
        elif name == "ExistsInCol" and is_ground:
            found_ground = goal[3] in self.col_vals[goal[2]]
        elif name == "ExistsVal" and is_ground:
            i, j = goal[1], goal[2]
            found_ground = (i, j) in self.solution or (i, j) in self.puzzle.given_cells
        elif name == "neq" and is_ground:
            found_ground = (goal[1] != goal[2])
        elif name == "Val":
            i, j, v = goal[1], goal[2], goal[3]
            curr = self.solution.get((i, j)) or self.puzzle.given_cells.get((i, j))
            if curr is not None:
                if not is_var(v):
                    found_ground = (curr == v)
                else:
                    theta2 = theta.copy()
                    theta2[v] = curr
                    yield from self.backward_chain(rest, theta2, _depth + 1)
                    return
        elif name == "not":
            subgoal = apply_sub(goal[1], theta)
            if any(is_var(x) for x in subgoal[1:]): found_ground = False
            else: found_ground = not any(True for _ in self.backward_chain([subgoal], theta, _depth + 1))
        else:
            is_builtin = False

        if is_builtin:
            if found_ground: yield from self.backward_chain(rest, theta, _depth + 1)
            return

        # Indexed KB Lookup
        _a1 = goal[1] if (len(goal) > 1 and not is_var(goal[1])) else None
        _a2 = goal[2] if (len(goal) > 2 and not is_var(goal[2])) else None

        # Process Facts (Cut-like Pruning: if ground goal hits fact, we are done with this goal)
        matched_any = False
        for fact in self.kb.facts_for(name, _a1, _a2):
            th2 = unify(goal, fact, theta)
            if th2 is not None:
                matched_any = True
                yield from self.backward_chain(rest, th2, _depth + 1)
                if is_ground: return # Cut-like logic: already proven True

        # Process Rules
        for head, body in self.kb.rules_for(name, _a1, _a2):
            fresh_h, fresh_b = rename_vars(head, body)
            th2 = unify(goal, fresh_h, theta)
            if th2 is not None:
                yield from self.backward_chain(fresh_b + list(rest), th2, _depth + 1)
                if is_ground and matched_any: return # Already proven

    # ─────────────────────────────────────────────────────────────────────────────
    # CSP Pre-filters
    # ─────────────────────────────────────────────────────────────────────────────

    def _ineq_ok(self, i, j, v):
        n = self.puzzle.size
        sol, giv = self.solution, self.puzzle.given_cells
        hc, vc = self.puzzle.horizontal_constraints, self.puzzle.vertical_constraints
        def assigned(r, c): return sol.get((r, c)) or giv.get((r, c))

        if j > 1 and (nb := assigned(i, j-1)):
            c = hc[i-1][j-2]
            if (c == 1 and nb >= v) or (c == -1 and nb <= v): return False
        if j < n and (nb := assigned(i, j+1)):
            c = hc[i-1][j-1]
            if (c == 1 and v >= nb) or (c == -1 and v <= nb): return False
        if i > 1 and (nb := assigned(i-1, j)):
            c = vc[i-2][j-1]
            if (c == 1 and nb >= v) or (c == -1 and nb <= v): return False
        if i < n and (nb := assigned(i+1, j)):
            c = vc[i-1][j-1]
            if (c == 1 and v >= nb) or (c == -1 and v <= nb): return False
        return True

    def _fast_can_assign(self, i, j, v):
        """CSP Filter: Cuts branch quickly before invoking massive SLD proof"""
        if v in self.row_vals[i] or v in self.col_vals[j]: return False
        if not self._ineq_ok(i, j, v): return False
        return True

    def _compute_domains(self, remaining_cells):
        domains = {}
        for i, j in remaining_cells:
            domains[(i, j)] = [v for v in range(1, self.puzzle.size + 1) if self._fast_can_assign(i, j, v)]
        return domains

    def _select_cell(self, remaining_cells, domains):
        n = self.puzzle.size
        remaining_set = set(remaining_cells)

        def _degree(i, j):
            return sum(1 for ni, nj in [(i, j-1), (i, j+1), (i-1, j), (i+1, j)] 
                       if 1 <= ni <= n and 1 <= nj <= n and (ni, nj) in remaining_set)

        best_cell, best_cands = None, None
        for cell in remaining_cells:
            cands = domains[cell]
            if best_cell is None or len(cands) < len(best_cands) or (len(cands) == len(best_cands) and _degree(*cell) > _degree(*best_cell)):
                best_cell, best_cands = cell, cands
        return best_cell, best_cands if best_cands is not None else []

    # ─────────────────────────────────────────────────────────────────────────────
    # Main Search Loop
    # ─────────────────────────────────────────────────────────────────────────────

    def _sld_solve(self, remaining_cells, max_time):
        if time.time() - self.start_time > max_time or self.cancelled: return False
        if not remaining_cells: return True

        if self.inferences % 5000 == 0: self._send_progress()

        domains = self._compute_domains(remaining_cells)
        for cell in remaining_cells:
            if not domains[cell]: return False

        cell, candidates = self._select_cell(remaining_cells, domains)
        if cell is None or not candidates: return False

        i, j = cell
        depth = self.puzzle.size ** 2 - len(remaining_cells)
        if depth > self.max_depth_reached: self.max_depth_reached = depth
        next_cells = [c for c in remaining_cells if c != cell]

        if len(candidates) > 1:
            candidates.sort(key=lambda v: sum(1 for r, c in remaining_cells if (r == i or c == j) and v in domains[(r, c)]))

        for v in candidates:
            if not self._fast_can_assign(i, j, v): 
                continue 
            
            neighbor_vals = tuple(self.solution.get((ni, nj)) or self.puzzle.given_cells.get((ni, nj)) or 0 
                                  for ni, nj in [(i, j-1), (i, j+1), (i-1, j), (i+1, j)] 
                                  if 1 <= ni <= self.puzzle.size and 1 <= nj <= self.puzzle.size)
            
            local_state_key = (
                tuple(sorted(self.row_vals[i])),
                tuple(sorted(self.col_vals[j])),
                neighbor_vals
            )
            cache_key = ("CanAssign", i, j, v, local_state_key)
            
            if cache_key in self.memo: 
                succeeded = self.memo[cache_key]
            else:
                # The SLD Resolution is strictly enforced here
                succeeded = any(True for _ in self.backward_chain([("CanAssign", i, j, v)], {}))
                self.memo[cache_key] = succeeded

            if not succeeded: continue
            
            val_fact = ("Val", i, j, v)
            self.kb.add_fact(val_fact)
            self.solution[(i, j)] = v
            self.row_vals[i].add(v)
            self.col_vals[j].add(v)
            
            if self._sld_solve(next_cells, max_time): return True
                
            self.kb.retract_fact(val_fact)
            self.row_vals[i].remove(v)
            self.col_vals[j].remove(v)
            del self.solution[(i, j)]
            self.backtracks += 1

        return False

    def _send_progress(self, is_initial=False, is_complete=False):
        if not self.socketio: return
        current_time = time.time()
        if not is_complete and not is_initial and current_time - self.last_progress_time < self.progress_interval: return
        elapsed = current_time - self.start_time if self.start_time else 1
        rate = self.inferences / elapsed if elapsed > 0 else 0
        total_cells = self.puzzle.size * self.puzzle.size
        filled = len(self.solution)
        progress = 100 if is_complete else (filled / total_cells * 100)
        try:
            self.socketio.emit('solver_progress', {
                'game_id': self.game_id, 'solver': 'Hybrid CSP-SLD', 'progress': round(progress, 1),
                'nodes_explored': self.inferences, 'backtracks': self.backtracks, 'filled_cells': f"{filled}/{total_cells}",
                'current_depth': filled, 'max_depth': self.max_depth_reached, 'exploration_rate': round(rate, 1),
                'estimated_remaining': self._estimate_remaining(rate, filled, total_cells), 'is_complete': is_complete,
            })
            self.last_progress_time = current_time
        except: pass

    def _estimate_remaining(self, rate, filled, total):
        if rate <= 0 or filled >= total: return "calculating..."
        secs = ((total - filled) * self.puzzle.size / 2) / rate
        return f"~{int(secs)}s" if secs < 60 else f"~{int(secs/60)}m" if secs < 3600 else f"~{int(secs/3600)}h"

    def get_stats(self):
        elapsed = time.time() - self.start_time if self.start_time else 0
        return {
            'nodes_explored': self.inferences, 'inferences': self.inferences, 'backtracks': self.backtracks,
            'max_depth': self.max_depth_reached, 'time': elapsed,
            'solution_found': len(self.solution) == self.puzzle.size * self.puzzle.size,
        }