import { createCanvas, GlobalFonts, loadImage } from '@napi-rs/canvas';
import path from 'path';
import fs from 'fs';
import https from 'https';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Download helper
async function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

// Ensure fonts exist and register them
export async function initCairoFonts() {
    const fontsDir = path.join(__dirname, '../fonts');
    if (!fs.existsSync(fontsDir)) {
        fs.mkdirSync(fontsDir, { recursive: true });
    }

    const fontDest = path.join(fontsDir, 'Cairo-Variable.ttf');
    const fontUrl = 'https://raw.githubusercontent.com/google/fonts/main/ofl/cairo/Cairo%5Bslnt%2Cwght%5D.ttf';

    try {
        if (!fs.existsSync(fontDest)) {
            console.log('[PVC Image] Downloading Cairo font...');
            await downloadFile(fontUrl, fontDest);
        }

        // Register with canvas
        GlobalFonts.registerFromPath(fontDest, 'Cairo');
        GlobalFonts.registerFromPath(fontDest, 'Cairo Bold');
        console.log('[PVC Image] ✅ Cairo fonts loaded successfully.');
    } catch (err) {
        console.error('[PVC Image] ❌ Font initialization failed (falling back to system fonts):', err);
    }
}

// Generate the beautiful Guide Image
export async function generatePVCGuideImage() {
    const width = 1400;
    const height = 580;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Outer Border Radius Clipping (so the picture itself has smooth rounded corners!)
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(0, 0, width, height, 36);
    ctx.clip();

    // 1. Background (Custom Cosmic Image or Solid Fallback)
    const bgPath = path.join(__dirname, '../assets/pvc_bg.png');
    if (fs.existsSync(bgPath)) {
        try {
            const bgImg = await loadImage(bgPath);
            ctx.drawImage(bgImg, 0, 0, width, height);
        } catch (e) {
            ctx.fillStyle = '#1a1d27';
            ctx.fillRect(0, 0, width, height);
        }
    } else {
        ctx.fillStyle = '#1a1d27';
        ctx.fillRect(0, 0, width, height);
    }

    // Semi-transparent cosmic purple overlay on top for rich contrast
    ctx.fillStyle = 'rgba(30, 10, 50, 0.45)';
    ctx.fillRect(0, 0, width, height);

    // 2. Center Header Title
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(138, 43, 226, 0.9)';
    ctx.shadowBlur = 16;
    ctx.font = 'bold 44px "Cairo Bold", "Cairo", "Segoe UI", Arial';
    ctx.fillText('أدوات التحكم في الغرفة الملكية', width / 2, 65);
    ctx.restore();

    const items = [
        { label: "تعديل الاسم", emojiId: "1508307894720921770" },
        { label: "تراست عضو", emojiId: "1508309775018885181" },
        { label: "حظر عضو", emojiId: "1508308168390742017" },
        { label: "نقل ملكية", emojiId: "1508309385670164622" },
        { label: "الخصوصية", emojiId: "1508308707690283110" },
        { label: "حالة الغرفة", emojiId: "1508310210198900806" },
        { label: "الموثوقين", emojiId: "1508310598260097076" },
        { label: "الحد الأقصى", emojiId: "1508311004252078230" },
        { label: "حذف الشات", emojiId: "1508308168390742017" }
    ];

    for (let item of items) {
        if (item.emojiId) {
            try {
                item.img = await loadImage(`https://cdn.discordapp.com/emojis/${item.emojiId}.png`);
            } catch(e) {
                console.error('Failed to load emoji', item.emojiId);
            }
        }
    }

    const cols = 3;
    const rectWidth = 410;
    const rectHeight = 96;
    const gapX = 35;
    const gapY = 28;
    
    const startX = (width - (cols * rectWidth + (cols - 1) * gapX)) / 2;
    const startY = 150;

    items.forEach((item, index) => {
        const col = index % cols;
        const row = Math.floor(index / cols);
        
        const x = startX + col * (rectWidth + gapX);
        const y = startY + row * (rectHeight + gapY);

        ctx.save();
        // Inner boxes in stunning Royal Purple with Violet border glow
        ctx.fillStyle = 'rgba(75, 20, 135, 0.88)';
        ctx.strokeStyle = 'rgba(190, 110, 255, 0.85)';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = 'rgba(138, 43, 226, 0.65)';
        ctx.shadowBlur = 14;
        
        ctx.beginPath();
        ctx.roundRect(x, y, rectWidth, rectHeight, 22);
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        const iconSize = 52;
        const iconX = x + 24;
        const iconY = y + (rectHeight - iconSize) / 2;

        if (item.img) {
            ctx.drawImage(item.img, iconX, iconY, iconSize, iconSize);
        }

        ctx.save();
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 28px "Cairo Bold", "Cairo", "Segoe UI", Arial';
        ctx.fillText(item.label, x + rectWidth - 30, y + rectHeight / 2);
        ctx.restore();
    });

    ctx.restore(); // Restore clipping

    // Outer subtle violet glowing frame around the rounded picture
    ctx.save();
    ctx.strokeStyle = 'rgba(180, 100, 255, 0.6)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.roundRect(3, 3, width - 6, height - 6, 36);
    ctx.stroke();
    ctx.restore();

    return canvas.toBuffer('image/png');
}
