const bgContainer = document.getElementById("bg-container");
const networkCanvas = document.getElementById("bg-network");
const perspectiveFactor = 0.35;

const networkConfig = {
    minNodes: 14,
    maxNodes: 30,
    areaPerNode: 78000,
    minSpeed: 8,
    maxSpeed: 21,
    velocityJitter: 10,
    linkDistance: 600,
    maxLinksPerNode: 3,
    connectRate: 0.1,
    disconnectRate: 0.02,
    minLinkTtl: 2.2,
    maxLinkTtl: 5.8,
    minLinkAlpha: 0.22,
    maxLinkAlpha: 0.5,
    linkFadeSpeed: 2.4,
    wrapPadding: 130,
    maxPairChecks: 420,
    initialOutsideRatio: 0.38,
    initialConnectionRatio: 0.24,
    lightSpotCount: 3
};

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

if (bgContainer && networkCanvas) {
    initNetworkBackground();
}

function initNetworkBackground() {
    const ctx = networkCanvas.getContext("2d", { alpha: true });
    if (!ctx) {
        return;
    }

    const state = {
        width: 0,
        height: 0,
        worldHeight: 0,
        dpr: 1,
        nodes: [],
        links: new Map(),
        lightSpots: [],
        scrollOffsetY: 0,
        lastTime: 0,
        resizeDebounceId: 0
    };

    function getTargetNodeCount() {
        const area = Math.max(state.width * Math.max(state.worldHeight * 0.45, state.height), 1);
        return clamp(
            Math.round(area / networkConfig.areaPerNode),
            networkConfig.minNodes,
            networkConfig.maxNodes * 2
        );
    }

    function getWorldHeight() {
        const docHeight = Math.max(
            document.documentElement.scrollHeight,
            document.body ? document.body.scrollHeight : 0,
            state.height
        );
        return Math.max(state.height * 2.1, docHeight * perspectiveFactor + state.height + networkConfig.wrapPadding * 2);
    }

    function makeNode(index) {
        const angle = Math.random() * Math.PI * 2;
        const speed = networkConfig.minSpeed + Math.random() * (networkConfig.maxSpeed - networkConfig.minSpeed);
        const spanX = state.width + networkConfig.wrapPadding * 2;
        const spanY = state.worldHeight + networkConfig.wrapPadding * 2;
        const startsOutside = Math.random() < networkConfig.initialOutsideRatio;
        let x = Math.random() * spanX - networkConfig.wrapPadding;
        let y = Math.random() * spanY - networkConfig.wrapPadding;

        if (!startsOutside) {
            x = Math.random() * state.width;
            y = Math.random() * state.height;
        }

        return {
            id: index,
            x,
            y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            radius: 1.4 + Math.random() * 1.8,
            glow: 0.12 + Math.random() * 0.36,
            degree: 0,
            jitterClock: 0.4 + Math.random() * 1.3
        };
    }

    function makeLightSpot(index) {
        const hueSeed = index % 2 === 0;
        return {
            x: (0.2 + index * 0.3) * state.width,
            y: Math.random() * state.worldHeight,
            radius: Math.min(state.width, state.height) * (0.32 + Math.random() * 0.24),
            alpha: 0.08 + Math.random() * 0.08,
            color: hueSeed ? "111, 200, 255" : "96, 141, 255",
            vy: (Math.random() - 0.5) * 4
        };
    }

    function resetLightSpots() {
        state.lightSpots = [];
        for (let i = 0; i < networkConfig.lightSpotCount; i += 1) {
            state.lightSpots.push(makeLightSpot(i));
        }
    }

    function seedInitialLinks() {
        const candidates = buildCandidatePairs();
        const maxSeeds = Math.floor(state.nodes.length * networkConfig.initialConnectionRatio);
        let seeded = 0;

        for (const candidate of candidates) {
            if (seeded >= maxSeeds) {
                break;
            }

            if (candidate.a.degree >= networkConfig.maxLinksPerNode || candidate.b.degree >= networkConfig.maxLinksPerNode) {
                continue;
            }

            const key = pairKey(candidate.a.id, candidate.b.id);
            if (state.links.has(key)) {
                continue;
            }

            createLink(candidate.a, candidate.b, candidate.distanceSq);
            const link = state.links.get(key);
            if (link) {
                link.alpha = link.targetAlpha;
                link.ttl = Math.max(link.ttl, networkConfig.maxLinkTtl * 0.8);
            }
            candidate.a.degree += 1;
            candidate.b.degree += 1;
            seeded += 1;
        }

        for (const node of state.nodes) {
            node.degree = 0;
        }
    }

    function resetNodes() {
        const count = getTargetNodeCount();
        state.nodes = [];
        state.links.clear();
        for (let i = 0; i < count; i += 1) {
            state.nodes.push(makeNode(i));
        }
        seedInitialLinks();
    }

    function resizeCanvas() {
        state.width = Math.max(window.innerWidth, 1);
        state.height = Math.max(window.innerHeight, 1);
        state.worldHeight = getWorldHeight();
        state.dpr = clamp(window.devicePixelRatio || 1, 1, 2);

        networkCanvas.width = Math.floor(state.width * state.dpr);
        networkCanvas.height = Math.floor(state.height * state.dpr);
        networkCanvas.style.width = `${state.width}px`;
        networkCanvas.style.height = `${state.height}px`;

        if (state.nodes.length === 0) {
            resetNodes();
            resetLightSpots();
            return;
        }

        const targetCount = getTargetNodeCount();
        if (targetCount !== state.nodes.length) {
            resetNodes();
            resetLightSpots();
            return;
        }

        for (const node of state.nodes) {
            node.x = clamp(node.x, -networkConfig.wrapPadding, state.width + networkConfig.wrapPadding);
            node.y = clamp(node.y, -networkConfig.wrapPadding, state.worldHeight + networkConfig.wrapPadding);
        }

        for (const spot of state.lightSpots) {
            spot.y = clamp(spot.y, -networkConfig.wrapPadding, state.worldHeight + networkConfig.wrapPadding);
        }
    }

    function wrapNode(node) {
        const p = networkConfig.wrapPadding;

        if (node.x < -p) {
            node.x = state.width + p;
        } else if (node.x > state.width + p) {
            node.x = -p;
        }

        if (node.y < -p) {
            node.y = state.worldHeight + p;
        } else if (node.y > state.worldHeight + p) {
            node.y = -p;
        }
    }

    function wrapSpot(spot) {
        const p = networkConfig.wrapPadding;
        if (spot.y < -p) {
            spot.y = state.worldHeight + p;
        } else if (spot.y > state.worldHeight + p) {
            spot.y = -p;
        }
    }

    function projectPoint(x, y) {
        const p = networkConfig.wrapPadding;
        const spanX = state.width + p * 2;
        const spanY = state.height + p * 2;
        const projectedX = ((x + p) % spanX + spanX) % spanX - p;
        const shiftedY = y - state.scrollOffsetY;
        const projectedY = ((shiftedY + p) % spanY + spanY) % spanY - p;

        return { x: projectedX, y: projectedY };
    }

    function updateNodes(dt) {
        for (const node of state.nodes) {
            node.jitterClock -= dt;
            if (node.jitterClock <= 0) {
                node.jitterClock = 0.5 + Math.random() * 1.3;
                const theta = Math.random() * Math.PI * 2;
                node.vx += Math.cos(theta) * networkConfig.velocityJitter;
                node.vy += Math.sin(theta) * networkConfig.velocityJitter;
            }

            const speed = Math.hypot(node.vx, node.vy) || 1;
            const clampedSpeed = clamp(speed, networkConfig.minSpeed, networkConfig.maxSpeed);
            node.vx = (node.vx / speed) * clampedSpeed;
            node.vy = (node.vy / speed) * clampedSpeed;

            node.x += node.vx * dt;
            node.y += node.vy * dt;
            wrapNode(node);
            node.degree = 0;
        }

        for (const spot of state.lightSpots) {
            spot.y += spot.vy * dt;
            wrapSpot(spot);
        }
    }

    function pairKey(aId, bId) {
        return aId < bId ? `${aId}|${bId}` : `${bId}|${aId}`;
    }

    function createLink(nodeA, nodeB, distanceSq) {
        const key = pairKey(nodeA.id, nodeB.id);
        const baseAlpha = networkConfig.minLinkAlpha + Math.random() * (networkConfig.maxLinkAlpha - networkConfig.minLinkAlpha);
        state.links.set(key, {
            a: nodeA.id,
            b: nodeB.id,
            alpha: 0,
            targetAlpha: baseAlpha,
            ttl: networkConfig.minLinkTtl + Math.random() * (networkConfig.maxLinkTtl - networkConfig.minLinkTtl),
            distanceSq
        });
    }

    function buildCandidatePairs() {
        const candidates = [];
        const nodes = state.nodes;
        const n = nodes.length;
        const linkDistanceSq = networkConfig.linkDistance * networkConfig.linkDistance;
        let checks = 0;

        for (let i = 0; i < n - 1 && checks < networkConfig.maxPairChecks; i += 1) {
            const nodeA = nodes[i];
            for (let j = i + 1; j < n && checks < networkConfig.maxPairChecks; j += 1) {
                checks += 1;
                const nodeB = nodes[j];
                const dx = nodeA.x - nodeB.x;
                const dy = nodeA.y - nodeB.y;
                const distanceSq = dx * dx + dy * dy;

                if (distanceSq <= linkDistanceSq) {
                    candidates.push({
                        a: nodeA,
                        b: nodeB,
                        distanceSq
                    });
                }
            }
        }

        candidates.sort((left, right) => left.distanceSq - right.distanceSq);
        return candidates;
    }

    function updateLinks(dt) {
        const candidates = buildCandidatePairs();
        const nearPairKeys = new Set();

        for (const link of state.links.values()) {
            const nodeA = state.nodes[link.a];
            const nodeB = state.nodes[link.b];
            if (!nodeA || !nodeB) {
                continue;
            }
            const dx = nodeA.x - nodeB.x;
            const dy = nodeA.y - nodeB.y;
            link.distanceSq = dx * dx + dy * dy;
            if (link.distanceSq <= networkConfig.linkDistance * networkConfig.linkDistance) {
                nearPairKeys.add(pairKey(link.a, link.b));
            }
        }

        for (const candidate of candidates) {
            const key = pairKey(candidate.a.id, candidate.b.id);
            nearPairKeys.add(key);
            const existing = state.links.get(key);

            if (existing) {
                existing.distanceSq = candidate.distanceSq;
                continue;
            }

            if (candidate.a.degree >= networkConfig.maxLinksPerNode || candidate.b.degree >= networkConfig.maxLinksPerNode) {
                continue;
            }

            if (Math.random() < networkConfig.connectRate * dt) {
                createLink(candidate.a, candidate.b, candidate.distanceSq);
            }
        }

        for (const [key, link] of state.links.entries()) {
            const nodeA = state.nodes[link.a];
            const nodeB = state.nodes[link.b];

            if (!nodeA || !nodeB) {
                state.links.delete(key);
                continue;
            }

            const isNear = nearPairKeys.has(key);
            link.ttl -= dt;

            if (!isNear || link.ttl <= 0 || Math.random() < networkConfig.disconnectRate * dt) {
                link.targetAlpha = 0;
            }

            if (link.targetAlpha > 0) {
                nodeA.degree += 1;
                nodeB.degree += 1;
            }

            const alphaDelta = networkConfig.linkFadeSpeed * dt;
            if (link.alpha < link.targetAlpha) {
                link.alpha = Math.min(link.targetAlpha, link.alpha + alphaDelta);
            } else if (link.alpha > link.targetAlpha) {
                link.alpha = Math.max(link.targetAlpha, link.alpha - alphaDelta);
            }

            if (link.targetAlpha === 0 && link.alpha <= 0.01) {
                state.links.delete(key);
            }
        }
    }

    function render() {
        ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);
        ctx.clearRect(0, 0, state.width, state.height);

        for (const spot of state.lightSpots) {
            const projected = projectPoint(spot.x, spot.y);
            const gradient = ctx.createRadialGradient(
                projected.x,
                projected.y,
                0,
                projected.x,
                projected.y,
                spot.radius
            );
            gradient.addColorStop(0, `rgba(${spot.color}, ${spot.alpha.toFixed(3)})`);
            gradient.addColorStop(1, `rgba(${spot.color}, 0)`);
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(projected.x, projected.y, spot.radius, 0, Math.PI * 2);
            ctx.fill();
        }

        for (const link of state.links.values()) {
            if (link.alpha <= 0.01) {
                continue;
            }

            const nodeA = state.nodes[link.a];
            const nodeB = state.nodes[link.b];
            if (!nodeA || !nodeB) {
                continue;
            }

            const projectedA = projectPoint(nodeA.x, nodeA.y);
            const projectedB = projectPoint(nodeB.x, nodeB.y);
            const spanX = state.width + networkConfig.wrapPadding * 2;
            const spanY = state.height + networkConfig.wrapPadding * 2;
            let lineEndX = projectedB.x;
            let lineEndY = projectedB.y;
            const dxScreen = projectedB.x - projectedA.x;
            const dyScreen = projectedB.y - projectedA.y;

            if (Math.abs(dxScreen) > spanX / 2) {
                lineEndX += dxScreen > 0 ? -spanX : spanX;
            }
            if (Math.abs(dyScreen) > spanY / 2) {
                lineEndY += dyScreen > 0 ? -spanY : spanY;
            }

            const weight = 1 - clamp(Math.sqrt(link.distanceSq) / networkConfig.linkDistance, 0, 1);
            const alpha = link.alpha * (0.6 + weight * 0.4);
            ctx.strokeStyle = `rgba(124, 201, 255, ${alpha.toFixed(3)})`;
            ctx.lineWidth = 0.8 + weight * 0.8;
            ctx.beginPath();
            ctx.moveTo(projectedA.x, projectedA.y);
            ctx.lineTo(lineEndX, lineEndY);
            ctx.stroke();
        }

        for (const node of state.nodes) {
            const projected = projectPoint(node.x, node.y);
            const glowAlpha = (0.14 + node.glow * 0.6).toFixed(3);
            const coreAlpha = (0.4 + node.glow * 0.45).toFixed(3);

            ctx.fillStyle = `rgba(97, 214, 255, ${glowAlpha})`;
            ctx.beginPath();
            ctx.arc(projected.x, projected.y, node.radius * 2.9, 0, Math.PI * 2);
            ctx.fill();

            ctx.fillStyle = `rgba(182, 238, 255, ${coreAlpha})`;
            ctx.beginPath();
            ctx.arc(projected.x, projected.y, node.radius, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    function animate(timestamp) {
        if (!state.lastTime) {
            state.lastTime = timestamp;
        }

        const dt = Math.min((timestamp - state.lastTime) / 1000, 0.05);
        state.lastTime = timestamp;

        if (!document.hidden) {
            updateNodes(dt);
            updateLinks(dt);
            render();
        }

        requestAnimationFrame(animate);
    }

    resizeCanvas();
    state.scrollOffsetY = window.scrollY * perspectiveFactor;
    requestAnimationFrame(animate);

    window.addEventListener("resize", () => {
        window.clearTimeout(state.resizeDebounceId);
        state.resizeDebounceId = window.setTimeout(resizeCanvas, 120);
    });

    document.addEventListener("visibilitychange", () => {
        state.lastTime = 0;
    });

    window.addEventListener("scroll", () => {
        state.scrollOffsetY = window.scrollY * perspectiveFactor;
    }, { passive: true });
}

document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", function (e) {
        e.preventDefault();

        document.querySelector(this.getAttribute("href")).scrollIntoView({
            behavior: "smooth"
        });
    });
});
