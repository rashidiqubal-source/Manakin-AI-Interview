"use client";

import React, { useRef, useEffect } from "react";

export interface ScanpathPoint {
  x: number; // Normalized 0 - 1
  y: number; // Normalized 0 - 1
  timestamp: number;
  durationMs: number;
  isFixation: boolean;
}

interface ScanpathVisualizerProps {
  points?: ScanpathPoint[];
  width?: number;
  height?: number;
  className?: string;
}

export function ScanpathVisualizer({
  points = [],
  width = 600,
  height = 360,
  className = "",
}: ScanpathVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Clear background
    ctx.fillStyle = "#09090b";
    ctx.fillRect(0, 0, width, height);

    // Subtle grid lines
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    const gridCols = 4;
    const gridRows = 3;
    for (let c = 1; c < gridCols; c++) {
      const x = (width / gridCols) * c;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let r = 1; r < gridRows; r++) {
      const y = (height / gridRows) * r;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Center focal zone crosshair
    const centerX = width / 2;
    const centerY = height / 2;
    ctx.strokeStyle = "rgba(34, 211, 238, 0.2)";
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(centerX - width * 0.15, centerY - height * 0.15, width * 0.3, height * 0.3);
    ctx.setLineDash([]);

    ctx.fillStyle = "rgba(34, 211, 238, 0.4)";
    ctx.font = "10px monospace";
    ctx.fillText("OPTIMAL FOCAL ZONE", centerX - 55, centerY - height * 0.15 - 6);

    if (!points || points.length === 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("No scanpath telemetry recorded", width / 2, height / 2);
      return;
    }

    // Subsample points if too dense (> 150 points) to avoid visual noise
    const displayPoints =
      points.length > 150
        ? points.filter((_, idx) => idx % Math.ceil(points.length / 150) === 0 || _.isFixation)
        : points;

    // Draw scanpath connection paths (sequential lines)
    ctx.beginPath();
    ctx.lineWidth = 1.5;
    displayPoints.forEach((p, idx) => {
      const px = Math.min(Math.max(p.x * width, 10), width - 10);
      const py = Math.min(Math.max(p.y * height, 10), height - 10);
      if (idx === 0) {
        ctx.moveTo(px, py);
      } else {
        ctx.lineTo(px, py);
      }
    });

    const grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, "rgba(34, 211, 238, 0.6)");
    grad.addColorStop(1, "rgba(168, 85, 247, 0.6)");
    ctx.strokeStyle = grad;
    ctx.stroke();

    // Draw fixation nodes and gaze points
    displayPoints.forEach((p, idx) => {
      const px = Math.min(Math.max(p.x * width, 10), width - 10);
      const py = Math.min(Math.max(p.y * height, 10), height - 10);

      if (p.isFixation) {
        // Fixation cluster halo
        const radius = Math.min(Math.max((p.durationMs / 1000) * 12, 6), 24);

        const radGrad = ctx.createRadialGradient(px, py, 2, px, py, radius);
        radGrad.addColorStop(0, "rgba(244, 63, 94, 0.7)");
        radGrad.addColorStop(1, "rgba(244, 63, 94, 0)");
        ctx.fillStyle = radGrad;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#f43f5e";
        ctx.beginPath();
        ctx.arc(px, py, 3.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // Normal gaze point
        ctx.fillStyle = "rgba(34, 211, 238, 0.5)";
        ctx.beginPath();
        ctx.arc(px, py, 2, 0, Math.PI * 2);
        ctx.fill();
      }

      // Show index on first and last points
      if (idx === 0 || idx === displayPoints.length - 1) {
        ctx.fillStyle = idx === 0 ? "#10b981" : "#a855f7";
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px monospace";
        ctx.fillText(idx === 0 ? "START" : "END", px + 8, py + 3);
      }
    });
  }, [points, width, height]);

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 ${className}`}>
      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        className="w-full h-auto block"
      />
      <div className="absolute bottom-2 right-3 flex items-center gap-3 text-[10px] font-mono text-zinc-400 bg-black/60 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-cyan-400" /> Path Trail
        </span>
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-rose-500" /> Fixation (≥150ms)
        </span>
      </div>
    </div>
  );
}
