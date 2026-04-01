# Touchless Radiology Interface: AI-Powered Gesture Control

## 📋 Project Overview
[cite_start]This project is a sterile, touchless Human-Computer Interaction (HCI) system designed for radiological imaging. [cite: 6, 9] [cite_start]It allows surgeons and radiologists to manipulate medical scans (X-Rays/MRIs) using hand gestures via a standard webcam, maintaining 100% sterility in clinical environments. [cite: 6, 8]

## ✨ Key Features
* [cite_start]**Touchless Navigation:** Uses MediaPipe to track 21 3D hand landmarks for real-time control. [cite: 12, 18, 19]
* [cite_start]**Gesture State Machine:** * Index Pinch -> **Pan** 
    * [cite_start]Middle Pinch -> **Zoom** 
    * [cite_start]Pinky Pinch -> **Digital Ruler/Measurement** 
* [cite_start]**AI Diagnostic Overlay:** Simulated CNN detection of anomalies with confidence scoring. 
* [cite_start]**Gemini LLM Assistant:** Generates professional radiological reports based on manual measurements and UI telemetry. 

## 🛠️ Tech Stack
* [cite_start]**Frontend:** React.js [cite: 12, 20]
* [cite_start]**Computer Vision:** MediaPipe (WASM) 
* [cite_start]**Generative AI:** Gemini 2.5 API 
* [cite_start]**Imaging:** HTML5 Canvas & SVG Overlay [cite: 12, 28]

## 🚀 How to Run
1. Clone the repository.
2. Run `npm install`.
3. Start the development server with `npm run dev`.