# Dockerfile.minimal - Optimized for minimal size
FROM python:3.11-slim as builder

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Copy and install requirements
COPY requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# Production stage
FROM python:3.11-slim

# Install only runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create non-root user
RUN useradd --create-home --shell /bin/bash app

# Copy installed packages from builder
COPY --from=builder /root/.local /home/app/.local
ENV PATH=/home/app/.local/bin:$PATH

# Set working directory
WORKDIR /app

# Copy application code (only essential files)
COPY --chown=app:app main.py ./
COPY --chown=app:app app/ ./app/

# Switch to non-root user
USER app

# Expose port
EXPOSE 9050

# Health check with minimal overhead
HEALTHCHECK --interval=60s --timeout=10s --start-period=30s --retries=2 \
    CMD curl -f http://localhost:9050/health/simple || exit 1

# Run the application
CMD ["python", "-m", "uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9050", "--workers", "1"]