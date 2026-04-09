import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:5000/api';

export const solvePuzzleAsync = createAsyncThunk(
  'game/solvePuzzle',
  async ({ grid, size, horizontalConstraints, verticalConstraints, algorithm, id }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/puzzle/solve`, {
        grid,
        size,
        horizontalConstraints,
        verticalConstraints,
        algorithm: algorithm || 'astar',
        id
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);
export const makeManualMoveAsync = createAsyncThunk(
  'game/makeManualMove',
  async ({ grid, row, col, value, size, horizontalConstraints, verticalConstraints, originalGrid }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/puzzle/move`, {
        grid,
        row,
        col,
        value,
        size,
        horizontalConstraints,
        verticalConstraints,
        originalGrid
      });
      return { ...response.data, row, col, value };
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);
export const validateMoveAsync = createAsyncThunk(
  'game/validateMove',
  async ({ grid, row, col, value, size, horizontalConstraints, verticalConstraints, originalGrid }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/puzzle/validate-move`, {
        grid,
        row,
        col,
        value,
        size,
        horizontalConstraints,
        verticalConstraints,
        originalGrid
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);
export const validateCompleteAsync = createAsyncThunk(
  'game/validateComplete',
  async ({ grid, size, horizontalConstraints, verticalConstraints }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/puzzle/validate-complete`, {
        grid,
        size,
        horizontalConstraints,
        verticalConstraints
      });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);
export const fetchPuzzlesAsync = createAsyncThunk(
  'game/fetchPuzzles',
  async (size, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/puzzle/list/${size}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);
export const fetchPuzzleByIdAsync = createAsyncThunk(
  'game/fetchPuzzleById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/puzzle/${id}`);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);
export const generateRandomPuzzleAsync = createAsyncThunk(
  'game/generateRandomPuzzle',
  async (size, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/puzzle/random`, { size });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);
export const generateRandomPuzzleAnyNumberAsync = createAsyncThunk(
  'game/generateRandomPuzzleAnyNumber',
  async (size, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/puzzle/generate-random`, { size });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);
export const generateKBAsync = createAsyncThunk(
  'game/generateKB',
  async ({ size, puzzleId }, { rejectWithValue }) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/kb/generate`, { size, puzzleId });
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || error.message);
    }
  }
);

const initialState = {
  grid: [],
  originalGrid: [],
  size: 4,
  horizontalConstraints: [],
  verticalConstraints: [],
  
  selectedCell: null,
  isComplete: false,
  isSolved: false,
  mistakes: 0,
  timer: 0,
  isRunning: false,
  difficulty: 'easy',
  
  isLoading: false,
  isSolving: false,
  error: null,
  puzzles: [],
  
  lastSolveStats: null,
  puzzleId: null,
  solution: null,
  generatedKB: null,
  isGeneratingKB: false,
  isSolvedByAI: false,
};

const gameSlice = createSlice({
  name: 'game',
  initialState,
  reducers: {
    loadPuzzle: (state, action) => {
      const { grid, horizontalConstraints, verticalConstraints, size } = action.payload;
      // Tránh việc chung tham chiếu (shared reference) giữa grid và originalGrid
      state.grid = JSON.parse(JSON.stringify(grid));
      state.originalGrid = JSON.parse(JSON.stringify(grid));
      state.horizontalConstraints = horizontalConstraints;
      state.verticalConstraints = verticalConstraints;
      state.size = size;
      state.selectedCell = null;
      state.isComplete = false;
      state.isSolved = false;
      state.mistakes = 0;
      state.timer = 0;
      state.isRunning = true;
      state.error = null;
      state.lastSolveStats = null;
      state.puzzleId = action.payload.id || null;
      state.isSolvedByAI = false;
    },
    
    selectCell: (state, action) => {
      const { row, col } = action.payload;
      if (state.originalGrid[row][col] === 0) {
        state.selectedCell = { row, col };
      }
    },
    
    clearCell: (state) => {
      if (state.selectedCell) {
        const { row, col } = state.selectedCell;
        if (state.originalGrid[row][col] === 0) {
          state.grid[row][col] = 0;
          state.isComplete = false;
          state.isSolved = false;
        }
      }
    },
    
    incrementTimer: (state) => {
      if (state.isRunning && !state.isSolved) {
        state.timer += 1;
      }
    },
    
    solvePuzzle: (state, action) => {
      const { solution } = action.payload;
      if (solution) {
        state.grid = solution;
        state.isSolved = true;
        state.isSolvedByAI = true;
      }
      state.isRunning = false;
      state.isComplete = true;
    },
    
    resetGame: (state) => {
      state.grid = JSON.parse(JSON.stringify(state.originalGrid));
      state.selectedCell = null;
      state.isComplete = false;
      state.isSolved = false;
      state.mistakes = 0;
      state.timer = 0;
      state.isRunning = true;
      state.error = null;
      state.isSolvedByAI = false;
    },
    
    newGame: (state) => {
      state.selectedCell = null;
      state.isComplete = false;
      state.isSolved = false;
      state.mistakes = 0;
      state.timer = 0;
      state.isRunning = true;
      state.error = null;
      state.isSolvedByAI = false;
    },
    
    stopTimer: (state) => {
      state.isRunning = false;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    addMistake: (state) => {
      state.mistakes += 1;
    },
    setIsSolving: (state, action) => {
      state.isSolving = action.payload;
    },
    setPuzzleId: (state, action) => {
      state.puzzleId = action.payload;
    },
    clearKB: (state) => {
      state.generatedKB = null;
    },
  },
  
  extraReducers: (builder) => {
    builder
      .addCase(solvePuzzleAsync.pending, (state) => {
        state.isSolving = true;
        state.error = null;
      })
      .addCase(solvePuzzleAsync.fulfilled, (state, action) => {
        if (!action.payload.success) {
          state.error = action.payload.message || 'Lỗi khi bắt đầu giải';
          state.isSolving = false;
        }
      })
      .addCase(solvePuzzleAsync.rejected, (state, action) => {
        state.isSolving = false;
        state.error = action.payload?.error || 'Có lỗi xảy ra khi giải puzzle';
      })
      
      .addCase(makeManualMoveAsync.fulfilled, (state, action) => {
        const { valid, error, isComplete, isSolved, row, col, value } = action.payload;
        if (valid) {
          // Đảm bảo không ghi đè vào originalGrid bằng cách clone lại grid nếu cần
          const currentGrid = JSON.parse(JSON.stringify(state.grid));
          currentGrid[row][col] = value;
          state.grid = currentGrid;
          
          state.isComplete = isComplete;
          state.isSolved = isSolved;
          state.isSolvedByAI = false;
          if (isSolved) state.isRunning = false;
          state.error = null;
        } else {
          state.mistakes += 1;
          state.error = error;
        }
      })
      .addCase(makeManualMoveAsync.rejected, (state, action) => {
        state.error = action.payload?.error || 'Lỗi kết nối server';
      })
      .addCase(validateMoveAsync.fulfilled, (state, action) => {
        if (!action.payload.valid && action.payload.error) {
          state.mistakes += 1;
          console.error(action.payload.error);
        }
      })
      
      .addCase(validateCompleteAsync.fulfilled, (state, action) => {
        if (action.payload.valid) {
          state.isSolved = true;
          state.isRunning = false;
        } else if (action.payload.error) {
          state.error = action.payload.error;
        }
      })
      
      .addCase(fetchPuzzlesAsync.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(fetchPuzzlesAsync.fulfilled, (state, action) => {
        state.puzzles = action.payload.puzzles || [];
        state.isLoading = false;
      })
      .addCase(fetchPuzzlesAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.error || 'Không thể tải danh sách puzzle';
      })
      
      .addCase(fetchPuzzleByIdAsync.fulfilled, (state, action) => {
        const { puzzle } = action.payload;
        if (puzzle) {
          state.grid = JSON.parse(JSON.stringify(puzzle.grid));
          state.originalGrid = JSON.parse(JSON.stringify(puzzle.grid));
          state.horizontalConstraints = puzzle.horizontalConstraints;
          state.verticalConstraints = puzzle.verticalConstraints;
          state.size = puzzle.grid.length;
          state.selectedCell = null;
          state.isComplete = false;
          state.isSolved = false;
          state.mistakes = 0;
          state.timer = 0;
          state.isRunning = true;
          state.error = null;
          state.puzzleId = puzzle.id || null;
        }
      })
      
      .addCase(generateRandomPuzzleAsync.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(generateRandomPuzzleAsync.fulfilled, (state, action) => {
        const { puzzle } = action.payload;
        if (puzzle) {
          state.grid = JSON.parse(JSON.stringify(puzzle.grid));
          state.originalGrid = JSON.parse(JSON.stringify(puzzle.grid));
          state.horizontalConstraints = puzzle.horizontalConstraints;
          state.verticalConstraints = puzzle.verticalConstraints;
          state.size = puzzle.grid.length;
          state.selectedCell = null;
          state.isComplete = false;
          state.isSolved = false;
          state.mistakes = 0;
          state.timer = 0;
          state.isRunning = true;
          state.error = null;
        }
        state.isLoading = false;
      })
      .addCase(generateRandomPuzzleAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.error || 'Không thể tạo puzzle ngẫu nhiên';
      })
      .addCase(generateRandomPuzzleAnyNumberAsync.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(generateRandomPuzzleAnyNumberAsync.fulfilled, (state, action) => {
        const { puzzle } = action.payload;
        if (puzzle) {
          state.grid = JSON.parse(JSON.stringify(puzzle.grid));
          state.originalGrid = JSON.parse(JSON.stringify(puzzle.grid));
          state.horizontalConstraints = puzzle.horizontalConstraints;
          state.verticalConstraints = puzzle.verticalConstraints;
          state.size = puzzle.grid.length;
          state.selectedCell = null;
          state.isComplete = false;
          state.isSolved = false;
          state.mistakes = 0;
          state.timer = 0;
          state.isRunning = true;
          state.error = null;
          state.puzzleId = puzzle.id || null;
        }
        state.isLoading = false;
      })
      .addCase(generateRandomPuzzleAnyNumberAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload?.error || 'Không thể tạo puzzle ngẫu nhiên';
      })
      .addCase(generateKBAsync.pending, (state) => {
        state.isGeneratingKB = true;
        state.error = null;
      })
      .addCase(generateKBAsync.fulfilled, (state, action) => {
        state.generatedKB = action.payload.clauses;
        state.isGeneratingKB = false;
      })
      .addCase(generateKBAsync.rejected, (state, action) => {
        state.isGeneratingKB = false;
        state.error = action.payload?.error || 'Không thể tạo Knowledge Base';
      });
  }
});

export const {
  loadPuzzle,
  selectCell,
  clearCell,
  incrementTimer,
  solvePuzzle,
  resetGame,
  newGame,
  stopTimer,
  setError,
  clearError,
  addMistake,
  setIsSolving,
  clearKB
} = gameSlice.actions;

export const selectGrid = (state) => state.game.grid;
export const selectOriginalGrid = (state) => state.game.originalGrid;
export const selectSize = (state) => state.game.size;
export const selectSelectedCell = (state) => state.game.selectedCell;
export const selectIsComplete = (state) => state.game.isComplete;
export const selectIsSolved = (state) => state.game.isSolved;
export const selectIsSolvedByAI = (state) => state.game.isSolvedByAI;
export const selectMistakes = (state) => state.game.mistakes;
export const selectTimer = (state) => state.game.timer;
export const selectIsRunning = (state) => state.game.isRunning;
export const selectIsLoading = (state) => state.game.isLoading;
export const selectIsSolving = (state) => state.game.isSolving;
export const selectError = (state) => state.game.error;
export const selectPuzzles = (state) => state.game.puzzles;
export const selectLastSolveStats = (state) => state.game.lastSolveStats;
export const selectHorizontalConstraints = (state) => state.game.horizontalConstraints;
export const selectVerticalConstraints = (state) => state.game.verticalConstraints;
export const selectPuzzleId = (state) => state.game.puzzleId;
export const selectGeneratedKB = (state) => state.game.generatedKB;
export const selectIsGeneratingKB = (state) => state.game.isGeneratingKB;

export default gameSlice.reducer;