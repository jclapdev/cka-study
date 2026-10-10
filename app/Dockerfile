# The study app. compose.yaml mounts the project at /repo, so pages and progress stay
# on your own disk. The docker CLI drives the lab machines through Docker's socket.
FROM docker:29-cli AS docker

FROM node:24-bookworm
COPY --from=docker /usr/local/bin/docker /usr/local/bin/docker
COPY --from=docker /usr/local/libexec/docker/cli-plugins /usr/local/libexec/docker/cli-plugins
RUN corepack enable && corepack prepare pnpm@12.6.0 --activate
WORKDIR /repo/app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN CI=1 pnpm install --frozen-lockfile
ENV CKA_REPO=/repo
# The project root, so `docker compose exec app lab/lab.sh ...` finds the lab.
WORKDIR /repo
EXPOSE 5173
# node_modules lives in its own volume, which a rebuild leaves as it was, so packages added
# since the image was built are installed here. The store goes in that volume too; left to
# itself, pnpm would put it in the project folder.
CMD ["sh", "-c", "CI=1 pnpm --dir app install --frozen-lockfile --store-dir /repo/app/node_modules/.pnpm-store && exec pnpm --dir app dev --host 0.0.0.0 --port 5173"]
