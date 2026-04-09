# 📸 Lumina Photo Gallery

A full-stack AI-powered photo gallery application with Pinterest-style masonry layout, virtual try-on, and an intelligent image agent.

![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Vite](https://img.shields.io/badge/Vite-5-646CFF?logo=vite) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-06B6D4?logo=tailwindcss) ![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express) ![SQLite](https://img.shields.io/badge/SQLite-3-003B57?logo=sqlite)

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 18+ — [Download](https://nodejs.org/)
- **Ollama** (optional, for AI Agent) — [Download](https://ollama.com/)

### Installation

```bash
# Clone the repository
git clone https://github.com/Ashokbtech87/Photo_Gal.git
cd Photo_Gal

# Install server dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### Running the Application

**Start the backend server:**

```bash
cd server
node index.js
# Server runs on http://localhost:3001
```

**Start the frontend (new terminal):**

```bash
cd client
npx vite --host
# App runs on http://localhost:5173
```

Open **http://localhost:5173** in your browser.

---

## 📖 How to Use

### 1. Register & Login

- Click **Register** to create an account (username, email, password).
- Login with your **username or email** and password.

### 2. Upload Photos

- Go to **Upload** from the navbar.
- Drag & drop or click to select images (up to 20MB each).
- Optionally assign photos to an album during upload.
- Photos are automatically processed with thumbnails and blur placeholders.

### 3. Gallery

- The home page shows all photos in a **Pinterest-style masonry grid**.
- **Search** photos by title using the search bar.
- **Hover** over any photo to see action buttons:
  - ✏️ **Rename** — click the pencil icon to edit the title inline.
  - ⬇️ **Download** — save the original image.
  - 🗑️ **Delete** — remove the photo.
- Click any photo to open the **Lightbox** (full-screen viewer with keyboard navigation).

#### Bulk Operations

- Click **Select** to enter selection mode.
- Use **Select All** to select everything.
- Then use the action bar to:
  - 📦 **Bulk Download** — downloads selected photos as a ZIP file.
  - ✏️ **Bulk Rename** — rename with a base name + sequence numbers (e.g., `vacation_001`), with mandatory album assignment.
  - 🗑️ **Bulk Delete** — delete all selected photos.

### 4. Albums

- Go to **Albums** from the navbar.
- Click **New Album** to create one (with title, description, and visibility).
- Each album card shows a cover thumbnail, photo count, and a **visibility badge** (🔒 Private / 🌐 Public).

#### On Album Cards (hover):

- 🔒/🌐 **Toggle Visibility** — switch between public and private.
- ✏️ **Rename** — inline edit the album title.
- 🗑️ **Delete** — remove the album (photos are kept).

#### Inside an Album:

- Click an album card to view its photos.
- **Editable title** — click the pencil next to the album name.
- **Quick Upload** — upload photos directly into the album.
- **Add Existing** — pick photos from your gallery (with Select All).
- **Visibility toggle** — click the badge to switch public/private.
- Bulk operations (select, remove from album, download, rename, delete) are all available.

### 5. Dark / Light Mode

- Click the **🌙/☀️ toggle** in the navbar to switch themes.

---

## 🤖 AI Image Agent

The Agent lets you search the web for images using AI and save them directly to albums.

### Setup

1. Go to the **Agent** page from the navbar.
2. Click the **⚙️ gear icon** to open settings.

### Configuration

| Setting | Description |
|---------|-------------|
| **Ollama Model** | Type or select from your local Ollama models (e.g., `gemma4:31b-cloud`). Saved automatically. |
| **Images per search** | How many images to fetch (1–30). |
| **Image Search Provider** | Choose from the options below. |
| **Auto-save to Album** | Toggle ON to automatically save all found images without manual selection. |
| **Default Album Visibility** | Set new albums as Private 🔒 or Public 🌐. |

### Image Search Providers

| Provider | API Key Required | Description |
|----------|-----------------|-------------|
| 🌐 **Web Search (Free)** | ❌ No | Searches DuckDuckGo Images — works out of the box. |
| 📸 **Pexels** | ✅ Yes | High-quality stock photos. [Get API key](https://www.pexels.com/api/new/) |
| 🖼️ **Unsplash** | ✅ Yes | Beautiful free images. [Get API key](https://unsplash.com/developers) |
| 🔍 **Google API** | ✅ Yes + CX | Google Custom Search. [Get API key](https://developers.google.com/custom-search/v1/introduction). Also needs a [Search Engine ID](https://programmablesearchengine.google.com/controlpanel/all). |
| 🔗 **Custom API** | Optional | Use any REST API endpoint for image search or generation. |

### Custom API Provider

When you select **Custom API**, configure:

- **Mode**: Search (fetch existing images) or Generate (AI-create images).
- **API Endpoint URL**: Your REST endpoint.
- **API Key**: Optional Bearer token.
- **Custom Headers**: JSON object for extra headers.
- **Request Body Template**: JSON with `{{query}}` and `{{count}}` placeholders.
  - Example for DALL·E: `{"model":"dall-e-3","prompt":"{{query}}","n":{{count}},"size":"1024x1024"}`

### How to Use the Agent

1. Select a provider and enter API keys if needed.
2. Type a prompt in the chat bar, e.g.: *"Find me 10 stunning mountain landscape photos at sunset"*
3. The AI (Ollama) generates search queries from your prompt.
4. Images appear in a grid — all pre-selected.
5. Deselect any you don't want.
6. Choose **New Album** or **Existing Album**.
7. Click **Download to Album**.

With **Auto-save ON**, steps 5–7 happen automatically.

---

## 👗 Virtual Try-On

AI-powered virtual clothing try-on using Replicate API.

### Setup

1. Go to **Settings** from the navbar (or click the user menu).
2. Choose an AI Provider:
   - **Replicate** — enter your [Replicate API key](https://replicate.com/account/api-tokens).
   - **Custom** — use your own endpoint.
3. Select a try-on model (IDM-VTON, Fashn TryOn, or custom).
4. Click **Verify** to test the connection.

### How to Use Try-On

1. Go to **Try-On** from the navbar.
2. Follow the 4-step wizard:

| Step | Action |
|------|--------|
| **1. Person Photo** | Select a full-body photo from your gallery or upload one. |
| **2. Garment Photo** | Select the clothing item photo. |
| **3. Configure** | Choose the garment category (upper body, lower body, full body). |
| **4. Generate** | Click Generate and wait for the AI to produce the result. |

3. View the result with a **Compare** slider (before/after).
4. **Save to Gallery** or **Download** the result.
5. Check your **History** panel on the right to revisit past try-ons.

---

## 🗂️ Project Structure

```
Photo_Gal/
├── client/                   # React frontend
│   ├── src/
│   │   ├── api/              # API client (auth, photos, albums, agent, tryon, settings)
│   │   ├── components/       # Reusable UI (Navbar, PhotoCard, MasonryGrid, Lightbox, etc.)
│   │   ├── context/          # Auth & Theme context providers
│   │   ├── hooks/            # Custom hooks (useIntersection)
│   │   ├── pages/            # Route pages (Home, Albums, AlbumView, AIAgent, VirtualTryOn, etc.)
│   │   ├── index.css         # Tailwind + custom styles
│   │   └── main.jsx          # App entry point
│   ├── tailwind.config.js
│   └── vite.config.js
├── server/                   # Express backend
│   ├── db/                   # SQLite database setup & migrations
│   ├── middleware/            # JWT auth & multer upload middleware
│   ├── routes/               # API routes (auth, photos, albums, agent, tryon, settings)
│   └── index.js              # Server entry point
├── uploads/                  # Uploaded images & thumbnails (gitignored)
└── package.json              # Server dependencies
```

---

## 🛠️ Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React 18, Vite 5, Tailwind CSS 3.4, Framer Motion 11, React Router 6 |
| **Backend** | Express 4.18, better-sqlite3, Sharp, multer, JWT, bcryptjs, archiver |
| **AI Agent** | Ollama (local LLM), DuckDuckGo image search, Pexels/Unsplash/Google APIs |
| **Try-On** | Replicate API (IDM-VTON, Fashn TryOn) |
| **Storage** | SQLite database, local file system |

---

## 📜 License

This project is for personal/educational use.
