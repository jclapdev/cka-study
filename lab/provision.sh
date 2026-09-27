#!/usr/bin/env bash
# Build the CKA practice lab: three Ubuntu VMs with every kubeadm prerequisite
# installed, and nothing else.
#
#   ./provision.sh          VMs + prerequisites only; the cluster is yours to build
#   ./provision.sh --auto   also runs kubeadm init/join and installs Flannel
#
# Idempotent: re-running skips whatever already exists.
#
# Kubernetes 1.34 is installed deliberately. The exam runs 1.35, so the
# cluster-upgrade exercise has a real version to climb to.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
MINOR="${K8S_MINOR:-1.34}"
POD_CIDR="${POD_CIDR:-10.244.0.0/16}"
AUTO=""
[ "${1:-}" = "--auto" ] && AUTO=1

command -v limactl >/dev/null || { echo "lima not installed: brew install lima"; exit 1; }

launch() {
  local name=$1 cpus=$2 mem=$3
  case "$(limactl list --format '{{.Name}} {{.Status}}' 2>/dev/null | grep "^$name " || true)" in
    "$name Running") echo "== $name running" ;;
    "$name "*)       echo "== starting $name"; limactl start "$name" ;;
    *)               echo "== creating $name ($cpus cpu, ${mem}GiB)"
                     limactl create --name "$name" --cpus "$cpus" --memory "$mem" \
                       --disk 15 --tty=false "$HERE/node.yaml"
                     limactl start "$name" ;;
  esac
}

prep() {
  local name=$1
  if limactl shell --workdir / "$name" test -x /usr/bin/kubeadm 2>/dev/null; then
    echo "== $name already prepared"; return
  fi
  echo "== preparing $name (hostname, containerd, kubeadm/kubelet/kubectl $MINOR)"
  limactl shell --workdir / "$name" sudo bash -euo pipefail -c "
    hostnamectl set-hostname $name
    grep -q ' $name\$' /etc/hosts || echo '127.0.1.1 $name' >> /etc/hosts

    swapoff -a && sed -i '/ swap / s/^/#/' /etc/fstab
    printf 'overlay\nbr_netfilter\n' > /etc/modules-load.d/k8s.conf
    modprobe overlay; modprobe br_netfilter
    printf 'net.bridge.bridge-nf-call-iptables=1\nnet.bridge.bridge-nf-call-ip6tables=1\nnet.ipv4.ip_forward=1\n' \
      > /etc/sysctl.d/k8s.conf
    sysctl --system >/dev/null

    export DEBIAN_FRONTEND=noninteractive
    apt-get update -qq
    apt-get install -y -qq containerd apt-transport-https ca-certificates curl gpg jq etcd-client

    mkdir -p /etc/containerd
    containerd config default > /etc/containerd/config.toml
    sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml
    systemctl restart containerd && systemctl enable containerd

    mkdir -p /etc/apt/keyrings
    curl -fsSL https://pkgs.k8s.io/core:/stable:/v$MINOR/deb/Release.key |
      gpg --dearmor --yes -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg
    echo 'deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v$MINOR/deb/ /' \
      > /etc/apt/sources.list.d/kubernetes.list
    apt-get update -qq
    apt-get install -y -qq kubelet kubeadm kubectl cri-tools
    apt-mark hold kubelet kubeadm kubectl
    crictl config runtime-endpoint unix:///run/containerd/containerd.sock
  "
}

nodeip() { limactl shell --workdir / "$1" ip route get 1.1.1.1 2>/dev/null | awk '{print $7; exit}'; }

launch controlplane 2 4
launch node01       2 2
launch node02       2 2
for n in controlplane node01 node02; do prep "$n"; done

CP_IP=$(nodeip controlplane)
echo
echo "controlplane $CP_IP    node01 $(nodeip node01)    node02 $(nodeip node02)"

if [ -z "$AUTO" ]; then
  cat <<EOF

VMs are ready; no cluster exists yet — that is exercise 01.
  limactl shell controlplane

Back up the clean VMs before anything destructive:  ./snapshot.sh save clean
EOF
  exit 0
fi

if ! limactl shell --workdir / controlplane sudo test -f /etc/kubernetes/admin.conf 2>/dev/null; then
  echo "== kubeadm init on controlplane"
  limactl shell --workdir / controlplane sudo kubeadm init \
    --apiserver-advertise-address "$CP_IP" --pod-network-cidr "$POD_CIDR"
  limactl shell --workdir / controlplane bash -c '
    mkdir -p ~/.kube && sudo cp /etc/kubernetes/admin.conf ~/.kube/config &&
    sudo chown "$(id -u):$(id -g)" ~/.kube/config'
  echo "== installing Flannel"
  limactl shell --workdir / controlplane kubectl apply -f \
    https://github.com/flannel-io/flannel/releases/latest/download/kube-flannel.yml
fi

JOIN=$(limactl shell --workdir / controlplane sudo kubeadm token create --print-join-command)
for n in node01 node02; do
  if ! limactl shell --workdir / "$n" sudo test -f /etc/kubernetes/kubelet.conf 2>/dev/null; then
    echo "== joining $n"
    limactl shell --workdir / "$n" sudo bash -c "$JOIN"
  fi
done

echo
limactl shell --workdir / controlplane kubectl get nodes
