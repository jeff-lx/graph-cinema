import React, { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';

export interface AnimationCanvasRef {
  play: () => void;
  pause: () => void;
  restart: () => void;
  exportVideo: (format: 'webm' | 'mp4' | 'webm-transparent', onComplete: () => void) => void;
}

interface Props {
  duration: number;
  mode: 'together' | 'separate' | 'target-only' | 'baseline-only';
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
  particleEmissionRate: number;
  targetPoints: {x: number, y: number}[];
  baselinePoints: {x: number, y: number}[];
  targetResolution: { w: number, h: number };
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
  duration, mode, backgroundColor, showGrid, showBloom, backgroundImage,
  lineWidth, pointRadius, line1Color, line2Color,
  particleSize, particleColor1, particleColor2, particleEmissionRate,
  targetPoints, baselinePoints, targetResolution,
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
    restart: () => {
      stateRef.current.progress = 0;
      stateRef.current.fillProgress = 0;
      stateRef.current.particles = [];
      stateRef.current.isPlaying = true;
      stateRef.current.lastTime = performance.now();
      onPlayStateChange(true);
    },
    exportVideo: (format, onComplete) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      stateRef.current.exportFormat = format;
      stateRef.current.transparentBg = format === 'webm-transparent';
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
        
        // Reset and play
        stateRef.current.progress = 0;
        stateRef.current.fillProgress = 0;
        stateRef.current.particles = [];
        stateRef.current.isPlaying = true;
        stateRef.current.lastTime = performance.now();
        onPlayStateChange(true);
        
        recorder.start();
      } catch (e) {
        console.error('Failed to start recording:', e);
        stateRef.current.transparentBg = false;
        if (onComplete) onComplete();
      }
    }
  }));

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

    const render = (time: number) => {
      const state = stateRef.current;
      
      if (state.isPlaying) {
        const dt = (time - state.lastTime) / 1000;
        state.lastTime = time;
        
        if (state.progress < 1) {
          state.progress = Math.min(state.progress + dt / duration, 1);
        } else if (state.fillProgress < 1) {
          state.fillProgress = Math.min(state.fillProgress + dt / 1.5, 1); // 1.5s fill animation
        } else if (state.isRecording) {
          // Finish recording
          state.isRecording = false;
          state.isPlaying = false;
          if (state.recorder && state.recorder.state !== 'inactive') {
            // Add a small delay before stopping to ensure last frame is captured
            setTimeout(() => {
              state.recorder?.stop();
            }, 100);
          }
          onPlayStateChange(false);
        }
      } else {
        state.lastTime = time; // keep lastTime updated while paused
      }

      drawBackground();

      let orangeProg = 0;
      let blueProg = 0;

      if (mode === 'together') {
        orangeProg = easeInOutCubic(state.progress);
        blueProg = easeInOutCubic(state.progress);
      } else if (mode === 'separate') {
        if (state.progress < 0.5) {
          orangeProg = easeInOutCubic(state.progress * 2);
          blueProg = 0;
        } else {
          orangeProg = 1;
          blueProg = easeInOutCubic((state.progress - 0.5) * 2);
        }
      } else if (mode === 'target-only') {
        orangeProg = easeInOutCubic(state.progress);
        blueProg = 0;
      } else if (mode === 'baseline-only') {
        orangeProg = 0;
        blueProg = easeInOutCubic(state.progress);
      }

      // Draw fill first so it's behind lines
      if (state.progress >= 1 && (mode === 'together' || mode === 'separate')) {
        drawFill(easeInOutCubic(state.fillProgress));
      }

      const orangePos = drawLine(orangePts, orangeData.lengths, orangeData.total, orangeProg, line1Color);
      const bluePos = drawLine(bluePts, blueData.lengths, blueData.total, blueProg, line2Color);

      if (state.isPlaying) {
        if (orangePos && orangeProg < 1) spawnParticles(orangePos, particleColor1);
        if (bluePos && blueProg < 1) spawnParticles(bluePos, particleColor2);
      }

      // Update and draw particles
      for (let i = state.particles.length - 1; i >= 0; i--) {
        let p = state.particles[i];
        if (state.isPlaying) {
          p.x += p.vx;
          p.y += p.vy;
          p.life -= 0.02;
        }
        if (p.life <= 0) {
          state.particles.splice(i, 1);
        } else if (ctx) {
          ctx.beginPath();
          ctx.arc(p.x, p.y, particleSize * p.life, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life;
          ctx.fill();
          
          // Add a soft glow layer for particle
          ctx.beginPath();
          ctx.arc(p.x, p.y, particleSize * 3 * p.life, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = p.life * 0.3;
          ctx.fill();
          
          ctx.globalAlpha = 1;
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    stateRef.current.lastTime = performance.now();
    animationFrameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [
    duration, mode, backgroundColor, showGrid, showBloom, backgroundImage,
    lineWidth, pointRadius, line1Color, line2Color,
    particleSize, particleColor1, particleColor2, particleEmissionRate,
    targetPoints, baselinePoints, targetResolution.w, targetResolution.h
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="block object-contain w-full h-full"
    />
  );
});

export default AnimationCanvas;
