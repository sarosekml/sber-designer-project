---
id: ADR-0019
title: Access boundaries and project integrity
status: Accepted
date: 2026-09-19
scope: filesystem, process, proxy, MCP, and project-file boundaries
refines:
  - ADR-0008
  - ADR-0009
  - ADR-0013
---

# ADR-0019: Access boundaries, process isolation and project-file integrity

## Status

Accepted (2026-09-19). Supersedes nothing; hardens decisions taken in
[ADR-0008](0008-local-spawn-sandbox.md) (local-spawn sandbox),
[ADR-0009](0009-services-api-edge.md) (services/api as the single edge) and
[ADR-0013](0013-ast-bridge-primitives.md) (workspace path safety).

## Context

The 0136 review reproduced five boundary defects against the running code, not
against a reading of it:

1. **The sandbox controller had no access control.** It accepted
   `workspacePath` / `command` / `args` from any caller that could open a
   socket to it, reflected any `Origin` back through CORS, and exported no
   `hostname` — which means Bun's default `0.0.0.0`. Deployment instructions
   asked an operator to close the port with a firewall; nothing in the code
   required it.
2. **The workspace path guard was lexical.** `resolve` + prefix compare
   describes how a path spells itself, not where it lands. A symlink inside a
   workspace pointing at a sibling directory passed the check, and both a read
   and a write through it reached outside the workspace.
3. **The preview proxies let the request path choose the upstream origin.**
   `new URL(incomingPath, previewUrl)` treats `//host/x` as protocol-relative.
   A public share request for `//destination.invalid/fixture` made the proxy
   call that host, forwarding the method, body, `Cookie` and `Authorization`.
4. **The static preview served any file under the workspace root**, including
   `.env`, `.git/config` and `.sber-designer/` — reachable by a share-token
   holder through the proxy above.
5. **Spawned dev-servers inherited the service user's whole environment**, so a
   connected project's own script saw every auth, service and provider secret
   the controller was started with.

Separately, `.sdproj` persistence had no atomic replace, no distinction between
"no project here" and "this project is damaged", and no serialization or
revision — so an interrupted write, a concurrent agent/editor save, or a stale
full `PUT` from a second tab could each lose project state.

## Decision

### One canonical filesystem boundary

`resolveInside` validates in two stages: a lexical gate (absolute paths, NUL
bytes, `..`) and a canonical gate (the _real_ destination must stay under the
_real_ workspace root; a path that does not exist yet is checked through its
nearest existing ancestor). It keeps returning the lexical path, so existing
call sites are unaffected; `canonicalizeInside` additionally hands back the
resolved path, and `safe-fs` performs its syscalls on that, so the operation
does not re-traverse the links it just validated.

No module re-implements this rule. `.agents/` and the cover store delegate to
it; a new consumer must too.

### The sandbox controller authenticates and constrains

Four rules, all overridable so local development stays the convenient path:

| rule      | default                                   | override                                     |
| --------- | ----------------------------------------- | -------------------------------------------- |
| bind      | `127.0.0.1`                               | `SBER_DESIGNER_SANDBOX_HOST` (needs a token) |
| auth      | none on loopback; required in server mode | `SBER_DESIGNER_SANDBOX_TOKEN`                |
| workspace | any                                       | `SBER_DESIGNER_SANDBOX_WORKSPACE_ROOTS`      |
| launch    | allowlisted bare commands                 | `SBER_DESIGNER_SANDBOX_ALLOWED_COMMANDS`     |

A configuration the policy refuses (server mode without a token, a
non-loopback bind without a token) fails **closed**: the bind falls back to
loopback and `/api` answers 503. `services/api` binds loopback by default for
the same reason — nginx already proxies to `127.0.0.1`.

### Proxies pin their upstream origin

Both preview proxies build the upstream URL from the recorded origin plus a
normalized path and query. Protocol-relative, backslash and percent-encoded
spellings collapse to a path, and a request that would still move the origin is
refused rather than rewritten. The public share proxy is GET/HEAD only, drops
`Cookie` / `Authorization` / service token / share password and its own `?p=`
parameter before forwarding, and prevents an upstream response from setting
cookies on the editor's origin.

### The preview publishes assets, not project files

A positive rule replaces the old negative one: a request is served only when
its extension is a publishable web asset and no path segment is a secret, VCS
or runtime-state directory. Blocked paths answer 404, not 403, so the response
does not confirm what exists.

### Child processes get a purpose-built environment

`buildSandboxChildEnv` passes an allowlist — PATH/HOME/locale/proxy/toolchain
variables plus the preview's own PORT and markers — with
`SBER_DESIGNER_SANDBOX_ENV_PASSTHROUGH` as the explicit escape hatch. The
docker driver publishes on loopback and sets cpu, memory and pid limits.

**This is not process isolation.** A local child process still runs as the
service user with access to that user's files. Choosing and operating a real
isolation model for server mode belongs to 0400; this decision reduces what a
connected project sees by default and makes the remaining exposure explicit.

### MCP policy has two profiles

`open` (local default) behaves as before, including the "context may be sent to
this endpoint" warning on remote servers. `restricted` (server deployment mode,
or `SBER_DESIGNER_MCP_POLICY=restricted`) denies by default: remote hosts must
be allowlisted, stdio commands must be allowlisted bare names, and either
transport can be switched off. Loopback and RFC1918 endpoints stay usable
without an entry. The verdict is enforced before a connection is made and
re-checked at tool-call time, so a project override cannot widen deployment
policy. Allowlists are deployment configuration; no customer address lives in
source.

### `.sdproj` writes are atomic, serialized and revisioned

`project-persistence` owns the disk: temp file + fsync + rename, one write
queue per path, a content revision, and a read that reports missing / ok /
corrupt separately. A corrupt file is recorded and never silently replaced;
recovery is a deliberate `recoverCorruptProject` that renames it aside.
`GET /api/project` returns an ETag and `PUT` honours `If-Match`, answering 409
instead of overwriting a newer file. Omitting `If-Match` keeps the previous
contract.

## Consequences

- Local development is unchanged in practice: loopback bind, no token, no
  workspace allowlist, open MCP profile.
- A server deployment must now configure `SBER_DESIGNER_SANDBOX_TOKEN` and,
  if it uses MCP, the MCP allowlists. This is intentional: the previous
  default was "open unless an operator remembered a firewall rule".
- A connected project whose dev-script needs an extra environment variable
  must name it in `SBER_DESIGNER_SANDBOX_ENV_PASSTHROUGH`.
- A client that wants conflict detection on project saves opts in by sending
  `If-Match`; the editor does, server-side callers need not.
- Real server isolation, update and restore verification remain in 0400.
