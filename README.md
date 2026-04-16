# Touchless Radiology Interface: AI-Powered Gesture Control

## 📋 Project Overview
This project is a sterile, touchless Human-Computer Interaction (HCI) system designed for radiological imaging. It allows surgeons and radiologists to manipulate medical scans (X-Rays/MRIs) using hand gestures via a standard webcam, maintaining 100% sterility in clinical environments.

## ✨ Key Features
*  **Touchless Navigation:** Uses MediaPipe to track 21 3D hand landmarks for real-time control. 
*  **Gesture State Machine:** * Index Pinch -> **Pan** 
    *  Middle Pinch -> **Zoom** 
    *  Pinky Pinch -> **Digital Ruler/Measurement** 
*  **AI Diagnostic Overlay:** Simulated CNN detection of anomalies with confidence scoring. 
*  **Gemini LLM Assistant:** Generates professional radiological reports based on manual measurements and UI telemetry. 

## 🛠️ Tech Stack
*  **Frontend:** React.js 
*  **Computer Vision:** MediaPipe (WASM) 
*  **Generative AI:** Gemini 2.5 API 
*  **Imaging:** HTML5 Canvas & SVG Overlay

## 🚀 How to Run
1. Clone the repository.
2. Run `npm install`.
3. Start the development server with `npm run dev`.
