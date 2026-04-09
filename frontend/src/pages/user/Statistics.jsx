import React, { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell, LabelList
} from "recharts";
import {
  IconHistory, IconBrain, IconTrophy, IconHourglassHigh, IconArrowLeft,
  IconChartBar, IconChartPie, IconHash, IconExternalLink, IconLayoutGrid
} from "@tabler/icons-react";
import "./Statistics.css";

const API_URL = "http://localhost:5000/api";

const SOLVER_COLORS = {
  BFS: "#f59e0b",
  DFS: "#3b82f6",
  UCS: "#10b981",
  "A*": "#f43f5e",
};

const LEVELS = ["all", "easy", "hard"];
const DIFFICULTY_LEVELS = ["easy", "hard"];

// --- Sub-components ---

const StatCard = ({ label, value, icon: Icon, trend, color = "amber" }) => (
  <div className="glass-card p-4 flex items-center justify-between">
    <div>
      <p className="text-slate-400 text-xs font-medium mb-0.5">{label}</p>
      <h3 className="text-xl font-bold text-white leading-tight">{value}</h3>
      {trend && (
        <span className={`text-[10px] font-semibold ${trend > 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {trend > 0 ? "↑" : "↓"} {Math.abs(trend)}%
        </span>
      )}
    </div>
    <div className={`p-2 rounded-xl bg-${color}-500/10 border border-${color}-500/20`}>
      <Icon className={`w-5 h-5 text-${color}-500`} />
    </div>
  </div>
);

const ChartWrapper = ({ title, icon: Icon, children, subtitle }) => (
  <div className="glass-card p-5 flex-1 min-w-0 overflow-hidden">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2.5">
        <div className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
          <Icon className="text-amber-500 w-4 h-4" />
        </div>
        <div>
          <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
          {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
        </div>
      </div>
    </div>
    <div className="h-[280px] w-full mt-2">
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  </div>
);

// Grouped chart: X = difficulty level, bars = solvers
const LevelGroupedChart = ({ title, icon: Icon, subtitle, data, yAxisProps = {}, yAxisLabel, formatter, labelFormatter }) => (
  <div className="glass-card p-5 overflow-hidden flex flex-col" style={{ background: "rgba(15, 23, 42, 0.4)" }}>
    <div className="flex items-center gap-2.5 mb-5">
      <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
        <Icon className="text-emerald-500 w-4 h-4" />
      </div>
      <div>
        <h3 className="text-base font-bold text-white tracking-tight">{title}</h3>
        {subtitle && <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
    <div className="flex-1 w-full min-h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 20, right: 10, left: 40, bottom: 20 }} barCategoryGap="20%" barGap={6}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis
            dataKey="level"
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            label={{ value: yAxisLabel, angle: -90, position: 'insideLeft', offset: -35, fill: '#64748b', fontSize: 10, fontWeight: 600 }}
            tickFormatter={(v) => typeof v === 'number' && v >= 1000 ? `${v / 1000}k` : v}
            {...yAxisProps}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.05)' }}
            contentStyle={{ borderRadius: '12px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px' }}
            formatter={(value) => formatter ? formatter(value) : value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          />
          <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '12px' }} />
          {Object.entries(SOLVER_COLORS).map(([solver, color]) => (
            <Bar key={solver} dataKey={solver} name={solver} fill={color} radius={[4, 4, 0, 0]} maxBarSize={32} minPointSize={8}>
              <LabelList
                dataKey={solver}
                position="top"
                fill={color}
                fontSize={9}
                fontWeight={600}
                formatter={(v) => {
                  if (labelFormatter) return labelFormatter(v);
                  if (v === 0 || v === 0.001) return "";
                  if (v >= 1000) return (v / 1000).toFixed(1).replace('.0', '') + 'k';
                  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 1 });
                }}
              />
            </Bar>
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);



const HistoryTable = ({ matches, showAll, onToggle }) => (
  <div className="glass-card p-4 overflow-hidden">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2">
        <IconHistory className="text-amber-500 w-4 h-4" />
        <h3 className="text-base font-bold">Recent Matches</h3>
      </div>
      <button
        onClick={onToggle}
        className="text-[10px] font-semibold text-amber-500 flex items-center gap-1 hover:underline transition-all"
      >
        {showAll ? "Show Less" : "See All"} <IconExternalLink className={`w-3 h-3 transition-transform ${showAll ? 'rotate-180' : ''}`} />
      </button>
    </div>
    <div className="overflow-x-auto">
      <table className="history-table">
        <thead>
          <tr>
            <th className="!p-2 text-[10px]">Seed</th>
            <th className="!p-2 text-[10px]">Algorithm</th>
            <th className="!p-2 text-[10px]">Result</th>
            <th className="!p-2 text-[10px]">Steps</th>
            <th className="!p-2 text-[10px]">Time</th>
          </tr>
        </thead>
        <tbody>
          {(matches || []).slice(0, showAll ? undefined : 10).map((m, idx) => (
            <tr key={idx} className="hover:bg-white/5 transition-colors">
              <td className="!p-2 font-medium text-xs">#{m?.seed || "---"}</td>
              <td className="!p-2 text-slate-300 uppercase text-[10px] font-bold">{m?.solver || "unknown"}</td>
              <td className="!p-2">
                <span className={`status-badge !px-2 !py-0.5 !text-[10px] ${m?.status === 'Finished' ? 'status-success' : 'status-fail'}`}>
                  {m?.status === 'Finished' ? 'Success' : 'Fail'}
                </span>
              </td>
              <td className="!p-2 font-mono text-amber-500 text-xs">{m?.solution_length || "--"}</td>
              <td className="!p-2 text-slate-400 text-xs">{m?.search_time ? `${m.search_time}s` : "--"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

// --- Main Page Component ---

const Statistics = () => {
  const navigate = useNavigate();
  const [rawData, setRawData] = useState([]);
  const [overview, setOverview] = useState({ total_games: 0, win_rate: 0, avg_time: 0 });
  const [recentMatches, setRecentMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllMatches, setShowAllMatches] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState("all");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await axios.get(`${API_URL}/statistics`);
        if (res.data.success) {
          setRawData(res.data.statistics);
          setOverview(res.data.overview);
          setRecentMatches(res.data.recent_matches);
        }
      } catch (err) {
        console.error("Failed to fetch statistics:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Data Transformations ---

  const processedData = useMemo(() => {
    if (!rawData || rawData.length === 0) return {
      timeData: [], nodeData: [], solutionData: [], memoryData: [], heatmapData: [],
      levelTimeData: [], levelNodeData: [], levelSolutionData: [], levelMemoryData: []
    };

    const heatmapData = [];
    rawData.forEach(s => {
      s.categories.forEach(c => {
        heatmapData.push({
          solver: s.solver,
          category: c.name,
          timeouts: c.timeouts || 0,
          total: c.total_tests || 0
        });
      });
    });

    // Filtering logic for single-level view
    const filterByLevel = (level) => {
      const solvers = ["BFS", "DFS", "UCS", "A*"];
      return solvers.map(solverName => {
        const solverObj = rawData.find(s => s.solver.toUpperCase() === solverName.toUpperCase());
        if (!solverObj) return { name: solverName, value: 0 };

        let targetCats = solverObj.categories;
        if (level !== "all") {
          targetCats = targetCats.filter(c => c.name.toLowerCase() === level.toLowerCase());
        }

        if (targetCats.length === 0) return { name: solverName, value: 0 };

        return {
          name: solverName,
          time: Math.max(0.001, Number((targetCats.reduce((acc, c) => acc + c.avg_time, 0) / targetCats.length).toFixed(3))),
          nodes: Math.max(1, Math.round(targetCats.reduce((acc, c) => acc + c.avg_nodes, 0) / targetCats.length)),
          solution: Number((targetCats.reduce((acc, c) => acc + c.avg_solution, 0) / targetCats.length).toFixed(1)),
          memory: Math.max(0.001, Number((targetCats.reduce((acc, c) => acc + c.avg_memory, 0) / targetCats.length).toFixed(2))),
          fill: SOLVER_COLORS[solverName]
        };
      });
    };

    const filteredMatches = selectedLevel === "all"
      ? recentMatches
      : recentMatches.filter(m => m.category?.toLowerCase() === selectedLevel.toLowerCase());

    const solvers = ["BFS", "DFS", "UCS", "A*"];

    // Dynamic grouping based on selected level
    const buildGroupedChartData = (metric, matchMetricKey) => {
      if (selectedLevel === "all") {
        // ROWS = DIFFICULTY LEVELS
        return DIFFICULTY_LEVELS.map(level => {
          const row = { level };
          rawData.forEach(solverObj => {
            const cat = solverObj.categories.find(c => c.name.toLowerCase() === level.toLowerCase());
            const val = cat ? (cat[metric] || 0) : 0;
            if (metric === 'avg_nodes') {
              row[solverObj.solver] = Math.max(1, Math.round(val));
            } else if (metric === 'avg_time' || metric === 'avg_memory') {
              row[solverObj.solver] = Math.max(0.001, Number(val.toFixed(3)));
            } else {
              row[solverObj.solver] = Number(val.toFixed(3));
            }
          });
          return row;
        });
      } else {
        // ROWS = SPECIFIC TEST CASES (SEEDS) within the filtered matches
        const uniqueSeeds = Array.from(new Set(filteredMatches.map(m => m.seed))).sort();
        return uniqueSeeds.map(seed => {
          const row = { level: seed }; // Use 'level' key so the XAxis handles it seamlessly
          solvers.forEach(solver => {
            const match = filteredMatches.find(m => m.seed === seed && m.solver === solver);
            const rawVal = match ? (match[matchMetricKey] || 0) : 0;
            if (matchMetricKey === 'expanded_nodes') {
              row[solver] = Math.max(1, Math.round(rawVal));
            } else if (matchMetricKey === 'search_time' || matchMetricKey === 'memory_usage') {
              row[solver] = Math.max(0.001, Number(rawVal.toFixed(3)));
            } else {
              row[solver] = Math.round(rawVal);
            }
          });
          return row;
        });
      }
    };

    const currentStats = filterByLevel(selectedLevel);

    return {
      timeData: currentStats,
      nodeData: currentStats,
      solutionData: currentStats,
      memoryData: currentStats,
      heatmapData,
      filteredMatches,
      levelTimeData: buildGroupedChartData('avg_time', 'search_time'),
      levelNodeData: buildGroupedChartData('avg_nodes', 'expanded_nodes'),
      levelSolutionData: buildGroupedChartData('avg_solution', 'solution_length'),
      levelMemoryData: buildGroupedChartData('avg_memory', 'memory_usage'),
    };
  }, [rawData, recentMatches, selectedLevel]);

  const commonProps = {
    margin: { top: 10, right: 10, left: 0, bottom: 0 },
    barSize: 40,
  };

  const axisTheme = {
    axisLine: false,
    tickLine: false,
    tick: { fill: '#94a3b8', fontSize: 10 },
  };

  const tooltipTheme = {
    cursor: { fill: 'rgba(255,255,255,0.05)' },
    contentStyle: { borderRadius: '12px', background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', fontSize: '11px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.5)' },
  };

  if (loading) return (
    <div className="stats-container flex items-center justify-center">
      <div className="loading-spinner"></div>
    </div>
  );

  return (
    <div className="stats-container py-4 md:py-8">
      <div className="max-w-6xl mx-auto px-4">

        {/* Header */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-extrabold text-amber-500 tracking-tight flex items-center gap-3">
              <IconChartBar className="w-8 h-8" /> <span>Analytics</span>
            </h1>
            <p className="text-slate-400 text-sm mt-1 font-medium">Comparative analysis of FreeCell solvers.</p>
          </div>
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="glass-card flex p-1 bg-white/5 border border-white/10 rounded-full overflow-hidden">
              {LEVELS.map(l => (
                <button
                  key={l}
                  onClick={() => setSelectedLevel(l)}
                  className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all ${selectedLevel === l ? 'bg-amber-500 text-slate-900 shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <button onClick={() => navigate("/")} className="btn-back flex items-center gap-2 !py-2 !px-5 text-[10px] whitespace-nowrap">
              <IconArrowLeft size={14} /> EXIT
            </button>
          </div>
        </div>

        {/* Overview Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
          <StatCard label="Total Runs" value={overview.total_games} icon={IconTrophy} />
          <StatCard label="Avg. Success Rate" value={`${overview.win_rate}%`} icon={IconBrain} color="emerald" />
          <StatCard label="Avg. Compute Time" value={`${overview.avg_time}s`} icon={IconHourglassHigh} color="rose" />
        </div>


        {/* Charts Grid — filtered by selected level */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <ChartWrapper title="Search Time" icon={IconHourglassHigh} subtitle="Time taken to find a valid solution (seconds)">
            <BarChart data={processedData.timeData} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" {...axisTheme} />
              <YAxis {...axisTheme} />
              <Tooltip {...tooltipTheme} />
              <Bar dataKey="time" radius={[6, 6, 0, 0]} minPointSize={8} />
            </BarChart>
          </ChartWrapper>

          <ChartWrapper title="Expanded Nodes" icon={IconBrain} subtitle="Search space explored (Logarithmic scale)">
            <BarChart data={processedData.nodeData} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" {...axisTheme} />
              <YAxis {...axisTheme} scale="log" domain={['auto', 'auto']} allowDataOverflow />
              <Tooltip {...tooltipTheme} />
              <Bar dataKey="nodes" radius={[6, 6, 0, 0]} minPointSize={8} />
            </BarChart>
          </ChartWrapper>

          <ChartWrapper title="Optimal Solution" icon={IconTrophy} subtitle="Average number of moves to win">
            <BarChart data={processedData.solutionData} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" {...axisTheme} />
              <YAxis {...axisTheme} />
              <Tooltip {...tooltipTheme} />
              <Bar dataKey="solution" radius={[6, 6, 0, 0]} minPointSize={8} />
            </BarChart>
          </ChartWrapper>

          <ChartWrapper title="Memory Footprint" icon={IconHash} subtitle="Process memory overhead (MB)">
            <BarChart data={processedData.memoryData} {...commonProps}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" {...axisTheme} />
              <YAxis {...axisTheme} />
              <Tooltip {...tooltipTheme} />
              <Bar dataKey="memory" radius={[6, 6, 0, 0]} minPointSize={8} />
            </BarChart>
          </ChartWrapper>
        </div>

        {/* ── Per-Level/Per-Test Breakdown ── */}
        <div className="mb-3 flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <IconLayoutGrid className="text-emerald-500 w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white tracking-tight">
              {selectedLevel === "all" ? "Per-Level Breakdown" : `Per-Test Breakdown: ${selectedLevel.toUpperCase()}`}
            </h2>
            <p className="text-[10px] text-slate-400">
              {selectedLevel === "all"
                ? "All difficulty levels side by side — compare how each solver scales"
                : "Specific test cases side by side — evaluate single board performance"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <LevelGroupedChart
            title={selectedLevel === "all" ? "Search Time by Level" : "Search Time per Test"}
            icon={IconHourglassHigh}
            subtitle={selectedLevel === "all" ? "Avg. seconds per difficulty (Log Scale)" : "Seconds per test case (Log Scale)"}
            data={processedData.levelTimeData}
            yAxisLabel="Time (Seconds)"
            yAxisProps={{ scale: "log", domain: ['auto', 'auto'], allowDataOverflow: true }}
            formatter={(v) => `${Number(v).toFixed(3)} s`}
            labelFormatter={(v) => v <= 0.001 ? "0" : Number(v).toFixed(3)}
          />
          <LevelGroupedChart
            title={selectedLevel === "all" ? "Expanded Nodes by Level" : "Expanded Nodes per Test"}
            icon={IconBrain}
            subtitle={selectedLevel === "all" ? "Avg. nodes explored per difficulty (Log Scale)" : "Nodes explored per test case (Log Scale)"}
            data={processedData.levelNodeData}
            yAxisLabel="Nodes"
            yAxisProps={{ scale: "log", domain: ['auto', 'auto'], allowDataOverflow: true }}
            formatter={(v) => `${Number(v).toLocaleString()} nodes`}
            labelFormatter={(v) => v === 0 ? "0" : v >= 1000 ? (v / 1000).toFixed(1).replace('.0', '') + 'k' : v}
          />
          <LevelGroupedChart
            title={selectedLevel === "all" ? "Solution Length by Level" : "Solution Length per Test"}
            icon={IconTrophy}
            subtitle={selectedLevel === "all" ? "Avg. moves to solve per difficulty" : "Moves to solve per test case"}
            data={processedData.levelSolutionData}
            yAxisLabel="Steps"
            formatter={(v) => `${Number(v).toLocaleString()} moves`}
            labelFormatter={(v) => v === 0 ? "0" : v}
          />
          <LevelGroupedChart
            title={selectedLevel === "all" ? "Memory Usage by Level" : "Memory Usage per Test"}
            icon={IconHash}
            subtitle={selectedLevel === "all" ? "Avg. MB used per difficulty (Log Scale)" : "MB used per test case (Log Scale)"}
            data={processedData.levelMemoryData}
            yAxisLabel="Memory (MB)"
            yAxisProps={{ scale: "log", domain: ['auto', 'auto'], allowDataOverflow: true }}
            formatter={(v) => `${Number(v).toLocaleString()} MB`}
            labelFormatter={(v) => v <= 0.001 ? "0" : Number(v).toFixed(3)}
          />
        </div>

        {/* History Table */}
        <HistoryTable
          matches={processedData.filteredMatches}
          showAll={showAllMatches}
          onToggle={() => setShowAllMatches(!showAllMatches)}
        />
      </div>
    </div>
  );
};

export default Statistics;
