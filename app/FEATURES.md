# Features

Every part of the study app, what it keeps, and what it does in each situation below. A sweep of the app walks every row through every situation in a real browser, at desktop and phone width, in light and dark mode, and fixes what it finds in the same change. `tests/features.test.ts` fails when the code has a route, component, saved value, table, file or socket this page doesn't name, and `tests/browser/app.situations.ts` walks each situation (`pnpm test:situations`).

Platform facts are quoted from the platforms' own pages, read 2026-10-11. KK is KodeKloud, KC Killercoda.

## Situations

Each has a test in `tests/browser/app.situations.ts` whose name starts with it, unless marked otherwise.

- **fresh open**: the app opened in a new tab at `/`.
- **reload**: the page reloaded.
- **second window**: the same app in another window or tab.
- **same lab, other topic**: a topic whose lab is the same as the running one's (Kubernetes Objects and RBAC both use `cluster`).
- **different lab, other topic**: a topic with another lab.
- **lab not started**: no lab running, or a start that failed.
- **practice exam**: started, reloaded, left for another lesson.
- **pop-out**: the terminals in a window of their own.
- **Docker stopped**: Docker not answering.
- **idle**: a lab with no terminal open for an hour.
- **phone width**: 390px wide.
- **dark mode**: the system's dark mode, and a switch while the page is open.
- **notes**: typing, then leaving or closing at once.
- **lesson ticks**: the ✓ beside each lesson.
- **a request from another site**: a POST whose Origin isn't the app.
- **dev server restart** (no browser test): checked by hand (tabs come back as one fresh tab, a start under way is marked failed); a browser test can't restart the server it runs against. The Docker app has `restart: unless-stopped`, so a server that stops on an error comes back.
- **two servers** (no browser test): the Docker app on 5173 and a dev server both drive the same machines. Each re-reads `lab.json` and `lab.lock` on every check, a start from one shows as starting in the other and gives its windows fresh terminals, and neither stops a lab the other has a terminal open on.
- **second person** (no browser test): progress is saved on the learner's computer (Getting started says so), and the app answers only on that computer. Terminals accept only `localhost` and `127.0.0.1`, and `compose.yaml` publishes the app on `127.0.0.1` only. KK and KC give each learner an account ("Users wanting to use your scenarios will just need to register for free on Killercoda.").

## Routes

| Route | File | What it does |
| --- | --- | --- |
| `/` | `routes/home.tsx` | Dashboard. **fresh open**: Continue opens the lesson opened last (`visit`), or the first unfinished topic before any. Topics finished, lessons done per topic, quiz missed, best score; domain practice average over topics with a Practice section. Instruqt: "Continue from the last accessed challenge". |
| `/t/:domain/:topic/:lesson?` | `routes/topic.tsx` | A lesson. Records the visit. `/introduction` redirects to the topic's own address. Actions: `step`, `recall`, `practice-start`, `practice-finish`, `practice-pass`, `practice-quit`, `attempt`, `grade`, each refused unless `fromApp`. **reload**: the lesson pane's scroll comes back (`cka-scroll`). |
| `/doc/*` | `routes/doc.tsx` | Any Markdown page outside `app/`: Getting started, About the CKA, References, What's new (`CHANGELOG.md`), Learn and reference pages. A reference link opens beside the page (`split-doc`). |
| `/reference/*` | `routes/reference.ts` | A reference or Learn page's HTML for the panel beside a lesson. |
| `/lab/:lab` | `routes/lab.ts` | POST with `topic`: starts that topic's lab, ending any lab and practice exam under way. 409 while another start runs. |
| `/note/:domain/:topic` | `routes/note.ts` | POST `body`: saves the topic's notes. |
| `/terminal?topic=` | `routes/terminal.tsx` | **pop-out**: the topic's terminals in a window of their own; closes when the topic's lab ends. |
| `*` | `routes/missing.ts` | Page not found. |

## Components

| Component | What it does |
| --- | --- |
| `root.tsx` | Sidebar (hide/show, cookie `sidebar`), topic list with a meter of lessons done, each lesson with ✓ when done, help links (Getting started, About the CKA, References, What's new, kubectl cheat sheet). Opens `/events` so every page's lab status follows the lab. |
| `components/LabPane.tsx` | `useLab(topic, lab)`: running only when this topic started the running lab. `startQuestion`: the one question asked before machines are recreated. Start lab, Try again, "Your lab will be ready shortly.", "Docker is not running. Start Docker to start the lab.", "Another lab is starting." |
| `components/Pane.tsx` | Tabs beside the lesson: Terminal 1–4, + (up to four), × (not on the last), a reference tab, Open in new window (wide screens only), Reset lab, Hide panel. Terminals are keyed by the lab's generation, so a start or reset gives one fresh tab. |
| `components/Terminal.tsx` | One shell on `base`. Ctrl+Shift+C/V and a right-click menu (LF exam UI: "Copy = Ctrl+Shift+C", "Paste = Ctrl+Shift+V"). Only the focused window sets the shell's size. Follows a live dark-mode switch. "Session ended. Press Enter to start a new one." after `exit`. |
| `components/popout.ts` | The pop-out window, named `cka-terminal`, says it is open on the BroadcastChannel `cka-terminal`, so its topic's page knows after a reload. |
| `components/PracticeRun.tsx` | Practice exam from the saved `practice_run`: Start (asks, resets the lab), waiting for the lab, timer, Check per task, Finish, Check again, pass checkboxes when checks can't run, Save score, Quit, Hint, Solution, History. LF exam: the timer "will not pause". |
| `components/Step.tsx` | A step's check-off, folding a done step to its first line. |
| `components/RecallCard.tsx` | A quiz question: Show answer, Got it, Missed it. |
| `components/Notes.tsx` | The topic's notes under every lesson; saved a second after typing, and at once on blur, on leaving and on `pagehide`. |
| `components/ReferencePanel.tsx` | A reference or Learn page in a tab beside the page, with Back for pages opened from it. |
| `components/Split.tsx` | Page and panel side by side (stacked below `lg`), with a divider that drags, takes arrow keys, and resets on double-click; widths in cookies `split-lab` and `split-doc`. |
| `components/Confirm.tsx` | The dialog every question uses. |
| `components/Markdown.tsx` | Page HTML with a Copy button on code and Mermaid diagrams that follow dark mode. |

## Saved values

| Value | Where | Keyed by |
| --- | --- | --- |
| `cka-sidebar`, `cka-pane`, `cka-split-lab`, `cka-split-doc` | cookies (`prefs.ts`), read by the root loader so the first paint is right | browser |
| `cka-scroll` | sessionStorage: the lesson pane's scroll per history entry | browser tab |
| `react-router-scroll-positions` | sessionStorage, React Router's own for pages that scroll the window | browser tab |
| `mark` | table: checked-off steps (keyed by the step's first line) and quiz answers | topic |
| `note` | table: notes | topic |
| `attempt` | table: saved practice exam scores | topic |
| `visit` | table: each lesson opened and when | topic, lesson |
| `practice_run` | table: the practice exam under way, until Save score or Quit | topic |
| `lab.json` | file in `data/`: the topic whose lab is on the machines, or whose start failed | whole app |
| `lab.lock` | file in `data/`: the start under way, its process, the machine it runs on and when it began, so a restart or another server can tell whether it is still running | whole app |
| `lab.active` | file in `data/`: touched each minute while a server has a terminal open, so no server stops a lab in use through another | whole app |

## Lab controller and sockets

`lab/controller.ts` is the one owner of the lab, shared by the routes and the terminal server through `globalThis`.

- A lab belongs to the topic that started it, and only while the machines run that lab (**same lab, other topic**, **different lab, other topic**).
- One start at a time; a second gets "Another lab is starting." KC: "only ever one concurrent scenario on FREE".
- Every start and every stop is a new generation: shells end and the tabs start over at one (**second window**).
- Stops the lab after an hour with no terminal attached, never while a start or a practice exam is under way (**idle**). KK: "All work will be deleted after one hour"; Instruqt's idle stop is "Enabled by default with 5-minute timeout".
- `CKA_LAB_FAKE` swaps in `tests/browser/fake/lab.sh` and a local shell for the situation tests; `CKA_LAB_IDLE_MINUTES` sets the idle limit.

| Socket | What it sends |
| --- | --- |
| `/events` | The lab's view on connect and on every change; each page reloads its data when it differs (**Docker stopped**). |
| `/terminal` | `{tabs, gen}`; takes `{add}` and `{close}`. |
| `/terminal?id=&gen=` | One tab's shell; closes with "gone" when its generation has passed. KK: "Refreshing the lab window or experiencing temporary connectivity issues should return you to the same environment." |

Both refuse any page whose Origin isn't the app on `localhost` or `127.0.0.1`. `pnpm start` has no terminal: learners run the dev server through Docker.
