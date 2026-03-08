# FaceVault - Local AI Face Recognition Photo Organizer

A powerful, privacy-focused photo management system that uses advanced AI to automatically detect faces, organize photos by person, and provide intelligent search capabilities. All processing happens locally on your device - your photos never leave your computer.

## ✨ Features

### Core Functionality
- 🔍 **Advanced Face Detection** - Uses InsightFace (RetinaFace) for accurate face detection
- 🧠 **Face Recognition** - ArcFace embeddings for robust face matching
- 👥 **Smart Clustering** - HDBSCAN automatically groups faces by person
- 🔎 **Vector Search** - FAISS-powered similarity search to find faces instantly
- 🖼️ **Modern Web Interface** - Beautiful, responsive gallery with lightbox viewer
- 🏷️ **Person Management** - Rename people and merge duplicate clusters
- 🔒 **100% Private** - All processing happens locally, no cloud, no external APIs

### User Experience
- 📊 **Real-time Progress** - Live updates during photo scanning with SSE
- 🖼️ **Optimized Gallery** - Lazy loading, thumbnail caching, and smooth performance
- 🔍 **Face Search** - Upload any photo to find similar faces in your collection
- ⚡ **Lightning Fast** - Disk-based caching and optimized image loading
- 🎨 **Beautiful UI** - Modern SaaS-style landing page and polished interface
- ⌨️ **Keyboard Navigation** - Arrow keys and shortcuts for quick browsing
- 📥 **Bulk Downloads** - Download individual photos or entire person collections
- ℹ️ **Image Metadata** - View detailed information about each photo

### Advanced Features
- 🔄 **Auto-Merge** - Configurable threshold to automatically merge duplicate people
- 🔧 **Manual Merge** - Select and merge multiple person clusters manually
- 🔄 **Re-clustering** - Re-process faces with updated parameters
- 🩺 **Data Integrity** - Built-in diagnostics and repair tools
- 🔍 **Search Index** - Rebuild and optimize the face search index
- 🎯 **Face Thumbnails** - Cropped face previews for better recognition

## 🏗️ Architecture

```
Backend (Python/FastAPI)
├── Face Detection (InsightFace/RetinaFace)
├── Face Embeddings (ArcFace - 512-dim vectors)
├── Clustering (HDBSCAN with noise handling)
├── Vector Search (FAISS with L2 distance)
├── Database (SQLite with optimized queries)
└── Caching (Disk-based thumbnail cache)

Frontend (Next.js/React)
├── Landing Page (SaaS-style marketing page)
├── Dashboard (Scan management and stats)
├── People Gallery (Grid view with lazy loading)
├── Person Detail (Photo gallery with lightbox)
├── Face Search (Upload and find similar faces)
└── React Query (Smart caching and state management)
```

## 🚀 Setup

### Prerequisites
- Python 3.9-3.12
- Node.js 18+
- npm or yarn

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Create virtual environment (recommended):
```bash
python -m venv .venv
# Windows
.venv\Scripts\activate
# Linux/Mac
source .venv/bin/activate
```

3. Install Python dependencies:
```bash
pip install -r requirements.txt
```

4. Run the API server:
```bash
python main.py
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run development server:
```bash
npm run dev
```

The web interface will be available at `http://localhost:3000`

## 📖 Usage

### Getting Started
1. Open the web interface at `http://localhost:3000`
2. Click "Get Started" or navigate to Dashboard
3. Enter a folder path containing photos (e.g., `C:\Users\YourName\Pictures`)
4. Click "Start Scan" to process images
5. Watch real-time progress as faces are detected and clustered

### Managing People
1. Navigate to "People" to see all detected persons
2. Click on a person to view all their photos
3. Use "Rename" to give people meaningful names
4. Use "Auto-Merge" to automatically combine duplicate clusters
5. Use "Manual Merge" to select and merge specific people
6. Use "Re-cluster All" to reprocess with updated parameters

### Searching Faces
1. Navigate to "Search"
2. Upload a photo containing a face
3. View similar faces from your collection with similarity scores
4. Click on results to view the full photo

### Viewing Photos
1. Click any photo to open the lightbox viewer
2. Use arrow keys or buttons to navigate
3. Press 'i' or click info button to view metadata
4. Download individual photos or entire collections
5. Press ESC to close the viewer

## 🔌 API Endpoints

### Scanning & Processing
- `POST /scan` - Scan folder and process faces (SSE streaming)
- `POST /recluster` - Re-cluster all faces with updated parameters
- `POST /fix-data` - Fix data integrity issues
- `GET /diagnostics` - Check for data problems

### People Management
- `GET /people` - Get all detected persons with thumbnails
- `GET /person/{id}/photos` - Get photos for a person
- `POST /person/{id}/rename` - Rename a person
- `POST /person/{source_id}/merge/{target_id}` - Merge two people
- `POST /auto-merge?threshold={value}` - Auto-merge similar people

### Photos & Thumbnails
- `GET /photo/{photo_id}` - Get full-resolution photo
- `GET /photo/{photo_id}/thumbnail?size={size}` - Get photo thumbnail
- `GET /photo/{photo_id}/metadata` - Get photo metadata
- `GET /person/{person_id}/face-thumbnail?size={size}` - Get face-cropped thumbnail

### Search
- `POST /search-face` - Search by uploaded face image
- `GET /search-index-status` - Get search index status
- `POST /rebuild-search-index` - Rebuild FAISS search index

### System
- `GET /stats` - Get system statistics (photos, faces, people)
- `GET /` - API health check

## 🛠️ Technology Stack

### Backend
- **Python 3.9-3.12**
- **FastAPI** - Modern async web framework
- **InsightFace** - Face detection and recognition (buffalo_l model)
- **ONNX Runtime** - Optimized model inference
- **HDBSCAN** - Density-based clustering
- **FAISS** - Vector similarity search
- **SQLite** - Lightweight database
- **OpenCV** - Image processing
- **Pillow** - Image manipulation
- **NumPy** - Numerical operations

### Frontend
- **Next.js 14** - React framework with App Router
- **React 18** - UI library
- **TypeScript** - Type safety
- **TailwindCSS** - Utility-first styling
- **React Query** - Data fetching and caching
- **Axios** - HTTP client
- **Intersection Observer** - Lazy loading

## 💾 Database Schema

### Photos
- `photo_id` (INTEGER PRIMARY KEY)
- `file_path` (TEXT UNIQUE)
- `file_hash` (TEXT)
- `timestamp` (DATETIME)

### Faces
- `face_id` (INTEGER PRIMARY KEY)
- `photo_id` (INTEGER FK → photos)
- `person_id` (INTEGER FK → persons)
- `bbox` (TEXT - JSON: x, y, w, h)
- `embedding` (BLOB - 512-dim float32 vector)
- `confidence` (REAL)

### Persons
- `person_id` (INTEGER PRIMARY KEY)
- `cluster_id` (INTEGER)
- `name` (TEXT - default: "Person {id}")

## ⚡ Performance

- **Processing Speed**: ~0.5-1 second per image (CPU)
- **Scalability**: Tested with 10,000+ photos
- **Search Speed**: <100ms for similarity search
- **Caching**: Disk-based thumbnail cache for instant loading
- **Memory**: Efficient streaming and lazy loading
- **Database**: Optimized queries with proper indexing

## 🔐 Privacy & Security

- ✅ **100% Local Processing** - All AI runs on your device
- ✅ **No Cloud Uploads** - Photos never leave your computer
- ✅ **No External APIs** - No third-party services
- ✅ **No Tracking** - No analytics or telemetry
- ✅ **Open Source** - Transparent and auditable code
- ✅ **Your Data, Your Control** - Complete ownership

## 🎯 Use Cases

- **Personal Photo Organization** - Organize family photos by person
- **Event Photography** - Sort event photos by attendees
- **Photo Archiving** - Digitize and organize old photo collections
- **Professional Photography** - Manage client photo sessions
- **Research** - Analyze photo collections for research projects

## 🐛 Troubleshooting

### No faces detected
- Ensure photos contain clear, front-facing faces
- Check that image files are valid (JPEG, PNG)
- Try adjusting clustering parameters

### Duplicate people
- Use "Auto-Merge" with a lower threshold (0.4-0.5)
- Manually merge duplicates using "Manual Merge"

### Slow performance
- Thumbnails are cached after first load
- Ensure sufficient disk space for cache
- Consider using SSD for better performance

### Missing photos
- Run "Fix Data Issues" from Dashboard
- Check that file paths are still valid
- Re-scan if files were moved

## 📝 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- **InsightFace** - Face detection and recognition models
- **FAISS** - Efficient similarity search
- **HDBSCAN** - Robust clustering algorithm
- **FastAPI** - Modern Python web framework
- **Next.js** - React framework for production

## 🚧 Future Enhancements

- [ ] GPU acceleration support
- [ ] Video face detection
- [ ] Face tagging and annotations
- [ ] Export/import functionality
- [ ] Multi-language support
- [ ] Dark mode toggle
- [ ] Advanced filtering and sorting
- [ ] Batch operations
- [ ] Timeline view

---

Built with ❤️ for privacy-conscious photo enthusiasts
