---
name: ElectionMap core product vision
description: Key product decisions about how elections are displayed, time-filtered, and automatically maintained
type: project
---

ElectionMap should be a continuously self-updating system. Elections appear automatically as data sources publish them and drop off after their election date passes.

**Time filtering:** The map should only show elections closing within a configurable time window (e.g. next 6 months). Without this, the amount of data is overwhelming. The user should be able to adjust this window.

**Why:** The Hank Green / Georgia PSC insight — people don't know about elections that directly affect them. The tool surfaces upcoming elections by location so anyone can discover and share them.

**Data sources contacted (pending):** BallotReady and Democracy Works for local election coverage (school boards, water districts, municipal). These are the missing piece for truly comprehensive coverage.

**How to apply:** Always filter by date in queries. When building UI features, consider that the dataset will be large (potentially tens of thousands of elections nationwide) and needs to be scoped by both geography and time.
