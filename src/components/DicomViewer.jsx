import React, { useRef, useEffect, useState } from 'react';

// Helper: Euclidean distance in percentage-space
const pctDist = (a, b) =>
  Math.sqrt(Math.pow(b.x - a.x, 2) + Math.pow(b.y - a.y, 2));

export default function DicomViewer({
  pan,
  zoomLevel,
  cursorPos,
  pins,
  diagnosticMode,
  activePatient,
  gradCamUrl = null,
}) {
  const containerRef = useRef(null);
  const [imageRect, setImageRect] = useState({ x: 0, y: 0, w: 100, h: 100 });
  const imgRef = useRef(null);

  const updateImageRect = () => {
    const img = imgRef.current;
    const container = containerRef.current;
    if (!img || !container) return;

    const cW = container.clientWidth;
    const cH = container.clientHeight;
    const iW = img.naturalWidth || cW;
    const iH = img.naturalHeight || cH;

    const scale = Math.min(cW / iW, cH / iH);
    const rW = iW * scale;
    const rH = iH * scale;
    const rX = (cW - rW) / 2;
    const rY = (cH - rH) / 2;

    setImageRect({
      x: (rX / cW) * 100,
      y: (rY / cH) * 100,
      w: (rW / cW) * 100,
      h: (rH / cH) * 100,
    });
  };

  useEffect(() => {
    window.addEventListener('resize', updateImageRect);
    return () => window.removeEventListener('resize', updateImageRect);
  }, []);

  const anomalyBox = activePatient?.tumorBox;

  const toContainerX = (imgPct) => imageRect.x + (imgPct / 100) * imageRect.w;
  const toContainerY = (imgPct) => imageRect.y + (imgPct / 100) * imageRect.h;
  const toContainerW = (imgPct) => (imgPct / 100) * imageRect.w;
  const toContainerH = (imgPct) => (imgPct / 100) * imageRect.h;

  const measureDistLabel = (() => {
    if (pins.length < 2) return null;
    const rawPct = pctDist(pins[0], pins[1]);
    return `${(rawPct * 10).toFixed(1)} px`;
  })();

  const midPoint = pins.length === 2
    ? { x: (pins[0].x + pins[1].x) / 2, y: (pins[0].y + pins[1].y) / 2 }
    : null;

  return (
    <div
      ref={containerRef}
      style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', backgroundColor: '#000' }}
    >
      {/* ── 1. MEDICAL IMAGE ── */}
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img
          ref={imgRef}
          src={activePatient?.file}
          alt="Medical Scan"
          draggable="false"
          onLoad={updateImageRect}
          style={{
            maxHeight: '100%',
            maxWidth: '100%',
            objectFit: 'contain',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
            transition: 'transform 0.08s linear',
            display: 'block',
          }}
        />
      </div>

      {/* ── 2. GRAD-CAM HEATMAP OVERLAY (Real CNN — when Flask API is ready) ── */}
      {/* When you connect the Flask backend, pass gradCamUrl as a prop.
          This renders the base64 Grad-CAM image directly on top of the scan. */}
      {diagnosticMode && gradCamUrl && (
        <img
          src={gradCamUrl}
          alt="Grad-CAM Heatmap"
          style={{
            position: 'absolute',
            left: `${imageRect.x}%`,
            top: `${imageRect.y}%`,
            width: `${imageRect.w}%`,
            height: `${imageRect.h}%`,
            objectFit: 'fill',
            opacity: 0.5,
            mixBlendMode: 'screen',     // Blends nicely with dark X-ray background
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`,
            transformOrigin: 'center',
            transition: 'transform 0.08s linear',
            pointerEvents: 'none',
          }}
        />
      )}

      {/* ── 3. SVG DATA OVERLAY ── */}
      <svg
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}
      >
        {/* ── AI BOUNDING BOX (Fallback while Grad-CAM is not yet connected) ── */}
        {diagnosticMode && !gradCamUrl && (
          <>
            {!activePatient?.hasTumor && (
              <text x="20" y="40" fill="#10B981" fontSize="15" fontWeight="bold" fontFamily="monospace">
                ✓ AI: No Anomalies Detected
              </text>
            )}

            {/* FIX: Bounding box now uses imageRect-corrected coordinates */}
            {activePatient?.hasTumor && anomalyBox && (() => {
              const bx = toContainerX(anomalyBox.x);
              const by = toContainerY(anomalyBox.y);
              const bw = toContainerW(anomalyBox.width);
              const bh = toContainerH(anomalyBox.height);
              const conf = activePatient.confidence;
              return (
                <g>
                  {/* Animated dashed border */}
                  <rect
                    x={`${bx}%`} y={`${by}%`}
                    width={`${bw}%`} height={`${bh}%`}
                    fill="rgba(239, 68, 68, 0.08)"
                    stroke="#EF4444" strokeWidth="1.5" strokeDasharray="6,3"
                  >
                    <animate attributeName="stroke-dashoffset" from="0" to="18" dur="1s" repeatCount="indefinite" />
                  </rect>
                  {/* Corner brackets for a more clinical look */}
                  {[
                    [bx, by, 1, 1],
                    [bx + bw, by, -1, 1],
                    [bx, by + bh, 1, -1],
                    [bx + bw, by + bh, -1, -1],
                  ].map(([cx, cy, sx, sy], i) => (
                    <g key={i}>
                      <line x1={`${cx}%`} y1={`${cy}%`} x2={`${cx + sx * 2}%`} y2={`${cy}%`} stroke="#EF4444" strokeWidth="2.5" />
                      <line x1={`${cx}%`} y1={`${cy}%`} x2={`${cx}%`} y2={`${cy + sy * 2}%`} stroke="#EF4444" strokeWidth="2.5" />
                    </g>
                  ))}
                  {/* Confidence label */}
                  <rect x={`${bx}%`} y={`${by - 5.5}%`} width={`${bw}%`} height="5%" fill="rgba(239,68,68,0.85)" rx="2" />
                  <text x={`${bx + bw / 2}%`} y={`${by - 2}%`} fill="white" fontSize="11" fontWeight="bold"
                    fontFamily="monospace" textAnchor="middle" dominantBaseline="middle">
                    ANOMALY · {conf}
                  </text>
                </g>
              );
            })()}
          </>
        )}

        {/* ── CURSOR ── */}
        <g>
          <circle
            cx={`${cursorPos.x}%`} cy={`${cursorPos.y}%`} r="14"
            fill="none" stroke="rgba(245,158,11,0.5)" strokeWidth="1.5" strokeDasharray="3 2"
          />
          <line x1={`${cursorPos.x - 2.5}%`} y1={`${cursorPos.y}%`} x2={`${cursorPos.x + 2.5}%`} y2={`${cursorPos.y}%`} stroke="#F59E0B" strokeWidth="1.5" />
          <line x1={`${cursorPos.x}%`} y1={`${cursorPos.y - 2.5}%`} x2={`${cursorPos.x}%`} y2={`${cursorPos.y + 2.5}%`} stroke="#F59E0B" strokeWidth="1.5" />
        </g>

        {/* ── MEASUREMENT PINS & LINE ── */}
        {pins[0] && (
          <g>
            <circle cx={`${pins[0].x}%`} cy={`${pins[0].y}%`} r="5" fill="#F59E0B" />
            <text x={`${pins[0].x + 1.5}%`} y={`${pins[0].y - 1.5}%`} fill="#F59E0B" fontSize="10" fontFamily="monospace">A</text>
          </g>
        )}
        {pins[1] && (
          <g>
            {/* Measurement line */}
            <line
              x1={`${pins[0].x}%`} y1={`${pins[0].y}%`}
              x2={`${pins[1].x}%`} y2={`${pins[1].y}%`}
              stroke="#F59E0B" strokeWidth="2" strokeDasharray="7 3"
            />
            {/* FIX: Distance label on the line — user can now see measurement result */}
            {midPoint && (
              <g>
                <rect
                  x={`${midPoint.x - 4}%`} y={`${midPoint.y - 3.5}%`}
                  width="8%" height="4%"
                  fill="rgba(15,23,42,0.85)" rx="3"
                />
                <text
                  x={`${midPoint.x}%`} y={`${midPoint.y - 1}%`}
                  fill="#F59E0B" fontSize="11" fontWeight="bold"
                  fontFamily="monospace" textAnchor="middle" dominantBaseline="middle"
                >
                  {measureDistLabel}
                </text>
              </g>
            )}
            <circle cx={`${pins[1].x}%`} cy={`${pins[1].y}%`} r="5" fill="#10B981" />
            <text x={`${pins[1].x + 1.5}%`} y={`${pins[1].y - 1.5}%`} fill="#10B981" fontSize="10" fontFamily="monospace">B</text>
          </g>
        )}
      </svg>

      {/* ── 4. GRAD-CAM STATUS BADGE ── */}
      {diagnosticMode && (
        <div style={{
          position: 'absolute', bottom: '12px', right: '12px',
          backgroundColor: gradCamUrl ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)',
          border: `1px solid ${gradCamUrl ? '#10B981' : '#F59E0B'}`,
          borderRadius: '6px', padding: '4px 10px',
          fontSize: '11px', fontFamily: 'monospace',
          color: gradCamUrl ? '#10B981' : '#F59E0B',
        }}>
          {gradCamUrl ? '● GRAD-CAM ACTIVE' : '○ SIMULATED OVERLAY'}
        </div>
      )}
    </div>
  );
}
