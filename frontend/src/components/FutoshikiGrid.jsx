import React, { useState, useEffect, useRef } from 'react';
import './FloatingNumberPad.css';
import { useDispatch, useSelector } from 'react-redux';
import { selectCell, makeManualMoveAsync } from '../redux/gameSlice';

const FutoshikiGrid = () => {
  const dispatch = useDispatch();
  const { grid, size, horizontalConstraints, verticalConstraints, originalGrid, selectedCell } = 
    useSelector((state) => state.game);

  const [showPad, setShowPad] = useState(false);
  const [padPosition, setPadPosition] = useState({ top: 0, left: 0 });

  const padRef = useRef(null);

  const handleCellClick = (row, col) => {
    dispatch(selectCell({ row, col }));
    if (showPad && (selectedCell?.row !== row || selectedCell?.col !== col)) {
      setShowPad(false);
    }
  };

  const handleCellDoubleClick = (e, row, col) => {
    if (originalGrid[row][col] !== 0) return;
    
    const rect = e.target.getBoundingClientRect();
    setPadPosition({
      top: rect.top + window.scrollY,
      left: rect.left + window.scrollX + rect.width / 2
    });
    setShowPad(true);
    dispatch(selectCell({ row, col }));
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (padRef.current && !padRef.current.contains(event.target)) {
        setShowPad(false);
      }
    };
    if (showPad) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPad]);

  const handleKeyPress = (e) => {
    if (!selectedCell) return;
    
    const { row, col } = selectedCell;
    const key = e.key;
    
    if (key >= '1' && key <= size.toString()) {
      dispatch(makeManualMoveAsync({ 
        grid, row, col, value: parseInt(key), size, 
        horizontalConstraints, verticalConstraints,
        originalGrid
      }));
    } else if (key === 'Delete' || key === 'Backspace' || key === '0') {
      dispatch(makeManualMoveAsync({ 
        grid, row, col, value: 0, size, 
        horizontalConstraints, verticalConstraints,
        originalGrid
      }));
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedCell, size, grid, horizontalConstraints, verticalConstraints, originalGrid]);

  const getInequalitySymbol = (type) => {
    if (type === 1) return '<';
    if (type === -1) return '>';
    return null;
  };

  const getCellSize = () => {
    if (size <= 4) return 'w-16 h-16 sm:w-20 sm:h-20';
    if (size <= 6) return 'w-14 h-14 sm:w-16 sm:h-16';
    if (size <= 8) return 'w-10 h-10 sm:w-12 sm:h-12';
    return 'w-8 h-8 sm:w-10 sm:h-10'; 
  };

  const getFontSize = () => {
    if (size <= 4) return 'text-2xl sm:text-3xl';
    if (size <= 6) return 'text-xl sm:text-2xl';
    if (size <= 8) return 'text-base sm:text-lg';
    return 'text-sm sm:text-base'; 
  };

  const getConstraintWidth = () => {
    if (size <= 4) return 'w-8';
    if (size <= 6) return 'w-6';
    if (size <= 8) return 'w-5';
    return 'w-4'; 
  };

  const getConstraintHeight = () => {
    if (size <= 4) return 'h-8';
    if (size <= 6) return 'h-6';
    if (size <= 8) return 'h-5';
    return 'h-4';
  };

  const getConstraintFontSize = () => {
    if (size <= 4) return 'text-xl';
    if (size <= 6) return 'text-lg';
    if (size <= 8) return 'text-base';
    return 'text-xs sm:text-sm';
  };

  if (!grid || grid.length === 0 || !originalGrid || originalGrid.length === 0) {
    return <div className="flex justify-center p-8 text-gray-500 font-semibold">Đang tải puzzle...</div>;
  }

  const cellSize = getCellSize();
  const fontSize = getFontSize();
  const constraintWidth = getConstraintWidth();
  const constraintHeight = getConstraintHeight();
  const constraintFontSize = getConstraintFontSize();

  return (
    <div className="flex justify-center items-center p-2 sm:p-4 relative">
      <div className="overflow-auto max-w-full max-h-[75vh] p-2">
        <div className="inline-block min-w-max">
          {Array(size).fill().map((_, i) => (
            <div key={i} className="flex flex-col">
              <div className="flex">
                {Array(size).fill().map((_, j) => (
                  <React.Fragment key={`cell-${i}-${j}`}>
                    <div
                      className={`
                        ${cellSize}
                        border-2 border-gray-400 text-black
                        flex items-center justify-center
                        ${fontSize}
                        font-bold
                        transition-all duration-200
                        cursor-pointer
                        select-none
                        ${originalGrid[i][j] !== 0 
                          ? 'bg-gray-100 text-gray-700' 
                          : 'bg-white hover:bg-blue-50'
                        }
                        ${selectedCell?.row === i && selectedCell?.col === j
                          ? 'ring-4 ring-blue-400 bg-blue-100'
                          : ''
                        }
                      `}
                      onClick={() => handleCellClick(i, j)}
                      onDoubleClick={(e) => handleCellDoubleClick(e, i, j)}
                    >
                      {grid[i][j] !== 0 ? grid[i][j] : ''}
                    </div>
                    
                    {j < size - 1 && (
                      <div className={`flex items-center justify-center ${constraintWidth}`}>
                        {horizontalConstraints[i]?.[j] !== 0 && (
                          <span className={`inequality-sign ${constraintFontSize} font-bold text-gray-700`}>
                            {getInequalitySymbol(horizontalConstraints[i][j])}
                          </span>
                        )}
                      </div>
                    )}
                  </React.Fragment>
                ))}
              </div>
              
              {i < size - 1 && (
                <div className="flex">
                  {Array(size).fill().map((_, j) => (
                    <React.Fragment key={`v-${i}-${j}`}>
                      <div className={`${cellSize} ${constraintHeight} flex items-center justify-center`}>
                        {verticalConstraints[i]?.[j] !== 0 && (
                          <span className={`inequality-sign ${constraintFontSize} font-bold text-gray-700`}>
                            {verticalConstraints[i][j] === -1 ? '∨' : '∧'}
                          </span>
                        )}
                      </div>
                      {j < size - 1 && <div className={constraintWidth}></div>}
                    </React.Fragment>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {showPad && selectedCell && (
        <div 
          ref={padRef}
          className="floating-number-pad"
          style={{ 
            position: 'absolute',
            top: padPosition.top - 140,
            left: padPosition.left,
            transform: 'translateX(-50%)',
            zIndex: 1000
          }}
        >
          <div className="grid grid-cols-3 gap-1 p-2 bg-white rounded-xl shadow-2xl border border-gray-200">
            {Array(size).fill().map((_, i) => (
              <button
                key={i + 1}
                onClick={() => {
                  dispatch(makeManualMoveAsync({ 
                    grid, row: selectedCell.row, col: selectedCell.col, value: i + 1, size, 
                    horizontalConstraints, verticalConstraints,
                    originalGrid
                  }));
                  setShowPad(false);
                }}
                className="w-10 h-10 bg-blue-500 text-white rounded-lg hover:bg-blue-600 font-bold transition-colors"
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => {
                dispatch(makeManualMoveAsync({ 
                  grid, row: selectedCell.row, col: selectedCell.col, value: 0, size, 
                  horizontalConstraints, verticalConstraints,
                  originalGrid
                }));
                setShowPad(false);
              }}
              className="w-10 h-10 bg-red-500 text-white rounded-lg hover:bg-red-600 font-bold transition-colors col-span-full"
            >
              ⌫
            </button>
          </div>
          <div className="pad-arrow"></div>
        </div>
      )}
    </div>
  );
};

export default FutoshikiGrid;