# <The short name from the root README table, e.g. "Helm" or "etcd Backup and Restore">

<One paragraph: what this tool or concept does, in plain words.>

<!-- lab: <lab-name> -->

You log in to `base`, which has no `kubectl`. From there you can `ssh` to `controlplane` and the two workers, `node01` and `node02`, which make up a working cluster with [Flannel](../../references/pod-network.md#plugins) as its pod network. <What this topic's lab already has set up, if anything.> Every command runs on `controlplane` unless a step says otherwise.

## Objectives

* <One line per thing the reader will be able to do.>

## <First lesson: one task, named for what it achieves, e.g. "Find a chart">

<At most one or two sentences on what the concept is, with the link on the term itself:
A [<term>](../../references/<concept>.md#<section-anchor>) is ...>

1. <Instruction, then what the command does and why. Then each part the lesson has not
   explained yet: "`-n drill` runs it in the namespace `drill`. `--replicas=2` asks for two
   pods.">:

   ```shell
   <command>
   ```

   <Only when the reader has to read the output:>
   <One sentence on what to look at in this output, ending with a colon.>

   ```
   <trimmed output, captured from the lab>
   ```

   <What the output shows and what it means, with a link on the first mention of any new term
   in this lesson. A one-line result goes here instead of in an output block.>

2. <Instruction for a manifest kubectl can write>:

   ```shell
   kubectl create <kind> <name> <flags> --dry-run=client -o yaml > <file>.yaml
   ```

3. <Instruction for a manifest no kubectl command writes.> Search kubernetes.io for
   `<search term>`, open [<page title>](https://kubernetes.io/docs/<page>/#<section>), and copy
   the <example file or `cat <<EOF` block> in <section name>. Paste it into `vim <file>.yaml`,
   then change <what>:

   ```yaml
   <the finished file, or only the changed lines with enough context to place them>
   ```

4. Open `<file>` in vim, <what to add or change and where>, and save:

   ```yaml
   <the lines to add, at their real indentation>
   ```

5. On `node01`, <instruction for work on a worker>. Go back to `base` first, because ssh from
   one host to another is refused:

   ```shell
   exit               # back to base
   ssh node01
   <command>
   exit
   ssh controlplane
   ```

## <Next lesson>

...

## Quiz

<details><summary><Question?></summary>

<Answer, two to four lines.>
</details>

## Practice

Do it again without the steps, in **<N> minutes**.

1. **Host `controlplane`, weight <N>%.** <Task in exam wording, no steps. Name any file the
   exam would hand over, such as `/opt/course/1/kustomization.yaml`, placed by `setup.sh`.>

   <details><summary>Hint</summary>

   <The command, flag or docs search that starts the task, or its trap. Not the answer.>

   </details>

2. **Host `node01`, weight <N>%.** `ssh node01` first. <Task.>

   <details><summary>Hint</summary>

   <Hint.>

   </details>

<details><summary>Solution</summary>

**Task 1.** <Why this approach, and what any flag or field the steps did not explain does.>

```shell
ssh controlplane
k <command>
vim <file>
```

```yaml
<what the file holds after editing>
```

```shell
k <command that reads the result back>
```

<One sentence on what to look at in the output, ending with a colon.>

```
<the real output from the lab, trimmed>
```

<What the output confirms, such as "`READY` `True` means the certificate was signed.">

**Task 2.** <Why this approach.>

```shell
exit               # back to base
ssh node01
<commands>
cat <file the task wrote>
exit
```

<What the result shows.>

</details>

## Check your work

Run these on `controlplane`.

1. <What this proves>:

   ```shell
   <command>
   ```

   ```
   <expected output>
   ```

## Further reading

* [<kubernetes.io page>](https://kubernetes.io/docs/...) <says what it adds beyond this topic>.
