import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

let handLandmarker = undefined;

export const createHandLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.0/wasm"
  );
  
  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU"
    },
    runningMode: "VIDEO",
    numHands: 1
  });
  
  return handLandmarker;
};

export const predictWebcam = async (video, callback) => {
  if (!handLandmarker) return;

  let startTimeMs = performance.now();
  const results = handLandmarker.detectForVideo(video, startTimeMs);
  
  if (results.landmarks && results.landmarks.length > 0) {
    const landmarks = results.landmarks[0]; 
    
    // Key Points
    const wrist = landmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];
    const middleTip = landmarks[12];
    const ringTip = landmarks[16];
    const pinkyTip = landmarks[20];
    
    // Calculate pinch distances
    const indexDist = Math.sqrt(Math.pow(thumbTip.x - indexTip.x, 2) + Math.pow(thumbTip.y - indexTip.y, 2));
    const middleDist = Math.sqrt(Math.pow(thumbTip.x - middleTip.x, 2) + Math.pow(thumbTip.y - middleTip.y, 2));
    const ringDist = Math.sqrt(Math.pow(thumbTip.x - ringTip.x, 2) + Math.pow(thumbTip.y - ringTip.y, 2));
    const pinkyDist = Math.sqrt(Math.pow(thumbTip.x - pinkyTip.x, 2) + Math.pow(thumbTip.y - pinkyTip.y, 2)); 

    callback({ 
      indexDist, middleDist, ringDist, pinkyDist, 
      x: wrist.x, y: wrist.y,
      landmarks // Send the raw points to draw the colorful dots
    });
  } else {
    callback(null); 
  }
  
  requestAnimationFrame(() => predictWebcam(video, callback));
};