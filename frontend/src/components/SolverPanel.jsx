import React, { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { setIsSolving, solvePuzzle } from '../redux/gameSlice';

const SOCKET_URL = 'http://localhost:5000';

const SolverPanel = ({ puzzleId, algorithm, onSolverStart }) => {
  const dispatch = useDispatch();
  const socketRef = useRef(null);
  const { isSolving } = useSelector((state) => state.game);
  
  const [progress, setProgress] = useState(null);
  const [solverStats, setSolverStats] = useState({
    nodesExplored: 0,
    currentDepth: 0,
    bestHeuristic: 0,
    currentHeuristic: 0,
    filledCells: '0/0',
    explorationRate: 0,
    estimatedRemaining: 'calculating...'
  });
  const [statusMessage, setStatusMessage] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  
  const [showResultDialog, setShowResultDialog] = useState(false);
  const [solverResults, setSolverResults] = useState(null);
  const [isError, setIsError] = useState(false);
  const hasShownResultRef = useRef(false); 

  useEffect(() => {
    if (isSolving) {
      hasShownResultRef.current = false;
      setShowResultDialog(false);
      setSolverResults(null);
      setIsError(false);
    }
  }, [isSolving]);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on('connect', () => {
      console.log('SolverPanel: Socket connected');
    });

    socketRef.current.on('solver_progress', (data) => {
      if (data.game_id === puzzleId) {
        setProgress(data);
        setSolverStats({
          nodesExplored: data.nodes_explored || 0,
          currentDepth: data.current_depth || 0,
          bestHeuristic: data.best_heuristic || 0,
          currentHeuristic: data.current_heuristic || 0,
          filledCells: data.filled_cells || '0/0',
          explorationRate: data.exploration_rate || 0,
          estimatedRemaining: data.estimated_remaining || 'calculating...'
        });
        setStatusMessage(` ${data.solver || 'A*'} searching...`);
      }
    });

    socketRef.current.on('solver_complete', (data) => {
      if (data.puzzle_id === puzzleId && !hasShownResultRef.current) {
        hasShownResultRef.current = true;
        dispatch(setIsSolving(false));
        
        if (data.success) {
          dispatch(solvePuzzle({ solution: data.solution }));
          
          setSolverResults({
            ...data,
            stats: {
              nodesExplored: data.results.nodes_explored,
              visitedNodes: data.results.visited_nodes,
              timeTaken: data.results.time_taken,
              solutionLength: data.results.solution_length,
              bestHeuristic: data.results.best_heuristic,
              startHeuristic: data.results.start_heuristic,
              maxDepth: data.results.max_depth,
              avgBranching: data.results.avg_branching,
              memoryUsed: data.results.memory_used,
              puzzleSize: data.results.puzzle_size,
              givenCells: data.results.given_cells,
            }
          });
          setIsError(false);
          setStatusMessage(` Solution found! ${data.results.nodes_explored?.toLocaleString()} nodes`);
        } else {
          setSolverResults({
            solver: data.solver,
            success: false,
            stats: {
              nodesExplored: data.results.nodes_explored || 0,
              visitedNodes: data.results.visited_nodes || 0,
              timeTaken: data.results.time_taken || 0,
              solutionLength: 0,
              bestHeuristic: data.results.best_heuristic || 0,
              startHeuristic: data.results.start_heuristic || 0,
              maxDepth: data.results.max_depth || 0,
              avgBranching: data.results.avg_branching || 0,
              memoryUsed: data.results.memory_used || 0,
              puzzleSize: data.results.puzzle_size || 4,
              givenCells: data.results.given_cells || 0,
            }
          });
          setIsError(false);
          setStatusMessage(` No solution found`);
        }
        setShowResultDialog(true);
      }
    });

    socketRef.current.on('solver_error', (data) => {
      if (data.puzzle_id === puzzleId && !hasShownResultRef.current) {
        hasShownResultRef.current = true;
        dispatch(setIsSolving(false));
        
        setSolverResults({
          solver: data.solver,
          success: false,
          error: data.error,
          stats: {
            nodesExplored: data.results?.nodes_explored || 0,
            visitedNodes: data.results?.visited_nodes || 0,
            timeTaken: data.results?.time_taken || 0,
            solutionLength: 0,
            bestHeuristic: data.results?.best_heuristic || 0,
            startHeuristic: data.results?.start_heuristic || 0,
            maxDepth: data.results?.max_depth || 0,
            avgBranching: data.results?.avg_branching || 0,
            memoryUsed: data.results?.memory_used || 0,
            puzzleSize: data.results?.puzzle_size || 4,
            givenCells: data.results?.given_cells || 0,
          }
        });
        setIsError(true);
        setStatusMessage(` Error: ${data.error}`);
        setShowResultDialog(true);
        setProgress(null);
      }
    });

    socketRef.current.on('solver_cancelled', (data) => {
      if (data.puzzle_id === puzzleId) {
        dispatch(setIsSolving(false));
        setStatusMessage(' Solver cancelled');
        setProgress(null);
        hasShownResultRef.current = false;
      }
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [puzzleId, dispatch]);

  const handleCancel = () => {
    if (socketRef.current && puzzleId) {
      socketRef.current.emit('cancel_solver', { puzzle_id: puzzleId });
    }
  };

  const handleCloseDialog = () => {
    setShowResultDialog(false);
    setSolverResults(null);
    setIsError(false);
    setStatusMessage('');
    hasShownResultRef.current = false; 
  };

  const ResultDialog = () => {
    if (!showResultDialog || !solverResults) return null;
    
    const stats = solverResults.stats;
    const isSuccess = solverResults.success;
    const errorMsg = solverResults.error;
    
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        onClick={handleCloseDialog}
      >
        <motion.div
          initial={{ scale: 0.9, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.9, y: 20 }}
          className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl max-h-[90vh] overflow-y-auto border border-gray-100"
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`relative -m-6 mb-6 p-6 rounded-t-3xl bg-gradient-to-r ${
            isSuccess 
              ? 'from-emerald-500 to-teal-500' 
              : isError 
                ? 'from-rose-500 to-pink-500' 
                : 'from-slate-500 to-gray-500'
          }`}>
            <div className="absolute inset-0 bg-white/10 rounded-t-3xl"></div>
            <div className="relative flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    {isSuccess ? 'Solution Found!' : isError ? 'Solver Error' : 'No Solution'}
                  </h2>
                  <p className="text-white/80 text-sm mt-1">
                    {solverResults.solver || 'A*'} Algorithm
                  </p>
                </div>
              </div>
              <button
                onClick={handleCloseDialog}
                className="w-10 h-10 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center hover:bg-white/30 transition-all"
              >
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {isError && errorMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 p-4 bg-rose-50 border border-rose-200 rounded-2xl"
            >
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="text-sm font-semibold text-rose-800 mb-1">Error Details:</div>
                  <div className="text-sm text-rose-700 break-words">{errorMsg}</div>
                </div>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              {
                label: 'Nodes Explored',
                value: stats.nodesExplored?.toLocaleString() || 0,
                gradient: 'from-blue-500 to-indigo-500',
                bgGradient: 'from-blue-50 to-indigo-50'
              },
              {
                label: 'Time Taken',
                value: `${stats.timeTaken?.toFixed(3) || 0}s`,
                gradient: 'from-emerald-500 to-green-500',
                bgGradient: 'from-emerald-50 to-green-50'
              },
              {
                label: 'Solution Length',
                value: stats.solutionLength || 0,
                gradient: 'from-purple-500 to-pink-500',
                bgGradient: 'from-purple-50 to-pink-50'
              },
              {
                label: 'Max Depth',
                value: stats.maxDepth || 0,
                gradient: 'from-orange-500 to-amber-500',
                bgGradient: 'from-orange-50 to-amber-50'
              }
            ].map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`bg-gradient-to-br ${isSuccess ? item.bgGradient : 'from-gray-50 to-gray-100'} rounded-2xl p-4 border border-gray-100`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-xs font-medium text-gray-500">{item.label}</div>
                </div>
                <div className={`text-2xl font-bold bg-gradient-to-r ${item.gradient} bg-clip-text text-transparent`}>
                  {item.value}
                </div>
              </motion.div>
            ))}
          </div>

          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-2xl p-4 mb-4 border border-gray-100"
          >
            <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
              Additional Metrics
            </h3>
            <div className="space-y-2">
              {[
                { label: 'Visited Nodes', value: stats.visitedNodes?.toLocaleString() || 0 },
                { 
                  label: 'Best Heuristic', 
                  value: solverResults.solver === 'astar' ? (stats.bestHeuristic?.toFixed(2) || 0) : 'N/A' 
                },
                { 
                  label: 'Start Heuristic', 
                  value: solverResults.solver === 'astar' ? (stats.startHeuristic?.toFixed(2) || 0) : 'N/A' 
                },
                { label: 'Avg Branching', value: stats.avgBranching?.toFixed(2) || 0 },
                { 
                  label: 'Memory Used', 
                  value: stats.memoryUsed ? `${(stats.memoryUsed / 1024 / 1024).toFixed(2)} MB` : 'N/A' 
                },
                { 
                  label: 'Given Cells', 
                  value: `${stats.givenCells || 0} / ${stats.puzzleSize ? stats.puzzleSize * stats.puzzleSize : 0}` 
                }
              ].map((item, index) => (
                <div key={index} className="flex justify-between items-center py-1.5 px-2 hover:bg-white/50 rounded-lg transition-colors">
                  <span className="text-sm text-gray-600">{item.label}:</span>
                  <span className="text-sm font-semibold text-gray-800">{item.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          <div className="flex gap-3">
            <button
              onClick={handleCloseDialog}
              className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-all font-medium text-sm"
            >
              Close
            </button>
            {isSuccess && (
              <button
                onClick={handleCloseDialog}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-xl hover:from-blue-600 hover:to-indigo-600 transition-all font-medium text-sm shadow-lg shadow-blue-500/25"
              >
                View Solution 
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    );
  };

  const clearStatus = () => {
    setStatusMessage('');
    setProgress(null);
    hasShownResultRef.current = false;
  };

  if (!isSolving && !progress && !statusMessage && !showResultDialog) {
    return null;
  }

  return (
    <>
      <AnimatePresence>
        {showResultDialog && <ResultDialog />}
      </AnimatePresence>

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="mb-4 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-2xl p-5 border border-purple-200/50 shadow-xl backdrop-blur-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              {isSolving && (
                <div className="relative">
                  <svg className="animate-spin h-6 w-6 text-purple-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <div className="absolute inset-0 animate-ping bg-purple-400 rounded-full opacity-20"></div>
                </div>
              )}
              <div>
                <span className="font-bold text-gray-800 text-lg">
                  {statusMessage || '🤖 AI Solver'}
                </span>
                {isSolving && (
                  <p className="text-xs text-gray-500 mt-0.5">Solving puzzle...</p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {statusMessage && !isSolving && (
                <button
                  onClick={clearStatus}
                  className="px-3 py-1.5 text-xs bg-white/50 backdrop-blur-sm text-gray-600 rounded-lg hover:bg-white/80 transition-all"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="px-3 py-1.5 text-xs bg-white/50 backdrop-blur-sm text-purple-600 rounded-lg hover:bg-white/80 transition-all font-medium"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
              </button>
              {isSolving && (
                <button
                  onClick={handleCancel}
                  className="px-4 py-1.5 bg-gradient-to-r from-red-500 to-rose-500 text-white text-sm rounded-lg hover:from-red-600 hover:to-rose-600 transition-all shadow-lg shadow-red-500/25 font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>

          {isSolving && (
            <>
              <div className="mb-4">
                <div className="flex justify-between text-xs font-medium text-gray-600 mb-2">
                  <span>Progress</span>
                  <span className="text-purple-600">{Math.round(progress?.progress || 0)}%</span>
                </div>
                <div className="w-full bg-gray-200/50 rounded-full h-3 overflow-hidden backdrop-blur-sm">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 via-pink-500 to-indigo-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress?.progress || 0}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">🔍</span>
                    <div className="text-xs font-medium text-gray-500">Nodes</div>
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {solverStats.nodesExplored.toLocaleString()}
                  </div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">📊</span>
                    <div className="text-xs font-medium text-gray-500">Depth</div>
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {solverStats.currentDepth}
                  </div>
                </div>
                <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-white/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-sm">⚡</span>
                    <div className="text-xs font-medium text-gray-500">Speed</div>
                  </div>
                  <div className="text-lg font-bold text-gray-800">
                    {solverStats.explorationRate.toLocaleString()}/s
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {showDetails && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-purple-200/50">
                      <div className="bg-white/40 backdrop-blur-sm rounded-xl p-3">
                        <div className="text-xs font-medium text-gray-500 mb-1">Best Heuristic</div>
                        <div className="text-base font-bold text-purple-600">
                          {solverStats.bestHeuristic.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-white/40 backdrop-blur-sm rounded-xl p-3">
                        <div className="text-xs font-medium text-gray-500 mb-1">Current Heuristic</div>
                        <div className="text-base font-bold text-indigo-600">
                          {solverStats.currentHeuristic.toFixed(2)}
                        </div>
                      </div>
                      <div className="bg-white/40 backdrop-blur-sm rounded-xl p-3">
                        <div className="text-xs font-medium text-gray-500 mb-1">Filled Cells</div>
                        <div className="text-base font-bold text-pink-600">
                          {solverStats.filledCells}
                        </div>
                      </div>
                      <div className="bg-white/40 backdrop-blur-sm rounded-xl p-3">
                        <div className="text-xs font-medium text-gray-500 mb-1">Est. Remaining</div>
                        <div className="text-base font-bold text-orange-600">
                          {solverStats.estimatedRemaining}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </>
  );
};

export default SolverPanel;