import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import "./Home.css";

const API_URL = "http://localhost:5000/api";

const Home = () => {
  const navigate = useNavigate();
  const [mode, setMode] = useState("seed"); // 'seed' hoặc 'custom'
  const [seed, setSeed] = useState("1");
  const [testCases, setTestCases] = useState([]);
  const [selectedTestCase, setSelectedTestCase] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Fetch test cases khi chọn tab/mode custom
  React.useEffect(() => {
    const fetchTests = async () => {
      try {
        const res = await axios.get(`${API_URL}/custom-tests`);
        if (res.data.success) {
          setTestCases(res.data.tests);
          if (res.data.tests.length > 0) {
            setSelectedTestCase(res.data.tests[0].id);
          }
        }
      } catch (err) {
        console.error("Failed to fetch custom tests:", err);
      }
    };
    fetchTests();
  }, []);

  const handleNewGame = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await axios.post(
        `${API_URL}/new-game`,
        {
          seed: mode === "seed" ? parseInt(seed) || 1 : null,
          test_id: mode === "custom" ? selectedTestCase : null,
        },
        {
          withCredentials: true,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      if (response.data.success) {
        navigate(`/game/${response.data.game_id}`);
      } else {
        setError("Failed to create game");
      }
    } catch (err) {
      setError("Error connecting to server");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSeedChange = (e) => {
    const value = e.target.value;
    if (value === "" || /^\d+$/.test(value)) {
      setSeed(value);
    }
  };

  return (
    <div className="home-container">
      <div className="home-content">
        <div className="home-header">
          <h1 className="home-title">
            <span>FREE CELL</span> SOLVER
          </h1>
          <div className="home-subtitle">Premium Web Edition</div>
        </div>

        <div className="home-card">
          <h2 className="home-card-title">New Game</h2>
          
          {/* Toggle Mode */}
          <div className="game-mode-toggles">
            <button 
              className={`mode-btn ${mode === "seed" ? "active" : ""}`}
              onClick={() => setMode("seed")}
            >
              Random Board
            </button>
            <button 
              className={`mode-btn ${mode === "custom" ? "active" : ""}`}
              onClick={() => setMode("custom")}
            >
              Custom Test Boards
            </button>
          </div>

          {mode === "seed" ? (
            <div className="input-group">
              <label htmlFor="seed-input" className="input-label">
                Seed Number:
              </label>
              <input
                id="seed-input"
                type="text"
                className="seed-input"
                value={seed}
                onChange={handleSeedChange}
                placeholder="Enter seed (1-99999)"
              />
            </div>
          ) : (
            <div className="input-group">
              <label htmlFor="custom-test-select" className="input-label">
                Select Test Map:
              </label>
              {testCases.length === 0 ? (
                <div className="error-message">custom_tests.json not found.</div>
              ) : (
                <select
                  id="custom-test-select"
                  className="seed-input"
                  value={selectedTestCase}
                  onChange={(e) => setSelectedTestCase(e.target.value)}
                >
                  {testCases.map((tc) => (
                    <option key={tc.id} value={tc.id}>
                      [{tc.category.toUpperCase()}] #{tc.id} - {tc.description}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {error && <div className="error-message">{error}</div>}

          <button
            className="new-game-button"
            onClick={handleNewGame}
            disabled={loading || (mode === "custom" && testCases.length === 0)}
          >
            {loading ? <span className="loading-spinner"></span> : "START GAME"}
          </button>

          <button
            className="stats-link-button"
            onClick={() => navigate("/statistics")}
            style={{
              marginTop: "1rem",
              width: "100%",
              padding: "0.75rem",
              background: "transparent",
              border: "1px solid #10b981",
              color: "#10b981",
              borderRadius: "0.5rem",
              fontWeight: "600",
              cursor: "pointer",
              transition: "all 0.2s"
            }}
          >
            VIEW ALGORITHM STATISTICS
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
