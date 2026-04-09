import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { io } from "socket.io-client";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || "http://localhost:5000";
const API_URL = process.env.REACT_APP_API_URL || "http://localhost:5000";

const GameSolver = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const boardRef = useRef(null);

  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [selectedCards, setSelectedCards] = useState([]);

  const [dragging, setDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [dragSource, setDragSource] = useState(null);

  const [showSolverDialog, setShowSolverDialog] = useState(false);
  const [solverResults, setSolverResults] = useState(null);
  const [solving, setSolving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [solverStats, setSolverStats] = useState({
    nodesExplored: 0,
    maxFrontier: 0,
    elapsedTime: 0,
    speed: 0,
  });
  const [currentStep, setCurrentStep] = useState(0);
  const [animating, setAnimating] = useState(false);

  const SCREEN_WIDTH = window.innerWidth > 1200 ? 1200 : window.innerWidth - 40;
  const SCREEN_HEIGHT = 700;
  const CARD_WIDTH = 80;
  const CARD_HEIGHT = 112;
  const CARD_PADDING = 10;

  const FREE_CELL_START_X = 20;
  const FREE_CELL_START_Y = 50;

  const FOUNDATION_START_X =
    SCREEN_WIDTH - 4 * (CARD_WIDTH + CARD_PADDING) - 20;
  const FOUNDATION_START_Y = 50;

  const CASCADE_START_X = 50;
  const CASCADE_START_Y = 220;
  const CASCADE_SPACING = Math.floor((SCREEN_WIDTH - 100 - CARD_WIDTH) / 7);

  useEffect(() => {
    socketRef.current = io(SOCKET_URL);

    socketRef.current.on("state_update", (data) => {
      if (data.game_id === gameId) {
        setGameState(data.state);
        if (data.last_move) {
          setStatusMessage("Move applied");
        }
      }
    });

    socketRef.current.on("solver_progress", (data) => {
      if (data.game_id === gameId && solving) {
        setProgress(data.progress || 0);
        setSolverStats({
          nodesExplored: data.nodes_explored || 0,
          maxFrontier: data.max_frontier || 0,
          elapsedTime: data.elapsed_time || 0,
          speed: data.speed || 0,
        });
        setStatusMessage(data.message || "Solving...");
      }
    });

    socketRef.current.on("solver_complete", (data) => {
      if (data.game_id === gameId) {
        setSolving(false);
        if (data.success) {
          setSolverResults(data);
          setShowSolverDialog(true);
          setProgress(100);
          setStatusMessage(`✅ Solution found! ${data.moves_count} moves`);
        } else {
          setStatusMessage(
            `❌ No solution found. Explored ${data.metrics?.nodes_explored || 0} nodes`,
          );
          setProgress(0);
        }
      }
    });

    socketRef.current.on("solver_error", (data) => {
      if (data.game_id === gameId) {
        setSolving(false);
        setStatusMessage(`❌ Solver error: ${data.error}`);
        setProgress(0);
      }
    });

    return () => {
      socketRef.current.disconnect();
    };
  }, [gameId, solving]);

  // Global mouse up handler
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragging) {
        setDragging(false);
        setSelectedCards([]);
        setDragSource(null);
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => window.removeEventListener("mouseup", handleGlobalMouseUp);
  }, [dragging]);

  // Handle solve with A*
  const handleSolve = async () => {
    if (solving || !gameState) return;

    setSolving(true);
    setProgress(0);
    setShowSolverDialog(false);
    setSolverResults(null);
    setStatusMessage("🔄 Initializing A* search...");

    try {
      // Emit socket event to start solving
      socketRef.current.emit("start_solver", {
        game_id: gameId,
        state: gameState,
        solver: "astar",
        time_limit: 60, // 60 seconds time limit
      });
    } catch (err) {
      console.error("Failed to start solver:", err);
      setSolving(false);
      setStatusMessage("❌ Failed to start solver");
    }
  };

  // Handle solve with HTTP (fallback)
  const handleSolveHTTP = async () => {
    if (solving || !gameState) return;

    setSolving(true);
    setProgress(0);
    setStatusMessage("🔄 Running A* solver...");

    try {
      const response = await axios.post(
        `${API_URL}/api/game/${gameId}/solve`,
        {
          cascades: gameState.cascades,
          free_cells: gameState.free_cells,
          foundations: gameState.foundations,
          time_limit: 60,
        },
        {
          withCredentials: true,
          headers: { "Content-Type": "application/json" },
        },
      );

      if (response.data.success) {
        setSolverResults(response.data);
        setShowSolverDialog(true);
        setProgress(100);
        setStatusMessage(
          `✅ Found solution in ${response.data.metrics.solve_time.toFixed(2)}s!`,
        );
      } else {
        setStatusMessage(
          `❌ No solution found. Explored ${response.data.metrics?.nodes_explored || 0} nodes`,
        );
      }
    } catch (err) {
      console.error("Solver error:", err);
      handleSolverError(err);
    } finally {
      setSolving(false);
    }
  };

  const handleSolverError = (err) => {
    if (err.response) {
      setStatusMessage(`❌ ${err.response.data.error || "Server error"}`);
    } else if (err.request) {
      setStatusMessage("❌ Cannot connect to server");
    } else {
      setStatusMessage(`❌ Error: ${err.message}`);
    }
  };

  // Animate solution
  const animateSolution = async () => {
    if (!solverResults?.solution || animating) return;

    setAnimating(true);
    setCurrentStep(0);

    for (let i = 0; i < solverResults.solution.length; i++) {
      setCurrentStep(i + 1);
      setStatusMessage(
        `▶️ Step ${i + 1}/${solverResults.solution.length}: ${solverResults.solution[i]}`,
      );

      // Emit move through socket
      socketRef.current.emit("make_move", {
        game_id: gameId,
        move: solverResults.solution[i],
      });

      await new Promise((resolve) => setTimeout(resolve, 800));
    }

    setStatusMessage("✅ Solution animation completed!");
    setAnimating(false);
    setCurrentStep(0);
  };

  // Cancel solver
  const cancelSolver = () => {
    socketRef.current.emit("cancel_solver", { game_id: gameId });
    setSolving(false);
    setProgress(0);
    setStatusMessage("❌ Solver cancelled");
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-white text-xl">Loading game state...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800">
      {/* Game Board Area */}
      <div
        ref={boardRef}
        className="relative mx-auto"
        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
      >
        {/* Your existing game board rendering here */}
        {/* ... */}
      </div>

      {/* Solver Control Panel - Floating at bottom */}
      <div className="fixed bottom-0 left-0 right-0 bg-gray-800/95 backdrop-blur-sm border-t border-gray-700 p-4 shadow-xl">
        <div className="max-w-6xl mx-auto">
          {/* Status Bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-4">
              <button
                onClick={handleSolve}
                disabled={solving || animating}
                className={`
                                    px-6 py-3 rounded-xl font-semibold text-white
                                    transition-all duration-200 transform hover:scale-105
                                    flex items-center space-x-2
                                    ${
                                      solving || animating
                                        ? "bg-gray-600 cursor-not-allowed"
                                        : "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 shadow-lg"
                                    }
                                `}
              >
                {solving ? (
                  <>
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                    <span>Solving... {Math.round(progress)}%</span>
                  </>
                ) : (
                  <>
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Solve with A*</span>
                  </>
                )}
              </button>

              {solving && (
                <button
                  onClick={cancelSolver}
                  className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold transition-colors"
                >
                  Cancel
                </button>
              )}

              {solverResults?.solution && !solving && (
                <button
                  onClick={animateSolution}
                  disabled={animating}
                  className="px-6 py-3 rounded-xl font-semibold text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 transition-all duration-200 transform hover:scale-105 shadow-lg flex items-center space-x-2"
                >
                  {animating ? (
                    <>
                      <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                          fill="none"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                      </svg>
                      <span>
                        Animating... {currentStep}/
                        {solverResults.solution.length}
                      </span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Animate Solution</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Status Message */}
            <div
              className={`
                            px-4 py-2 rounded-lg text-sm font-medium
                            ${
                              statusMessage.includes("✅")
                                ? "bg-green-900 text-green-300"
                                : statusMessage.includes("❌")
                                  ? "bg-red-900 text-red-300"
                                  : statusMessage.includes("🔄")
                                    ? "bg-blue-900 text-blue-300"
                                    : "bg-gray-700 text-gray-300"
                            }
                        `}
            >
              {statusMessage}
            </div>
          </div>

          {/* Progress Bar */}
          {(solving || progress > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3"
            >
              <div className="relative">
                <div className="flex justify-between text-xs text-gray-400 mb-1">
                  <span>A* Search Progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-purple-500 to-blue-500"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Live Stats */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-700/50 rounded-lg p-2">
                  <div className="text-xs text-gray-400">Nodes</div>
                  <div className="text-sm font-semibold text-white">
                    {solverStats.nodesExplored.toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-2">
                  <div className="text-xs text-gray-400">Frontier</div>
                  <div className="text-sm font-semibold text-white">
                    {solverStats.maxFrontier.toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-2">
                  <div className="text-xs text-gray-400">Time</div>
                  <div className="text-sm font-semibold text-white">
                    {solverStats.elapsedTime.toFixed(1)}s
                  </div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-2">
                  <div className="text-xs text-gray-400">Speed</div>
                  <div className="text-sm font-semibold text-white">
                    {solverStats.speed.toLocaleString()} n/s
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Solution Dialog */}
      <AnimatePresence>
        {showSolverDialog && solverResults && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowSolverDialog(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full mx-4 border border-gray-700"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  Solution Found! 🎉
                </h2>
                <button
                  onClick={() => setShowSolverDialog(false)}
                  className="text-gray-400 hover:text-white"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="text-xs text-gray-400">Moves</div>
                  <div className="text-xl font-bold text-white">
                    {solverResults.moves_count ||
                      solverResults.solution?.length}
                  </div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="text-xs text-gray-400">Nodes</div>
                  <div className="text-xl font-bold text-white">
                    {solverResults.metrics?.nodes_explored?.toLocaleString()}
                  </div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="text-xs text-gray-400">Time</div>
                  <div className="text-xl font-bold text-white">
                    {solverResults.metrics?.solve_time?.toFixed(2)}s
                  </div>
                </div>
                <div className="bg-gray-700/50 rounded-lg p-3">
                  <div className="text-xs text-gray-400">Frontier</div>
                  <div className="text-xl font-bold text-white">
                    {solverResults.metrics?.max_frontier_size?.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Solution Steps */}
              <div className="max-h-96 overflow-y-auto custom-scrollbar">
                <div className="space-y-2">
                  {solverResults.solution?.map((move, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className={`
                                                flex items-center p-3 rounded-lg cursor-pointer
                                                ${
                                                  currentStep === index + 1
                                                    ? "bg-purple-900 border-2 border-purple-500"
                                                    : "bg-gray-700 hover:bg-gray-600"
                                                }
                                            `}
                      onClick={() => setCurrentStep(index + 1)}
                    >
                      <span
                        className={`
                                                w-8 h-8 rounded-full flex items-center justify-center mr-3
                                                ${
                                                  currentStep === index + 1
                                                    ? "bg-purple-500 text-white"
                                                    : "bg-gray-600 text-gray-300"
                                                }
                                            `}
                      >
                        {index + 1}
                      </span>
                      <span className="text-white font-mono">{move}</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end mt-6 space-x-3">
                <button
                  onClick={() => setShowSolverDialog(false)}
                  className="px-4 py-2 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                >
                  Close
                </button>
                <button
                  onClick={() => {
                    setShowSolverDialog(false);
                    animateSolution();
                  }}
                  className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white transition-colors"
                >
                  Animate Solution
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default GameSolver;
