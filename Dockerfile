# Temple Clarity: the Node API, which also serves the web page. Build from the repo root:
#   docker build -t temple-clarity .
FROM node:22-alpine
WORKDIR /app

# Dependencies first, so rebuilds are fast when only code changes.
COPY backend/package.json backend/package-lock.json* backend/
RUN cd backend && if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi

# The API, and the page files it serves (it looks for them two folders above backend/src).
COPY backend backend
COPY index.html robots.txt sitemap.xml og-image.png ./

# Settings come from environment variables (see backend/.env.example), never from the image.
ENV NODE_ENV=production PORT=3000 SERVE_STATIC=1
EXPOSE 3000
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "backend/src/index.js"]
