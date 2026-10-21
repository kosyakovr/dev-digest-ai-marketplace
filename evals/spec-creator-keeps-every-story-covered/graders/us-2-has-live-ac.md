---
type: regex
target: { source: file, path: docs/specs/export-csv.md }
pattern: '^- \*\*AC-(?!2\*\*)\d+\*\* \([^)\n]*\bUS-2\b[^)\n]*\)(?! *withdrawn)'
flags: m
---
