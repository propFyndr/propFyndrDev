import fs from 'fs';
import path from 'path';
import { ImageResponse } from 'next/og';

// Share preview for every route that does not define its own.
// Static: rendered once at build time from local files, no network.
export const runtime = 'nodejs';
export const alt = 'RealtyAsk — find the right property in Noida';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const read = (p: string) => fs.promises.readFile(path.join(process.cwd(), p));
const dataUrl = (buf: Buffer, mime: string) => `data:${mime};base64,${buf.toString('base64')}`;

export default async function OpengraphImage() {
  const [regular, semibold, extrabold, logo, photo] = await Promise.all([
    read('assets/og/outfit-latin-400-normal.woff'),
    read('assets/og/outfit-latin-600-normal.woff'),
    read('assets/og/outfit-latin-800-normal.woff'),
    read('public/images/icons/apple-icon.png'),
    read('assets/og/photo.jpg'),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          background: 'radial-gradient(circle at 85% 40%, #e3ecff 0%, #ffffff 55%)',
          fontFamily: 'Outfit',
          color: '#0B0F17',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 640, padding: '64px 0 64px 72px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
            <img src={dataUrl(logo, 'image/png')} width={64} height={64} style={{ margin: '-8px -6px' }} />
            <div style={{ display: 'flex', fontSize: 38, fontWeight: 800, letterSpacing: -1.2 }}>
              <span>Realty</span>
              <span style={{ color: '#1D63ED', marginLeft: -5 }}>Ask</span>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', flexDirection: 'column', fontSize: 66, fontWeight: 800, letterSpacing: -2.5, lineHeight: 1.04 }}>
              <div style={{ display: 'flex' }}>Find the right</div>
              <div style={{ display: 'flex' }}>
                <div style={{ display: 'flex' }}>property in</div>
                <div style={{ display: 'flex', marginLeft: 14, color: '#1D63ED' }}>Noida.</div>
              </div>
            </div>
            <div style={{ marginTop: 22, fontSize: 26, fontWeight: 400, color: '#52525b', lineHeight: 1.35, maxWidth: 520 }}>
              A short list, the reason for each pick, and the honest trade-off.
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            {['Noida & Greater Noida West', 'Free, no signup'].map((t) => (
              <div
                key={t}
                style={{
                  display: 'flex',
                  padding: '10px 20px',
                  borderRadius: 999,
                  background: '#ffffff',
                  border: '1px solid #e4e4e7',
                  fontSize: 20,
                  fontWeight: 600,
                  color: '#3f3f46',
                }}
              >
                {t}
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', flex: 1, padding: 32 }}>
          {/* eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text */}
          <img
            src={dataUrl(photo, 'image/jpeg')}
            width={496}
            height={566}
            style={{ borderRadius: 32, objectFit: 'cover', boxShadow: '0 30px 60px -20px rgba(15,23,42,0.35)' }}
          />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: 'Outfit', data: regular, weight: 400, style: 'normal' },
        { name: 'Outfit', data: semibold, weight: 600, style: 'normal' },
        { name: 'Outfit', data: extrabold, weight: 800, style: 'normal' },
      ],
    }
  );
}
