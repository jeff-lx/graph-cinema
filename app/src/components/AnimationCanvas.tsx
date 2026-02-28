import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface AnimationCanvasRef {
  play: () => void;
  pause: () => void;
  stop: () => void;
  restart: () => void;
  seek: (time: number) => void;
  startRecording: (format: 'webm' | 'mp4', onComplete: () => void) => void;
  stopRecording: () => void;
}

interface Props {
  duration: number;
  revealDuration: number;
  mode: 'together' | 'staggered';
  backgroundColor: string;
  showGrid: boolean;
  showBloom: boolean;
  backgroundImage: string | null;
  lineWidth: number;
  pointRadius: number;
  line1Color: string;
  line2Color: string;
  particleSize: number;
  particleColor1: string;
  particleColor2: string;
  particleShape: 'circle' | 'triangle' | 'star' | 'diamond' | 'hex';
  particleEmissionRate: number;
  targetPoints: {x: number, y: number}[];
  baselinePoints: {x: number, y: number}[];
  showTarget: boolean;
  showBaseline: boolean;
  targetResolution: { w: number, h: number };
  isEditorMode?: boolean;
  onTargetPointsChange?: (pts: {x: number, y: number}[]) => void;
  onBaselinePointsChange?: (pts: {x: number, y: number}[]) => void;
  onTimeUpdate?: (time: number) => void;
  onPlayStateChange: (isPlaying: boolean) => void;
}

// Spline interpolation
function getSplinePoints(pts: {x:number, y:number}[], tension = 0.5, numOfSegments = 20) {
    if (!pts || pts.length < 2) return pts;
    let res = [], x, y, t1x, t2x, t1y, t2y, c1, c2, c3, c4, st, t, i;
    const clone = [...pts];
    // Duplicate first and last for bounds
    clone.unshift(pts[0]);
    clone.push(pts[pts.length - 1]);
    for (i = 1; i < clone.length - 2; i++) {
        for (t = 0; t <= numOfSegments; t++) {
            st = t / numOfSegments;
            c1 = 2 * Math.pow(st, 3) - 3 * Math.pow(st, 2) + 1;
            c2 = -(2 * Math.pow(st, 3)) + 3 * Math.pow(st, 2);
            c3 = Math.pow(st, 3) - 2 * Math.pow(st, 2) + st;
            c4 = Math.pow(st, 3) - Math.pow(st, 2);
            t1x = (clone[i + 1].x - clone[i - 1].x) * tension;
            t2x = (clone[i + 2].x - clone[i].x) * tension;
            t1y = (clone[i + 1].y - clone[i - 1].y) * tension;
            t2y = (clone[i + 2].y - clone[i].y) * tension;
            x = c1 * clone[i].x + c2 * clone[i + 1].x + c3 * t1x + c4 * t2x;
            y = c1 * clone[i].y + c2 * clone[i + 1].y + c3 * t1y + c4 * t2y;
            res.push({ x, y });
        }
    }
    return res;
}

function getLengths(pts: {x:number, y:number}[]) {
    let lengths = [0];
    let total = 0;
    if (!pts || pts.length === 0) return { lengths, total };
    for (let i = 1; i < pts.length; i++) {
        let dx = pts[i].x - pts[i-1].x;
        let dy = pts[i].y - pts[i-1].y;
        let dist = Math.sqrt(dx*dx + dy*dy);
        total += dist;
        lengths.push(total);
    }
    return { lengths, total };
}

const easeInOutCubic = (t: number) => t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}` : '255, 255, 255';
};

const AnimationCanvas = forwardRef<AnimationCanvasRef, Props>(({ 
  duration, revealDuration, mode, backgroundColor, showGrid, showBloom, backgroundImage,
  lineWidth, pointRadius, line1Color, line2Color,
  particleSize, particleColor1, particleColor2, particleShape, particleEmissionRate,
  targetPoints, baselinePoints, showTarget, showBaseline, targetResolution,
  isEditorMode, onTargetPointsChange, onBaselinePointsChange, onTimeUpdate,
  onPlayStateChange 
}, ref) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgImageRef = useRef<HTMLImageElement | null>(null);
  
  const stateRef = useRef({
    isPlaying: false,
    progress: 0,
    fillProgress: 0,
    lastTime: 0,
    particles: [] as any[],
    isRecording: false,
    transparentBg: false,
    recorder: null as MediaRecorder | null,
    chunks: [] as BlobPart[],
    onExportComplete: null as (() => void) | null,
    exportFormat: 'webm'
  });

  const latestProps = useRef({ targetPoints, baselinePoints, onTargetPointsChange, onBaselinePointsChange, isEditorMode, targetResolution, showTarget, showBaseline });
  useEffect(() => {
    latestProps.current = { targetPoints, baselinePoints, onTargetPointsChange, onBaselinePointsChange, isEditorMode, targetResolution, showTarget, showBaseline };
  }, [targetPoints, baselinePoints, onTargetPointsChange, onBaselinePointsChange, isEditorMode, targetResolution, showTarget, showBaseline]);

  const dragState = useRef({
    isDragging: false,
    type: null as 'target' | 'baseline' | null,
    index: -1,
    hoveredType: null as 'target' | 'baseline' | null,
    hoveredIndex: -1
  });

  // Load background image
  useEffect(() => {
    if (backgroundImage) {
      const img = new Image();
      img.onload = () => { bgImageRef.current = img; };
      img.src = backgroundImage;
    } else {
      bgImageRef.current = null;
    }
  }, [backgroundImage]);

  useImperativeHandle(ref, () => ({
    play: () => {
      stateRef.current.isPlaying = true;
      stateRef.current.lastTime = performance.now();
      onPlayStateChange(true);
    },
    pause: () => {
      stateRef.current.isPlaying = false;
      onPlayStateChange(false);
    },
    stop: () => {
      stateRef.current.progress = 0;
      stateRef.current.fillProgress = 0;
      stateRef.current.particles = [];
      stateRef.current.isPlaying = false;
      onPlayStateChange(false);
      if (onTimeUpdate) onTimeUpdate(0);
    },
    seek: (time: number) => {
      if (time <= duration) {
        stateRef.current.progress = time / duration;
        stateRef.current.fillProgress = 0;
      } else {
        stateRef.current.progress = 1;
        stateRef.current.fillProgress = revealDuration > 0 ? Math.min(1, (time - duration) / revealDuration) : 1;
      }
      stateRef.current.particles = [];
      if (onTimeUpdate) onTimeUpdate(time);
    },
    restart: () => {
      stateRef.current.progress = 0;
      stateRef.current.fillProgress = 0;
      stateRef.current.particles = [];
      stateRef.current.isPlaying = true;
      stateRef.current.lastTime = performance.now();
      onPlayStateChange(true);
    },
    startRecording: (format, onComplete) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      stateRef.current.exportFormat = format;
      stateRef.current.transparentBg = false;
      stateRef.current.onExportComplete = onComplete;
      
      const stream = canvas.captureStream(60);
      
      let mimeType = '';
      if (format === 'mp4' && MediaRecorder.isTypeSupported('video/mp4')) {
        mimeType = 'video/mp4';
      } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp9')) {
        mimeType = 'video/webm; codecs=vp9';
      } else if (MediaRecorder.isTypeSupported('video/webm; codecs=vp8')) {
        mimeType = 'video/webm; codecs=vp8';
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        mimeType = 'video/webm';
      }

      try {
        const options = mimeType ? { mimeType } : undefined;
        const recorder = new MediaRecorder(stream, options);
        stateRef.current.recorder = recorder;
        stateRef.current.chunks = [];

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            stateRef.current.chunks.push(e.data);
          }
        };

        recorder.onstop = () => {
          const actualMimeType = mimeType || 'video/webm';
          const blob = new Blob(stateRef.current.chunks, { type: actualMimeType });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `graph-cinema.${actualMimeType.includes('mp4') ? 'mp4' : 'webm'}`;
          a.click();
          URL.revokeObjectURL(url);
          
          stateRef.current.transparentBg = false;
          if (stateRef.current.onExportComplete) {
            stateRef.current.onExportComplete();
          }
        };

        stateRef.current.isRecording = true;
        
        // Only reset if we are already at the end
        if (stateRef.current.progress >= 1 && (revealDuration === 0 || stateRef.current.fillProgress >= 1)) {
          stateRef.current.progress = 0;
          stateRef.current.fillProgress = 0;
          stateRef.current.particles = [];
        }
        
        stateRef.current.isPlaying = true;
        stateRef.current.lastTime = performance.now();
        onPlayStateChange(true);
        
        recorder.start();
      } catch (e) {
        console.error('Failed to start recording:', e);
        stateRef.current.transparentBg = false;
        if (onComplete) onComplete();
      }
    },
    stopRecording: () => {
      const state = stateRef.current;
      if (state.isRecording && state.recorder && state.recorder.state !== 'inactive') {
        state.recorder.stop();
        state.isRecording = false;
      }
    }
  }));

  // Mouse events for Editor Mode
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getNormCoords = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const { w: width, h: height } = latestProps.current.targetResolution;
      
      const canvasAspect = width / height;
      const clientAspect = rect.width / rect.height;
      
      let renderedWidth = rect.width;
      let renderedHeight = rect.height;
      
      if (canvasAspect > clientAspect) {
        renderedHeight = rect.width / canvasAspect;
      } else {
        renderedWidth = rect.height * canvasAspect;
      }
      
      const offsetX = (rect.width - renderedWidth) / 2;
      const offsetY = (rect.height - renderedHeight) / 2;
      
      const mouseX = e.clientX - rect.left - offsetX;
      const mouseY = e.clientY - rect.top - offsetY;
      
      const canvasX = mouseX * (width / renderedWidth);
      const canvasY = mouseY * (height / renderedHeight);
      
      const padding = Math.max(40, Math.min(width, height) * 0.08);
      
      let normX = (canvasX - padding) / (width - padding * 2);
      let normY = (height - padding - canvasY) / (height - padding * 2);
      
      normX = Math.max(0, Math.min(1, normX));
      normY = Math.max(0, Math.min(1, normY));
      
      return { normX, normY };
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (!latestProps.current.isEditorMode) return;
      const coords = getNormCoords(e);
      if (!coords) return;
      
      let closestDist = 0.05;
      let hitType: 'target' | 'baseline' | null = null;
      let hitIndex = -1;
      
      const checkPoints = (pts: {x:number, y:number}[], type: 'target' | 'baseline') => {
        pts.forEach((p, i) => {
          const dx = p.x - coords.normX;
          const dy = p.y - coords.normY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < closestDist) {
            closestDist = dist;
            hitType = type;
            hitIndex = i;
          }
        });
      };
      
      if (latestProps.current.showTarget) checkPoints(latestProps.current.targetPoints, 'target');
      if (latestProps.current.showBaseline) checkPoints(latestProps.current.baselinePoints, 'baseline');
      
      if (hitType) {
        dragState.current.isDragging = true;
        dragState.current.type = hitType;
        dragState.current.index = hitIndex;
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!latestProps.current.isEditorMode) return;
      const coords = getNormCoords(e);
      if (!coords) return;

      if (dragState.current.isDragging) {
        const { type, index } = dragState.current;
        const pts = type === 'target' ? [...latestProps.current.targetPoints] : [...latestProps.current.baselinePoints];
        pts[index] = { x: coords.normX, y: coords.normY };
        
        if (type === 'target' && latestProps.current.onTargetPointsChange) {
          latestProps.current.onTargetPointsChange(pts);
        } else if (type === 'baseline' && latestProps.current.onBaselinePointsChange) {
          latestProps.current.onBaselinePointsChange(pts);
        }
      } else {
        let closestDist = 0.05;
        let hitType: 'target' | 'baseline' | null = null;
        let hitIndex = -1;
        
        const checkPoints = (pts: {x:number, y:number}[], type: 'target' | 'baseline') => {
          pts.forEach((p, i) => {
            const dx = p.x - coords.normX;
            const dy = p.y - coords.normY;
            const dist = Math.sqrt(dx*dx + dy*dy);
            if (dist < closestDist) {
              closestDist = dist;
              hitType = type;
              hitIndex = i;
            }
          });
        };
        
        if (latestProps.current.showTarget) checkPoints(latestProps.current.targetPoints, 'target');
        if (latestProps.current.showBaseline) checkPoints(latestProps.current.baselinePoints, 'baseline');
        
        if (hitType !== dragState.current.hoveredType || hitIndex !== dragState.current.hoveredIndex) {
          dragState.current.hoveredType = hitType;
          dragState.current.hoveredIndex = hitIndex;
        }
        
        canvas.style.cursor = hitType ? 'grab' : 'default';
        if (dragState.current.isDragging) canvas.style.cursor = 'grabbing';
      }
    };

    const handleMouseUp = () => {
      if (dragState.current.isDragging) {
        dragState.current.isDragging = false;
        const { type } = dragState.current;
        dragState.current.type = null;
        dragState.current.index = -1;
        
        // Sort points by X on release to maintain valid line graph
        const sortPts = (pts: {x:number, y:number}[], onChange: (p: {x:number, y:number}[]) => void) => {
          const sorted = [...pts].sort((a, b) => a.x - b.x);
          onChange(sorted);
        };
        
        if (type === 'target' && latestProps.current.onTargetPointsChange) {
          sortPts(latestProps.current.targetPoints, latestProps.current.onTargetPointsChange);
        } else if (type === 'baseline' && latestProps.current.onBaselinePointsChange) {
          sortPts(latestProps.current.baselinePoints, latestProps.current.onBaselinePointsChange);
        }
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      if (!latestProps.current.isEditorMode) return;
      e.preventDefault();
      
      const coords = getNormCoords(e);
      if (!coords) return;
      
      let hitType: 'target' | 'baseline' | null = null;
      let hitIndex = -1;
      let closestDist = 0.05;

      const checkPoints = (pts: {x:number, y:number}[], type: 'target' | 'baseline') => {
        pts.forEach((p, i) => {
          const dx = p.x - coords.normX;
          const dy = p.y - coords.normY;
          const dist = Math.sqrt(dx*dx + dy*dy);
          if (dist < closestDist) {
            closestDist = dist;
            hitType = type;
            hitIndex = i;
          }
        });
      };
      
      if (latestProps.current.showTarget) checkPoints(latestProps.current.targetPoints, 'target');
      if (latestProps.current.showBaseline) checkPoints(latestProps.current.baselinePoints, 'baseline');

      if (hitType && hitIndex !== -1) {
        // Delete node
        const pts = hitType === 'target' ? [...latestProps.current.targetPoints] : [...latestProps.current.baselinePoints];
        pts.splice(hitIndex, 1);
        if (hitType === 'target' && latestProps.current.onTargetPointsChange) latestProps.current.onTargetPointsChange(pts);
        else if (latestProps.current.onBaselinePointsChange) latestProps.current.onBaselinePointsChange(pts);
        return;
      }

      // If no node clicked, check if we clicked on a line segment to insert a node
      let insertType: 'target' | 'baseline' | null = null;
      let insertIndex = -1;
      let minLineDist = 0.05;
      let insertPoint = { x: 0, y: 0 };

      const checkLineSegments = (pts: {x:number, y:number}[], type: 'target' | 'baseline') => {
        for (let i = 0; i < pts.length - 1; i++) {
          const p1 = pts[i];
          const p2 = pts[i+1];

          const l2 = Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2);
          if (l2 === 0) continue;
          
          let t = ((coords.normX - p1.x) * (p2.x - p1.x) + (coords.normY - p1.y) * (p2.y - p1.y)) / l2;
          t = Math.max(0, Math.min(1, t));
          
          const projX = p1.x + t * (p2.x - p1.x);
          const projY = p1.y + t * (p2.y - p1.y);
          
          const dist = Math.hypot(projX - coords.normX, projY - coords.normY);
          if (dist < minLineDist) {
            minLineDist = dist;
            insertType = type;
            insertIndex = i + 1;
            insertPoint = { x: projX, y: projY };
          }
        }
      };

      if (latestProps.current.showTarget) checkLineSegments(latestProps.current.targetPoints, 'target');
      if (latestProps.current.showBaseline) checkLineSegments(latestProps.current.baselinePoints, 'baseline');

      if (insertType && insertIndex !== -1) {
        const pts = insertType === 'target' ? [...latestProps.current.targetPoints] : [...latestProps.current.baselinePoints];
        pts.splice(insertIndex, 0, insertPoint);
        if (insertType === 'target' && latestProps.current.onTargetPointsChange) latestProps.current.onTargetPointsChange(pts);
        else if (latestProps.current.onBaselinePointsChange) latestProps.current.onBaselinePointsChange(pts);
      }
    };

    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    let animationFrameId: number;
    let ctx: CanvasRenderingContext2D | null = null;
    let width = targetResolution.w;
    let height = targetResolution.h;
    let bluePts: {x:number, y:number}[] = [];
    let orangePts: {x:number, y:number}[] = [];
    let blueData: {lengths: number[], total: number} = { lengths: [], total: 0 };
    let orangeData: {lengths: number[], total: number} = { lengths: [], total: 0 };
    let padding = Math.max(40, Math.min(width, height) * 0.08);

    const setupCanvas = () => {
      width = targetResolution.w;
      height = targetResolution.h;
      canvas.width = width;
      canvas.height = height;
      ctx = canvas.getContext('2d', { alpha: true });
      padding = Math.max(40, Math.min(width, height) * 0.08);

      const mapPoints = (pts: {x:number, y:number}[]) => {
        const w = width - padding * 2;
        const h = height - padding * 2;
        return pts.map(p => ({
          x: padding + p.x * w,
          y: height - padding - p.y * h
        }));
      };

      bluePts = mapPoints(getSplinePoints(baselinePoints));
      orangePts = mapPoints(getSplinePoints(targetPoints));
      blueData = getLengths(bluePts);
      orangeData = getLengths(orangePts);
    };

    setupCanvas();

    const spawnParticles = (pos: {x:number, y:number}, color: string) => {
      const state = stateRef.current;
      if (Math.random() < particleEmissionRate) {
        state.particles.push({
          x: pos.x,
          y: pos.y,
          vx: (Math.random() - 0.5) * 1.5,
          vy: (Math.random() - 0.5) * 1.5,
          life: 1,
          color: color
        });
      }
    };

    const drawBackground = () => {
      if (!ctx) return;
      const state = stateRef.current;
      if (state.transparentBg) {
        ctx.clearRect(0, 0, width, height);
        return;
      }
      
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, width, height);

      if (bgImageRef.current) {
        const img = bgImageRef.current;
        const scale = Math.max(width / img.width, height / img.height);
        const x = (width / 2) - (img.width / 2) * scale;
        const y = (height / 2) - (img.height / 2) * scale;
        ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
      }

      if (showBloom) {
        const grad = ctx.createRadialGradient(width/2, height/2, 0, width/2, height/2, width * 0.8);
        grad.addColorStop(0, 'rgba(0, 40, 80, 0.4)');
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }

      if (showGrid) {
        // Subtle grid lines
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        for(let i=1; i<10; i++) {
          const y = padding + (height - padding*2) * (i/10);
          ctx.moveTo(padding, y);
          ctx.lineTo(width - padding, y);
        }
        ctx.stroke();
      }
    };

    const drawLine = (pts: {x:number, y:number}[], lengths: number[], totalLength: number, progress: number, color: string) => {
      if (!ctx || progress <= 0 || pts.length === 0) return null;
      const targetLen = totalLength * progress;
      let endIdx = 1;
      while (endIdx < lengths.length && lengths[endIdx] < targetLen) {
        endIdx++;
      }

      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < endIdx; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }

      let currentPos = pts[endIdx - 1];
      if (endIdx < pts.length) {
        const p1 = pts[endIdx - 1];
        const p2 = pts[endIdx];
        const l1 = lengths[endIdx - 1];
        const l2 = lengths[endIdx];
        const t = (targetLen - l1) / (l2 - l1);
        currentPos = {
          x: p1.x + (p2.x - p1.x) * t,
          y: p1.y + (p2.y - p1.y) * t
        };
        ctx.lineTo(currentPos.x, currentPos.y);
      }

      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      
      // Glow effect using filter for perfect smooth gradients
      ctx.save();
      ctx.filter = `blur(${lineWidth * 4}px)`;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * 4;
      ctx.stroke();
      
      ctx.filter = `blur(${lineWidth * 8}px)`;
      ctx.lineWidth = lineWidth * 8;
      ctx.stroke();
      ctx.restore();
      
      // Core line
      ctx.lineWidth = lineWidth;
      ctx.strokeStyle = '#fff';
      ctx.stroke();

      if (pointRadius > 0) {
        // Draw head glow
        ctx.save();
        ctx.filter = `blur(${pointRadius * 1.5}px)`;
        ctx.beginPath();
        ctx.arc(currentPos.x, currentPos.y, pointRadius * 2, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.restore();

        // Draw head core
        ctx.beginPath();
        ctx.arc(currentPos.x, currentPos.y, pointRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
      }

      return currentPos;
    };

    const drawFill = (fillProgress: number) => {
      if (!ctx || fillProgress <= 0 || bluePts.length === 0 || orangePts.length === 0) return;

      ctx.beginPath();
      ctx.moveTo(bluePts[0].x, bluePts[0].y);
      for (let i = 1; i < bluePts.length; i++) {
        ctx.lineTo(bluePts[i].x, bluePts[i].y);
      }
      for (let i = orangePts.length - 1; i >= 0; i--) {
        ctx.lineTo(orangePts[i].x, orangePts[i].y);
      }
      ctx.closePath();

      const grad = ctx.createLinearGradient(0, padding, 0, height - padding);
      grad.addColorStop(0, `rgba(${hexToRgb(line2Color)}, ${0.4 * fillProgress})`);
      grad.addColorStop(1, `rgba(${hexToRgb(line1Color)}, ${0.4 * fillProgress})`);

      ctx.fillStyle = grad;
      ctx.fill();
    };

    const drawEditorPoints = (pts: {x:number, y:number}[], color: string, type: 'target' | 'baseline') => {
      if (!ctx) return;
      pts.forEach((p, i) => {
        const cx = padding + p.x * (width - padding * 2);
        const cy = height - padding - p.y * (height - padding * 2);
        
        ctx.beginPath();
        ctx.arc(cx, cy, 6, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.stroke();
        
        if (dragState.current.hoveredType === type && dragState.current.hoveredIndex === i) {
          ctx.beginPath();
          ctx.arc(cx, cy, 10, 0, Math.PI * 2);
          ctx.strokeStyle = '#fff';
          ctx.stroke();
        }
      });
    };

    const render = (time: number) => {
      const state = stateRef.current;
      
      if (isEditorMode) {
        state.progress = 1;
        state.fillProgress = 1;
        state.isPlaying = false;
        if (onTimeUpdate) onTimeUpdate(duration);
      } else {
        if (state.isPlaying) {
          const dt = (time - state.lastTime) / 1000;
          state.lastTime = time;
          
          if (state.progress < 1) {
            state.progress = Math.min(state.progress + dt / duration, 1);
          } else if (state.fillProgress < 1 && revealDuration > 0) {
            state.fillProgress = Math.min(state.fillProgress + dt / revealDuration, 1);
          } else if (state.isRecording) {
            // Finish recording
            state.isRecording = false;
            state.isPlaying = false;
            if (state.recorder && state.recorder.state !== 'inactive') {
              setTimeout(() => {
                state.recorder?.stop();
              }, 100);
            }
            onPlayStateChange(false);
          } else {
            state.isPlaying = false;
            onPlayStateChange(false);
          }
        } else {
          state.lastTime = time;
        }
        if (onTimeUpdate) {
          onTimeUpdate(state.progress * duration + state.fillProgress * revealDuration);
        }
      }

      drawBackground();

      let orangeProg = 0;
      let blueProg = 0;

      if (mode === 'together') {
        orangeProg = easeInOutCubic(state.progress);
        blueProg = easeInOutCubic(state.progress);
      } else if (mode === 'staggered') {
        if (state.progress < 0.5) {
          orangeProg = easeInOutCubic(state.progress * 2);
          blueProg = 0;
        } else {
          orangeProg = 1;
          blueProg = easeInOutCubic((state.progress - 0.5) * 2);
        }
      }

      if (state.progress >= 1 && showTarget && showBaseline && revealDuration > 0) {
        drawFill(easeInOutCubic(state.fillProgress));
      }

      const orangePos = showTarget ? drawLine(orangePts, orangeData.lengths, orangeData.total, orangeProg, line1Color) : null;
      const bluePos = showBaseline ? drawLine(bluePts, blueData.lengths, blueData.total, blueProg, line2Color) : null;

      if (state.isPlaying && !isEditorMode) {
        if (orangePos && orangeProg < 1) spawnParticles(orangePos, particleColor1);
        if (bluePos && blueProg < 1) spawnParticles(bluePos, particleColor2);
      }

      // Update and draw particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        let p = state.particles[i];
        if (state.isPlaying && !isEditorMode) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.02;
        }
        if (p.life <= 0) {
          state.particles.splice(i, 1);
        } else if (ctx) {
          ctx.beginPath();
          if (particleShape === 'circle') {
            ctx.arc(p.x, p.y, particleSize * p.life, 0, Math.PI * 2);
          } else if (particleShape === 'triangle') {
            const s = particleSize * p.life * 1.5;
            ctx.moveTo(p.x, p.y - s);
            ctx.lineTo(p.x + s, p.y + s);
            ctx.lineTo(p.x - s, p.y + s);
            ctx.closePath();
          } else if (particleShape === 'star') {
            const s = particleSize * p.life * 1.5;
            for (let j = 0; j < 5; j++) {
              const angle = (j * 4 * Math.PI) / 5 - Math.PI / 2;
              const px = p.x + Math.cos(angle) * s;
              const py = p.y + Math.sin(angle) * s;
              if (j === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
          } else if (particleShape === 'diamond') {
            const s = particleSize * p.life * 1.5;
            ctx.moveTo(p.x, p.y - s);
            ctx.lineTo(p.x + s, p.y);
            ctx.lineTo(p.x, p.y + s);
            ctx.lineTo(p.x - s, p.y);
            ctx.closePath();
          } else if (particleShape === 'hex') {
            const s = particleSize * p.life * 1.5;
            for (let j = 0; j < 6; j++) {
              const angle = (j * Math.PI) / 3;
              const px = p.x + Math.cos(angle) * s;
              const py = p.y + Math.sin(angle) * s;
              if (j === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            }
            ctx.closePath();
          }
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.fill();
          
          ctx.beginPath();
          ctx.arc(p.x, p.y, particleSize * 3 * p.life, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life * 0.3;
          ctx.fill();
          
          ctx.globalAlpha = 1;
        }
      }

      if (isEditorMode) {
        if (showBaseline) drawEditorPoints(baselinePoints, line2Color, 'baseline');
        if (showTarget) drawEditorPoints(targetPoints, line1Color, 'target');
      }

      animationFrameId = requestAnimationFrame(render);
    };

    stateRef.current.lastTime = performance.now();
    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    duration, revealDuration, mode, backgroundColor, showGrid, showBloom, backgroundImage,
    lineWidth, pointRadius, line1Color, line2Color,
    particleSize, particleColor1, particleColor2, particleShape, particleEmissionRate,
    targetPoints, baselinePoints, targetResolution.w, targetResolution.h,
    isEditorMode, showTarget, showBaseline
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="block object-contain w-full h-full"
    />
  );
});

export default AnimationCanvas;
