import React, { useEffect, useRef, useState } from 'react';
import cornerstone from 'cornerstone-core';
import cornerstoneWebImageLoader from 'cornerstone-web-image-loader';

cornerstoneWebImageLoader.external.cornerstone = cornerstone;
cornerstone.registerImageLoader('http', cornerstoneWebImageLoader.loadImage);

const DicomViewer = ({ pan, zoomLevel, cursorPos, pins, diagnosticMode, activePatient }) => {
  const elementRef = useRef(null);
  const [imageId, setImageId] = useState(null);

  // States for the Bounding Box Builder Tool
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [tempBox, setTempBox] = useState(null);

  const anomalyBox = activePatient.tumorBox; 

  // AI Hover Logic
  const isHoveringAnomaly = diagnosticMode && activePatient.hasTumor && anomalyBox &&
    cursorPos.x >= anomalyBox.x && cursorPos.x <= (anomalyBox.x + anomalyBox.width) &&
    cursorPos.y >= anomalyBox.y && cursorPos.y <= (anomalyBox.y + anomalyBox.height);

  useEffect(() => {
    cornerstone.enable(elementRef.current);
  }, []);

  // Load patient image dynamically
  useEffect(() => {
    const validImageId = `http://localhost:5173/${activePatient.file}`;
    if (elementRef.current) {
      cornerstone.loadImage(validImageId).then(image => {
        cornerstone.displayImage(elementRef.current, image);
        setImageId(validImageId);
        
        const viewport = cornerstone.getViewport(elementRef.current);
        viewport.translation.x = 0;
        viewport.translation.y = 0;
        viewport.scale = 1.5;
        cornerstone.setViewport(elementRef.current, viewport);
      }).catch(err => console.error("Could not load image file. Check the public folder.", err));
    }
  }, [activePatient]);

  // Apply Hand Pan/Zoom
  useEffect(() => {
    if (elementRef.current && imageId) {
      const viewport = cornerstone.getViewport(elementRef.current);
      if(viewport) {
        viewport.translation.x = pan.x;
        viewport.translation.y = pan.y;
        viewport.scale = zoomLevel; 
        cornerstone.setViewport(elementRef.current, viewport);
      }
    }
  }, [pan, zoomLevel, imageId]);

  const calculateDistance = (p1, p2) => {
    const rawPixels = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    return (rawPixels * 2.5).toFixed(1); 
  };

  return (
    <div style={{ position: 'relative', width: '600px', height: '600px', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
      
      {/* The Medical Image */}
      <div ref={elementRef} style={{ width: '100%', height: '100%', backgroundColor: '#000' }}></div>
      
      {/* The Overlay & Builder Layer */}
      <svg 
        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'all', zIndex: 10, cursor: 'crosshair' }}
        onMouseDown={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * 100;
          const y = ((e.clientY - rect.top) / rect.height) * 100;
          setDrawStart({ x, y });
          setIsDrawing(true);
          setTempBox({ x, y, width: 0, height: 0 });
        }}
        onMouseMove={(e) => {
          if (!isDrawing) return;
          const rect = e.currentTarget.getBoundingClientRect();
          const currentX = ((e.clientX - rect.left) / rect.width) * 100;
          const currentY = ((e.clientY - rect.top) / rect.height) * 100;
          
          setTempBox({
            x: Math.min(drawStart.x, currentX),
            y: Math.min(drawStart.y, currentY),
            width: Math.abs(currentX - drawStart.x),
            height: Math.abs(currentY - drawStart.y)
          });
        }}
        onMouseUp={() => {
          setIsDrawing(false);
          console.log(`%c COPY THIS FOR YOUR DATABASE:`, 'color: #10B981; font-weight: bold; font-size: 14px;');
          console.log(`tumorBox: { x: ${tempBox.x.toFixed(1)}, y: ${tempBox.y.toFixed(1)}, width: ${tempBox.width.toFixed(1)}, height: ${tempBox.height.toFixed(1)} }`);
        }}
      >
        
        {/* TEMPORARY BUILDER BOX */}
        {tempBox && (
          <rect 
            x={`${tempBox.x}%`} y={`${tempBox.y}%`} 
            width={`${tempBox.width}%`} height={`${tempBox.height}%`} 
            fill="rgba(56, 189, 248, 0.3)" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4,4" 
          />
        )}

        {/* AI DIAGNOSTIC OVERLAY */}
        {diagnosticMode && (
          <>
            {!activePatient.hasTumor && (
              <text x="20" y="40" fill="#10B981" fontSize="16" fontWeight="bold">✓ AI Scan: No Anomalies Detected</text>
            )}

            {activePatient.hasTumor && anomalyBox && (
              <>
                <rect 
                  x={`${anomalyBox.x}%`} y={`${anomalyBox.y}%`} 
                  width={`${anomalyBox.width}%`} height={`${anomalyBox.height}%`} 
                  fill={isHoveringAnomaly ? "rgba(239, 68, 68, 0.2)" : "transparent"} 
                  stroke="#EF4444" strokeWidth="2" strokeDasharray="5,5" 
                />
                
                {isHoveringAnomaly && (
                  <foreignObject x={`${anomalyBox.x + anomalyBox.width + 2}%`} y={`${anomalyBox.y}%`} width="200" height="100">
                    <div style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #EF4444', borderRadius: '8px', padding: '10px', color: 'white', fontFamily: 'sans-serif' }}>
                      <div style={{ fontSize: '12px', color: '#EF4444', fontWeight: 'bold' }}>AI DETECTION</div>
                      <div style={{ fontSize: '14px' }}>Suspected Lesion</div>
                      <div style={{ fontSize: '11px', color: '#94a3b8' }}>Confidence: <span style={{ color: '#10B981' }}>{activePatient.confidence}</span></div>
                    </div>
                  </foreignObject>
                )}
              </>
            )}
          </>
        )}

        {/* HAND CURSOR & RULER */}
        <circle cx={`${cursorPos.x}%`} cy={`${cursorPos.y}%`} r="15" fill="none" stroke="rgba(245, 158, 11, 0.6)" strokeWidth="2" strokeDasharray="4 2" />
        <line x1={`${cursorPos.x - 5}%`} y1={`${cursorPos.y}%`} x2={`${cursorPos.x + 5}%`} y2={`${cursorPos.y}%`} stroke="#F59E0B" strokeWidth="2" />
        <line x1={`${cursorPos.x}%`} y1={`${cursorPos.y - 5}%`} x2={`${cursorPos.x}%`} y2={`${cursorPos.y + 5}%`} stroke="#F59E0B" strokeWidth="2" />

        {pins[0] && <circle cx={`${pins[0].x}%`} cy={`${pins[0].y}%`} r="6" fill="#F59E0B" filter="drop-shadow(0px 0px 5px #F59E0B)" />}
        {pins[1] && (
          <>
            <circle cx={`${pins[1].x}%`} cy={`${pins[1].y}%`} r="6" fill="#10B981" filter="drop-shadow(0px 0px 5px #10B981)" />
            <line x1={`${pins[0].x}%`} y1={`${pins[0].y}%`} x2={`${pins[1].x}%`} y2={`${pins[1].y}%`} stroke="#F59E0B" strokeWidth="3" strokeDasharray="8 4" />
            <rect x={`${(pins[0].x + pins[1].x) / 2 - 8}%`} y={`${(pins[0].y + pins[1].y) / 2 - 4}%`} width="16%" height="8%" rx="5" fill="rgba(0,0,0,0.8)" stroke="#F59E0B" />
            <text x={`${(pins[0].x + pins[1].x) / 2}%`} y={`${(pins[0].y + pins[1].y) / 2 + 1.5}%`} fill="#fff" fontSize="16" fontWeight="bold" textAnchor="middle">
              {calculateDistance(pins[0], pins[1])} mm
            </text>
          </>
        )}
      </svg>
    </div>
  );
};

export default DicomViewer;