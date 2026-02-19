# Installation

Git clone `ComfyUI-NodeWrangler` to your `ComfyUI/custom_nodes/` directory and restart ComfyUI. No Python dependencies required — this is a frontend-only extension.

# ComfyUI Node Wrangler

Blender-inspired keyboard shortcuts for faster node connection/disconnection in ComfyUI. 
Just a prototype at the moment - has not been extensively tested yet. 
Some bugs might be present. 
Doesn't work with nodes 2.0 (yet?) 
 
Note: Like with Blenders nodewrangler, you'll find situations where you just have to join something manually. 
Its fairly time consuming to cover literally every possible combination of when something should or not connect.
Aside of having to do a manual connection here and there, this at least speeds things up for most scenarios.

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

### Ctrl + Alt + Right Mouse Button — Connect All


https://github.com/user-attachments/assets/985a5279-bb6c-4885-8a04-9f0f70941468


Hold **Ctrl**, **Alt** and **right-click drag** from one node to another to connect all matching sockets in a single drag.

- Connects every compatible socket pair at once — no need to drag multiple times.
- Each output connects to at most one input (one-to-one); a single output does not fan out to multiple inputs.
- Uses the same type-aware matching as Alt+RMB: IMAGE to IMAGE, MASK to MASK, MODEL to MODEL, etc.
- Supports V3 multi-type sockets.
- Already-connected sockets are skipped.
- If there's nothing to connect, both nodes show an orange highlight.
- While dragging, preview noodles show exactly which sockets will be connected.

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


## Todo
- Subgraph compatibility
- If there are multiple input sockets on the target node and you want to connect to a certain one, auto-detect which socket is closest to mouse.

## Update Log
### 17/02/2026 
Tweak: Single output vs multi output [commit](https://github.com/CoreyCorza/ComfyUI-NodeWrangler/commit/8adaa0fd46755bbab55356a847fad00398247caf) 
Needed to handle a single output being able to connect to multiple other nodes 
But also handle multiple outputs needing to connect to multiple nodes 
Will it affect anything else? Not sure.. seems ok.

https://github.com/user-attachments/assets/15e83772-0739-46f4-a20c-7c03aac7acfb

### 17/02/2026
Feature: Multi connect similar sockets using ctrl+alt+rightmouse [commit](https://github.com/CoreyCorza/ComfyUI-NodeWrangler/commit/e6fb2cf0e97b021bf53f12abc324e3061fc85c73) 
Handles connecting multiple sockets simutaneously which meet connection criteria. 
Also added deselect nodes when operation finishes, to workaround comfyui's natively bound ctrl+select which annoyingly causes nodes to become selected. 

https://github.com/user-attachments/assets/25dd2581-83f9-46e3-b3e5-18c29b28c602


### 19/07/2026
Tweak: Subgraph compatibility [commit](https://github.com/CoreyCorza/ComfyUI-NodeWrangler/commit/fe874922053dab3d82e367085dc017cd01f49736)  
Using app.graph to obtain the correct active layer  
