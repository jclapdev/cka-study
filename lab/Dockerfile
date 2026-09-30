# The lab machines. `node` is controlplane, node01 and node02: systemd, containerd and
# the kubeadm tools at Kubernetes 1.34, with no cluster yet. `base` is where you start,
# as in the exam: an ssh client and the key the three nodes accept, nothing else.
#
# Kubernetes 1.34 is installed deliberately. The exam runs 1.35, so the cluster-upgrade
# exercise has a real version to climb to.

FROM ubuntu:24.04 AS key
RUN apt-get update -qq && apt-get install -y -qq openssh-client >/dev/null && \
    ssh-keygen -q -t ed25519 -N '' -C cka-lab -f /id_ed25519

FROM ubuntu:24.04 AS node
ARG MINOR=1.34
ARG YQ_VERSION=v4.53.6
ARG TARGETARCH
ENV container=docker DEBIAN_FRONTEND=noninteractive
RUN apt-get update -qq && apt-get install -y -qq \
      systemd systemd-sysv dbus openssh-server sudo iproute2 iptables kmod \
      containerd apt-transport-https ca-certificates curl gpg jq etcd-client \
      bash-completion vim less >/dev/null && \
    mkdir -p /etc/apt/keyrings && \
    curl -fsSL https://pkgs.k8s.io/core:/stable:/v$MINOR/deb/Release.key | \
      gpg --dearmor -o /etc/apt/keyrings/kubernetes-apt-keyring.gpg && \
    echo "deb [signed-by=/etc/apt/keyrings/kubernetes-apt-keyring.gpg] https://pkgs.k8s.io/core:/stable:/v$MINOR/deb/ /" \
      > /etc/apt/sources.list.d/kubernetes.list && \
    apt-get update -qq && apt-get install -y -qq kubelet kubeadm kubectl cri-tools >/dev/null && \
    apt-mark hold kubelet kubeadm kubectl && \
    curl -fsSL -o /usr/local/bin/yq https://github.com/mikefarah/yq/releases/download/$YQ_VERSION/yq_linux_$TARGETARCH && \
    chmod +x /usr/local/bin/yq && \
    rm -rf /var/lib/apt/lists/*
RUN mkdir -p /etc/containerd && containerd config default > /etc/containerd/config.toml && \
    sed -i 's/SystemdCgroup = false/SystemdCgroup = true/' /etc/containerd/config.toml && \
    # A node's disk is Docker's overlayfs, and overlayfs cannot be layered on itself.
    sed -i -e "s/snapshotter = 'overlayfs'/snapshotter = 'native'/" \
           -e 's/use_local_image_pull = false/use_local_image_pull = true/' /etc/containerd/config.toml && \
    # Docker's machine has swap, and every node shares it.
    echo KUBELET_EXTRA_ARGS=--fail-swap-on=false > /etc/default/kubelet && \
    crictl config runtime-endpoint unix:///run/containerd/containerd.sock && \
    systemctl enable containerd kubelet ssh && \
    systemctl mask getty.target console-getty.service && \
    echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/ubuntu && \
    for rc in /root/.bashrc /home/ubuntu/.bashrc; do printf '%s\n' \
      'source <(kubectl completion bash)' 'alias k=kubectl' 'complete -o default -F __start_kubectl k' >> $rc; done
COPY --from=key --chown=ubuntu:ubuntu --chmod=600 /id_ed25519.pub /home/ubuntu/.ssh/authorized_keys
RUN chmod 700 /home/ubuntu/.ssh
COPY --chmod=755 entrypoint.sh /entrypoint
STOPSIGNAL SIGRTMIN+3
ENTRYPOINT ["/entrypoint"]

FROM ubuntu:24.04 AS base
RUN apt-get update -qq && apt-get install -y -qq openssh-client sudo iproute2 curl vim less bash-completion >/dev/null && \
    rm -rf /var/lib/apt/lists/* && \
    echo 'ubuntu ALL=(ALL) NOPASSWD:ALL' > /etc/sudoers.d/ubuntu
COPY --from=key --chown=ubuntu:ubuntu --chmod=600 /id_ed25519 /home/ubuntu/.ssh/id_ed25519
# Host keys change whenever a lab starts, so they are not pinned.
RUN printf 'Host *\n  StrictHostKeyChecking no\n  UserKnownHostsFile /dev/null\n  LogLevel ERROR\n' > /home/ubuntu/.ssh/config && \
    chown ubuntu:ubuntu /home/ubuntu/.ssh/config /home/ubuntu/.ssh && chmod 700 /home/ubuntu/.ssh
USER ubuntu
WORKDIR /home/ubuntu
CMD ["sleep", "infinity"]
