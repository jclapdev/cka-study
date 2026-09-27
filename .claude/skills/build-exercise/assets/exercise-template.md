# <Title: what the reader does, e.g. "Bootstrapping a Cluster with kubeadm">

<One paragraph: what this tool or concept does, in plain words.>

Exam domain: <Domain name as in EXAM.md> (<weight>%).

Starts from the [`<lab-name>` lab](../../lab/README.md#<lab-name>). Every command runs on `controlplane` unless a step says otherwise.

## Objectives

* <One line per thing the reader will be able to do.>

## <First step group, named for what it achieves>

<At most one or two sentences on what the concept is, then link the reference page that
explains it: [<concept>](../../references/<concept>.md).>

1. <Instruction>:

   ```shell
   <command>
   ```

   The output is similar to this:

   ```
   <trimmed output, captured from the lab>
   ```

   <One sentence on what to notice, with a link to the reference page that explains it.>

2. On `node01`, <instruction for a step on another machine>:

   ```shell
   <command>
   ```

## <Next step group>

...

## Recall

Answer before opening.

<details><summary><Question?></summary>

<Answer, two to four lines.>
</details>

## Practice it

Do it again without the steps above, the way the exam asks. Give yourself **<N> minutes**.

Start from a fresh [`<lab-name>` lab](../../lab/README.md#<lab-name>).

1. **Host `controlplane`, weight <N>%.** <Task in exam wording, no steps.>
2. **Hosts `controlplane`, `node01`, weight <N>%.** <Task.>

<details><summary>Solution</summary>

```shell
# 1.
<commands>

# 2.
<commands>
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

## What's next

* [<kubernetes.io page>](https://kubernetes.io/docs/...) <says what it adds beyond this exercise>.
