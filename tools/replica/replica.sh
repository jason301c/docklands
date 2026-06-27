#!/usr/bin/env bash
set -euo pipefail

# Docklands replica VM driver.
#
# Manages a disposable Linux VM that faithfully replicates a self-hosted
# Docklands install (real Docker Engine, Swarm, Traefik, /etc/docklands). You
# edit it from your laptop over Remote-SSH and browse it via forwarded ports —
# the infra lives in the VM, the humans stay on the host.
#
# This drives Lima (https://lima-vm.io). It works on macOS (Apple Silicon and
# Intel) and Linux; architecture follows the host unless overridden with --arch.
# To host replicas on a dedicated box (e.g. a spare Mac Mini), run these commands
# on that box — e.g. open a Remote-SSH session to it and run `bun run replica:up`
# there. The box becomes a shared replica host; nothing else changes.
#
# Verbs:
#   up        Create (if needed) and start the replica VM.
#   ssh       Open a shell in the VM and print Remote-SSH + port-forward details.
#   reset     Destroy and recreate the VM from the clean base image.
#   down      Stop the VM (keeps its disk).
#   delete    Stop and delete the VM entirely.
#   status    Show the VM's Lima status.
#
# Flags:
#   --arch <arm64|amd64>   VM architecture. Default: host architecture.
#   --name <name>          VM name. Default: docklands-replica (DOCKLANDS_REPLICA_NAME).
#   -h, --help             Show this help.

usage() {
	sed -n '3,33p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
}

SCRIPT_DIR=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
ROOT_DIR=$(cd "$SCRIPT_DIR/../.." && pwd)
TEMPLATE="$SCRIPT_DIR/lima.yaml"

VM_NAME=${DOCKLANDS_REPLICA_NAME:-docklands-replica}
ARCH=""

VERB=""
while [ "$#" -gt 0 ]; do
	case "$1" in
		up | ssh | reset | down | delete | status)
			if [ -n "$VERB" ]; then
				echo "Only one verb may be supplied (got '$VERB' and '$1')." >&2
				exit 1
			fi
			VERB=$1
			shift
			;;
		--arch)
			ARCH=${2:-}
			if [ "$ARCH" != "arm64" ] && [ "$ARCH" != "amd64" ]; then
				echo "--arch must be arm64 or amd64" >&2
				exit 1
			fi
			shift 2
			;;
		--name)
			VM_NAME=${2:-}
			if [ -z "$VM_NAME" ]; then
				echo "--name requires a value" >&2
				exit 1
			fi
			shift 2
			;;
		-h | --help)
			usage
			exit 0
			;;
		*)
			echo "Unknown argument: $1" >&2
			usage >&2
			exit 1
			;;
	esac
done

if [ -z "$VERB" ]; then
	usage >&2
	exit 1
fi

require_lima() {
	if ! command -v limactl >/dev/null 2>&1; then
		echo "limactl (Lima) is required to manage replica VMs." >&2
		echo "  macOS: brew install lima" >&2
		echo "  Linux: see https://lima-vm.io/docs/installation/" >&2
		exit 1
	fi
}

vm_exists() {
	limactl list --quiet 2>/dev/null | grep -Fxq "$VM_NAME"
}

# Render the blueprint with the absolute repo path and requested arch into a
# throwaway file that `limactl create` reads once.
render_template() {
	local out=$1
	local arch_line='arch: "default"'
	case "$ARCH" in
		arm64) arch_line='arch: "aarch64"' ;;
		amd64) arch_line='arch: "x86_64"' ;;
	esac
	sed \
		-e "s|__REPO_ROOT__|$ROOT_DIR|g" \
		-e "s|^arch: \"default\"$|$arch_line|" \
		"$TEMPLATE" >"$out"
}

create_vm() {
	local rendered
	rendered=$(mktemp -t docklands-replica.XXXXXX.yaml)
	trap 'rm -f "$rendered"' RETURN
	render_template "$rendered"
	echo "Creating replica VM '$VM_NAME'${ARCH:+ (arch: $ARCH)} from the provisioning blueprint..."
	limactl create --name "$VM_NAME" "$rendered"
}

print_connection() {
	echo
	echo "Replica '$VM_NAME' is running."
	echo "  Shell:        limactl shell $VM_NAME"
	echo "  Repo in VM:   /workspace  (your working tree, writable — edit from the host)"
	echo "  App:          http://localhost:3000   (run 'bun run dev' inside the VM)"
	echo "  Traefik HTTP: http://localhost:8080"
	echo "  Traefik TLS:  https://localhost:8443"
	echo
	echo "Remote-SSH (VS Code / Cursor): add Lima's SSH config to your editor with"
	echo "  limactl show-ssh --format config $VM_NAME"
	echo "then connect to host 'lima-$VM_NAME'. Edit /workspace; the runtime stays in the VM."
}

case "$VERB" in
	up)
		require_lima
		if vm_exists; then
			echo "Replica VM '$VM_NAME' already exists; starting it..."
		else
			create_vm
		fi
		limactl start "$VM_NAME"
		print_connection
		;;
	ssh)
		require_lima
		if ! vm_exists; then
			echo "Replica VM '$VM_NAME' does not exist. Run 'bun run replica:up' first." >&2
			exit 1
		fi
		print_connection
		exec limactl shell "$VM_NAME"
		;;
	reset)
		require_lima
		if vm_exists; then
			echo "Resetting replica VM '$VM_NAME' to the clean base image..."
			limactl stop -f "$VM_NAME" >/dev/null 2>&1 || true
			limactl delete -f "$VM_NAME"
		fi
		create_vm
		limactl start "$VM_NAME"
		print_connection
		;;
	down)
		require_lima
		if vm_exists; then
			limactl stop "$VM_NAME"
			echo "Replica VM '$VM_NAME' stopped (disk preserved; 'bun run replica:up' to restart)."
		else
			echo "Replica VM '$VM_NAME' does not exist; nothing to stop."
		fi
		;;
	delete)
		require_lima
		if vm_exists; then
			limactl stop -f "$VM_NAME" >/dev/null 2>&1 || true
			limactl delete -f "$VM_NAME"
			echo "Replica VM '$VM_NAME' deleted."
		else
			echo "Replica VM '$VM_NAME' does not exist; nothing to delete."
		fi
		;;
	status)
		require_lima
		limactl list "$VM_NAME"
		;;
esac
