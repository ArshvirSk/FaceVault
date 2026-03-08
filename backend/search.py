import faiss
import numpy as np
from typing import List, Tuple

class FaceSearch:
    def __init__(self, dimension: int = 512):
        self.dimension = dimension
        self.index = faiss.IndexFlatL2(dimension)
        self.face_ids = []
    
    def build_index(self, embeddings: List[np.ndarray], face_ids: List[int]):
        """Build FAISS index from embeddings"""
        if len(embeddings) == 0:
            return
        
        embeddings_array = np.array(embeddings).astype('float32')
        self.index = faiss.IndexFlatL2(self.dimension)
        self.index.add(embeddings_array)
        self.face_ids = face_ids
    
    def search(self, query_embedding: np.ndarray, k: int = 10) -> List[Tuple[int, float]]:
        """
        Search for similar faces
        Returns list of (face_id, distance) tuples
        """
        if self.index.ntotal == 0:
            return []
        
        query = query_embedding.reshape(1, -1).astype('float32')
        distances, indices = self.index.search(query, min(k, self.index.ntotal))
        
        results = []
        for idx, dist in zip(indices[0], distances[0]):
            if idx < len(self.face_ids):
                results.append((self.face_ids[idx], float(dist)))
        
        return results
