# Troubleshooting

Common setup issues when running SAIFAC on the host.

## Docker: `connect ENOENT /var/run/docker.sock`

**Symptom:** Errors such as `Error: connect ENOENT /var/run/docker.sock` while **`docker info`** and **`docker ps`** work in the same terminal.

**Why:** The Docker CLI uses **contexts** (see `docker context show` and `~/.docker/config.json`). It may talk to Colima, OrbStack, or another daemon whose Unix socket is **not** at `/var/run/docker.sock`.

SAIFAC uses **dockerode**, which follows **[docker-modem](https://github.com/apocas/docker-modem)** rules: it uses the **`DOCKER_HOST`** environment variable when set, otherwise it defaults to **`/var/run/docker.sock`** on macOS/Linux. It does **not** read the CLI’s current context.

**Fix:** Set **`DOCKER_HOST`** to the same API endpoint your daemon exposes.

### Colima

1. Confirm Colima is running and read the socket path:

   ```bash
   colima status
   ```

   Typical output includes:

   ```text
   docker socket: unix:///Users/<you>/.colima/default/docker.sock
   ```

2. Export (**use the path `colima status` prints**; profile `default` is shown above):

   ```bash
   export DOCKER_HOST=unix://$HOME/.colima/default/docker.sock
   ```

   Or the fully expanded form:

   ```bash
   export DOCKER_HOST=unix:///Users/<you>/.colima/default/docker.sock
   ```

   If you use a non-default profile (`colima start --profile foo`), the directory is `~/.colima/<profile>/docker.sock`.

3. **Persist** in your shell profile or project **`.env`** (if you load env from there):

   ```bash
   DOCKER_HOST=unix:///Users/<you>/.colima/default/docker.sock
   ```

After this, restart the terminal or reload env and run SAIFAC again.

### Other setups

Any Docker backend that does not place the socket at `/var/run/docker.sock` needs the same idea: set **`DOCKER_HOST`** to the **`unix://...`** (or `tcp://...`) URL the engine documents.

---

See also:

- [Environment variables](env-vars.md) — **`DOCKER_HOST`** and **`SAIFAC_LEASH_BIN`**
- [Docker images & host notes](development/docker.md) — short summary of dockerode vs CLI
