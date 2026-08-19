# syntax=docker/dockerfile:1
# ============================================================================
# Jawdi landing (Astro static vitrine) — production image.
# Build context = ./landing. PUBLIC_* are baked at build time (Astro inlines
# import.meta.env.PUBLIC_* into the static HTML), so the CTAs point at the web
# app's login/signup on the app subdomain.
# ============================================================================

# Astro 7 requires Node >= 22.12 (see landing/package.json engines).
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
ARG PUBLIC_SITE_URL=https://jawdi.app
# Phase collaborateurs : le CTA "Commencer gratuitement" mène à /contact.
ARG PUBLIC_APP_SIGNUP_URL=/contact
ARG PUBLIC_APP_LOGIN_URL=https://app.jawdi.app/login
ARG PUBLIC_PARTNER_EMAIL=malick.cisse@nlogicsolutions.com
ARG PUBLIC_CONTACT_PHONE=+221 70 475 69 96
ENV PUBLIC_SITE_URL=$PUBLIC_SITE_URL \
    PUBLIC_APP_SIGNUP_URL=$PUBLIC_APP_SIGNUP_URL \
    PUBLIC_APP_LOGIN_URL=$PUBLIC_APP_LOGIN_URL \
    PUBLIC_PARTNER_EMAIL=$PUBLIC_PARTNER_EMAIL \
    PUBLIC_CONTACT_PHONE=$PUBLIC_CONTACT_PHONE
RUN npm run build

# ---- Runtime: static files behind nginx ----
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=5 \
  CMD wget -q --spider http://localhost/ || exit 1
