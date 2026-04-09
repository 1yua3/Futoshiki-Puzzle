import React from "react";
import Button from "./Button";
import "./SolverDialog.css";

const SolverDialog = ({ results, onClose, onReplay }) => {
  const { solver, results: solverResults, solution } = results;

  return (
    <div className="dialog-overlay">
      <div className="dialog-content">
        <h2 className="dialog-title">{solver} Solution Found!</h2>

        <div className="dialog-stats">
          <div className="stat-row">
            <span className="stat-label">Expanded nodes:</span>
            <span className="stat-value">{solverResults.expanded_nodes}</span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Search time:</span>
            <span className="stat-value">
              {solverResults.search_time.toFixed(2)}s
            </span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Memory usage:</span>
            <span className="stat-value">
              {solverResults.memory_usage.toFixed(2)}MB
            </span>
          </div>
          <div className="stat-row">
            <span className="stat-label">Solution length:</span>
            <span className="stat-value">{solverResults.solution_length}</span>
          </div>
        </div>

        <div className="dialog-actions">
          <Button onClick={onReplay} color="green">
            Replay Solution
          </Button>
          <Button onClick={onClose} color="gray">
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SolverDialog;
