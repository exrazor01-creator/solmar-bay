// Solmar Bay — keyboard and mouse input. Tracks held keys, mouse position in canvas
// pixels, and edge-triggered presses (justPressed) consumed once per frame.
// Listeners live on the window: the HUD overlay canvas sits above the WebGL canvas,
// so the game canvas itself would never see the mouse.
export function createInput(canvas) {
  const input = { keys: new Set(), justPressed: new Set(), mouse: { x: 0, y: 0, down: false }, mouseClicked: false };
  const key = (e) => e.key.length === 1 ? e.key.toLowerCase() : e.key;
  window.addEventListener('keydown', (e) => {
    const k = key(e);
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (!input.keys.has(k)) input.justPressed.add(k);
    input.keys.add(k);
  });
  window.addEventListener('keyup', (e) => input.keys.delete(key(e)));
  window.addEventListener('blur', () => { input.keys.clear(); input.mouse.down = false; });
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    input.mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    input.mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  };
  window.addEventListener('mousemove', pos);
  window.addEventListener('mousedown', (e) => { pos(e); input.mouse.down = true; input.mouseClicked = true; });
  window.addEventListener('mouseup', () => { input.mouse.down = false; });
  window.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}
export function pressed(input, ...names) { return names.some((n) => input.keys.has(n)); }
export function justPressed(input, ...names) { return names.some((n) => input.justPressed.has(n)); }
// Consume an edge-triggered press: true once, then it is gone — even if the fixed-step
// loop runs the simulation twice in one frame. This is what the game uses for E, Q,
// F, B, the shop keys, T and R; handleKeys uses it for the menu keys.
export function take(input, ...names) {
  const hit = names.some((n) => input.justPressed.has(n));
  for (const n of names) input.justPressed.delete(n);
  return hit;
}
export function endFrame(input) { input.justPressed.clear(); input.mouseClicked = false; }
