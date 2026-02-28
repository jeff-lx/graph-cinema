import React, { useState, useRef, useEffect } from 'react';
import { ColorValue, ColorStop } from '../types';
import { Trash2, Plus } from 'lucide-react';

interface ColorPickerProps {
  value: ColorValue;
  onChange: (value: ColorValue) => void;
  label?: string;
  align?: 'left' | 'right';
}

export default function ColorPicker({ value, onChange, label, align = 'left' }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const isGradient = value.type === 'gradient';

  const handleTypeChange = (type: 'solid' | 'gradient') => {
    if (type === 'solid' && isGradient) {
      onChange({ type: 'solid', color: value.stops[0]?.color || '#ffffff' });
    } else if (type === 'gradient' && !isGradient) {
      onChange({
        type: 'gradient',
        stops: [
          { color: value.color, offset: 0 },
          { color: '#ffffff', offset: 1 }
        ]
      });
    }
  };

  const handleSolidColorChange = (color: string) => {
    onChange({ type: 'solid', color });
  };

  const handleGradientStopChange = (index: number, stop: ColorStop) => {
    if (value.type !== 'gradient') return;
    const newStops = [...value.stops];
    newStops[index] = stop;
    onChange({ type: 'gradient', stops: newStops });
  };

  const addGradientStop = () => {
    if (value.type !== 'gradient') return;
    const newStops = [...value.stops, { color: '#ffffff', offset: 0.5 }];
    newStops.sort((a, b) => a.offset - b.offset);
    onChange({ type: 'gradient', stops: newStops });
  };

  const removeGradientStop = (index: number) => {
    if (value.type !== 'gradient' || value.stops.length <= 2) return;
    const newStops = value.stops.filter((_, i) => i !== index);
    onChange({ type: 'gradient', stops: newStops });
  };

  const getPreviewStyle = () => {
    if (value.type === 'solid') {
      return { backgroundColor: value.color };
    } else {
      const stops = [...value.stops].sort((a, b) => a.offset - b.offset);
      const gradientString = stops.map(s => `${s.color} ${s.offset * 100}%`).join(', ');
      return { background: `linear-gradient(to right, ${gradientString})` };
    }
  };

  return (
    <div className="relative" ref={containerRef}>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative w-6 h-6 rounded overflow-hidden border border-white/20 shrink-0"
          style={getPreviewStyle()}
        />
        {label && <span className="text-xs text-zinc-400">{label}</span>}
      </div>

      {isOpen && (
        <div className={`absolute top-full mt-2 ${align === 'right' ? 'right-0' : 'left-0'} z-50 w-64 bg-zinc-900 border border-white/10 rounded-lg p-3 shadow-2xl`}>
          <div className="flex bg-zinc-800/50 rounded-lg p-1 gap-1 border border-white/5 mb-3">
            <button
              onClick={() => handleTypeChange('solid')}
              className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${!isGradient ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Solid
            </button>
            <button
              onClick={() => handleTypeChange('gradient')}
              className={`flex-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${isGradient ? 'bg-zinc-700 text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
            >
              Gradient
            </button>
          </div>

          {!isGradient ? (
            <div className="space-y-2">
              <input
                type="color"
                value={value.color}
                onChange={e => handleSolidColorChange(e.target.value)}
                className="w-full h-8 cursor-pointer rounded bg-transparent"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="h-4 rounded border border-white/10 w-full" style={getPreviewStyle()}></div>
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent">
                {value.stops.map((stop, i) => (
                  <div key={i} className="flex items-center gap-2 bg-zinc-800/50 p-1.5 rounded border border-white/5">
                    <input
                      type="color"
                      value={stop.color}
                      onChange={e => handleGradientStopChange(i, { ...stop, color: e.target.value })}
                      className="w-6 h-6 cursor-pointer rounded bg-transparent shrink-0"
                    />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={stop.offset}
                      onChange={e => handleGradientStopChange(i, { ...stop, offset: parseFloat(e.target.value) })}
                      className="flex-1 accent-orange-500"
                    />
                    <button
                      onClick={() => removeGradientStop(i)}
                      disabled={value.stops.length <= 2}
                      className="p-1 text-zinc-500 hover:text-red-400 disabled:opacity-30 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={addGradientStop}
                className="w-full flex items-center justify-center gap-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-xs text-zinc-300 rounded border border-white/5 transition-colors"
              >
                <Plus className="w-3 h-3" /> Add Stop
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
