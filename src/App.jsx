import React, { useEffect, useRef, useState } from 'react';
import DicomViewer from './components/DicomViewer';
import { createHandLandmarker, predictWebcam } from './utils/mediaPipeHelper';

// === THE PATIENT DATABASE ===
const PATIENT_DATABASE = [
  {
    id: "P-001",
    name: "Case A: Suspected Meningioma",
    file: "tumor-1.jpg", 
    hasTumor: true,
    tumorBox: { x: 55, y:20, width: 20, height: 20 }, 
    confidence: "94.2%"
  },
  {
    id: "P-002",
    name: "Case B: Frontal Lobe Mass",
    file: "tumor-2.jpg",
    hasTumor: true,
    tumorBox: { x: 30, y: 20, width: 20, height: 20 },
    confidence: "89.7%"
  },
  {
    id: "P-003",
    name: "Case C: Routine Scan (Healthy)",
    file: "healthy.jpg",
    hasTumor: false,
    tumorBox: null,
    confidence: "N/A"
  }
];

function App() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  
  // App States
  const [status, setStatus] = useState("Initializing AI Core...");
  const [activeTool, setActiveTool] = useState("none"); 
  const [diagnosticMode, setDiagnosticMode] = useState(true);
  const [activePatient, setActivePatient] = useState(PATIENT_DATABASE[0]);
  
  // Physics States
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1.5);
  const [cursorPos, setCursorPos] = useState({ x: 50, y: 50 }); 
  const [pins, setPins] = useState([]); 

  // === NEW: GEMINI LLM STATES ===
  const [llmReport, setLlmReport] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const smoothPos = useRef({ x: null, y: null }); 
  const lastPos = useRef(null); 
  const isPinkyDown = useRef(false); 

  // === NEW: GEMINI API CALL ===
  const generateClinicalReport = async () => {
    setIsGenerating(true);
    setLlmReport("");
    
    // ⚠️ REPLACE THIS STRING WITH YOUR ACTUAL GEMINI API KEY
    const apiKey = "AIzaSyBfc0jMwriUmIb2wvNCddeHRpNfHIhANes"
    
    // Calculate distance if pins exist
    let distance = "No manual measurements taken.";
    if (pins.length === 2) {
      const rawPixels = Math.sqrt(Math.pow(pins[1].x - pins[0].x, 2) + Math.pow(pins[1].y - pins[0].y, 2));
      distance = (rawPixels * 2.5).toFixed(1); 
    }
    
    const promptText = `
      Analyze the following telemetry from the Touchless Radiology Interface:
      - Patient ID: ${activePatient.id}
      - Presenting Scan: ${activePatient.name}
      - CNN Diagnostic Overlay: ${activePatient.hasTumor ? `Detected anomaly with ${activePatient.confidence} confidence.` : "No anomalies detected."}
      - Surgeon's Manual Measurement: ${distance}${distance !== "No manual measurements taken." ? "mm" : ""}
      
      Draft a concise, professional, 3-sentence preliminary radiological findings report based on this data. Address it as a formal medical note.
    `;

 try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }],
          systemInstruction: { parts: [{ text: "You are an expert AI Radiologist Assistant. You provide highly technical, professional, and concise clinical summaries." }] }
        })
      });
      
      const data = await response.json();
      
      // NEW: If Google sends an error, print it to the screen so we can see it!
      if (!response.ok) {
        console.error("Google API Error:", data);
        setLlmReport(`Google Error: ${data.error?.message || "Check console"}`);
        setIsGenerating(false);
        return;
      }

      if (data.candidates && data.candidates.length > 0) {
        setLlmReport(data.candidates[0].content.parts[0].text);
      } else {
        setLlmReport("Error: Google returned an empty response.");
      }
    } catch (err) {
      console.error("Network Error:", err);
      setLlmReport(`Network Error: ${err.message}. Check your internet or CORS.`);
    }
  };

  useEffect(() => {
    const startSystem = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.addEventListener("loadeddata", () => {
            createHandLandmarker().then(() => {
              setStatus("System Ready. Waiting for Hand...");
              
              predictWebcam(videoRef.current, (result) => {
                const canvas = canvasRef.current;
                const video = videoRef.current;
                
                if (result !== null) {
                  if (smoothPos.current.x === null) {
                    smoothPos.current = { x: result.x, y: result.y };
                  } else {
                    smoothPos.current.x += (result.x - smoothPos.current.x) * 0.15; 
                    smoothPos.current.y += (result.y - smoothPos.current.y) * 0.15;
                  }

                  const currentX = smoothPos.current.x;
                  const currentY = smoothPos.current.y;
                  const PINCH_THRESHOLD = 0.06; 
                  
                  setCursorPos({ x: currentX * 100, y: currentY * 100 });

                  let dotColor = "#10B981"; 
                  let currentTool = "none";

                  if (result.pinkyDist < PINCH_THRESHOLD) {
                    setStatus("Dropping Measurement Pin...");
                    currentTool = "ruler";
                    dotColor = "#F59E0B"; 
                    if (!isPinkyDown.current) {
                      isPinkyDown.current = true; 
                      setPins(prev => {
                        if (prev.length >= 2) return [{ x: currentX * 100, y: currentY * 100 }]; 
                        return [...prev, { x: currentX * 100, y: currentY * 100 }];
                      });
                    }
                  } else {
                    isPinkyDown.current = false; 
                  }

                  if (result.ringDist < PINCH_THRESHOLD) {
                    setStatus("Resetting Viewport...");
                    currentTool = "reset";
                    dotColor = "#EF4444"; 
                    setPan({ x: 0, y: 0 }); 
                    setZoom(1.5);           
                    setPins([]); 
                    lastPos.current = null;
                  }
                  else if (result.indexDist < PINCH_THRESHOLD && result.middleDist > PINCH_THRESHOLD) {
                    setStatus("Dragging Image...");
                    currentTool = "pan";
                    dotColor = "#3B82F6"; 
                    if (lastPos.current) {
                      const dx = -(currentX - lastPos.current.x) * 1200; 
                      const dy = (currentY - lastPos.current.y) * 1200;
                      setPan(prev => ({ x: prev.x + dx, y: prev.y + dy }));
                    }
                    lastPos.current = { x: currentX, y: currentY };
                  } 
                  else if (result.middleDist < PINCH_THRESHOLD && result.indexDist > PINCH_THRESHOLD) {
                    setStatus("Zooming Image...");
                    currentTool = "zoom";
                    dotColor = "#8B5CF6"; 
                    if (lastPos.current) {
                      const dy = (currentY - lastPos.current.y);
                      setZoom(prev => Math.max(0.5, Math.min(prev - (dy * 5), 5.0))); 
                    }
                    lastPos.current = { x: currentX, y: currentY };
                  } 
                  else if (result.pinkyDist >= PINCH_THRESHOLD) {
                    setStatus("Tracking: Open Hand");
                    currentTool = "none";
                    lastPos.current = null; 
                  }

                  setActiveTool(currentTool);

                  if (canvas && video) {
                    canvas.width = video.videoWidth;
                    canvas.height = video.videoHeight;
                    const ctx = canvas.getContext("2d");
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    
                    const keyPoints = [0, 4, 8, 12, 16, 20]; 
                    result.landmarks.forEach((point, index) => {
                      if (keyPoints.includes(index)) {
                        const px = point.x * canvas.width;
                        const py = point.y * canvas.height;
                        ctx.beginPath();
                        ctx.arc(px, py, 5, 0, 2 * Math.PI); 
                        ctx.fillStyle = dotColor;       
                        ctx.fill();
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = "rgba(255,255,255,0.8)";          
                        ctx.stroke();
                      }
                    });
                  }
                } else {
                  setStatus("No Signal. Waiting for Hand...");
                  setActiveTool("none");
                  lastPos.current = null;
                  smoothPos.current = { x: null, y: null };
                  if (canvas) canvas.getContext("2d").clearRect(0, 0, canvas.width, canvas.height);
                }
              });
            });
          });
        }
      } catch (err) {
        setStatus("Camera Connection Failed.");
      }
    };
    startSystem();
  }, []); 

  const theme = { bg: "#0f172a", panel: "rgba(30, 41, 59, 0.7)", text: "#f8fafc", accent: "#38bdf8", border: "rgba(255, 255, 255, 0.1)" };

  const handlePatientChange = (patient) => {
    setActivePatient(patient);
    setPan({ x: 0, y: 0 });
    setZoom(1.5);
    setPins([]);
    setLlmReport(""); // Clear report on patient change
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: theme.bg, color: theme.text, fontFamily: "'Segoe UI', Roboto, Helvetica, sans-serif", padding: '20px', display: 'flex', flexDirection: 'column' }}>
      
      <header style={{ borderBottom: `1px solid ${theme.border}`, paddingBottom: '15px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '600', letterSpacing: '1px' }}>
          <span style={{ color: theme.accent }}>HCI</span> Radiology Interface
        </h1>
        <div style={{ backgroundColor: activeTool !== 'none' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)', padding: '8px 16px', borderRadius: '20px', border: `1px solid ${activeTool !== 'none' ? '#10B981' : '#EF4444'}` }}>
          <span style={{ color: activeTool !== 'none' ? '#10B981' : '#EF4444', fontWeight: 'bold', fontSize: '14px' }}>● {status}</span>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '30px', flex: 1 }}>
        <div style={{ width: '320px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ backgroundColor: theme.panel, borderRadius: '16px', padding: '15px', border: `1px solid ${theme.border}` }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase' }}>Select Patient</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {PATIENT_DATABASE.map(patient => (
                <button 
                  key={patient.id}
                  onClick={() => handlePatientChange(patient)}
                  style={{
                    padding: '10px', textAlign: 'left', borderRadius: '8px', cursor: 'pointer',
                    backgroundColor: activePatient.id === patient.id ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                    border: `1px solid ${activePatient.id === patient.id ? theme.accent : theme.border}`,
                    color: theme.text, transition: '0.2s'
                  }}
                >
                  <div style={{ fontWeight: 'bold', fontSize: '13px' }}>{patient.id}</div>
                  <div style={{ fontSize: '12px', color: '#cbd5e1' }}>{patient.name}</div>
                </button>
              ))}
            </div>
          </div>

          <div style={{ backgroundColor: theme.panel, borderRadius: '16px', padding: '15px', border: `1px solid ${theme.border}` }}>
            <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#94a3b8', textTransform: 'uppercase' }}>Sensor Feed</h3>
            <div style={{ position: 'relative', width: '100%', aspectRatio: '4/3', backgroundColor: 'black', borderRadius: '8px', overflow: 'hidden' }}>
              <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
              <canvas ref={canvasRef} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', transform: 'scaleX(-1)', pointerEvents: 'none' }} />
            </div>
          </div>

          <div style={{ backgroundColor: theme.panel, borderRadius: '16px', padding: '20px', border: `1px solid ${theme.border}` }}>
            <button 
              onClick={() => setDiagnosticMode(!diagnosticMode)}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px', transition: '0.3s',
                backgroundColor: diagnosticMode ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                border: `1px solid ${diagnosticMode ? '#EF4444' : theme.border}`, color: diagnosticMode ? '#EF4444' : theme.text,
                marginBottom: '15px'
              }}
            >
              {diagnosticMode ? '🔴 Disable AI Overlay' : '⚪ Enable AI Assist'}
            </button>

            {/* === NEW: GEMINI BUTTON === */}
            <button 
              onClick={generateClinicalReport}
              disabled={isGenerating}
              style={{
                width: '100%', padding: '12px', borderRadius: '8px', cursor: isGenerating ? 'wait' : 'pointer', fontWeight: 'bold', fontSize: '14px', transition: '0.3s',
                backgroundColor: 'rgba(139, 92, 246, 0.2)', border: '1px solid #8B5CF6', color: '#C4B5FD',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
              }}
            >
              ✨ {isGenerating ? 'Analyzing Case...' : 'Generate Clinical Report'}
            </button>
          </div>
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          <div style={{ flex: 1, backgroundColor: '#000', borderRadius: '16px', border: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <DicomViewer pan={pan} zoomLevel={zoom} cursorPos={cursorPos} pins={pins} diagnosticMode={diagnosticMode} activePatient={activePatient} />
          </div>

          {/* === NEW: GEMINI OUTPUT PANEL === */}
          {llmReport && (
            <div style={{ 
              backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid #8B5CF6', borderRadius: '12px', 
              padding: '20px', color: '#E2E8F0', animation: 'fadeIn 0.5s ease-in-out'
            }}>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#C4B5FD', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ✨ Gemini Clinical Analysis
              </h3>
              <p style={{ margin: 0, lineHeight: '1.6', fontSize: '14px' }}>{llmReport}</p>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default App;