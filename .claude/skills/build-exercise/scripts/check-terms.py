#!/usr/bin/env python3
"""Reports terms a reader meets without an explanation.

Reads ../assets/terms.tsv: one `term<TAB>home` per line, where home is
`references/<page>.md#<anchor>` (or `references/<page>.md` when the page's opening
paragraph explains it), `inline` for a term from a topic not built yet, which each page
defines in the paragraph where it first appears, or `known` for what the reader brings.

  NO LINK <file> <term>       the term's first mention in the file has no link to its home
                              (for `inline`, no "<term> is ..." in that paragraph)
  NOT DEFINED <home> <term>   the home section has no sentence that starts with the term or
                              says "<term> is ...", and no table row naming it
  UNKNOWN <file> <word>       an acronym or capitalised name that terms.tsv doesn't list

Fenced code blocks and headings are skipped. Usage: check-terms.py [FILE.md ...]
With no files, checks every page the app shows. Exits 1 if anything is reported.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
TERMS = Path(__file__).resolve().parents[1] / "assets" / "terms.tsv"
DEFAULT = ["README.md", "EXAM.md", "lab/README.md", "lab/labs.md", "references/[!R]*.md", "[0-9][0-9]-*/[0-9][0-9]-*/README.md"]


def load_terms():
    terms = {}
    for line in TERMS.read_text().splitlines():
        if line.strip() and not line.startswith("#"):
            term, home = line.split("\t")
            terms[term] = home
    return terms


def blocks(text):
    """Yields (line number, text) per paragraph, list item or table row, outside code fences."""
    fenced, start, cur = False, 0, []
    lines = text.splitlines()
    for n, line in enumerate(lines, 1):
        if n < len(lines) and re.match(r"\|[\s|:-]+\|$", lines[n].strip()):
            line = ""  # a table's header row names columns, not terms
        if line.lstrip().startswith("```"):
            fenced = not fenced
            line = ""
        if fenced or not line.strip() or line.startswith("#") or re.match(r"\s*([-*] |\d+\. |\||>)", line):
            if cur:
                yield start, " ".join(cur)
            cur = []
            if fenced or not line.strip() or line.startswith("#"):
                continue
        if not cur:
            start = n
        cur.append(line.strip())
    if cur:
        yield start, " ".join(cur)


def pattern(term):
    stem = re.escape(term[:-1]) + "(?:y|ies)" if term.endswith("y") else re.escape(term) + "(?:s|es)?"
    return re.compile(r"(?<![\w/.-])" + stem + r"(?![\w-])")


def slug(heading):
    return re.sub(r"[^\w\- ]", "", heading.strip().lower()).replace(" ", "-")


def section(page, anchor):
    """The home section's text: from its heading to the next heading of the same or higher level."""
    lines = (ROOT / page).read_text().splitlines()
    if not anchor:
        end = next((i for i, l in enumerate(lines) if l.startswith("## ")), len(lines))
        return "\n".join(lines[:end])
    for i, l in enumerate(lines):
        m = re.match(r"(#+) (.*)", l)
        if m and slug(m.group(2)) == anchor:
            level = len(m.group(1))
            end = next((j for j in range(i + 1, len(lines)) if re.match(r"#{1,%d} " % level, lines[j])), len(lines))
            return "\n".join(lines[i:end])
    return None


def plain(text):
    return re.sub(r"\[([^\]]*)\]\([^)]*\)", r"\1", text).replace("`", "").replace("*", "")


def defined(term, text):
    t = re.escape(term)
    if term[0].isalpha():
        t = "[" + term[0].upper() + term[0].lower() + "]" + re.escape(term[1:])
    # ponytail: a pattern match for "<term> is", not a judgement of the definition; the reread step covers quality
    return re.search(r"(?<![\w-])" + t + r"(?:s|es)?(?: \([^)]*\))?,? (?:is|are|stands for|means|which)\b", text) or \
        re.search(r"(?:^|[.:] |and )(?:An? |The |a |an )?" + t + r"(?: \([^)]*\))? [a-z]", text, re.M) or \
        re.search(r"^\|[^|\n]*(?<![\w])" + t + r"(?![\w])[^|\n]*\|", text, re.M)


def main(files):
    terms = load_terms()
    problems = []
    for term, home in terms.items():
        if home in ("known", "inline"):
            continue
        page, _, anchor = home.partition("#")
        if not (ROOT / page).exists():
            problems.append(f"NO PAGE {home} {term}")
            continue
        text = section(page, anchor)
        if text is None:
            problems.append(f"NO ANCHOR {home} {term}")
        elif not defined(term, plain(text)):
            problems.append(f"NOT DEFINED {home} {term}")

    acronym = re.compile(r"(?<![\w/.-])([A-Z][A-Z0-9]+|[A-Z][a-z]+[A-Z]\w*)(?![\w-])")
    midcap = re.compile(r"(?<=[a-z,;] )([A-Z][a-z]+)(?![\w-])")
    for f in files:
        rel = str(Path(f).resolve().relative_to(ROOT))
        paragraphs = list(blocks((ROOT / rel).read_text()))
        seen = set()
        for _, para in paragraphs:
            words = para
            for term in terms:
                if " " in term:
                    words = words.replace(term, " ")
            words = re.sub(r"`[^`]*`|\[[^\]]*\]\(https?:[^)]*\)|\]\([^)]*\)|https?://\S+", " ", words)
            for word in acronym.findall(words) + midcap.findall(words):
                if word not in terms and re.sub("e?s$", "", word) not in terms and word.rstrip("s") not in terms and re.sub("ies$", "y", word) not in terms and word not in seen:
                    seen.add(word)
                    problems.append(f"UNKNOWN {rel} {word}")
        for term, home in terms.items():
            if home == "known":
                continue
            page, _, anchor = home.partition("#")
            p = pattern(term)
            first = next(((n, para) for n, para in paragraphs
                          if p.search(re.sub(r"`[^`]*`|\[[^\]]*\]\(https?:[^)]*\)", " ", para))), None)
            if not first:
                continue
            n, para = first
            if home == "inline":
                if not defined(term, plain(para)):
                    problems.append(f"NOT DEFINED {rel}:{n} {term}")
                continue
            if rel == page:
                if anchor and f"(#{anchor})" not in para:
                    home_line = next((i for i, l in enumerate((ROOT / rel).read_text().splitlines(), 1)
                                      if re.match(r"#+ ", l) and slug(l.lstrip("#")) == anchor), 0)
                    if n < home_line:
                        problems.append(f"USED BEFORE DEFINED {rel}:{n} {term}")
                continue
            target = Path(page).name + (f"#{anchor})" if anchor else "")
            if not re.search(re.escape(target) + (r"" if anchor else r"[)#]"), para):
                problems.append(f"NO LINK {rel}:{n} {term}")

    print("\n".join(problems))
    return 1 if problems else 0


if __name__ == "__main__":
    args = sys.argv[1:] or sorted({str(p) for g in DEFAULT for p in ROOT.glob(g)})
    sys.exit(main(args))
