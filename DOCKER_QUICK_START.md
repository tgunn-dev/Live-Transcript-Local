# Docker Quick Start Guide

Get the Parakeet TDT application running in Docker on any system.

## Quick Start (All Systems)

### 1. Prerequisites
- Docker Desktop installed (https://www.docker.com/products/docker-desktop)
- Port 3001 and 8000 available

### 2. Clone and Setup
```bash
git clone https://github.com/tgunn-dev/Live-Transcript-Local.git
cd Live-Transcript-Local
```

### 3. Run with Docker Compose
```bash
# Start development environment
docker-compose up

# Or run in background
docker-compose up -d

# View logs
docker-compose logs -f
```

### 4. Access the Application
- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:8000

### 5. Stop the Application
```bash
# Stop and remove containers
docker-compose down

# Remove all data (database, volumes)
docker-compose down -v
```

## System-Specific Notes

### macOS/Windows (Docker Desktop)

**CPU Only** - Docker Desktop runs efficiently on both systems
```bash
docker-compose up
```

**GPU** - Limited GPU support on macOS. Windows users with NVIDIA GPU should follow [DOCKER_GPU_SETUP.md](DOCKER_GPU_SETUP.md)

### Linux

**CPU Only:**
```bash
docker-compose up
```

**GPU** - Follow [DOCKER_GPU_SETUP.md](DOCKER_GPU_SETUP.md) for full NVIDIA GPU setup

## Common Issues & Solutions

### Port Already In Use

If port 3001 or 8000 is already in use:

```bash
# Change frontend port in docker-compose.yml:
ports:
  - "3002:3000"  # Changed from 3001:3000

# Or find and kill the process:
# macOS/Linux
lsof -i :3001
kill -9 <PID>

# Windows
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### Models Not Downloading

The first run downloads ~1.5GB of models. This takes time.

**Signs it's working:**
- You see model download progress in logs
- Container is still running

**If it's stuck for >5 minutes:**
```bash
# Check container logs
docker logs parakeet-backend

# Check internet connection
docker exec parakeet-backend curl https://huggingface.co -v

# Restart
docker-compose restart backend
```

### "Cannot connect to backend"

**Check logs:**
```bash
docker logs parakeet-backend
docker logs parakeet-frontend
```

**Common causes:**
- Backend not fully started yet (wait 30-60 seconds)
- Models still downloading
- Port conflict

**Solutions:**
```bash
# Wait for backend to be ready
docker-compose logs -f backend | grep "Uvicorn running"

# Check if containers are running
docker-compose ps

# Restart both
docker-compose restart
```

### "Docker: command not found"

**Solution**: Install Docker Desktop from https://www.docker.com/products/docker-desktop

### High CPU Usage During Transcription

This is normal! Audio transcription is CPU/GPU intensive.
- **CPU only**: 1-10 minutes per audio minute is normal
- **GPU**: 5-10 seconds per audio minute

To monitor:
```bash
# macOS/Linux
docker stats

# See real-time container stats
docker stats --no-stream
```

### Database Errors

**To reset the database:**
```bash
docker-compose down -v
docker-compose up
```

This removes all transcripts and starts fresh.

## Production Deployment

For production use, see [docker-compose.prod.yml](docker-compose.prod.yml):

```bash
docker-compose -f docker-compose.prod.yml up -d
```

This uses:
- Production Next.js build
- PostgreSQL database (optional)
- Healthchecks and auto-restart
- Optimized settings

## Environment Variables

Copy `.env.example` to `.env` and customize:

```bash
cp .env.example .env
```

Edit `.env` to configure:
- Database URL
- API URLs for different environments
- GPU settings

## Next Steps

- **Frontend customization**: See [frontend/README.md](frontend/README.md)
- **Backend customization**: See backend README or [CLAUDE.md](CLAUDE.md)
- **GPU setup**: See [DOCKER_GPU_SETUP.md](DOCKER_GPU_SETUP.md)
- **Troubleshooting**: See [CLAUDE.md](CLAUDE.md) troubleshooting section

## Getting Help

If you encounter issues:

1. Check this guide's troubleshooting section
2. Check container logs: `docker logs parakeet-backend` and `docker logs parakeet-frontend`
3. Check [CLAUDE.md](CLAUDE.md) troubleshooting section
4. Report issues: https://github.com/tgunn-dev/Live-Transcript-Local/issues
