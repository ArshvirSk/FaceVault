import cv2
import numpy as np
from insightface.app import FaceAnalysis
from typing import List, Tuple, Optional

class FaceDetector:
    def __init__(self, model_name: str = 'buffalo_l'):
        """
        Initialize face detector with specified model
        
        Args:
            model_name: InsightFace model pack name
                - 'buffalo_l': Best accuracy (default, ~600MB)
                - 'buffalo_s': Smaller, faster (~300MB)
                - 'buffalo_sc': Super compact (~100MB)
        """
        self.app = FaceAnalysis(name=model_name, providers=['CPUExecutionProvider'])
        self.app.prepare(ctx_id=0, det_size=(640, 640))
    
    def detect_faces(self, image_path: str) -> List[dict]:
        """
        Detect faces in image
        Returns list of dicts with bbox and embedding
        """
        img = cv2.imread(image_path)
        if img is None:
            return []
        
        faces = self.app.get(img)
        
        results = []
        for face in faces:
            bbox = face.bbox.astype(int)
            x, y, x2, y2 = bbox
            w, h = x2 - x, y2 - y
            
            results.append({
                'bbox': (int(x), int(y), int(w), int(h)),
                'embedding': face.embedding,
                'confidence': float(face.det_score)
            })
        
        return results
