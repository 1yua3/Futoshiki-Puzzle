import React, { useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  resetGame, 
  clearCell, 
  newGame, 
  solvePuzzleAsync, 
  validateCompleteAsync, 
  makeManualMoveAsync, 
  selectPuzzleId,
  generateKBAsync,
  selectGeneratedKB,
  selectIsGeneratingKB,
  clearKB
} from '../redux/gameSlice';
import SolverPanel from './SolverPanel';
import Button from './Button';

const GameControls = () => {
  const dispatch = useDispatch();
  const { 
    grid, 
    size, 
    horizontalConstraints, 
    verticalConstraints, 
    originalGrid,
    isSolved, 
    isComplete, 
    isSolving, 
    selectedCell 
  } = useSelector((state) => state.game);
  
  const puzzleId = useSelector(selectPuzzleId);
  const generatedKB = useSelector(selectGeneratedKB);
  const isGeneratingKB = useSelector(selectIsGeneratingKB);
  const [algorithm, setAlgorithm] = useState('astar');
  const [showKB, setShowKB] = useState(false);

  const handleReset = () => {
    dispatch(resetGame());
  };

  const handleGenerateKB = () => {
    if (!size) return;
    dispatch(generateKBAsync({ size }));
    setShowKB(true);
  };

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="space-y-4">
        <SolverPanel puzzleId={puzzleId} algorithm={algorithm} />
        {puzzleId && (
          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-3 border border-blue-200">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-gray-700">
                 Puzzle #{puzzleId}
              </span>
              <span className="text-sm text-gray-500">
                {size}x{size}
              </span>
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <label className="font-semibold text-gray-700"> Giải bằng thuật toán:</label>
          <div className="grid grid-cols-5 gap-2">
            {[
              { id: 'astar', label: 'A* Algorithm', color: 'purple' },
              { id: 'backtracking', label: 'Backtracking', color: 'indigo' },
              { id: 'forward', label: 'Forward Chaining', color: 'blue' },
              { id: 'backward', label: 'Backward Chaining', color: 'cyan' },
              { id: 'brute_force', label: 'Brute Force', color: 'blue' }
            ].map((algo) => (
              <Button
                key={algo.id}
                onClick={() => {
                  if (!puzzleId) {
                    alert(' Vui lòng chọn puzzle trước!');
                    return;
                  }
                  setAlgorithm(algo.id);
                  dispatch(solvePuzzleAsync({
                    grid, 
                    size, 
                    horizontalConstraints, 
                    verticalConstraints, 
                    algorithm: algo.id, 
                    id: puzzleId
                  })).unwrap().catch((err) => {
                    alert(` Lỗi gọi API giải (${algo.label}): ` + (err.message || err));
                  });
                }}
                disabled={isSolving}
                color={algo.color}
                className="text-xs sm:text-sm py-2 px-1"
              >
                {algo.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 mt-4">
          <button
            onClick={handleReset}
            className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg 
                       hover:from-yellow-600 hover:to-orange-600 transition-all font-semibold shadow-md"
          >
             Reset
          </button>     
          <button
            onClick={() => dispatch(newGame())}
            className="px-4 py-2 bg-gradient-to-r from-blue-500 to-cyan-500 text-white rounded-lg 
                       hover:from-blue-600 hover:to-cyan-600 transition-all font-semibold shadow-md"
          >
             Game mới
          </button>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <Button
            onClick={handleGenerateKB}
            disabled={isGeneratingKB}
            color="green"
            className="w-full py-3 text-base font-bold uppercase tracking-wider shadow-lg"
          >
            {isGeneratingKB ? 'Đang tạo KB...' : 'Tạo Ground Knowledge Base'}
          </Button>

          {showKB && generatedKB && (
            <div className="mt-4 bg-white rounded-xl border border-gray-300 p-3 shadow-xl max-h-64 overflow-y-auto">
              <div className="flex justify-between items-center mb-2">
                <h4 className="text-green-400 font-mono text-md underline">Ground Clauses ({generatedKB.length})</h4>
                <button 
                  onClick={() => setShowKB(false)}
                  className="text-gray-400 hover:text-black text-md"
                >
                  Đóng
                </button>
              </div>
              <div className="font-mono text-[20px] text-green-500 space-y-1">
                {generatedKB.slice(0, 500).map((clause, idx) => (
                  <div key={idx} className="border-b border-gray-800 pb-1">
                    <span className="text-gray-600 mr-2">{idx + 1}.</span>
                    {clause}
                  </div>
                ))}
                {generatedKB.length > 500 && (
                  <div className="text-gray-500 italic">... and {generatedKB.length - 500} more clauses</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GameControls;