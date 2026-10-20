---
plugins: ["../../plugins/engineering-paved-path", "../../plugins/research-tools", "../../plugins/architecture-review", "../../plugins/sdd-engineering"]
description: The architecture reviewer is reachable by its namespaced name and asks for a change when there is nothing to review.
tags: [namespace, agents]
max_turns: 8
timeout_seconds: 300
allowed_tools: [Agent]
runs: 3
---
Run the architecture-review:architecture-reviewer agent on the current uncommitted change and relay its verdict.
