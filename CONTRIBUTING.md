# Contributing to FaceVault

Thank you for your interest in contributing! FaceVault is an open-source, privacy-first photo organizer and all contributions are welcome.

---

## Getting Started

1. **Fork** the repository on GitHub
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/FaceVault.git
   cd FaceVault
   ```
3. Set up the development environment (see [README.md](README.md#-quick-start))
4. Create a new branch for your feature or fix:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```
5. Make your changes
6. Commit with a clear message (see [Commit Style](#commit-style))
7. Push and open a Pull Request against `main`

---

## Project Structure

```
backend/    # Python / FastAPI — AI pipeline, database, API routes
frontend/   # Next.js 15 / React 19 — all UI pages and components
data/       # Runtime data — gitignored, created automatically
```

- **Backend changes** usually touch `main.py` (routes), `database.py` (queries), or one of the pipeline modules.
- **Frontend changes** live under `frontend/app/` — each folder is a Next.js App Router route.
- **New API routes** in both the backend and the Next.js proxy (`frontend/app/api/`) may be needed together.

---

## Development Workflow

### Backend

```bash
cd backend
.venv\Scripts\activate          # Windows
source .venv/bin/activate       # macOS/Linux
uvicorn main:app --reload       # auto-restarts on file save
```

### Frontend

```bash
cd frontend
npm run dev                     # hot-reload dev server on :3000
```

### Both servers must run simultaneously.

---

## Commit Style

Use conventional commits:

```
feat: add timeline view for photos
fix: handle EXIF rotation on upload
chore: update insightface to 0.7.4
docs: add GPU setup instructions
refactor: extract thumbnail cache to separate module
```

Keep commits focused — one logical change per commit.

---

## Pull Request Guidelines

- **Target branch**: `main`
- **Title**: short, imperative ("Add Docker Compose setup", "Fix CORS on profile photo")
- **Description**: explain *what* and *why*, not just *how*
- **Screenshots**: include before/after screenshots for UI changes
- **Tests**: if you add a feature, add a test where practical

---

## Areas Most Wanted

| Area | Difficulty | Notes |
|------|-----------|-------|
| Docker Compose | Medium | Single-command startup for the whole stack |
| GPU acceleration | Medium | Replace `onnxruntime` → `onnxruntime-gpu`; document CUDA setup |
| Video support | Hard | Extract frames, detect faces, link back to timestamps |
| Timeline view | Medium | Date-based photo browsing using EXIF timestamp |
| i18n / localization | Easy–Medium | Translate UI strings |
| Manual face correction | Medium | Let users reassign a face to a different person |
| Unit tests (backend) | Easy | pytest for database and route logic |
| Unit tests (frontend) | Easy–Medium | Vitest / React Testing Library |
| macOS / Linux install docs | Easy | Verify steps, add platform-specific notes |

---

## Code Style

### Python
- Follow PEP 8
- Use type hints where practical
- Keep functions focused — one responsibility per function
- Use `Optional[T]` instead of `T | None` for Python < 3.10 compat

### TypeScript / React
- Use functional components and hooks only
- Prefer `useCallback` and `useMemo` for expensive computations
- All new data-fetching should use **TanStack React Query** (`useQuery` / `useMutation`)
- Image endpoints that go through the backend should use the **Next.js proxy routes** in `app/api/` (avoids browser CORS on binary responses)

---

## Reporting Bugs

Open a GitHub Issue with:
- OS and Python / Node.js version
- Steps to reproduce
- Expected vs. actual behavior
- Any error messages or stack traces

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
