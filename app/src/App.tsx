import React, { useRef, useState, useEffect } from 'react';
import { Play, Pause, Square, RotateCcw, Download, Video, Film, Grid, Settings2, Image as ImageIcon, Trash2, Upload, RefreshCw, Save, Activity, Monitor, Edit3, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Clock, Eye, EyeOff, FolderOpen } from 'lucide-react';
import AnimationCanvas, { AnimationCanvasRef } from './components/AnimationCanvas';

const DEFAULT_SETTINGS = {
  duration: 10,
  revealDuration: 1.5,
  mode: 'together' as const,
  resolution: { w: 1920, h: 1080 },
  bgColor: '#05050a',
  showGrid: true,
  showBloom: true,
  lineWidth: 2,
  pointRadius: 4,
  line1Color: '#ff5e00', // Target
  line2Color: '#00d2ff', // Baseline
  particleSize: 2,
  particleColor1: '#ff5e00',
  particleColor2: '#00d2ff',
  particleShape: 'circle' as 'circle' | 'triangle' | 'star' | 'diamond' | 'hex',
  particleEmissionRate: 0.5,
  targetPoints: [
    {x: 0, y: 0}, {x: 0.09, y: 0.04}, {x: 0.18, y: 0.12}, {x: 0.23, y: 0.14},
    {x: 0.24, y: 0.18}, {x: 0.27, y: 0.18}, {x: 0.36, y: 0.26}, {x: 0.45, y: 0.29},
    {x: 0.55, y: 0.30}, {x: 0.59, y: 0.33}, {x: 0.68, y: 0.36}, {x: 0.73, y: 0.39},
    {x: 0.80, y: 0.43}, {x: 0.88, y: 0.51}, {x: 0.95, y: 0.56}, {x: 1.0, y: 0.66}
  ],
  baselinePoints: [
    {x: 0, y: 0}, {x: 0.09, y: 0.08}, {x: 0.18, y: 0.18}, {x: 0.23, y: 0.24},
    {x: 0.27, y: 0.25}, {x: 0.36, y: 0.34}, {x: 0.45, y: 0.39}, {x: 0.55, y: 0.41},
    {x: 0.59, y: 0.46}, {x: 0.68, y: 0.51}, {x: 0.73, y: 0.58}, {x: 0.80, y: 0.61},
    {x: 0.88, y: 0.70}, {x: 0.95, y: 0.78}, {x: 1.0, y: 0.89}
  ]
};

export default function App() {
  const canvasRef = useRef<AnimationCanvasRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [isEditorMode, setIsEditorMode] = useState(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);
  
  // Settings State
  const [duration, setDuration] = useState(DEFAULT_SETTINGS.duration);
  const [revealDuration, setRevealDuration] = useState(DEFAULT_SETTINGS.revealDuration);
  const [mode, setMode] = useState<'together' | 'staggered'>(DEFAULT_SETTINGS.mode as 'together' | 'staggered');
  const [resolution, setResolution] = useState(DEFAULT_SETTINGS.resolution);
  const [bgColor, setBgColor] = useState(DEFAULT_SETTINGS.bgColor);
  const [showGrid, setShowGrid] = useState(DEFAULT_SETTINGS.showGrid);
  const [showBloom, setShowBloom] = useState(DEFAULT_SETTINGS.showBloom);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [lineWidth, setLineWidth] = useState(DEFAULT_SETTINGS.lineWidth);
  const [pointRadius, setPointRadius] = useState(DEFAULT_SETTINGS.pointRadius);
  const [line1Color, setLine1Color] = useState(DEFAULT_SETTINGS.line1Color);
  const [line2Color, setLine2Color] = useState(DEFAULT_SETTINGS.line2Color);
  const [particleSize, setParticleSize] = useState(DEFAULT_SETTINGS.particleSize);
  const [particleColor1, setParticleColor1] = useState(DEFAULT_SETTINGS.particleColor1);
  const [particleColor2, setParticleColor2] = useState(DEFAULT_SETTINGS.particleColor2);
  const [particleShape, setParticleShape] = useState(DEFAULT_SETTINGS.particleShape);
  const [particleEmissionRate, setParticleEmissionRate] = useState(DEFAULT_SETTINGS.particleEmissionRate);
  const [targetPoints, setTargetPoints] = useState(DEFAULT_SETTINGS.targetPoints);
  const [baselinePoints, setBaselinePoints] = useState(DEFAULT_SETTINGS.baselinePoints);
  const [showTarget, setShowTarget] = useState(true);
  const [showBaseline, setShowBaseline] = useState(true);

  // Save System State
  const [savedGraphs, setSavedGraphs] = useState<{id: string, name: string, settings: any}[]>([]);
  const [currentGraphId, setCurrentGraphId] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Prompt State
  const [promptConfig, setPromptConfig] = useState<{isOpen: boolean, title: string, value: string, onConfirm: (val: string) => void} | null>(null);

  // UI State
  const [mouseNearLeft, setMouseNearLeft] = useState(false);
  const [mouseNearRight, setMouseNearRight] = useState(false);
  const [isScrolling, setIsScrolling] = useState(false);
  const scrollTimeout = useRef<NodeJS.Timeout | null>(null);
  const mainLayoutRef = useRef<HTMLDivElement>(null);

  // History for Undo/Redo
  const historyRef = useRef<{target: {x:number, y:number}[], baseline: {x:number, y:number}[]}[]>([]);
  const historyIndexRef = useRef(-1);
  const commitTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (isEditorMode) {
      if (historyRef.current.length === 0) {
        historyRef.current = [{ target: JSON.parse(JSON.stringify(targetPoints)), baseline: JSON.parse(JSON.stringify(baselinePoints)) }];
        historyIndexRef.current = 0;
      }
    } else {
      historyRef.current = [];
      historyIndexRef.current = -1;
    }
  }, [isEditorMode]);

  useEffect(() => {
    if (!isEditorMode) return;
    if (commitTimeoutRef.current) clearTimeout(commitTimeoutRef.current);
    commitTimeoutRef.current = setTimeout(() => {
      const newEntry = { target: JSON.parse(JSON.stringify(targetPoints)), baseline: JSON.parse(JSON.stringify(baselinePoints)) };
      if (historyIndexRef.current >= 0) {
        const current = historyRef.current[historyIndexRef.current];
        if (JSON.stringify(current) === JSON.stringify(newEntry)) return;
      }
      const newHistory = historyRef.current.slice(0, historyIndexRef.current + 1);
      newHistory.push(newEntry);
      if (newHistory.length > 50) newHistory.shift();
      else historyIndexRef.current++;
      historyRef.current = newHistory;
    }, 200);
  }, [targetPoints, baselinePoints, isEditorMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isEditorMode) return;
      
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z') {
          e.preventDefault();
          if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
            const state = historyRef.current[historyIndexRef.current];
            setTargetPoints(JSON.parse(JSON.stringify(state.target)));
            setBaselinePoints(JSON.parse(JSON.stringify(state.baseline)));
          }
        } else if (e.key === 'y' || (e.key === 'Z' && e.shiftKey)) {
          e.preventDefault();
          if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++;
            const state = historyRef.current[historyIndexRef.current];
            setTargetPoints(JSON.parse(JSON.stringify(state.target)));
            setBaselinePoints(JSON.parse(JSON.stringify(state.baseline)));
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isEditorMode]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isScrolling) {
        setMouseNearLeft(false);
        setMouseNearRight(false);
        return;
      }
      if (!mainLayoutRef.current) return;
      const rect = mainLayoutRef.current.getBoundingClientRect();
      
      setMouseNearLeft(Math.abs(e.clientX - rect.left) < 60);
      setMouseNearRight(Math.abs(e.clientX - rect.right) < 60);
    };

    const handleScroll = () => {
      setIsScrolling(true);
      setMouseNearLeft(false);
      setMouseNearRight(false);
      if (scrollTimeout.current) clearTimeout(scrollTimeout.current);
      scrollTimeout.current = setTimeout(() => {
        setIsScrolling(false);
      }, 500);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isScrolling]);

  useEffect(() => {
    const saved = localStorage.getItem('graphCinemaSavedGraphs');
    if (saved) {
      try {
        setSavedGraphs(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load saved graphs", e);
      }
    }
  }, []);

  const saveToLocalStorage = (graphs: any[]) => {
    localStorage.setItem('graphCinemaSavedGraphs', JSON.stringify(graphs));
    setSavedGraphs(graphs);
  };

  const getCurrentSettings = () => ({
    duration, revealDuration, mode, resolution, bgColor, showGrid, showBloom, lineWidth, pointRadius,
    line1Color, line2Color, particleSize, particleColor1, particleColor2, particleShape,
    particleEmissionRate, targetPoints, baselinePoints, showTarget, showBaseline
  });

  useEffect(() => {
    if (currentGraphId) {
      const graph = savedGraphs.find(g => g.id === currentGraphId);
      if (graph) {
        const current = getCurrentSettings();
        setHasUnsavedChanges(JSON.stringify(current) !== JSON.stringify(graph.settings));
      } else {
        setHasUnsavedChanges(false);
      }
    } else {
      setHasUnsavedChanges(false);
    }
  }, [
    duration, revealDuration, mode, resolution, bgColor, showGrid, showBloom, lineWidth, pointRadius,
    line1Color, line2Color, particleSize, particleColor1, particleColor2, particleShape,
    particleEmissionRate, targetPoints, baselinePoints, showTarget, showBaseline,
    currentGraphId, savedGraphs
  ]);

  const loadSettings = (s: any) => {
    if (s.duration !== undefined) setDuration(s.duration);
    if (s.revealDuration !== undefined) setRevealDuration(s.revealDuration);
    if (s.mode !== undefined) setMode(s.mode === 'separate' ? 'staggered' : s.mode);
    if (s.resolution !== undefined) setResolution(s.resolution);
    if (s.bgColor !== undefined) setBgColor(s.bgColor);
    if (s.showGrid !== undefined) setShowGrid(s.showGrid);
    if (s.showBloom !== undefined) setShowBloom(s.showBloom);
    if (s.lineWidth !== undefined) setLineWidth(s.lineWidth);
    if (s.pointRadius !== undefined) setPointRadius(s.pointRadius);
    if (s.line1Color !== undefined) setLine1Color(s.line1Color);
    if (s.line2Color !== undefined) setLine2Color(s.line2Color);
    if (s.particleSize !== undefined) setParticleSize(s.particleSize);
    if (s.particleColor1 !== undefined) setParticleColor1(s.particleColor1);
    if (s.particleColor2 !== undefined) setParticleColor2(s.particleColor2);
    if (s.particleShape !== undefined) setParticleShape(s.particleShape);
    if (s.particleEmissionRate !== undefined) setParticleEmissionRate(s.particleEmissionRate);
    if (s.targetPoints !== undefined) setTargetPoints(JSON.parse(JSON.stringify(s.targetPoints)));
    if (s.baselinePoints !== undefined) setBaselinePoints(JSON.parse(JSON.stringify(s.baselinePoints)));
    if (s.showTarget !== undefined) setShowTarget(s.showTarget);
    if (s.showBaseline !== undefined) setShowBaseline(s.showBaseline);
  };

  const openPrompt = (title: string, defaultValue: string, onConfirm: (val: string) => void) => {
    setPromptConfig({ isOpen: true, title, value: defaultValue, onConfirm });
  };

  const handleSaveGraph = () => {
    if (currentGraphId) {
      const updated = savedGraphs.map(g => g.id === currentGraphId ? { ...g, settings: getCurrentSettings() } : g);
      saveToLocalStorage(updated);
      setIsSaving(true);
      setTimeout(() => setIsSaving(false), 1500);
    } else {
      handleSaveGraphAs();
    }
  };

  const handleSaveGraphAs = () => {
    openPrompt("Enter a name for this graph:", "My Graph", (name) => {
      if (name) {
        const newGraph = { id: Date.now().toString(), name, settings: getCurrentSettings() };
        saveToLocalStorage([...savedGraphs, newGraph]);
        setCurrentGraphId(newGraph.id);
        setIsSaving(true);
        setTimeout(() => setIsSaving(false), 1500);
      }
    });
  };

  const handleLoadGraph = (id: string) => {
    if (!id) {
      setCurrentGraphId(null);
      return;
    }
    const graph = savedGraphs.find(g => g.id === id);
    if (graph) {
      loadSettings(graph.settings);
      setCurrentGraphId(id);
    }
  };

  const handleDeleteGraph = () => {
    if (!currentGraphId) return;
    if (window.confirm("Are you sure you want to delete this saved graph?")) {
      const updated = savedGraphs.filter(g => g.id !== currentGraphId);
      saveToLocalStorage(updated);
      setCurrentGraphId(null);
    }
  };

  const handleRenameGraph = () => {
    if (!currentGraphId) return;
    const graph = savedGraphs.find(g => g.id === currentGraphId);
    if (!graph) return;
    openPrompt("Enter new name:", graph.name, (newName) => {
      if (newName && newName !== graph.name) {
        const updated = savedGraphs.map(g => g.id === currentGraphId ? { ...g, name: newName } : g);
        saveToLocalStorage(updated);
      }
    });
  };

  const handleDiscardChanges = () => {
    if (currentGraphId) {
      const graph = savedGraphs.find(g => g.id === currentGraphId);
      if (graph) {
        loadSettings(graph.settings);
      }
    }
  };

  const handlePlayPause = () => {
    if (isEditorMode) setIsEditorMode(false);
    if (isPlaying) {
      canvasRef.current?.pause();
      setIsPlaying(false);
    } else {
      canvasRef.current?.play();
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    if (isEditorMode) setIsEditorMode(false);
    canvasRef.current?.restart();
    setIsPlaying(true);
  };

  const handleStop = () => {
    if (isEditorMode) setIsEditorMode(false);
    canvasRef.current?.stop();
    setIsPlaying(false);
  };

  const [exportFormat, setExportFormat] = useState<'webm' | 'mp4'>('webm');

  const handleRecordToggle = () => {
    if (isRecording) {
      canvasRef.current?.stopRecording();
      setIsRecording(false);
    } else {
      if (isEditorMode) setIsEditorMode(false);
      setIsRecording(true);
      canvasRef.current?.startRecording(exportFormat, () => setIsRecording(false));
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setBackgroundImage(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExportSettings = () => {
    const settings = {
      duration, mode, resolution, bgColor, showGrid, showBloom, lineWidth, pointRadius,
      line1Color, line2Color, particleSize, particleColor1, particleColor2,
      particleEmissionRate, targetPoints, baselinePoints
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'graph-cinema-settings.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const s = JSON.parse(event.target?.result as string);
        if (s.duration !== undefined) setDuration(s.duration);
        if (s.mode !== undefined) setMode(s.mode);
        if (s.resolution !== undefined) setResolution(s.resolution);
        if (s.bgColor !== undefined) setBgColor(s.bgColor);
        if (s.showGrid !== undefined) setShowGrid(s.showGrid);
        if (s.showBloom !== undefined) setShowBloom(s.showBloom);
        if (s.lineWidth !== undefined) setLineWidth(s.lineWidth);
        if (s.pointRadius !== undefined) setPointRadius(s.pointRadius);
        if (s.line1Color !== undefined) setLine1Color(s.line1Color);
        if (s.line2Color !== undefined) setLine2Color(s.line2Color);
        if (s.particleSize !== undefined) setParticleSize(s.particleSize);
        if (s.particleColor1 !== undefined) setParticleColor1(s.particleColor1);
        if (s.particleColor2 !== undefined) setParticleColor2(s.particleColor2);
        if (s.particleEmissionRate !== undefined) setParticleEmissionRate(s.particleEmissionRate);
        if (s.targetPoints !== undefined) setTargetPoints(s.targetPoints);
        if (s.baselinePoints !== undefined) setBaselinePoints(s.baselinePoints);
      } catch (err) {
        alert("Invalid settings file");
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRestoreDefaults = () => {
    setDuration(DEFAULT_SETTINGS.duration);
    setMode(DEFAULT_SETTINGS.mode);
    setResolution(DEFAULT_SETTINGS.resolution);
    setBgColor(DEFAULT_SETTINGS.bgColor);
    setShowGrid(DEFAULT_SETTINGS.showGrid);
    setShowBloom(DEFAULT_SETTINGS.showBloom);
    setLineWidth(DEFAULT_SETTINGS.lineWidth);
    setPointRadius(DEFAULT_SETTINGS.pointRadius);
    setLine1Color(DEFAULT_SETTINGS.line1Color);
    setLine2Color(DEFAULT_SETTINGS.line2Color);
    setParticleSize(DEFAULT_SETTINGS.particleSize);
    setParticleColor1(DEFAULT_SETTINGS.particleColor1);
    setParticleColor2(DEFAULT_SETTINGS.particleColor2);
    setParticleEmissionRate(DEFAULT_SETTINGS.particleEmissionRate);
    setTargetPoints(DEFAULT_SETTINGS.targetPoints);
    setBaselinePoints(DEFAULT_SETTINGS.baselinePoints);
    setBackgroundImage(null);
  };

  return (
    <div className="h-screen w-screen bg-zinc-950 text-zinc-100 font-sans flex flex-col overflow-hidden selection:bg-orange-500/30">
      
      {/* Header */}
      <header className="h-16 border-b border-white/10 bg-zinc-950 flex items-center justify-between px-6 shrink-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center border border-orange-500/30">
            <Activity className="w-5 h-5 text-orange-500" />
          </div>
          <span className="text-lg font-bold text-white tracking-wide">Graph Cinema</span>
        </div>

        <div className="flex items-center gap-6 flex-1 justify-center max-w-4xl">
          <div className="flex items-center gap-1 bg-zinc-800/50 p-1 rounded-full border border-white/5">
            <button onClick={handlePlayPause} disabled={isRecording} className="w-8 h-8 flex items-center justify-center bg-white text-black rounded-full hover:bg-zinc-200 transition-colors disabled:opacity-50 shrink-0">
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button onClick={handleStop} disabled={isRecording} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full transition-colors disabled:opacity-50 shrink-0">
              <Square className="w-3.5 h-3.5 fill-current" />
            </button>
            <button onClick={handleRestart} disabled={isRecording} className="w-8 h-8 flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-full transition-colors disabled:opacity-50 shrink-0">
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-6 w-px bg-white/10"></div>

          <div className="flex bg-zinc-800/50 rounded-lg p-1 gap-1 border border-white/5">
            <button onClick={() => setMode('together')} disabled={isRecording} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'together' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}>Together</button>
            <button onClick={() => setMode('staggered')} disabled={isRecording} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${mode === 'staggered' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}>Staggered</button>
          </div>

          <div className="h-6 w-px bg-white/10"></div>

          <div className="flex items-center gap-3 flex-1 max-w-[300px]">
            <span className="text-xs text-zinc-400 font-mono w-10 text-right">{isNaN(currentTime) ? '0.0' : currentTime.toFixed(1)}s</span>
            <input 
              type="range" 
              min="0" 
              max={isNaN(duration) || isNaN(revealDuration) ? 10 : duration + revealDuration} 
              step="0.01" 
              value={isNaN(currentTime) ? 0 : currentTime} 
              onChange={(e) => {
                const t = Number(e.target.value);
                setCurrentTime(t);
                canvasRef.current?.seek(t);
                if (isPlaying) {
                  canvasRef.current?.pause();
                  setIsPlaying(false);
                }
              }} 
              disabled={isRecording} 
              className="flex-1 accent-orange-500 h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer" 
            />
            <span className="text-xs text-zinc-500 font-mono w-10">{isNaN(duration) || isNaN(revealDuration) ? '0.0' : (duration + revealDuration).toFixed(1)}s</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => {
              setIsEditorMode(!isEditorMode);
              if (!isEditorMode && isPlaying) {
                canvasRef.current?.pause();
                setIsPlaying(false);
              }
            }} 
            disabled={isRecording}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors disabled:opacity-50 border ${isEditorMode ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border-white/5'}`}
          >
            <Edit3 className="w-4 h-4" />
            Editor
          </button>
          <div className="h-6 w-px bg-white/10 mx-1"></div>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRecordToggle} 
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors border ${isRecording ? 'bg-red-500/20 text-red-400 border-red-500/30 animate-pulse' : 'bg-zinc-800 hover:bg-zinc-700 text-red-400 border-white/5'}`}
            >
              <div className={`w-2 h-2 rounded-full ${isRecording ? 'bg-red-400' : 'bg-red-500'}`}></div>
              {isRecording ? 'Recording...' : 'Record'}
            </button>
            <select 
              value={exportFormat} 
              onChange={e => setExportFormat(e.target.value as 'webm' | 'mp4')}
              disabled={isRecording}
              className="bg-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-200 border border-white/5 focus:border-orange-500/50 outline-none disabled:opacity-50"
            >
              <option value="webm">WebM</option>
              <option value="mp4">MP4</option>
            </select>
          </div>
        </div>
      </header>

      {/* Main Layout */}
      <div ref={mainLayoutRef} className="flex-1 flex overflow-hidden relative group/layout">
        
        {/* Left Sidebar Toggle */}
        <button 
          onClick={() => setShowLeftSidebar(!showLeftSidebar)}
          className={`absolute left-0 top-1/2 -translate-y-1/2 z-20 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white p-1.5 rounded-r-md border border-l-0 border-white/10 shadow-lg transition-all duration-300 ${(!showLeftSidebar || (mouseNearLeft && !isScrolling)) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          {showLeftSidebar ? <PanelLeftClose className="w-4 h-4" /> : <PanelLeftOpen className="w-4 h-4" />}
        </button>

        {/* Left Sidebar - Settings */}
        <aside className={`w-80 shrink-0 border-r border-white/10 bg-zinc-900/30 overflow-y-auto p-5 space-y-8 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent transition-all duration-300 ${showLeftSidebar ? 'ml-0' : '-ml-80'}`}>
          
          {/* Animation Settings */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white flex items-center gap-2"><Clock className="w-4 h-4"/> Animation</h3>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400"><span>Duration</span><span>{duration}s</span></div>
              <input type="range" min="2" max="30" step="1" value={duration} onChange={(e) => setDuration(Number(e.target.value))} disabled={isRecording} className="w-full accent-orange-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400"><span>Reveal Duration</span><span>{revealDuration}s</span></div>
              <input type="range" min="0" max="10" step="0.5" value={revealDuration} onChange={(e) => setRevealDuration(Number(e.target.value))} disabled={isRecording} className="w-full accent-orange-500" />
            </div>
          </div>

          <div className="h-px bg-white/5"></div>
          
          {/* Resolution */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-white flex items-center gap-2"><Monitor className="w-4 h-4"/> Target Resolution</h3>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Width</span>
                <input type="number" value={isNaN(resolution.w) ? '' : resolution.w} onChange={e => setResolution({...resolution, w: parseFloat(e.target.value)})} className="w-full bg-zinc-900 rounded px-2 py-1.5 text-sm text-zinc-200 border border-white/5 focus:border-orange-500/50 outline-none" />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">Height</span>
                <input type="number" value={isNaN(resolution.h) ? '' : resolution.h} onChange={e => setResolution({...resolution, h: parseFloat(e.target.value)})} className="w-full bg-zinc-900 rounded px-2 py-1.5 text-sm text-zinc-200 border border-white/5 focus:border-orange-500/50 outline-none" />
              </div>
            </div>
            <div className="grid grid-cols-4 gap-1 pt-1">
              <button onClick={() => setResolution({w: 1920, h: 1080})} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 py-1 rounded text-zinc-300">1080p</button>
              <button onClick={() => setResolution({w: 1280, h: 720})} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 py-1 rounded text-zinc-300">720p</button>
              <button onClick={() => setResolution({w: 1080, h: 1080})} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 py-1 rounded text-zinc-300">Square</button>
              <button onClick={() => setResolution({w: 1080, h: 1920})} className="text-[10px] bg-zinc-800 hover:bg-zinc-700 py-1 rounded text-zinc-300">Portrait</button>
            </div>
          </div>

          <div className="h-px bg-white/5"></div>

          {/* Background */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Background</h3>
            
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Color</span>
              <div className="relative w-8 h-8 rounded-md overflow-hidden border border-white/20">
                <input type="color" value={bgColor} onChange={e => setBgColor(e.target.value)} className="absolute -inset-2 w-12 h-12 cursor-pointer" />
              </div>
            </div>

            <label className="flex items-center justify-between text-sm text-zinc-400 cursor-pointer">
              <span>Show Grid</span>
              <input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} className="rounded bg-zinc-800 border-zinc-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-zinc-900" />
            </label>

            <label className="flex items-center justify-between text-sm text-zinc-400 cursor-pointer">
              <span>Center Bloom</span>
              <input type="checkbox" checked={showBloom} onChange={e => setShowBloom(e.target.checked)} className="rounded bg-zinc-800 border-zinc-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-zinc-900" />
            </label>
            
            <div className="space-y-2 pt-2">
              <span className="text-sm text-zinc-400 block">Custom Image</span>
              <div className="flex items-center gap-2">
                <input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs text-zinc-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-medium file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700 w-full" />
                {backgroundImage && (
                  <button onClick={() => setBackgroundImage(null)} className="p-1.5 text-red-400 hover:bg-red-400/10 rounded-md transition-colors shrink-0" title="Remove Image">
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-white/5"></div>

          {/* Lines */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">Lines</h3>
            
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded overflow-hidden border border-white/20">
                  <input type="color" value={line2Color} onChange={e => {setLine2Color(e.target.value); setParticleColor2(e.target.value);}} className="absolute -inset-2 w-10 h-10 cursor-pointer" />
                </div>
                <span className="text-xs text-zinc-400">Baseline</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded overflow-hidden border border-white/20">
                  <input type="color" value={line1Color} onChange={e => {setLine1Color(e.target.value); setParticleColor1(e.target.value);}} className="absolute -inset-2 w-10 h-10 cursor-pointer" />
                </div>
                <span className="text-xs text-zinc-400">Target</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400"><span>Width</span><span>{lineWidth}px</span></div>
              <input type="range" min="1" max="10" step="1" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} className="w-full accent-orange-500" />
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400"><span>Head Radius</span><span>{pointRadius}px</span></div>
              <input type="range" min="0" max="20" step="1" value={pointRadius} onChange={e => setPointRadius(Number(e.target.value))} className="w-full accent-orange-500" />
            </div>
          </div>

          <div className="h-px bg-white/5"></div>

          {/* Particles */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-white flex items-center gap-2">Particles</h3>
            <div className="space-y-2">
              <span className="text-xs text-zinc-400 block">Shape</span>
              <select 
                value={particleShape} 
                onChange={e => setParticleShape(e.target.value as any)}
                className="w-full bg-zinc-900 rounded px-2 py-1.5 text-xs text-zinc-200 border border-white/5 focus:border-orange-500/50 outline-none"
              >
                <option value="circle">Circle</option>
                <option value="triangle">Triangle</option>
                <option value="star">Star</option>
                <option value="diamond">Diamond</option>
                <option value="hex">Hexagon</option>
              </select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded overflow-hidden border border-white/20">
                  <input type="color" value={particleColor2} onChange={e => setParticleColor2(e.target.value)} className="absolute -inset-2 w-10 h-10 cursor-pointer" />
                </div>
                <span className="text-xs text-zinc-400">Baseline</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative w-6 h-6 rounded overflow-hidden border border-white/20">
                  <input type="color" value={particleColor1} onChange={e => setParticleColor1(e.target.value)} className="absolute -inset-2 w-10 h-10 cursor-pointer" />
                </div>
                <span className="text-xs text-zinc-400">Target</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400"><span>Size</span><span>{particleSize}px</span></div>
              <input type="range" min="0.5" max="10" step="0.5" value={particleSize} onChange={e => setParticleSize(Number(e.target.value))} className="w-full accent-orange-500" />
            </div>
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-zinc-400"><span>Emission Rate</span><span>{Math.round(particleEmissionRate * 100)}%</span></div>
              <input type="range" min="0" max="1" step="0.05" value={particleEmissionRate} onChange={e => setParticleEmissionRate(Number(e.target.value))} className="w-full accent-orange-500" />
            </div>
          </div>

          <div className="h-px bg-white/5"></div>

          {/* Manage Settings */}
          <div className="space-y-3 pb-4">
            <h3 className="text-sm font-medium text-white flex items-center gap-2"><Save className="w-4 h-4"/> Saved Graphs</h3>
            
            <div className="space-y-2">
              <select 
                value={currentGraphId || ''} 
                onChange={(e) => handleLoadGraph(e.target.value)}
                className="w-full bg-zinc-900 rounded px-2 py-2 text-xs text-zinc-200 border border-white/5 focus:border-orange-500/50 outline-none"
              >
                <option value="">-- Select Saved Graph --</option>
                {savedGraphs.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              
              <div className="grid grid-cols-2 gap-2">
                <button onClick={handleSaveGraph} className={`flex items-center justify-center gap-1.5 w-full px-2 py-1.5 text-xs rounded transition-all border ${isSaving ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border-orange-500/30'}`}>
                  <Save className="w-3.5 h-3.5" /> {isSaving ? 'Saved!' : 'Save'}
                </button>
                <button onClick={handleSaveGraphAs} className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition-colors border border-white/5">
                  Save As
                </button>
              </div>
              
              {hasUnsavedChanges && (
                <button onClick={handleDiscardChanges} className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition-colors border border-white/5 mt-2">
                  <RotateCcw className="w-3.5 h-3.5" /> Discard Changes
                </button>
              )}
              
              {currentGraphId && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button onClick={handleRenameGraph} className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs rounded transition-colors border border-white/5">
                    <Edit3 className="w-3.5 h-3.5" /> Rename
                  </button>
                  <button onClick={handleDeleteGraph} className="flex items-center justify-center gap-1.5 w-full px-2 py-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-xs rounded transition-colors border border-red-500/20">
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </button>
                </div>
              )}
            </div>

            <div className="h-px bg-white/5 my-4"></div>

            <h3 className="text-sm font-medium text-white flex items-center gap-2">Import / Export</h3>
            <div className="flex flex-col gap-2">
              <button onClick={handleExportSettings} className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded-md transition-colors border border-white/5">
                <Download className="w-3.5 h-3.5" /> Export JSON
              </button>
              <label className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-200 rounded-md transition-colors border border-white/5 cursor-pointer">
                <Upload className="w-3.5 h-3.5" /> Import JSON
                <input type="file" accept=".json" onChange={handleImportSettings} ref={fileInputRef} className="hidden" />
              </label>
              <button onClick={handleRestoreDefaults} className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-xs text-red-400 rounded-md transition-colors border border-red-500/20 mt-2">
                <RefreshCw className="w-3.5 h-3.5" /> Restore Defaults
              </button>
            </div>
          </div>

        </aside>

        {/* Center Canvas Area */}
        <main className="flex-1 relative overflow-hidden bg-black/50 flex items-center justify-center p-8">
          <div 
            className="relative shadow-2xl shadow-black/50 rounded-lg overflow-hidden border border-white/5 bg-zinc-900/50" 
            style={{ 
              aspectRatio: `${resolution.w}/${resolution.h}`, 
              maxHeight: '100%', 
              maxWidth: '100%' 
            }}
          >
            <AnimationCanvas
              ref={canvasRef}
              duration={duration}
              revealDuration={revealDuration}
              mode={mode}
              backgroundColor={bgColor}
              showGrid={showGrid}
              showBloom={showBloom}
              backgroundImage={backgroundImage}
              lineWidth={lineWidth}
              pointRadius={pointRadius}
              line1Color={line1Color}
              line2Color={line2Color}
              particleSize={particleSize}
              particleColor1={particleColor1}
              particleColor2={particleColor2}
              particleShape={particleShape}
              particleEmissionRate={particleEmissionRate}
              targetPoints={targetPoints}
              baselinePoints={baselinePoints}
              showTarget={showTarget}
              showBaseline={showBaseline}
              targetResolution={resolution}
              isEditorMode={isEditorMode}
              onTargetPointsChange={setTargetPoints}
              onBaselinePointsChange={setBaselinePoints}
              onTimeUpdate={setCurrentTime}
              onPlayStateChange={setIsPlaying}
            />

            {/* Recording Overlay */}
            {isRecording && (
              <div className="absolute top-4 right-4 flex items-center gap-2 bg-red-500/20 text-red-400 px-3 py-1.5 rounded-full border border-red-500/30 backdrop-blur-md animate-pulse">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span className="text-sm font-medium">Recording...</span>
              </div>
            )}
          </div>
        </main>

        {/* Right Sidebar Toggle */}
        <button 
          onClick={() => setShowRightSidebar(!showRightSidebar)}
          className={`absolute right-0 top-1/2 -translate-y-1/2 z-20 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white p-1.5 rounded-l-md border border-r-0 border-white/10 shadow-lg transition-all duration-300 ${(!showRightSidebar || (mouseNearRight && !isScrolling)) ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        >
          {showRightSidebar ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
        </button>

        {/* Right Sidebar - Data Points */}
        <aside className={`w-[420px] shrink-0 border-l border-white/10 bg-zinc-900/30 overflow-hidden flex flex-col transition-all duration-300 ${showRightSidebar ? 'mr-0' : '-mr-[420px]'}`}>
          <div className="p-4 border-b border-white/5 shrink-0">
            <h3 className="text-sm font-medium text-white">Data Points</h3>
            <p className="text-xs text-zinc-500 mt-1">Values from 0.0 to 1.0</p>
          </div>
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 border-r border-white/5 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              <DataPointEditor title="Baseline" points={baselinePoints} onChange={setBaselinePoints} color={line2Color} visible={showBaseline} onToggleVisibility={() => setShowBaseline(!showBaseline)} />
            </div>
            <div className="flex-1 p-4 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
              <DataPointEditor title="Target" points={targetPoints} onChange={setTargetPoints} color={line1Color} visible={showTarget} onToggleVisibility={() => setShowTarget(!showTarget)} />
            </div>
          </div>
        </aside>

      </div>

      {/* Prompt Modal */}
      {promptConfig?.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-white/10 rounded-lg p-6 w-80 shadow-2xl">
            <h3 className="text-lg font-medium text-white mb-4">{promptConfig.title}</h3>
            <input 
              type="text" 
              value={promptConfig.value}
              onChange={e => setPromptConfig({...promptConfig, value: e.target.value})}
              className="w-full bg-zinc-800 rounded px-3 py-2 text-sm text-zinc-200 border border-white/10 focus:border-orange-500/50 outline-none mb-6"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  promptConfig.onConfirm(promptConfig.value);
                  setPromptConfig(null);
                } else if (e.key === 'Escape') {
                  setPromptConfig(null);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setPromptConfig(null)}
                className="px-4 py-2 rounded text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  promptConfig.onConfirm(promptConfig.value);
                  setPromptConfig(null);
                }}
                className="px-4 py-2 rounded text-sm font-medium bg-orange-500 text-white hover:bg-orange-600 transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ExportButton({ icon, label, onClick, disabled }: { icon: React.ReactNode, label: string, onClick: () => void, disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-md text-xs font-medium transition-colors disabled:opacity-50 border border-white/5"
    >
      {icon}
      {label}
    </button>
  );
}

function DataPointEditor({ title, points, onChange, color, visible, onToggleVisibility }: { title: string, points: {x: number, y: number}[], onChange: (pts: {x: number, y: number}[]) => void, color: string, visible: boolean, onToggleVisibility: () => void }) {
  return (
    <div className={`space-y-3 flex flex-col h-full ${!visible ? 'opacity-50' : ''}`}>
      <div className="flex justify-between items-center text-sm">
        <div className="flex items-center gap-2">
          <button onClick={onToggleVisibility} className="text-zinc-400 hover:text-white transition-colors" title={visible ? "Hide" : "Show"}>
            {visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }}></div>
          <span className="font-medium text-white">{title}</span>
        </div>
        <button 
          onClick={() => {
            const last = points[points.length - 1] || {x: 0, y: 0};
            onChange([...points, {x: Math.min(1, last.x + 0.1), y: last.y}]);
          }} 
          className="text-xs hover:text-white transition-colors"
          style={{ color }}
          disabled={!visible}
        >
          + Add
        </button>
      </div>
      <div className="space-y-1.5">
        {points.map((p, i) => (
          <div key={i} className="flex gap-1.5 items-center bg-zinc-800/50 p-1.5 rounded border border-white/5">
            <div className="flex flex-col flex-1 gap-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-zinc-500 font-mono w-2">X</span>
                <input 
                  type="number" 
                  step="0.01" 
                  value={isNaN(p.x) ? '' : p.x} 
                  onChange={e => { const n = [...points]; n[i] = { ...n[i], x: parseFloat(e.target.value) }; onChange(n); }} 
                  className="w-full bg-zinc-900 rounded px-1.5 py-0.5 text-xs text-zinc-200 border border-transparent focus:border-white/20 outline-none font-mono disabled:opacity-50" 
                  disabled={!visible}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] text-zinc-500 font-mono w-2">Y</span>
                <input 
                  type="number" 
                  step="0.01" 
                  value={isNaN(p.y) ? '' : p.y} 
                  onChange={e => { const n = [...points]; n[i] = { ...n[i], y: parseFloat(e.target.value) }; onChange(n); }} 
                  className="w-full bg-zinc-900 rounded px-1.5 py-0.5 text-xs text-zinc-200 border border-transparent focus:border-white/20 outline-none font-mono disabled:opacity-50" 
                  disabled={!visible}
                />
              </div>
            </div>
            <button 
              onClick={() => { const n = [...points]; n.splice(i, 1); onChange(n); }} 
              className="p-1.5 text-zinc-600 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors disabled:opacity-50 disabled:hover:bg-transparent disabled:hover:text-zinc-600"
              title="Remove Point"
              disabled={!visible}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
