// Solmar Bay — keyboard and mouse input. Tracks held keys, mouse position in canvas
// pixels, and edge-triggered presses (justPressed) consumed once per frame.
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
  canvas.addEventListener('mousemove', pos);
  canvas.addEventListener('mousedown', (e) => { pos(e); input.mouse.down = true; input.mouseClicked = true; });
  window.addEventListener('mouseup', () => { input.mouse.down = false; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  return input;
}
export function pressed(input, ...names) { return names.some((n) => input.keys.has(n)); }
export function justPressed(input, ...names) { return names.some((n) => input.justPressed.has(n)); }
export function endFrame(input) { input.justPressed.clear(); input.mouseClicked = false; }
