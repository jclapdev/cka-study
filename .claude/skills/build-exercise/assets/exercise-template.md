# <Title: what the reader does, e.g. "Bootstrapping a Cluster with kubeadm">

<One paragraph: what this tool or concept does, in plain words.>

Starts from the [`<lab-name>` lab](../../lab/labs/<lab-name>/README.md). Every command runs on `controlplane`, reached with `ssh controlplane` from `base`, unless a step says otherwise.

## Objectives

* <One line per thing the reader will be able to do.>

## <First step group, named for what it achieves>

<At most one or two sentences on what the concept is, then link the reference page that
explains it: [<section heading>](../../references/<concept>.md#<section-anchor>).>

1. <Instruction>:

   ```shell
   <command>
   ```

   <Only when the reader has to read the output:>
   The output is similar to this:

   ```
   <trimmed output, captured from the lab>
   ```

   <One sentence on what to notice, with a link to the reference page that explains it. A one-line
   result goes here instead of in an output block.>

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
   one host to another is refused, as in the exam:

   ```shell
   exit               # back to base
   ssh node01
   <command>
   exit
   ssh controlplane
   ```

## <Next step group>

...

## Quiz

<details><summary><Question?></summary>

<Answer, two to four lines.>
</details>

## Practice

Do it again without the steps above, the way the exam asks. Give yourself **<N> minutes**.

Start from a fresh [`<lab-name>` lab](../../lab/labs/<lab-name>/README.md). When time is up,
[grade the run](../../lab/README.md#grading).

1. **Host `controlplane`, weight <N>%.** <Task in exam wording, no steps. Name any file the
   exam would hand over, such as `/opt/course/1/kustomization.yaml`, placed by `setup.sh`.>
2. **Host `node01`, weight <N>%.** `ssh node01` first. <Task.>

<details><summary>Solution</summary>

Task 1:

```shell
ssh controlplane
k <command>
vim <file>
```

```yaml
<what the file holds after editing>
```

Task 2:

```shell
exit               # back to base
ssh node01
<commands>
exit
```

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

## Next

* [<kubernetes.io page>](https://kubernetes.io/docs/...) <says what it adds beyond this exercise>.
