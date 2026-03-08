import numpy as np
from typing import List

class Embedder:
    """
    Embedder is handled by InsightFace in detector.py
    This class provides utility functions for embedding operations
    """
    
    @staticmethod
    def cosine_similarity(emb1: np.ndarray, emb2: np.ndarray) -> float:
        """Calculate cosine similarity between two embeddings"""
        return np.dot(emb1, emb2) / (np.linalg.norm(emb1) * np.linalg.norm(emb2))
    
    @staticmethod
    def normalize_embedding(embedding: np.ndarray) -> np.ndarray:
        """Normalize embedding to unit length"""
        return embedding / np.linalg.norm(embedding)
