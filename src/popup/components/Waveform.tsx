import React, { useEffect, useRef } from 'react';

interface WaveformProps {
  data: Uint8Array | null;
  width?: number;
  height?: number;
  barColor?: string;
  backgroundColor?: string;
  zoom?: number;
  currentTime?: number;
  duration?: number;
  onSeek?: (time: number) => void;
  isRecording?: boolean;
  channelMode?: 'mono' | 'stereo';
}

export const Waveform: React.FC<WaveformProps> = ({
  data,
  width = 600,
  height = 200,
  barColor = '#ff9500',
  backgroundColor = '#2a2a2a',
  zoom = 1,
  currentTime = 0,
  duration = 0,
  onSeek,
  isRecording = false,
  channelMode
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastPositionRef = useRef<number>(-1);
  const lastUpdateTimeRef = useRef<number>(Date.now());
  const lastKnownTimeRef = useRef<number>(0);
  const interpolatedPositionRef = useRef<number>(0);
  const prevZoomRef = useRef<number>(zoom);

  // Draw waveform (only when data changes)
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !data) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Apply zoom scale to canvas dimensions for visual scaling
    const scale = zoom;
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;
    canvas.width = scaledWidth;
    canvas.height = scaledHeight;

    // Clear canvas
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, scaledWidth, scaledHeight);

    // Draw waveform bars
    // Zoom in (zoom > 1): shows fewer bars (more detail per bar) and larger size
    // Zoom out (zoom < 1): shows more bars (less detail, see more of waveform) and smaller size
    const barCount = Math.floor(data.length / zoom);
    const barWidth = scaledWidth / barCount;
    const maxBarHeight = scaledHeight * 0.8;

    ctx.fillStyle = barColor;

    for (let i = 0; i < barCount; i++) {
      const dataIndex = Math.floor(i * zoom);
      const value = data[dataIndex] || 0;
      const barHeight = (value / 255) * maxBarHeight * zoom;
      const x = i * barWidth;
      const y = (scaledHeight - barHeight) / 2;

      ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
    }
  }, [data, width, height, barColor, backgroundColor, zoom]);

  // Smooth playback position indicator using requestAnimationFrame
  useEffect(() => {
    if (duration <= 0 || !data) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate scale once for this effect
    const scale = zoom;
    const scaledWidth = width * scale;
    const scaledHeight = height * scale;

    let isActive = true;

    const drawPosition = () => {
      if (!isActive || !canvas || !ctx || !data) return;

      // Calculate target position based on current time (on scaled canvas)
      // This is the absolute truth for where the line should be.
      // We do not interpolate anymore, we just draw exactly where it should be.
      // Since we refresh entire canvas, 60fps update is smooth enough.
      const targetPosition = (currentTime / duration) * scaledWidth;

      // Update ref for other effects
      lastPositionRef.current = targetPosition;

      // Get colors and dimensions
      const currentBgColor = backgroundColor;
      const currentBarColor = barColor;
      const barCount = Math.floor(data.length / zoom);
      const barWidth = scaledWidth / barCount;
      const maxBarHeight = scaledHeight * 0.8;

      // 1. Clear the ENTIRE canvas
      // This guarantees no trails and no artifacts
      ctx.fillStyle = currentBgColor;
      ctx.fillRect(0, 0, scaledWidth, scaledHeight);

      // 2. Redraw the entire waveform
      // Canvas makes this surprisingly fast even at 60fps
      ctx.fillStyle = currentBarColor;
      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * zoom);
        const value = data[dataIndex] || 0;
        const barHeight = (value / 255) * maxBarHeight * zoom;
        const x = i * barWidth;
        const y = (scaledHeight - barHeight) / 2;
        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      }

      // 3. Draw the playhead position line
      ctx.strokeStyle = '#888';
      ctx.lineWidth = 1;
      ctx.beginPath();
      // Snap to pixel for sharpness
      const lineX = Math.floor(targetPosition) + 0.5;
      ctx.moveTo(lineX, 0);
      ctx.lineTo(lineX, scaledHeight);
      ctx.stroke();

      // Continue animation loop
      if (isActive && duration > 0) {
        animationFrameRef.current = requestAnimationFrame(drawPosition);
      }
    };

    // Start animation loop
    animationFrameRef.current = requestAnimationFrame(drawPosition);

    return () => {
      isActive = false;
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [currentTime, duration, width, data, zoom, backgroundColor, barColor, height]);

  // Redraw waveform when colors change (theme change)
  useEffect(() => {
    if (data && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Apply zoom scale to canvas dimensions for visual scaling
      const scale = zoom;
      const scaledWidth = width * scale;
      const scaledHeight = height * scale;
      canvas.width = scaledWidth;
      canvas.height = scaledHeight;

      // Clear canvas with new background color
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(0, 0, scaledWidth, scaledHeight);

      // Redraw waveform bars with new colors
      const barCount = Math.floor(data.length / zoom);
      const barWidth = scaledWidth / barCount;
      const maxBarHeight = scaledHeight * 0.8;

      ctx.fillStyle = barColor;

      for (let i = 0; i < barCount; i++) {
        const dataIndex = Math.floor(i * zoom);
        const value = data[dataIndex] || 0;
        const barHeight = (value / 255) * maxBarHeight * zoom;
        const x = i * barWidth;
        const y = (scaledHeight - barHeight) / 2;

        ctx.fillRect(x, y, Math.max(1, barWidth - 1), barHeight);
      }

      // Redraw position line if it exists
      if (lastPositionRef.current >= 0 && duration > 0) {
        ctx.strokeStyle = '#888';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lastPositionRef.current, 0);
        ctx.lineTo(lastPositionRef.current, scaledHeight);
        ctx.stroke();
      }
    }
  }, [backgroundColor, barColor, data, width, height, zoom, duration]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSeek || !duration || isRecording) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    // Adjust click position for zoom scale
    const scale = zoom;
    const containerCenterX = rect.width / 2;
    const clickOffsetFromCenter = x - containerCenterX;
    const scaledOffset = clickOffsetFromCenter / scale;
    const adjustedX = containerCenterX + scaledOffset;
    const percentage = Math.max(0, Math.min(1, adjustedX / rect.width));
    const seekTime = percentage * duration;

    onSeek(Math.max(0, Math.min(seekTime, duration)));
  };

  // Calculate scale based on zoom for visual scaling
  // zoom > 1 means zoom in (make larger), zoom < 1 means zoom out (make smaller)
  const scale = zoom;

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        cursor: onSeek && !isRecording && duration > 0 ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}
    >
      {channelMode && (
        <div className="waveform-channel-indicator">
          {channelMode.toUpperCase()}
        </div>
      )}
      <div
        style={{
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          width: `${100 / scale}%`,
          height: `${100 / scale}%`,
          position: 'relative'
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block'
          }}
        />
      </div>
    </div>
  );
};
