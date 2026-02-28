import React, { useRef, useState } from 'react';
import { Play, Pause, RotateCcw, Download, Video, Film, Grid, Settings2, Image as ImageIcon, Trash2, Upload, RefreshCw, Save } from 'lucide-react';
import AnimationCanvas, { AnimationCanvasRef } from './components/AnimationCanvas';

const DEFAULT_SETTINGS = {
  duration: 10,
  mode: 'together' as const,
  bgColor: '#05050a',
  showGrid: true,
  showBloom: true,
  lineWidth: 2,
  pointRadius: 4,
  line1Color: '#ff5e00',
  line2Color: '#00d2ff',
  particleSize: 2,
  particleColor1: '#ff5e00',
  particleColor2: '#00d2ff',
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
  const [showSettings, setShowSettings] = useState(false);
  
  // Settings State
  const [duration, setDuration] = useState(DEFAULT_SETTINGS.duration);
  const [mode, setMode] = useState<'together' | 'separate' | 'target-only' | 'baseline-only'>(DEFAULT_SETTINGS.mode);
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
  const [particleEmissionRate, setParticleEmissionRate] = useState(DEFAULT_SETTINGS.particleEmissionRate);
  const [targetPoints, setTargetPoints] = useState(DEFAULT_SETTINGS.targetPoints);
  const [baselinePoints, setBaselinePoints] = useState(DEFAULT_SETTINGS.baselinePoints);

  const handlePlayPause = () => {
    if (isPlaying) {
      canvasRef.current?.pause();
      setIsPlaying(false);
    } else {
      canvasRef.current?.play();
      setIsPlaying(true);
    }
  };

  const handleRestart = () => {
    canvasRef.current?.restart();
    setIsPlaying(true);
  };

  const handleExport = (format: 'webm' | 'mp4' | 'webm-transparent') => {
    setIsRecording(true);
    canvasRef.current?.exportVideo(format, () => {
      setIsRecording(false);
      setIsPlaying(false);
    });
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
      duration, mode, bgColor, showGrid, showBloom, lineWidth, pointRadius,
      line1Color, line2Color, particleSize, particleColor1, particleColor2,
      particleEmissionRate, targetPoints, baselinePoints
    };
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'animator-settings.json';
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
    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRestoreDefaults = () => {
    setDuration(DEFAULT_SETTINGS.duration);
    setMode(DEFAULT_SETTINGS.mode);
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
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-orange-500/30 flex flex-col items-center justify-center p-8">
      <div className="w-full max-w-6xl flex flex-col gap-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-white">Cinematic Graph Animator</h1>
            <p className="text-zinc-400 mt-1">Game-ready visualizer with neon bloom and particle effects.</p>
          </div>
        </div>

        {/* Main Content */}
        <div className="relative aspect-video w-full bg-zinc-900/50 rounded-2xl border border-white/5 overflow-hidden shadow-2xl shadow-black/50">
          <AnimationCanvas
            ref={canvasRef}
            duration={duration}
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
            particleEmissionRate={particleEmissionRate}
            targetPoints={targetPoints}
            baselinePoints={baselinePoints}
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

        {/* Controls */}
        <div className="flex flex-wrap items-center justify-between gap-6 bg-zinc-900/80 p-6 rounded-2xl border border-white/5 backdrop-blur-xl">
          <div className="flex items-center gap-4">
            <button
              onClick={handlePlayPause}
              disabled={isRecording}
              className="w-12 h-12 flex items-center justify-center bg-white text-black rounded-full hover:bg-zinc-200 transition-colors disabled:opacity-50 shrink-0"
            >
              {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
            </button>
            <button
              onClick={handleRestart}
              disabled={isRecording}
              className="w-12 h-12 flex items-center justify-center bg-zinc-800 text-white rounded-full hover:bg-zinc-700 transition-colors disabled:opacity-50 shrink-0"
            >
              <RotateCcw className="w-5 h-5" />
            </button>

            <div className="h-8 w-px bg-white/10 mx-2"></div>

            <div className="flex flex-wrap bg-zinc-800 rounded-lg p-1 gap-1">
              <button
                onClick={() => setMode('together')}
                disabled={isRecording}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'together' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Together
              </button>
              <button
                onClick={() => setMode('separate')}
                disabled={isRecording}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'separate' ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                Separate
              </button>
              <button
                onClick={() => setMode('target-only')}
                disabled={isRecording}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'target-only' ? 'bg-zinc-700 text-orange-400 shadow-sm' : 'text-zinc-400 hover:text-orange-400/70'}`}
              >
                Target Only
              </button>
              <button
                onClick={() => setMode('baseline-only')}
                disabled={isRecording}
                className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${mode === 'baseline-only' ? 'bg-zinc-700 text-cyan-400 shadow-sm' : 'text-zinc-400 hover:text-cyan-400/70'}`}
              >
                Baseline Only
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 flex-1 min-w-[200px] max-w-xs">
            <span className="text-sm text-zinc-400 w-12 shrink-0">{duration}s</span>
            <input
              type="range"
              min="2"
              max="30"
              step="1"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              disabled={isRecording}
              className="flex-1 accent-orange-500"
            />
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="flex items-center gap-2 bg-zinc-800 p-1 rounded-lg border border-white/5 mr-2">
              <div className="relative flex items-center justify-center w-8 h-8 rounded-md hover:bg-zinc-700 transition-colors" title="Background Color">
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  disabled={isRecording}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-4 h-4 rounded-full border border-white/20 shadow-inner" style={{ backgroundColor: bgColor }}></div>
              </div>
              <div className="w-px h-4 bg-white/10"></div>
              <button
                onClick={() => setShowGrid(!showGrid)}
                disabled={isRecording}
                className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${showGrid ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}
                title="Toggle Grid"
              >
                <Grid className="w-4 h-4" />
              </button>
              <div className="w-px h-4 bg-white/10"></div>
              <button
                onClick={() => setShowSettings(!showSettings)}
                disabled={isRecording}
                className={`w-8 h-8 flex items-center justify-center rounded-md transition-colors ${showSettings ? 'bg-zinc-600 text-white' : 'text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'}`}
                title="Advanced Settings"
              >
                <Settings2 className="w-4 h-4" />
              </button>
            </div>

            <ExportButton icon={<Video className="w-4 h-4" />} label="WebM" onClick={() => handleExport('webm')} disabled={isRecording} />
            <ExportButton icon={<Film className="w-4 h-4" />} label="MP4" onClick={() => handleExport('mp4')} disabled={isRecording} />
            <ExportButton icon={<Download className="w-4 h-4" />} label="Transparent" onClick={() => handleExport('webm-transparent')} disabled={isRecording} />
          </div>
        </div>

        {/* Advanced Settings Panel */}
        {showSettings && (
          <div className="bg-zinc-900/80 p-6 rounded-2xl border border-white/5 backdrop-blur-xl grid grid-cols-1 md:grid-cols-4 gap-8 animate-in fade-in slide-in-from-top-4">
            {/* Column 1: Background & Particles */}
            <div className="space-y-6">
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white flex items-center gap-2"><ImageIcon className="w-4 h-4"/> Background</h3>
                
                <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={showBloom} 
                    onChange={e => setShowBloom(e.target.checked)} 
                    className="rounded bg-zinc-800 border-zinc-700 text-orange-500 focus:ring-orange-500 focus:ring-offset-zinc-900" 
                  />
                  Show Center Bloom
                </label>
                
                <div className="space-y-2">
                  <span className="text-sm text-zinc-400 block">Custom Image</span>
                  <div className="flex items-center gap-2">
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={handleImageUpload} 
                      className="text-sm text-zinc-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-zinc-800 file:text-zinc-300 hover:file:bg-zinc-700 w-full" 
                    />
                    {backgroundImage && (
                      <button 
                        onClick={() => setBackgroundImage(null)} 
                        className="p-2 text-red-400 hover:bg-red-400/10 rounded-full transition-colors shrink-0" 
                        title="Remove Image"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">Particles</h3>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-zinc-400"><span>Size</span><span>{particleSize}px</span></div>
                  <input type="range" min="0.5" max="10" step="0.5" value={particleSize} onChange={e => setParticleSize(Number(e.target.value))} className="w-full accent-orange-500" />
                </div>
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm text-zinc-400"><span>Emission Rate</span><span>{Math.round(particleEmissionRate * 100)}%</span></div>
                  <input type="range" min="0" max="1" step="0.05" value={particleEmissionRate} onChange={e => setParticleEmissionRate(Number(e.target.value))} className="w-full accent-orange-500" />
                </div>
              </div>
            </div>

            {/* Column 2: Line Settings */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-white flex items-center gap-2">Lines</h3>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-zinc-400"><span>Width</span><span>{lineWidth}px</span></div>
                <input type="range" min="1" max="10" step="1" value={lineWidth} onChange={e => setLineWidth(Number(e.target.value))} className="w-full accent-orange-500" />
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between text-sm text-zinc-400"><span>Head Radius</span><span>{pointRadius}px</span></div>
                <input type="range" min="0" max="20" step="1" value={pointRadius} onChange={e => setPointRadius(Number(e.target.value))} className="w-full accent-orange-500" />
              </div>
              
              <div className="flex items-center justify-between gap-4 pt-2">
                <div className="flex items-center gap-2">
                  <div className="relative w-8 h-8 rounded-md overflow-hidden border border-white/20">
                    <input type="color" value={line1Color} onChange={e => {setLine1Color(e.target.value); setParticleColor1(e.target.value);}} className="absolute -inset-2 w-12 h-12 cursor-pointer" />
                  </div>
                  <span className="text-sm text-zinc-400">Target</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative w-8 h-8 rounded-md overflow-hidden border border-white/20">
                    <input type="color" value={line2Color} onChange={e => {setLine2Color(e.target.value); setParticleColor2(e.target.value);}} className="absolute -inset-2 w-12 h-12 cursor-pointer" />
                  </div>
                  <span className="text-sm text-zinc-400">Baseline</span>
                </div>
              </div>

              <div className="pt-6 space-y-3">
                <h3 className="text-sm font-medium text-white flex items-center gap-2">Manage Settings</h3>
                <div className="flex flex-col gap-2">
                  <button onClick={handleExportSettings} className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200 rounded-md transition-colors border border-white/5">
                    <Download className="w-4 h-4" /> Export JSON
                  </button>
                  <label className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-zinc-800 hover:bg-zinc-700 text-sm text-zinc-200 rounded-md transition-colors border border-white/5 cursor-pointer">
                    <Upload className="w-4 h-4" /> Import JSON
                    <input type="file" accept=".json" onChange={handleImportSettings} ref={fileInputRef} className="hidden" />
                  </label>
                  <button onClick={handleRestoreDefaults} className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 text-sm text-red-400 rounded-md transition-colors border border-red-500/20 mt-2">
                    <RefreshCw className="w-4 h-4" /> Restore Defaults
                  </button>
                </div>
              </div>
            </div>

            {/* Column 3: Target Points */}
            <div className="space-y-4">
              <DataPointEditor title="Target Points (Orange)" points={targetPoints} onChange={setTargetPoints} />
            </div>

            {/* Column 4: Baseline Points */}
            <div className="space-y-4">
              <DataPointEditor title="Baseline Points (Blue)" points={baselinePoints} onChange={setBaselinePoints} />
            </div>

          </div>
        )}
      </div>
    </div>
  );
}

function ExportButton({ icon, label, onClick, disabled }: { icon: React.ReactNode, label: string, onClick: () => void, disabled: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 border border-white/5"
    >
      {icon}
      {label}
    </button>
  );
}

function DataPointEditor({ title, points, onChange }: { title: string, points: {x: number, y: number}[], onChange: (pts: {x: number, y: number}[]) => void }) {
  return (
    <div className="space-y-2 flex flex-col h-full">
      <div className="flex justify-between items-center text-sm text-zinc-400">
        <span className="font-medium text-white">{title}</span>
        <button 
          onClick={() => {
            const last = points[points.length - 1] || {x: 0, y: 0};
            onChange([...points, {x: Math.min(1, last.x + 0.1), y: last.y}]);
          }} 
          className="text-orange-500 hover:text-orange-400 transition-colors"
        >
          + Add
        </button>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 space-y-1 max-h-[320px] scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
        {points.map((p, i) => (
          <div key={i} className="flex gap-2 items-center bg-zinc-800/50 p-1 rounded border border-white/5">
            <div className="flex flex-col flex-1">
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-zinc-500 w-3">X</span>
                <input 
                  type="number" 
                  step="0.01" 
                  value={p.x} 
                  onChange={e => { const n = [...points]; n[i].x = Number(e.target.value); onChange(n); }} 
                  className="w-full bg-zinc-900 rounded px-2 py-1 text-xs text-zinc-200 border border-transparent focus:border-orange-500/50 outline-none" 
                />
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] text-zinc-500 w-3">Y</span>
                <input 
                  type="number" 
                  step="0.01" 
                  value={p.y} 
                  onChange={e => { const n = [...points]; n[i].y = Number(e.target.value); onChange(n); }} 
                  className="w-full bg-zinc-900 rounded px-2 py-1 text-xs text-zinc-200 border border-transparent focus:border-orange-500/50 outline-none" 
                />
              </div>
            </div>
            <button 
              onClick={() => { const n = [...points]; n.splice(i, 1); onChange(n); }} 
              className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
              title="Remove Point"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
