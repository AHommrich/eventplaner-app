/**
 * Decodes a QR code from a local image URI using a hidden WebView + jsQR.
 * Usage: await decodeQrFromImage(uri)  → returns QR string or null
 */
import { useRef } from 'react';
import { View } from 'react-native';
import WebView from 'react-native-webview';

// jsQR minified inline (via CDN at build-time we load it in the HTML)
const HTML = `<!DOCTYPE html><html><body>
<script src="https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js"></script>
<script>
window.addEventListener('message', async (e) => {
  try {
    const uri = e.data;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX = 1024;
      const scale = Math.min(MAX / img.width, MAX / img.height, 1);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const d = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const result = jsQR(d.data, d.width, d.height, { inversionAttempts: 'attemptBoth' });
      window.ReactNativeWebView.postMessage(JSON.stringify({ ok: true, data: result ? result.data : null }));
    };
    img.onerror = () => window.ReactNativeWebView.postMessage(JSON.stringify({ ok: false }));
    img.src = uri;
  } catch(err) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ ok: false, error: String(err) }));
  }
});
window.ReactNativeWebView.postMessage(JSON.stringify({ ready: true }));
</script>
</body></html>`;

type Props = {
  onReady: (decode: (uri: string) => Promise<string | null>) => void;
};

export function QrFromImageView({ onReady }: Props) {
  const webviewRef = useRef<WebView>(null);
  const resolverRef = useRef<((val: string | null) => void) | null>(null);

  function decode(uri: string): Promise<string | null> {
    return new Promise((resolve) => {
      resolverRef.current = resolve;
      webviewRef.current?.injectJavaScript(
        `window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(uri)} })); true;`
      );
    });
  }

  return (
    <View style={{ width: 0, height: 0, overflow: 'hidden' }}>
      <WebView
        ref={webviewRef}
        source={{ html: HTML }}
        originWhitelist={['*']}
        javaScriptEnabled
        onMessage={(e) => {
          try {
            const msg = JSON.parse(e.nativeEvent.data);
            if (msg.ready) { onReady(decode); return; }
            if (resolverRef.current) {
              resolverRef.current(msg.ok ? msg.data : null);
              resolverRef.current = null;
            }
          } catch {}
        }}
      />
    </View>
  );
}
