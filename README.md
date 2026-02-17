# Installation

Git clone or download/drop the `ComfyUI-NodeWrangler` folder into your `ComfyUI/custom_nodes/` directory and restart ComfyUI. No Python dependencies required — this is a frontend-only extension.

# ComfyUI Node Wrangler

Blender-inspired keyboard shortcuts for faster node connection/disconnection in ComfyUI.
Just a prototype at the moment - has not been extensively tested yet to handle all scenarios.
Some bugs might be present.

## Features

### Alt + Right Mouse Button — Connect Nodes


https://github.com/user-attachments/assets/0443b0f7-a1db-4d05-b2e7-bae9fa5f3836


Hold **Alt** and **right-click drag** from one node to another to automatically connect them.

- You don't need to aim at a specific socket — just start anywhere on the source node and release on the target node.
- Each drag connects **one** socket pair (the first available match). Drag again between the same nodes to connect the next pair.
- Matching is type-aware: IMAGE connects to IMAGE, MASK to MASK, MODEL to MODEL, etc.
- Supports V3 multi-type sockets (e.g. a socket accepting both IMAGE and MASK).
- Already-connected sockets are skipped automatically.
- If there's nothing to connect, both nodes show an orange highlight.
- While dragging, a preview noodle shows exactly which sockets will be connected.

### Ctrl + Right Mouse Button — Cut Connections

Hold **Ctrl** and **right-click drag** to draw a slash across noodles to disconnect them.


https://github.com/user-attachments/assets/cef28732-9def-4ff8-946a-7ec19c6c1b25


- Any noodle your slash line crosses gets removed.
- Cut multiple noodles in a single drag.
- A dashed red line shows the cut path as you drag.

## Configuration

The top of `web/nodewrangler.js` has variables you can tweak:

| Variable | Default | Description |
|---|---|---|
| `NW_COLOR` | `#5B9DF0` | Color of the connect preview noodle and node highlights |
| `NW_GLOW` | `12` | Glow intensity around noodles and node borders |
| `NW_RADIUS` | `10` | Corner radius of the node highlight borders |
| `NW_DOT` | `4` | Size of the dots at each end of the preview noodle |
| `NW_NO_MATCH_COLOR` | `#E8A035` | Highlight color when no sockets are available |
| `NW_CUT_COLOR` | `#E85050` | Color of the cut slash line |




## Update Log
17/02-2026 - Tweak: Single output vs multi output
Needed to handle a single output being able to connect to multiple other nodes
But also handle multiple outputs needing to connect to multiple nodes

https://github.com/user-attachments/assets/15e83772-0739-46f4-a20c-7c03aac7acfb


