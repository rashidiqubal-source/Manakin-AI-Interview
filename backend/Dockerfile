# Stage 1: Build Environment (Alpine is fine for Node.js TS compilation)
FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install
RUN npx prisma generate

COPY . .

ENV DATABASE_URL="postgresql://dummy:dummy@dummyhost:5432/dummy"
RUN npm run build

# Stage 2: Production Environment
# node:20-slim is Debian-based (glibc) — required for PyTorch wheels
# Alpine (musl libc) has no PyTorch wheels on PyPI
FROM node:22-slim AS runner

WORKDIR /app

# ── System dependencies ───────────────────────────────────────────────────────
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    python3-dev \
    gcc \
    g++ \
    libgomp1 \
    libgl1 \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    && rm -rf /var/lib/apt/lists/*

# ── Python venv (keeps packages isolated from system Python) ──────────────────
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# ── Python ML dependencies ────────────────────────────────────────────────────
COPY ml_service/requirements.txt ./ml_service/requirements.txt
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r ml_service/requirements.txt

# ── Python ML service source + YOLO weights ───────────────────────────────────
COPY ml_service/ ./ml_service/
COPY yolo26n.pt ./yolo26n.pt

# ── Node.js environment ───────────────────────────────────────────────────────
ENV NODE_ENV=production
ENV PORT=5000

COPY package*.json ./
COPY prisma ./prisma/

RUN npm install --omit=dev

COPY --from=builder /app/dist ./dist

RUN npx prisma generate

EXPOSE 5000
CMD ["npm", "run", "start"]
