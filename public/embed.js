/*
 * Tavern Calendar beágyazó szkript.
 * Használat (bárhová, ahová HTML kód illeszthető):
 *   <script src="https://<naptar-domain>/embed.js" data-store="debrecen"></script>
 * data-store: debrecen | miskolc | jatekceh (elhagyható – ekkor a látogató választ helyszínt)
 */
(function () {
  var script = document.currentScript;
  if (!script) return;
  var origin = new URL(script.src).origin;
  var store = script.getAttribute('data-store');

  var iframe = document.createElement('iframe');
  iframe.src = origin + '/embed' + (store ? '?store=' + encodeURIComponent(store) : '');
  iframe.title = 'Eseménynaptár';
  iframe.style.cssText = 'display:block;width:100%;height:700px;border:0;background:#121212;border-radius:12px;';
  script.parentNode.insertBefore(iframe, script.nextSibling);

  // Megmondjuk az iframe-nek, melyik része látszik épp, hogy a felugró ablakok ott nyíljanak meg
  var pending = false;
  function sendViewport() {
    pending = false;
    if (!iframe.contentWindow) return;
    var rect = iframe.getBoundingClientRect();
    iframe.contentWindow.postMessage({ type: 'tavern-calendar:viewport', top: -rect.top, height: window.innerHeight }, origin);
  }
  function scheduleViewport() {
    if (pending) return;
    pending = true;
    window.requestAnimationFrame(sendViewport);
  }

  window.addEventListener('message', function (e) {
    if (e.source !== iframe.contentWindow || e.origin !== origin || !e.data) return;
    if (e.data.type === 'tavern-calendar:height') {
      iframe.style.height = e.data.height + 'px';
      scheduleViewport();
    }
  });
  window.addEventListener('scroll', scheduleViewport, { passive: true });
  window.addEventListener('resize', scheduleViewport);
  iframe.addEventListener('load', scheduleViewport);
})();
