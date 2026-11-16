# Pin base images to SHA digests for reproducible, supply-chain-safe builds.
FROM node:26-bookworm@sha256:fa52d1669505e29b58c042875b1d65c229e0787a3610fd52869b22b68e480853 AS builder

WORKDIR /app

COPY package.json package-lock.json .npmrc ./
# @bcbp-solutions-fzc-llc/webpack-preset comes from GitHub Packages. The token is a BuildKit secret
# (docker build --secret id=npm_token,env=NODE_AUTH_TOKEN), so it never lands in a layer.
RUN --mount=type=secret,id=npm_token,required=true \
    NODE_AUTH_TOKEN="$(cat /run/secrets/npm_token)" npm ci --no-audit --no-fund

COPY . .

ARG BUILD_VERSION=dev
ARG SOURCE_DATE_EPOCH=0

ENV SOURCE_DATE_EPOCH=${SOURCE_DATE_EPOCH}

RUN npm run build && find dist -name '*.map' -delete

FROM nginxinc/nginx-unprivileged:1.31-alpine@sha256:b5047b9b76845eac124358373c6852377c52e4b05834a47647e955dd91cb8f1e

ARG BUILD_VERSION=dev
ENV BUILD_VERSION=${BUILD_VERSION}

LABEL org.opencontainers.image.title="mfe-workflow-designer" \
      org.opencontainers.image.source="https://github.com/BCBP-SOLUTIONS-FZC-LLC/mfe-workflow-designer" \
      org.opencontainers.image.vendor="BCBP Solutions FZC LLC" \
      org.opencontainers.image.revision="${BUILD_VERSION}"

USER 0
# hadolint ignore=DL3017,DL3018
RUN apk upgrade --no-cache

COPY nginx/default.conf /etc/nginx/conf.d/default.conf
COPY nginx/security-headers.conf nginx/document-headers.conf /etc/nginx/
COPY --from=builder --chown=101:101 /app/dist /usr/share/nginx/html

EXPOSE 8080

USER 101
