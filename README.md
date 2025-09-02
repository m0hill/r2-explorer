# R2 Explorer

A desktop application for managing Cloudflare R2 storage buckets with an intuitive graphical interface. Built with Electron, React, and TypeScript.

## Features

### 🔗 Connection Management
- Secure storage of R2 credentials with encryption
- Multiple account support
- Easy connection switching

### 📦 Bucket Operations
- List all buckets in your account
- Create new buckets
- Delete existing buckets
- View bucket creation dates

### 📁 Object Management
- Browse objects and folders hierarchically
- Upload files and folders
- Download individual files or bulk downloads
- Delete objects with confirmation
- Create folders
- Bulk operations (select multiple items)

### 🔒 Sharing & Security
- Share individual files with presigned URLs
- Share entire folders publicly with optional PIN protection
- Automatic Cloudflare Worker provisioning for shares
- Secure, time-limited access links

### 🎨 User Experience
- Modern, responsive UI built with TailwindCSS
- Dark/light theme support
- Progress indicators for uploads
- Intuitive navigation with breadcrumbs
- Drag-and-drop file uploads

## Architecture

### Tech Stack
- **Frontend**: React 19, TypeScript, TailwindCSS, Radix UI
- **Desktop**: Electron with secure IPC communication
- **Backend**: Effect for functional programming
- **Database**: SQLite with Drizzle ORM
- **Cloud**: Cloudflare R2, Cloudflare Workers
- **Build**: Vite, Electron Forge

### Project Structure
```
src/
├── main/           # Electron main process
│   ├── db/         # Database schema and operations
│   └── ipc/        # Inter-process communication handlers
├── components/     # React UI components
│   ├── ui/         # Reusable UI components
│   └── ...         # Feature-specific components
├── lib/            # Utilities and helpers
└── preload.ts      # Electron preload script

cloudflare-worker/  # Worker for public folder sharing
drizzle/           # Database migrations
```

## Installation

### Prerequisites
- Node.js 18+
- pnpm package manager
- Cloudflare account with R2 enabled

### Setup
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd r2-explorer
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Start development server:
   ```bash
   pnpm start
   ```

### Build for Production
```bash
# Create distributable package
pnpm make
```

## Usage

### Getting Started
1. Launch the application
2. Add your first R2 connection:
   - Enter connection name
   - Provide Account ID, Access Key ID, and Secret Access Key
   - Optionally add Cloudflare API token for automatic Worker provisioning
3. Connect to your R2 account
4. Start exploring your buckets!

### Managing Buckets
- **Create**: Use the "Create New Bucket" form
- **Browse**: Click on any bucket name to explore its contents
- **Delete**: Use the delete button (with confirmation)

### Working with Objects
- **Upload**: Click "Upload" to select files/folders
- **Download**: Click download button next to any file
- **Navigate**: Click on folders to navigate deeper
- **Bulk Operations**: Select multiple items for batch actions

### Sharing Content
- **Share Files**: Click share button next to any file for a secure link
- **Share Folders**: Click share button next to folders to create public access
- **PIN Protection**: Optionally add 4-digit PIN for folder shares
- **Worker Provisioning**: Automatic setup of Cloudflare Worker for sharing

## Development

### Available Scripts
- `pnpm start` - Start development server
- `pnpm package` - Build application package
- `pnpm make` - Create distributable installer
- `pnpm lint` - Run linter (oxlint)
- `pnpm format` - Format code (Biome)
- `pnpm typecheck` - TypeScript type checking
- `pnpm db:generate` - Generate database migrations
- `pnpm db:migrate` - Run database migrations

### Code Style
- **Formatter**: Biome (2-space indentation, 100 char width, single quotes)
- **TypeScript**: Strict mode enabled
- **Imports**: Use `@/*` path aliases
- **React**: Functional components with hooks
- **State**: Prefer derived state over useEffect

### Database
The application uses SQLite with Drizzle ORM for local data storage:
- **Connections**: Encrypted storage of R2 credentials
- **Presigned URLs**: Cached temporary access links
- **Folder Shares**: Metadata for shared folders

## Security

- **Credential Encryption**: All sensitive data is encrypted using Electron's safe storage
- **Secure IPC**: Isolated communication between main and renderer processes
- **Presigned URLs**: Time-limited, secure access to private objects
- **PIN Protection**: Optional authentication for shared folders
