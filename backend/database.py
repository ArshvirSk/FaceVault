import sqlite3
import json
from typing import List, Optional, Tuple
import numpy as np
import bcrypt
import secrets as py_secrets

class Database:
    def __init__(self, db_path: str = "../data/facevault.db"):
        self.db_path = db_path
        self.init_db()
    
    def init_db(self):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Users table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                profile_photo_path TEXT,
                profile_face_embedding BLOB,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)
        
        # Albums table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS albums (
                album_id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                folder_path TEXT,
                admin_user_id INTEGER,
                privacy_mode TEXT DEFAULT 'public',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (admin_user_id) REFERENCES users(user_id)
            )
        """)
        
        # Album members junction table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS album_members (
                album_id INTEGER,
                user_id INTEGER,
                added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (album_id, user_id),
                FOREIGN KEY (album_id) REFERENCES albums(album_id) ON DELETE CASCADE,
                FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
            )
        """)
        
        # Album invite links table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS album_invites (
                invite_id INTEGER PRIMARY KEY AUTOINCREMENT,
                album_id INTEGER NOT NULL,
                invite_token TEXT UNIQUE NOT NULL,
                created_by INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                expires_at DATETIME,
                max_uses INTEGER,
                use_count INTEGER DEFAULT 0,
                is_active INTEGER DEFAULT 1,
                FOREIGN KEY (album_id) REFERENCES albums(album_id) ON DELETE CASCADE,
                FOREIGN KEY (created_by) REFERENCES users(user_id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS photos (
                photo_id INTEGER PRIMARY KEY AUTOINCREMENT,
                album_id INTEGER,
                file_path TEXT UNIQUE NOT NULL,
                file_hash TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (album_id) REFERENCES albums(album_id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS persons (
                person_id INTEGER PRIMARY KEY AUTOINCREMENT,
                album_id INTEGER,
                cluster_id INTEGER,
                name TEXT,
                user_id INTEGER,
                FOREIGN KEY (album_id) REFERENCES albums(album_id),
                FOREIGN KEY (user_id) REFERENCES users(user_id)
            )
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS faces (
                face_id INTEGER PRIMARY KEY AUTOINCREMENT,
                photo_id INTEGER,
                person_id INTEGER,
                bbox_x INTEGER,
                bbox_y INTEGER,
                bbox_w INTEGER,
                bbox_h INTEGER,
                embedding BLOB,
                confidence REAL,
                FOREIGN KEY (photo_id) REFERENCES photos(photo_id),
                FOREIGN KEY (person_id) REFERENCES persons(person_id)
            )
        """)
        
        # Migration: Add album_id columns if they don't exist
        try:
            cursor.execute("SELECT album_id FROM photos LIMIT 1")
        except sqlite3.OperationalError:
            cursor.execute("ALTER TABLE photos ADD COLUMN album_id INTEGER")
            print("✓ Migrated photos table: added album_id column")
        
        try:
            cursor.execute("SELECT album_id FROM persons LIMIT 1")
        except sqlite3.OperationalError:
            cursor.execute("ALTER TABLE persons ADD COLUMN album_id INTEGER")
            print("✓ Migrated persons table: added album_id column")
        
        # Migration: Add multi-user columns
        try:
            cursor.execute("SELECT admin_user_id FROM albums LIMIT 1")
        except sqlite3.OperationalError:
            cursor.execute("ALTER TABLE albums ADD COLUMN admin_user_id INTEGER")
            print("✓ Migrated albums table: added admin_user_id column")
        
        try:
            cursor.execute("SELECT privacy_mode FROM albums LIMIT 1")
        except sqlite3.OperationalError:
            cursor.execute("ALTER TABLE albums ADD COLUMN privacy_mode TEXT DEFAULT 'public'")
            print("✓ Migrated albums table: added privacy_mode column")
        
        try:
            cursor.execute("SELECT user_id FROM persons LIMIT 1")
        except sqlite3.OperationalError:
            cursor.execute("ALTER TABLE persons ADD COLUMN user_id INTEGER")
            print("✓ Migrated persons table: added user_id column")
        
        conn.commit()
        conn.close()
    
    def add_album(self, name: str, folder_path: str, admin_user_id: Optional[int] = None) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO albums (name, folder_path, admin_user_id) VALUES (?, ?, ?)", 
                      (name, folder_path, admin_user_id))
        album_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return album_id
    
    def get_all_albums(self) -> List[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.album_id, a.name, a.folder_path, a.created_at,
                   COUNT(DISTINCT ph.photo_id) as photo_count,
                   COUNT(DISTINCT p.person_id) as person_count
            FROM albums a
            LEFT JOIN photos ph ON a.album_id = ph.album_id
            LEFT JOIN persons p ON a.album_id = p.album_id
            GROUP BY a.album_id
            ORDER BY a.created_at DESC
        """)
        albums = [{
            "album_id": row[0],
            "name": row[1],
            "folder_path": row[2],
            "created_at": row[3],
            "photo_count": row[4],
            "person_count": row[5]
        } for row in cursor.fetchall()]
        conn.close()
        return albums
    
    def add_photo(self, file_path: str, file_hash: str, album_id: Optional[int] = None) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO photos (file_path, file_hash, album_id) VALUES (?, ?, ?)", 
                      (file_path, file_hash, album_id))
        photo_id = cursor.lastrowid
        if photo_id == 0:
            cursor.execute("SELECT photo_id FROM photos WHERE file_path = ?", (file_path,))
            photo_id = cursor.fetchone()[0]
        conn.commit()
        conn.close()
        return photo_id
    
    def add_face(self, photo_id: int, bbox: Tuple[int, int, int, int], 
                 embedding: np.ndarray, confidence: float, person_id: Optional[int] = None) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        embedding_blob = embedding.tobytes()
        cursor.execute("""
            INSERT INTO faces (photo_id, person_id, bbox_x, bbox_y, bbox_w, bbox_h, embedding, confidence)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (photo_id, person_id, bbox[0], bbox[1], bbox[2], bbox[3], embedding_blob, confidence))
        face_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return face_id
    
    def add_person(self, cluster_id: int, name: Optional[str] = None, album_id: Optional[int] = None, 
                   user_id: Optional[int] = None) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        if name is None:
            name = f"Person_{cluster_id}"
        cursor.execute("INSERT INTO persons (cluster_id, name, album_id, user_id) VALUES (?, ?, ?, ?)", 
                      (cluster_id, name, album_id, user_id))
        person_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return person_id
    
    def update_face_person(self, face_id: int, person_id: int):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("UPDATE faces SET person_id = ? WHERE face_id = ?", (person_id, face_id))
        conn.commit()
        conn.close()
    
    def get_all_persons(self, album_id: Optional[int] = None, user_id: Optional[int] = None, 
                        privacy_mode: str = 'public') -> List[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        if album_id is not None:
            if privacy_mode == 'private' and user_id is not None:
                # Private mode: only show user's own person cluster
                cursor.execute("""
                    SELECT p.person_id, p.name, p.album_id, p.user_id, COUNT(DISTINCT f.photo_id) as photo_count
                    FROM persons p
                    INNER JOIN faces f ON p.person_id = f.person_id
                    WHERE p.album_id = ? AND p.user_id = ?
                    GROUP BY p.person_id
                    HAVING COUNT(DISTINCT f.photo_id) > 0
                """, (album_id, user_id))
            else:
                # Public mode: show all person clusters
                cursor.execute("""
                    SELECT p.person_id, p.name, p.album_id, p.user_id, COUNT(DISTINCT f.photo_id) as photo_count
                    FROM persons p
                    INNER JOIN faces f ON p.person_id = f.person_id
                    WHERE p.album_id = ?
                    GROUP BY p.person_id
                    HAVING COUNT(DISTINCT f.photo_id) > 0
                """, (album_id,))
        else:
            cursor.execute("""
                SELECT p.person_id, p.name, p.album_id, p.user_id, COUNT(DISTINCT f.photo_id) as photo_count
                FROM persons p
                INNER JOIN faces f ON p.person_id = f.person_id
                GROUP BY p.person_id
                HAVING COUNT(DISTINCT f.photo_id) > 0
            """)
        
        persons = [{"person_id": row[0], "name": row[1], "album_id": row[2], 
                   "user_id": row[3], "photo_count": row[4]} 
                  for row in cursor.fetchall()]
        conn.close()
        return persons
    
    def get_photos_for_person(self, person_id: int) -> List[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT ph.photo_id, ph.file_path
            FROM photos ph
            JOIN faces f ON ph.photo_id = f.photo_id
            WHERE f.person_id = ?
        """, (person_id,))
        photos = [{"photo_id": row[0], "file_path": row[1]} for row in cursor.fetchall()]
        conn.close()
        return photos
    
    def rename_person(self, person_id: int, new_name: str):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("UPDATE persons SET name = ? WHERE person_id = ?", (new_name, person_id))
        conn.commit()
        conn.close()
    
    def get_all_embeddings(self) -> Tuple[List[np.ndarray], List[int]]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT face_id, embedding FROM faces WHERE embedding IS NOT NULL")
        rows = cursor.fetchall()
        conn.close()
        
        face_ids = [row[0] for row in rows]
        embeddings = [np.frombuffer(row[1], dtype=np.float32) for row in rows]
        return embeddings, face_ids
    
    def get_person_thumbnail(self, person_id: int) -> Optional[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h, ph.file_path, ph.photo_id
            FROM faces f
            JOIN photos ph ON f.photo_id = ph.photo_id
            WHERE f.person_id = ?
            LIMIT 1
        """, (person_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {"bbox": (row[0], row[1], row[2], row[3]), "file_path": row[4], "photo_id": row[5]}
        return None

    # User management methods
    def create_user(self, username: str, password: str, profile_photo_path: Optional[str] = None, 
                    profile_face_embedding: Optional[np.ndarray] = None) -> int:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        password_hash = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        embedding_blob = profile_face_embedding.tobytes() if profile_face_embedding is not None else None
        cursor.execute("""
            INSERT INTO users (username, password_hash, profile_photo_path, profile_face_embedding)
            VALUES (?, ?, ?, ?)
        """, (username, password_hash, profile_photo_path, embedding_blob))
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return user_id
    
    def verify_user(self, username: str, password: str) -> Optional[int]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT user_id, password_hash FROM users WHERE username = ?", (username,))
        row = cursor.fetchone()
        conn.close()
        if row and bcrypt.checkpw(password.encode('utf-8'), row[1].encode('utf-8')):
            return row[0]
        return None
    
    def get_user_by_id(self, user_id: int) -> Optional[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT user_id, username, profile_photo_path, created_at
            FROM users WHERE user_id = ?
        """, (user_id,))
        row = cursor.fetchone()
        conn.close()
        if row:
            return {"user_id": row[0], "username": row[1], "profile_photo_path": row[2], "created_at": row[3]}
        return None
    
    def get_all_users(self) -> List[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT user_id, username, profile_photo_path, created_at FROM users")
        users = [{"user_id": row[0], "username": row[1], "profile_photo_path": row[2], "created_at": row[3]} 
                for row in cursor.fetchall()]
        conn.close()
        return users
    
    def get_user_profile_embedding(self, user_id: int) -> Optional[np.ndarray]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT profile_face_embedding FROM users WHERE user_id = ?", (user_id,))
        row = cursor.fetchone()
        conn.close()
        if row and row[0]:
            return np.frombuffer(row[0], dtype=np.float32)
        return None
    
    def update_user_profile_photo(self, user_id: int, profile_photo_path: str, 
                                   profile_face_embedding: np.ndarray):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        embedding_blob = profile_face_embedding.tobytes()
        cursor.execute("""
            UPDATE users SET profile_photo_path = ?, profile_face_embedding = ?
            WHERE user_id = ?
        """, (profile_photo_path, embedding_blob, user_id))
        conn.commit()
        conn.close()
    
    # Album membership methods
    def add_album_member(self, album_id: int, user_id: int):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("INSERT OR IGNORE INTO album_members (album_id, user_id) VALUES (?, ?)", 
                      (album_id, user_id))
        conn.commit()
        conn.close()
    
    def remove_album_member(self, album_id: int, user_id: int):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("DELETE FROM album_members WHERE album_id = ? AND user_id = ?", 
                      (album_id, user_id))
        conn.commit()
        conn.close()
    
    def get_album_members(self, album_id: int) -> List[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.user_id, u.username, u.profile_photo_path, am.added_at
            FROM album_members am
            JOIN users u ON am.user_id = u.user_id
            WHERE am.album_id = ?
        """, (album_id,))
        members = [{"user_id": row[0], "username": row[1], "profile_photo_path": row[2], "added_at": row[3]} 
                  for row in cursor.fetchall()]
        conn.close()
        return members
    
    def is_album_member(self, album_id: int, user_id: int) -> bool:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 1 FROM album_members WHERE album_id = ? AND user_id = ?
        """, (album_id, user_id))
        result = cursor.fetchone() is not None
        conn.close()
        return result
    
    def is_album_admin(self, album_id: int, user_id: int) -> bool:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("SELECT admin_user_id FROM albums WHERE album_id = ?", (album_id,))
        row = cursor.fetchone()
        conn.close()
        return row and row[0] == user_id
    
    def get_user_albums(self, user_id: int) -> List[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT a.album_id, a.name, a.folder_path, a.admin_user_id, a.privacy_mode, a.created_at,
                   COUNT(DISTINCT ph.photo_id) as photo_count,
                   COUNT(DISTINCT p.person_id) as person_count,
                   CASE WHEN a.admin_user_id = ? THEN 1 ELSE 0 END as is_admin
            FROM albums a
            LEFT JOIN album_members am ON a.album_id = am.album_id
            LEFT JOIN photos ph ON a.album_id = ph.album_id
            LEFT JOIN persons p ON a.album_id = p.album_id
            WHERE a.admin_user_id = ? OR am.user_id = ?
            GROUP BY a.album_id
            ORDER BY a.created_at DESC
        """, (user_id, user_id, user_id))
        albums = [{
            "album_id": row[0],
            "name": row[1],
            "folder_path": row[2],
            "admin_user_id": row[3],
            "privacy_mode": row[4],
            "created_at": row[5],
            "photo_count": row[6],
            "person_count": row[7],
            "is_admin": bool(row[8])
        } for row in cursor.fetchall()]
        conn.close()
        return albums
    
    def update_album_privacy_mode(self, album_id: int, privacy_mode: str):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("UPDATE albums SET privacy_mode = ? WHERE album_id = ?", 
                      (privacy_mode, album_id))
        conn.commit()
        conn.close()

    # Album invite methods
    def create_album_invite(self, album_id: int, created_by: int, expires_days: Optional[int] = None, 
                           max_uses: Optional[int] = None) -> dict:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        invite_token = py_secrets.token_urlsafe(32)
        expires_at = None
        if expires_days:
            from datetime import datetime, timedelta
            expires_at = (datetime.now() + timedelta(days=expires_days)).isoformat()
        
        cursor.execute("""
            INSERT INTO album_invites (album_id, invite_token, created_by, expires_at, max_uses)
            VALUES (?, ?, ?, ?, ?)
        """, (album_id, invite_token, created_by, expires_at, max_uses))
        
        invite_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return {
            "invite_id": invite_id,
            "invite_token": invite_token,
            "expires_at": expires_at,
            "max_uses": max_uses
        }
    
    def get_album_invite(self, invite_token: str) -> Optional[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT invite_id, album_id, invite_token, created_by, created_at, 
                   expires_at, max_uses, use_count, is_active
            FROM album_invites
            WHERE invite_token = ?
        """, (invite_token,))
        row = cursor.fetchone()
        conn.close()
        
        if row:
            return {
                "invite_id": row[0],
                "album_id": row[1],
                "invite_token": row[2],
                "created_by": row[3],
                "created_at": row[4],
                "expires_at": row[5],
                "max_uses": row[6],
                "use_count": row[7],
                "is_active": bool(row[8])
            }
        return None
    
    def use_album_invite(self, invite_token: str, user_id: int) -> bool:
        from datetime import datetime
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get invite details
        invite = self.get_album_invite(invite_token)
        if not invite:
            conn.close()
            return False
        
        # Check if invite is valid
        if not invite["is_active"]:
            conn.close()
            return False
        
        # Check expiration
        if invite["expires_at"]:
            expires = datetime.fromisoformat(invite["expires_at"])
            if datetime.now() > expires:
                conn.close()
                return False
        
        # Check max uses
        if invite["max_uses"] and invite["use_count"] >= invite["max_uses"]:
            conn.close()
            return False
        
        # Check if user is already a member
        if self.is_album_member(invite["album_id"], user_id):
            conn.close()
            return True  # Already a member, consider it success
        
        # Add user to album
        self.add_album_member(invite["album_id"], user_id)
        
        # Increment use count
        cursor.execute("""
            UPDATE album_invites SET use_count = use_count + 1
            WHERE invite_token = ?
        """, (invite_token,))
        
        conn.commit()
        conn.close()
        return True
    
    def get_album_invites(self, album_id: int) -> List[dict]:
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT i.invite_id, i.invite_token, i.created_at, i.expires_at, 
                   i.max_uses, i.use_count, i.is_active, u.username
            FROM album_invites i
            JOIN users u ON i.created_by = u.user_id
            WHERE i.album_id = ?
            ORDER BY i.created_at DESC
        """, (album_id,))
        
        invites = [{
            "invite_id": row[0],
            "invite_token": row[1],
            "created_at": row[2],
            "expires_at": row[3],
            "max_uses": row[4],
            "use_count": row[5],
            "is_active": bool(row[6]),
            "created_by_username": row[7]
        } for row in cursor.fetchall()]
        
        conn.close()
        return invites
    
    def deactivate_invite(self, invite_id: int):
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute("UPDATE album_invites SET is_active = 0 WHERE invite_id = ?", (invite_id,))
        conn.commit()
        conn.close()
