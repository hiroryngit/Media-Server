import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'crypto';

const CAPTCHA_LENGTH = 6;
const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generateCode(): string {
  let code = '';
  for (let i = 0; i < CAPTCHA_LENGTH; i++) {
    code += CHARS[crypto.randomInt(CHARS.length)];
  }
  return code;
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateSvg(code: string): string {
  const width = 200;
  const height = 60;

  // ノイズの線を生成
  let noiseLines = '';
  for (let i = 0; i < 6; i++) {
    const x1 = randomBetween(0, width);
    const y1 = randomBetween(0, height);
    const x2 = randomBetween(0, width);
    const y2 = randomBetween(0, height);
    const r = Math.floor(randomBetween(80, 180));
    const g = Math.floor(randomBetween(80, 180));
    const b = Math.floor(randomBetween(80, 180));
    noiseLines += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="rgb(${r},${g},${b})" stroke-width="1.5"/>`;
  }

  // ノイズのドットを生成
  let noiseDots = '';
  for (let i = 0; i < 30; i++) {
    const cx = randomBetween(0, width);
    const cy = randomBetween(0, height);
    const r = Math.floor(randomBetween(100, 200));
    const g = Math.floor(randomBetween(100, 200));
    const b = Math.floor(randomBetween(100, 200));
    noiseDots += `<circle cx="${cx}" cy="${cy}" r="${randomBetween(1, 2.5)}" fill="rgb(${r},${g},${b})"/>`;
  }

  // 文字を1文字ずつ配置（回転・位置をランダムに）
  let chars = '';
  const charWidth = width / (CAPTCHA_LENGTH + 1);
  for (let i = 0; i < code.length; i++) {
    const x = charWidth * (i + 0.8);
    const y = randomBetween(32, 42);
    const rotation = randomBetween(-15, 15);
    const fontSize = randomBetween(22, 30);
    const r = Math.floor(randomBetween(30, 100));
    const g = Math.floor(randomBetween(30, 100));
    const b = Math.floor(randomBetween(30, 100));
    chars += `<text x="${x}" y="${y}" font-size="${fontSize}" font-family="monospace" font-weight="bold" fill="rgb(${r},${g},${b})" transform="rotate(${rotation}, ${x}, ${y})">${code[i]}</text>`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="#f0f0f0"/>
    ${noiseLines}
    ${noiseDots}
    ${chars}
  </svg>`;
}

export async function GET() {
  const code = generateCode();

  // CAPTCHAコードをcookieに保存（HttpOnly で改ざん防止）
  const cookieStore = await cookies();
  cookieStore.set('captcha_code', code, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 5, // 5分間有効
    path: '/',
  });

  const svg = generateSvg(code);

  return new NextResponse(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
