// CRZ Node Wrangler - Blender-style node connection shortcuts
// Alt + RMB drag: connect nodes (one socket pair per drag)
// Ctrl + Alt + RMB drag: connect all matching sockets at once
// Ctrl + RMB drag: cut noodles by slashing across them

const NW_COLOR = "#5B9DF0";
const NW_GLOW = 12;
const NW_RADIUS = 10;
const NW_DOT = 4;
const NW_NO_MATCH_COLOR = "#E8A035";
const NW_CUT_COLOR = "#E85050";
const NW_BUTTON_COLOR = "rgb(93, 178, 235)";
const NW_BUTTON_OFF_COLOR = "#666";
const NW_STORAGE_KEY = "comfy-nodewrangler-enabled";

let app;
try {
    const appMod = await import("../../scripts/app.js");
    app = appMod.app;
} catch (_) {
    try {
        const appMod = await import("/extensions/core/scripts/app.js");
        app = appMod.app;
    } catch (_) {}
}
app = app || (typeof window !== "undefined" && window.comfyAPI?.app?.app);

if (app) {
    app.registerExtension({
        name: "CRZ.NodeWrangler",
        async setup() {
            const canvas = app.canvas;
            if (!canvas) return;

            const state = {
                active: false,
                sourceNode: null,
                startX: 0,
                startY: 0,
                mouseX: 0,
                mouseY: 0,
                targetNode: null,
                connectAllMode: false,
            };

            const cutState = {
                active: false,
                points: [],
            };

            let enabled = true;
            try {
                const stored = localStorage.getItem(NW_STORAGE_KEY);
                if (stored !== null) enabled = stored === "true";
            } catch (_) {}

            function setEnabled(v) {
                enabled = !!v;
                try {
                    localStorage.setItem(NW_STORAGE_KEY, String(enabled));
                } catch (_) {}
                btn.classList.toggle("nw-off", !enabled);
                btn.title = enabled ? "Node Wrangler: ON (Alt/Ctrl/Ctrl+Alt+RMB)" : "Node Wrangler: OFF";
            }

            const btn = document.createElement("button");
            btn.className = "comfy-nodewrangler-toggle";
            btn.textContent = "NodeWrangler";
            btn.title = "Node Wrangler: ON (Alt/Ctrl/Ctrl+Alt+RMB)";
            btn.style.cssText = `position:fixed;bottom:12px;left:130px;z-index:9999;width:100px;height:28px;border-radius:6px;border:1px solid ${NW_BUTTON_COLOR};background:rgb(40, 40, 40);color:${NW_BUTTON_COLOR};font:11px monospace;cursor:pointer;opacity:0.85;transition:opacity 0.15s,color 0.15s;`;
            const style = document.createElement("style");
            style.textContent = `.comfy-nodewrangler-toggle.nw-off{opacity:0.4!important;color:${NW_BUTTON_OFF_COLOR}!important;border:1px solid ${NW_BUTTON_OFF_COLOR}!important;}`;
            document.head.appendChild(style);
            btn.onclick = () => setEnabled(!enabled);
            setEnabled(enabled);
            document.body.appendChild(btn);

            const TYPE_PRIORITY = [
                "MODEL", "CLIP", "VAE", "CONDITIONING", "LATENT",
                "IMAGE", "MASK", "CONTROL_NET", "UPSCALE_MODEL",
                "CLIP_VISION", "CLIP_VISION_OUTPUT", "STYLE_MODEL",
                "GLIGEN", "SAMPLER", "SIGMAS", "NOISE", "GUIDER",
                "INT", "FLOAT", "STRING", "BOOLEAN",
            ];

            function normalizeType(t) {
                if (t == null) return "*";
                if (typeof t === "number") return "*";
                if (typeof t === "object" && Array.isArray(t)) return "COMBO";
                return String(t).toUpperCase();
            }

            // Check if two types are compatible, handling comma-separated MultiType
            function typesMatch(outType, inType) {
                const a = normalizeType(outType);
                const b = normalizeType(inType);
                if (a === "*" || b === "*") return true;
                if (a === b) return true;
                // Handle comma-separated multi-types (e.g. "IMAGE,MASK")
                const aTypes = a.split(",");
                const bTypes = b.split(",");
                for (const at of aTypes) {
                    for (const bt of bTypes) {
                        if (at === bt) return true;
                    }
                }
                return false;
            }

            // Returns only the SINGLE best connection (first unconnected match)
            function findBestConnection(srcNode, dstNode) {
                if (!srcNode || !dstNode) return null;
                const srcOutputs = srcNode.outputs;
                const dstInputs = dstNode.inputs;
                if (!srcOutputs || !dstInputs) return null;

                // Check if a specific output is already linked to the target node
                function outputAlreadyLinkedTo(oi, targetId) {
                    const links = srcOutputs[oi].links;
                    if (!links || !app.graph) return false;
                    for (const linkId of links) {
                        const link = app.graph.links[linkId];
                        if (link && link.target_id === targetId) return true;
                    }
                    return false;
                }

                function outputHasAnyLinks(oi) {
                    const links = srcOutputs[oi].links;
                    return links && links.length > 0;
                }

                // Output indices sorted: unlinked outputs first, then linked ones
                const outputOrder = [...Array(srcOutputs.length).keys()].sort((a, b) => {
                    const aLinked = outputHasAnyLinks(a) ? 1 : 0;
                    const bLinked = outputHasAnyLinks(b) ? 1 : 0;
                    return aLinked - bLinked || a - b;
                });

                const dstId = dstNode.id;

                // Pass 0: name + type match (prefer slots with matching names)
                for (const oi of outputOrder) {
                    if (outputAlreadyLinkedTo(oi, dstId)) continue;
                    const oName = (srcOutputs[oi].name || "").toLowerCase();

                    for (let ii = 0; ii < dstInputs.length; ii++) {
                        if (dstInputs[ii].link != null) continue;
                        const iName = (dstInputs[ii].name || "").toLowerCase();
                        if (oName && iName && oName === iName && typesMatch(srcOutputs[oi].type, dstInputs[ii].type)) {
                            return { outputSlot: oi, inputSlot: ii };
                        }
                    }
                }

                // Pass 1: type matches, ordered by type priority
                for (const priorityType of TYPE_PRIORITY) {
                    for (const oi of outputOrder) {
                        if (outputAlreadyLinkedTo(oi, dstId)) continue;
                        const oType = normalizeType(srcOutputs[oi].type);
                        if (!oType.split(",").includes(priorityType)) continue;

                        for (let ii = 0; ii < dstInputs.length; ii++) {
                            if (dstInputs[ii].link != null) continue;
                            if (!typesMatch(oType, dstInputs[ii].type)) continue;
                            return { outputSlot: oi, inputSlot: ii };
                        }
                    }
                }

                // Pass 2: remaining matches not in priority list
                for (const oi of outputOrder) {
                    if (outputAlreadyLinkedTo(oi, dstId)) continue;

                    for (let ii = 0; ii < dstInputs.length; ii++) {
                        if (dstInputs[ii].link != null) continue;
                        if (!typesMatch(srcOutputs[oi].type, dstInputs[ii].type)) continue;
                        return { outputSlot: oi, inputSlot: ii };
                    }
                }

                // Pass 3: wildcard matches (one side is *)
                for (const oi of outputOrder) {
                    if (outputAlreadyLinkedTo(oi, dstId)) continue;
                    const oType = normalizeType(srcOutputs[oi].type);

                    for (let ii = 0; ii < dstInputs.length; ii++) {
                        if (dstInputs[ii].link != null) continue;
                        const iType = normalizeType(dstInputs[ii].type);
                        if (oType === "*" || iType === "*") {
                            return { outputSlot: oi, inputSlot: ii };
                        }
                    }
                }

                return null;
            }

            // Reverse: target outputs -> source inputs
            function findBestConnectionReverse(srcNode, dstNode) {
                if (!srcNode || !dstNode) return null;
                const dstOutputs = dstNode.outputs;
                const srcInputs = srcNode.inputs;
                if (!dstOutputs || !srcInputs) return null;

                for (const priorityType of TYPE_PRIORITY) {
                    for (let oi = 0; oi < dstOutputs.length; oi++) {
                        const oType = normalizeType(dstOutputs[oi].type);
                        if (oType !== priorityType) continue;

                        for (let ii = 0; ii < srcInputs.length; ii++) {
                            if (srcInputs[ii].link != null) continue;
                            const iType = normalizeType(srcInputs[ii].type);
                            if (iType !== oType) continue;
                            return { outputSlot: oi, inputSlot: ii, reversed: true };
                        }
                    }
                }

                for (let oi = 0; oi < dstOutputs.length; oi++) {
                    const oType = normalizeType(dstOutputs[oi].type);

                    for (let ii = 0; ii < srcInputs.length; ii++) {
                        if (srcInputs[ii].link != null) continue;
                        const iType = normalizeType(srcInputs[ii].type);
                        if (iType !== oType) continue;
                        return { outputSlot: oi, inputSlot: ii, reversed: true };
                    }
                }

                for (let oi = 0; oi < dstOutputs.length; oi++) {
                    const oType = normalizeType(dstOutputs[oi].type);

                    for (let ii = 0; ii < srcInputs.length; ii++) {
                        if (srcInputs[ii].link != null) continue;
                        const iType = normalizeType(srcInputs[ii].type);
                        if (oType === "*" || iType === "*") {
                            return { outputSlot: oi, inputSlot: ii, reversed: true };
                        }
                    }
                }

                return null;
            }

            // Forward only: source (first node) outputs -> target (second node) inputs
            function findBest(srcNode, dstNode) {
                return findBestConnection(srcNode, dstNode);
            }

            // Returns ALL matching connections (for Ctrl+Alt connect-all)
            function findAllConnections(srcNode, dstNode) {
                if (!srcNode || !dstNode) return [];
                const srcOutputs = srcNode.outputs;
                const dstInputs = dstNode.inputs;
                if (!srcOutputs || !dstInputs) return [];

                function outputAlreadyLinkedTo(oi, targetId) {
                    const links = srcOutputs[oi].links;
                    if (!links || !app.graph) return false;
                    for (const linkId of links) {
                        const link = app.graph.links[linkId];
                        if (link && link.target_id === targetId) return true;
                    }
                    return false;
                }

                function outputHasAnyLinks(oi) {
                    const links = srcOutputs[oi].links;
                    return links && links.length > 0;
                }

                const outputOrder = [...Array(srcOutputs.length).keys()].sort((a, b) => {
                    const aLinked = outputHasAnyLinks(a) ? 1 : 0;
                    const bLinked = outputHasAnyLinks(b) ? 1 : 0;
                    return aLinked - bLinked || a - b;
                });

                const dstId = dstNode.id;
                const results = [];
                const usedInputs = new Set();
                const usedOutputs = new Set();

                function tryMatch(oi, ii) {
                    if (usedOutputs.has(oi)) return false;
                    if (outputAlreadyLinkedTo(oi, dstId)) return false;
                    if (usedInputs.has(ii)) return false;
                    if (dstInputs[ii].link != null) return false;
                    if (!typesMatch(srcOutputs[oi].type, dstInputs[ii].type)) return false;
                    return true;
                }

                // Pass 0: name + type match
                for (const oi of outputOrder) {
                    const oName = (srcOutputs[oi].name || "").toLowerCase();
                    for (let ii = 0; ii < dstInputs.length; ii++) {
                        if (!tryMatch(oi, ii)) continue;
                        const iName = (dstInputs[ii].name || "").toLowerCase();
                        if (oName && iName && oName === iName) {
                            results.push({ outputSlot: oi, inputSlot: ii });
                            usedOutputs.add(oi);
                            usedInputs.add(ii);
                            break;
                        }
                    }
                }

                // Pass 1: type priority
                for (const priorityType of TYPE_PRIORITY) {
                    for (const oi of outputOrder) {
                        if (outputAlreadyLinkedTo(oi, dstId)) continue;
                        const oType = normalizeType(srcOutputs[oi].type);
                        if (!oType.split(",").includes(priorityType)) continue;
                        for (let ii = 0; ii < dstInputs.length; ii++) {
                            if (!tryMatch(oi, ii)) continue;
                            results.push({ outputSlot: oi, inputSlot: ii });
                            usedOutputs.add(oi);
                            usedInputs.add(ii);
                            break;
                        }
                    }
                }

                // Pass 2: remaining type matches
                for (const oi of outputOrder) {
                    if (outputAlreadyLinkedTo(oi, dstId)) continue;
                    for (let ii = 0; ii < dstInputs.length; ii++) {
                        if (!tryMatch(oi, ii)) continue;
                        results.push({ outputSlot: oi, inputSlot: ii });
                        usedOutputs.add(oi);
                        usedInputs.add(ii);
                        break;
                    }
                }

                // Pass 3: wildcard
                for (const oi of outputOrder) {
                    if (outputAlreadyLinkedTo(oi, dstId)) continue;
                    const oType = normalizeType(srcOutputs[oi].type);
                    for (let ii = 0; ii < dstInputs.length; ii++) {
                        if (!tryMatch(oi, ii)) continue;
                        const iType = normalizeType(dstInputs[ii].type);
                        if (oType === "*" || iType === "*") {
                            results.push({ outputSlot: oi, inputSlot: ii });
                            usedOutputs.add(oi);
                            usedInputs.add(ii);
                            break;
                        }
                    }
                }

                return results;
            }

            function getNodeAt(graphX, graphY) {
                const graph = app.graph;
                if (!graph) return null;
                return graph.getNodeOnPos(graphX, graphY, graph._nodes_in_order) || null;
            }

            function eventToGraph(e) {
                if (canvas.convertEventToCanvasOffset) {
                    const pos = canvas.convertEventToCanvasOffset(e);
                    return [pos[0], pos[1]];
                }
                const rect = canvas.canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const ds = canvas.ds;
                return [
                    x / ds.scale - ds.offset[0],
                    y / ds.scale - ds.offset[1],
                ];
            }

            function getSlotColor(type) {
                const t = normalizeType(type);
                const lgTypes = typeof LiteGraph !== "undefined" ? LiteGraph : null;
                if (lgTypes && lgTypes.SLOT_TYPES_DEFAULT_COLOR && lgTypes.SLOT_TYPES_DEFAULT_COLOR[t]) {
                    return lgTypes.SLOT_TYPES_DEFAULT_COLOR[t];
                }
                const colorMap = {
                    "MODEL": "#B39DDB",
                    "CLIP": "#FFD54F",
                    "VAE": "#EF5350",
                    "CONDITIONING": "#FFA726",
                    "LATENT": "#FF80AB",
                    "IMAGE": "#64B5F6",
                    "MASK": "#FFFFFF",
                    "CONTROL_NET": "#00E676",
                    "INT": "#29B6F6",
                    "FLOAT": "#29B6F6",
                    "STRING": "#26A69A",
                    "BOOLEAN": "#66BB6A",
                    "*": "#A1A1A1",
                };
                return colorMap[t] || "#A1A1A1";
            }

            function drawNoodle(ctx, x1, y1, x2, y2, color, alpha) {
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = color;
                ctx.lineWidth = 2.5;
                ctx.shadowColor = color;
                ctx.shadowBlur = 8;

                const dx = Math.abs(x2 - x1) * 0.5;
                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.bezierCurveTo(x1 + dx, y1, x2 - dx, y2, x2, y2);
                ctx.stroke();

                ctx.shadowBlur = 0;
                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(x1, y1, NW_DOT, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(x2, y2, NW_DOT, 0, Math.PI * 2);
                ctx.fill();

                ctx.restore();
            }

            // --- Cut feature utilities ---

            // 2D line-segment intersection: returns true if segment (p1,p2) intersects (p3,p4)
            function segmentsIntersect(p1x, p1y, p2x, p2y, p3x, p3y, p4x, p4y) {
                const d1x = p2x - p1x, d1y = p2y - p1y;
                const d2x = p4x - p3x, d2y = p4y - p3y;
                const cross = d1x * d2y - d1y * d2x;
                if (Math.abs(cross) < 1e-10) return false;
                const t = ((p3x - p1x) * d2y - (p3y - p1y) * d2x) / cross;
                const u = ((p3x - p1x) * d1y - (p3y - p1y) * d1x) / cross;
                return t >= 0 && t <= 1 && u >= 0 && u <= 1;
            }

            // Sample a cubic bezier into N points (same curve shape ComfyUI uses)
            function sampleBezier(x1, y1, x2, y2, n) {
                const dx = Math.abs(x2 - x1) * 0.5;
                const cp1x = x1 + dx, cp1y = y1;
                const cp2x = x2 - dx, cp2y = y2;
                const pts = [];
                for (let i = 0; i <= n; i++) {
                    const t = i / n;
                    const it = 1 - t;
                    const x = it * it * it * x1 + 3 * it * it * t * cp1x + 3 * it * t * t * cp2x + t * t * t * x2;
                    const y = it * it * it * y1 + 3 * it * it * t * cp1y + 3 * it * t * t * cp2y + t * t * t * y2;
                    pts.push([x, y]);
                }
                return pts;
            }

            // Check if a cut path (array of [x,y]) intersects a bezier noodle between two points
            function cutIntersectsLink(cutPoints, x1, y1, x2, y2) {
                const bezierPts = sampleBezier(x1, y1, x2, y2, 24);
                for (let ci = 0; ci < cutPoints.length - 1; ci++) {
                    const [cx1, cy1] = cutPoints[ci];
                    const [cx2, cy2] = cutPoints[ci + 1];
                    for (let bi = 0; bi < bezierPts.length - 1; bi++) {
                        if (segmentsIntersect(
                            cx1, cy1, cx2, cy2,
                            bezierPts[bi][0], bezierPts[bi][1],
                            bezierPts[bi + 1][0], bezierPts[bi + 1][1]
                        )) return true;
                    }
                }
                return false;
            }

            // Find all links intersected by the cut path and disconnect them
            function performCut(cutPoints) {
                const graph = app.graph;
                if (!graph || !graph.links || cutPoints.length < 2) return;

                const toDisconnect = [];

                for (const linkId in graph.links) {
                    const link = graph.links[linkId];
                    if (!link) continue;

                    const originNode = graph.getNodeById(link.origin_id);
                    const targetNode = graph.getNodeById(link.target_id);
                    if (!originNode || !targetNode) continue;

                    const outPos = originNode.getConnectionPos(false, link.origin_slot);
                    const inPos = targetNode.getConnectionPos(true, link.target_slot);
                    if (!outPos || !inPos) continue;

                    if (cutIntersectsLink(cutPoints, outPos[0], outPos[1], inPos[0], inPos[1])) {
                        toDisconnect.push({ node: targetNode, slot: link.target_slot });
                    }
                }

                for (const d of toDisconnect) {
                    d.node.disconnectInput(d.slot);
                }

                if (toDisconnect.length > 0 && graph.change) {
                    graph.change();
                }
            }

            function drawCutOverlay(ctx) {
                if (!cutState.active || cutState.points.length < 2) return;

                ctx.save();
                ctx.strokeStyle = NW_CUT_COLOR;
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.9;
                ctx.shadowColor = NW_CUT_COLOR;
                ctx.shadowBlur = NW_GLOW;
                ctx.setLineDash([6, 4]);

                ctx.beginPath();
                ctx.moveTo(cutState.points[0][0], cutState.points[0][1]);
                for (let i = 1; i < cutState.points.length; i++) {
                    ctx.lineTo(cutState.points[i][0], cutState.points[i][1]);
                }
                ctx.stroke();
                ctx.restore();
            }

            function drawOverlay(ctx) {
                if (!state.active || !state.sourceNode) return;

                const src = state.sourceNode;
                const dst = state.targetNode;

                const srcCX = state.startX;
                const srcCY = state.startY;

                let conn = null;
                let conns = [];

                if (dst) {
                    if (state.connectAllMode) {
                        conns = findAllConnections(src, dst);
                    } else {
                        conn = findBest(src, dst);
                    }
                }

                const titleH = (typeof LiteGraph !== "undefined" && LiteGraph.NODE_TITLE_HEIGHT) || 20;
                const r = NW_RADIUS;

                const noMatch = dst && (state.connectAllMode ? conns.length === 0 : !conn);

                function drawNodeHighlight(ctx, node, color) {
                    ctx.save();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2;
                    ctx.globalAlpha = 0.7;
                    ctx.shadowColor = color;
                    ctx.shadowBlur = NW_GLOW;
                    ctx.beginPath();
                    ctx.roundRect(
                        node.pos[0] - 4,
                        node.pos[1] - titleH - 4,
                        node.size[0] + 8,
                        node.size[1] + titleH + 8,
                        r
                    );
                    ctx.stroke();
                    ctx.restore();
                }

                const highlightColor = noMatch ? NW_NO_MATCH_COLOR : NW_COLOR;
                drawNodeHighlight(ctx, src, highlightColor);
                if (dst) drawNodeHighlight(ctx, dst, highlightColor);

                if (noMatch) {
                    // No available sockets — just highlights, no noodle
                } else if (dst && (conns.length > 0 || conn)) {
                    if (state.connectAllMode && conns.length > 0) {
                        for (const c of conns) {
                            const outPos = src.getConnectionPos(false, c.outputSlot);
                            const inPos = dst.getConnectionPos(true, c.inputSlot);
                            drawNoodle(ctx, outPos[0], outPos[1], inPos[0], inPos[1], NW_COLOR, 0.8);
                        }
                    } else if (conn) {
                        const outPos = src.getConnectionPos(false, conn.outputSlot);
                        const inPos = dst.getConnectionPos(true, conn.inputSlot);
                        drawNoodle(ctx, outPos[0], outPos[1], inPos[0], inPos[1], NW_COLOR, 0.8);
                    }
                } else {
                    drawNoodle(ctx, srcCX, srcCY, state.mouseX, state.mouseY, NW_COLOR, 0.8);
                }
            }

            // Hook into the draw loop by monkey-patching drawFrontCanvas
            const origDrawFrontCanvas = canvas.drawFrontCanvas.bind(canvas);
            canvas.drawFrontCanvas = function () {
                origDrawFrontCanvas.apply(this, arguments);
                if (enabled && (state.active || cutState.active)) {
                    const ctx = this.ctx || (this.bgcanvas && this.bgcanvas.getContext("2d"));
                    if (ctx) {
                        ctx.save();
                        const ds = this.ds;
                        if (ds) {
                            ctx.setTransform(ds.scale, 0, 0, ds.scale, ds.offset[0] * ds.scale, ds.offset[1] * ds.scale);
                        }
                        if (state.active) drawOverlay(ctx);
                        if (cutState.active) drawCutOverlay(ctx);
                        ctx.restore();
                    }
                }
            };

            // Intercept right mouse button events at the canvas level
            const canvasEl = canvas.canvas;

            canvasEl.addEventListener("pointerdown", (e) => {
                if (!enabled || e.button !== 2) return;
                if (e.ctrlKey && e.altKey) {
                    const [gx, gy] = eventToGraph(e);
                    const node = getNodeAt(gx, gy);
                    if (!node) return;
                    state.active = true;
                    state.connectAllMode = true;
                    state.sourceNode = node;
                    state.startX = gx;
                    state.startY = gy;
                    state.mouseX = gx;
                    state.mouseY = gy;
                    state.targetNode = null;
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return;
                }
                if (!e.altKey) return;

                const [gx, gy] = eventToGraph(e);
                const node = getNodeAt(gx, gy);
                if (!node) return;

                state.active = true;
                state.connectAllMode = false;
                state.sourceNode = node;
                state.startX = gx;
                state.startY = gy;
                state.mouseX = gx;
                state.mouseY = gy;
                state.targetNode = null;

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);

            canvasEl.addEventListener("pointermove", (e) => {
                if (!state.active) return;

                const [gx, gy] = eventToGraph(e);
                state.mouseX = gx;
                state.mouseY = gy;

                const node = getNodeAt(gx, gy);
                state.targetNode = (node && node !== state.sourceNode) ? node : null;

                canvas.setDirty(true, true);
                e.preventDefault();
                e.stopPropagation();
            }, true);

            canvasEl.addEventListener("pointerup", (e) => {
                if (!state.active || e.button !== 2) return;

                const [gx, gy] = eventToGraph(e);
                const targetNode = getNodeAt(gx, gy);

                if (targetNode && targetNode !== state.sourceNode) {
                    const srcNode = state.sourceNode;
                    if (state.connectAllMode) {
                        const conns = findAllConnections(srcNode, targetNode);
                        for (const conn of conns) {
                            srcNode.connect(conn.outputSlot, targetNode, conn.inputSlot);
                        }
                        if (conns.length > 0 && app.graph) app.graph.change();
                    } else {
                        const conn = findBest(srcNode, targetNode);
                        if (conn) {
                            srcNode.connect(conn.outputSlot, targetNode, conn.inputSlot);
                            if (app.graph) app.graph.change();
                        }
                    }
                }

                if (canvas.deselectAllNodes) canvas.deselectAllNodes();

                state.active = false;
                state.connectAllMode = false;
                state.sourceNode = null;
                state.targetNode = null;
                suppressNextContext = true;
                canvas.setDirty(true, true);

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);

            // --- Ctrl+RMB cut handlers ---

            canvasEl.addEventListener("pointerdown", (e) => {
                if (!enabled || e.button !== 2 || !e.ctrlKey || e.altKey) return;

                const [gx, gy] = eventToGraph(e);
                cutState.active = true;
                cutState.points = [[gx, gy]];

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);

            canvasEl.addEventListener("pointermove", (e) => {
                if (!cutState.active) return;

                const [gx, gy] = eventToGraph(e);
                cutState.points.push([gx, gy]);

                canvas.setDirty(true, true);
                e.preventDefault();
                e.stopPropagation();
            }, true);

            canvasEl.addEventListener("pointerup", (e) => {
                if (!cutState.active || e.button !== 2) return;

                const [gx, gy] = eventToGraph(e);
                cutState.points.push([gx, gy]);

                performCut(cutState.points);

                cutState.active = false;
                cutState.points = [];
                suppressNextContext = true;
                canvas.setDirty(true, true);

                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }, true);

            // Suppress context menu when wrangler was used
            let suppressNextContext = false;
            canvasEl.addEventListener("contextmenu", (e) => {
                if (state.active || cutState.active || suppressNextContext) {
                    suppressNextContext = false;
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
            }, true);
        },
    });
}
