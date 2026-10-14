/**
 * Renders the site-wide share preview to app/opengraph-image.jpg (+ twitter-image.jpg).
 *
 * Shipped as a static JPEG, not a runtime route: WhatsApp drops previews over
 * ~300 KB (a photo PNG is ~500 KB), and a static file needs no function at
 * request time. Re-run after changing the copy or the photo:
 *
 *   cd frontend && npx tsx scripts/og/og-image.tsx
 *   python -c "from PIL import Image; im=Image.open('scripts/og/out.png').convert('RGB'); [im.save(p,'JPEG',quality=86,optimize=True,progressive=True) for p in ('app/opengraph-image.jpg','app/twitter-image.jpg')]"
 *
 * The example answer is illustrative (no project named): it shows the format
 * every recommendation follows, a reason and a trade-off.
 */
import fs from 'fs';
import path from 'path';
import { syncBuiltinESMExports } from 'module';
import React from 'react';

// @vercel/og joins a file URL with path.join, which breaks on Windows.
(path as unknown as { join: typeof path.posix.join }).join = path.posix.join;
syncBuiltinESMExports();
(globalThis as unknown as { React: typeof React }).React = React;

const here = (p: string) => path.posix.join(process.cwd().replace(/\\/g, '/'), p);
const read = (p: string) => fs.readFileSync(here(p));
const dataUrl = (buf: Buffer, mime: string) => `data:${mime};base64,${buf.toString('base64')}`;

const BLUE = '#3B82F6';

async function main() {
  const { ImageResponse } = await import('next/og');
  const logo = dataUrl(read('scripts/og/logo.png'), 'image/png');
  const photo = dataUrl(read('scripts/og/photo.jpg'), 'image/jpeg');

  const res = new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', position: 'relative', fontFamily: 'Outfit', color: '#fff', background: '#0B0F17' }}>
        {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
        <img src={photo} width={1200} height={675} style={{ position: 'absolute', top: -20, left: 0, objectFit: 'cover' }} />
        {/* Left-weighted scrim keeps the headline legible over any part of the photo */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', background: 'linear-gradient(90deg, rgba(7,10,18,0.92) 0%, rgba(7,10,18,0.78) 42%, rgba(7,10,18,0.25) 75%, rgba(7,10,18,0.35) 100%)' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1200, height: 630, display: 'flex', background: 'linear-gradient(0deg, rgba(7,10,18,0.55) 0%, rgba(7,10,18,0) 40%)' }} />

        {/* Left: brand, headline, promise */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 640, padding: '58px 0 54px 64px' }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={logo} width={60} height={60} style={{ margin: '-6px 4px -6px -8px' }} />
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1 }}>Realty</span>
            <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, color: BLUE, marginLeft: -4 }}>Ask</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 20, fontWeight: 600, letterSpacing: 3, color: '#93C5FD', textTransform: 'uppercase' }}>
              Your AI property advisor
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14, fontSize: 68, fontWeight: 800, letterSpacing: -2.5, lineHeight: 1.02 }}>
              <div style={{ display: 'flex' }}>Find the right</div>
              <div style={{ display: 'flex' }}>
                <div style={{ display: 'flex' }}>home in</div>
                <div style={{ display: 'flex', marginLeft: 16, color: BLUE }}>Noida.</div>
              </div>
            </div>
            <div style={{ display: 'flex', marginTop: 20, fontSize: 25, color: 'rgba(255,255,255,0.78)', lineHeight: 1.35, maxWidth: 500 }}>
              Ask in plain words. Get a short list, why each fits, and the honest trade-off.
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 19, fontWeight: 600 }}>
            {['Noida & Greater Noida West', 'Free, no signup'].map((t) => (
              <div key={t} style={{ display: 'flex', padding: '9px 18px', borderRadius: 999, background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.22)' }}>
                {t}
              </div>
            ))}
          </div>
        </div>

        {/* Right: the product in one glance */}
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', flex: 1, padding: '0 56px 0 0', gap: 16 }}>
          <div style={{ display: 'flex', maxWidth: 420, padding: '16px 22px', borderRadius: 26, borderBottomRightRadius: 8, background: '#ffffff', color: '#0B0F17', fontSize: 22, fontWeight: 600, lineHeight: 1.3, boxShadow: '0 20px 40px -12px rgba(0,0,0,0.5)' }}>
            3BHK near a metro under 1.5 Cr, ready in a year
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', width: 440, padding: '22px 24px', borderRadius: 26, borderBottomLeftRadius: 8, background: 'rgba(12,16,26,0.82)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: '0 30px 60px -16px rgba(0,0,0,0.6)' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 17, fontWeight: 600, color: 'rgba(255,255,255,0.6)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
              <img src={logo} width={30} height={30} style={{ margin: '-4px 6px -4px -4px' }} />
              RealtyAsk
              <div style={{ display: 'flex', marginLeft: 'auto', padding: '3px 10px', borderRadius: 999, border: '1px solid rgba(255,255,255,0.2)', fontSize: 13, letterSpacing: 1.2, color: 'rgba(255,255,255,0.55)' }}>EXAMPLE</div>
            </div>
            <div style={{ display: 'flex', marginTop: 10, fontSize: 24, fontWeight: 800, letterSpacing: -0.5 }}>Three projects fit. Here is the first.</div>

            <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 16, padding: '12px 14px', borderRadius: 14, background: 'rgba(16,185,129,0.14)', border: '1px solid rgba(16,185,129,0.35)' }}>
              <div style={{ display: 'flex', fontSize: 15, fontWeight: 800, letterSpacing: 1.5, color: '#6EE7B7', width: 112, marginTop: 3 }}>REASON</div>
              <div style={{ display: 'flex', flex: 1, fontSize: 19, lineHeight: 1.3, color: 'rgba(255,255,255,0.92)' }}>In budget, 8 min walk to the metro</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-start', marginTop: 10, padding: '12px 14px', borderRadius: 14, background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)' }}>
              <div style={{ display: 'flex', fontSize: 15, fontWeight: 800, letterSpacing: 1.5, color: '#FCD34D', width: 112, marginTop: 3 }}>TRADE-OFF</div>
              <div style={{ display: 'flex', flex: 1, fontSize: 19, lineHeight: 1.3, color: 'rgba(255,255,255,0.92)' }}>Possession in 18 months</div>
            </div>
          </div>
        </div>

        <div style={{ position: 'absolute', right: 56, bottom: 30, display: 'flex', fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>realtyask.in</div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Outfit', data: read('scripts/og/outfit-latin-400-normal.woff'), weight: 400, style: 'normal' },
        { name: 'Outfit', data: read('scripts/og/outfit-latin-600-normal.woff'), weight: 600, style: 'normal' },
        { name: 'Outfit', data: read('scripts/og/outfit-latin-800-normal.woff'), weight: 800, style: 'normal' },
      ],
    }
  );

  fs.writeFileSync(here('scripts/og/out.png'), Buffer.from(await res.arrayBuffer()));
  console.log('wrote scripts/og/out.png');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
