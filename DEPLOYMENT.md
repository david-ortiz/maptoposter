# MapToPoster Deployment Guide

## Quick Start (Docker)

```bash
# Clone and deploy
git clone <your-repo-url> maptoposter
cd maptoposter
docker-compose up -d --build

# Access at http://your-server:5000
```

---

## System Requirements

- **Docker**: 20.10+
- **Docker Compose**: 2.0+
- **Disk Space**: ~2GB (image + cache)
- **RAM**: 2GB minimum, 4GB recommended
- **CPU**: 2+ cores recommended for concurrent requests

---

## Docker Configuration

### Dockerfile

```dockerfile
FROM python:3.11-slim

# System dependencies for geopandas/osmnx
RUN apt-get update && apt-get install -y \
    libgdal-dev \
    libgeos-dev \
    libproj-dev \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN pip install --no-cache-dir gunicorn

COPY . .
RUN mkdir -p posters cache

EXPOSE 5000

CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "2", "--threads", "4", "--timeout", "300", "app:app"]
```

### docker-compose.yml

```yaml
version: '3.8'

services:
  maptoposter:
    build: .
    ports:
      - "5000:5000"
    volumes:
      - ./posters:/app/posters    # Persist generated posters
      - ./cache:/app/cache        # Persist map data cache
    environment:
      - FLASK_ENV=production
    restart: unless-stopped
```

---

## Deployment Commands

### Build and Start
```bash
docker-compose up -d --build
```

### View Logs
```bash
docker-compose logs -f
```

### Restart Service
```bash
docker-compose restart
```

### Stop Service
```bash
docker-compose down
```

### Rebuild After Code Changes
```bash
docker-compose up -d --build
```

### Clean Rebuild (remove cache)
```bash
docker-compose down
docker system prune -f
docker-compose up -d --build
```

---

## Production Configuration

### Reverse Proxy (Nginx)

```nginx
server {
    listen 80;
    server_name maps.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 300s;  # Long timeout for poster generation
    }

    # Serve generated posters directly
    location /posters/ {
        alias /path/to/maptoposter/posters/;
        expires 7d;
    }
}
```

### SSL with Let's Encrypt

```bash
sudo certbot --nginx -d maps.yourdomain.com
```

---

## Performance Tuning

### Gunicorn Workers

Adjust in Dockerfile CMD based on CPU cores:
- Formula: `(2 × CPU cores) + 1`
- 2 cores: 4-5 workers
- 4 cores: 8-9 workers

```dockerfile
CMD ["gunicorn", "--bind", "0.0.0.0:5000", "--workers", "5", "--threads", "4", "--timeout", "300", "app:app"]
```

### Cache Persistence

The `cache/` volume stores:
- OSM data cache (from osmnx)
- Map data cache (pre-computed map layers)

Preserving cache significantly speeds up repeat requests for the same locations.

---

## Troubleshooting

### Common Issues

**Port already in use:**
```bash
# Change port in docker-compose.yml
ports:
  - "8080:5000"  # Use 8080 instead
```

**Out of memory during build:**
```bash
# Increase Docker memory limit or use swap
docker-compose build --memory 4g
```

**Rate limiting from Overpass API:**
The app uses alternative Overpass servers. If issues persist, check `create_map_poster.py` line 33 and try:
- `https://overpass.kumi.systems/api/`
- `https://lz4.overpass-api.de/api/`

**Poster generation timeout:**
Increase timeout in Dockerfile (default 300s = 5 min):
```dockerfile
CMD ["gunicorn", ... "--timeout", "600", ...]
```

---

## File Structure

```
maptoposter/
├── app.py                 # Flask application
├── create_map_poster.py   # Poster generation logic
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── fonts/                 # Custom fonts (79 families)
├── themes/                # Theme JSON files (150+ themes)
├── templates/
│   └── index.html         # Web interface
├── static/
│   ├── app.js             # Frontend JavaScript
│   ├── styles.css         # Styles
│   └── preview-map.svg    # Preview widget SVG
├── posters/               # Generated posters (gitignored)
└── cache/                 # Map data cache (gitignored)
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `FLASK_ENV` | `production` | Flask environment mode |
| `PORT` | `5000` | Server port |

---

## Scaling

For high traffic, consider:

1. **Load Balancer**: Multiple container instances
2. **CDN**: Serve static assets and generated posters
3. **Redis Cache**: Share map data cache across instances
4. **Queue System**: Background job processing for poster generation

---

## Backup

```bash
# Backup generated posters
tar -czf posters-backup-$(date +%Y%m%d).tar.gz posters/

# Backup cache (optional, can be regenerated)
tar -czf cache-backup-$(date +%Y%m%d).tar.gz cache/
```

---

## Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up -d --build
```
