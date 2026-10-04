# Labs

Each exercise starts from one of these labs. Starting a lab resets all four machines.

### vms

Three bare machines with the Kubernetes tools installed and no cluster yet.

### cluster

A working three-node cluster, built with kubeadm, with the Flannel pod network and both workers labelled.

### helm

The `cluster` lab with Helm installed on `controlplane`, and one release, `legacy`, that Practice task 5 has to find.

### kustomize

The `cluster` lab with the files Practice task 3 hands over, under `/opt/course/3`.

### crds

The `cluster` lab with Helm installed on `controlplane`, and empty folders under `/opt/course` for the Practice answers.
