figma.showUI(__html__, { width: 640, height: 400 });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RGBAColor { r: number; g: number; b: number; a: number }

interface EffectProps {
  type: 'DROP_SHADOW' | 'INNER_SHADOW';
  color: RGBAColor;
  offset: { x: number; y: number };
  radius: number;
  spread: number;
  visible: boolean;
  blendMode: BlendMode;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAMED_COLORS: Record<string, [number, number, number, number]> = {
  transparent: [0,   0,   0,   0],
  black:       [0,   0,   0,   1],
  white:       [255, 255, 255, 1],
  red:         [255, 0,   0,   1],
  green:       [0,   128, 0,   1],
  blue:        [0,   0,   255, 1],
  yellow:      [255, 255, 0,   1],
  cyan:        [0,   255, 255, 1],
  magenta:     [255, 0,   255, 1],
  gray:        [128, 128, 128, 1],
  grey:        [128, 128, 128, 1],
  orange:      [255, 165, 0,   1],
  purple:      [128, 0,   128, 1],
  pink:        [255, 192, 203, 1],
  brown:       [165, 42,  42,  1],
  gold:        [255, 215, 0,   1],
  silver:      [192, 192, 192, 1],
  navy:        [0,   0,   128, 1],
  teal:        [0,   128, 128, 1],
  olive:       [128, 128, 0,   1],
  coral:       [255, 127, 80,  1],
  salmon:      [250, 128, 114, 1],
  tomato:      [255, 99,  71,  1],
  crimson:     [220, 20,  60,  1],
  indigo:      [75,  0,   130, 1],
  violet:      [238, 130, 238, 1],
  lime:        [0,   255, 0,   1],
  aqua:        [0,   255, 255, 1],
  maroon:      [128, 0,   0,   1],
  darkgray:    [169, 169, 169, 1],
  darkgrey:    [169, 169, 169, 1],
  lightgray:   [211, 211, 211, 1],
  lightgrey:   [211, 211, 211, 1],
};

const NAMED_COLOR_RE = new RegExp(
  '\\b(' + Object.keys(NAMED_COLORS).join('|') + ')\\b', 'i'
);

const COLOR_FUNC_RE = /\b(color-mix|rgba?|hsla?)\s*\(/i;

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

/** Extract a balanced function call (including nested parens) starting at startIndex. */
function extractBalancedFunction(str: string, startIndex: number): string | null {
  const parenStart = str.indexOf('(', startIndex);
  if (parenStart === -1) return null;
  let depth = 0;
  for (let i = parenStart; i < str.length; i++) {
    if (str[i] === '(') depth++;
    else if (str[i] === ')') {
      depth--;
      if (depth === 0) return str.substring(startIndex, i + 1);
    }
  }
  return null;
}

/** Split a string on commas that are not inside parentheses. */
function splitTopLevelComma(str: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (const ch of str) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/** Parse a CSS channel value — handles both raw numbers and percentages. */
function parseColorChannel(value: string, maxNumeric: number): number {
  if (value.endsWith('%')) return (parseFloat(value) / 100) * maxNumeric;
  return parseFloat(value);
}

// ---------------------------------------------------------------------------
// HSL → RGB
// ---------------------------------------------------------------------------

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hue2rgb(p, q, h + 1 / 3),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1 / 3),
  ];
}

// ---------------------------------------------------------------------------
// Color parsers
// ---------------------------------------------------------------------------

function parseHexColor(hex: string): RGBAColor {
  let h = hex.substring(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  else if (h.length === 4) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const a = h.length === 8 ? parseInt(h.substring(6, 8), 16) / 255 : 1;
  return { r, g, b, a };
}

function parseRgbFunction(str: string): RGBAColor {
  // Modern space-separated: rgb(R G B / A)
  const modern = str.match(
    /rgba?\(\s*([\d.]+%?)\s+([\d.]+%?)\s+([\d.]+%?)\s*(?:\/\s*([\d.]+%?))?\s*\)/i
  );
  if (modern) {
    return {
      r: parseColorChannel(modern[1], 255) / 255,
      g: parseColorChannel(modern[2], 255) / 255,
      b: parseColorChannel(modern[3], 255) / 255,
      a: modern[4] ? parseColorChannel(modern[4], 1) : 1,
    };
  }
  // Legacy comma-separated: rgba(R, G, B, A)
  const legacy = str.match(
    /rgba?\(\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*,\s*([\d.]+%?)\s*(?:,\s*([\d.]+%?))?\s*\)/i
  );
  if (legacy) {
    return {
      r: parseColorChannel(legacy[1], 255) / 255,
      g: parseColorChannel(legacy[2], 255) / 255,
      b: parseColorChannel(legacy[3], 255) / 255,
      a: legacy[4] ? parseColorChannel(legacy[4], 1) : 1,
    };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

function parseHslFunction(str: string): RGBAColor {
  const modern = str.match(
    /hsla?\(\s*([\d.]+)\s+([\d.]+)%\s+([\d.]+)%\s*(?:\/\s*([\d.]+%?))?\s*\)/i
  );
  if (modern) {
    const [r, g, b] = hslToRgb(
      parseFloat(modern[1]) / 360,
      parseFloat(modern[2]) / 100,
      parseFloat(modern[3]) / 100
    );
    return { r, g, b, a: modern[4] ? parseColorChannel(modern[4], 1) : 1 };
  }
  const legacy = str.match(
    /hsla?\(\s*([\d.]+)\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%\s*(?:,\s*([\d.]+%?))?\s*\)/i
  );
  if (legacy) {
    const [r, g, b] = hslToRgb(
      parseFloat(legacy[1]) / 360,
      parseFloat(legacy[2]) / 100,
      parseFloat(legacy[3]) / 100
    );
    return { r, g, b, a: legacy[4] ? parseColorChannel(legacy[4], 1) : 1 };
  }
  return { r: 0, g: 0, b: 0, a: 1 };
}

/**
 * Resolve color-mix(in srgb, <color> <pct>?, <color> <pct>?) → RGBA.
 * Uses premultiplied-alpha interpolation per CSS Color 4 spec.
 */
function resolveColorMix(str: string): RGBAColor {
  const inner = str.replace(/^color-mix\(\s*/i, '').replace(/\)\s*$/, '');
  const spaceMatch = inner.match(/^in\s+(\S+)\s*,\s*/i);
  if (!spaceMatch) return { r: 0, g: 0, b: 0, a: 1 };

  const args = splitTopLevelComma(inner.substring(spaceMatch[0].length));
  if (args.length !== 2) return { r: 0, g: 0, b: 0, a: 1 };

  const a1 = parseColorMixArg(args[0].trim());
  const a2 = parseColorMixArg(args[1].trim());

  let p1 = a1.percentage;
  let p2 = a2.percentage;
  if (p1 === null && p2 === null) { p1 = 50; p2 = 50; }
  else if (p1 === null) { p1 = 100 - p2!; }
  else if (p2 === null) { p2 = 100 - p1; }

  const sum = p1 + p2!;
  if (sum <= 0) return { r: 0, g: 0, b: 0, a: 0 };
  const w1 = p1 / sum;
  const w2 = p2! / sum;
  const c1 = a1.color;
  const c2 = a2.color;

  const alpha = w1 * c1.a + w2 * c2.a;
  if (alpha === 0) return { r: 0, g: 0, b: 0, a: 0 };

  const mix = (ch1: number, ch2: number) =>
    (w1 * ch1 * c1.a + w2 * ch2 * c2.a) / alpha;

  return {
    r: Math.max(0, Math.min(1, mix(c1.r, c2.r))),
    g: Math.max(0, Math.min(1, mix(c1.g, c2.g))),
    b: Math.max(0, Math.min(1, mix(c1.b, c2.b))),
    a: Math.max(0, Math.min(1, alpha)),
  };
}

function parseColorMixArg(arg: string): { color: RGBAColor; percentage: number | null } {
  arg = arg.trim();
  const pctMatch = arg.match(/([\d.]+)%\s*$/);
  let percentage: number | null = null;
  let colorPart = arg;
  if (pctMatch) {
    percentage = parseFloat(pctMatch[1]);
    colorPart = arg.substring(0, pctMatch.index).trim();
  }
  return { color: parseColorToRGBA(colorPart), percentage };
}

/** Parse any CSS color string to normalized RGBA (each channel 0–1). */
function parseColorToRGBA(color: string): RGBAColor {
  color = color.trim();
  if (color.match(/^color-mix\s*\(/i)) return resolveColorMix(color);
  if (color.match(/^rgba?\s*\(/i)) return parseRgbFunction(color);
  if (color.match(/^hsla?\s*\(/i)) return parseHslFunction(color);
  if (color.startsWith('#')) return parseHexColor(color);

  const lower = color.toLowerCase();
  if (NAMED_COLORS[lower]) {
    const [rv, gv, bv, av] = NAMED_COLORS[lower];
    return { r: rv / 255, g: gv / 255, b: bv / 255, a: av };
  }

  console.log(`Unrecognized color: "${color}", defaulting to black`);
  return { r: 0, g: 0, b: 0, a: 1 };
}

// ---------------------------------------------------------------------------
// Shadow parser
// ---------------------------------------------------------------------------

/**
 * Parse a CSS box-shadow value into Figma effect properties.
 *
 * Follows the CSS box-shadow formal grammar where color, inset, and lengths
 * can appear in any order (the && combinator). Color productions —
 * including function calls like color-mix(), rgb(), hsl() — are isolated
 * via balanced-paren extraction so their inner tokens never leak into the
 * length parsing.
 */
function parseCssBoxShadow(css: string): EffectProps[] {
  css = css.replace(/box-shadow:\s*/i, '').trim();
  if (css.charAt(css.length - 1) === ';') css = css.slice(0, -1).trim();

  const shadows = splitTopLevelComma(css)
    .map(s => s.trim())
    .filter(s => s.length > 0);
  if (shadows.length === 0) return [];

  const effects: EffectProps[] = [];

  for (const shadow of shadows) {
    let remaining = shadow;

    // 1. Extract color function (color-mix, rgb/rgba, hsl/hsla) via balanced parens
    let colorStr = '';
    const funcMatch = remaining.match(COLOR_FUNC_RE);
    if (funcMatch && funcMatch.index !== undefined) {
      const token = extractBalancedFunction(remaining, funcMatch.index);
      if (token) {
        colorStr = token;
        remaining = (
          remaining.substring(0, funcMatch.index) +
          remaining.substring(funcMatch.index + token.length)
        ).trim();
      }
    }

    // 2. Standalone hex (only when no function color was found)
    if (!colorStr) {
      const hexMatch = remaining.match(/#[0-9a-f]{3,8}\b/i);
      if (hexMatch && hexMatch.index !== undefined) {
        colorStr = hexMatch[0];
        remaining = (
          remaining.substring(0, hexMatch.index) +
          remaining.substring(hexMatch.index + hexMatch[0].length)
        ).trim();
      }
    }

    // 3. Named color (only when no other color was found)
    if (!colorStr) {
      const namedMatch = remaining.match(NAMED_COLOR_RE);
      if (namedMatch && namedMatch.index !== undefined) {
        colorStr = namedMatch[0];
        remaining = (
          remaining.substring(0, namedMatch.index) +
          remaining.substring(namedMatch.index + namedMatch[0].length)
        ).trim();
      }
    }

    // 4. Extract inset keyword (can appear anywhere per spec)
    let isInset = false;
    remaining = remaining.replace(/\binset\b/gi, () => { isInset = true; return ''; }).trim();

    // 5. Parse remaining tokens as 2–4 CSS lengths.
    //    If no color was found yet, any alphabetic non-numeric token is a color name.
    const tokens = remaining.split(/\s+/).filter(t => t.length > 0);
    if (!colorStr) {
      const colorIdx = tokens.findIndex(t => /^[a-z]/i.test(t) && isNaN(parseFloat(t)));
      if (colorIdx !== -1) {
        colorStr = tokens.splice(colorIdx, 1)[0];
      }
    }
    const lengths = tokens.map(t => parseFloat(t));

    if (lengths.length < 2 || lengths.some(isNaN)) {
      console.error(
        `Failed to parse shadow lengths from "${remaining}" (original: "${shadow}")`
      );
      continue;
    }

    effects.push({
      type: isInset ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color: parseColorToRGBA(colorStr || '#000000'),
      offset: { x: lengths[0], y: lengths[1] },
      radius: lengths.length >= 3 ? lengths[2] : 0,
      spread: lengths.length >= 4 ? lengths[3] : 0,
      visible: true,
      blendMode: 'NORMAL',
    });
  }

  return effects;
}

// ---------------------------------------------------------------------------
// Figma effect helper
// ---------------------------------------------------------------------------

function toFigmaShadowEffect(effect: EffectProps): DropShadowEffect | InnerShadowEffect {
  const shared = {
    color: effect.color,
    offset: effect.offset,
    radius: effect.radius,
    spread: effect.spread,
    visible: true as const,
    blendMode: 'NORMAL' as const,
  };
  return effect.type === 'INNER_SHADOW'
    ? { type: 'INNER_SHADOW' as const, ...shared }
    : { type: 'DROP_SHADOW' as const, ...shared };
}

// ---------------------------------------------------------------------------
// Message handler
// ---------------------------------------------------------------------------

figma.ui.onmessage = async (msg) => {
  if (msg.type === 'preview-shadow') {
    try {
      const effects = parseCssBoxShadow(msg.css);
      if (effects.length === 0) {
        figma.ui.postMessage({ 
          type: 'error', 
          message: 'Could not parse the CSS shadow format' 
        });
      } else {
        figma.ui.postMessage({ 
          type: 'preview-success'
        });
      }
    } catch (error) {
      let errorMessage = 'An unknown error occurred';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Error parsing shadow: ' + errorMessage 
      });
    }
  }
  
// Handle the get-collections message
if (msg.type === 'get-collections') {
  figma.variables.getLocalVariableCollectionsAsync()
    .then(collections => {
      figma.ui.postMessage({
        type: 'collections',
        collections: collections.map(collection => ({
          id: collection.id,
          name: collection.name
        }))
      });
    })
    .catch(error => {
      console.error('Error getting collections:', error);
      figma.ui.postMessage({
        type: 'collections',
        collections: []
      });
    });
}

// Create style and variables
else if (msg.type === 'create-style') {
  try {
    const parsedEffects = parseCssBoxShadow(msg.css);
    
    if (parsedEffects.length === 0) {
      figma.ui.postMessage({ 
        type: 'error', 
        message: 'Could not parse the CSS shadow format' 
      });
      return;
    }
    
    const style = figma.createEffectStyle();
    style.name = msg.name;
    style.effects = parsedEffects.map(toFigmaShadowEffect);
    
    figma.ui.postMessage({ type: 'success' });
    figma.notify(`Created style "${msg.name}"`);
    
// If variables are requested, handle separately
if (msg.createVariables) {
  const createVariables = async () => {
    try {
      let collection: VariableCollection;
      
      if (!msg.collectionId || msg.collectionId === 'create-new') {
        const collectionName = msg.newCollectionName || "Effect Variables";
        collection = figma.variables.createVariableCollection(collectionName);
      } else {
        try {
          const existingCollection = await figma.variables.getVariableCollectionByIdAsync(msg.collectionId);
          if (existingCollection) {
            collection = existingCollection;
          } else {
            const collectionName = msg.newCollectionName || "Effect Variables";
            collection = figma.variables.createVariableCollection(collectionName);
          }
        } catch (collectionError) {
          let errorMessage = 'An unknown error occurred';
          if (collectionError && typeof collectionError === 'object' && 'message' in collectionError) {
            errorMessage = String(collectionError.message);
          } else if (typeof collectionError === 'string') {
            errorMessage = collectionError;
          }
          console.error('Error getting collection:', errorMessage);
          const collectionName = msg.newCollectionName || "Effect Variables";
          collection = figma.variables.createVariableCollection(collectionName);
        }
      }
      
      for (let i = 0; i < style.effects.length; i++) {
        const effect = style.effects[i];
        const suffix = i > 0 ? `-${i+1}` : '';
        
        if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
          const xVar = figma.variables.createVariable(
            `effect-${msg.name}${suffix}-x`, 
            collection,
            'FLOAT'
          );
          xVar.setValueForMode(collection.defaultModeId, effect.offset.x);
          
          const yVar = figma.variables.createVariable(
            `effect-${msg.name}${suffix}-y`, 
            collection,
            'FLOAT'
          );
          yVar.setValueForMode(collection.defaultModeId, effect.offset.y);
          
          const blurVar = figma.variables.createVariable(
            `effect-${msg.name}${suffix}-blur`, 
            collection,
            'FLOAT'
          );
          blurVar.setValueForMode(collection.defaultModeId, effect.radius);
          
          const spreadVar = figma.variables.createVariable(
            `effect-${msg.name}${suffix}-spread`, 
            collection,
            'FLOAT'
          );
          spreadVar.setValueForMode(collection.defaultModeId, effect.spread ?? 0);
          
          const colorVar = figma.variables.createVariable(
            `effect-${msg.name}${suffix}-color`, 
            collection,
            'COLOR'
          );
          colorVar.setValueForMode(collection.defaultModeId, {
            r: effect.color.r,
            g: effect.color.g,
            b: effect.color.b,
            a: effect.color.a
          });
        }
      }
      
      figma.notify(`Created variables in "${collection.name}" collection. Due to API limitations, variables cannot be automatically bound to the style.`, {  });
    } catch (error) {
      let errorMessage = 'An unknown error occurred';
      if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = String(error.message);
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      console.error('Error creating variables:', error);
      figma.notify(`Failed to create variables: ${errorMessage}`);
    }
  };
  
  createVariables();
}
    
  } catch (error) {
    let errorMessage = 'An unknown error occurred';
    if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String(error.message);
    } else if (typeof error === 'string') {
      errorMessage = error;
    }
    console.error('Error creating style:', error);
    figma.ui.postMessage({ 
      type: 'error', 
      message: 'Error creating style: ' + errorMessage 
    });
  }
}
};
