# Docker GPU Setup Guide

This guide explains how to enable GPU acceleration for the Parakeet TDT application in Docker.

## Prerequisites

1. **NVIDIA GPU** - Must have an NVIDIA GPU installed
2. **NVIDIA Drivers** - Install latest drivers from https://www.nvidia.com/Download/driverDetails.aspx
3. **Docker** - Version 19.03 or higher
4. **NVIDIA Container Runtime** - Required to access GPU from Docker

## Installation

### macOS

GPU support in Docker Desktop for Mac is limited. We recommend:
1. Use native installation (see CLAUDE.md)
2. Or deploy to a Linux server with GPU

### Windows

1. Install Docker Desktop with WSL 2 backend
2. Install NVIDIA CUDA Toolkit: https://developer.nvidia.com/cuda-downloads
3. Install NVIDIA Container Runtime for Windows
4. Run Docker with `--gpus all` flag

### Linux (Recommended for GPU)

#### 1. Install NVIDIA Container Runtime

**Ubuntu/Debian:**
```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | \
  sudo tee /etc/apt/sources.list.d/nvidia-docker.list

sudo apt-get update && sudo apt-get install -y nvidia-container-runtime
```

**CentOS/RHEL:**
```bash
distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
yum-config-manager --add-repo https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.repo
sudo yum install -y nvidia-container-runtime
```

#### 2. Restart Docker Daemon
```bash
sudo systemctl restart docker
```

#### 3. Verify Installation
```bash
docker run --rm --gpus all nvidia/cuda:11.8.0-runtime-ubuntu22.04 nvidia-smi
```

## Enable GPU in Docker Compose

### Option 1: For Development (with hot reload)

Edit `docker-compose.yml` and uncomment the GPU section:

```yaml
backend:
  # ... other config ...
  runtime: nvidia
  environment:
    - CUDA_VISIBLE_DEVICES=0
```

Then run:
```bash
docker-compose up
```

### Option 2: For Production

Edit `docker-compose.prod.yml` and uncomment the GPU section:

```yaml
backend:
  runtime: nvidia
  environment:
    - CUDA_VISIBLE_DEVICES=0
```

Then run:
```bash
docker-compose -f docker-compose.prod.yml up -d
```

## Multiple GPUs

If you have multiple GPUs, specify which one to use:

```yaml
environment:
  - CUDA_VISIBLE_DEVICES=0  # Use GPU 0
  # - CUDA_VISIBLE_DEVICES=0,1  # Use GPU 0 and 1
  # - CUDA_VISIBLE_DEVICES=1  # Use only GPU 1
```

Check available GPUs:
```bash
docker run --rm --gpus all nvidia/cuda:11.8.0-runtime-ubuntu22.04 nvidia-smi
```

## Performance Expectations

### CPU Only
- Startup: 1-2 minutes (model loading)
- 1 minute audio → 5-10 minutes transcription
- Memory: ~2-3GB

### GPU (NVIDIA CUDA)
- Startup: 1-2 minutes
- 1 minute audio → 5-10 seconds transcription
- Memory: ~2GB system + ~4GB GPU VRAM

## Troubleshooting

### "docker: Error response from daemon: could not select device driver"
**Solution:**
- Ensure NVIDIA Container Runtime is installed
- Restart Docker daemon: `sudo systemctl restart docker`
- Verify installation: `docker run --rm --gpus all nvidia/cuda:11.8.0-runtime-ubuntu22.04 nvidia-smi`

### "CUDA out of memory"
**Solution:**
- Reduce number of concurrent workers in backend
- Edit `backend/main.py` line ~52: `max_workers=2` (default is 3)
- Or use a smaller Whisper model: `tiny` instead of `base`

### Container starts but GPU not detected
**Solution:**
- Verify `runtime: nvidia` is set in docker-compose.yml
- Check Docker logs: `docker logs parakeet-backend`
- Confirm nvidia-smi works: `docker run --rm --gpus all nvidia/cuda:11.8.0-runtime-ubuntu22.04 nvidia-smi`

### Performance not improving with GPU
**Possible causes:**
- GPU not actually being used (check `nvidia-smi` from within container)
- Model not loaded on GPU (check backend logs)
- Bottleneck is I/O, not computation

**Solution:**
- Monitor GPU usage: `nvidia-smi -l 1` (refresh every second)
- Check Docker logs for errors: `docker logs -f parakeet-backend`

## Fallback (CPU Only)

If GPU setup fails, the application will work on CPU automatically. No changes needed.

```yaml
# Just remove or comment out:
# runtime: nvidia
# environment:
#   - CUDA_VISIBLE_DEVICES=0
```

## Resources

- NVIDIA Container Runtime: https://github.com/NVIDIA/nvidia-docker
- NVIDIA CUDA Support: https://docs.nvidia.com/cuda/
- Docker GPU Support: https://docs.docker.com/config/containers/resource_constraints/#gpu
