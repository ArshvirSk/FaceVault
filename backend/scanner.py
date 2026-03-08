import os
import hashlib
from pathlib import Path
from typing import List

SUPPORTED_FORMATS = {'.jpg', '.jpeg', '.png', '.webp'}

class Scanner:
    @staticmethod
    def scan_folder(folder_path: str) -> List[str]:
        """Recursively scan folder for image files"""
        image_files = []
        folder = Path(folder_path)
        
        if not folder.exists():
            raise ValueError(f"Folder does not exist: {folder_path}")
        
        for file_path in folder.rglob('*'):
            if file_path.is_file() and file_path.suffix.lower() in SUPPORTED_FORMATS:
                image_files.append(str(file_path.absolute()))
        
        return image_files
    
    @staticmethod
    def compute_hash(file_path: str) -> str:
        """Compute SHA256 hash of file"""
        sha256_hash = hashlib.sha256()
        with open(file_path, "rb") as f:
            for byte_block in iter(lambda: f.read(4096), b""):
                sha256_hash.update(byte_block)
        return sha256_hash.hexdigest()
