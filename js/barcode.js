// ä¸´æåç¥ â Web Barcode Detection
(function() {
  'use strict';

  let stream = null;
  let detector = null;
  let videoEl = null;
  let scanning = false;
  let onDetectCallback = null;

  function isSupported() {
    return 'BarcodeDetector' in window;
  }

  async function start(video, onDetect) {
    if (!isSupported()) {
      throw new Error('å½åæµè§å¨ä¸æ¯ææ¡ç æ«æ');
    }
    videoEl = video;
    onDetectCallback = onDetect;

    detector = new BarcodeDetector({
      formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
    });

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      video.srcObject = stream;
      await video.play();
      scanning = true;
      tick();
    } catch (err) {
      throw new Error('æ æ³è®¿é®æåå¤´ï¼' + (err.message || err.name));
    }
  }

  function stop() {
    scanning = false;
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
    if (videoEl) {
      videoEl.srcObject = null;
    }
  }

  async function tick() {
    if (!scanning || !videoEl) return;
    try {
      const barcodes = await detector.detect(videoEl);
      if (barcodes && barcodes.length > 0) {
        const code = barcodes[0].rawValue;
        stop();
        if (onDetectCallback) onDetectCallback(code);
        return;
      }
    } catch (e) {
    }
    if (scanning) requestAnimationFrame(tick);
  }

  const PRODUCT_DB = {
    '6901028180173': { name: 'åå¤«å±±æ³ 550ml', category: 'å¸¸æ¸©' },
    '6921168558986': { name: 'èççº¯çå¥¶ 250ml', category: 'å·è' },
    '6924743919305': { name: 'å¿ç¸å°çº¸å·¾', category: 'å¸¸æ¸©' },
    '6920202888823': { name: 'åº·å¸åçº¢ç§çèé¢', category: 'å¹²è´§' },
    '6901285991219': { name: 'ç¾äºå¯ä¹ 600ml', category: 'å¸¸æ¸©' }
  };

  async function lookupBarcode(code) {
    return PRODUCT_DB[code] || null;
  }

  window.LQBarcode = {
    isSupported,
    start,
    stop,
    lookupBarcode
  };
})();
