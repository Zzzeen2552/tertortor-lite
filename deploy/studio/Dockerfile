# TERTORTOR web relay (tools/relay.mjs). One file, no dependencies, never spawns anything.
# Build context = this folder with relay.mjs copied next to this Dockerfile (see docs/hybrid-plan.md § Deploy).
FROM node:22-alpine
WORKDIR /app
COPY relay.mjs ./relay.mjs
# PWA files (manifest, icons, push service worker) = tools/studio/pwa, copied next to this Dockerfile on deploy
COPY pwa ./pwa
RUN mkdir /data && chown node:node /data
USER node
ENV PORT=4330 HOST=0.0.0.0 DATA_DIR=/data TRUST_PROXY=1 NODE_ENV=production
EXPOSE 4330
CMD ["node", "relay.mjs"]
