// Loaded before the stylesheet (a plain script, not a module, so it runs first). Inside the web page, which loads
// this page with ?web, the game fills the window instead of the popup's 780x580 (see html.web in popup.css).
// Below WEB_MIN_W x WEB_MIN_H the layout no longer fits, so the game area (#app) zooms down to fit instead of
// scrolling: it is laid out at the minimum size and drawn smaller. The effects layer and the overlays outside
// #app stay at full size.
if (new URLSearchParams(location.search).has("web")) {
    const WEB_MIN_W = 960;
    const WEB_MIN_H = 620;
    const root = document.documentElement;
    root.classList.add("web");
    const fit = () => {
        const zoom = Math.min(1, innerWidth / WEB_MIN_W, innerHeight / WEB_MIN_H);
        root.style.setProperty("--zoom", zoom.toFixed(4));
        if (!document.body) return;
        // The app's own size in its zoomed px: the body's content box divided by the zoom, so it fills it exactly.
        const cs = getComputedStyle(document.body);
        const w = document.body.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        const h = document.body.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
        root.style.setProperty("--app-w", `${w / zoom}px`);
        root.style.setProperty("--app-h", `${h / zoom}px`);
    };
    fit();
    addEventListener("DOMContentLoaded", fit);
    addEventListener("resize", fit);
}
