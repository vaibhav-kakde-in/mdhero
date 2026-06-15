# Scroll-sync wrap test (issue #21)

**How to test:** Stay in Reading mode and scroll down so one of the
`## Section N` headings sits at the very top of the viewport. Toggle to
**Raw** (`</>`), then to **Edit** (pencil). Each time, the same section
should be anchored at the top — you should see `## Section N` and a wall of
`secN secN …`, **not** Section 1's `sec1`. Before the fix it snaps near the
top (Section 1); after the fix it lands on the section you were reading.

The long line in each section is a *single* source line that wraps into many
visual rows — that wrapping is exactly what the old `line * lineHeight` math
got wrong. The repeated word tells you which section you're actually on.

---

## Section 1

Short normal paragraph for section 1. This line does not wrap, so it exercises the simple case alongside the long one below it.

sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 sec1 

## Section 2

Short normal paragraph for section 2. This line does not wrap, so it exercises the simple case alongside the long one below it.

sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 sec2 

## Section 3

Short normal paragraph for section 3. This line does not wrap, so it exercises the simple case alongside the long one below it.

sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 sec3 

## Section 4

Short normal paragraph for section 4. This line does not wrap, so it exercises the simple case alongside the long one below it.

sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 sec4 

## Section 5

Short normal paragraph for section 5. This line does not wrap, so it exercises the simple case alongside the long one below it.

sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 sec5 

## Section 6

Short normal paragraph for section 6. This line does not wrap, so it exercises the simple case alongside the long one below it.

sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 sec6 

## Section 7

Short normal paragraph for section 7. This line does not wrap, so it exercises the simple case alongside the long one below it.

sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 sec7 

