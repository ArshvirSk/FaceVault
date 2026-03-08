import numpy as np
from sklearn.cluster import DBSCAN
from typing import List, Dict, Tuple
import hdbscan

class FaceClusterer:
    def __init__(self, min_cluster_size: int = 2, min_samples: int = 1):
        """
        Initialize face clusterer
        
        Args:
            min_cluster_size: Minimum faces to form a cluster (default 2, was 3)
            min_samples: Minimum samples in neighborhood (default 1 for single faces)
        """
        self.min_cluster_size = min_cluster_size
        self.min_samples = min_samples
    
    def cluster_faces(self, embeddings: List[np.ndarray]) -> np.ndarray:
        """
        Cluster face embeddings using HDBSCAN with fallback for noise points
        Returns array of cluster labels
        """
        if len(embeddings) == 0:
            return np.array([])
        
        embeddings_array = np.array(embeddings)
        
        # Use HDBSCAN for clustering
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=self.min_cluster_size,
            min_samples=self.min_samples,
            metric='euclidean',
            cluster_selection_method='eom',
            allow_single_cluster=True
        )
        
        labels = clusterer.fit_predict(embeddings_array)
        
        # Handle noise points (-1 labels) by creating individual clusters
        max_label = labels.max() if len(labels) > 0 else -1
        next_label = max_label + 1
        
        for i in range(len(labels)):
            if labels[i] == -1:
                # Assign each noise point its own cluster
                labels[i] = next_label
                next_label += 1
        
        return labels
    
    def find_mergeable_clusters(self, cluster_embeddings: Dict[int, List[np.ndarray]], 
                                threshold: float = 0.6) -> List[Tuple[int, int]]:
        """
        Find clusters that should be merged based on average embedding similarity
        
        Args:
            cluster_embeddings: Dict mapping cluster_id to list of embeddings
            threshold: Cosine similarity threshold (0.6 = 60% similar)
        
        Returns:
            List of (cluster_id1, cluster_id2) tuples to merge
        """
        merge_pairs = []
        cluster_ids = list(cluster_embeddings.keys())
        
        # Calculate average embedding for each cluster
        cluster_centers = {}
        for cluster_id, embeddings in cluster_embeddings.items():
            if len(embeddings) > 0:
                cluster_centers[cluster_id] = np.mean(embeddings, axis=0)
        
        # Compare all pairs of clusters
        for i, cluster_id1 in enumerate(cluster_ids):
            for cluster_id2 in cluster_ids[i+1:]:
                if cluster_id1 in cluster_centers and cluster_id2 in cluster_centers:
                    # Calculate cosine similarity
                    center1 = cluster_centers[cluster_id1]
                    center2 = cluster_centers[cluster_id2]
                    
                    similarity = np.dot(center1, center2) / (
                        np.linalg.norm(center1) * np.linalg.norm(center2)
                    )
                    
                    if similarity >= threshold:
                        merge_pairs.append((cluster_id1, cluster_id2))
        
        return merge_pairs
