import React from 'react';

export default function DicomViewer({ pan, zoomLevel, cursorPos, pins, diagnosticMode, activePatient }) {
  const anomalyBox = activePatient?.tumorBox;

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      
      {/* 1. The Medical Image */}
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <img 
          src={activePatient?.file} 
          alt="Medical Scan" 
          draggable="false"
          style={{ 
            maxHeight: '100%', maxWidth: '100%', objectFit: 'contain',
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`, 
            transition: 'transform 0.1s ease-out'
          }} 
        />
      </div>

      {/* 2. The SVG Data Overlay (Draws the AI Box, Cursor, and Pins) */}
      <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
        
        {/* === AI OVERLAY LAYER === */}
        {diagnosticMode && (
          <>
            {/* If Healthy: Show Green Text */}
            {!activePatient?.hasTumor && (
              <text x="20" y="40" fill="#10B981" fontSize="16" fontWeight="bold">✓ AI Scan: No Anomalies Detected</text>
            )}

            {/* If Tumor: Draw Red Bounding Box */}
            {activePatient?.hasTumor && anomalyBox && (
              <g style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoomLevel})`, transformOrigin: 'center' }}>
                <rect 
                  x={`${anomalyBox.x}%`} y={`${anomalyBox.y}%`} 
                  width={`${anomalyBox.width}%`} height={`${anomalyBox.height}%`} 
                  fill="rgba(239, 68, 68, 0.1)" 
                  stroke="#EF4444" strokeWidth="2" strokeDasharray="5,5" 
                />
              </g>
            )}
          </>
        )}

        {/* === CURSOR LAYER === */}
        <circle cx={`${cursorPos.x}%`} cy={`${cursorPos.y}%`} r="15" fill="none" stroke="rgba(245, 158, 11, 0.6)" strokeWidth="2" strokeDasharray="4 2" />
        <line x1={`${cursorPos.x - 3}%`} y1={`${cursorPos.y}%`} x2={`${cursorPos.x + 3}%`} y2={`${cursorPos.y}%`} stroke="#F59E0B" strokeWidth="2" />
        <line x1={`${cursorPos.x}%`} y1={`${cursorPos.y - 3}%`} x2={`${cursorPos.x}%`} y2={`${cursorPos.y + 3}%`} stroke="#F59E0B" strokeWidth="2" />

        {/* === PINS LAYER === */}
        {pins[0] && <circle cx={`${pins[0].x}%`} cy={`${pins[0].y}%`} r="6" fill="#F59E0B" />}
        {pins[1] && (
          <>
            <circle cx={`${pins[1].x}%`} cy={`${pins[1].y}%`} r="6" fill="#10B981" />
            <line x1={`${pins[0].x}%`} y1={`${pins[0].y}%`} x2={`${pins[1].x}%`} y2={`${pins[1].y}%`} stroke="#F59E0B" strokeWidth="3" strokeDasharray="8 4" />
          </>
        )}
      </svg>
    </div>
  );
}