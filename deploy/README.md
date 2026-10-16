# deploy/

Server beta deployment templates for one Linux host.

All production templates explicitly run with
`SBER_DESIGNER_DEPLOYMENT_MODE=server`. For a dev/staging process with the
same managed-workspace rules use `bun run dev:server`; ordinary `bun run dev`
always stays local and does not use these roots or server defaults.
For a manual production web build use `bun run build:server`; `update.sh`
passes the server profile explicitly after `sudo -u`. Set
`SBER_DESIGNER_BUN_PATH` to an absolute service-user binary (the template uses
`/home/sd/.bun/bin/bun`); install, build, and smoke never depend on sudo's
filtered environment or `secure_path`.

Use these files with
[`docs/integrations/remote-server-beta-deploy.md`](../docs/integrations/remote-server-beta-deploy.md).

## Files

- `env.example` -> `/etc/sber-designer/env`
- `systemd/sd-api.service` -> `/etc/systemd/system/sd-api.service`
- `systemd/sd-sandbox.service` -> `/etc/systemd/system/sd-sandbox.service`
- `nginx/sber-designer.conf` -> `/etc/nginx/sites-available/sber-designer.conf`
- `update.sh` -> run on the server from `/opt/sber-designer`
- `remote-update.sh` -> run from a developer machine over SSH
- `backup.sh` -> tar projects, user data, auth data, and `/etc/sber-designer`
  without `node_modules` or retained run evidence
- `run-retention.sh` -> cron/systemd-timer safety net for old `.sber-designer/runs`

## Data boundary

Product code lives in `/opt/sber-designer`.

Persistent server data lives outside the checkout:

```text
/srv/sber-designer/projects
/home/sd/.sber-designer
/etc/sber-designer
```

Update scripts must not delete or rewrite these roots except through explicit
migration code or backup/restore operations.

The sandbox server default is five live sessions. Plain local development is
unlimited unless `SBER_DESIGNER_SANDBOX_MAX_SESSIONS` is set explicitly.
