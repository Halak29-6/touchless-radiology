import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

let handLandmarker = undefined;
let animationFrameId = null;

export const createHandLandmarker = async () => {
  const vision = await FilesetResolver.forVisionTasks(
    "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.32/wasm"
  );

  handLandmarker = await HandLandmarker.createFromOptions(vision, {
    baseOptions: {
      modelAssetPath: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`,
      delegate: "GPU",
    },
    runningMode: "VIDEO",
    numHands: 1,
  });

  return handLandmarker;
};

export const predictWebcam = (video, callback) => {
  if (!handLandmarker) return () => { };

  const loop = () => {
    const startTimeMs = performance.now();
    const results = handLandmarker.detectForVideo(video, startTimeMs);

    if (results.landmarks && results.landmarks.length > 0) {
      const landmarks = results.landmarks[0];

      const thumbTip = landmarks[4];
      const indexMCP = landmarks[5];
      const indexTip = landmarks[8];
      const middleTip = landmarks[12];
      const ringTip = landmarks[16];
      const pinkyTip = landmarks[20];

      const dist3D = (a, b) =>
        Math.sqrt(
          Math.pow(a.x - b.x, 2) +
          Math.pow(a.y - b.y, 2) +
          Math.pow((a.z - b.z) * 0.5, 2)
        );

      const indexDist = dist3D(thumbTip, indexTip);
      const middleDist = dist3D(thumbTip, middleTip);
      const ringDist = dist3D(thumbTip, ringTip);
      const pinkyDist = dist3D(thumbTip, pinkyTip);

      callback({
        indexDist,
        middleDist,
        ringDist,
        pinkyDist,
        x: indexMCP.x,
        y: indexMCP.y,
        landmarks,
      });
    } else {
      callback(null);
    }

    animationFrameId = requestAnimationFrame(loop);
  };

  animationFrameId = requestAnimationFrame(loop)
  return () => {
    if (animationFrameId) cancelAnimationFrame(animationFrameId);
  };
};
