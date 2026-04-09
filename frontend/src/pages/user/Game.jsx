import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { io } from "socket.io-client";
import Card from "../../components/Card";

const API_URL = "http://localhost:5000/api";
const SOCKET_URL = "http://localhost:5000";

const Game = () => {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const socketRef = useRef(null);
  const boardRef = useRef(null);

  const [mouseDownTime, setMouseDownTime] = useState(0);
  const [mouseDownPos, setMouseDownPos] = useState({ x: 0, y: 0 });

  const [gameState, setGameState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("Ready");
  const [selectedCards, setSelectedCards] = useState([]);

  const [dragging, setDragging] = useState(false);
  const [dragPosition, setDragPosition] = useState({ x: 0, y: 0 });
  const [dragSource, setDragSource] = useState(null);

  const [showSolverDialog, setShowSolverDialog] = useState(false);
  const [showWinDialog, setShowWinDialog] = useState(false);
  const [solverResults, setSolverResults] = useState(null);
  const [solving, setSolving] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const isAnimatingRef = useRef(false);
  const [solverProgress, setSolverProgress] = useState({
    progress: 0,
    nodesExplored: 0,
    currentDepth: 0,
    bestHeuristic: 0,
    foundationCards: 0,
    freeCellsUsed: 0,
    explorationRate: 0,
    estimatedTime: "calculating...",
    solver: null,
  });

  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const SCREEN_WIDTH = windowSize.width;
  const SAFE_WIDTH = SCREEN_WIDTH - 20; // Subtract 20px for edge padding

  const CARD_WIDTH = Math.min(100, Math.floor(SAFE_WIDTH / 8.2));
  const CARD_HEIGHT = Math.floor(CARD_WIDTH * 1.4);
  const CARD_PADDING = Math.floor((SAFE_WIDTH - 8 * CARD_WIDTH) / 9);

  // Use actual board width for coordinate mapping (board may have padding/margin)
  const getBoardWidth = () => {
    if (boardRef.current) return boardRef.current.getBoundingClientRect().width;
    return SCREEN_WIDTH;
  };

  const SCREEN_HEIGHT = windowSize.height - 200;

  const FREE_CELL_START_X = 10 + CARD_PADDING;
  const FREE_CELL_START_Y = 50;

  const FOUNDATION_START_X = SCREEN_WIDTH - 10 - 4 * (CARD_WIDTH + CARD_PADDING) + CARD_PADDING;
  const FOUNDATION_START_Y = 50;

  const CASCADE_START_X = 10 + CARD_PADDING;
  const CASCADE_START_Y = FREE_CELL_START_Y + CARD_HEIGHT + 60;
  const CASCADE_SPACING = CARD_WIDTH + CARD_PADDING;

  useEffect(() => {
    if (statusMessage && statusMessage !== "Ready" && !solving && !isAnimating) {
      const timer = setTimeout(() => {
        setStatusMessage("");
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [statusMessage, solving, isAnimating]);

  useEffect(() => {
    const handleGlobalMouseUp = (e) => {
      if (dragging) {
        // If mouse is outside board, still try to handle the drop using last known position
        if (boardRef.current) {
          const rect = boardRef.current.getBoundingClientRect();
          // Only cancel if NOT already handled by the board's onMouseUp
          // We let the board's handleMouseUp run first (it's a capture phase)
          // This global handler just ensures state is cleaned up
        }
        setDragging(false);
        setSelectedCards([]);
        setDragSource(null);
      }
    };

    window.addEventListener("mouseup", handleGlobalMouseUp);

    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [dragging]);


  useEffect(() => {
    socketRef.current = io(SOCKET_URL, {
      transports: ['polling'],
      upgrade: false
    });

    socketRef.current.on("state_update", (data) => {
      if (data.game_id === gameId) {
        setGameState(data.state);
        if (data.last_move) {
          setStatusMessage("Move applied");
        }
      }
    });

    socketRef.current.on("solver_progress", (data) => {
      if (data.game_id === gameId) {
        console.log("solver_progress", data);

        setSolverProgress(prev => ({
          progress: data.progress || 0,
          nodesExplored: data.nodes_explored || 0,
          currentDepth: data.current_depth || 0,
          bestHeuristic: data.best_heuristic || 0,
          foundationCards: data.foundation_cards || 0,
          freeCellsUsed: data.free_cells_used || 0,
          explorationRate: data.exploration_rate || 0,
          estimatedTime: data.estimated_remaining || "calculating...",
          solver: data.solver || prev.solver,
        }));

        if (data.progress < 100) {
          setStatusMessage(`${data.solver} solving... ${data.progress}% complete`);
        }
      }
    });

    socketRef.current.on("solver_complete", (data) => {
      if (data.game_id === gameId) {
        setSolving(false);
        setSolverResults(data);
        setShowSolverDialog(true);

        const isSolved = data.solution && data.solution.length > 0;
        if (isSolved) {
          setStatusMessage(`${data.solver} Solution founded! (${data.solution.length} steps)`);
        } else {
          setStatusMessage(`${data.solver} No solution found within the allowed limits..`);
        }

        setSolverProgress(prev => ({
          progress: isSolved ? 100 : 0,
          nodesExplored: data.results?.nodes_explored || 0,
          currentDepth: data.results?.solution_length || 0,
          bestHeuristic: 0,
          foundationCards: isSolved ? 52 : (data.results?.foundation_cards || 0),
          freeCellsUsed: isSolved ? 4 : (data.results?.free_cells_used || 0),
          explorationRate: 0,
          estimatedTime: isSolved ? "Finished" : "Failed",
          solver: data.solver,
        }));
      }
    });

    socketRef.current.on("solver_error", (data) => {
      if (data.game_id === gameId) {
        setSolving(false);
        setStatusMessage(`Solver error: ${data.error}`);

        setSolverProgress({
          progress: 0,
          nodesExplored: 0,
          currentDepth: 0,
          bestHeuristic: 0,
          foundationCards: 0,
          freeCellsUsed: 0,
          explorationRate: 0,
          estimatedTime: "error",
          solver: null,
        });
      }
    });

    loadGame();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [gameId]);

  const loadGame = async () => {
    try {
      setSolving(false);
      setSolverResults(null);
      setShowSolverDialog(false);
      setShowWinDialog(false);
      setSolverProgress({
        progress: 0,
        nodesExplored: 0,
        currentDepth: 0,
        bestHeuristic: 0,
        foundationCards: 0,
        freeCellsUsed: 0,
        explorationRate: 0,
        estimatedTime: "calculating...",
        solver: null,
      });
      // ---------------------------------------

      const response = await axios.get(`${API_URL}/game/${gameId}`, {
        withCredentials: true,
      });

      if (response.data.success) {
        setGameState(response.data.state);
        setStatusMessage("Game loaded");
      } else {
        setError("Game not found");
      }
    } catch (err) {
      setError("Failed to load game");
    } finally {
      setLoading(false);
    }
  };

  const makeMove = async (move) => {
    try {
      const response = await axios.post(
        `${API_URL}/game/${gameId}/move`,
        { move },
        { withCredentials: true },
      );

      if (response.data.success) {
        setGameState(response.data.state);
        if (!response.data.is_goal) setStatusMessage("Ready");

        if (response.data.is_goal) {
          setStatusMessage("You won!");
          setShowWinDialog(true);
        }
      } else {
        setStatusMessage(`${response.data.error || "Invalid move!"}`);
      }
    } catch (err) {
      const errorMsg = err.response?.data?.error || "Error connected Server!";
      setStatusMessage(`${errorMsg}`);

      if (err.response?.data?.state) {
        setGameState(err.response.data.state);
      }
    }
  };

  const handleNewGame = () => {
    navigate("/");
  };

  const handleRestart = async () => {
    if (solving || isAnimating) return;
    try {
      const response = await axios.post(
        `${API_URL}/game/${gameId}/restart`,
        {},
        {
          withCredentials: true,
        },
      );

      if (response.data.success) {
        setGameState(response.data.state);
        setStatusMessage("Game restarted");
        setSelectedCards([]);
        setShowWinDialog(false);
      }
    } catch (err) {
      setStatusMessage("Failed to restart");
    }
  };

  const handleUndo = async () => {
    if (solving || isAnimating) return;
    try {
      const response = await axios.post(
        `${API_URL}/game/${gameId}/undo`,
        {},
        {
          withCredentials: true,
        },
      );

      if (response.data.success) {
        setGameState(response.data.state);
        setStatusMessage("Undo last move");
        setSelectedCards([]);
        setShowWinDialog(false);
      }
    } catch (err) {
      setStatusMessage("No moves to undo");
    }
  };

  const handleSolve = async (solverName) => {
    if (solving) return;

    setSolving(true);
    setStatusMessage(` Running ${solverName} solver...`);

    setSolverProgress({
      progress: 0,
      nodesExplored: 0,
      currentDepth: 0,
      bestHeuristic: 0,
      foundationCards: 0,
      freeCellsUsed: 0,
      explorationRate: 0,
      estimatedTime: "calculating...",
      solver: solverName,
    });

    try {
      await axios.post(
        `${API_URL}/game/${gameId}/solve`,
        {
          solver: solverName,
        },
        { withCredentials: true },
      );
    } catch (err) {
      setSolving(false);
      setStatusMessage(" Failed to start solver");
    }
  };

  const handleApplySolution = async () => {
    if (!solverResults?.solution || isAnimating) return;

    setShowSolverDialog(false);
    setIsAnimating(true);
    const moves = solverResults.solution;

    for (let i = 0; i < moves.length; i++) {
      const moveArray = Array.isArray(moves[i]) ? moves[i] : Object.values(moves[i]);

      try {
        const response = await axios.post(`${API_URL}/game/${gameId}/apply_solver_move`, { move: moveArray });

        if (response.data.success) {
          for (const stepState of response.data.steps) {
            setGameState(stepState);
            await new Promise(resolve => setTimeout(resolve, 200));
          }

          if (response.data.is_goal) {
            setStatusMessage("🎉 You Win!");
            setShowWinDialog(true);
            break;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) { break; }
    }
    setIsAnimating(false);
  };

  const getProgressColor = (progress) => {
    if (progress < 30) return "bg-red-500";
    if (progress < 60) return "bg-yellow-500";
    if (progress < 90) return "bg-blue-500";
    return "bg-green-500";
  };
  const getCascadeOffsetY = (cascadeLength) => {
    if (cascadeLength <= 1) return Math.floor(CARD_HEIGHT / 3.5);
    const minVisibleOffset = 28; // Minimum visibility for symbols
    const maxOffset = Math.floor(CARD_HEIGHT / 3.5); // Preferred visibility (~40px)
    const availableSpace = Math.max(100, SCREEN_HEIGHT - CASCADE_START_Y - CARD_HEIGHT - 60);
    const calculatedOffset = Math.floor(availableSpace / (cascadeLength - 1));
    return Math.max(minVisibleOffset, Math.min(maxOffset, calculatedOffset));
  };
  const getCardAtPosition = (x, y) => {
    if (!gameState) return null;

    // 1. Check Free Cells (top-left area)
    for (let i = 0; i < 4; i++) {
      const rectX = FREE_CELL_START_X + i * (CARD_WIDTH + CARD_PADDING);
      // Extend hit area by half padding on each side to avoid dead zones
      if (
        x >= rectX - CARD_PADDING / 2 &&
        x <= rectX + CARD_WIDTH + CARD_PADDING / 2 &&
        y >= FREE_CELL_START_Y &&
        y <= FREE_CELL_START_Y + CARD_HEIGHT
      ) {
        return { type: "freecell", index: i, card: gameState.free_cells[i] };
      }
    }

    // 2. Check Foundations (top-right area)
    const foundations = ["SPADES", "HEARTS", "CLUBS", "DIAMONDS"];
    for (let i = 0; i < foundations.length; i++) {
      const suit = foundations[i];
      const rectX = FOUNDATION_START_X + i * (CARD_WIDTH + CARD_PADDING);
      if (
        x >= rectX - CARD_PADDING / 2 &&
        x <= rectX + CARD_WIDTH + CARD_PADDING / 2 &&
        y >= FOUNDATION_START_Y &&
        y <= FOUNDATION_START_Y + CARD_HEIGHT
      ) {
        const pile = gameState.foundations[suit] || [];
        return {
          type: "foundation",
          index: i,
          suit,
          card: pile.length > 0 ? pile[pile.length - 1] : null,
          isEmpty: pile.length === 0,
        };
      }
    }

    // 3. Check 8 Cascade columns (main play area)
    for (let i = 0; i < 8; i++) {
      const cascadeX = CASCADE_START_X + i * CASCADE_SPACING;
      const cascade = gameState.cascades[i] || [];

      // Define hit area wider than card width (includes padding)
      // Last column (i=7) extends to the right screen edge
      const rightBuffer = i === 7 ? SCREEN_WIDTH : cascadeX + CARD_WIDTH + CARD_PADDING / 2;
      const isInColumnX =
        x >= cascadeX - CARD_PADDING / 2 &&
        x <= rightBuffer;

      if (isInColumnX && y >= CASCADE_START_Y) {
        // EMPTY COLUMN: any drop within the column counts
        if (cascade.length === 0) {
          return { type: "cascade_empty", index: i, card: null };
        }

        // NON-EMPTY COLUMN: scan from bottom up to find which card was targeted
        for (let j = cascade.length - 1; j >= 0; j--) {
          const offsetY = getCascadeOffsetY(cascade.length);
          const cardY = CASCADE_START_Y + j * offsetY;

          // If y is within this card (or in the overlap zone below it)
          if (y >= cardY && y <= cardY + (j === cascade.length - 1 ? CARD_HEIGHT : offsetY)) {
            return { type: "cascade", index: i, row: j, card: cascade[j] };
          }
        }

        // BOTTOM DROP ZONE: dropping below the last card still counts as this column
        const currentOffsetY = getCascadeOffsetY(cascade.length);
        const lastCardY = CASCADE_START_Y + (cascade.length - 1) * currentOffsetY;
        if (y > lastCardY) {
          return { type: "cascade_empty", index: i, card: null };
        }
      }
    }

    return null;
  };
  const getSequenceFromCascade = (colIndex, startRow) => {
    const cascade = gameState?.cascades[colIndex];
    if (!cascade || startRow >= cascade.length) return [];

    const sequence = [cascade[startRow]];

    for (let i = startRow + 1; i < cascade.length; i++) {
      if (canPlaceOn(cascade[i], cascade[i - 1])) {
        sequence.push(cascade[i]);
      } else {
        break;
      }
    }

    return sequence;
  };

  const handleMouseDown = (e) => {
    if (solving || isAnimating) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Save position/time to distinguish a click vs a drag
    setMouseDownTime(Date.now());
    setMouseDownPos({ x: e.clientX, y: e.clientY });

    const clicked = getCardAtPosition(x, y);
    // if (solving || isAnimating) return;
    // const rect = e.currentTarget.getBoundingClientRect();
    // const x = e.clientX - rect.left;
    // const y = e.clientY - rect.top;

    // const clicked = getCardAtPosition(x, y);

    if (!clicked || !clicked.card) return;

    // if (clicked.type === "foundation") return;

    console.log("Start drag:", clicked);

    if (clicked.type === "cascade") {
      const cascade = gameState.cascades[clicked.index];

      const sequence = getSequenceFromCascade(clicked.index, clicked.row);
      const maxSequenceLength = gameState?.max_sequence_length;
      if (sequence.length > 1) {
        if (sequence.length <= maxSequenceLength) {
          setSelectedCards(sequence);
          setDragSource({
            type: "cascade_sequence",
            index: clicked.index,
            row: clicked.row,
            length: sequence.length,
          });
          // status message intentionally omitted during drag start
        } else {
          setStatusMessage(
            `Can not drag ${sequence.length} cards. Max: ${maxSequenceLength}`,
          );
        }
      } else if (clicked.row === cascade.length - 1) {
        setSelectedCards([clicked.card]);
        setDragSource({
          type: "cascade",
          index: clicked.index,
          row: clicked.row,
        });
        // status message intentionally omitted during drag start
      } else {
        setStatusMessage("Cannot drag this card");
        return;
      }
    } else if (clicked.type === "freecell") {
      setSelectedCards([clicked.card]);
      setDragSource({
        type: "freecell",
        index: clicked.index,
      });
    } else if (clicked.type === "foundation") {
      // Allow dragging from foundation
      // Only the top card of the foundation pile can be dragged
      const foundationPile = gameState.foundations[clicked.card.suit];
      if (
        foundationPile &&
        foundationPile.length > 0 &&
        foundationPile[foundationPile.length - 1].rank === clicked.card.rank &&
        foundationPile[foundationPile.length - 1].suit === clicked.card.suit
      ) {
        setSelectedCards([clicked.card]);
        setDragSource({
          type: "foundation",
          index: clicked.index, // index is the suit index
          suit: clicked.card.suit,
        });
          // status message intentionally omitted during drag start
      } else {
        setStatusMessage("Cannot drag this card from foundation");
        return;
      }
    }

    // Set dragPosition to the absolute mouse position on the board
    // The ghost card is centered on the cursor via (-CARD_WIDTH/2) in the render
    setDragPosition({ x, y });

    setDragging(true);
  };
  // const getCardRect = (clicked) => {
  //   if (!clicked || !clicked.card) return null;

  //   if (clicked.type === "cascade") {
  //     const cascade = gameState?.cascades[clicked.index] || [];
  //     const offsetY = Math.min(30, Math.floor(400 / (cascade.length + 1)));
  //     return {
  //       x: CASCADE_START_X + clicked.index * CASCADE_SPACING,
  //       y: CASCADE_START_Y + clicked.row * offsetY,
  //       width: CARD_WIDTH,
  //       height: CARD_HEIGHT,
  //     };
  //   } else if (clicked.type === "freecell") {
  //     return {
  //       x: FREE_CELL_START_X + clicked.index * (CARD_WIDTH + CARD_PADDING),
  //       y: FREE_CELL_START_Y,
  //       width: CARD_WIDTH,
  //       height: CARD_HEIGHT,
  //     };
  //   }
  //   return null;
  // };
  const getCardRect = (clicked) => {
    if (!clicked || !clicked.card) return null;

    if (clicked.type === "cascade") {
      const cascade = gameState?.cascades[clicked.index] || [];
      const offsetY = getCascadeOffsetY(cascade.length);
      return {
        x: CASCADE_START_X + clicked.index * CASCADE_SPACING,
        y: CASCADE_START_Y + clicked.row * offsetY,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      };
    } else if (clicked.type === "freecell") {
      return {
        x: FREE_CELL_START_X + clicked.index * (CARD_WIDTH + CARD_PADDING),
        y: FREE_CELL_START_Y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      };
    } else if (clicked.type === "foundation") {
      // Foundation card hit rect
      const suitIndex = ["SPADES", "HEARTS", "CLUBS", "DIAMONDS"].indexOf(
        clicked.suit,
      );
      return {
        x: FOUNDATION_START_X + suitIndex * (CARD_WIDTH + CARD_PADDING),
        y: FOUNDATION_START_Y,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
      };
    }
    return null;
  };
  const handleMouseMove = (e) => {
    if (!dragging || !boardRef.current) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setDragPosition({ x, y });
  };
  const canPlaceOn = (card, belowCard) => {
    const cardColor =
      card.suit === "HEARTS" || card.suit === "DIAMONDS" ? "red" : "black";
    const belowColor =
      belowCard.suit === "HEARTS" || belowCard.suit === "DIAMONDS"
        ? "red"
        : "black";

    return cardColor !== belowColor && card.rank === belowCard.rank - 1;
  };

  const handleMouseUp = (e) => {
    if (!dragging || !dragSource || !boardRef.current) return;
    // 1. Calculate mouse travel distance and elapsed time
    const moveDist = Math.sqrt(
      Math.pow(e.clientX - mouseDownPos.x, 2) +
      Math.pow(e.clientY - mouseDownPos.y, 2)
    );
    const duration = Date.now() - mouseDownTime;

    // 2. SMART CLICK: small movement + fast release = auto-place
    if (moveDist < 10 && duration < 300) {
      handleSmartMove(dragSource); // Auto-find best destination

      // Reset drag state
      setDragging(false);
      setSelectedCards([]);
      setDragSource(null);
      return;
    }

    // 3. DRAG-AND-DROP LOGIC
    const rect = boardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const target = getCardAtPosition(x, y);
    // const rect = boardRef.current.getBoundingClientRect();
    // const x = e.clientX - rect.left;
    // const y = e.clientY - rect.top;

    // const target = getCardAtPosition(x, y);
    // console.log("target", target);
    // console.log("dragSource", dragSource);
    // console.log("selectedCards", selectedCards);

    if (target && selectedCards.length > 0) {
      let move = null;

      // Handle drag from foundation
      if (dragSource.type === "foundation") {
        if (selectedCards.length === 1) {
          if (target.type === "cascade" || target.type === "cascade_empty") {
            // Foundation to cascade
            move = ["foundation_to_cascade", dragSource.suit, target.index];
            console.log(`Moving from foundation to cascade ${target.index}`);
          } else if (target.type === "freecell") {
            // Foundation to freecell
            if (!gameState?.free_cells[target.index]) {
              move = ["foundation_to_freecell", dragSource.suit, target.index];
              console.log(`Moving from foundation to freecell ${target.index}`);
            } else {
              setStatusMessage("Free cell is not empty");
            }
          } else {
            setStatusMessage(
              "Can only drop foundation cards to cascade or freecell",
            );
          }
        } else {
          setStatusMessage("Can only drag single card from foundation");
        }
      }
      // Handle drag from cascade_sequence
      else if (dragSource.type === "cascade_sequence") {
        if (target.type === "cascade" || target.type === "cascade_empty") {
          if (dragSource.index !== target.index) {
            const destCascade = gameState?.cascades[target.index];
            const firstCard = selectedCards[0];
            console.log("destCascade", destCascade);
            const canPlace =
              !destCascade?.length ||
              canPlaceOn(firstCard, destCascade[destCascade.length - 1]);

            const maxSequenceLength = gameState?.max_sequence_length;
            console.log("maxSequenceLength", maxSequenceLength);
            console.log("canPlace", canPlace);
            if (selectedCards.length <= maxSequenceLength && canPlace) {
              move = [
                "cascade_to_cascade_sequence",
                dragSource.index,
                target.index,
                selectedCards.length,
              ];
              console.log(`Moving sequence of ${selectedCards.length} cards`);
            } else {
              setStatusMessage(
                `Cannot move ${selectedCards.length} cards! Max: ${maxSequenceLength}`,
              );
            }
          }
        } else {
          setStatusMessage("Sequence can only be dropped to cascade");
        }
      }
      // Handle drag from cascade
      else if (dragSource.type === "cascade") {
        if (selectedCards.length === 1) {
          if (target.type === "cascade" || target.type === "cascade_empty") {
            if (dragSource.index !== target.index) {
              move = ["cascade_to_cascade", dragSource.index, target.index];
            }
          } else if (target.type === "freecell") {
            if (!gameState?.free_cells[target.index]) {
              move = ["cascade_to_freecell", dragSource.index, target.index];
            }
          } else if (target.type === "foundation") {
            move = ["cascade_to_foundation", dragSource.index];
          }
        }
      }
      // Handle drag from freecell
      else if (dragSource.type === "freecell") {
        if (target.type === "cascade" || target.type === "cascade_empty") {
          move = ["freecell_to_cascade", dragSource.index, target.index];
        } else if (target.type === "freecell") {
          if (
            dragSource.index !== target.index &&
            !gameState?.free_cells[target.index]
          ) {
            move = ["freecell_to_freecell", dragSource.index, target.index];
          }
        } else if (target.type === "foundation") {
          move = ["freecell_to_foundation", dragSource.index];
        }
      }

      if (move) {
        console.log("Sending move:", move);
        makeMove(move);
      } else {
        setStatusMessage("Invalid move");
      }
    } else {
      setStatusMessage("Invalid drop target");
    }

    setDragging(false);
    setSelectedCards([]);
    setDragSource(null);
  };

  const handleSmartMove = async (source) => {
    if (!gameState || selectedCards.length === 0) return;

    const card = selectedCards[0];
    let bestMove = null;

    // --- SEQUENCE: dragging multiple cards, only find a valid cascade ---
    if (source.type === "cascade_sequence") {
      const maxSequenceLength = gameState?.max_sequence_length;
      if (selectedCards.length > maxSequenceLength) {
        setStatusMessage(`Cannot move ${selectedCards.length} cards. Max: ${maxSequenceLength}`);
        return;
      }

      // Priority 1: cascade with a matching top card
      for (let i = 0; i < 8; i++) {
        if (source.index === i) continue;
        const destCascade = gameState.cascades[i];
        if (destCascade.length > 0) {
          const topCard = destCascade[destCascade.length - 1];
          if (canPlaceOn(card, topCard)) {
            bestMove = ["cascade_to_cascade_sequence", source.index, i, selectedCards.length];
            break;
          }
        }
      }

      // Priority 2: empty column
      if (!bestMove) {
        const emptyCascadeIdx = gameState.cascades.findIndex(c => c.length === 0);
        if (emptyCascadeIdx !== -1 && source.index !== emptyCascadeIdx) {
          bestMove = ["cascade_to_cascade_sequence", source.index, emptyCascadeIdx, selectedCards.length];
        }
      }

      if (bestMove) {
        makeMove(bestMove);
      } else {
        setStatusMessage("No valid destination for this sequence");
      }
      return;
    }

    // --- SINGLE CARD ---
    // Priority 1: move to Foundation
    const suit = card.suit;
    const pile = gameState.foundations[suit] || [];
    const isNextRank = (pile.length === 0 && card.rank === 1) ||
      (pile.length > 0 && card.rank === pile[pile.length - 1].rank + 1);

    if (isNextRank) {
      bestMove = [source.type.includes("freecell") ? "freecell_to_foundation" : "cascade_to_foundation", source.index];
    }

    // Priority 2: stack onto a tableau cascade
    if (!bestMove) {
      for (let i = 0; i < 8; i++) {
        if (source.type === "cascade" && source.index === i) continue;
        const destCascade = gameState.cascades[i];
        if (destCascade.length > 0) {
          const topCard = destCascade[destCascade.length - 1];
          if (canPlaceOn(card, topCard)) {
            bestMove = [source.type.includes("freecell") ? "freecell_to_cascade" : "cascade_to_cascade", source.index, i];
            break;
          }
        }
      }
    }

    // Priority 3: empty column
    if (!bestMove) {
      const emptyCascadeIdx = gameState.cascades.findIndex(c => c.length === 0);
      if (emptyCascadeIdx !== -1) {
        const isCardAloneInCascade = source.type === "cascade" && gameState.cascades[source.index].length === 1;
        if (!isCardAloneInCascade) {
          bestMove = [source.type.includes("freecell") ? "freecell_to_cascade" : "cascade_to_cascade", source.index, emptyCascadeIdx];
        }
      }
    }

    // Priority 4: Free Cell
    // "You can move any card into one of the four free cells"
    if (!bestMove && source.type !== "freecell") {
      const emptyFreeCellIdx = gameState.free_cells.findIndex(cell => cell === null);
      if (emptyFreeCellIdx !== -1) {
        bestMove = ["cascade_to_freecell", source.index, emptyFreeCellIdx];
      }
    }

    // --- THỰC THI ---
    if (bestMove) {
      makeMove(bestMove);
    } else {
      setStatusMessage("No solution found within the allowed limits.");
    }
  };
  // const handleMouseUp = (e) => {
  //   if (!dragging || !dragSource || !boardRef.current) return;

  //   const rect = boardRef.current.getBoundingClientRect();
  //   const x = e.clientX - rect.left;
  //   const y = e.clientY - rect.top;

  //   const target = getCardAtPosition(x, y);
  //   console.log("target", target);
  //   console.log("dragSource", dragSource);
  //   console.log("selectedCards", selectedCards);

  //   if (target && selectedCards.length > 0) {
  //     let move = null;

  //     if (dragSource.type === "cascade_sequence") {
  //       if (target.type === "cascade" || target.type === "cascade_empty") {
  //         if (dragSource.index !== target.index) {
  //           const destCascade = gameState?.cascades[target.index];
  //           const firstCard = selectedCards[0];
  //           console.log("destCascade", destCascade);
  //           const canPlace =
  //             !destCascade?.length ||
  //             canPlaceOn(firstCard, destCascade[destCascade.length - 1]);

  //           const maxSequenceLength = gameState?.max_sequence_length;
  //           console.log("maxSequenceLength", maxSequenceLength);
  //           console.log("canPlace", canPlace);
  //           if (selectedCards.length <= maxSequenceLength && canPlace) {
  //             move = [
  //               "cascade_to_cascade_sequence",
  //               dragSource.index,
  //               target.index,
  //               selectedCards.length,
  //             ];
  //             console.log(`Moving sequence of ${selectedCards.length} cards`);
  //           } else {
  //             setStatusMessage(
  //               `Cannot move ${selectedCards.length} cards! Max: ${maxSequenceLength}`,
  //             );
  //           }
  //         }
  //       } else {
  //         setStatusMessage("Sequence can only be dropped to cascade");
  //       }
  //     } else if (dragSource.type === "cascade") {
  //       if (selectedCards.length === 1) {
  //         if (target.type === "cascade" || target.type === "cascade_empty") {
  //           if (dragSource.index !== target.index) {
  //             move = ["cascade_to_cascade", dragSource.index, target.index];
  //           }
  //         } else if (target.type === "freecell") {
  //           if (!gameState?.free_cells[target.index]) {
  //             move = ["cascade_to_freecell", dragSource.index, target.index];
  //           }
  //         } else if (target.type === "foundation") {
  //           move = ["cascade_to_foundation", dragSource.index];
  //         }
  //       }
  //     } else if (dragSource.type === "freecell") {
  //       if (target.type === "cascade" || target.type === "cascade_empty") {
  //         move = ["freecell_to_cascade", dragSource.index, target.index];
  //       } else if (target.type === "freecell") {
  //         if (
  //           dragSource.index !== target.index &&
  //           !gameState?.free_cells[target.index]
  //         ) {
  //           move = ["freecell_to_freecell", dragSource.index, target.index];
  //         }
  //       } else if (target.type === "foundation") {
  //         move = ["freecell_to_foundation", dragSource.index];
  //       }
  //     }

  //     if (move) {
  //       console.log("Sending move:", move);
  //       makeMove(move);
  //     } else {
  //       setStatusMessage("❌ Invalid move");
  //     }
  //   } else {
  //     setStatusMessage("❌ Invalid drop target");
  //   }

  //   setDragging(false);
  //   setSelectedCards([]);
  //   setDragSource(null);
  // };
  const renderCard = (card, isDragged = false) => {
    if (!card) return null;

    return (
      <Card
        key={`${card.suit}-${card.rank}`}
        suit={card.suit}
        rank={card.rank}
        width={CARD_WIDTH}
        height={CARD_HEIGHT}
        isDragged={isDragged}
      />
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_center,_#064e3b_0%,_#022c22_100%)] flex flex-col items-center justify-center p-6">
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-12 rounded-[24px] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full animate-in fade-in zoom-in duration-500">
          <div className="w-16 h-16 border-4 border-amber-500/20 border-t-amber-500 rounded-full animate-spin"></div>
          <div className="text-white text-xl font-black uppercase tracking-widest opacity-80">
            Initializing Game
          </div>
          <div className="text-amber-500/60 text-xs font-bold uppercase tracking-tighter">
            Please wait...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_center,_#450a0a_0%,_#000000_100%)] flex flex-col items-center justify-center p-6">
        <div className="bg-white/5 border border-white/10 backdrop-blur-xl p-12 rounded-[24px] shadow-2xl flex flex-col items-center gap-6 max-w-sm w-full animate-in fade-in zoom-in duration-500 text-center">
          <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center border border-rose-500/30">
            <svg className="w-8 h-8 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-2xl font-black text-rose-500 uppercase tracking-tight">System Error</h2>
          <p className="text-white/60 text-sm font-medium leading-relaxed">{error}</p>
          <button
            onClick={handleNewGame}
            className="btn-modern btn-primary w-full py-4 mt-4"
          >
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  const gameContainerStyle = {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    margin: "0",
    position: "relative",
  };

  // --- PREPARE FLAT CARD LIST FOR ANIMATION ---
  const cardsToRender = [];
  if (gameState) {
    // 1. Free Cells
    gameState.free_cells.forEach((card, i) => {
      if (card) {
        const x = FREE_CELL_START_X + i * (CARD_WIDTH + CARD_PADDING);
        const y = FREE_CELL_START_Y;
        const isDragged = dragging && dragSource?.type === "freecell" && dragSource?.index === i;
        cardsToRender.push({
          card, x, y,
          zIndex: isDragged ? 100 : 10,
          isDragged,
          key: `card-${card.suit}-${card.rank}`,
          type: 'freecell',
          index: i
        });
      }
    });

    // 2. Foundations - use FIXED order to prevent suitIndex shuffling between renders
    const SUIT_ORDER = ["SPADES", "HEARTS", "CLUBS", "DIAMONDS"];
    SUIT_ORDER.forEach((suit, suitIndex) => {
      const pile = gameState.foundations[suit] || [];
      pile.forEach((card, rowIndex) => {
        const x = FOUNDATION_START_X + suitIndex * (CARD_WIDTH + CARD_PADDING);
        const y = FOUNDATION_START_Y;
        cardsToRender.push({
          card, x, y,
          zIndex: rowIndex + 1,
          isDragged: false,
          key: `card-${card.suit}-${card.rank}`,
          type: 'foundation',
          suitIndex
        });
      });
    });

    // 3. Cascades
    gameState.cascades.forEach((cascade, colIndex) => {
      const x = CASCADE_START_X + colIndex * CASCADE_SPACING;
      const offsetY = getCascadeOffsetY(cascade.length);
      cascade.forEach((card, rowIndex) => {
        const y = CASCADE_START_Y + rowIndex * offsetY;
        const isDragged = dragging && dragSource?.type === "cascade" && dragSource?.index === colIndex && dragSource?.row === rowIndex;
        // Check if this card is part of a dragged sequence
        const isInDraggedSequence = dragging && 
          (dragSource?.type === "cascade_sequence" || dragSource?.type === "cascade") && 
          dragSource?.index === colIndex && 
          rowIndex >= dragSource?.row;
        
        const isLastCard = rowIndex === cascade.length - 1;
        const canDragSequence = cascade.length > 1;

        cardsToRender.push({
          card, x, y,
          zIndex: isDragged ? 1000 : rowIndex + 1,
          isDragged,
          isInDraggedSequence,
          isLastCard,
          canDragSequence,
          key: `card-${card.suit}-${card.rank}`,
          type: 'cascade',
          colIndex,
          rowIndex
        });
      });
    });
  }

  return (
    <div className="min-h-screen relative font-sans overflow-hidden">
      <div className="w-full bg-black/20 backdrop-blur-md border-b border-white/10 p-4 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-4">
          <h1 className="text-2xl font-black text-amber-500 tracking-tighter uppercase mr-8 drop-shadow-lg">
            Free Cell <span className="text-white">Solver</span>
          </h1>

          <button
            onClick={() => navigate("/")}
            className="btn-modern btn-primary"
          >
            New Game
          </button>
          <button
            onClick={handleRestart}
            className="btn-modern btn-secondary"
          >
            Restart
          </button>
          <button
            onClick={handleUndo}
            className="btn-modern btn-neutral"
          >
            Undo
          </button>

          <div className="bg-black/40 text-amber-400 px-4 py-2 rounded-xl font-black text-xs border border-amber-500/20 shadow-inner tracking-widest">
            SEED: {gameState?.seed || "N/A"}
          </div>

          <div className="flex gap-2 ml-4 p-1 bg-black/20 rounded-xl border border-white/5">
            <button
              onClick={() => handleSolve("BFS")}
              disabled={solving}
              className={`btn-modern px-3 py-1.5 ${solving ? "opacity-50" : "bg-purple-600 hover:bg-purple-500"}`}
            >
              BFS
            </button>
            <button
              onClick={() => handleSolve("DFS")}
              disabled={solving}
              className={`btn-modern px-3 py-1.5 ${solving ? "opacity-50" : "bg-orange-600 hover:bg-orange-500"}`}
            >
              DFS
            </button>
            <button
              onClick={() => handleSolve("UCS")}
              disabled={solving}
              className={`btn-modern px-3 py-1.5 ${solving ? "opacity-50" : "bg-emerald-600 hover:bg-emerald-500"}`}
            >
              UCS
            </button>
            <button
              onClick={() => handleSolve("A*")}
              disabled={solving}
              className={`btn-modern px-3 py-1.5 ${solving ? "opacity-50" : "bg-rose-600 hover:bg-rose-500"}`}
            >
              A*
            </button>
          </div>
        </div>
      </div>
      {solving && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4 z-40">
          <div className="slot-container p-6 border-amber-500/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin h-5 w-5 border-3 border-amber-500 border-t-transparent rounded-full shadow-lg"></div>
                <span className="text-lg font-black text-white tracking-tight">
                  {solverProgress.solver} <span className="text-amber-500">SOLVING...</span>
                </span>
              </div>
              <span className="text-lg font-black text-amber-500 tabular-nums">
                {solverProgress.progress}%
              </span>
            </div>

            <div className="h-3 bg-black/40 rounded-full overflow-hidden mb-6 border border-white/5 shadow-inner">
              <div
                className={`h-full transition-all duration-500 ease-out bg-gradient-to-r from-amber-600 to-amber-400`}
                style={{ width: `${solverProgress.progress}%` }}
              ></div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                <div className="section-label mb-1">Nodes</div>
                <div className="text-white font-bold text-lg">
                  {solverProgress.nodesExplored.toLocaleString()}
                </div>
              </div>
              <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                <div className="section-label mb-1">Depth</div>
                <div className="text-white font-bold text-lg">
                  {solverProgress.currentDepth}
                </div>
              </div>
              <div className="bg-black/30 rounded-xl p-3 border border-white/5">
                <div className="section-label mb-1">Progress</div>
                <div className="text-white font-bold text-lg">
                  {solverProgress.foundationCards}/52
                </div>
              </div>
              <div className="bg-gray-700/30 rounded-lg p-2">
                <div className="text-gray-400 text-xs">Est. Remaining</div>
                <div className="text-white font-medium">
                  {solverProgress.estimatedTime}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4 mt-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Exploration Rate:</span>
                <span className="text-gray-300">
                  {solverProgress.explorationRate} nodes/s
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Best Heuristic:</span>
                <span className="text-gray-300">
                  {solverProgress.bestHeuristic}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-400">Free Cells:</span>
                <span className="text-gray-300">
                  {solverProgress.freeCellsUsed}/4
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
      <div
        ref={boardRef}
        className="w-full relative mt-16 cursor-default select-none"
        style={{ ...gameContainerStyle, width: SCREEN_WIDTH, height: SCREEN_HEIGHT + 350 }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
      >
        <div
          className="absolute"
          style={{ left: FREE_CELL_START_X, top: FREE_CELL_START_Y - 30 }}
        >
          <div className="section-label">
            Free Cells
          </div>
        </div>
        {[0, 1, 2, 3].map((i) => {
          const x = FREE_CELL_START_X + i * (CARD_WIDTH + CARD_PADDING);
          return (
            <div
              key={`freecell-slot-${i}`}
              className="absolute slot-container flex items-center justify-center"
              style={{
                left: x,
                top: FREE_CELL_START_Y,
                width: CARD_WIDTH,
                height: CARD_HEIGHT
              }}
              data-type="freecell"
              data-index={i}
            />
          );
        })}
        <div
          className="absolute"
          style={{ left: FOUNDATION_START_X, top: FOUNDATION_START_Y - 30 }}
        >
          <div className="section-label">
            Foundations
          </div>
        </div>
        {["SPADES", "HEARTS", "CLUBS", "DIAMONDS"].map((suit, i) => {
          const x = FOUNDATION_START_X + i * (CARD_WIDTH + CARD_PADDING);
          return (
            <div
              key={`foundation-slot-${suit}`}
              className="absolute foundation-card slot-container flex items-center justify-center"
              style={{
                left: x,
                top: FOUNDATION_START_Y,
                width: CARD_WIDTH,
                height: CARD_HEIGHT
              }}
              data-type="foundation"
              data-index={i}
              data-suit={suit}
            >
              <div className="w-full h-full flex items-center justify-center text-5xl text-yellow-500/30 font-bold">
                {suit === "SPADES" && "♠"}
                {suit === "HEARTS" && "♥"}
                {suit === "CLUBS" && "♣"}
                {suit === "DIAMONDS" && "♦"}
              </div>
            </div>
          );
        })}

        {gameState?.cascades.map((cascade, colIndex) => {
          const isEmpty = cascade.length === 0;
          const x = CASCADE_START_X + colIndex * CASCADE_SPACING;

          return (
            <div
              key={`cascade-col-${colIndex}`}
              className="absolute"
              style={{ left: x, top: CASCADE_START_Y - 40, width: CARD_WIDTH }}
              data-type="cascade-column"
              data-index={colIndex}
            >
              <div className="flex justify-center mb-3">
                <div className="column-label">
                  C{colIndex + 1}
                </div>
              </div>

              <div
                className={`relative w-full slot-container transition-all ${isEmpty ? "opacity-40" : "bg-transparent border-none shadow-none backdrop-blur-none"}`}
                style={{ height: CARD_HEIGHT }}
                data-type="cascade"
                data-index={colIndex}
                data-empty={isEmpty}
              />
            </div>
          );
        })}

        {/* FLAT CARDS LAYER FOR ANIMATION */}
        {cardsToRender.map((item) => {
          const { card, x, y, zIndex, isDragged, isInDraggedSequence, isLastCard, canDragSequence, key, type } = item;
          // Only cascade cards get position transitions; foundation/freecell stay fixed
          const positionTransition = type === 'cascade' ? 'transition-all duration-400 ease-out' : 'transition-opacity duration-200';
          return (
            <div
              key={key}
              className={`absolute ${positionTransition}
                ${isInDraggedSequence ? "opacity-30 pointer-events-none" : ""} 
                ${isDragged ? "invisible" : ""}`}
              style={{
                left: x,
                top: y,
                width: CARD_WIDTH,
                height: CARD_HEIGHT,
                zIndex: zIndex,
              }}
            >
              <div
                className={`relative w-full h-full transition-all duration-200 
                  ${!dragging && (isLastCard || canDragSequence || type !== 'cascade') ? "hover:scale-105 hover:-translate-y-1 hover:z-50" : ""}`}
              >
                <Card
                  suit={card.suit}
                  rank={card.rank}
                  width={CARD_WIDTH}
                  height={CARD_HEIGHT}
                  isDragged={isDragged}
                />
              </div>
            </div>
          );
        })}
        {dragging && selectedCards.length > 0 && (
          <>
            {selectedCards.map((card, i) => (
              <div
                key={`drag-${i}`}
                className="absolute pointer-events-none z-50 transition-transform"
                style={{
                  left: dragPosition.x - CARD_WIDTH / 2,
                  top: dragPosition.y - CARD_HEIGHT / 2 + i * 20,
                  transform: `rotate(${i * 2}deg) scale(1.05)`,
                  filter: "drop-shadow(0 20px 25px rgba(0, 0, 0, 0.5))",
                  opacity: 0.95,
                }}
              >
                <Card
                  suit={card.suit}
                  rank={card.rank}
                  width={CARD_WIDTH}
                  height={CARD_HEIGHT}
                />

                {i === 0 && selectedCards.length > 1 && (
                  <div className="absolute -top-3 -right-3 bg-yellow-500 text-black text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-black">
                    {selectedCards.length}
                  </div>
                )}
              </div>
            ))}
            <div className="absolute pointer-events-none inset-0">
              {dragSource && (
                <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 bg-black/80 backdrop-blur-md text-amber-400 px-6 py-3 rounded-2xl border border-amber-500/30 text-xs font-black uppercase tracking-widest shadow-2xl z-50">
                  Moving {selectedCards.length} card{selectedCards.length > 1 ? 's' : ''}
                </div>
              )}
            </div>
          </>
        )}

        {dragging && dragSource && (
          <div className="absolute inset-0 pointer-events-none">
            {[0, 1, 2, 3].map((i) => {
              if (!gameState?.free_cells[i] && dragSource.type !== "freecell") {
                return (
                  <div
                    key={`drop-highlight-freecell-${i}`}
                    className="absolute border-4 border-green-400 rounded-lg animate-pulse"
                    style={{
                      left: FREE_CELL_START_X + i * (CARD_WIDTH + CARD_PADDING),
                      top: FREE_CELL_START_Y,
                      width: CARD_WIDTH,
                      height: CARD_HEIGHT,
                      boxShadow: "0 0 20px rgba(74, 222, 128, 0.5)",
                    }}
                  />
                );
              }
              return null;
            })}

            {gameState?.cascades.map((cascade, colIndex) => {
              const canDrop = dragSource.index !== colIndex;
              if (!canDrop) return null;

              const lastCardY =
                cascade.length > 0
                  ? CASCADE_START_Y +
                  (cascade.length - 1) * getCascadeOffsetY(cascade.length)
                  : CASCADE_START_Y;

              return (
                <div
                  key={`drop-highlight-cascade-${colIndex}`}
                  className="absolute border-4 border-green-400 rounded-lg animate-pulse"
                  style={{
                    left: CASCADE_START_X + colIndex * CASCADE_SPACING,
                    top: lastCardY,
                    width: CARD_WIDTH,
                    height: CARD_HEIGHT,
                    boxShadow: "0 0 20px rgba(74, 222, 128, 0.5)",
                  }}
                />
              );
            })}
          </div>
        )}
      </div>

      {statusMessage && (
        <div className="fixed bottom-6 right-6 bg-black/80 text-amber-400 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest shadow-2xl border border-amber-500/30 backdrop-blur-md z-50 max-w-xs text-right animate-[slideInRight_0.3s_ease]">
          {statusMessage}
        </div>
      )}

      {showSolverDialog && solverResults && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-50 p-4">
          <div className="slot-container p-8 max-w-md w-full border-amber-500/20 shadow-heavy">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-2xl font-black text-white uppercase tracking-tighter">
                Solver <span className="text-amber-500">Results</span>
              </h3>
              <button
                onClick={() => setShowSolverDialog(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-all"
              >
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-6">
              <div className="bg-black/40 rounded-2xl p-5 border border-white/5 shadow-inner">
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <div className="section-label mb-1">Algorithm</div>
                    <div className="text-xl font-bold text-white tracking-tight">
                      {solverResults.solver}
                    </div>
                  </div>
                  <div>
                    <div className="section-label mb-1">Solution</div>
                    <div className={`text-xl font-black ${solverResults.results?.solution_found ? "text-emerald-400" : "text-rose-400"}`}>
                      {!solverResults.results?.solution_found ? "NOT FOUND" : 
                       (solverResults.results?.solution_length === 0 ? "SOLVED" : "FOUND")}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="section-label mb-1 text-[10px]">Nodes</div>
                  <div className="text-xl font-bold text-white tracking-tight">
                    {solverResults.results?.nodes_explored?.toLocaleString()}
                  </div>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="section-label mb-1 text-[10px]">Time</div>
                  <div className="text-xl font-bold text-white tracking-tight">
                    {solverResults.results?.time_taken?.toFixed(2)}s
                  </div>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="section-label mb-1 text-[10px]">Memory</div>
                  <div className="text-lg font-bold text-white tracking-tight">
                    {solverResults.results?.memory_used?.toFixed(1)} <span className="text-xs opacity-50 uppercase">MB</span>
                  </div>
                </div>
                <div className="bg-black/20 rounded-xl p-4 border border-white/5">
                  <div className="section-label mb-1 text-[10px]">Steps</div>
                  <div className="text-xl font-bold text-white tracking-tight">
                    {solverResults.results?.solution_found && solverResults.results?.solution_length === 0 ? "-" : solverResults.results?.solution_length}
                  </div>
                </div>
              </div>

              {solverResults.results?.solution_found && solverResults.results?.solution_length > 0 && (
                <button
                  onClick={handleApplySolution}
                  className="btn-modern btn-accent w-full py-4 text-sm mt-4 shadow-lg active:translate-y-1"
                >
                  Apply Solution
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {showWinDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md flex items-center justify-center z-[100] p-4">
          <div className="bg-white/10 border border-white/20 backdrop-blur-xl p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4 max-w-sm w-full animate-in fade-in zoom-in duration-500">
            <div className="text-6xl mb-4 animate-bounce">🎉</div>
            <h2 className="text-4xl font-black text-amber-400 uppercase tracking-widest drop-shadow-md text-center mb-4">You Win!</h2>
            <div className="flex gap-4 w-full">
              <button onClick={() => { setShowWinDialog(false); handleRestart(); }} className="btn-modern btn-secondary flex-1 py-3 text-sm">Play Again</button>
              <button onClick={() => { setShowWinDialog(false); handleNewGame(); }} className="btn-modern btn-primary flex-1 py-3 text-sm">New Game</button>
            </div>
            <button
               onClick={() => setShowWinDialog(false)}
               className="mt-4 text-white/50 text-sm hover:text-white transition-colors uppercase tracking-widest font-bold"
            >
               Close overlay
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Game;
