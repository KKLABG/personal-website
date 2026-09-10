(function () {
    var MODEL_DIR = "assets/models/awing/a-wing_cockpit_version_2/";
    var canvas = document.getElementById("space3d");
    var sky = document.getElementById("sky");
    var pitWait = document.getElementById("pitWait");

    function say(msg) {
        if (pitWait) pitWait.textContent = msg;
    }

    function fail(msg) {
        document.body.classList.remove("pit3d");
        if (sky) sky.style.opacity = "1";
        say(msg || "你的驾驶舱模型没载入");
    }

    if (!canvas) return fail("找不到三维画布");
    if (location.protocol === "file:") return fail("请打开 http://127.0.0.1:8777 ，不要双击文件");
    if (!window.THREE || !THREE.GLTFLoader) return fail("三维库没载入");

    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    var boot = (window.__phoneLand && window.__phoneLand.on)
        ? { w: window.__phoneLand.w, h: window.__phoneLand.h }
        : { w: window.innerWidth, h: window.innerHeight };
    renderer.setSize(boot.w, boot.h, false);
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    if ("outputEncoding" in renderer) renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.toneMappingExposure = 1;

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(0x02060d);

    var camera = new THREE.PerspectiveCamera(78, boot.w / boot.h, 0.03, 4000);
    camera.rotation.order = "YXZ";

    scene.add(new THREE.AmbientLight(0xffffff, 1));

    var starGeo = new THREE.BufferGeometry();
    var n = 2200;
    var pos = new Float32Array(n * 3);
    for (var i = 0; i < n; i++) {
        var r = 120 + Math.random() * 800;
        var th = Math.random() * Math.PI * 2;
        var ph = Math.acos(2 * Math.random() - 1);
        pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
        pos[i * 3 + 1] = r * Math.cos(ph);
        pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
    }
    starGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    var dust = new THREE.Group();
    dust.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xe8f2ff, size: 1.35, sizeAttenuation: true })));
    scene.add(dust);

    var streakN = 780;
    var streakBuf = new Float32Array(streakN * 6);
    function seedStreak(i) {
        var th = Math.random() * Math.PI * 2;
        var r = 1.4 + Math.random() * 26;
        var x = Math.cos(th) * r;
        var y = Math.sin(th) * r * 0.7;
        var z = -24 - Math.random() * 180;
        var len = 8 + Math.random() * 22;
        var o = i * 6;
        streakBuf[o] = x;
        streakBuf[o + 1] = y;
        streakBuf[o + 2] = z;
        streakBuf[o + 3] = x;
        streakBuf[o + 4] = y;
        streakBuf[o + 5] = z - len;
    }
    var si;
    for (si = 0; si < streakN; si++) seedStreak(si);
    var streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute("position", new THREE.BufferAttribute(streakBuf, 3));
    var streakMat = new THREE.LineBasicMaterial({
        color: 0xd4ecff,
        transparent: true,
        opacity: 0,
        depthWrite: false
    });
    var streakLines = new THREE.LineSegments(streakGeo, streakMat);
    scene.add(streakLines);

    var ship = new THREE.Group();
    scene.add(ship);

    var eye = new THREE.Vector3(0, 0.15, 0.4);
    var look = new THREE.Vector3(0, 0.08, -1);
    var baseYaw = 0;
    var basePitch = 0;
    var loaded = false;
    var pins = [];
    var proj = new THREE.Vector3();
    var cabin = { position: new THREE.Vector3() };
    var sun = { position: new THREE.Vector3() };
    var texLoader = new THREE.TextureLoader();
    texLoader.setPath(MODEL_DIR + "textures/");

    var TEX_BY_MAT = {
        cockpit01: "cockpit01_baseColor.jpeg",
        cockpit02: "cockpit02_baseColor.jpeg",
        console: "console_baseColor.jpeg",
        console02: "console02_baseColor.jpeg",
        detail_metal: "detail_metal_baseColor.jpeg",
        controlpanel: "controlpanel_baseColor.jpeg",
        detail_blackmetal: "detail_blackmetal_baseColor.png",
        detail_hull02: "detail_hull02_baseColor.jpeg",
        a_wing: "a_wing_baseColor.png",
        red_lights: "red_lights_baseColor.jpeg",
        detail_hull: "detail_hull_baseColor.jpeg",
        detail_red_plastic: "detail_red_plastic_baseColor.jpeg",
        screen: "screen_baseColor.jpeg",
        detail_white_plastic: "detail_white_plastic_baseColor.jpeg"
    };

    function prepTexture(tex) {
        if (!tex) return;
        tex.flipY = false;
        if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
        tex.needsUpdate = true;
    }

    function bindMaps(model) {
        model.traverse(function (node) {
            if (!node.isMesh) return;
            var mats = [].concat(node.material || []);
            mats.forEach(function (mat) {
                if (!mat) return;
                if (mat.map) prepTexture(mat.map);
                if (mat.normalMap) mat.normalMap.flipY = false;
                var key = (mat.name || "").toLowerCase();
                var file = TEX_BY_MAT[key];
                if (!mat.map && file) {
                    texLoader.load(file, function (tex) {
                        prepTexture(tex);
                        node.material = new THREE.MeshBasicMaterial({
                            map: tex,
                            side: THREE.DoubleSide
                        });
                    });
                    return;
                }
                if (mat.map) {
                    node.material = new THREE.MeshBasicMaterial({
                        map: mat.map,
                        side: THREE.DoubleSide,
                        transparent: !!mat.transparent,
                        opacity: mat.opacity
                    });
                }
            });
        });
    }

    function sitInside(model) {
        var handleBox = new THREE.Box3();
        var glassBox = new THREE.Box3();
        var dashBox = new THREE.Box3();
        var hasHandle = false;
        var hasGlass = false;
        var hasDash = false;
        model.traverse(function (node) {
            if (!node.isMesh) return;
            var name = (node.name || "").toLowerCase();
            if (/handle/.test(name)) {
                handleBox.expandByObject(node);
                hasHandle = true;
            }
            if (/screen|console|controlpanel|controlbox/.test(name)) {
                dashBox.expandByObject(node);
                hasDash = true;
            }
            if (/hull|cockpit_1|cockpit_002/.test(name) && !/handle/.test(name)) {
                glassBox.expandByObject(node);
                hasGlass = true;
            }
        });
        var handle = hasHandle ? handleBox.getCenter(new THREE.Vector3()) : new THREE.Vector3();
        var dash = hasDash ? dashBox.getCenter(new THREE.Vector3()) : handle.clone();
        var forward = dash.clone().sub(handle);
        if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
        forward.y *= 0.2;
        forward.normalize();
        var span = hasDash ? dashBox.getSize(new THREE.Vector3()).length() : 0.4;
        eye.copy(handle).addScaledVector(forward, -Math.max(0.2, span * 0.26));
        eye.y = handle.y + Math.max(0.11, span * 0.11);
        look.copy(dash).addScaledVector(forward, Math.max(0.6, span * 0.9));
        look.y = dash.y + span * 0.04;
        camera.position.copy(eye);
        camera.lookAt(look);
        camera.rotation.order = "YXZ";
        baseYaw = camera.rotation.y;
        basePitch = camera.rotation.x;
    }

    function onModel(gltf) {
        loaded = true;
        var model = gltf.scene;
        bindMaps(model);
        while (ship.children.length) ship.remove(ship.children[0]);
        ship.add(model);
        model.updateMatrixWorld(true);
        var raw = new THREE.Box3().setFromObject(model);
        var rawSize = raw.getSize(new THREE.Vector3());
        model.scale.setScalar(3.1 / Math.max(rawSize.x, rawSize.z, 0.01));
        model.updateMatrixWorld(true);
        model.position.sub(new THREE.Box3().setFromObject(model).getCenter(new THREE.Vector3()));
        model.updateMatrixWorld(true);
        try {
            sitInside(model);
        } catch (err) {
            camera.position.set(0, 0.22, 0.72);
            camera.lookAt(0, 0.06, -1);
            eye.copy(camera.position);
        }
        pinHud();
        document.body.classList.add("pit3d");
        if (sky) sky.style.opacity = "0";
        if (pitWait) pitWait.style.display = "none";
        window.__pit = {
            scene: scene,
            camera: camera,
            renderer: renderer,
            ship: ship,
            eye: eye,
            look: look,
            restoreSeat: function () {
                ship.position.set(0, 0, 0);
                ship.rotation.set(0, 0, 0);
                scene.background = new THREE.Color(0x02060d);
                streakMat.opacity = 0;
                dust.position.set(0, 0, 0);
                camera.far = 4000;
                camera.position.copy(eye);
                camera.rotation.set(basePitch, baseYaw, 0, "YXZ");
                camera.fov = 78;
                camera.updateProjectionMatrix();
            },
            driveGalaxy: function (boostAmt) {
                streakLines.position.copy(camera.position);
                streakLines.quaternion.copy(camera.quaternion);
                streakMat.opacity += ((0.42 + boostAmt * 0.5) - streakMat.opacity) * 0.16;
                var k, step = 3.4 + boostAmt * 4.2;
                for (k = 0; k < streakN; k++) {
                    streakBuf[k * 6 + 2] += step;
                    streakBuf[k * 6 + 5] += step;
                    if (streakBuf[k * 6 + 2] > -1.2) seedStreak(k);
                }
                streakGeo.attributes.position.needsUpdate = true;
                dust.position.z += 10 + boostAmt * 16;
                if (dust.position.z > 420) dust.position.z = 0;
            }
        };
    }

    function hudAxes() {
        var fwd = look.clone().sub(eye);
        if (fwd.lengthSq() < 1e-8) fwd.set(0, 0, -1);
        fwd.normalize();
        var right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
        if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
        right.normalize();
        var up = new THREE.Vector3().crossVectors(right, fwd).normalize();
        return { fwd: fwd, right: right, up: up };
    }

    function dropPins(kinds) {
        pins = pins.filter(function (p) {
            if (!kinds || kinds.indexOf(p.kind) >= 0) {
                ship.remove(p.obj);
                return false;
            }
            return true;
        });
    }

    function place(el, kind, ox, oy, oz) {
        if (!el) return;
        var ax = hudAxes();
        var o = new THREE.Object3D();
        o.position.copy(eye)
            .addScaledVector(ax.right, ox)
            .addScaledVector(ax.up, oy)
            .addScaledVector(ax.fwd, oz);
        ship.add(o);
        el.classList.add("pin3d");
        pins.push({ el: el, obj: o, kind: kind });
    }

    function isCoarse() {
        return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    }

    function viewSize() {
        var pl = window.__phoneLand;
        if (pl && pl.on) return { w: pl.w, h: pl.h };
        return { w: window.innerWidth, h: window.innerHeight };
    }

    function isPhone() {
        /* 窄桌面窗口：紧凑；真机也用紧凑钉点，但侧栏仍显示 */
        return isCoarse() || window.innerWidth < 760;
    }

    function pinHud() {
        dropPins();
        var phone = isPhone();
        var coarse = isCoarse();
        var btns = document.querySelectorAll(".dock button");
        btns.forEach(function (btn, i) {
            var t = btns.length > 1 ? i / (btns.length - 1) : 0.5;
            var a = (t - 0.5) * (phone ? 1.05 : 1.25);
            place(btn, "btn", Math.sin(a) * (phone ? 0.3 : 0.42), -0.2 + (1 - Math.cos(a)) * (phone ? 0.08 : 0.12), 0.4);
            pins[pins.length - 1].tilt = (t - 0.5) * (phone ? 16 : 28);
            pins[pins.length - 1].arc = a;
        });
        /* 窄桌面仍隐藏侧栏；真机钉出紧凑侧栏 */
        if (coarse || window.innerWidth >= 760) {
            var ox = coarse ? 0.42 : 0.5;
            var oy = coarse ? 0.01 : 0.05;
            var oz = coarse ? 0.24 : 0.3;
            place(document.querySelector(".col.left"), "panel", -ox, oy, oz);
            place(document.querySelector(".col.right"), "panel", ox, oy, oz);
        }
        var cards = document.querySelectorAll(".quad .card");
        var grid = phone
            ? [[-0.16, 0.14], [0.16, 0.14], [-0.16, 0.02], [0.16, 0.02]]
            : [[-0.2, 0.13], [0.2, 0.13], [-0.2, 0.01], [0.2, 0.01]];
        cards.forEach(function (card, i) {
            var g = grid[i] || [0, 0.07];
            place(card, "card", g[0], g[1], phone ? 0.52 : 0.6);
        });
        place(document.getElementById("sanctumCall"), "sanctum", 0, phone ? -0.12 : -0.08, 0.36);
        var title = document.querySelector(".mid h1");
        var tag = document.querySelector(".mid .tag");
        if (title) title.style.display = "none";
        if (tag) tag.style.display = "none";
    }

    function bindStars() {
        dropPins(["star"]);
        var stars = document.querySelectorAll("#orbit .star");
        var total = stars.length || 1;
        stars.forEach(function (el, i) {
            var t = total > 1 ? i / (total - 1) : 0.5;
            place(el, "star", (t - 0.5) * 3.4, 0.18, 6.2);
            pins[pins.length - 1].idx = i;
            pins[pins.length - 1].total = total;
        });
    }
    window.__pitBindStars = bindStars;

    function bindFocus() {
        dropPins(["focus"]);
        var bloom = document.getElementById("starBloom");
        if (!bloom) return;
        place(bloom, "focus", -1.35, 0.2, 5.2);
    }
    window.__pitBindFocus = bindFocus;

    function projectPins() {
        var vs = viewSize();
        var w = vs.w;
        var h = vs.h;
        var exploring = document.body.classList.contains("explore");
        var warping = document.body.classList.contains("warping");
        var inside = document.body.classList.contains("inside");
        pins.forEach(function (p) {
            p.obj.getWorldPosition(proj);
            proj.project(camera);
            var x = (proj.x * 0.5 + 0.5) * w;
            var y = (-proj.y * 0.5 + 0.5) * h;
            var inFront = proj.z > -1 && proj.z < 1 && Math.abs(proj.x) < 1.45 && Math.abs(proj.y) < 1.45;
            var on = false;
            if (p.kind === "star") {
                on = exploring && !warping && !inside;
                var n = p.total || 1;
                var idx = p.idx || 0;
                if (w < 760 && n > 3) {
                    var half = Math.ceil(n / 2);
                    var row = idx < half ? 0 : 1;
                    var col = row ? idx - half : idx;
                    var cols = row ? n - half : half;
                    var tt = cols > 1 ? col / (cols - 1) : 0.5;
                    x = w * (0.18 + tt * 0.64);
                    y = h * (0.2 + row * 0.16);
                } else {
                    var t = n > 1 ? idx / (n - 1) : 0.5;
                    x = w * (0.16 + t * 0.68);
                    y = h * (w < 760 ? 0.26 : 0.3);
                }
            } else if (p.kind === "focus") {
                on = exploring && !warping && inside;
                x = w * (w < 760 ? 0.22 : 0.24) - yaw * 46;
                y = h * (w < 760 ? 0.24 : 0.3) + pitch * 28;
                x = Math.min(w * 0.34, Math.max(w * 0.16, x));
                y = Math.min(h * 0.46, Math.max(h * 0.16, y));
            } else if (p.kind === "sanctum") {
                on = !document.body.classList.contains("sanctum") && !exploring;
                if (!inFront) {
                    x = w * 0.5;
                    y = h * (w < 760 ? 0.88 : 0.84);
                }
            } else if (p.kind === "card" || p.kind === "btn") {
                on = !exploring && inFront;
            } else on = !exploring && inFront;
            var depth = 1 - Math.min(1, Math.max(0, (proj.z + 1) * 0.5));
            var s = 1;
            var tilt = p.tilt || 0;
            if (p.kind === "panel") s = (isCoarse() ? 0.58 : 1.34) + depth * 0.06;
            else if (p.kind === "card") s = (w < 760 ? 0.78 : 0.92) + depth * 0.08;
            else if (p.kind === "sanctum") s = w < 760 ? 0.9 : 1.12;
            else if (p.kind === "star") s = w < 760 ? 0.82 : 1.12;
            else if (p.kind === "focus") s = 1.28;
            else s = 0.86 + depth * 0.06;
            p.el.style.left = x + "px";
            p.el.style.top = y + "px";
            p.el.style.opacity = on ? "1" : "0";
            p.el.style.pointerEvents = on && p.kind !== "focus" ? "auto" : "none";
            p.el.style.transform = "translate(-50%, -50%) rotate(" + tilt.toFixed(1) + "deg) scale(" + s.toFixed(3) + ")";
            p.el.style.zIndex = (p.kind === "star" || p.kind === "focus") ? "24" : (p.kind === "sanctum" ? "30" : "15");
        });
    }

    function onProgress(xhr) {
        if (!xhr || !xhr.total) {
            say("正在载入你的 A-Wing 驾驶舱…");
            return;
        }
        say("正在载入你的 A-Wing 驾驶舱 " + Math.round((xhr.loaded / xhr.total) * 100) + "%");
    }

    var loader = new THREE.GLTFLoader();
    loader.setPath(MODEL_DIR);
    loader.load(
        "scene.gltf",
        onModel,
        onProgress,
        function (err) {
            fail("你的 scene.gltf 没读到：" + ((err && err.message) || "检查 8777 是否打开"));
        }
    );

    var mx = 0, my = 0, yaw = 0, pitch = 0;
    var lookId = null, lookX = 0, lookY = 0;
    function applyViewSize() {
        var vs = viewSize();
        camera.aspect = vs.w / vs.h;
        camera.updateProjectionMatrix();
        renderer.setSize(vs.w, vs.h, false);
        canvas.style.width = "100%";
        canvas.style.height = "100%";
    }
    window.addEventListener("mousemove", function (e) {
        if (isCoarse()) return;
        mx = (e.clientX / window.innerWidth) * 2 - 1;
        my = (e.clientY / window.innerHeight) * 2 - 1;
    });
    window.addEventListener("pointerdown", function (e) {
        if (!isCoarse() || e.pointerType !== "touch") return;
        var t = e.target;
        if (t && t.closest && t.closest("button, a, input, textarea, .col, .card, .dock, .topbar")) return;
        lookId = e.pointerId;
        lookX = e.clientX;
        lookY = e.clientY;
        try {
            canvas.setPointerCapture(e.pointerId);
        } catch (err) { /* ignore */ }
    });
    window.addEventListener("pointermove", function (e) {
        if (!isCoarse() || e.pointerType !== "touch" || lookId !== e.pointerId) return;
        var pl = window.__phoneLand;
        var d = pl && pl.mapDelta ? pl.mapDelta(e.clientX - lookX, e.clientY - lookY) : { x: e.clientX - lookX, y: e.clientY - lookY };
        var vs = viewSize();
        mx = Math.max(-1, Math.min(1, mx + d.x / (vs.w * 0.32)));
        my = Math.max(-1, Math.min(1, my + d.y / (vs.h * 0.32)));
        lookX = e.clientX;
        lookY = e.clientY;
    });
    function endLook(e) {
        if (lookId === null || (e && e.pointerId !== lookId)) return;
        lookId = null;
    }
    window.addEventListener("pointerup", endLook);
    window.addEventListener("pointercancel", endLook);
    var lastPhone = isPhone();
    function onViewChange() {
        applyViewSize();
        var phoneNow = isPhone();
        if (loaded && (phoneNow !== lastPhone || isCoarse())) {
            lastPhone = phoneNow;
            pinHud();
            if (window.__pitBindStars) window.__pitBindStars();
        }
    }
    window.addEventListener("resize", onViewChange);
    window.addEventListener("phoneland", onViewChange);
    applyViewSize();

    function tick(t) {
        canvas.style.opacity = "1";
        if (window.__sanctum && window.__sanctum.active) {
            if (window.__sanctum.tick) window.__sanctum.tick(t);
            if (!window.__sanctum.hosted) renderer.render(scene, camera);
            requestAnimationFrame(tick);
            return;
        }
        var lookHold = document.body.classList.contains("intro");
        if (!lookHold) {
            yaw += (mx * 0.5 - yaw) * 0.07;
            pitch += ((-my) * 0.26 - pitch) * 0.07;
        }
        var warping = document.body.classList.contains("warping");
        var shake = warping ? (Math.sin(t * 0.08) * 0.006) : 0;
        camera.fov += ((warping ? 86 : 78) - camera.fov) * 0.1;
        camera.updateProjectionMatrix();
        camera.position.copy(eye).add(new THREE.Vector3(yaw * 0.03 + shake, pitch * 0.02, 0));
        camera.rotation.set(basePitch + pitch, baseYaw - yaw, -yaw * 0.04, "YXZ");
        camera.updateMatrixWorld();
        var fwdNow = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
        streakLines.position.copy(camera.position);
        streakLines.quaternion.copy(camera.quaternion);
        if (warping) {
            streakMat.opacity += (0.95 - streakMat.opacity) * 0.18;
            var k;
            for (k = 0; k < streakN; k++) {
                streakBuf[k * 6 + 2] += 5.6;
                streakBuf[k * 6 + 5] += 5.6;
                if (streakBuf[k * 6 + 2] > -1.2) seedStreak(k);
            }
            streakGeo.attributes.position.needsUpdate = true;
            dust.position.addScaledVector(fwdNow, -16);
            if (dust.position.length() > 420) dust.position.set(0, 0, 0);
        } else {
            streakMat.opacity += (0 - streakMat.opacity) * 0.16;
            dust.position.lerp(new THREE.Vector3(0, 0, 0), 0.08);
        }
        projectPins();
        renderer.render(scene, camera);
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
})();
