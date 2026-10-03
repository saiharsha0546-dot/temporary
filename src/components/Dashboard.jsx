import React, { useRef, useEffect, useState, useMemo } from 'react';
import {
  Timer, Navigation, Gauge, RefreshCw, Hospital,
  CheckCircle2, AlertCircle, ArrowUpRight, Terminal, Zap,
  BarChart3, History, Trash2, Play, ChevronRight, Activity, TrendingDown
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { BENCHMARK_SCENARIOS, runScenarioComparison } from '../engine/metrics.js';
import { findBestHospital } from '../engine/routing.js';

export default function Dashboard({
  simulationState,
  corridorActive,
  onOpenExplain,
  network,
  hospitals,
  onApplyScenarioToLive,
  blockedEdgeIds,
  simulationTime,
  alternativeRoutes
}) {
  const [activeTab, setActiveTab] = useState('intelligence'); 
  const logContainerRef = useRef(null);
  const [history, setHistory] = useState([]);
  const [compareScenarioId, setCompareScenarioId] = useState('peak-hour-rush');
  
  // Auto-scroll logs
  useEffect(() => {
    if (activeTab === 'intelligence' && logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [simulationState?.logs, activeTab]);

  // Load history
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lifeline_history');
      if (saved) setHistory(JSON.parse(saved));
    } catch (e) {}
  }, []);

  // Save on arrival
  const lastSavedRun = useRef(null);
  useEffect(() => {
    if (simulationState?.status === 'ARRIVED') {
      const runId = simulationState.logs[0]?.timestamp + simulationState.startNodeId;
      if (lastSavedRun.current === runId) return;
      lastSavedRun.current = runId;

      const staticResult = findBestHospital(network, simulationState.startNodeId, hospitals, {
        simulationTime: simulationTime,
        blockedEdgeIds: new Set(),
        corridorActive: false
      });
      const baselineTimeSec = staticResult.bestRoute?.totalTimeSec || 0;
      const lifelineTimeSec = simulationState.activeRoute?.totalTimeSec || 0;
      const timeSavedSec = Math.max(0, baselineTimeSec - lifelineTimeSec);
      const percentSaved = baselineTimeSec > 0 ? ((timeSavedSec / baselineTimeSec) * 100).toFixed(1) : 0;

      const newRun = {
        id: Date.now(),
        timestamp: new Date().toLocaleString(),
        startNodeId: simulationState.startNodeId,
        time: simulationTime,
        blockedEdgeIds: [...blockedEdgeIds],
        scenarioName: 'Manual Dispatch',
        emergencyLocation: network.getNode(simulationState.startNodeId)?.name || 'Unknown',
        hospital: simulationState.targetHospital?.name || 'Unknown',
        incidents: blockedEdgeIds.length,
        corridorOn: corridorActive,
        percentSaved,
        routeChanges: simulationState.routeChangesCount,
        lifelineTimeSec,
        baselineTimeSec
      };

      const updatedHistory = [newRun, ...history];
      setHistory(updatedHistory);
      try {
        localStorage.setItem('lifeline_history', JSON.stringify(updatedHistory));
      } catch(e) {}
    }
  }, [simulationState?.status, network, hospitals, simulationTime, blockedEdgeIds, corridorActive, history]);

  const clearHistory = () => {
    if (window.confirm("Are you sure you want to clear all history?")) {
      setHistory([]);
      try { localStorage.removeItem('lifeline_history'); } catch(e) {}
    }
  };

  const deleteRun = (id) => {
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    try { localStorage.setItem('lifeline_history', JSON.stringify(updated)); } catch(e) {}
  };

  const replayRun = (run) => {
    if (onApplyScenarioToLive) {
      onApplyScenarioToLive({
         startNodeId: run.startNodeId,
         time: run.time,
         blockedEdgeIds: run.blockedEdgeIds
      });
    }
  };

  const activeResult = useMemo(() => {
    if (!network || !hospitals) return null;
    return runScenarioComparison(network, compareScenarioId, hospitals);
  }, [network, hospitals, compareScenarioId]);

  const renderIntelligence = () => {
    const activeRoute = simulationState?.activeRoute;
    const optimal = alternativeRoutes?.[0];
    
    // Sort roads by congestion
    const congestedEdges = [];
    if (activeRoute && activeRoute.edgeCostBreakdowns) {
      const sorted = [...activeRoute.edgeCostBreakdowns].sort((a,b) => b.congestionFactor - a.congestionFactor);
      congestedEdges.push(...sorted.slice(0,3));
    }
    
    return (
      <div className="space-y-4 flex flex-col h-full overflow-y-auto custom-scrollbar p-1">
        <div className="p-3 rounded-xl bg-dark-950/70 border border-slate-800 space-y-2">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5"><Navigation className="w-3.5 h-3.5 text-blue-400" /> Route Explanation</h4>
          {optimal ? (
            <>
              <p className="text-xs text-slate-400 leading-relaxed">
                Chose <strong>{optimal.label}</strong> because it is {Math.round(optimal.totalTimeSec)}s ({optimal.totalDistanceKm}km). 
                {alternativeRoutes?.length > 1 && ` It is ${Math.round(alternativeRoutes[1].totalTimeSec - optimal.totalTimeSec)}s faster than alternatives.`}
              </p>
              <table className="w-full text-[10px] text-left mt-2">
                <thead className="text-slate-500 border-b border-slate-800">
                  <tr><th className="pb-1">Route</th><th className="pb-1">Time</th><th className="pb-1">Dist</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {alternativeRoutes?.map((alt, idx) => (
                    <tr key={idx}>
                      <td className="py-1.5 text-slate-300 truncate max-w-[100px]">{alt.label}</td>
                      <td className={`py-1.5 font-mono ${idx===0 ? 'text-emerald-400' : 'text-slate-400'}`}>{Math.round(alt.totalTimeSec)}s</td>
                      <td className="py-1.5 text-slate-400 font-mono">{alt.totalDistanceKm}km</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          ) : (
            <p className="text-xs text-slate-500 italic">Dispatch to calculate route...</p>
          )}
        </div>

        <div className="p-3 rounded-xl bg-dark-950/70 border border-slate-800">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Activity className="w-3.5 h-3.5 text-amber-400" /> Network Health</h4>
          <div className="flex justify-between items-center text-xs mb-1">
            <span className="text-slate-400">Blocked Roads:</span>
            <span className="font-mono text-amber-400">{blockedEdgeIds?.length || 0}</span>
          </div>
          {congestedEdges.length > 0 && (
            <div className="text-xs mt-2 space-y-1">
              <span className="text-slate-400 block mb-1">Most Congested on Route:</span>
              {congestedEdges.map((e, idx) => (
                <div key={idx} className="flex justify-between font-mono text-[10px]">
                  <span className="text-slate-300 truncate mr-2">{e.street}</span>
                  <span className="text-red-400 shrink-0">{e.congestionFactor.toFixed(1)}x</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-[10px] text-slate-500 mt-3 border-t border-slate-800 pt-2 italic">Data generated by rule-based simulation.</div>
        </div>

        <div className="flex-1 flex flex-col min-h-[200px] bg-dark-950/90 border border-slate-800/90 rounded-xl p-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest flex items-center gap-1.5 mb-2"><Terminal className="w-3.5 h-3.5 text-slate-400" /> Decision Log</h4>
          <div ref={logContainerRef} className="flex-1 overflow-y-auto space-y-2 font-mono text-[11px] custom-scrollbar pr-1">
            {simulationState?.logs?.map(log => {
               let badgeColor = 'bg-slate-800 text-slate-300 border-slate-700';
               if (log.type === 'DISPATCH') badgeColor = 'bg-blue-500/20 text-blue-400 border-blue-500/40';
               if (log.type === 'REROUTE') badgeColor = 'bg-purple-500/20 text-purple-400 border-purple-500/40 animate-pulse';
               if (log.type === 'SUCCESS') badgeColor = 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40';
               if (log.type === 'CRITICAL' || log.type === 'ERROR') badgeColor = 'bg-red-500/20 text-red-400 border-red-500/40';
               return (
                 <div key={log.id} className="flex items-start gap-2 leading-relaxed">
                   <span className="text-[10px] text-slate-500 shrink-0 mt-0.5">[{log.timestamp}]</span>
                   <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border shrink-0 ${badgeColor}`}>{log.type}</span>
                   <span className="text-slate-300 break-words">{log.message}</span>
                 </div>
               );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderImpact = () => {
    const { scenario, baseline, lifeline, savings } = activeResult || {};
    const chartData = [
      { name: 'Baseline', time: baseline?.travelTimeSec || 0, fill: '#64748b' },
      { name: 'LIFELINE', time: lifeline?.travelTimeSec || 0, fill: '#22c55e' }
    ];

    return (
      <div className="space-y-4 flex flex-col h-full overflow-y-auto custom-scrollbar p-1">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-400 uppercase">Select Scenario</label>
          <select 
            value={compareScenarioId} 
            onChange={e => setCompareScenarioId(e.target.value)}
            className="w-full bg-dark-950 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 outline-none focus:border-blue-500"
          >
            {BENCHMARK_SCENARIOS.map(s => (
              <option key={s.id} value={s.id}>{s.title}</option>
            ))}
          </select>
          <button
            onClick={() => onApplyScenarioToLive && onApplyScenarioToLive(scenario)}
            className="w-full py-2 rounded-lg text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/40 transition-colors"
          >
            Run comparison
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/30">
            <div className="text-[10px] text-emerald-400 font-bold uppercase">Time Saved</div>
            <div className="text-xl font-black font-mono text-slate-100">{savings?.timeSavedSec}s <span className="text-xs text-emerald-400">({savings?.percentSaved}%)</span></div>
          </div>
          <div className="p-3 rounded-xl bg-blue-950/20 border border-blue-500/30">
            <div className="text-[10px] text-blue-400 font-bold uppercase">Delay Saved</div>
            <div className="text-xl font-black font-mono text-slate-100">{savings?.signalDelaySavedSec}s</div>
          </div>
          <div className="p-3 rounded-xl bg-amber-950/20 border border-amber-500/30">
            <div className="text-[10px] text-amber-400 font-bold uppercase">Stops Avoided</div>
            <div className="text-xl font-black font-mono text-slate-100">{savings?.stopsSaved}</div>
          </div>
          <div className="p-3 rounded-xl bg-purple-950/20 border border-purple-500/30">
            <div className="text-[10px] text-purple-400 font-bold uppercase">Route Changes</div>
            <div className="text-xl font-black font-mono text-slate-100">{lifeline?.routeChanges}</div>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-dark-950/70 border border-slate-800 flex-1 min-h-[180px]">
           <h4 className="text-xs font-bold text-slate-300 uppercase tracking-widest mb-4">Travel Time (sec)</h4>
           <ResponsiveContainer width="100%" height={150}>
             <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 20, left: -20, bottom: 0 }}>
               <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
               <XAxis type="number" stroke="#94a3b8" fontSize={10} />
               <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} />
               <Tooltip cursor={{fill: '#1e293b'}} contentStyle={{backgroundColor: '#0f172a', border: '1px solid #334155', fontSize: '12px'}} />
               <Bar dataKey="time" radius={[0, 4, 4, 0]} barSize={24} />
             </BarChart>
           </ResponsiveContainer>
        </div>
        <div className="text-[10px] text-slate-500 mt-2 border-t border-slate-800 pt-2 italic">Measured in controlled simulation against a static-routing baseline.</div>
      </div>
    );
  };

  const renderHistory = () => {
    return (
      <div className="flex flex-col h-full overflow-hidden p-1">
        <div className="flex justify-between items-center mb-3">
          <h4 className="text-xs font-bold text-slate-300 uppercase">Past Scenarios</h4>
          {history.length > 0 && (
            <button onClick={clearHistory} className="text-[10px] text-red-400 hover:text-red-300 border border-red-500/30 px-2 py-1 rounded">Clear history</button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto space-y-2 custom-scrollbar pr-1">
          {history.length === 0 ? (
            <div className="text-xs text-slate-500 italic text-center py-8">No runs recorded yet. Finish a dispatch to save history.</div>
          ) : history.map(run => (
            <div key={run.id} className="p-3 rounded-xl bg-dark-950/70 border border-slate-800 space-y-2">
              <div className="flex justify-between items-start">
                <div>
                  <div className="text-xs font-bold text-slate-200">{run.emergencyLocation}</div>
                  <div className="text-[10px] text-slate-400">{new Date(run.timestamp).toLocaleTimeString()} • {run.hospital}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-mono font-bold text-emerald-400">-{run.percentSaved}% time</div>
                  <div className="text-[10px] text-slate-500">{run.routeChanges} reroute(s)</div>
                </div>
              </div>
              <div className="flex gap-2 pt-2 border-t border-slate-800">
                <button onClick={() => replayRun(run)} className="flex-1 flex items-center justify-center gap-1 py-1 rounded bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 text-[10px] transition-colors"><Play className="w-3 h-3" /> Replay</button>
                <button onClick={() => deleteRun(run.id)} className="flex items-center justify-center px-2 rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"><Trash2 className="w-3 h-3" /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-dark-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      <div className="px-5 pt-3 bg-dark-850 border-b border-slate-800 flex gap-4 text-xs font-bold uppercase tracking-widest">
        <button onClick={() => setActiveTab('intelligence')} className={`pb-2 border-b-2 transition-colors ${activeTab === 'intelligence' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Intelligence</button>
        <button onClick={() => setActiveTab('impact')} className={`pb-2 border-b-2 transition-colors ${activeTab === 'impact' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>Impact</button>
        <button onClick={() => setActiveTab('history')} className={`pb-2 border-b-2 transition-colors ${activeTab === 'history' ? 'border-amber-500 text-amber-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>History</button>
      </div>
      <div className="p-4 flex-1 overflow-hidden">
        {activeTab === 'intelligence' && renderIntelligence()}
        {activeTab === 'impact' && renderImpact()}
        {activeTab === 'history' && renderHistory()}
      </div>
    </div>
  );
}
