#!/usr/bin/env bash
# Makes the running lab machines behave like exam hosts:
#   - `ssh node01` / `ssh node02` from controlplane, without a password
#   - the `k` alias with bash completion, for the user and for root
#   - yq (mikefarah's, the one the exam ships)
# Idempotent. Run on the Mac with all three machines started, then save the
# starting state again (lab/snapshot.sh save <name>) so restores keep it.
set -euo pipefail

VMS=(controlplane node01 node02)
YQ_VERSION=v4.53.6

on() { local vm=$1; shift; limactl shell --workdir / "$vm" "$@"; }
nodeip() { on "$1" ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}'; }


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

echo "== ssh key on controlplane"
on controlplane bash -c 'ssh-keygen -y -f ~/.ssh/id_ed25519 >/dev/null 2>&1 || { rm -f ~/.ssh/id_ed25519*; ssh-keygen -q -t ed25519 -N "" -f ~/.ssh/id_ed25519; }'
PUB=$(on controlplane bash -c 'cat ~/.ssh/id_ed25519.pub')
for vm in node01 node02; do
  on "$vm" bash -c "grep -qF '$PUB' ~/.ssh/authorized_keys || echo '$PUB' >> ~/.ssh/authorized_keys"
done
# /etc/hosts is rewritten at every boot, so the names live in ~/.ssh/config.
# Host keys change on every restore (each is a new clone), so they are not pinned.
CONF=""
for vm in node01 node02; do CONF+="Host $vm"$'\n'"  HostName $(nodeip "$vm")"$'\n'"  StrictHostKeyChecking no"$'\n'"  UserKnownHostsFile /dev/null"$'\n'"  LogLevel ERROR"$'\n'; done
on controlplane bash -c "printf '%s' '$CONF' > ~/.ssh/config && chmod 600 ~/.ssh/config"

echo "== check"
on controlplane bash -ic 'for n in node01 node02; do ssh -o BatchMode=yes $n hostname; done; type k | head -1; yq --version'
