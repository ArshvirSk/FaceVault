from fastapi import FastAPI, UploadFile, File, HTTPException, Depends, Cookie, Form, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse, Response
from pydantic import BaseModel
from typing import List, Optional
import os
import tempfile
import numpy as np
import json
import asyncio
from functools import lru_cache
import hashlib
from contextlib import asynccontextmanager
import secrets
from datetime import datetime, timedelta

from scanner import Scanner
from detector import FaceDetector
from database import Database
from cluster import FaceClusterer
from search import FaceSearch


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown"""
    # Startup: clean up expired sessions
    try:
        deleted = db.delete_expired_sessions()
        if deleted:
            print(f"✓ Cleaned up {deleted} expired sessions")
    except Exception as e:
        print(f"⚠ Could not clean expired sessions: {e}")

    # Startup: Initialize search index
    try:
        embeddings, face_ids = db.get_all_embeddings()
        if len(embeddings) > 0:
            search_engine.build_index(embeddings, face_ids)
            print(f"✓ Search index initialized with {len(embeddings)} faces")
        else:
            print("⚠ No faces in database yet. Search index is empty.")
    except Exception as e:
        print(f"✗ Failed to initialize search index: {e}")

    yield

    # Shutdown: cleanup if needed
    print("Shutting down...")

app = FastAPI(title="FaceVault API", lifespan=lifespan)

# CORS middleware - allow frontend to connect
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Initialize components
db = Database()
detector = FaceDetector()
clusterer = FaceClusterer()
search_engine = FaceSearch()

# Session storage is now persisted in SQLite (see database.py)

# Create cache directory for thumbnails
CACHE_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "cache")
os.makedirs(CACHE_DIR, exist_ok=True)

# Create profile photos directory
PROFILE_PHOTOS_DIR = os.path.join(os.path.dirname(
    __file__), "..", "data", "profile_photos")
os.makedirs(PROFILE_PHOTOS_DIR, exist_ok=True)

# Directory where uploaded album photos are stored
UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)


def get_cache_path(cache_key: str) -> str:
    """Get cache file path for a given key"""
    return os.path.join(CACHE_DIR, f"{cache_key}.jpg")


def _extract_exif_date(image_path: str) -> Optional[str]:
    """Return EXIF DateTimeOriginal as an ISO-8601 string, or None if unavailable."""
    try:
        from PIL import Image as _PilImage
        from PIL.ExifTags import TAGS as _TAGS
        with _PilImage.open(image_path) as img:
            exif_data = img._getexif()
            if not exif_data:
                return None
            tag_map = {v: k for k, v in _TAGS.items()}
            dt_tag = tag_map.get("DateTimeOriginal")
            if dt_tag and dt_tag in exif_data:
                raw = exif_data[dt_tag]  # "YYYY:MM:DD HH:MM:SS"
                return raw[:4] + "-" + raw[5:7] + "-" + raw[8:10] + " " + raw[11:]
    except Exception:
        pass
    return None


class ScanRequest(BaseModel):
    folder_path: str
    album_name: Optional[str] = None


class RenameRequest(BaseModel):
    name: str


class RegisterRequest(BaseModel):
    username: str
    password: str


class LoginRequest(BaseModel):
    username: str
    password: str


class AddMemberRequest(BaseModel):
    user_id: int


class PrivacyModeRequest(BaseModel):
    privacy_mode: str


class CreateInviteRequest(BaseModel):
    expires_days: Optional[int] = None
    max_uses: Optional[int] = None
    access_level: Optional[str] = 'full'

# Authentication helpers


def create_session(user_id: int) -> str:
    token = secrets.token_urlsafe(32)
    expires_at = datetime.now() + timedelta(days=7)
    db.create_session(token, user_id, expires_at)
    return token


def get_current_user(session_token: Optional[str] = Cookie(None)) -> int:
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    session = db.get_session(session_token)
    if not session:
        raise HTTPException(
            status_code=401, detail="Session expired or invalid")
    return session["user_id"]


def verify_album_access(album_id: int, user_id: int) -> dict:
    """Verify user has access to album and return album info"""
    albums = db.get_user_albums(user_id)
    album = next((a for a in albums if a["album_id"] == album_id), None)
    if not album:
        raise HTTPException(
            status_code=403, detail="Access denied to this album")
    return album


def verify_album_admin(album_id: int, user_id: int):
    """Verify user is admin of the album"""
    if not db.is_album_admin(album_id, user_id):
        raise HTTPException(
            status_code=403, detail="Admin privileges required")


@app.get("/")
def root():
    return {"message": "FaceVault API", "version": "1.0"}

# Authentication endpoints


@app.post("/auth/register")
async def register(
    username: str = Form(...),
    password: str = Form(...),
    profile_photo: UploadFile = File(...)
):
    """Register a new user with profile photo"""
    # Validate username
    if len(username) < 3 or len(username) > 50:
        raise HTTPException(
            status_code=400, detail="Username must be 3-50 characters")

    # Validate password
    if len(password) < 8:
        raise HTTPException(
            status_code=400, detail="Password must be at least 8 characters")

    # Check if username exists
    existing_users = db.get_all_users()
    if any(u["username"] == username for u in existing_users):
        raise HTTPException(status_code=400, detail="Username already taken")

    # Save profile photo temporarily
    temp_path = os.path.join(tempfile.gettempdir(),
                             f"profile_{secrets.token_hex(8)}.jpg")
    with open(temp_path, "wb") as f:
        f.write(await profile_photo.read())

    try:
        # Detect face in profile photo
        faces = detector.detect_faces(temp_path)
        if len(faces) == 0:
            raise HTTPException(
                status_code=400, detail="No face detected in profile photo")
        if len(faces) > 1:
            raise HTTPException(
                status_code=400, detail="Multiple faces detected. Please upload a photo with only your face")

        # Get face embedding
        face_embedding = faces[0]["embedding"]

        # Save profile photo permanently
        profile_filename = f"{username}_{secrets.token_hex(4)}.jpg"
        profile_path = os.path.join(PROFILE_PHOTOS_DIR, profile_filename)
        os.rename(temp_path, profile_path)

        # Create user
        user_id = db.create_user(
            username, password, profile_path, face_embedding)

        # Create session
        token = create_session(user_id)

        response = Response(content=json.dumps({"user_id": user_id, "username": username}),
                            media_type="application/json")
        response.set_cookie(
            key="session_token",
            value=token,
            httponly=True,
            max_age=7*24*60*60,
            samesite="lax"
        )
        return response

    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(
            status_code=500, detail=f"Registration failed: {str(e)}")


@app.post("/auth/login")
def login(request: LoginRequest):
    """Login with username and password"""
    user_id = db.verify_user(request.username, request.password)
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    user = db.get_user_by_id(user_id)
    token = create_session(user_id)

    response = Response(content=json.dumps({"user_id": user_id, "username": user["username"]}),
                        media_type="application/json")
    response.set_cookie(
        key="session_token",
        value=token,
        httponly=True,
        max_age=7*24*60*60,
        samesite="lax"
    )
    return response


@app.post("/auth/logout")
def logout(session_token: Optional[str] = Cookie(None)):
    """Logout and invalidate session"""
    if session_token:
        db.delete_session(session_token)

    response = Response(content=json.dumps({"message": "Logged out"}),
                        media_type="application/json")
    response.delete_cookie(key="session_token")
    return response


@app.get("/auth/me")
def get_current_user_info(user_id: int = Depends(get_current_user)):
    """Get current logged-in user info"""
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.get("/auth/check")
def check_auth():
    """Check if any users exist (for first-time setup)"""
    users = db.get_all_users()
    return {"has_users": len(users) > 0, "user_count": len(users)}


@app.post("/scan")
async def scan_folder(request: ScanRequest, user_id: int = Depends(get_current_user)):
    """Scan folder for images and process faces with progress streaming"""
    async def generate_progress():
        try:
            # Create album with current user as admin
            album_name = request.album_name or os.path.basename(
                request.folder_path)
            album_id = db.add_album(
                album_name, request.folder_path, admin_user_id=user_id)

            # Scan folder
            image_files = Scanner.scan_folder(request.folder_path)
            total_images = len(image_files)

            yield f"data: {json.dumps({'stage': 'scanning', 'total': total_images, 'processed': 0, 'album_name': album_name})}\n\n"

            processed = 0
            faces_detected = 0

            # Process each image
            for idx, image_path in enumerate(image_files):
                file_hash = Scanner.compute_hash(image_path)
                taken_at = _extract_exif_date(image_path)
                photo_id = db.add_photo(
                    image_path, file_hash, album_id, taken_at)

                # Detect faces
                faces = detector.detect_faces(image_path)

                for face in faces:
                    db.add_face(
                        photo_id=photo_id,
                        bbox=face['bbox'],
                        embedding=face['embedding'],
                        confidence=face['confidence']
                    )
                    faces_detected += 1

                processed += 1

                # Send progress update
                yield f"data: {json.dumps({'stage': 'processing', 'total': total_images, 'processed': processed, 'faces': faces_detected})}\n\n"
                await asyncio.sleep(0)  # Allow other tasks to run

            # Cluster faces for this album only
            yield f"data: {json.dumps({'stage': 'clustering', 'message': 'Grouping faces by person...'})}\n\n"

            # Get embeddings only for faces in this album
            conn = sqlite3.connect(db.db_path)
            cursor = conn.cursor()
            cursor.execute("""
                SELECT f.face_id, f.embedding
                FROM faces f
                JOIN photos ph ON f.photo_id = ph.photo_id
                WHERE ph.album_id = ? AND f.embedding IS NOT NULL
            """, (album_id,))
            rows = cursor.fetchall()
            conn.close()

            face_ids = [row[0] for row in rows]
            embeddings = [np.frombuffer(row[1], dtype=np.float32)
                          for row in rows]
            persons_found = 0

            if len(embeddings) > 0:
                labels = clusterer.cluster_faces(embeddings)

                # Create persons and assign faces
                unique_labels = set(labels)
                person_map = {}

                for label in unique_labels:
                    if label == -1:  # Noise points - each gets own cluster
                        continue
                    person_id = db.add_person(
                        cluster_id=int(label), album_id=album_id)
                    person_map[label] = person_id

                # Handle noise points - each gets its own person
                noise_cluster_id = max(unique_labels) + \
                    1 if unique_labels else 0
                for face_id, label in zip(face_ids, labels):
                    if label == -1:
                        person_id = db.add_person(cluster_id=int(
                            noise_cluster_id), album_id=album_id)
                        db.update_face_person(face_id, person_id)
                        noise_cluster_id += 1
                    else:
                        db.update_face_person(face_id, person_map[label])

                persons_found = len(set(labels))

            # Rebuild search index with all faces
            yield f"data: {json.dumps({'stage': 'indexing', 'message': 'Building search index...'})}\n\n"
            all_embeddings, all_face_ids = db.get_all_embeddings()
            search_engine.build_index(all_embeddings, all_face_ids)

            # Send completion
            yield f"data: {json.dumps({'stage': 'complete', 'images_processed': processed, 'faces_detected': faces_detected, 'persons_found': persons_found, 'album_id': album_id, 'album_name': album_name})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'stage': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate_progress(), media_type="text/event-stream")


@app.get("/albums")
def get_albums(user_id: int = Depends(get_current_user)):
    """Get all albums accessible to the current user"""
    albums = db.get_user_albums(user_id)
    return {"albums": albums}


@app.get("/album/{album_id}")
def get_album(album_id: int, user_id: int = Depends(get_current_user)):
    """Get a single album by ID"""
    verify_album_access(album_id, user_id)
    albums = db.get_user_albums(user_id)
    album = next((a for a in albums if a["album_id"] == album_id), None)
    if not album:
        raise HTTPException(status_code=404, detail="Album not found")
    return album


@app.get("/album/{album_id}/cover")
async def get_album_cover(album_id: int, size: int = 400):
    """Return a face-thumbnail from the first person in the album as a cover image"""
    from PIL import Image
    import io
    import sqlite3 as _sq

    cache_key = f"album_cover_{album_id}_{size}"
    cache_path = get_cache_path(cache_key)
    if os.path.exists(cache_path):
        return FileResponse(cache_path, media_type="image/jpeg")

    conn = _sq.connect(db.db_path)
    cursor = conn.cursor()
    # Pick the highest-confidence face from this album
    cursor.execute("""
        SELECT ph.file_path, f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h
        FROM faces f
        JOIN photos ph ON f.photo_id = ph.photo_id
        WHERE ph.album_id = ? AND f.embedding IS NOT NULL
        ORDER BY f.confidence DESC
        LIMIT 1
    """, (album_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="No faces in album")

    file_path, bbox_x, bbox_y, bbox_w, bbox_h = row
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Photo file not found")

    try:
        img = Image.open(file_path)
        padding = int(max(bbox_w, bbox_h) * 0.4)
        x1 = max(0, bbox_x - padding)
        y1 = max(0, bbox_y - padding)
        x2 = min(img.width, bbox_x + bbox_w + padding)
        y2 = min(img.height, bbox_y + bbox_h + padding)
        face_img = img.crop((x1, y1, x2, y2)).convert("RGB")
        face_img.thumbnail((size, size), Image.Resampling.LANCZOS)
        face_img.save(cache_path, "JPEG", quality=85)
        return FileResponse(cache_path, media_type="image/jpeg")
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Failed to generate cover: {e}")


@app.post("/album/{album_id}/rename")
def rename_album(album_id: int, request: RenameRequest, user_id: int = Depends(get_current_user)):
    """Rename an album (admin only)"""
    verify_album_admin(album_id, user_id)

    import sqlite3
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute("UPDATE albums SET name = ? WHERE album_id = ?",
                   (request.name, album_id))

    if cursor.rowcount == 0:
        conn.close()
        raise HTTPException(status_code=404, detail="Album not found")

    conn.commit()
    conn.close()

    return {"status": "success", "message": f"Album renamed to '{request.name}'"}


@app.post("/album/{album_id}/rescan")
async def rescan_album(album_id: int, user_id: int = Depends(get_current_user)):
    """Re-scan album folder for new images and process faces with progress streaming"""
    verify_album_admin(album_id, user_id)

    # Get album info
    import sqlite3 as _sqlite3
    conn = _sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT folder_path, name FROM albums WHERE album_id = ?", (album_id,))
    row = cursor.fetchone()
    conn.close()

    if not row or not row[0]:
        raise HTTPException(
            status_code=400, detail="Album has no folder path set")

    folder_path, album_name = row

    async def generate_progress():
        try:
            image_files = Scanner.scan_folder(folder_path)
            total_images = len(image_files)

            yield f"data: {json.dumps({'stage': 'scanning', 'total': total_images, 'processed': 0, 'album_name': album_name})}\n\n"

            processed = 0
            faces_detected = 0
            skipped = 0

            for idx, image_path in enumerate(image_files):
                file_hash = Scanner.compute_hash(image_path)

                # Check if this photo already exists in the DB
                conn2 = _sqlite3.connect(db.db_path)
                cursor2 = conn2.cursor()
                cursor2.execute(
                    "SELECT photo_id FROM photos WHERE file_hash = ? AND album_id = ?",
                    (file_hash, album_id)
                )
                existing = cursor2.fetchone()
                conn2.close()

                if existing:
                    skipped += 1
                    processed += 1
                    yield f"data: {json.dumps({'stage': 'processing', 'total': total_images, 'processed': processed, 'faces': faces_detected, 'skipped': skipped})}\n\n"
                    await asyncio.sleep(0)
                    continue

                photo_id = db.add_photo(
                    image_path, file_hash, album_id, _extract_exif_date(image_path))
                faces = detector.detect_faces(image_path)

                for face in faces:
                    db.add_face(
                        photo_id=photo_id,
                        bbox=face['bbox'],
                        embedding=face['embedding'],
                        confidence=face['confidence']
                    )
                    faces_detected += 1

                processed += 1
                yield f"data: {json.dumps({'stage': 'processing', 'total': total_images, 'processed': processed, 'faces': faces_detected, 'skipped': skipped})}\n\n"
                await asyncio.sleep(0)

            # Re-cluster all faces in this album
            yield f"data: {json.dumps({'stage': 'clustering', 'message': 'Re-grouping faces by person...'})}\n\n"

            conn3 = _sqlite3.connect(db.db_path)
            cursor3 = conn3.cursor()
            cursor3.execute("""
                SELECT f.face_id, f.embedding
                FROM faces f
                JOIN photos ph ON f.photo_id = ph.photo_id
                WHERE ph.album_id = ? AND f.embedding IS NOT NULL AND f.person_id IS NULL
            """, (album_id,))
            rows = cursor3.fetchall()
            conn3.close()

            new_persons_found = 0
            if rows:
                new_face_ids = [r[0] for r in rows]
                new_embeddings = [np.frombuffer(
                    r[1], dtype=np.float32) for r in rows]

                # Get existing embeddings + person assignments for reference
                conn4 = _sqlite3.connect(db.db_path)
                cursor4 = conn4.cursor()
                cursor4.execute("""
                    SELECT f.face_id, f.embedding, f.person_id
                    FROM faces f
                    JOIN photos ph ON f.photo_id = ph.photo_id
                    WHERE ph.album_id = ? AND f.embedding IS NOT NULL AND f.person_id IS NOT NULL
                """, (album_id,))
                existing_rows = cursor4.fetchall()
                conn4.close()

                # Use FAISS to assign new faces to nearest existing person or create new ones
                from search import FaceSearch
                temp_search = FaceSearch()
                persons_found = 0

                if existing_rows:
                    ex_face_ids = [r[0] for r in existing_rows]
                    ex_embeddings = [np.frombuffer(
                        r[1], dtype=np.float32) for r in existing_rows]
                    ex_person_ids = [r[2] for r in existing_rows]
                    temp_search.build_index(ex_embeddings, ex_face_ids)

                    for new_fid, new_emb in zip(new_face_ids, new_embeddings):
                        results = temp_search.search(new_emb, top_k=1)
                        if results and results[0]['distance'] < 0.5:
                            # Assign to nearest existing person
                            matched_face_id = results[0]['face_id']
                            matched_idx = ex_face_ids.index(matched_face_id)
                            db.update_face_person(
                                new_fid, ex_person_ids[matched_idx])
                        else:
                            # New person
                            new_pid = db.add_person(
                                cluster_id=-1, album_id=album_id)
                            db.update_face_person(new_fid, new_pid)
                            new_persons_found += 1
                else:
                    # No existing persons — cluster from scratch
                    labels = clusterer.cluster_faces(new_embeddings)
                    unique_labels = set(labels)
                    person_map = {}
                    for label in unique_labels:
                        if label != -1:
                            pid = db.add_person(
                                cluster_id=int(label), album_id=album_id)
                            person_map[label] = pid

                    noise_cluster_id = max(
                        unique_labels) + 1 if unique_labels else 0
                    for fid, label in zip(new_face_ids, labels):
                        if label == -1:
                            pid = db.add_person(cluster_id=int(
                                noise_cluster_id), album_id=album_id)
                            db.update_face_person(fid, pid)
                            noise_cluster_id += 1
                        else:
                            db.update_face_person(fid, person_map[label])
                    new_persons_found = len(set(labels))

            # Rebuild search index
            yield f"data: {json.dumps({'stage': 'indexing', 'message': 'Rebuilding search index...'})}\n\n"
            all_embeddings, all_face_ids = db.get_all_embeddings()
            search_engine.build_index(all_embeddings, all_face_ids)

            new_photos = processed - skipped
            yield f"data: {json.dumps({'stage': 'complete', 'images_processed': processed, 'new_photos': new_photos, 'skipped': skipped, 'faces_detected': faces_detected, 'new_persons': new_persons_found, 'album_id': album_id})}\n\n"

        except Exception as e:
            yield f"data: {json.dumps({'stage': 'error', 'message': str(e)})}\n\n"

    return StreamingResponse(generate_progress(), media_type="text/event-stream")


@app.post("/album/{album_id}/upload")
async def upload_photos_to_album(
    album_id: int,
    files: List[UploadFile] = File(...),
    user_id: int = Depends(get_current_user)
):
    """Upload photos directly to an album, process faces, assign to persons"""
    verify_album_access(album_id, user_id)

    # Create album-specific upload dir
    album_upload_dir = os.path.join(UPLOADS_DIR, str(album_id))
    os.makedirs(album_upload_dir, exist_ok=True)

    ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
    saved_paths = []
    errors = []

    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            errors.append(
                f"{file.filename}: unsupported type {file.content_type}")
            continue
        try:
            ext = os.path.splitext(file.filename or "photo")[1] or ".jpg"
            unique_name = f"{secrets.token_hex(8)}{ext}"
            dest_path = os.path.join(album_upload_dir, unique_name)
            content = await file.read()
            with open(dest_path, "wb") as f:
                f.write(content)
            saved_paths.append(dest_path)
        except Exception as e:
            errors.append(f"{file.filename}: {str(e)}")

    # Process each saved photo
    new_photos = 0
    new_faces = 0
    skipped = 0

    for photo_path in saved_paths:
        file_hash = Scanner.compute_hash(photo_path)
        # Skip duplicates (same hash already in this album)
        import sqlite3 as _sq
        conn = _sq.connect(db.db_path)
        c = conn.cursor()
        c.execute(
            "SELECT photo_id FROM photos WHERE file_hash = ? AND album_id = ?", (file_hash, album_id))
        existing = c.fetchone()
        conn.close()
        if existing:
            skipped += 1
            os.remove(photo_path)
            continue

        photo_id = db.add_photo(photo_path, file_hash,
                                album_id, _extract_exif_date(photo_path))
        faces = detector.detect_faces(photo_path)

        for face in faces:
            db.add_face(
                photo_id=photo_id,
                bbox=face['bbox'],
                embedding=face['embedding'],
                confidence=face['confidence']
            )
            new_faces += 1
        new_photos += 1

    # Assign new unassigned faces to persons using existing search index
    conn2 = __import__('sqlite3').connect(db.db_path)
    cursor2 = conn2.cursor()
    cursor2.execute("""
        SELECT f.face_id, f.embedding
        FROM faces f
        JOIN photos ph ON f.photo_id = ph.photo_id
        WHERE ph.album_id = ? AND f.person_id IS NULL AND f.embedding IS NOT NULL
    """, (album_id,))
    unassigned = cursor2.fetchall()
    conn2.close()

    new_persons = 0
    if unassigned:
        unassigned_ids = [r[0] for r in unassigned]
        unassigned_embs = [np.frombuffer(
            r[1], dtype=np.float32) for r in unassigned]

        # Get existing person embeddings for this album
        conn3 = __import__('sqlite3').connect(db.db_path)
        cursor3 = conn3.cursor()
        cursor3.execute("""
            SELECT f.face_id, f.embedding, f.person_id
            FROM faces f
            JOIN photos ph ON f.photo_id = ph.photo_id
            WHERE ph.album_id = ? AND f.person_id IS NOT NULL AND f.embedding IS NOT NULL
        """, (album_id,))
        existing_rows = cursor3.fetchall()
        conn3.close()

        if existing_rows:
            ex_face_ids = [r[0] for r in existing_rows]
            ex_embeddings = [np.frombuffer(
                r[1], dtype=np.float32) for r in existing_rows]
            ex_person_ids = [r[2] for r in existing_rows]
            from search import FaceSearch
            temp_search = FaceSearch()
            temp_search.build_index(ex_embeddings, ex_face_ids)

            for fid, emb in zip(unassigned_ids, unassigned_embs):
                results = temp_search.search(emb, top_k=1)
                if results and results[0]['distance'] < 0.5:
                    matched_idx = ex_face_ids.index(results[0]['face_id'])
                    db.update_face_person(fid, ex_person_ids[matched_idx])
                else:
                    new_pid = db.add_person(cluster_id=-1, album_id=album_id)
                    db.update_face_person(fid, new_pid)
                    new_persons += 1
        else:
            # No existing persons — cluster from scratch
            if len(unassigned_embs) > 0:
                labels = clusterer.cluster_faces(unassigned_embs)
                unique_labels = set(labels)
                person_map = {}
                for label in unique_labels:
                    if label != -1:
                        pid = db.add_person(
                            cluster_id=int(label), album_id=album_id)
                        person_map[label] = pid

                noise_id = max(unique_labels) + 1 if unique_labels else 0
                for fid, label in zip(unassigned_ids, labels):
                    if label == -1:
                        pid = db.add_person(cluster_id=int(
                            noise_id), album_id=album_id)
                        db.update_face_person(fid, pid)
                        noise_id += 1
                        new_persons += 1
                    else:
                        db.update_face_person(fid, person_map[label])
                new_persons += len(set(l for l in labels if l != -1))

    # Rebuild search index
    all_embeddings, all_face_ids = db.get_all_embeddings()
    search_engine.build_index(all_embeddings, all_face_ids)

    return {
        "status": "success",
        "new_photos": new_photos,
        "new_faces": new_faces,
        "new_persons": new_persons,
        "skipped_duplicates": skipped,
        "errors": errors,
    }


@app.get("/album/{album_id}/photos")
def get_album_photos(
    album_id: int,
    user_id: int = Depends(get_current_user),
    person_id: Optional[int] = None,
    sort: str = "newest",
):
    """Get all photos in an album, with optional person filter and sort order.
    sort: newest | oldest | filename
    """
    import sqlite3 as _sqlite3
    verify_album_access(album_id, user_id)
    conn = _sqlite3.connect(db.db_path)
    cursor = conn.cursor()

    order_clause = {
        "oldest": "p.timestamp ASC, p.photo_id ASC",
        "filename": "p.file_path ASC",
    }.get(sort, "p.timestamp DESC, p.photo_id DESC")

    if person_id is not None:
        cursor.execute(
            f"""
            SELECT DISTINCT p.photo_id, p.file_path, p.timestamp
            FROM photos p
            JOIN faces f ON f.photo_id = p.photo_id
            WHERE p.album_id = ? AND f.person_id = ?
            ORDER BY {order_clause}
            """,
            (album_id, person_id),
        )
    else:
        cursor.execute(
            f"""
            SELECT p.photo_id, p.file_path, p.timestamp
            FROM photos p
            WHERE p.album_id = ?
            ORDER BY {order_clause}
            """,
            (album_id,),
        )

    photos = [
        {
            "photo_id": row[0],
            "filename": os.path.basename(row[1]) if row[1] else None,
            "timestamp": row[2],
        }
        for row in cursor.fetchall()
    ]
    conn.close()
    return {"photos": photos}


@app.get("/album/{album_id}/members")
def get_album_members(album_id: int, user_id: int = Depends(get_current_user)):
    """Get all members of an album"""
    verify_album_access(album_id, user_id)
    members = db.get_album_members(album_id)
    return {"members": members}


@app.post("/album/{album_id}/members")
def add_album_member(album_id: int, request: AddMemberRequest, user_id: int = Depends(get_current_user)):
    """Add a user to an album (admin only)"""
    verify_album_admin(album_id, user_id)

    # Verify target user exists
    target_user = db.get_user_by_id(request.user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    db.add_album_member(album_id, request.user_id)

    # Auto face-match: find which person cluster in this album matches the new user's face
    matched_person_id = None
    try:
        new_user_embedding = db.get_user_profile_embedding(request.user_id)
        if new_user_embedding is not None:
            import sqlite3 as _sqlite3
            conn = _sqlite3.connect(db.db_path)
            cursor = conn.cursor()
            # Get all person clusters in this album with their face embeddings
            cursor.execute("""
                SELECT p.person_id, f.embedding
                FROM persons p
                JOIN faces f ON p.person_id = f.person_id
                WHERE p.album_id = ? AND f.embedding IS NOT NULL
            """, (album_id,))
            rows = cursor.fetchall()
            conn.close()

            # Compute average embedding per person, find best cosine match
            from collections import defaultdict
            person_embeddings: dict = defaultdict(list)
            for pid, emb_blob in rows:
                person_embeddings[pid].append(
                    np.frombuffer(emb_blob, dtype=np.float32))

            best_sim = -1.0
            best_pid = None
            for pid, embs in person_embeddings.items():
                center = np.mean(embs, axis=0)
                sim = float(np.dot(new_user_embedding, center) /
                            (np.linalg.norm(new_user_embedding) * np.linalg.norm(center) + 1e-8))
                if sim > best_sim:
                    best_sim = sim
                    best_pid = pid

            # Threshold: 0.35 cosine similarity (generous — profile photos vary)
            MATCH_THRESHOLD = 0.35
            if best_pid is not None and best_sim >= MATCH_THRESHOLD:
                db.assign_person_to_user(best_pid, request.user_id)
                matched_person_id = best_pid
    except Exception as _e:
        print(f"Auto face-match warning: {_e}")

    result = {"status": "success",
              "message": f"User {target_user['username']} added to album"}
    if matched_person_id is not None:
        result["matched_person_id"] = matched_person_id
        result["message"] += f" and matched to person cluster #{matched_person_id}"
    return result


@app.delete("/album/{album_id}/members/{member_user_id}")
def remove_album_member(album_id: int, member_user_id: int, user_id: int = Depends(get_current_user)):
    """Remove a user from an album (admin only)"""
    verify_album_admin(album_id, user_id)

    if member_user_id == user_id:
        raise HTTPException(
            status_code=400, detail="Cannot remove yourself as admin")

    db.remove_album_member(album_id, member_user_id)
    return {"status": "success", "message": "User removed from album"}


@app.post("/album/{album_id}/leave")
def leave_album(album_id: int, user_id: int = Depends(get_current_user)):
    """Leave an album (for non-admin members)"""
    # Check if user is a member
    if not db.is_album_member(album_id, user_id):
        raise HTTPException(
            status_code=403, detail="You are not a member of this album")

    # Check if user is admin
    if db.is_album_admin(album_id, user_id):
        raise HTTPException(
            status_code=400, detail="Album admins cannot leave their own album. Please transfer admin rights first or delete the album.")

    db.remove_album_member(album_id, user_id)
    return {"status": "success", "message": "You have left the album"}


@app.post("/album/{album_id}/privacy")
def update_album_privacy(album_id: int, request: PrivacyModeRequest, user_id: int = Depends(get_current_user)):
    """Update album privacy mode (admin only)"""
    verify_album_admin(album_id, user_id)

    if request.privacy_mode not in ['public', 'private']:
        raise HTTPException(
            status_code=400, detail="Privacy mode must be 'public' or 'private'")

    db.update_album_privacy_mode(album_id, request.privacy_mode)
    return {"status": "success", "privacy_mode": request.privacy_mode}


@app.get("/users")
def get_all_users_list(user_id: int = Depends(get_current_user)):
    """Get all users in the system (for adding to albums)"""
    users = db.get_all_users()
    return {"users": users}

# Album invite endpoints


@app.post("/album/{album_id}/invite")
def create_album_invite(album_id: int, request: CreateInviteRequest, user_id: int = Depends(get_current_user)):
    """Create an invite link for the album (admin only)"""
    verify_album_admin(album_id, user_id)

    invite = db.create_album_invite(
        album_id, user_id, request.expires_days, request.max_uses,
        request.access_level or 'full')

    return {
        "status": "success",
        "invite": invite
    }


@app.get("/album/{album_id}/invites")
def get_album_invites(album_id: int, user_id: int = Depends(get_current_user)):
    """Get all invite links for an album (admin only)"""
    verify_album_admin(album_id, user_id)

    invites = db.get_album_invites(album_id)
    return {"invites": invites}


@app.post("/invite/{invite_token}/join")
def join_album_via_invite(invite_token: str, user_id: int = Depends(get_current_user)):
    """Join an album using an invite link"""
    invite = db.get_album_invite(invite_token)

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite link")

    success = db.use_album_invite(invite_token, user_id)

    if not success:
        raise HTTPException(
            status_code=400, detail="Invite link is expired or no longer valid")

    # Get album info
    albums = db.get_user_albums(user_id)
    album = next(
        (a for a in albums if a["album_id"] == invite["album_id"]), None)

    return {
        "status": "success",
        "message": "Successfully joined album",
        "album": album
    }


@app.get("/invite/{invite_token}")
def get_invite_info(invite_token: str):
    """Get information about an invite link (public endpoint)"""
    invite = db.get_album_invite(invite_token)

    if not invite:
        raise HTTPException(status_code=404, detail="Invalid invite link")

    # Get album info
    import sqlite3
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT name, admin_user_id FROM albums WHERE album_id = ?", (invite["album_id"],))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Album not found")

    # Check if invite is still valid
    from datetime import datetime
    is_valid = invite["is_active"]

    if invite["expires_at"]:
        expires = datetime.fromisoformat(invite["expires_at"])
        is_valid = is_valid and datetime.now() <= expires

    if invite["max_uses"]:
        is_valid = is_valid and invite["use_count"] < invite["max_uses"]

    return {
        "album_name": row[0],
        "is_valid": is_valid,
        "expires_at": invite["expires_at"],
        "max_uses": invite["max_uses"],
        "use_count": invite["use_count"]
    }


@app.delete("/album/{album_id}/invite/{invite_id}")
def deactivate_album_invite(album_id: int, invite_id: int, user_id: int = Depends(get_current_user)):
    """Deactivate an invite link (admin only)"""
    verify_album_admin(album_id, user_id)

    db.deactivate_invite(invite_id)
    return {"status": "success", "message": "Invite link deactivated"}


@app.get("/people")
def get_people(album_id: Optional[int] = None, user_id: int = Depends(get_current_user)):
    """Get all detected persons, optionally filtered by album"""
    privacy_mode = 'public'

    if album_id:
        album = verify_album_access(album_id, user_id)
        privacy_mode = album.get('privacy_mode', 'public')
        is_admin = album.get('is_admin', False)
        persons = db.get_all_persons(
            album_id, user_id, privacy_mode, is_admin=is_admin)
    else:
        # Get persons from all albums the user has access to
        user_albums = db.get_user_albums(user_id)
        album_ids = [a["album_id"] for a in user_albums]

        if not album_ids:
            return {"persons": [], "privacy_mode": privacy_mode}

        # Get persons from all accessible albums
        all_persons = []
        for aid in album_ids:
            album = next(
                (a for a in user_albums if a["album_id"] == aid), None)
            if album:
                pmode = album.get('privacy_mode', 'public')
                is_adm = album.get('is_admin', False)
                persons_in_album = db.get_all_persons(
                    aid, user_id, pmode, is_admin=is_adm)
                all_persons.extend(persons_in_album)

        persons = all_persons

    # Add thumbnail info
    for person in persons:
        thumbnail = db.get_person_thumbnail(person['person_id'])
        person['thumbnail'] = thumbnail

    return {"persons": persons, "privacy_mode": privacy_mode}


@app.get("/person/{person_id}/photos")
def get_person_photos(person_id: int, album_id: Optional[int] = None):
    """Get all photos for a person, optionally filtered by album"""
    if album_id is not None:
        import sqlite3 as _sqlite3
        conn = _sqlite3.connect(db.db_path)
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT ph.photo_id, ph.file_path
            FROM photos ph
            JOIN faces f ON ph.photo_id = f.photo_id
            WHERE f.person_id = ? AND ph.album_id = ?
            ORDER BY ph.taken_at ASC, ph.photo_id ASC
        """, (person_id, album_id))
        photos = [{"photo_id": r[0], "file_path": r[1]}
                  for r in cursor.fetchall()]
        conn.close()
        return {"photos": photos}
    photos = db.get_photos_for_person(person_id)
    return {"photos": photos}


@app.get("/person/{person_id}")
def get_person(person_id: int, user_id: int = Depends(get_current_user)):
    """Get person info including album_id and name"""
    import sqlite3 as _sqlite3
    conn = _sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.person_id, p.name, p.album_id, p.user_id,
               COUNT(DISTINCT f.photo_id) as photo_count
        FROM persons p
        LEFT JOIN faces f ON f.person_id = p.person_id
        WHERE p.person_id = ?
        GROUP BY p.person_id
    """, (person_id,))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Person not found")

    # Get all distinct albums this person's photos belong to
    cursor.execute("""
        SELECT DISTINCT a.album_id, a.name, COUNT(DISTINCT ph.photo_id) as count
        FROM faces f
        JOIN photos ph ON f.photo_id = ph.photo_id
        JOIN albums a ON ph.album_id = a.album_id
        WHERE f.person_id = ?
        GROUP BY a.album_id
        ORDER BY count DESC
    """, (person_id,))
    albums = [{"album_id": r[0], "name": r[1], "photo_count": r[2]}
              for r in cursor.fetchall()]
    conn.close()

    return {
        "person_id": row[0],
        "name": row[1] or f"Person {row[0]}",
        "album_id": row[2],
        "user_id": row[3],
        "photo_count": row[4],
        "albums": albums,
    }


@app.get("/person/{person_id}/photos/zip")
def download_person_photos_zip(person_id: int, user_id: int = Depends(get_current_user)):
    """Download all photos for a person as a ZIP file"""
    import zipfile
    import io

    photos = db.get_photos_for_person(person_id)
    if not photos:
        raise HTTPException(
            status_code=404, detail="No photos found for this person")

    # Get person name for the filename
    conn = __import__('sqlite3').connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT name FROM persons WHERE person_id = ?", (person_id,))
    row = cursor.fetchone()
    conn.close()
    person_name = (row[0] or f"person_{person_id}").replace(
        " ", "_") if row else f"person_{person_id}"

    zip_buffer = io.BytesIO()
    with zipfile.ZipFile(zip_buffer, "w", zipfile.ZIP_DEFLATED) as zf:
        seen_names: dict[str, int] = {}
        for photo in photos:
            file_path = photo["file_path"]
            if not os.path.exists(file_path):
                continue
            base_name = os.path.basename(file_path)
            # Deduplicate filenames inside zip
            if base_name in seen_names:
                seen_names[base_name] += 1
                name_part, ext = os.path.splitext(base_name)
                base_name = f"{name_part}_{seen_names[base_name]}{ext}"
            else:
                seen_names[base_name] = 0
            zf.write(file_path, base_name)

    zip_buffer.seek(0)
    from fastapi.responses import StreamingResponse
    return StreamingResponse(
        zip_buffer,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=\"{person_name}_photos.zip\""}
    )


@app.post("/person/{person_id}/rename")
def rename_person(person_id: int, request: RenameRequest):
    """Rename a person"""
    db.rename_person(person_id, request.name)
    return {"status": "success", "person_id": person_id, "new_name": request.name}


@app.post("/person/{source_id}/merge/{target_id}")
def merge_persons(source_id: int, target_id: int):
    """Merge source person into target person"""
    import sqlite3

    try:
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        # Update all faces from source to target
        cursor.execute("""
            UPDATE faces 
            SET person_id = ? 
            WHERE person_id = ?
        """, (target_id, source_id))

        # Delete the source person
        cursor.execute("DELETE FROM persons WHERE person_id = ?", (source_id,))

        conn.commit()
        conn.close()

        return {"status": "success", "message": f"Merged person {source_id} into {target_id}"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/auto-merge")
def auto_merge_people(threshold: float = 0.5):
    """
    Automatically merge similar people based on face embeddings

    Args:
        threshold: Cosine similarity threshold (0.4-0.7)
            - 0.4: Very aggressive (may merge different people)
            - 0.5: Balanced (default, good for most cases)
            - 0.6: Conservative (only very similar faces)
            - 0.7: Very conservative (almost identical only)
    """
    import sqlite3
    from collections import defaultdict

    try:
        # Get all persons and their embeddings
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT p.person_id, f.embedding
            FROM persons p
            JOIN faces f ON p.person_id = f.person_id
            WHERE f.embedding IS NOT NULL
        """)

        rows = cursor.fetchall()

        # Group embeddings by person
        person_embeddings = defaultdict(list)
        for person_id, embedding_blob in rows:
            embedding = np.frombuffer(embedding_blob, dtype=np.float32)
            person_embeddings[person_id].append(embedding)

        # Find mergeable clusters
        merge_pairs = clusterer.find_mergeable_clusters(
            person_embeddings, threshold)

        if not merge_pairs:
            conn.close()
            return {
                "status": "success",
                "merged_count": 0,
                "message": f"No similar people found to merge at threshold {threshold}. Try lowering the threshold (e.g., 0.4 for more aggressive merging)."
            }

        # Merge clusters
        merged_count = 0
        merged_into = {}  # Track which clusters have been merged

        for source_id, target_id in merge_pairs:
            # Skip if source was already merged
            if source_id in merged_into:
                continue

            # If target was merged, use its new target
            actual_target = merged_into.get(target_id, target_id)

            # Update all faces from source to target
            cursor.execute("""
                UPDATE faces 
                SET person_id = ? 
                WHERE person_id = ?
            """, (actual_target, source_id))

            # Delete the source person
            cursor.execute(
                "DELETE FROM persons WHERE person_id = ?", (source_id,))

            merged_into[source_id] = actual_target
            merged_count += 1

        conn.commit()
        conn.close()

        # Rebuild search index
        embeddings, face_ids = db.get_all_embeddings()
        search_engine.build_index(embeddings, face_ids)

        return {
            "status": "success",
            "merged_count": merged_count,
            "threshold_used": threshold,
            "message": f"Successfully merged {merged_count} duplicate people using threshold {threshold}"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/recluster")
def recluster_faces():
    """Re-run clustering on all faces to find missing people"""
    import sqlite3

    try:
        # Clear existing person assignments
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        # Delete all persons
        cursor.execute("DELETE FROM persons")

        # Clear person_id from faces
        cursor.execute("UPDATE faces SET person_id = NULL")

        conn.commit()
        conn.close()

        # Get all embeddings
        embeddings, face_ids = db.get_all_embeddings()

        if len(embeddings) == 0:
            return {"status": "success", "persons_found": 0, "message": "No faces to cluster"}

        # Re-cluster with new parameters
        labels = clusterer.cluster_faces(embeddings)

        # Create persons and assign faces
        unique_labels = set(labels)
        person_map = {}

        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        for label in unique_labels:
            person_id = db.add_person(cluster_id=int(label))
            person_map[label] = person_id

        # Update face person assignments
        for face_id, label in zip(face_ids, labels):
            db.update_face_person(face_id, person_map[label])

        conn.close()

        # Rebuild search index
        embeddings, face_ids = db.get_all_embeddings()
        search_engine.build_index(embeddings, face_ids)

        return {
            "status": "success",
            "persons_found": len(unique_labels),
            "message": f"Successfully re-clustered faces into {len(unique_labels)} people"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/diagnostics")
def get_diagnostics():
    """Get database diagnostics to identify issues"""
    import sqlite3

    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()

    # Count total faces
    cursor.execute("SELECT COUNT(*) FROM faces")
    total_faces = cursor.fetchone()[0]

    # Count faces with person_id
    cursor.execute("SELECT COUNT(*) FROM faces WHERE person_id IS NOT NULL")
    faces_with_person = cursor.fetchone()[0]

    # Count faces without person_id
    cursor.execute("SELECT COUNT(*) FROM faces WHERE person_id IS NULL")
    faces_without_person = cursor.fetchone()[0]

    # Count total persons
    cursor.execute("SELECT COUNT(*) FROM persons")
    total_persons = cursor.fetchone()[0]

    # Count persons with no faces
    cursor.execute("""
        SELECT COUNT(*) FROM persons p
        WHERE NOT EXISTS (
            SELECT 1 FROM faces f WHERE f.person_id = p.person_id
        )
    """)
    persons_without_faces = cursor.fetchone()[0]

    # Count total photos
    cursor.execute("SELECT COUNT(*) FROM photos")
    total_photos = cursor.fetchone()[0]

    conn.close()

    return {
        "total_faces": total_faces,
        "faces_with_person": faces_with_person,
        "faces_without_person": faces_without_person,
        "total_persons": total_persons,
        "persons_without_faces": persons_without_faces,
        "total_photos": total_photos
    }


@app.post("/fix-data")
def fix_data_integrity():
    """Fix data integrity issues"""
    import sqlite3

    try:
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        # Delete persons with no faces
        cursor.execute("""
            DELETE FROM persons
            WHERE person_id NOT IN (
                SELECT DISTINCT person_id FROM faces WHERE person_id IS NOT NULL
            )
        """)
        deleted_persons = cursor.rowcount

        # Assign unassigned faces to new persons
        cursor.execute(
            "SELECT face_id, embedding FROM faces WHERE person_id IS NULL AND embedding IS NOT NULL")
        unassigned_faces = cursor.fetchall()

        created_persons = 0
        if unassigned_faces:
            # Get max cluster_id
            cursor.execute("SELECT MAX(cluster_id) FROM persons")
            max_cluster = cursor.fetchone()[0] or 0

            for face_id, _ in unassigned_faces:
                max_cluster += 1
                person_id = db.add_person(cluster_id=max_cluster)
                db.update_face_person(face_id, person_id)
                created_persons += 1

        conn.commit()
        conn.close()

        return {
            "status": "success",
            "deleted_empty_persons": deleted_persons,
            "created_persons_for_orphaned_faces": created_persons,
            "message": f"Fixed data: removed {deleted_persons} empty persons, created {created_persons} persons for orphaned faces"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/search-face")
async def search_face(file: UploadFile = File(...)):
    """Search for similar faces and return matching photos"""
    import sqlite3

    tmp_path = None
    try:
        # Validate file type
        if not file.content_type or not file.content_type.startswith('image/'):
            raise HTTPException(
                status_code=400, detail="File must be an image")

        # Save uploaded file temporarily
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Verify file was written
        if not os.path.exists(tmp_path) or os.path.getsize(tmp_path) == 0:
            raise HTTPException(
                status_code=400, detail="Failed to save uploaded file")

        # Detect face in uploaded image
        print(f"Detecting faces in: {tmp_path}")
        faces = detector.detect_faces(tmp_path)
        print(f"Detected {len(faces)} faces")

        # Clean up temp file
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
            tmp_path = None

        if len(faces) == 0:
            raise HTTPException(
                status_code=400,
                detail="No face detected in uploaded image. Please upload a clear photo with a visible face."
            )

        # Use first detected face
        query_embedding = faces[0]['embedding']
        print(f"Query embedding shape: {query_embedding.shape}")

        # Search for similar faces
        results = search_engine.search(query_embedding, k=50)
        print(f"Found {len(results)} similar faces")

        if results:
            # Show distance range for debugging
            distances = [dist for _, dist in results]
            print(
                f"Distance range: min={min(distances):.3f}, max={max(distances):.3f}, avg={sum(distances)/len(distances):.3f}")

        if not results:
            return {"photos": [], "count": 0, "message": "No similar faces found in your collection"}

        # Get unique photos from face IDs
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        photo_results = []
        seen_photos = set()

        for face_id, distance in results:
            cursor.execute("""
                SELECT f.photo_id, ph.file_path, f.person_id, p.name, ph.album_id, a.name
                FROM faces f
                JOIN photos ph ON f.photo_id = ph.photo_id
                LEFT JOIN persons p ON f.person_id = p.person_id
                LEFT JOIN albums a ON ph.album_id = a.album_id
                WHERE f.face_id = ?
            """, (face_id,))

            row = cursor.fetchone()
            if row and row[0] not in seen_photos:
                photo_id, file_path, person_id, person_name, album_id, album_name = row
                seen_photos.add(photo_id)

                # Convert distance to similarity percentage
                # FAISS L2 distance: 0 = identical, larger = more different
                # Typical range: 0-2 for similar faces, >2 for different faces
                # Convert to percentage: closer to 0 = higher similarity
                if distance < 0.3:
                    similarity = 100  # Very high similarity
                elif distance < 0.6:
                    similarity = 95 - (distance - 0.3) * 50  # 95-80%
                elif distance < 1.0:
                    similarity = 80 - (distance - 0.6) * 50  # 80-60%
                elif distance < 1.5:
                    similarity = 60 - (distance - 1.0) * 40  # 60-40%
                else:
                    similarity = max(0, 40 - (distance - 1.5) * 20)  # 40-0%

                similarity = round(max(0, min(100, similarity)), 1)

                photo_results.append({
                    "photo_id": photo_id,
                    "file_path": file_path,
                    "person_id": person_id,
                    "person_name": person_name or f"Person {person_id}",
                    "album_id": album_id,
                    "album_name": album_name or "Unknown Album",
                    "similarity": round(similarity, 1),
                    "distance": float(distance)
                })

                if len(photo_results) >= 20:
                    break

        conn.close()

        print(f"Returning {len(photo_results)} unique photos")
        return {"photos": photo_results, "count": len(photo_results)}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Search error: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")
    finally:
        # Ensure temp file is cleaned up
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except:
                pass


@app.post("/test-face-detection")
async def test_face_detection(file: UploadFile = File(...)):
    """Test endpoint to verify face detection is working"""
    tmp_path = None
    try:
        # Save uploaded file
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp:
            content = await file.read()
            tmp.write(content)
            tmp_path = tmp.name

        # Detect faces
        faces = detector.detect_faces(tmp_path)

        # Clean up
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)

        return {
            "faces_detected": len(faces),
            "faces": [
                {
                    "bbox": face['bbox'],
                    "confidence": face['confidence'],
                    "embedding_shape": face['embedding'].shape
                }
                for face in faces
            ]
        }
    except Exception as e:
        if tmp_path and os.path.exists(tmp_path):
            os.unlink(tmp_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/search-index-status")
def get_search_index_status():
    """Get status of the search index"""
    return {
        "index_size": search_engine.index.ntotal,
        "face_ids_count": len(search_engine.face_ids),
        "dimension": search_engine.dimension
    }


@app.post("/rebuild-search-index")
def rebuild_search_index():
    """Rebuild the FAISS search index from database"""
    try:
        embeddings, face_ids = db.get_all_embeddings()

        if len(embeddings) == 0:
            return {
                "status": "warning",
                "message": "No embeddings found in database. Scan some photos first.",
                "index_size": 0
            }

        search_engine.build_index(embeddings, face_ids)

        return {
            "status": "success",
            "message": f"Search index rebuilt with {len(embeddings)} faces",
            "index_size": search_engine.index.ntotal,
            "face_ids_count": len(search_engine.face_ids)
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/photo/{photo_id}")
def get_photo(photo_id: int):
    """Serve photo file"""
    import sqlite3
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT file_path FROM photos WHERE photo_id = ?", (photo_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Photo not found")

    file_path = row[0]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Photo file not found")

    return FileResponse(file_path)


@app.get("/photo/{photo_id}/thumbnail")
async def get_photo_thumbnail(photo_id: int, size: int = 300):
    """Serve optimized thumbnail with caching"""
    import sqlite3
    from PIL import Image

    # Create cache key
    cache_key = f"photo_{photo_id}_thumb_{size}"
    cache_path = get_cache_path(cache_key)

    # Check if cached version exists
    if os.path.exists(cache_path):
        return FileResponse(cache_path, media_type="image/jpeg")

    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT file_path FROM photos WHERE photo_id = ?", (photo_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Photo not found")

    file_path = row[0]
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Photo file not found")

    try:
        # Open and resize image
        img = Image.open(file_path)
        img.thumbnail((size, size), Image.Resampling.LANCZOS)

        # Convert to RGB if necessary
        if img.mode in ('RGBA', 'LA', 'P'):
            img = img.convert('RGB')

        # Save to cache
        img.save(cache_path, format='JPEG', quality=85, optimize=True)

        # Return cached file
        return FileResponse(
            cache_path,
            media_type="image/jpeg",
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "ETag": cache_key
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing image: {str(e)}")


@app.get("/person/{person_id}/face-thumbnail")
async def get_person_face_thumbnail(person_id: int, size: int = 300):
    """Serve cropped face thumbnail for a person with caching"""
    import sqlite3
    from PIL import Image
    import io

    # Create cache key
    cache_key = f"person_{person_id}_face_{size}"
    cache_path = get_cache_path(cache_key)

    # Check if cached version exists
    if os.path.exists(cache_path):
        return FileResponse(cache_path, media_type="image/jpeg")

    # Get person's first face with bbox
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute("""
        SELECT ph.file_path, f.bbox_x, f.bbox_y, f.bbox_w, f.bbox_h
        FROM faces f
        JOIN photos ph ON f.photo_id = ph.photo_id
        WHERE f.person_id = ?
        ORDER BY f.confidence DESC
        LIMIT 1
    """, (person_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="No face found for person")

    file_path, bbox_x, bbox_y, bbox_w, bbox_h = row

    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Photo file not found")

    try:
        # Open image
        img = Image.open(file_path)

        # Add padding around face (30% on each side)
        padding = int(max(bbox_w, bbox_h) * 0.3)
        x1 = max(0, bbox_x - padding)
        y1 = max(0, bbox_y - padding)
        x2 = min(img.width, bbox_x + bbox_w + padding)
        y2 = min(img.height, bbox_y + bbox_h + padding)

        # Crop to face with padding
        face_img = img.crop((x1, y1, x2, y2))

        # Resize to thumbnail size
        face_img.thumbnail((size, size), Image.Resampling.LANCZOS)

        # Convert to RGB if necessary
        if face_img.mode in ('RGBA', 'LA', 'P'):
            face_img = face_img.convert('RGB')

        # Save to cache
        face_img.save(cache_path, format='JPEG', quality=90, optimize=True)

        # Return cached file
        return FileResponse(
            cache_path,
            media_type="image/jpeg",
            headers={
                "Cache-Control": "public, max-age=31536000, immutable",
                "ETag": cache_key
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error processing face: {str(e)}")


@app.get("/photo/{photo_id}/metadata")
def get_photo_metadata(photo_id: int):
    """Get photo metadata without downloading the full image"""
    import sqlite3
    from PIL import Image

    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT file_path FROM photos WHERE photo_id = ?", (photo_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Photo not found")

    file_path = row[0]
    if not os.path.exists(file_path):
        raise HTTPException(
            status_code=404, detail="Photo file not found on disk")

    try:
        # Get file stats
        file_size = os.path.getsize(file_path)
        filename = os.path.basename(file_path)

        # Get image dimensions without loading full image
        with Image.open(file_path) as img:
            width, height = img.size
            format_name = img.format

        return {
            "photo_id": photo_id,
            "filename": filename,
            "filepath": file_path,
            "size_bytes": file_size,
            "size_kb": round(file_size / 1024, 2),
            "size_mb": round(file_size / (1024 * 1024), 2),
            "dimensions": {
                "width": width,
                "height": height
            },
            "format": format_name
        }
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Error reading metadata: {str(e)}")


@app.get("/photo/{photo_id}/people")
def get_photo_people(photo_id: int, current_user=Depends(get_current_user)):
    """Get the people (persons) detected in a specific photo"""
    import sqlite3
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT ph.photo_id FROM photos ph WHERE ph.photo_id = ?", (photo_id,))
    if not cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=404, detail="Photo not found")
    cursor.execute("""
        SELECT DISTINCT p.person_id, p.name
        FROM faces f
        JOIN persons p ON f.person_id = p.person_id
        WHERE f.photo_id = ?
        ORDER BY p.name
    """, (photo_id,))
    rows = cursor.fetchall()
    conn.close()
    return {"people": [{"person_id": r[0], "name": r[1]} for r in rows]}


def get_stats():
    """Get system statistics"""
    import sqlite3

    persons = db.get_all_persons()
    embeddings, _ = db.get_all_embeddings()

    # Get total photos count from database
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM photos")
    total_photos = cursor.fetchone()[0]
    conn.close()

    return {
        "total_photos": total_photos,
        "total_faces": len(embeddings),
        "total_persons": len(persons)
    }


@app.post("/migrate-to-albums")
def migrate_to_albums(user_id: int = Depends(get_current_user)):
    """Migrate existing data to use albums (for existing databases)"""
    import sqlite3

    try:
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        # Check if there are any photos without album_id
        cursor.execute("SELECT COUNT(*) FROM photos WHERE album_id IS NULL")
        orphaned_photos = cursor.fetchone()[0]

        if orphaned_photos == 0:
            conn.close()
            return {"status": "success", "message": "No migration needed - all data already has albums"}

        # Create a default album for existing data with current user as admin
        cursor.execute("""
            INSERT INTO albums (name, folder_path, admin_user_id, created_at)
            VALUES ('Existing Photos', 'Migrated from old database', ?, datetime('now'))
        """, (user_id,))
        default_album_id = cursor.lastrowid

        # Update all photos without album_id
        cursor.execute(
            "UPDATE photos SET album_id = ? WHERE album_id IS NULL", (default_album_id,))
        updated_photos = cursor.rowcount

        # Update all persons without album_id
        cursor.execute(
            "UPDATE persons SET album_id = ? WHERE album_id IS NULL", (default_album_id,))
        updated_persons = cursor.rowcount

        conn.commit()
        conn.close()

        return {
            "status": "success",
            "message": f"Migrated {updated_photos} photos and {updated_persons} people to default album",
            "album_id": default_album_id,
            "album_name": "Existing Photos"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/assign-admin-to-albums")
def assign_admin_to_albums(user_id: int = Depends(get_current_user)):
    """Assign current user as admin to all albums without an admin"""
    import sqlite3

    try:
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        # Update all albums without admin_user_id
        cursor.execute(
            "UPDATE albums SET admin_user_id = ? WHERE admin_user_id IS NULL", (user_id,))
        updated_albums = cursor.rowcount

        conn.commit()
        conn.close()

        return {
            "status": "success",
            "message": f"Assigned you as admin to {updated_albums} album(s)",
            "updated_count": updated_albums
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/profile-photo/{user_id}")
def get_profile_photo(user_id: int, request: Request):
    """Serve a user's profile photo"""
    user = db.get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    photo_path = user.get("profile_photo_path")
    if not photo_path or not os.path.exists(photo_path):
        raise HTTPException(status_code=404, detail="Profile photo not found")

    origin = request.headers.get("origin", "http://localhost:3000")
    return FileResponse(
        photo_path,
        media_type="image/jpeg",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": origin,
            "Access-Control-Allow-Credentials": "true",
        }
    )


@app.delete("/album/{album_id}")
def delete_album(album_id: int, user_id: int = Depends(get_current_user)):
    """Delete an album and all its data (admin only)"""
    verify_album_admin(album_id, user_id)

    import sqlite3
    try:
        conn = sqlite3.connect(db.db_path)
        cursor = conn.cursor()

        # Delete faces belonging to this album's photos
        cursor.execute("""
            DELETE FROM faces
            WHERE photo_id IN (
                SELECT photo_id FROM photos WHERE album_id = ?
            )
        """, (album_id,))

        # Delete persons in this album
        cursor.execute("DELETE FROM persons WHERE album_id = ?", (album_id,))

        # Delete photos in this album
        cursor.execute("DELETE FROM photos WHERE album_id = ?", (album_id,))

        # Delete invite links
        cursor.execute(
            "DELETE FROM album_invites WHERE album_id = ?", (album_id,))

        # Delete member associations
        cursor.execute(
            "DELETE FROM album_members WHERE album_id = ?", (album_id,))

        # Delete the album itself
        cursor.execute("DELETE FROM albums WHERE album_id = ?", (album_id,))

        conn.commit()
        conn.close()

        # Rebuild search index since faces were removed
        embeddings, face_ids = db.get_all_embeddings()
        search_engine.build_index(embeddings, face_ids)

        return {"status": "success", "message": "Album deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class TransferAdminRequest(BaseModel):
    new_admin_user_id: int


class BlockMemberRequest(BaseModel):
    pass  # user_id is in the path


@app.post("/album/{album_id}/transfer-admin")
def transfer_album_admin(album_id: int, request: TransferAdminRequest,
                         user_id: int = Depends(get_current_user)):
    """Transfer admin rights to another album member (current admin only)"""
    verify_album_admin(album_id, user_id)

    if request.new_admin_user_id == user_id:
        raise HTTPException(
            status_code=400, detail="You are already the admin")

    # New admin must already be a member
    if not db.is_album_member(album_id, request.new_admin_user_id):
        raise HTTPException(status_code=400,
                            detail="New admin must already be a member of the album")

    new_admin = db.get_user_by_id(request.new_admin_user_id)
    if not new_admin:
        raise HTTPException(status_code=404, detail="User not found")

    import sqlite3
    conn = sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute("UPDATE albums SET admin_user_id = ? WHERE album_id = ?",
                   (request.new_admin_user_id, album_id))
    conn.commit()
    conn.close()

    return {
        "status": "success",
        "message": f"Admin rights transferred to {new_admin['username']}"
    }


@app.delete("/photo/{photo_id}")
def delete_photo(photo_id: int, user_id: int = Depends(get_current_user)):
    """Delete a photo (album admin only)"""
    import sqlite3 as _sqlite3
    conn = _sqlite3.connect(db.db_path)
    cursor = conn.cursor()
    cursor.execute(
        "SELECT album_id FROM photos WHERE photo_id = ?", (photo_id,))
    row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="Photo not found")

    album_id = row[0]
    verify_album_admin(album_id, user_id)

    file_path = db.delete_photo(photo_id)

    # Rebuild FAISS index since embeddings changed
    try:
        embeddings, face_ids = db.get_all_embeddings()
        if embeddings:
            search_engine.build_index(embeddings, face_ids)
    except Exception:
        pass

    return {"status": "success", "message": "Photo deleted"}


@app.post("/album/{album_id}/members/{target_user_id}/block")
def block_album_member(album_id: int, target_user_id: int,
                       user_id: int = Depends(get_current_user)):
    """Block a member from an album (admin only)"""
    verify_album_admin(album_id, user_id)

    if target_user_id == user_id:
        raise HTTPException(status_code=400, detail="Cannot block yourself")

    # Remove from active members first
    if db.is_album_member(album_id, target_user_id):
        db.remove_album_member(album_id, target_user_id)

    db.block_member(album_id, target_user_id, user_id)

    return {"status": "success", "message": "Member blocked"}


@app.delete("/album/{album_id}/members/{target_user_id}/block")
def unblock_album_member(album_id: int, target_user_id: int,
                         user_id: int = Depends(get_current_user)):
    """Unblock a previously blocked member (admin only)"""
    verify_album_admin(album_id, user_id)

    db.unblock_member(album_id, target_user_id)

    return {"status": "success", "message": "Member unblocked"}


@app.get("/album/{album_id}/blocked")
def get_blocked_members(album_id: int, user_id: int = Depends(get_current_user)):
    """Get blocked members list (admin only)"""
    verify_album_admin(album_id, user_id)

    blocked = db.get_blocked_members(album_id)
    return {"blocked": blocked}


@app.post("/auth/update-profile")
async def update_profile_photo(
    profile_photo: UploadFile = File(...),
    user_id: int = Depends(get_current_user)
):
    """Update the current user's profile photo"""
    temp_path = os.path.join(tempfile.gettempdir(),
                             f"profile_update_{secrets.token_hex(8)}.jpg")
    with open(temp_path, "wb") as f:
        f.write(await profile_photo.read())

    try:
        faces = detector.detect_faces(temp_path)
        if len(faces) == 0:
            raise HTTPException(
                status_code=400, detail="No face detected in photo")
        if len(faces) > 1:
            raise HTTPException(status_code=400,
                                detail="Multiple faces detected. Please upload a photo with only your face")

        face_embedding = faces[0]["embedding"]

        user = db.get_user_by_id(user_id)
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        # Remove old profile photo
        old_path = user.get("profile_photo_path")
        if old_path and os.path.exists(old_path):
            try:
                os.remove(old_path)
            except Exception:
                pass

        # Save new profile photo
        profile_filename = f"{user['username']}_{secrets.token_hex(4)}.jpg"
        profile_path = os.path.join(PROFILE_PHOTOS_DIR, profile_filename)
        os.rename(temp_path, profile_path)

        db.update_user_profile_photo(user_id, profile_path, face_embedding)

        return {"status": "success", "message": "Profile photo updated"}

    except HTTPException:
        raise
    except Exception as e:
        if os.path.exists(temp_path):
            os.remove(temp_path)
        raise HTTPException(status_code=500, detail=f"Update failed: {str(e)}")


@app.delete("/auth/account")
def delete_account(session_token: Optional[str] = Cookie(None),
                   user_id: int = Depends(get_current_user)):
    """Delete the current user's account"""
    # Remove session
    if session_token:
        db.delete_session(session_token)

    # Delete from DB (returns profile photo path)
    profile_path = db.delete_user(user_id)

    # Clean up profile photo file
    if profile_path and os.path.exists(profile_path):
        try:
            os.remove(profile_path)
        except Exception:
            pass

    response = Response(
        content=json.dumps(
            {"status": "success", "message": "Account deleted"}),
        media_type="application/json"
    )
    response.delete_cookie(key="session_token")
    return response


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
        workers=1,  # Single worker for development
        limit_concurrency=100,  # Allow 100 concurrent connections
        timeout_keep_alive=30
    )
