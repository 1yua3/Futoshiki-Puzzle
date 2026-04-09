import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { 
  loadPuzzle, 
  fetchPuzzlesAsync, 
  generateRandomPuzzleAsync,
  selectPuzzles,
  selectIsLoading,
  selectError,
  generateRandomPuzzleAnyNumberAsync
} from '../redux/gameSlice';

const PuzzleSelector = () => {
  const dispatch = useDispatch();
  const [selectedSize, setSelectedSize] = useState(4);
  const [selectedSizeAnyNumber, setSelectedSizeAnyNumber] = useState(4);
  const puzzles = useSelector(selectPuzzles);
  const isLoading = useSelector(selectIsLoading);
  const error = useSelector(selectError);
  
  useEffect(() => {
    dispatch(fetchPuzzlesAsync(selectedSize));
  }, [selectedSize, dispatch]);
  
  const handleLoadPuzzle = (puzzle) => {
    dispatch(loadPuzzle({
      grid: puzzle.grid,
      horizontalConstraints: puzzle.horizontalConstraints,
      verticalConstraints: puzzle.verticalConstraints,
      size: selectedSize,
      id: puzzle.id
    }));
  };
  
  const handleRandomPuzzle = () => {
    dispatch(generateRandomPuzzleAsync(selectedSize));
  };
  const handleRandomPuzzleAnyNumber = () => {
    dispatch(generateRandomPuzzleAnyNumberAsync(selectedSizeAnyNumber));
  };
  
  const sizes = [4, 5, 6, 7, 9];
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h3 className="font-bold text-lg text-gray-800 mb-4"> Chọn Puzzle</h3>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Kích thước:
          </label>
          <input type="number" min={1} onChange={(e)=> setSelectedSizeAnyNumber(e.target.value)} className='w-full text-black px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent'/>
        </div>
        
        <button
          onClick={handleRandomPuzzleAnyNumber}
          disabled={isLoading}
          className={`w-full px-4 py-2 bg-gradient-to-r from-green-400 to-blue-500 
                     text-white rounded-lg hover:from-green-500 hover:to-blue-600 
                     transition-all font-semibold shadow-md ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? 'Đang tải...' : 'Tạo'}
        </button>
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Kích thước:
          </label>
          <div className="flex flex-wrap gap-2">
            {sizes.map(size => (
              <button
                key={size}
                onClick={() => setSelectedSize(size)}
                className={`
                  px-4 py-2 rounded-lg font-semibold transition-all
                  ${selectedSize === size 
                    ? 'bg-blue-500 text-white shadow-md' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }
                `}
              >
                {size}x{size}
              </button>
            ))}
          </div>
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Puzzle mẫu
          </label>
          {isLoading && <p className="text-gray-500 text-sm">Đang tải...</p>}
          {error && <p className="text-red-500 text-sm">{error}</p>}
          {!isLoading && puzzles.length === 0 && !error && (
            <p className="text-gray-500 text-sm">Không có puzzle cho kích thước này.</p>
          )}
          
          <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
            {!isLoading && puzzles.map((puzzle, index) => (
              <button
                key={puzzle.id}
                onClick={() => handleLoadPuzzle(puzzle)}
                className="w-full text-black text-left px-4 py-2 bg-gray-100 hover:bg-blue-50 
                           rounded-lg transition-colors border-l-4 border-blue-400"
              >
                input-{puzzle.id}.txt
              </button>
            ))}
          </div>
        </div>
        
        <button
          onClick={handleRandomPuzzle}
          disabled={isLoading}
          className={`w-full px-4 py-2 bg-gradient-to-r from-green-400 to-blue-500 
                     text-white rounded-lg hover:from-green-500 hover:to-blue-600 
                     transition-all font-semibold shadow-md ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          {isLoading ? 'Đang tải...' : ' Random Mẫu'}
        </button>
      </div>
    </div>
  );
};

export default PuzzleSelector;