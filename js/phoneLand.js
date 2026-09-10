(function () {
    function coarse() {
        try {
            return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
        } catch (e) {
            return false;
        }
    }

    function sync() {
        var on = coarse();
        var portrait = window.innerHeight > window.innerWidth;
        var rot = on && portrait;
        var root = document.documentElement;
        root.classList.toggle("phone-land", on);
        root.classList.toggle("auto-rot", rot);
        /* 逻辑横屏尺寸：竖着拿手机时用 CSS 旋成横屏，宽=物理高，高=物理宽 */
        var w = rot ? window.innerHeight : window.innerWidth;
        var h = rot ? window.innerWidth : window.innerHeight;
        window.__phoneLand = {
            on: on,
            rot: rot,
            w: w,
            h: h,
            mapPoint: function (cx, cy) {
                if (!rot) return { x: cx, y: cy };
                return { x: cy, y: window.innerWidth - cx };
            },
            mapDelta: function (dx, dy) {
                if (!rot) return { x: dx, y: dy };
                /* CSS rotate(90deg) 的逆：屏幕右→逻辑下，屏幕下→逻辑右 */
                return { x: dy, y: -dx };
            },
            mapStick: function (sdx, sdy, rx, ry) {
                if (!rot) return { x: sdx / rx, y: -sdy / ry };
                return { x: sdy / ry, y: sdx / rx };
            }
        };
        root.style.setProperty("--land-w", w + "px");
        root.style.setProperty("--land-h", h + "px");
        try {
            window.dispatchEvent(new Event("phoneland"));
        } catch (e) { /* ignore */ }
    }

    var lockedOnce = false;
    function tryLock() {
        if (!coarse()) return;
        var o = screen.orientation || screen.mozOrientation || screen.msOrientation;
        if (o && typeof o.lock === "function") {
            o.lock("landscape").catch(function () {});
        }
        if (lockedOnce) return;
        lockedOnce = true;
        var el = document.documentElement;
        if (el.requestFullscreen) el.requestFullscreen().catch(function () {});
        else if (el.webkitRequestFullscreen) {
            try { el.webkitRequestFullscreen(); } catch (e) { /* ignore */ }
        }
    }

    sync();
    window.addEventListener("resize", sync);
    window.addEventListener("orientationchange", function () {
        setTimeout(sync, 60);
        setTimeout(sync, 320);
    });
    window.addEventListener("pointerdown", tryLock, { passive: true, once: false });
})();
