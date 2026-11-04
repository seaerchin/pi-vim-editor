---
title: Publish the Visual selection
type: feature
authors:
  - seaerchin
created: 2026-11-05T00:00:00Z
---

The status capability is now version 2. `status().selection` holds the Visual selection as UTF-16 offsets into the prompt text, so an extension that draws the prompt itself can highlight it. Character selections give the range of `anchor` and `head`, line selections the lines between them, and block selections one range per line in `spans`. Version 1 fields are unchanged. See `docs/integration.md`.
