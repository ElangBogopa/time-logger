#!/usr/bin/env node

/**
 * Generate simple PWA icon placeholders
 * Uses sharp library if available, falls back to creating SVG icons
 */

const fs = require('fs');
const path = require('path');

const THEME_BG = '#09090b'; // Dark shadcn background
const THEME_FG = '#fafafa'; // Light foreground

function generateSVGIcon(size) {
  const radius = size / 2.5;
  const centerX = size / 2;
  const centerY = size / 2;
  const strokeWidth = radius * 0.08;

  // Clock hands at 10:10 position
  const hourHandLength = radius * 0.45;
  const minuteHandLength = radius * 0.65;
  const hourAngle = (Math.PI / 180) * (-60 - 90);
  const minuteAngle = (Math.PI / 180) * (60 - 90);

  const hourX = centerX + Math.cos(hourAngle) * hourHandLength;
  const hourY = centerY + Math.sin(hourAngle) * hourHandLength;
  const minuteX = centerX + Math.cos(minuteAngle) * minuteHandLength;
  const minuteY = centerY + Math.sin(minuteAngle) * minuteHandLength;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="${THEME_BG}"/>
  <circle cx="${centerX}" cy="${centerY}" r="${radius * 0.85}"
          fill="none" stroke="${THEME_FG}" stroke-width="${strokeWidth}"/>
  <line x1="${centerX}" y1="${centerY}" x2="${hourX}" y2="${hourY}"
        stroke="${THEME_FG}" stroke-width="${strokeWidth}" stroke-linecap="round"/>
  <line x1="${centerX}" y1="${centerY}" x2="${minuteX}" y2="${minuteY}"
        stroke="${THEME_FG}" stroke-width="${strokeWidth * 0.75}" stroke-linecap="round"/>
  <circle cx="${centerX}" cy="${centerY}" r="${radius * 0.08}" fill="${THEME_FG}"/>
</svg>`;
}

async function generateWithSharp(size, outputPath) {
  try {
    const sharp = require('sharp');
    const svg = generateSVGIcon(size);
    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);
    return true;
  } catch (err) {
    return false;
  }
}

async function generateIcon(size, outputPath) {
  // Try sharp first
  const sharpSuccess = await generateWithSharp(size, outputPath);

  if (sharpSuccess) {
    console.log(`✓ Generated ${size}x${size} icon (PNG): ${outputPath}`);
  } else {
    // Fallback to SVG
    const svgPath = outputPath.replace('.png', '.svg');
    const svg = generateSVGIcon(size);
    fs.writeFileSync(svgPath, svg);
    console.log(`✓ Generated ${size}x${size} icon (SVG): ${svgPath}`);
    console.log(`  Note: Install 'sharp' package to generate PNG: npm install --save-dev sharp`);
  }
}

async function main() {
  const iconsDir = path.join(__dirname, '../public/icons');
  const publicDir = path.join(__dirname, '../public');

  // Create icons directory if it doesn't exist
  if (!fs.existsSync(iconsDir)) {
    fs.mkdirSync(iconsDir, { recursive: true });
  }

  // Generate all required sizes
  const sizes = [192, 512];

  for (const size of sizes) {
    await generateIcon(size, path.join(iconsDir, `icon-${size}x${size}.png`));
  }

  // Generate apple-touch-icon (180x180)
  await generateIcon(180, path.join(publicDir, 'apple-touch-icon.png'));

  console.log('\n✨ PWA icons generated successfully!');
}

main().catch(console.error);
