# Image de deploiement : build du frontend + du backend, puis un seul process
# Node qui sert les deux (voir artifacts/api-server/src/app.ts).

FROM node:24-slim

# corepack lit le champ "packageManager" de package.json et installe la bonne
# version de pnpm. Sans ce flag il peut demander une confirmation interactive
# et bloquer le build.
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
RUN corepack enable

WORKDIR /app

COPY . .

# NODE_ENV n'est volontairement PAS a "production" ici : vite et esbuild sont
# des devDependencies et sont necessaires au build.
RUN pnpm install --frozen-lockfile
RUN pnpm run build:deploy

ENV NODE_ENV=production

# PORT est fourni par Railway.
CMD ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]
