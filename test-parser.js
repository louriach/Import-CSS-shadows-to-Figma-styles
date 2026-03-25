/**
 * Lightweight test runner for the shadow parser.
 * Uses vm.runInContext to load code.js with stubbed Figma globals,
 * then exercises parseCssBoxShadow and parseColorToRGBA.
 *
 * Run: node test-parser.js
 */
const vm = require('vm');
const fs = require('fs');

const code = fs.readFileSync('./code.js', 'utf-8');

const context = vm.createContext({
  figma: {
    showUI() {},
    ui: { onmessage: null, postMessage() {} },
    createEffectStyle() { return { name: '', effects: [] }; },
    variables: { getLocalVariableCollectionsAsync() { return Promise.resolve([]); } },
    notify() {},
  },
  __html__: '',
  console,
});

vm.runInContext(code, context);

const parseCssBoxShadow = context.parseCssBoxShadow;
const parseColorToRGBA = context.parseColorToRGBA;

let passed = 0;
let failed = 0;

function approx(a, b, eps = 0.002) {
  return Math.abs(a - b) < eps;
}

function assert(condition, message) {
  if (!condition) {
    console.error(`  FAIL: ${message}`);
    failed++;
  } else {
    console.log(`  PASS: ${message}`);
    passed++;
  }
}

// ---------------------------------------------------------------------------
// Test: color-mix multi-shadow (the original failing input)
// ---------------------------------------------------------------------------
console.log('\n--- color-mix multi-shadow ---');
{
  const css = 'color-mix(in srgb, #0f0d16 .4%,#0000) 0px .5px .5px,' +
    'color-mix(in srgb, #0f0d16 .8%,#0000) 0px 1px 1px,' +
    'color-mix(in srgb, #0f0d16 1.6%,#0000) 0px 2px 2px,' +
    'color-mix(in srgb, #0f0d16 3%,#0000) 0px 4px 4px,' +
    'color-mix(in srgb, #0f0d16 6%,#0000) 0px 8px 8px,' +
    'color-mix(in srgb, #0f0d16 12%,#0000) 0px 16px 16px,' +
    'color-mix(in srgb, #0f0d16 20%,#0000) 0px 32px 32px';

  const effects = parseCssBoxShadow(css);
  assert(effects.length === 7, `parsed 7 shadows (got ${effects.length})`);

  // First shadow: offsets 0, 0.5, blur 0.5
  const e0 = effects[0];
  assert(e0.offset.x === 0, `shadow 1 x = 0 (got ${e0.offset.x})`);
  assert(e0.offset.y === 0.5, `shadow 1 y = 0.5 (got ${e0.offset.y})`);
  assert(e0.radius === 0.5, `shadow 1 blur = 0.5 (got ${e0.radius})`);
  assert(e0.type === 'DROP_SHADOW', 'shadow 1 is DROP_SHADOW');

  // Last shadow: offsets 0, 32, blur 32
  const e6 = effects[6];
  assert(e6.offset.x === 0, `shadow 7 x = 0 (got ${e6.offset.x})`);
  assert(e6.offset.y === 32, `shadow 7 y = 32 (got ${e6.offset.y})`);
  assert(e6.radius === 32, `shadow 7 blur = 32 (got ${e6.radius})`);

  // Color: resolved color-mix alpha should be ~0.004 for the first shadow
  assert(approx(e0.color.a, 0.004), `shadow 1 alpha ≈ 0.004 (got ${e0.color.a})`);
  // 20% of #0f0d16 mixed with 80% transparent → alpha ≈ 0.20
  assert(approx(e6.color.a, 0.20), `shadow 7 alpha ≈ 0.20 (got ${e6.color.a})`);
}

// ---------------------------------------------------------------------------
// Test: classic rgba, color-last ordering
// ---------------------------------------------------------------------------
console.log('\n--- classic rgba, color-last ---');
{
  const effects = parseCssBoxShadow('0 4px 8px rgba(0,0,0,0.25)');
  assert(effects.length === 1, 'parsed 1 shadow');
  const e = effects[0];
  assert(e.offset.x === 0, 'x = 0');
  assert(e.offset.y === 4, 'y = 4');
  assert(e.radius === 8, 'blur = 8');
  assert(e.spread === 0, 'spread = 0');
  assert(approx(e.color.a, 0.25), `alpha = 0.25 (got ${e.color.a})`);
}

// ---------------------------------------------------------------------------
// Test: color-first ordering
// ---------------------------------------------------------------------------
console.log('\n--- color-first ordering ---');
{
  const effects = parseCssBoxShadow('red 60px -16px');
  assert(effects.length === 1, 'parsed 1 shadow');
  const e = effects[0];
  assert(e.offset.x === 60, 'x = 60');
  assert(e.offset.y === -16, 'y = -16');
  assert(approx(e.color.r, 1) && approx(e.color.g, 0) && approx(e.color.b, 0),
    'color is red');
}

// ---------------------------------------------------------------------------
// Test: hex color (no color-mix)
// ---------------------------------------------------------------------------
console.log('\n--- hex color ---');
{
  const effects = parseCssBoxShadow('10px 5px 5px #333');
  assert(effects.length === 1, 'parsed 1 shadow');
  assert(effects[0].offset.x === 10, 'x = 10');
  assert(approx(effects[0].color.r, 0.2, 0.01), 'r ≈ 0.2');
}

// ---------------------------------------------------------------------------
// Test: inset shadow
// ---------------------------------------------------------------------------
console.log('\n--- inset shadow ---');
{
  const effects = parseCssBoxShadow('inset 5em 1em gold');
  assert(effects.length === 1, 'parsed 1 shadow');
  assert(effects[0].type === 'INNER_SHADOW', 'type = INNER_SHADOW');
  assert(effects[0].offset.x === 5, 'x = 5 (em parsed as float)');
}

// ---------------------------------------------------------------------------
// Test: inset at end
// ---------------------------------------------------------------------------
console.log('\n--- inset at end ---');
{
  const effects = parseCssBoxShadow('3px 3px red inset');
  assert(effects.length === 1, 'parsed 1 shadow');
  assert(effects[0].type === 'INNER_SHADOW', 'type = INNER_SHADOW');
  assert(effects[0].offset.x === 3, 'x = 3');
}

// ---------------------------------------------------------------------------
// Test: modern rgb syntax  rgb(0 0 0 / 0.2)
// ---------------------------------------------------------------------------
console.log('\n--- modern rgb syntax ---');
{
  const effects = parseCssBoxShadow('12px 12px 2px 1px rgb(0 0 255 / 0.2)');
  assert(effects.length === 1, 'parsed 1 shadow');
  assert(effects[0].spread === 1, 'spread = 1');
  assert(approx(effects[0].color.b, 1), 'blue = 1');
  assert(approx(effects[0].color.a, 0.2), 'alpha = 0.2');
}

// ---------------------------------------------------------------------------
// Test: 4-char hex (#RGBA)
// ---------------------------------------------------------------------------
console.log('\n--- 4-char hex ---');
{
  const color = parseColorToRGBA('#0000');
  assert(approx(color.r, 0) && approx(color.g, 0) && approx(color.b, 0),
    'rgb = 0,0,0');
  assert(approx(color.a, 0), 'alpha = 0 (transparent)');
}

// ---------------------------------------------------------------------------
// Test: multiple mixed shadows
// ---------------------------------------------------------------------------
console.log('\n--- multiple mixed shadows ---');
{
  const effects = parseCssBoxShadow(
    'inset 0 -3em 3em rgb(0 200 0 / 0.3), 0 0 0 2px white, 0.3em 0.3em 1em rgb(200 0 0 / 0.6)'
  );
  assert(effects.length === 3, `parsed 3 shadows (got ${effects.length})`);
  assert(effects[0].type === 'INNER_SHADOW', 'first is inset');
  assert(effects[1].type === 'DROP_SHADOW', 'second is drop');
  assert(effects[1].spread === 2, 'second spread = 2');
}

// ---------------------------------------------------------------------------
// Test: no color defaults to black
// ---------------------------------------------------------------------------
console.log('\n--- no color ---');
{
  const effects = parseCssBoxShadow('5px 5px');
  assert(effects.length === 1, 'parsed 1 shadow');
  assert(approx(effects[0].color.r, 0), 'defaults to black r=0');
  assert(approx(effects[0].color.a, 1), 'defaults to opaque');
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log(`\n${'='.repeat(40)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
