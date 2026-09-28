#!/usr/bin/env bash
# Makes the running lab machines behave like exam hosts:
#   - `ssh controlplane` / `ssh node01` / `ssh node02` from base, without a
#     password, and no ssh from one of those to another
#   - the `k` alias with bash completion, for the user and for root
#   - yq (mikefarah's, the one the exam ships)
# Idempotent. Run on the Mac with all four machines started, then save the
# starting state again (lab/snapshot.sh save <name>) so restores keep it.
set -euo pipefail

VMS=(controlplane node01 node02)
YQ_VERSION=v4.53.6

on() { local vm=$1; shift; limactl shell --workdir / "$vm" "$@"; }


for vm in "${VMS[@]}"; do
  echo "== $vm"
  on "$vm" sudo bash -eo pipefail -c "
    if ! /usr/local/bin/yq --version 2>/dev/null | grep -q '$YQ_VERSION'; then
      curl -fsSL -o /usr/local/bin/yq https://github.com/mikefarah/yq/releases/download/$YQ_VERSION/yq_linux_arm64
      chmod +x /usr/local/bin/yq
    fi

    for rc in /root/.bashrc \$(getent passwd \$SUDO_USER | cut -d: -f6)/.bashrc; do
      [ -f \$rc ] || continue
      grep -q '# cka-lab k alias' \$rc || cat >> \$rc <<'RC'
# cka-lab k alias
source <(kubectl completion bash)
alias k=kubectl
complete -o default -F __start_kubectl k
RC
    done
  "
done

echo "== ssh from base"
# Every lima machine already accepts lima's own key, so base gets a copy of it and
# reaches all three, including any machine restored from a saved copy.
on base bash -c 'umask 077; mkdir -p ~/.ssh; cat > ~/.ssh/id_ed25519' < ~/.lima/_config/user
# lima's network names each machine lima-<name>.internal, which survives restores.
# Host keys change on every restore (each is a new clone), so they are not pinned.
CONF=""
for vm in "${VMS[@]}"; do CONF+="Host $vm"$'\n'"  HostName lima-$vm.internal"$'\n'"  StrictHostKeyChecking no"$'\n'"  UserKnownHostsFile /dev/null"$'\n'"  LogLevel ERROR"$'\n'; done
on base bash -c "printf '%s' '$CONF' > ~/.ssh/config && chmod 600 ~/.ssh/config"

echo "== no nested ssh"
# The exam does not support ssh from one task host to another. Older copies of the
# lab had controlplane's own key authorised on the workers; remove it.
OLD=$(on controlplane bash -c 'cat ~/.ssh/id_ed25519.pub 2>/dev/null' || true)
if [ -n "$OLD" ]; then
  for vm in node01 node02; do on "$vm" bash -c "grep -vF '$OLD' ~/.ssh/authorized_keys > ~/.ssh/ak; mv ~/.ssh/ak ~/.ssh/authorized_keys; chmod 600 ~/.ssh/authorized_keys"; done
fi
on controlplane rm -f .ssh/id_ed25519 .ssh/id_ed25519.pub .ssh/config

echo "== check"
on base bash -c 'for n in controlplane node01 node02; do ssh -o BatchMode=yes $n hostname; done'
on base bash -c '! command -v kubectl >/dev/null' && echo "base has no kubectl"
on controlplane ssh -o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=no node01 true 2>/dev/null && { echo "nested ssh still works from controlplane"; exit 1; } || echo "no nested ssh from controlplane"
on controlplane bash -ic 'type k | head -1; yq --version'
