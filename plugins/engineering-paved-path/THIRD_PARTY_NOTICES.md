# Third-party notices — engineering-paved-path

This plugin ships thirteen skills. Some were copied from third-party repositories,
some reached this repository through the DevDigest project, and two are original
to this repository.

**Every skill that was copied has been modified** to remove references to the
project it came from (paths, package names, examples, registry metadata) and to
make it work in any repository. Cross-references were changed to the
`engineering-paved-path:<skill>` form. The modifications are released under the
license of the original work.

## Summary

| Skill | Origin | Upstream path | License |
|---|---|---|---|
| `fastify-best-practices` | [mcollina/skills](https://github.com/mcollina/skills) | `skills/fastify/` (`SKILL.md`, `rules/`) | MIT |
| `drizzle-orm-patterns` | [giuseppe-trisciuoglio/developer-kit](https://github.com/giuseppe-trisciuoglio/developer-kit) | `plugins/developer-kit-typescript/skills/drizzle-orm-patterns` | MIT |
| `postgresql-table-design` | [wshobson/agents](https://github.com/wshobson/agents) | `plugins/database-design/skills/postgresql-table-design` | MIT |
| `typescript-expert` | [sickn33/antigravity-awesome-skills](https://github.com/sickn33/antigravity-awesome-skills) | `skills/typescript-expert` | MIT |
| `zod` | [pproenca/dot-skills](https://github.com/pproenca/dot-skills) | `skills/.curated/zod` | MIT |
| `react-best-practices` | Copied via the DevDigest project; original source not recorded | — | See note below |
| `react-testing-library` | Copied via the DevDigest project; original source not recorded | — | See note below |
| `security` | Copied via the DevDigest project; original source not recorded | — | See note below |
| `mermaid-diagram` | Copied via the DevDigest project; original source not recorded | — | See note below |
| `onion-architecture` | Copied via the DevDigest project; original source not recorded | — | See note below |
| `frontend-ui-architecture` | Copied via the DevDigest project; original source not recorded | — | See note below |
| `next-best-practices` | Original to this repository, written from the official Next.js documentation | — | MIT, see [LICENSE](LICENSE) |
| `skill-routing` | Original to this repository | — | MIT, see [LICENSE](LICENSE) |

**Note on skills copied via DevDigest.** The original source of these six skills
was not recorded when they were copied into the DevDigest project. The marketplace
owner treats them as trusted for redistribution. If you are the author of one of
them, open an issue and the attribution will be corrected.

## Changes made to third-party skills

- `fastify-best-practices`: registry file `tile.json` and the `metadata` frontmatter
  key removed; description rewritten trigger-first; a title and a pointer to
  `engineering-paved-path:onion-architecture` for layering added. Rule files unchanged.
- `drizzle-orm-patterns`: `allowed-tools` frontmatter removed; description rewritten
  trigger-first. Reference files unchanged.
- `postgresql-table-design`: description rewritten trigger-first. Body unchanged.
- `typescript-expert`: non-standard frontmatter keys removed; description rewritten;
  references to subagents that do not exist in this plugin removed; a "Bundled
  Resources" section added; `scripts/ts_diagnostic.py` changed to run without a
  shell, to use only a locally installed TypeScript compiler (no `npx` download),
  and to write no files.
- `zod`: the compiled `AGENTS.md`, `README.md`, `references/_sections.md` and the
  rule-authoring template removed; the quick reference now links each rule file;
  references to skills that are not part of this plugin removed.

## License texts

### mcollina/skills — `fastify-best-practices`

```
MIT License

Copyright (c) 2026 Matteo Collina

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### giuseppe-trisciuoglio/developer-kit — `drizzle-orm-patterns`

```
MIT License

Copyright (c) 2025 Giuseppe Trisciuoglio

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### wshobson/agents — `postgresql-table-design`

```
MIT License

Copyright (c) 2024 Seth Hobson

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### sickn33/antigravity-awesome-skills — `typescript-expert`

```
MIT License

Copyright (c) 2026 Antigravity User

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

### pproenca/dot-skills — `zod`

The upstream LICENSE file names no copyright holder; its copyright line is
reproduced exactly. The repository owner is GitHub user `pproenca`.

```
MIT License

Copyright (c) 2025

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
