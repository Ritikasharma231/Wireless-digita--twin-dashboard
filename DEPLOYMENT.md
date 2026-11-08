# Wireless Digital Twin - Deployment Guide

## Overview

This document provides step-by-step instructions for deploying the Wireless Digital Twin platform for Ad-hoc and Wireless Sensor Networks.

**System Components:**
- Frontend: React + TypeScript + Vite
- Backend: Python + FastAPI + PyTorch
- RL Infrastructure: ST-GCN + PPO + Gymnasium
- Containerization: Docker Compose

---

## Prerequisites

### System Requirements

**Minimum:**
- CPU: 4 cores
- RAM: 8 GB
- Storage: 10 GB free
- OS: Windows 10/11, macOS, or Linux

**Recommended:**
- CPU: 8 cores
- RAM: 16 GB
- Storage: 20 GB free
- GPU: NVIDIA with CUDA support (for training)

### Software Requirements

**Frontend:**
- Node.js >= 18.0.0
- npm >= 9.0.0

**Backend:**
- Python >= 3.9
- pip >= 23.0

**Optional (Docker):**
- Docker >= 24.0
- Docker Compose >= 2.20

---

## Installation

### Step 1: Clone Repository

```bash
git clone <repository-url>
cd Wireless_digital_twin
```

### Step 2: Install Frontend Dependencies

```bash
cd frontend
npm install
```

**Key Dependencies:**
- React 18
- TypeScript 5
- Vite 5
- Three.js (3D visualization)
- Force-graph (network topology)
- Lucide React (icons)
- Tailwind CSS 3.4

### Step 3: Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Key Dependencies:**
- FastAPI 0.104
- Uvicorn 0.24
- PyTorch 2.1
- Torch Geometric 2.4
- Gymnasium 0.29
- NumPy 1.26
- Pandas 2.1

---

## Development Mode

### Start Frontend (Development)

```bash
cd frontend
npm start
```

The frontend will be available at: `http://localhost:5173`

### Start Backend (Development)

**Windows:**
```bash
cd backend
python -m uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

**macOS/Linux:**
```bash
cd backend
uvicorn api.main:app --reload --host 0.0.0.0 --port 8000
```

The backend will be available at: `http://localhost:8000`

**API Documentation:**
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

---

## Production Build

### Build Frontend

```bash
cd frontend
npm run build
```

The optimized build will be in the `dist/` directory.

### Start Frontend (Production)

```bash
cd frontend
npm run preview
```

Or serve with a web server:

```bash
npm install -g serve
serve -s dist -l 3000
```

### Start Backend (Production)

```bash
cd backend
uvicorn api.main:app --host 0.0.0.0 --port 8000 --workers 4
```

---

## Docker Deployment

### Using Docker Compose (Recommended)

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

**Services:**
- `frontend` - React app (port 3000)
- `backend` - FastAPI (port 8000)
- `redis` - Caching (port 6379)

### Manual Docker Build

**Frontend:**
```bash
cd frontend
docker build -t wireless-twin-frontend .
docker run -p 3000:3000 wireless-twin-frontend
```

**Backend:**
```bash
cd backend
docker build -t wireless-twin-backend .
docker run -p 8000:8000 wireless-twin-backend
```

---

## Configuration

### Frontend Configuration

Create `.env` file in `frontend/` directory:

```env
VITE_API_URL=http://localhost:8000
VITE_WS_URL=ws://localhost:8000
```

### Backend Configuration

Create `.env` file in `backend/` directory:

```env
API_HOST=0.0.0.0
API_PORT=8000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
REDIS_URL=redis://localhost:6379
LOG_LEVEL=info
```

---

## Health Checks

### Frontend Health Check

```bash
curl http://localhost:3000
```

Expected: HTML response with React app

### Backend Health Check

```bash
curl http://localhost:8000/health
```

Expected: `{"status":"healthy","st_gcn_loaded":true}`

### RL Agent Health Check

```bash
curl http://localhost:8000/agents/default/stats
```

Expected: Agent statistics JSON

---

## Troubleshooting

### Common Issues

**1. Port Already in Use**

```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F

# macOS/Linux
lsof -ti:5173 | xargs kill -9
```

**2. CORS Errors**

Add your frontend URL to `CORS_ORIGINS` in backend `.env`:

```env
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://localhost:5174
```

**3. Backend Fails to Start**

Check Python version:

```bash
python --version  # Should be >= 3.9
```

Reinstall dependencies:

```bash
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

**4. PyTorch CUDA Issues**

If you don't have CUDA, install CPU version:

```bash
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cpu
```

**5. Docker Permission Denied (Linux)**

```bash
sudo usermod -aG docker $USER
newgrp docker
```

---

## Performance Tuning

### Frontend Optimization

- Enable production build mode
- Use CDN for static assets
- Enable gzip compression (web server)
- Implement lazy loading for large components

### Backend Optimization

- Increase worker count: `--workers 8`
- Enable Redis caching
- Use GPU for training if available
- Optimize batch sizes for training

### System Optimization

- Allocate sufficient RAM
- Use SSD for faster I/O
- Enable hardware acceleration
- Monitor CPU/GPU usage

---

## Security Considerations

### Production Checklist

- [ ] Change default ports
- [ ] Enable HTTPS (SSL/TLS)
- [ ] Set strong CORS policies
- [ ] Implement rate limiting
- [ ] Add authentication (if needed)
- [ ] Secure API endpoints
- [ ] Enable firewall rules
- [ ] Regular security updates

### Environment Variables

Never commit `.env` files to version control. Use:

```bash
# Add to .gitignore
.env
.env.local
.env.production
```

---

## Monitoring

### Logs

**Frontend Logs:**
- Browser console (F12)
- Vite dev server logs

**Backend Logs:**
- Uvicorn logs
- Application logs (backend/logs/)

**Docker Logs:**
```bash
docker-compose logs -f frontend
docker-compose logs -f backend
```

### Metrics

The dashboard displays real-time metrics:
- Total packets
- Successful packets
- Failed packets
- Average latency
- Throughput
- Packet loss rate
- Energy consumption
- Sync statistics

---

## Backup and Recovery

### Database Backup

```bash
# Redis backup
docker exec redis redis-cli SAVE
docker cp redis:/data/dump.rdb ./backup/
```

### Configuration Backup

```bash
# Backup .env files
cp frontend/.env ./backup/frontend.env
cp backend/.env ./backup/backend.env
```

### Model Backup

```bash
# Backup trained models
cp backend/models/*.pt ./backup/models/
```

---

## Scaling

### Horizontal Scaling

**Frontend:**
- Use load balancer (Nginx, HAProxy)
- Deploy multiple instances
- Use CDN for static assets

**Backend:**
- Use multiple workers
- Deploy behind load balancer
- Use Redis for shared state

### Vertical Scaling

- Increase CPU cores
- Add more RAM
- Use GPU for training
- Optimize database queries

---

## Support

### Documentation

- Architecture: `NDT_GAP_ANALYSIS.md`
- System Status: `SYSTEM_STATUS.md`
- RL Integration: `RL_ROUTING_INTEGRATION.md`
- MDP Environment: `MDP_ENVIRONMENT_WRAPPER.md`

### Issues

Report issues at: `<repository-url>/issues`

---

## Version History

- **v1.0.0** (2026-11-08): Initial production deployment
  - Event-triggered sync
  - Dynamic threshold calculation
  - Dashboard data persistence
  - RL integration complete

---

## License

[Your License Here]

---

## Contact

For deployment support, contact: [Your Email]
