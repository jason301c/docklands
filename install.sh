#!/bin/sh
# Docklands installer — one command to install or update Docklands.
#
#   curl -fsSL https://raw.githubusercontent.com/jason301c/docklands/canary/install.sh | sh
#
# On Linux it installs Docklands directly on the host: Docker (if missing), Swarm,
# the docklands-network overlay, Traefik, bundled Postgres, and the dashboard —
# then prints the URL. On macOS it boots a Lima VM and runs this same Linux
# install inside it, so a Mac (e.g. a Mac mini) becomes a real Docklands host with
# one command. Re-run to upgrade in place:
#
#   curl -fsSL .../install.sh | sh -s -- update
#
# This is a thin, idempotent wrapper around the image's own `dist/setup-instance.mjs`
# (the tested install entrypoint); it does not reimplement Swarm/Traefik in shell.
#
# Honest scope (same as Dokploy/Coolify): the *server* is Linux. macOS is
# supported only by running the install inside a Linux VM — which this script does
# for you. A Mac VM is arm64, so not bit-identical to an amd64 cloud server.
set -eu

# --- configuration (all env-overridable) ------------------------------------
DOCKLANDS_IMAGE="${DOCKLANDS_IMAGE:-jason301c/docklands:latest}"
DOCKLANDS_INSTALL_URL="${DOCKLANDS_INSTALL_URL:-https://raw.githubusercontent.com/jason301c/docklands/canary/install.sh}"
DOCKLANDS_VM_NAME="${DOCKLANDS_VM_NAME:-docklands}"
DOCKLANDS_DIR="${DOCKLANDS_DIR:-/etc/docklands}"
DOCKLANDS_PORT="${DOCKLANDS_PORT:-3000}"
ENV_FILE="$DOCKLANDS_DIR/docklands.env"
APP_CONTAINER="docklands"

COMMAND="${1:-install}"
case "$COMMAND" in
	install | update) ;;
	-h | --help)
		sed -n '2,24p' "$0" 2>/dev/null | sed 's/^# \{0,1\}//'
		exit 0
		;;
	*)
		echo "Unknown command: $COMMAND (expected 'install' or 'update')" >&2
		exit 1
		;;
esac

# --- helpers ----------------------------------------------------------------
log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33mwarning:\033[0m %s\n' "$*" >&2; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }
has() { command -v "$1" >/dev/null 2>&1; }

# Random secrets from the kernel CSPRNG so we depend on neither openssl nor a
# baked-in password. hex for the token-like secrets, base64 for the 32-byte
# encryption key (the app decodes it back to 32 bytes).
gen_hex() { head -c "$1" /dev/urandom | od -An -v -tx1 | tr -d ' \n'; }
gen_key_b64() { head -c 32 /dev/urandom | base64 | tr -d '\n'; }

# --- Linux: the real host install -------------------------------------------
linux_require_root() {
	if [ "$(id -u)" -ne 0 ]; then
		die "Docklands must be installed as root. Re-run with:
  curl -fsSL $DOCKLANDS_INSTALL_URL | sudo sh${COMMAND:+ -s -- $COMMAND}"
	fi
}

linux_check_ports() {
	# Traefik owns 80/443 and the dashboard owns $DOCKLANDS_PORT. A fresh install
	# can't proceed if something else already holds them.
	[ "$COMMAND" = "update" ] && return 0
	for port in 80 443 "$DOCKLANDS_PORT"; do
		if has ss && ss -ltn "( sport = :$port )" 2>/dev/null | grep -q ":$port"; then
			die "Port $port is already in use. Free it (or stop the conflicting service) and re-run."
		fi
	done
}

linux_ensure_docker() {
	if ! has docker; then
		log "Installing Docker Engine via get.docker.com ..."
		curl -fsSL https://get.docker.com | sh
		command -v systemctl >/dev/null 2>&1 && systemctl enable --now docker >/dev/null 2>&1 || true
	fi
	docker info >/dev/null 2>&1 || die "Docker is installed but the daemon is not reachable. Start Docker and re-run."
}

linux_load_or_create_secrets() {
	mkdir -p "$DOCKLANDS_DIR"
	chmod 700 "$DOCKLANDS_DIR"
	if [ -f "$ENV_FILE" ]; then
		log "Reusing existing secrets from $ENV_FILE (not regenerated)."
		return 0
	fi
	[ "$COMMAND" = "update" ] && die "update requested but no install found at $ENV_FILE. Run 'install' first."
	log "Generating instance secrets ..."
	pgpw="$(gen_hex 24)"
	bas="$(gen_hex 32)"
	enc="$(gen_key_b64)"
	# env-file values are literal (no quoting/expansion), so these are written raw.
	umask 077
	{
		echo "DATABASE_URL=postgres://docklands:${pgpw}@docklands-postgres:5432/docklands"
		echo "BETTER_AUTH_SECRET=${bas}"
		echo "DOCKLANDS_ENCRYPTION_KEY=${enc}"
	} >"$ENV_FILE"
	chmod 600 "$ENV_FILE"
}

linux_pull_image() {
	log "Pulling $DOCKLANDS_IMAGE ..."
	docker pull "$DOCKLANDS_IMAGE"
}

linux_setup_instance() {
	# Idempotent: Swarm init, docklands-network, /etc/docklands, Traefik, and the
	# bundled Postgres (credentials adopted from DATABASE_URL). Safe to re-run.
	log "Initializing the host (Swarm, network, Traefik, Postgres) ..."
	docker run --rm --name docklands-setup \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v "$DOCKLANDS_DIR:/etc/docklands" \
		--env-file "$ENV_FILE" \
		"$DOCKLANDS_IMAGE" \
		node -r dotenv/config dist/setup-instance.mjs
}

linux_run_app() {
	log "Starting the Docklands dashboard ..."
	docker rm -f "$APP_CONTAINER" >/dev/null 2>&1 || true
	docker run -d --name "$APP_CONTAINER" --restart unless-stopped \
		--network docklands-network \
		-p "${DOCKLANDS_PORT}:3000" \
		-v /var/run/docker.sock:/var/run/docker.sock \
		-v "$DOCKLANDS_DIR:/etc/docklands" \
		--env-file "$ENV_FILE" \
		"$DOCKLANDS_IMAGE" >/dev/null
}

linux_wait_ready() {
	log "Waiting for Docklands to become ready ..."
	i=0
	while [ "$i" -lt 60 ]; do
		if curl -fs "http://localhost:${DOCKLANDS_PORT}/api/ready" >/dev/null 2>&1; then
			return 0
		fi
		i=$((i + 1))
		sleep 3
	done
	warn "Docklands did not report ready within 180s. Check: docker logs $APP_CONTAINER"
}

linux_success() {
	ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
	[ -n "$ip" ] || ip="<server-ip>"
	printf '\n\033[1;32mDocklands is installed and running.\033[0m\n'
	printf '  Dashboard:   http://%s:%s\n' "$ip" "$DOCKLANDS_PORT"
	printf '  Config dir:  %s  (back this up — it holds your encryption key)\n' "$DOCKLANDS_DIR"
	printf '\nOpen the dashboard and create the first account to become the owner.\n'
	printf 'For public app domains without opening ports, use the Cloudflare Tunnel ingress mode.\n'
	printf 'Upgrade later with:  curl -fsSL %s | sudo sh -s -- update\n\n' "$DOCKLANDS_INSTALL_URL"
}

linux_main() {
	if [ "$COMMAND" = "update" ]; then
		log "Updating Docklands ($DOCKLANDS_IMAGE) ..."
	else
		log "Installing Docklands ($DOCKLANDS_IMAGE) ..."
	fi
	linux_require_root
	linux_check_ports
	linux_ensure_docker
	linux_load_or_create_secrets
	linux_pull_image
	linux_setup_instance
	linux_run_app
	linux_wait_ready
	linux_success
}

# --- macOS: boot a Lima VM and run the Linux install inside it ---------------
darwin_vm_template() {
	# A persistent production VM: Ubuntu 24.04 + real Linux Docker. No source
	# mount (it runs the published image, not the dev server). Dashboard :3000 is
	# forwarded directly; Traefik 80/443 are remapped to unprivileged 8080/8443 so
	# the forward always binds. For public app domains, use the Cloudflare Tunnel
	# ingress mode (no open ports needed) — the beginner-first default.
	cat <<'YAML'
vmType: "vz"
os: "Linux"
arch: "default"
images:
  - location: "https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-amd64.img"
    arch: "x86_64"
  - location: "https://cloud-images.ubuntu.com/releases/24.04/release/ubuntu-24.04-server-cloudimg-arm64.img"
    arch: "aarch64"
cpus: 4
memory: "8GiB"
disk: "60GiB"
portForwards:
  - guestPort: 3000
    hostPort: 3000
  - guestPort: 80
    hostPort: 8080
  - guestPort: 443
    hostPort: 8443
provision:
  - mode: system
    script: |
      #!/bin/bash
      set -eux
      export DEBIAN_FRONTEND=noninteractive
      if ! command -v docker >/dev/null 2>&1; then
        curl -fsSL https://get.docker.com | sh
      fi
      systemctl enable --now docker
      apt-get update -y
      apt-get install -y --no-install-recommends ca-certificates curl
probes:
  - description: "Docker is installed"
    script: |
      #!/bin/bash
      set -eux
      timeout 300 bash -c 'until command -v docker >/dev/null 2>&1; do sleep 3; done'
    hint: |
      Docker provisioning did not finish. Inspect with:
        limactl shell docklands -- sudo journalctl -u cloud-final
YAML
}

darwin_ensure_lima() {
	if has limactl; then
		return 0
	fi
	if has brew; then
		log "Installing Lima via Homebrew ..."
		brew install lima
	else
		die "Lima is required to run Docklands on macOS. Install Homebrew (https://brew.sh), then:
  brew install lima
and re-run this installer."
	fi
}

darwin_ensure_vm() {
	if limactl list --quiet 2>/dev/null | grep -Fxq "$DOCKLANDS_VM_NAME"; then
		log "Starting existing VM '$DOCKLANDS_VM_NAME' ..."
		limactl start "$DOCKLANDS_VM_NAME" >/dev/null 2>&1 || true
		return 0
	fi
	log "Creating the Docklands VM '$DOCKLANDS_VM_NAME' (first boot pulls Ubuntu + Docker) ..."
	tmpl="$(mktemp -t docklands-vm.XXXXXX)"
	darwin_vm_template >"$tmpl"
	limactl create --name "$DOCKLANDS_VM_NAME" "$tmpl"
	rm -f "$tmpl"
	limactl start "$DOCKLANDS_VM_NAME"
}

darwin_success() {
	printf '\n\033[1;32mDocklands is running inside the "%s" VM on this Mac.\033[0m\n' "$DOCKLANDS_VM_NAME"
	printf '  Dashboard:    http://localhost:%s\n' "$DOCKLANDS_PORT"
	printf '  VM shell:     limactl shell %s\n' "$DOCKLANDS_VM_NAME"
	printf '  Stop / start: limactl stop %s  /  limactl start %s\n' "$DOCKLANDS_VM_NAME" "$DOCKLANDS_VM_NAME"
	printf '\nOpen the dashboard and create the first account to become the owner.\n'
	printf 'For public app domains, use the Cloudflare Tunnel ingress mode (no open ports).\n'
	printf 'Note: the VM does not auto-start on reboot — run "limactl start %s" after a restart.\n' "$DOCKLANDS_VM_NAME"
	printf 'Upgrade later by re-running this installer with the "update" argument.\n\n'
}

darwin_main() {
	log "macOS detected — Docklands runs in a Lima VM (the server is Linux)."
	darwin_ensure_lima
	darwin_ensure_vm
	log "Running the Docklands $COMMAND inside the VM ..."
	# Re-run *this same script* inside the Linux VM; it takes the Linux branch.
	# Lima users have passwordless sudo; pass the image choice through to the VM.
	limactl shell "$DOCKLANDS_VM_NAME" -- \
		sudo sh -c "curl -fsSL '$DOCKLANDS_INSTALL_URL' | DOCKLANDS_IMAGE='$DOCKLANDS_IMAGE' DOCKLANDS_PORT='$DOCKLANDS_PORT' sh -s -- $COMMAND"
	darwin_success
}

# --- dispatch ---------------------------------------------------------------
OS="$(uname -s)"
case "$OS" in
	Linux) linux_main ;;
	Darwin) darwin_main ;;
	*) die "Unsupported OS: $OS. Docklands installs on Linux, or on macOS via a Lima VM." ;;
esac
