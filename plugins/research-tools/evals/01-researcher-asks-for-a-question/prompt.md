---
description: The researcher agent is reachable by its namespaced name and refuses a request with no concrete question.
tags: [namespace, agents]
max_turns: 8
timeout_seconds: 240
allowed_tools: [Agent]
runs: 3
---
Delegate this request, word for word, to the research-tools:researcher agent and relay its answer: "look into caching".
