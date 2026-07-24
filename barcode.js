// 临期先知 — Web Barcode Detection
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
      throw new Error('当前浏览器不支持条码扫描');
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
      throw new Error('无法访问摄像头：' + (err.message || err.name));
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
      // 静默失败，继续扫描
    }
    if (scanning) requestAnimationFrame(tick);
  }

  // 简易商品库（演示用，生产可接入真实 API）
  const PRODUCT_DB = {
    '6901028180173': { name: '农夫山泉 550ml', category: '常温' },
    '6921168558986': { name: '蒙牛纯牛奶 250ml', category: '冷藏' },
    '6924743919305': { name: '心相印纸巾', category: '常温' },
    '6920202888823': { name: '康师傅红烧牛肉面', category: '干货' },
    '6901285991219': { name: '百事可乐 600ml', category: '常温' }
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