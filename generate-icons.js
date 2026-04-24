const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, 'public', 'icon.svg');
const svg = fs.readFileSync(svgPath);

async function generate() {
  await sharp(svg).resize(192, 192).png().toFile(path.join(__dirname, 'public', 'icon-192.png'));
  console.log('icon-192.png generated');
  await sharp(svg).resize(512, 512).png().toFile(path.join(__dirname, 'public', 'icon-512.png'));
  console.log('icon-512.png generated');
}

generate().catch(console.error);
