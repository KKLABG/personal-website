(function () {
    var frame = null;
    var pulling = false;
    var pull = 0;
    var last = 0;

    function ensureFrame() {
        if (frame) return frame;
        frame = document.createElement("iframe");
        frame.id = "sanctumFrame";
        frame.className = "sanctum-frame";
        frame.title = "圣地";
        frame.setAttribute("allow", "autoplay; fullscreen");
        document.body.appendChild(frame);
        return frame;
    }

    function showFrame() {
        document.body.classList.add("sanctum-hosted");
        window.__sanctum.hosted = true;
        ensureFrame().src = "shiyun/?enter=" + Date.now();
    }

    function start() {
        if (window.__sanctum.active) return;
        document.body.classList.add("sanctum");
        document.body.classList.remove("sanctum-hosted");
        window.__sanctum.active = true;
        window.__sanctum.hosted = false;
        pulling = true;
        pull = 0;
        last = 0;
    }

    function stop() {
        pulling = false;
        pull = 0;
        last = 0;
        window.__sanctum.active = false;
        window.__sanctum.hosted = false;
        document.body.classList.remove("sanctum", "sanctum-hosted");
        if (frame) {
            frame.removeAttribute("src");
            frame.src = "about:blank";
        }
        if (window.__pit && window.__pit.restoreSeat) window.__pit.restoreSeat();
    }

    function tick(t) {
        if (!pulling) return;
        var p = window.__pit;
        if (!p || !p.camera || !p.eye) return;
        if (!last) last = t;
        var dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        pull = Math.min(1, pull + dt * 0.2);
        var a = pull * pull * (3 - 2 * pull);
        var eye = p.eye;
        var cam = p.camera;
        cam.position.set(
            eye.x * (1 - a),
            eye.y * (1 - a) + 1.6 * a,
            eye.z * (1 - a) + (-8.4) * a
        );
        cam.lookAt(0.04, 0.1, 1.35);
        cam.updateMatrixWorld();
        if (pull >= 1) {
            pulling = false;
            showFrame();
        }
    }

    window.__sanctum = { active: false, hosted: false, start: start, stop: stop, tick: tick };
})();
