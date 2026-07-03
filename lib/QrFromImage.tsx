/**
 * QR-decoder for images picked from the gallery.
 *
 * The Expo camera module decodes QRs from the live camera stream on its own,
 * but the app also supports uploading an existing photo of the invitation
 * card. There is no first-party native module for offline image decoding on
 * both platforms, so we render an INVISIBLE `WebView` (0×0, `overflow:
 * hidden`), load a minimal HTML page that includes jsQR, and hand it the
 * image URI via `injectJavaScript`. The result comes back through
 * `postMessage` and is piped into a promise for the caller.
 *
 * Why the bridge exists:
 *   - jsQR is JavaScript-only and needs a `<canvas>` DOM element (not
 *     available in the RN runtime) to read pixel data.
 *   - A native module would ship as a config-plugin and break Expo Go — this
 *     project must stay Expo-Go compatible per `CLAUDE.md`.
 *
 * The image is downscaled to a max side of 1024 px before decoding — full
 * 12 MP wedding-invitation photos would OOM the WebView on older Android
 * devices, and jsQR does not benefit from more pixels above ~1000.
 */
import { useRef } from 'react';
import { View } from 'react-native';
import WebView from 'react-native-webview';

// jsQR is loaded inside the WebView from a JSDeliver CDN. This is the ONLY
// runtime third-party network call in the app; it is disclosed in the
// privacy notice. The load happens once when the WebView mounts.
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
  /**
   * Called once the WebView + jsQR are ready. Hands the caller a `decode`
   * function that resolves to the decoded QR string (or `null` if none was
   * found). Store this reference in a ref and invoke it whenever an image
   * needs decoding.
   */
  onReady: (decode: (uri: string) => Promise<string | null>) => void;
};

/**
 * Zero-size WebView that exposes an image-to-QR decoding channel. Mount it
 * once per screen that needs the feature; unmounting tears down the bridge.
 */
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
