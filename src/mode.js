// Loaded before the stylesheet (a plain script, not a module, so it runs first): inside the web page, which
// loads this page with ?web, the game fills the window instead of the popup's 800x600 (see html.web in popup.css).
if (new URLSearchParams(location.search).has("web")) document.documentElement.classList.add("web");
