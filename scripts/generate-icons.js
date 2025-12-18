// Script to generate placeholder icons for the Chrome extension
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// Create icons directory if it doesn't exist
const iconsDir = path.join(__dirname, '../public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Function to create a colored square PNG
function createIcon(size, color = { r: 255, g: 0, b: 0 }) {
  const png = new PNG({ width: size, height: size });
  
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      png.data[idx] = color.r;     // R
      png.data[idx + 1] = color.g; // G
      png.data[idx + 2] = color.b; // B
      png.data[idx + 3] = 255;      // A (fully opaque)
    }
  }
  
  return png;
}

// Generate icons for different sizes
const sizes = [
  { size: 16, color: { r: 255, g: 0, b: 0 } },    // Red
  { size: 48, color: { r: 255, g: 0, b: 0 } },    // Red
  { size: 128, color: { r: 255, g: 0, b: 0 } }    // Red
];

sizes.forEach(({ size, color }) => {
  const png = createIcon(size, color);
  const filename = path.join(iconsDir, `icon${size}.png`);
  
  png.pack().pipe(fs.createWriteStream(filename));
  console.log(`Created ${filename} (${size}x${size})`);
});

console.log('\n✅ Icons generated successfully!');
console.log('You can replace these placeholder icons with custom designs later.');
