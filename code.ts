figma.showUI(__html__, { width: 640, height: 400 });

// Define the EffectProps interface
interface EffectProps {
  type: 'DROP_SHADOW' | 'INNER_SHADOW';
  color: { r: number; g: number; b: number; a: number };
  offset: { x: number; y: number };
  radius: number;
  spread: number;
  visible: boolean;
  blendMode: BlendMode;
}

// Parse CSS box-shadow into Figma effect properties
function parseCssBoxShadow(css: string): EffectProps[] {
  // Remove any 'box-shadow:' prefix if present
  css = css.replace(/box-shadow:\s*/i, '').trim();
  
  // Remove trailing semicolon if present
  if (css.charAt(css.length - 1) === ';') {
    css = css.slice(0, -1).trim();
  }
  
  // Split multiple shadows by commas, but be careful with rgba commas
  const shadows: string[] = [];
  let currentShadow = '';
  let inParentheses = 0;
  
  for (let i = 0; i < css.length; i++) {
    const char = css[i];
    
    if (char === '(') inParentheses++;
    else if (char === ')') inParentheses--;
    
    if (char === ',' && inParentheses === 0) {
      shadows.push(currentShadow.trim());
      currentShadow = '';
    } else {
      currentShadow += char;
    }
  }
  
  if (currentShadow.trim()) {
    shadows.push(currentShadow.trim());
  }
  
  if (shadows.length === 0) {
    return [];
  }
  
  // Parse each shadow
  const effectProps: EffectProps[] = [];
  
  for (const shadow of shadows) {
    // We need a more sophisticated approach to extract the color
    // First, find any rgba or rgb patterns
    const rgbaPattern = /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*(?:,\s*[\d.]+\s*)?\)/i;
    const rgbaMatch = shadow.match(rgbaPattern);
    
    let color = '';
    let remainingParts = shadow;
    
    if (rgbaMatch) {
      color = rgbaMatch[0];
      // Remove the color from the remaining parts
      remainingParts = shadow.replace(color, '').trim();
    } else {
      // Check for hex colors or named colors
      const hexPattern = /#[0-9a-f]{3,8}\b/i;
      const hexMatch = shadow.match(hexPattern);
      
      if (hexMatch) {
        color = hexMatch[0];
        remainingParts = shadow.replace(color, '').trim();
      } else {
        // Check for named colors
        const namedColorPattern = /\b(black|white|red|green|blue|yellow|cyan|magenta|gray|transparent)\b/i;
        const namedMatch = shadow.match(namedColorPattern);
        
        if (namedMatch) {
          color = namedMatch[0];
          remainingParts = shadow.replace(color, '').trim();
        } else {
          color = '#000000'; // Default to black
        }
      }
    }
    
    // Split the remaining parts by spaces
    const parts = remainingParts.split(/\s+/).filter(part => part.length > 0);
    
    let isInset = false;
    let offsetX = 0;
    let offsetY = 0;
    let blurRadius = 0;
    let spreadRadius = 0;
    
    // Check for inset keyword
    const insetIndex = parts.indexOf('inset');
    if (insetIndex !== -1) {
      isInset = true;
      parts.splice(insetIndex, 1);
    }
    
    // Remaining parts should be numeric values with units
    if (parts.length >= 1) offsetX = parseFloat(parts[0]);
    if (parts.length >= 2) offsetY = parseFloat(parts[1]);
    if (parts.length >= 3) blurRadius = parseFloat(parts[2]);
    if (parts.length >= 4) spreadRadius = parseFloat(parts[3]);
    
    // Parse color to normalized RGBA values (0-1 range)
    const rgbaColor = parseColorToRGBA(color);
    
    console.log(`Parsed shadow: 
      Color: rgba(${Math.round(rgbaColor.r * 255)}, ${Math.round(rgbaColor.g * 255)}, ${Math.round(rgbaColor.b * 255)}, ${rgbaColor.a})
      Offset: (${offsetX}, ${offsetY})
      Blur: ${blurRadius}
      Spread: ${spreadRadius}
      Inset: ${isInset}
    `);
    
    // Create Figma effect properties
    effectProps.push({
      type: isInset ? 'INNER_SHADOW' : 'DROP_SHADOW',
      color: rgbaColor,
      offset: { x: offsetX, y: offsetY },
      radius: blurRadius,
      spread: spreadRadius,
      visible: true,
      blendMode: 'NORMAL'
    });
  }
  
  return effectProps;
}

// Helper function to parse any CSS color to RGBA
function parseColorToRGBA(color: string): { r: number, g: number, b: number, a: number } {
  // Default values
  let r = 0, g = 0, b = 0, a = 1;
  
  // Normalize the color string by removing extra spaces
  color = color.trim();
  
  try {
    // Handle rgba format
    if (color.indexOf('rgba') === 0) {
      // Extract the rgba values using a more robust regex
      const rgbaMatch = color.match(/rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/i);
      if (rgbaMatch) {
        r = parseInt(rgbaMatch[1], 10) / 255;
        g = parseInt(rgbaMatch[2], 10) / 255;
        b = parseInt(rgbaMatch[3], 10) / 255;
        a = parseFloat(rgbaMatch[4]);
        
        // Ensure alpha is within valid range
        a = Math.max(0, Math.min(1, a));
        
        console.log(`Parsed RGBA: r=${r}, g=${g}, b=${b}, a=${a} from ${color}`);
        return { r, g, b, a };
      }
    }
    
    // Handle rgb format
    if (color.indexOf('rgb') === 0) {
      const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
      if (rgbMatch) {
        r = parseInt(rgbMatch[1], 10) / 255;
        g = parseInt(rgbMatch[2], 10) / 255;
        b = parseInt(rgbMatch[3], 10) / 255;
        
        console.log(`Parsed RGB: r=${r}, g=${g}, b=${b}, a=${a} from ${color}`);
        return { r, g, b, a };
      }
    }
    
    // Handle hex format
    if (color.indexOf('#') === 0) {
      let hex = color.substring(1);
      
      // Convert shorthand hex to full form
      if (hex.length === 3) {
        hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
      }
      
      r = parseInt(hex.substring(0, 2), 16) / 255;
      g = parseInt(hex.substring(2, 4), 16) / 255;
      b = parseInt(hex.substring(4, 6), 16) / 255;
      
      if (hex.length === 8) {
        a = parseInt(hex.substring(6, 8), 16) / 255;
      }
      
      console.log(`Parsed HEX: r=${r}, g=${g}, b=${b}, a=${a} from ${color}`);
      return { r, g, b, a };
    }
    
    // Handle named colors (basic implementation)
    const namedColors: {[key: string]: number[]} = {
      'black': [0, 0, 0],
      'white': [255, 255, 255],
      'red': [255, 0, 0],
      'green': [0, 128, 0],
      'blue': [0, 0, 255],
      'yellow': [255, 255, 0],
      'cyan': [0, 255, 255],
      'magenta': [255, 0, 255],
      'gray': [128, 128, 128],
      'transparent': [0, 0, 0, 0]
    };
    
    if (namedColors[color.toLowerCase()]) {
      const values = namedColors[color.toLowerCase()];
      r = values[0] / 255;
      g = values[1] / 255;
      b = values[2] / 255;
      if (values.length > 3) a = values[3];
      
      console.log(`Parsed named color: r=${r}, g=${g}, b=${b}, a=${a} from ${color}`);
      return { r, g, b, a };
    }
  } catch (e) {
    console.error(`Error parsing color: ${color}`, e);
  }
  
  // Default to black if color format is not recognized
  console.log(`Unrecognized color format: ${color}, defaulting to black`);
  return { r, g, b, a };
}

// Helper function to convert HSL to RGB
function hslToRgb(h: number, s: number, l: number): number[] {
  if (s === 0) {
    // Achromatic (gray)
    return [l, l, l];
  }
  
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  
  return [
    hue2rgb(p, q, h + 1/3),
    hue2rgb(p, q, h),
    hue2rgb(p, q, h - 1/3)
  ];
}

// Handle messages from the UI
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
        // Send success message back to UI
        figma.ui.postMessage({ 
          type: 'preview-success'
        });
      }
    } catch (error) {
      // Handle the error properly with type checking
      let errorMessage = 'An unknown error occurred';
      
      // Check if error is an object with a message property
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
  // Use the async version of getLocalVariableCollections
  figma.variables.getLocalVariableCollectionsAsync()
    .then(collections => {
      // Send collections back to the UI
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
      // Send an empty array if there's an error
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
    
    // Create a new effect style
    const style = figma.createEffectStyle();
    style.name = msg.name;
    
    // Create the effects with direct values
    const figmaEffects: Effect[] = [];
    
    for (const effect of parsedEffects) {
      if (effect.type === 'DROP_SHADOW') {
        const shadowEffect: DropShadowEffect = {
          type: 'DROP_SHADOW',
          color: {
            r: effect.color.r,
            g: effect.color.g,
            b: effect.color.b,
            a: effect.color.a
          },
          offset: {
            x: isNaN(effect.offset.x) ? 0 : effect.offset.x,
            y: isNaN(effect.offset.y) ? 0 : effect.offset.y
          },
          radius: isNaN(effect.radius) ? 0 : effect.radius,
          spread: isNaN(effect.spread) ? 0 : effect.spread,
          visible: true,
          blendMode: 'NORMAL'
        };
        
        figmaEffects.push(shadowEffect);
      } else if (effect.type === 'INNER_SHADOW') {
        const innerShadowEffect: InnerShadowEffect = {
          type: 'INNER_SHADOW',
          color: {
            r: effect.color.r,
            g: effect.color.g,
            b: effect.color.b,
            a: effect.color.a
          },
          offset: {
            x: isNaN(effect.offset.x) ? 0 : effect.offset.x,
            y: isNaN(effect.offset.y) ? 0 : effect.offset.y
          },
          radius: isNaN(effect.radius) ? 0 : effect.radius,
          spread: isNaN(effect.spread) ? 0 : effect.spread,
          visible: true,
          blendMode: 'NORMAL'
        };
        
        figmaEffects.push(innerShadowEffect);
      }
    }
    
    // Apply effects to the style
    style.effects = figmaEffects;
    
    // Send success message back to UI
    figma.ui.postMessage({ type: 'success' });
    
    // Notify about style creation
    figma.notify(`Created style "${msg.name}"`);
    
// If variables are requested, handle separately
if (msg.createVariables) {
  // Create variables in a separate async function
  const createVariables = async () => {
    try {
      let collection: VariableCollection;
      
      // Check if we need to create a new collection or use an existing one
      if (!msg.collectionId || msg.collectionId === 'create-new') {
        // Create a new collection with the provided name or default
        const collectionName = msg.newCollectionName || "Effect Variables";
        collection = figma.variables.createVariableCollection(collectionName);
      } else {
        // Try to get the existing collection using the async method
        try {
          const existingCollection = await figma.variables.getVariableCollectionByIdAsync(msg.collectionId);
          if (existingCollection) {
            collection = existingCollection;
          } else {
            // If collection is null, create a new one
            const collectionName = msg.newCollectionName || "Effect Variables";
            collection = figma.variables.createVariableCollection(collectionName);
          }
        } catch (collectionError) {
          // Properly handle the unknown error type
          let errorMessage = 'An unknown error occurred';
          
          if (collectionError && typeof collectionError === 'object' && 'message' in collectionError) {
            errorMessage = String(collectionError.message);
          } else if (typeof collectionError === 'string') {
            errorMessage = collectionError;
          }
          
          console.error('Error getting collection:', errorMessage);
          // Fall back to creating a new collection
          const collectionName = msg.newCollectionName || "Effect Variables";
          collection = figma.variables.createVariableCollection(collectionName);
        }
      }
      
      // Create variables for each effect in the style
      for (let i = 0; i < style.effects.length; i++) {
        const effect = style.effects[i];
        const suffix = i > 0 ? `-${i+1}` : ''; // Add suffix for multiple shadows
        
        if (effect.type === 'DROP_SHADOW' || effect.type === 'INNER_SHADOW') {
          // Create x offset variable
          const xVar = figma.variables.createVariable(
            `effect-${msg.name}${suffix}-x`, 
            collection,
            'FLOAT'
          );
          xVar.setValueForMode(collection.defaultModeId, effect.offset.x || 0);
          
          // Create y offset variable
          const yVar = figma.variables.createVariable(
            `effect-${msg.name}${suffix}-y`, 
            collection,
            'FLOAT'
          );
          yVar.setValueForMode(collection.defaultModeId, effect.offset.y || 0);
          
          // Create blur radius variable
          const blurVar = figma.variables.createVariable(
            `effect-${msg.name}${suffix}-blur`, 
            collection,
            'FLOAT'
          );
          blurVar.setValueForMode(collection.defaultModeId, effect.radius || 0);
          
          // Create spread variable
          const spreadVar = figma.variables.createVariable(
            `effect-${msg.name}${suffix}-spread`, 
            collection,
            'FLOAT'
          );
          spreadVar.setValueForMode(collection.defaultModeId, effect.spread || 0);
          
          // Create color variable
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
      
      // Show a notification about the variables
      figma.notify(`Created variables in "${collection.name}" collection. Due to API limitations, variables cannot be automatically bound to the style.`, {  });
    } catch (error) {
      // Properly handle the unknown error type
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
  
  // Call the async function
  createVariables();
}
    
  } catch (error) {
    // Handle the error properly with type checking
    let errorMessage = 'An unknown error occurred';
    
    // Check if error is an object with a message property
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

// This is needed to keep the plugin running
// figma.closePlugin(); // Don't close the plugin automatically