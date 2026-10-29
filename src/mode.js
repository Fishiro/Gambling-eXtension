// Loaded before the stylesheet (a plain script, not a module, so it runs first). Inside the web page, which loads
// this page with ?web, the game fills the window instead of the popup's 780x580 (see html.web in popup.css):
//   - up to WEB_MAX the game box grows with the window; past it, it stops and sits centred, so nothing on a big
//     screen stretches out of proportion;
//   - below WEB_MIN the layout no longer fits, so the box is laid out at the minimum size and zoomed down to fit
//     instead of scrolling (the effects layer and overlays outside #app stay at full size).
if (new URLSearchParams(location.search).has("web")) {
    const WEB_MIN_W = 960;
    const WEB_MIN_H = 620;
    const WEB_MAX_W = 1280;
    const WEB_MAX_H = 840;
    const root = document.documentElement;
    root.classList.add("web");
    const fit = () => {
        const zoom = Math.min(1, innerWidth / WEB_MIN_W, innerHeight / WEB_MIN_H);
        root.style.setProperty("--zoom", zoom.toFixed(4));
        if (!document.body) return;
        // The box's size in its own (zoomed) px: the body's content box, capped, divided by the zoom.
        const cs = getComputedStyle(document.body);
        const w = Math.min(WEB_MAX_W, document.body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight));
        const h = Math.min(WEB_MAX_H, document.body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
        root.style.setProperty("--app-w", `${w / zoom}px`);
        root.style.setProperty("--app-h", `${h / zoom}px`);
    };
    fit();
    addEventListener("DOMContentLoaded", fit);
    addEventListener("resize", fit);
}
