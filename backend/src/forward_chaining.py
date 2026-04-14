from base_solver import BaseSolver
import time

# Thuật toán áp dụng Modus Ponens liên tục (exhaustively) trên
# tập hợp facts dạng chuỗi để suy ra lời giải.

# Hằng số đặc biệt đánh dấu trạng thái mâu thuẫn
CONTRADICTION = "CONTRADICTION"


class ForwardChainingSolver(BaseSolver):
    def __init__(self, puzzle, socketio=None, game_id=None):
        super().__init__(puzzle, socketio, game_id)

        # Thống kê
        self.inference_cycles = 0   # số vòng lặp fixed-point
        self.inferences = 0         # tổng số fact mới được suy ra
        self.branch_count = 0       # số lần phải đoán khi bị stuck
        self.max_facts = 0          # số facts tối đa đạt được

    # ----------------------------------------------------------
    # ĐIỂM VÀO CHÍNH
    # ----------------------------------------------------------

    def solve(self, max_time=300):
        """
        Giải puzzle bằng FOL Forward Chaining.
        Trả về dict {(row, col): value} nếu tìm được lời giải,
        hoặc None nếu không tồn tại lời giải.
        """
        self.reset_stats()
        self.start_time = time.time()
        self.last_progress_time = self.start_time
        self.inference_cycles = 0
        self.inferences = 0
        self.branch_count = 0
        self.max_facts = 0

        # Bước 1: Khởi tạo tập facts ban đầu từ puzzle
        facts = self._initialize_facts()
        self._send_progress(facts, is_initial=True)

        # Bước 2: Chạy forward chaining đến điểm hội tụ
        facts = self._run_forward_chaining(facts, max_time)

        # Kiểm tra kết quả sau FC
        if CONTRADICTION in facts:
            print(f"[FC] Contradiction at initial state after {self.inference_cycles} cycles")
            return None

        if self._is_solved(facts):
            elapsed = time.time() - self.start_time
            print(f"[FC] Solution found in {elapsed:.2f}s, "
                  f"{self.inference_cycles} cycles, {self.inferences} inferences")
            self._send_progress(facts, is_complete=True)
            return self._extract_solution(facts)

        # Buoc 3: Neu bi stuck (khong suy them duoc, chua xong)
        # → thu doan va tiep tuc Forward Chaining
        print(f"[FC] Stuck after {self.inference_cycles} cycles, starting branching...")
        result_facts = self._branch_and_propagate(facts, max_time)

        if result_facts and self._is_solved(result_facts):
            elapsed = time.time() - self.start_time
            print(f"[FC] Solution found via branching in {elapsed:.2f}s, "
                  f"{self.branch_count} branches")
            self._send_progress(result_facts, is_complete=True)
            return self._extract_solution(result_facts)

        print(f"[FC] No solution found after {self.inference_cycles} cycles")
        return None

    # ----------------------------------------------------------
    # BƯỚC 1: KHỞI TẠO FACTS BAN ĐẦU
    # ----------------------------------------------------------

    def _initialize_facts(self) -> set:
        """
        Chuyển thông tin puzzle thành tập facts FOL ban đầu.
        Nạp: Given, Val cho ô đã biết, LessH/GreaterH/LessV/GreaterV.
        """
        facts = set()
        n = self.puzzle.size

        # Nạp các ô đã cho sẵn (given cells)
        for (i, j), val in self.puzzle.given_cells.items():
            facts.add(f"Given({i},{j},{val})")
            facts.add(f"Val({i},{j},{val})")
            # Các giá trị khác bị loại ngay lập tức
            for v in range(1, n + 1):
                if v != val:
                    facts.add(f"¬Val({i},{j},{v})")

        # Nạp ràng buộc ngang (horizontal): 1 = trái < phải, -1 = trái > phải
        for i in range(n):
            for j in range(n - 1):
                c = self.puzzle.horizontal_constraints[i][j]
                if c == 1:
                    facts.add(f"LessH({i+1},{j+1})")
                elif c == -1:
                    facts.add(f"GreaterH({i+1},{j+1})")

        # Nạp ràng buộc dọc (vertical): 1 = trên < dưới, -1 = trên > dưới
        for i in range(n - 1):
            for j in range(n):
                c = self.puzzle.vertical_constraints[i][j]
                if c == 1:
                    facts.add(f"LessV({i+1},{j+1})")
                elif c == -1:
                    facts.add(f"GreaterV({i+1},{j+1})")

        return facts

    # ----------------------------------------------------------
    # BƯỚC 2: VÒNG LẶP FIXED-POINT FORWARD CHAINING
    # ----------------------------------------------------------

    def _run_forward_chaining(self, facts: set, max_time: float) -> set:
        """
        Áp dụng tất cả luật Modus Ponens liên tục cho đến khi:
        - Không có fact mới nào được suy ra (fixed-point), hoặc
        - Phát hiện mâu thuẫn, hoặc
        - Hết thời gian.
        """
        changed = True
        while changed and CONTRADICTION not in facts:
            # Kiểm tra thời gian
            if time.time() - self.start_time > max_time:
                print(f"[FC] Time limit reached after {self.inference_cycles} cycles")
                break

            if self.cancelled:
                break

            changed = False
            self.inference_cycles += 1
            old_size = len(facts)

            # Áp dụng lần lượt 5 luật Modus Ponens
            # R1: Given Propagation
            new_facts = self._rule_given_propagation(facts)
            facts.update(new_facts)

            # R2: Loại trừ theo hàng (Row Uniqueness)
            new_facts = self._rule_row_uniqueness(facts)
            facts.update(new_facts)

            # R3: Loại trừ theo cột (Column Uniqueness)
            new_facts = self._rule_col_uniqueness(facts)
            facts.update(new_facts)

            # R4: Suy ra loại trừ từ bất đẳng thức
            new_facts = self._rule_inequality_propagation(facts)
            facts.update(new_facts)

            # R5: Gán giá trị duy nhất còn lại (Naked + Hidden Single)
            new_facts = self._rule_elimination(facts)
            facts.update(new_facts)

            # Phát hiện mâu thuẫn sau mỗi vòng
            self._check_contradiction(facts)

            # Kiểm tra xem có fact mới không
            new_size = len(facts)
            added = new_size - old_size
            if added > 0:
                changed = True
                self.inferences += added
                self.expanded_nodes = self.inferences
                if new_size > self.max_facts:
                    self.max_facts = new_size

            # Gửi tiến độ định kỳ
            if self.inference_cycles % 5 == 0:
                self._send_progress(facts)

        return facts

    # ----------------------------------------------------------
    # LUẬT 1 — GIVEN PROPAGATION
    # ----------------------------------------------------------

    def _rule_given_propagation(self, facts: set) -> set:
        """
        Modus Ponens R1:
          Given(i,j,v) → Val(i,j,v)
          Given(i,j,v) → ¬Val(i,j,v') với mọi v' ≠ v

        Nếu 1 ô đã được cho sẵn giá trị v, thì nó không thể là
        bất kỳ giá trị nào khác.
        """
        new_facts = set()
        n = self.puzzle.size

        for i in range(1, n + 1):
            for j in range(1, n + 1):
                for v in range(1, n + 1):
                    if f"Given({i},{j},{v})" in facts:
                        # Suy ra: ô này có giá trị v
                        new_facts.add(f"Val({i},{j},{v})")
                        # Suy ra: ô này không thể là bất kỳ giá trị nào khác
                        for v2 in range(1, n + 1):
                            if v2 != v:
                                new_facts.add(f"¬Val({i},{j},{v2})")

        return new_facts - facts

    # ----------------------------------------------------------
    # LUẬT 2 — ROW UNIQUENESS (Loại trừ theo hàng)
    # ----------------------------------------------------------

    def _rule_row_uniqueness(self, facts: set) -> set:
        """
        Modus Ponens R2:
          Val(i,j,v) → ¬Val(i,j',v) với mọi j' ≠ j trong cùng hàng i

        Nếu 1 ô trong hàng đã có giá trị v, thì mọi ô khác cùng hàng
        không thể là v (tính duy nhất trong hàng).
        """
        new_facts = set()
        n = self.puzzle.size

        for i in range(1, n + 1):
            for j in range(1, n + 1):
                for v in range(1, n + 1):
                    if f"Val({i},{j},{v})" in facts:
                        # Loại trừ v khỏi tất cả ô khác trong hàng i
                        for j2 in range(1, n + 1):
                            if j2 != j:
                                new_facts.add(f"¬Val({i},{j2},{v})")

        return new_facts - facts

    # ----------------------------------------------------------
    # LUẬT 3 — COLUMN UNIQUENESS (Loại trừ theo cột)
    # ----------------------------------------------------------

    def _rule_col_uniqueness(self, facts: set) -> set:
        """
        Modus Ponens R3:
          Val(i,j,v) → ¬Val(i',j,v) với mọi i' ≠ i trong cùng cột j

        Tương tự R2 nhưng áp dụng theo chiều cột.
        """
        new_facts = set()
        n = self.puzzle.size

        for i in range(1, n + 1):
            for j in range(1, n + 1):
                for v in range(1, n + 1):
                    if f"Val({i},{j},{v})" in facts:
                        # Loại trừ v khỏi tất cả ô khác trong cột j
                        for i2 in range(1, n + 1):
                            if i2 != i:
                                new_facts.add(f"¬Val({i2},{j},{v})")

        return new_facts - facts

    # ----------------------------------------------------------
    # LUẬT 4 — INEQUALITY PROPAGATION (Suy ra từ bất đẳng thức)
    # ----------------------------------------------------------

    def _rule_inequality_propagation(self, facts: set) -> set:
        """
        Modus Ponens R4 — áp dụng cho bất đẳng thức ngang và dọc.

        Ví dụ LessH(i,j) tức là ô(i,j) < ô(i,j+1):
          LessH(i,j) ∧ Val(i,j,v)     → ¬Val(i,j+1,v') với v' ≤ v
          LessH(i,j) ∧ Val(i,j+1,v)   → ¬Val(i,j,v')   với v' ≥ v

        Tương tự cho GreaterH, LessV, GreaterV.
        """
        new_facts = set()
        n = self.puzzle.size

        # --- Ràng buộc ngang ---
        for i in range(1, n + 1):
            for j in range(1, n):
                left = (i, j)
                right = (i, j + 1)

                if f"LessH({i},{j})" in facts:
                    # ô trái < ô phải
                    # Nếu biết giá trị bên trái → cắt domain bên phải
                    for v in range(1, n + 1):
                        if f"Val({left[0]},{left[1]},{v})" in facts:
                            # Bên phải phải > v → loại tất cả v' ≤ v
                            for v2 in range(1, v + 1):
                                new_facts.add(f"¬Val({right[0]},{right[1]},{v2})")
                    # Nếu biết giá trị bên phải → cắt domain bên trái
                    for v in range(1, n + 1):
                        if f"Val({right[0]},{right[1]},{v})" in facts:
                            # Bên trái phải < v → loại tất cả v' ≥ v
                            for v2 in range(v, n + 1):
                                new_facts.add(f"¬Val({left[0]},{left[1]},{v2})")

                elif f"GreaterH({i},{j})" in facts:
                    # ô trái > ô phải
                    # Nếu biết giá trị bên trái → cắt domain bên phải
                    for v in range(1, n + 1):
                        if f"Val({left[0]},{left[1]},{v})" in facts:
                            # Bên phải phải < v → loại tất cả v' ≥ v
                            for v2 in range(v, n + 1):
                                new_facts.add(f"¬Val({right[0]},{right[1]},{v2})")
                    # Nếu biết giá trị bên phải → cắt domain bên trái
                    for v in range(1, n + 1):
                        if f"Val({right[0]},{right[1]},{v})" in facts:
                            # Bên trái phải > v → loại tất cả v' ≤ v
                            for v2 in range(1, v + 1):
                                new_facts.add(f"¬Val({left[0]},{left[1]},{v2})")

        # --- Ràng buộc dọc ---
        for i in range(1, n):
            for j in range(1, n + 1):
                top = (i, j)
                bot = (i + 1, j)

                if f"LessV({i},{j})" in facts:
                    # ô trên < ô dưới
                    for v in range(1, n + 1):
                        if f"Val({top[0]},{top[1]},{v})" in facts:
                            # Ô dưới phải > v → loại v' ≤ v
                            for v2 in range(1, v + 1):
                                new_facts.add(f"¬Val({bot[0]},{bot[1]},{v2})")
                    for v in range(1, n + 1):
                        if f"Val({bot[0]},{bot[1]},{v})" in facts:
                            # Ô trên phải < v → loại v' ≥ v
                            for v2 in range(v, n + 1):
                                new_facts.add(f"¬Val({top[0]},{top[1]},{v2})")

                elif f"GreaterV({i},{j})" in facts:
                    # ô trên > ô dưới
                    for v in range(1, n + 1):
                        if f"Val({top[0]},{top[1]},{v})" in facts:
                            # Ô dưới phải < v → loại v' ≥ v
                            for v2 in range(v, n + 1):
                                new_facts.add(f"¬Val({bot[0]},{bot[1]},{v2})")
                    for v in range(1, n + 1):
                        if f"Val({bot[0]},{bot[1]},{v})" in facts:
                            # Ô trên phải > v → loại v' ≤ v
                            for v2 in range(1, v + 1):
                                new_facts.add(f"¬Val({top[0]},{top[1]},{v2})")

        return new_facts - facts

    # ----------------------------------------------------------
    # LUẬT 5 — ELIMINATION (Gán giá trị khi chỉ còn 1 khả năng)
    # ----------------------------------------------------------

    def _rule_elimination(self, facts: set) -> set:
        """
        Modus Ponens R5 — hai kỹ thuật:

        5a) Naked Single:
          Nếu ô (i,j) chưa được gán VÀ chỉ còn đúng 1 giá trị v
          chưa bị ¬Val loại → Val(i,j,v)

        5b) Hidden Single trong hàng:
          Nếu giá trị v chỉ có thể xuất hiện tại đúng 1 ô trong hàng i
          → Val(i, that_col, v)

        5c) Hidden Single trong cột:
          Tương tự 5b nhưng theo cột.
        """
        new_facts = set()
        n = self.puzzle.size

        # 5a) Naked Single: ô chỉ còn 1 giá trị khả dĩ
        for i in range(1, n + 1):
            for j in range(1, n + 1):
                # Bỏ qua ô đã được gán
                if any(f"Val({i},{j},{v})" in facts for v in range(1, n + 1)):
                    continue
                # Tìm các giá trị còn khả thi
                possible = [
                    v for v in range(1, n + 1)
                    if f"¬Val({i},{j},{v})" not in facts
                ]
                if len(possible) == 1:
                    # Chỉ còn 1 giá trị → buộc phải là nó
                    new_facts.add(f"Val({i},{j},{possible[0]})")

        # 5b) Hidden Single trong hàng
        # Dùng flag already_placed để rõ ràng hơn khi v đã được gán trong hàng
        for i in range(1, n + 1):
            for v in range(1, n + 1):
                already_placed = False  # v đã được gán ở đâu đó trong hàng i
                possible_cols = []

                for j in range(1, n + 1):
                    if f"Val({i},{j},{v})" in facts:
                        # Giá trị v đã có trong hàng → không cần suy thêm
                        already_placed = True
                        break
                    if f"¬Val({i},{j},{v})" in facts:
                        # v bị loại trừ tại ô này
                        continue
                    if any(f"Val({i},{j},{v2})" in facts
                           for v2 in range(1, n + 1) if v2 != v):
                        # Ô đã có giá trị khác → không thể chứa v
                        continue
                    possible_cols.append(j)

                if not already_placed and len(possible_cols) == 1:
                    # v chỉ còn 1 chỗ duy nhất trong hàng i → buộc phải ở đó
                    new_facts.add(f"Val({i},{possible_cols[0]},{v})")

        # 5c) Hidden Single trong cột
        # Tương tự 5b nhưng theo chiều cột
        for j in range(1, n + 1):
            for v in range(1, n + 1):
                already_placed = False  # v đã được gán ở đâu đó trong cột j
                possible_rows = []

                for i in range(1, n + 1):
                    if f"Val({i},{j},{v})" in facts:
                        already_placed = True
                        break
                    if f"¬Val({i},{j},{v})" in facts:
                        continue
                    if any(f"Val({i},{j},{v2})" in facts
                           for v2 in range(1, n + 1) if v2 != v):
                        continue
                    possible_rows.append(i)

                if not already_placed and len(possible_rows) == 1:
                    new_facts.add(f"Val({possible_rows[0]},{j},{v})")

        return new_facts - facts

    # ----------------------------------------------------------
    # PHÁT HIỆN MÂU THUẪN
    # ----------------------------------------------------------

    def _check_contradiction(self, facts: set):
        """
        Phát hiện mâu thuẫn và thêm CONTRADICTION vào facts nếu có.

        Các trường hợp mâu thuẫn:
         C1: Ô có cả Val(i,j,v) và ¬Val(i,j,v) cùng lúc
         C2: Ô có 2 giá trị khác nhau: Val(i,j,v1) và Val(i,j,v2)
         C3: Ô không có giá trị nào khả thi (domain rỗng)
         C4: Cùng hàng có 2 ô cùng giá trị: Val(i,j1,v) và Val(i,j2,v)
         C5: Cùng cột có 2 ô cùng giá trị: Val(i1,j,v) và Val(i2,j,v)
        """
        if CONTRADICTION in facts:
            return

        n = self.puzzle.size

        for i in range(1, n + 1):
            for j in range(1, n + 1):
                vals_assigned = [
                    v for v in range(1, n + 1)
                    if f"Val({i},{j},{v})" in facts
                ]

                # C1: Vừa có Val vừa có ¬Val cho cùng giá trị
                for v in vals_assigned:
                    if f"¬Val({i},{j},{v})" in facts:
                        facts.add(CONTRADICTION)
                        return

                # C2: Ô có 2 giá trị khác nhau
                if len(vals_assigned) > 1:
                    facts.add(CONTRADICTION)
                    return

                # C3: Không còn giá trị nào khả thi
                if not vals_assigned:
                    domain = [
                        v for v in range(1, n + 1)
                        if f"¬Val({i},{j},{v})" not in facts
                    ]
                    if not domain:
                        facts.add(CONTRADICTION)
                        return

        # C4: Trùng giá trị trong hàng
        for i in range(1, n + 1):
            for v in range(1, n + 1):
                cols_with_v = [
                    j for j in range(1, n + 1)
                    if f"Val({i},{j},{v})" in facts
                ]
                if len(cols_with_v) > 1:
                    facts.add(CONTRADICTION)
                    return

        # C5: Trùng giá trị trong cột
        for j in range(1, n + 1):
            for v in range(1, n + 1):
                rows_with_v = [
                    i for i in range(1, n + 1)
                    if f"Val({i},{j},{v})" in facts
                ]
                if len(rows_with_v) > 1:
                    facts.add(CONTRADICTION)
                    return

        # C6: Vi phạm bất đẳng thức khi cả 2 ô đã được gán giá trị
        # Trường hợp này R4 không tự phát hiện — cần kiểm tra tường minh
        for i in range(1, n + 1):
            for j in range(1, n):
                v_left  = next((v for v in range(1, n+1) if f"Val({i},{j},{v})"   in facts), None)
                v_right = next((v for v in range(1, n+1) if f"Val({i},{j+1},{v})" in facts), None)
                if v_left is not None and v_right is not None:
                    if f"LessH({i},{j})"    in facts and v_left >= v_right:
                        facts.add(CONTRADICTION)
                        return
                    if f"GreaterH({i},{j})" in facts and v_left <= v_right:
                        facts.add(CONTRADICTION)
                        return

        for i in range(1, n):
            for j in range(1, n + 1):
                v_top = next((v for v in range(1, n+1) if f"Val({i},{j},{v})"   in facts), None)
                v_bot = next((v for v in range(1, n+1) if f"Val({i+1},{j},{v})" in facts), None)
                if v_top is not None and v_bot is not None:
                    if f"LessV({i},{j})"    in facts and v_top >= v_bot:
                        facts.add(CONTRADICTION)
                        return
                    if f"GreaterV({i},{j})" in facts and v_top <= v_bot:
                        facts.add(CONTRADICTION)
                        return

    # ----------------------------------------------------------
    # XỬ LÝ KHI FC BỊ STUCK — BRANCHING
    # ----------------------------------------------------------

    def _get_domain(self, facts: set, i: int, j: int) -> list:
        """
        Helper: Trả về danh sách các giá trị còn khả thi của ô (i,j).
        Một giá trị v khả thi khi chưa có ¬Val(i,j,v) và
        chưa có Val(i,j, giá trị khác).
        """
        # Nếu ô đã được gán → domain chính là giá trị đó
        n = self.puzzle.size
        for v in range(1, n + 1):
            if f"Val({i},{j},{v})" in facts:
                return [v]

        return [
            v for v in range(1, n + 1)
            if f"¬Val({i},{j},{v})" not in facts
        ]

    def _select_branch_cell(self, facts: set) -> tuple | None:
        """
        Chọn ô để đoán khi FC bị stuck.
        Dùng heuristic MRV (Minimum Remaining Values):
        chọn ô chưa gán có ít giá trị khả dĩ nhất.
        """
        n = self.puzzle.size
        best_cell = None
        best_size = n + 1

        for i in range(1, n + 1):
            for j in range(1, n + 1):
                domain = self._get_domain(facts, i, j)
                # Bỏ qua ô đã gán (domain size = 1 và có Val)
                if len(domain) == 1 and f"Val({i},{j},{domain[0]})" in facts:
                    continue
                if 1 < len(domain) < best_size:
                    best_size = len(domain)
                    best_cell = (i, j)
                    if best_size == 2:
                        return best_cell  # Không thể tốt hơn

        return best_cell

    def _branch_and_propagate(self, facts: set, max_time: float) -> set | None:
        """
        Khi FC không còn suy ra được gì mới mà puzzle chưa xong:
        1. Chọn ô có ít giá trị khả dĩ nhất (MRV)
        2. Thử từng giá trị → thêm vào facts giả định
        3. Tiếp tục chạy FC trên bản sao facts
        4. Nếu thành công → trả về
        5. Nếu mâu thuẫn → thử giá trị khác (backtrack)
        6. Nếu cạn giá trị → trả None (backtrack lên trên)
        """
        if time.time() - self.start_time > max_time:
            return None

        if self.cancelled:
            return None

        # Tìm ô tốt nhất để đoán
        cell = self._select_branch_cell(facts)
        if cell is None:
            # Không còn ô nào để chọn → đã xong hoặc mâu thuẫn
            return facts if self._is_solved(facts) else None

        i, j = cell
        domain = self._get_domain(facts, i, j)

        for v in domain:
            self.branch_count += 1

            # Tạo bản sao facts để thử giả thuyết: Val(i,j,v)
            facts_copy = facts.copy()
            facts_copy.add(f"Val({i},{j},{v})")

            # Tiếp tục chạy FC trên bản sao
            facts_copy = self._run_forward_chaining(facts_copy, max_time)

            # Nếu mâu thuẫn → thử giá trị khác
            if CONTRADICTION in facts_copy:
                continue

            # Nếu đã xong → thành công
            if self._is_solved(facts_copy):
                return facts_copy

            # Nếu vẫn stuck → đệ quy tiếp
            result = self._branch_and_propagate(facts_copy, max_time)
            if result is not None:
                return result

        # Tất cả trường hợp đều thất bại → mâu thuẫn ở nhánh này
        return None

    # ----------------------------------------------------------
    # KIỂM TRA VÀ TRÍCH XUẤT KẾT QUẢ
    # ----------------------------------------------------------

    def _is_solved(self, facts: set) -> bool:
        """
        Kiểm tra puzzle đã được giải hoàn toàn chưa:
        Mọi ô (i,j) đều phải có đúng 1 fact Val(i,j,v).
        """
        n = self.puzzle.size
        if CONTRADICTION in facts:
            return False
        for i in range(1, n + 1):
            for j in range(1, n + 1):
                if not any(f"Val({i},{j},{v})" in facts
                           for v in range(1, n + 1)):
                    return False
        return True

    def _extract_solution(self, facts: set) -> dict:
        """
        Trích xuất lời giải từ tập facts.
        Trả về dict {(row, col): value} (1-indexed).
        """
        solution = {}
        n = self.puzzle.size
        for i in range(1, n + 1):
            for j in range(1, n + 1):
                for v in range(1, n + 1):
                    if f"Val({i},{j},{v})" in facts:
                        solution[(i, j)] = v
                        break
        return solution

    # ----------------------------------------------------------
    # GỬI TIẾN ĐỘ QUA WEBSOCKET
    # ----------------------------------------------------------

    def _send_progress(self, facts: set, is_initial=False, is_complete=False):
        """Gửi tiến độ thực thi qua WebSocket (nếu có socketio)."""
        if not self.socketio:
            return

        current_time = time.time()

        # Throttle: chỉ gửi khi đủ khoảng thời gian hoặc đủ facts mới
        if not is_complete and not is_initial:
            time_diff = current_time - self.last_progress_time
            facts_diff = self.inferences - self.last_sent_nodes
            if time_diff < self.progress_interval and facts_diff < 500:
                return

        elapsed = current_time - self.start_time if self.start_time else 1
        rate = self.inferences / elapsed if elapsed > 0 else 0

        n = self.puzzle.size
        total_cells = n * n
        filled_cells = sum(
            1 for i in range(1, n + 1)
            for j in range(1, n + 1)
            if any(f"Val({i},{j},{v})" in facts for v in range(1, n + 1))
        )

        progress = 100 if is_complete else (filled_cells / total_cells * 100)

        try:
            self.socketio.emit('solver_progress', {
                'game_id': self.game_id,
                'solver': 'Forward Chaining',
                'progress': round(progress, 1),
                'nodes_explored': self.inferences,
                'inference_cycles': self.inference_cycles,
                'branch_count': self.branch_count,
                'filled_cells': f"{filled_cells}/{total_cells}",
                'facts_count': len(facts),
                'exploration_rate': round(rate, 1),
                'is_complete': is_complete,
                'contradiction': CONTRADICTION in facts
            })
            self.last_progress_time = current_time
            self.last_sent_nodes = self.inferences
        except Exception as e:
            print(f"[FC] Error sending progress: {e}")

    # ----------------------------------------------------------
    # THỐNG KÊ
    # ----------------------------------------------------------

    def get_stats(self) -> dict:
        """Trả về thống kê hiệu suất của solver."""
        elapsed = time.time() - self.start_time if self.start_time else 0
        return {
            'inferences': self.inferences,
            'inference_cycles': self.inference_cycles,
            'branch_count': self.branch_count,
            'max_facts': self.max_facts,
            'time': elapsed,
            'solution_found': self.solution is not None
        }