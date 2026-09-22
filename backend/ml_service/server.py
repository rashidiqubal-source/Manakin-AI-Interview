import os
import sys
import time
import base64
import logging
from contextlib import asynccontextmanager
from typing import List, Optional
import numpy as np
import cv2
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from ultralytics import YOLO
from huggingface_hub import hf_hub_download

# Configure Logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("YOLO26-Proctor")

# Global model holders
face_model: Optional[YOLO] = None
object_model: Optional[YOLO] = None

def load_models():
    global face_model, object_model
    logger.info("Initializing YOLO26 vision models...")
    
    # 1. Load YOLO26 General / Object / Phone Detector
    try:
        logger.info("Loading YOLO26 Nano Object Model (yolo26n.pt)...")
        object_model = YOLO("yolo26n.pt")
        # Warmup
        dummy = np.zeros((240, 320, 3), dtype=np.uint8)
        object_model.predict(dummy, verbose=False, imgsz=320)
        logger.info("YOLO26 Object Model loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load YOLO26 object model: {e}")
        object_model = None

    # 2. Load YOLO26 Face Detector
    try:
        logger.info("Loading YOLO26 Face Model (yolo26_widerdataset.pt)...")
        face_path = hf_hub_download(
            repo_id="Shubham12864/YOLO26n-face",
            filename="yolo26_widerdataset.pt"
        )
        face_model = YOLO(face_path)
        # Warmup
        dummy = np.zeros((240, 320, 3), dtype=np.uint8)
        face_model.predict(dummy, verbose=False, imgsz=320)
        logger.info("YOLO26 Face Model loaded successfully.")
    except Exception as e:
        logger.error(f"Failed to load YOLO26 face model from HF, fallback to standard model: {e}")
        face_model = object_model

@asynccontextmanager
async def lifespan(app: FastAPI):
    load_models()
    yield

app = FastAPI(title="YOLO26 Proctoring Service", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class DetectionRequest(BaseModel):
    image: str
    runFace: Optional[bool] = True
    runObject: Optional[bool] = True
    confFace: Optional[float] = 0.25
    confObject: Optional[float] = 0.15

class BoundingBox(BaseModel):
    x: int
    y: int
    width: int
    height: int
    confidence: float

class ObjectDetectionBox(BoundingBox):
    class_name: str = Field(..., alias="class")

    class Config:
        populate_by_name = True

@app.get("/health")
def health_check():
    face_ready = face_model is not None
    object_ready = object_model is not None
    return {
        "status": "ready" if (face_ready and object_ready) else "initializing",
        "faceModel": face_ready,
        "objectModel": object_ready,
        "engine": "YOLO26",
        "version": "8.4.x"
    }

def decode_base64_image(base64_str: str) -> np.ndarray:
    if not base64_str:
        raise ValueError("Empty image data")
    
    # Strip data URI header if present
    if "," in base64_str:
        base64_str = base64_str.split(",", 1)[1]
        
    img_bytes = base64.b64decode(base64_str)
    nparr = np.frombuffer(img_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    if img is None:
        raise ValueError("Failed to decode image buffer")
    return img

@app.post("/detect")
def detect_all(req: DetectionRequest):
    start_time = time.time()
    
    try:
        t0 = time.time()
        img = decode_base64_image(req.image)
        orig_h, orig_w = img.shape[:2]
        decode_time_ms = round((time.time() - t0) * 1000, 2)
    except Exception as e:
        logger.error(f"Image decode failed: {e}")
        return {
            "success": False,
            "timestamp": int(time.time() * 1000),
            "processingTimeMs": 0,
            "faces": [],
            "objects": [],
            "error": f"Invalid image: {str(e)}"
        }

    faces_result = []
    face_inference_time_ms = 0.0

    # 1. Face Detection
    if req.runFace and face_model is not None:
        t0 = time.time()
        try:
            results = face_model.predict(img, conf=req.confFace or 0.25, imgsz=320, verbose=False)
            if results and len(results) > 0:
                boxes = results[0].boxes
                for box in boxes:
                    xyxy = box.xyxy[0].cpu().numpy()
                    conf = float(box.conf[0].cpu().numpy())
                    x1, y1, x2, y2 = xyxy
                    
                    x = max(0, int(round(x1)))
                    y = max(0, int(round(y1)))
                    w = min(orig_w - x, int(round(x2 - x1)))
                    h = min(orig_h - y, int(round(y2 - y1)))
                    
                    faces_result.append({
                        "x": x,
                        "y": y,
                        "width": w,
                        "height": h,
                        "confidence": round(conf, 2)
                    })
        except Exception as e:
            logger.error(f"Face inference error: {e}")
        face_inference_time_ms = round((time.time() - t0) * 1000, 2)

    # 2. Object & Phone Detection
    objects_result = []
    object_inference_time_ms = 0.0

    if req.runObject and object_model is not None:
        t0 = time.time()
        try:
            results = object_model.predict(img, conf=req.confObject or 0.15, imgsz=320, verbose=False)
            if results and len(results) > 0:
                boxes = results[0].boxes
                names = object_model.names
                for box in boxes:
                    cls_id = int(box.cls[0].cpu().numpy())
                    cls_name = names.get(cls_id, str(cls_id)).lower()
                    conf = float(box.conf[0].cpu().numpy())
                    xyxy = box.xyxy[0].cpu().numpy()
                    x1, y1, x2, y2 = xyxy
                    
                    x = max(0, int(round(x1)))
                    y = max(0, int(round(y1)))
                    w = min(orig_w - x, int(round(x2 - x1)))
                    h = min(orig_h - y, int(round(y2 - y1)))
                    
                    # Normalize common class names
                    if cls_name in ["cell phone", "phone"]:
                        cls_name = "cell phone"
                    
                    objects_result.append({
                        "class": cls_name,
                        "confidence": round(conf, 2),
                        "x": x,
                        "y": y,
                        "width": w,
                        "height": h
                    })
        except Exception as e:
            logger.error(f"Object inference error: {e}")
        object_inference_time_ms = round((time.time() - t0) * 1000, 2)

    total_processing_ms = round((time.time() - start_time) * 1000, 2)

    return {
        "success": True,
        "timestamp": int(time.time() * 1000),
        "processingTimeMs": total_processing_ms,
        "decodeTimeMs": decode_time_ms,
        "faceInferenceTimeMs": face_inference_time_ms,
        "objectInferenceTimeMs": object_inference_time_ms,
        "faces": faces_result,
        "objects": objects_result
    }

if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("YOLO26_PORT", 5001))
    host = os.environ.get("YOLO26_HOST", "127.0.0.1")
    logger.info(f"Starting YOLO26 FastAPI server on {host}:{port}")
    uvicorn.run(app, host=host, port=port, log_level="warning")
