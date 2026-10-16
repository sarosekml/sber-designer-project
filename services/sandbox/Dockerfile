# sber-designer sandbox image (Phase 4).
#
# A minimal Bun + Node base with the host tools the controller mounts a
# user repo into and starts a dev-server inside. The image itself stays
# small; per-session deps live on a mounted node_modules volume so they
# survive a session restart but stay isolated from other sessions.
#
# Build:
#   docker build -t sd-sandbox:latest services/sandbox
#
# Bind mount + run (used by docker-driver.ts):
#   docker run -d --rm \
#     --name sd-<sessionId> \
#     -v /abs/workspace:/work \
#     -v sd-modules-<sessionId>:/work/node_modules \
#     -p 127.0.0.1:0:6006 \
#     -w /work \
#     sd-sandbox:latest \
#     bun run storybook -- --no-open --host 0.0.0.0
FROM oven/bun:1.2.13-debian

# Install git + gh + curl. gh is needed when the agent runs `git_create_pr`
# from inside the sandbox in a future iteration; today the controller calls
# gh on the host, but bake it in to keep the image self-sufficient.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git gnupg \
    && curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
       | gpg --dearmor -o /usr/share/keyrings/githubcli.gpg \
    && echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli.gpg] https://cli.github.com/packages stable main" \
       > /etc/apt/sources.list.d/github-cli.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends gh \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# We bind-mount the workspace and node_modules at runtime; nothing to copy.
WORKDIR /work

# Storybook / Vite default port. We bind container's 6006 to a random
# host port from the controller; using a fixed in-container port keeps
# the dev-server config simple.
EXPOSE 6006

# Default command is whatever the controller sends; this CMD is a useful
# sanity probe when running the image manually.
CMD ["bun", "--version"]
