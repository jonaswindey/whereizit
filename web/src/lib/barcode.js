// Barcode reading: the browser's own BarcodeDetector where it exists (Android Chrome), otherwise the
// zxing-wasm ponyfill (iPhone Safari). The wasm file is bundled with the app instead of fetched from
// a CDN, so scanning works on the tailnet without reaching out to anyone.
let detectorPromise

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'qr_code']

export function getDetector () {
  detectorPromise ??= (async () => {
    if ('BarcodeDetector' in window) {
      const supported = await window.BarcodeDetector.getSupportedFormats().catch(() => [])
      if (FORMATS.some(f => supported.includes(f))) return new window.BarcodeDetector({ formats: FORMATS.filter(f => supported.includes(f)) })
    }
    const [{ BarcodeDetector, prepareZXingModule }, { default: wasmUrl }] = await Promise.all([
      import('barcode-detector/ponyfill'),
      import('zxing-wasm/reader/zxing_reader.wasm?url')
    ])
    prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) } })
    return new BarcodeDetector({ formats: FORMATS })
  })()
  return detectorPromise
}
