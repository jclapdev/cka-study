# Style list

Every habit that has made a page read oddly, with a line that failed and its rewrite. Read this before writing any sentence a learner sees, and check each sentence you wrote against it before the page is done. The `style-reader` agent checks every entry on each changed page, and Vale checks the entries marked **Vale** on every test run and push.

Each entry's id is what the `style-reader` reports.

## Counts

**empty-count** (Vale for known phrases). A number where the reader would never expect a different one. Write "a", or name the thing. Keep a count that is a fact the reader uses ("three machines", "`3/3` means all three pods are ready") or a contrast the sentence makes ("one pod per node", "exactly one plugin").
- Fail: "A Service gives pods one fixed IP and a DNS name."
- Pass: "A Service gives pods a stable IP and a DNS name."
- Fail: "`--set replicaCount=2` overrides one value."
- Pass: "`--set replicaCount=2` overrides `replicaCount`."

**heading-count** (Vale). A number in a heading.
- Fail: "## Give pods one address with a Service", "## Three address ranges"
- Pass: "## Reach pods through a Service", "## Address ranges"

## The lab and the app

**lab-talk** (Vale for known phrases). Text that describes the lab, the computer it runs on, or how it is built. The app never describes a lab; a task states any fact it needs.
- Fail: "The lab installed one release for the Practice section to find."
- Pass: "One release, `legacy`, is already installed."

**app-talk**. Text that describes the app itself, what it stores, or how its screens behave. Show the thing instead.
- Fail: a start message "about 6 minutes, since it builds the machines first", and a Machines section beside the lesson.
- Pass: "Your lab will be ready shortly.", and the machines named once in the topic's Introduction.
- Keep: the Introduction's "The lab beside each lesson is a working Kubernetes cluster of three machines." It says what the learner is working on, and a test requires it.

**invented-term** (Vale). A word made up while building. Use what a learner already says: lab, quiz, practice exam, score.
- Fail: "starting state", "Recall", "timed run", "ticks"
- Pass: "lab", "Quiz", "practice exam", "score"

**author-side**. Text from the author's side about how the course is put together.
- Fail: "This topic names no lab.", "the steps above", "the columns this section does not discuss"
- Pass: "This topic has no lab.", or name the step.

## Headings

**phrase-heading**. A heading that is a phrase instead of a name.
- Fail: "Where you are", "Practice it"
- Pass: "Dashboard", "Practice"

## Narration

**narration** (Vale for known phrases). A sentence about the lesson, the reader, or how much something matters, instead of about Kubernetes. If deleting it loses no fact, delete it.
- Fail: "In this lesson, you will…", "Nothing here schedules a pod, so nothing waits.", "worth recognising on sight", "the single most common reason…", "One role, one subject list.", "kubectl says the quiet part out loud.", "Note that…", "This matters for RBAC."
- Pass: delete the sentence.

**coaching**. Telling the learner how to study, or explaining an edge case they didn't ask about.
- Fail: "Answer each one in your head before you open it."
- Pass: delete the sentence.

**exam-framing**. Framing a lesson around the exam. Name the CKA only for a fact about it, such as its hosts, its keys or the docs it allows.
- Fail: "the way the exam asks", "every exam host", "which is what you want under exam time"
- Pass: "The exam's hosts share nothing between tasks."

## Sentences

**stacked-clauses**. Two or more add-on clauses (", which …", ", so …") on one sentence. A single "so" or "which" that gives the reason is fine; a chain makes the reader hold too much.
- Fail: "Both of these DaemonSets tolerate every `NoSchedule` taint, so they also run on the control plane node, which kubeadm taints `node-role.kubernetes.io/control-plane:NoSchedule`."
- Pass: "kubeadm taints the control plane node `node-role.kubernetes.io/control-plane:NoSchedule`. Both of these DaemonSets tolerate every `NoSchedule` taint, so they run there too."

**false-absolute**. "every", "nothing", "never", "only", "always" where the claim is not literally true, or where the absolute adds nothing.
- Fail: "Every command runs on `controlplane`." in a topic's Introduction, before anything said the reader logs in to `base` first.
- Keep: an absolute that is literally true and is the point, such as "Helm runs only as a command-line tool" or the Practice section's "Every task runs on `controlplane`."

## Explaining

**named-without-purpose**. A tool, image, command or object named with what it is but not why this step uses it, or with neither. Every name gets both, where it first appears on the page.
- Fail: "`run tmp` starts a pod from the small `busybox` image."
- Pass: "The name `web` works only inside the cluster, from a pod, because only pods use the cluster's DNS server. So start a short-lived pod to act as the client. Its image is `busybox`, a few megabytes that hold a shell and small versions of everyday Linux tools such as `wget`."

**quiz-untaught**. A quiz question, hint or Practice task that needs a fact no lesson in the topic taught. Teach it in the lesson, or cut the question.
- Fail: "Why can't a ClusterRoleBinding reference a Role?" when no step mentions it.
- Pass: the step that creates the ClusterRoleBinding says "It grants only a ClusterRole: it has no `--role` flag, because a Role's rules belong to one namespace."

**shown-not-pasted**. A step that tells the reader to paste, copy or edit a file without showing what the file holds afterwards.
- Fail: "copy the `CronTab` CustomResourceDefinition … Paste it into `vim resourcedefinition.yaml`", with no YAML on the page.
- Pass: the same step, then the file as it reads after pasting, then a sentence on its fields.

**false-secret**. Calling something secret that isn't. In a `kubeadm join` line only the token is secret; the CA hash is public. (Vale)
- Fail: "The join line carries one secret in each direction."
- Pass: "The CA hash lets the node check that it reached the right cluster, and anyone may see it. The bootstrap token is the secret part."

**renamed-title**. Link text that names a docs page differently from its own title, such as British spellings of an American page. (Vale)
- Fail: "[Customising CoreDNS](…/dns-custom-nameservers/)"
- Pass: "[Customizing DNS Service](…/dns-custom-nameservers/)"

## Stock phrases

**stock-phrase** (Vale). Phrases from Wikipedia's "Signs of AI writing" that course text never needs: "serves as", "stands as", "plays a key role", "delve", "seamless", "leverage", "a testament to", and "not just X but Y" or "not only X but also Y". None is in the pages; Vale keeps them out.
- Pass: "The apiserver is the centre of the cluster.", not "serves as the centre".

## Adding an entry

When a page reads oddly in a way no entry covers, add an entry here with the line that failed and its rewrite, and add a Vale rule in `.vale/styles/CKA/` if a phrase or pattern catches it without catching good lines. Then fix every page that has it, in the same change. To find habits nobody has named yet, run `pnpm overused` from `app/`: it lists the phrases these pages use far more often than the Kubernetes docs do.
