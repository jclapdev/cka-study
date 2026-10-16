#!/bin/bash
# Runs before systemd on each lab node.
set -e

# kubelet and containerd mount volumes into pods, which needs mounts to propagate.
mount --make-rshared /

# kubelet needs the cpu, memory and pids controllers in its cgroups. systemd turns them on
# only while no process sits in the top cgroup, and a `docker exec` that arrives before
# then lands there and holds it, so kubelet fails until that command ends. Turn them on
# now, from init.scope, where systemd keeps itself and later `docker exec`s join it.
if [ -f /sys/fs/cgroup/cgroup.controllers ]; then
  mkdir -p /sys/fs/cgroup/init.scope
  echo $$ > /sys/fs/cgroup/init.scope/cgroup.procs
  for c in $(cat /sys/fs/cgroup/cgroup.controllers); do
    echo "+$c" > /sys/fs/cgroup/cgroup.subtree_control 2>/dev/null || true
  done
fi

# Docker answers DNS at 127.0.0.11. CoreDNS forwards to the node's nameserver, and a
# loopback address there makes it find a loop and exit. Reach Docker's DNS through the
# gateway address instead, the way kind does.
dns=127.0.0.11
gw=$(ip -4 route show default | cut -d' ' -f3)
iptables-save |
  sed -e "s/-d $dns/-d $gw/g" \
      -e 's/-A OUTPUT \(.*\) -j DOCKER_OUTPUT/\0\n-A PREROUTING \1 -j DOCKER_OUTPUT/' \
      -e "s/--to-source :53/--to-source $gw:53/g" \
      -e "s/p -j DNAT --to-destination $dns/p --dport 53 -j DNAT --to-destination $dns/g" |
  iptables-restore
sed "s/$dns/$gw/" /etc/resolv.conf > /tmp/resolv.conf && cat /tmp/resolv.conf > /etc/resolv.conf

exec /sbin/init
