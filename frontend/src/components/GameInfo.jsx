import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { incrementTimer, stopTimer } from '../redux/gameSlice';

const GameInfo = () => {
  const dispatch = useDispatch();
  const { timer, isSolved, isComplete, size } = useSelector((state) => state.game);
  
  useEffect(() => {
    let interval;
    if (!isSolved && !isComplete) {
      interval = setInterval(() => {
        dispatch(incrementTimer());
      }, 1000);
    } else if (isComplete || isSolved) {
      dispatch(stopTimer());
    }
    
    return () => clearInterval(interval);
  }, [isSolved, isComplete, dispatch]);
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <div className="space-y-4">
        <div className="text-center">
          <div className="text-3xl font-bold text-blue-600">
            {size} x {size}
          </div>
          <div className="text-gray-500 mt-1">Futoshiki Puzzle</div>
        </div>
        
        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-gray-600"> Thời gian:</span>
            <span className="text-2xl font-mono font-bold text-gray-800">
              {formatTime(timer)}
            </span>
          </div>
        </div>
        
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
          <h3 className="font-semibold text-gray-700 mb-2"> Luật chơi:</h3>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Mỗi hàng có các số từ 1 đến {size}</li>
            <li>• Mỗi cột có các số từ 1 đến {size}</li>
            <li>• &lt; nghĩa là trái &lt; phải</li>
            <li>• &gt; nghĩa là trái &gt; phải</li>
            <li>• ↑ nghĩa là trên &lt; dưới</li>
            <li>• ↓ nghĩa là trên &gt; dưới</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default GameInfo;