import React, { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import { X, Camera, Upload, Crop, Search, Check } from 'lucide-react';
import axios from 'axios';
import { API_URL } from '../config';

// --- Card-bounds detection (client-side, no network) --------------------
// Finds the card rectangle by its long straight edges plus the fixed MTG
// card aspect ratio (~0.63x0.88 => 0.55-0.80 when tilted). Returns
// {x, y, width, height} in percent of the image, or null when no
// card-shaped box stands out from the background.
const detectCardBounds = (img) => {
  try {
    const W = 240;
    const H = Math.max(1, Math.round((W * img.height) / img.width));
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, W, H);
    const { data } = ctx.getImageData(0, 0, W, H);
    const gray = new Uint8Array(W * H);
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = (data[p] * 299 + data[p + 1] * 587 + data[p + 2] * 114) / 1000;
    }
    const T = 25;
    const GAP = 2; // tolerate small gaps so a slight tilt doesn't break runs
    const longestRun = (get, n) => {
      let best = 0;
      let cur = 0;
      let gaps = 0;
      for (let i = 0; i < n; i++) {
        if (get(i)) {
          cur++;
          gaps = 0;
        } else {
          gaps++;
          if (gaps > GAP) {
            if (cur > best) best = cur;
            cur = 0;
            gaps = 0;
          }
        }
      }
      return Math.max(best, cur);
    };
    // Straight-edge profiles: longest contiguous edge run per column/row.
    // Background texture gives short scattered runs; card borders give one
    // long run, which cleanly separates them.
    const colRun = new Float32Array(W);
    const rowRun = new Float32Array(H);
    for (let x = 1; x < W - 1; x++) {
      colRun[x] = longestRun((y) => Math.abs(gray[y * W + x + 1] - gray[y * W + x - 1]) > T, H);
    }
    for (let y = 1; y < H - 1; y++) {
      const up = Math.max(0, y - 1) * W;
      const dn = Math.min(H - 1, y + 1) * W;
      rowRun[y] = longestRun((x) => Math.abs(gray[dn + x] - gray[up + x]) > T, W);
    }
    // ±1 cell tolerance for tilted edges spreading over neighbouring lines
    const tilt3 = (arr, n) =>
      Array.from(arr, (_, i) => Math.max(arr[Math.max(0, i - 1)], arr[i], arr[Math.min(n - 1, i + 1)]));
    const crs = tilt3(colRun, W);
    const rrs = tilt3(rowRun, H);
    const topPairs = (prof, n) => {
      const out = [];
      const lo = Math.floor(0.01 * n);
      const hi = Math.ceil(0.99 * n);
      const minSp = Math.floor(0.2 * n);
      const maxSp = Math.ceil(0.97 * n);
      for (let a = lo; a < hi; a++) {
        for (let b = a + minSp; b < Math.min(hi, a + maxSp); b++) {
          out.push([prof[a] + prof[b], a, b]);
        }
      }
      out.sort((p, q) => q[0] - p[0]);
      return out.slice(0, 40);
    };
    const colPairs = topPairs(crs, W);
    const rowPairs = topPairs(rrs, H);
    if (colPairs.length === 0 || rowPairs.length === 0) return null;
    // Pick the edge-pair combination that also matches the card aspect ratio
    let best = null;
    for (const [sc, l, r] of colPairs) {
      for (const [st, t, b] of rowPairs) {
        const wPx = ((r - l) * img.width) / W;
        const hPx = ((b - t) * img.height) / H;
        const ratio = wPx / hPx;
        if (ratio < 0.55 || ratio > 0.82) continue;
        const areaFrac = ((r - l) / W) * ((b - t) / H);
        // A card being scanned fills a large part of the frame; without this
        // guard small high-contrast rectangles (shadows, overlays, mat seams)
        // out-score the real card and every OCR strip reads background
        if (areaFrac < 0.06) continue;
        const score = sc + st + 250 * areaFrac;
        if (!best || score > best.score) best = { score, l, r, t, b };
      }
    }
    if (!best || best.score < 30) return null;
    return {
      x: (100 * best.l) / W,
      y: (100 * best.t) / H,
      width: (100 * (best.r - best.l)) / W,
      height: (100 * (best.b - best.t)) / H,
    };
  } catch (e) {
    console.log('Card detection failed:', e.message);
    return null;
  }
};

// Card-shaped fallback box centered in the frame (MTG cards are 63x88mm).
// The old fallback was nearly the full frame, which drags background
// texture into every OCR strip when detection fails.
const cardFallbackBounds = (img) => {
  let hPct = 84;
  // 84% of the frame height as a card-shaped box -> width % of frame
  let wPct = (hPct * img.height * (63 / 88)) / img.width;
  if (wPct > 90) {
    wPct = 90;
    hPct = (90 * img.width * (88 / 63)) / img.height;
  }
  return { x: (100 - wPct) / 2, y: (100 - hPct) / 2, width: wPct, height: hPct };
};

// When auto-detection fails, the user-dragged name strip still locates the
// card: the name bar spans nearly the full card width and sits at the very
// top of it. Card height then follows from MTG's 63:88 aspect. Field scans
// with off-center cards (detection null) were falling back to a centered
// box that missed the card entirely, so rules OCR read background.
const boundsFromNameStrip = (strip, img) => {
  if (!strip || !img || !img.width || !img.height || strip.width < 10) return null;
  // x1.35 perspective tolerance: phone photos foreshorten the card
  // vertically (measured 1.22x on a real tilted scan); a strict 63:88
  // box ends up cutting off the rules text it's meant to cover
  const heightPct = (1.35 * strip.width * img.width * (88 / 63)) / img.height;
  if (!isFinite(heightPct) || heightPct > 100) return null;
  const y = Math.max(0, strip.y - 0.02 * heightPct);
  return { x: strip.x, y, width: strip.width, height: Math.min(heightPct, 100 - y) };
};

// Candidate name-bar strips. Phase 1 (primary) is anchored to the detected
// card and keeps the old fast path. Phase 2 (extended) searches ABOVE the
// detected box and only runs when nothing in phase 1 resolved: dark cards
// in dim light lose their outer top/side edges, so detection latches onto
// the bright art rectangle and the real name bar sits just above the box
// (field report: adventure card misread). The extended strips are wider
// than the box too, since the name bar spans nearly the full card width
// while the latched box often covers only half of it.
const buildOcrStrips = (selected, bounds) => {
  const clamp = (s) => {
    const x = Math.max(0, Math.min(100, s.x));
    const y = Math.max(0, Math.min(100, s.y));
    return {
      x,
      y,
      width: Math.max(4, Math.min(100 - x, s.width)),
      height: Math.max(3, Math.min(100 - y, s.height)),
    };
  };
  const primary = [clamp(selected)];
  const extended = [];
  const seen = (arr, s) =>
    arr.some((o) => Math.abs(o.y - s.y) < 1.5 && Math.abs(o.height - s.height) < 1.5 && Math.abs(o.x - s.x) < 1.5);
  if (bounds) {
    for (const dy of [0.04, 0.1, 0.16, 0.24, 0.32]) {
      const s = clamp({
        x: bounds.x + 1,
        y: bounds.y + dy * bounds.height,
        width: bounds.width - 2,
        height: 0.12 * bounds.height,
      });
      if (!seen(primary, s)) primary.push(s);
    }
    // Phase 2. Dark-framed cards in dim light lose their OUTER edges, so
    // detectCardBounds latches onto the bright ART rectangle and the box
    // top lands BELOW the real name bar (field report: prepare/adventure
    // card read as "Adventurous 21"). The name bar sits within ~11% of the
    // card top, so the bands that can hold it are the ones just above the
    const margin = 0.15 * bounds.width;
    const wideBand = (yTop, h) => clamp({
      x: bounds.x - margin,
      y: yTop,
      width: bounds.width + 2 * margin,
      height: h,
    });
    // A real MTG name bar is only ~1.3% of the frame, sitting just above the
    // detected art box. A band as tall as the box dilutes it with art, so
    // Tesseract reads noise ("Pe - a om" instead of the name). Use thin
    // overlapping bands at a fine stride and let OCR + Scryfall resolution
    // pick the one that actually holds the name.
    const barH = 3.5; // ~1.5x a name bar: tolerant of a few px of placement error
    const push = (s) => {
      if (s.height >= 2 && !seen(extended, s) && !seen(primary, s)) extended.push(s);
    };
    for (let yTop = bounds.y - 0.12 * bounds.height; yTop <= bounds.y + 0.06 * bounds.height; yTop += 1.2) {
      push(wideBand(yTop, barH));
    }
  } else {
    for (const dy of [0.1, 0.2, 0.3, 0.4]) {
      const s = clamp({ ...selected, y: selected.y + dy * 100 });
      if (!seen(primary, s)) primary.push(s);
    }
  }
  return { primary: primary.slice(0, 6), extended: extended.slice(0, 12) };
};

// Crop the detected card out of the photo for image matching — hashing the
// whole frame let the background (tablecloth) dominate the tiny hash
const cardCropForMatch = (img, bounds) => {
  if (!bounds) return null;
  const x = Math.max(0, (bounds.x / 100) * img.width);
  const y = Math.max(0, (bounds.y / 100) * img.height);
  const w = Math.min(img.width - x, (bounds.width / 100) * img.width);
  const h = Math.min(img.height - y, (bounds.height / 100) * img.height);
  if (w < 20 || h < 20) return null;
  const MAX = 480;
  const scale = Math.min(1, MAX / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  canvas.getContext('2d').drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.9);
};

const invertCanvas = (src) => {
  const canvas = document.createElement('canvas');
  canvas.width = src.width;
  canvas.height = src.height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(src, 0, 0);
  const id = ctx.getImageData(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < id.data.length; i += 4) {
    id.data[i] = 255 - id.data[i];
    id.data[i + 1] = 255 - id.data[i + 1];
    id.data[i + 2] = 255 - id.data[i + 2];
  }
  ctx.putImageData(id, 0, 0);
  return canvas;
};

const drawStrip = (img, strip) => {
  const cropX = (strip.x / 100) * img.width;
  const cropY = (strip.y / 100) * img.height;
  const cropW = Math.max(1, (strip.width / 100) * img.width);
  const cropH = Math.max(1, (strip.height / 100) * img.height);
  const canvas = document.createElement('canvas');
  canvas.width = cropW;
  canvas.height = cropH;
  canvas.getContext('2d').drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
  return canvas;
};

// Type vocabulary for Scryfall t: queries (exact OCR word matches only)
const TYPE_VOCAB = [
  'instant', 'sorcery', 'creature', 'enchantment', 'artifact', 'land',
  'planeswalker', 'battle', 'legendary', 'basic', 'snow', 'world', 'tribal',
  'saga', 'demon', 'wizard', 'soldier', 'knight', 'dragon', 'goblin', 'elf',
  'zombie', 'vampire', 'beast', 'angel', 'spirit', 'rogue', 'warrior',
  'monk', 'druid', 'elemental', 'giant', 'cat', 'dog', 'merfolk', 'halfling',
  'human', 'treefolk', 'snake', 'spider',
];
const STOP_WORDS = new Set([
  'you', 'your', 'the', 'and', 'that', 'this', 'with', 'have', 'has',
  'can', 'may', 'not', 'are', 'was', 'all', 'for', 'but', 'its', 'into',
  'than', 'then', 'when', 'each', 'any', 'one', 'two', 'would', 'been',
]);

const CameraModal = ({ isOpen, onClose, onCardExtracted }) => {
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [processingState, setProcessingState] = useState('idle'); // idle|cropping|processing|complete
  const [ocrProgress, setOcrProgress] = useState(0);
  const [extractedData, setExtractedData] = useState(null);
  const [error, setError] = useState(null);
  const [availableCameras, setAvailableCameras] = useState([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [showCameraSelection, setShowCameraSelection] = useState(true);
  const [inputMode, setInputMode] = useState('selection'); // selection|camera|upload
  const [imageQueue, setImageQueue] = useState([]); // Queue for multiple uploaded images
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  // Backend image-match capability (fetched on open) so the UI can say when
  // it's warming up / unavailable instead of silently relying on OCR
  const [matchStatus, setMatchStatus] = useState(null);
  // Top-3 Scryfall candidates shown when OCR confidence is low (<70%)
  const [lowConfCandidates, setLowConfCandidates] = useState([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);

  // New states for improvements
  const [editableName, setEditableName] = useState('');
  const [scryfallSuggestions, setScryfallSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [cropRegion, setCropRegion] = useState(null); // {x, y, width, height}
  const [cardBounds, setCardBounds] = useState(null); // auto-detected card box (% of image)
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  // View-only pinch zoom for the crop step. `zoom` scales how the <img> is
  // DISPLAYED (CSS transform); `tx`/`ty` are pan offsets in px at the current
  // zoom. None of this changes capturedImage — drags are mapped back through
  // this transform into full-image % so cropRegion (and every OCR strip that
  // reads it) stays in full-image coordinates. rangeInput.value mirrors zoom
  // (no-op when driven programmatically), so the +/− buttons stay in sync.
  const [viewZoom, setViewZoom] = useState(1);
  const [viewPan, setViewPan] = useState({ tx: 0, ty: 0 });
  const zoomInputRef = useRef(null);
  const imgWrapRef = useRef(null);
  const pinchRef = useRef(null); // {startDist, startZoom, startPan, startMid}
  const MAX_ZOOM = 5;

  const clampPan = (tx, ty, z) => {
    const wrap = imgWrapRef.current;
    if (!wrap) return { tx, ty };
    const bw = wrap.clientWidth;
    const bh = wrap.clientHeight;
    // Overscan (how much the scaled image exceeds the viewport) per side.
    const ox = Math.max(0, (bw * (z - 1)) / 2);
    const oy = Math.max(0, (bh * (z - 1)) / 2);
    return { tx: Math.max(-ox, Math.min(ox, tx)), ty: Math.max(-oy, Math.min(oy, ty)) };
  };

  const applyZoom = (z, anchor) => {
    const nz = Math.max(1, Math.min(MAX_ZOOM, z));
    // Read the committed zoom/pan once; derive the new pan from them rather
    // than nesting a setViewPan call inside the setViewZoom updater (that's a
    // render-phase side effect and reads a stale `prev` in StrictMode).
    const prev = viewZoom;
    let ntx = viewPan.tx;
    let nty = viewPan.ty;
    if (nz === 1) {
      ntx = 0;
      nty = 0; // fully zoomed out -> recenter so no overscan offsets remain
    } else if (anchor && nz !== prev) {
      // Keep the anchor point (viewport-relative px) stationary while zooming.
      const k = nz / prev;
      ntx = anchor.x - k * (anchor.x - viewPan.tx);
      nty = anchor.y - k * (anchor.y - viewPan.ty);
    }
    const clamped = clampPan(ntx, nty, nz);
    setViewPan(clamped);
    setViewZoom(nz);
    if (zoomInputRef.current && Number(zoomInputRef.current.value) !== nz) {
      zoomInputRef.current.value = String(nz);
    }
  };

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const tesseractWorkerRef = useRef(null);
  const fileInputRef = useRef(null);
  const cropCanvasRef = useRef(null);
  const torchTrackRef = useRef(null); // camera track with the torch (flash) on

  // Reset state and enumerate cameras on mount
  useEffect(() => {
    if (isOpen) {
      // Reset all state when modal opens
      setCapturedImage(null);
      setProcessingState('idle');
      setOcrProgress(0);
      setExtractedData(null);
      setError(null);
      setShowCameraSelection(true);
      setInputMode('selection');
      setImageQueue([]);
      setCurrentImageIndex(0);
      setEditableName('');
      setScryfallSuggestions([]);
      setCropRegion(null);
      setCardBounds(null);
      setMatchStatus(null);
      setLowConfCandidates([]);
      // Surface image-match capability (Q6): non-blocking, so a slow or
      // missing index never delays the scan itself
      axios.get(`${API_URL}/image-match/status`)
        .then(r => setMatchStatus(r.data))
        .catch(() => setMatchStatus(null));
      // Enumerate cameras
      enumerateCameras();
    }

    return () => {
      // Cleanup on unmount
      if (tesseractWorkerRef.current) {
        tesseractWorkerRef.current.terminate();
        tesseractWorkerRef.current = null;
      }
      torchTrackRef.current = null; // track stop (below) also kills the torch
    };
  }, [isOpen]);

  // Stop camera tracks whenever the stream is replaced, the modal closes, or
  // we unmount. Kept out of the [isOpen] effect above on purpose: adding
  // `stream` there would re-run the state reset the moment the camera starts.
  useEffect(() => {
    if (!stream) return undefined;
    return () => {
      stream.getTracks().forEach(track => track.stop());
    };
  }, [stream, isOpen]);

  // Fetch Scryfall suggestions when editable name changes
  useEffect(() => {
    if (editableName.length >= 2) {
      const debounceTimer = setTimeout(() => {
        fetchScryfallSuggestions(editableName);
      }, 300);
      return () => clearTimeout(debounceTimer);
    } else {
      setScryfallSuggestions([]);
    }
  }, [editableName]);

  // Q5: when the name is uncertain (low confidence OR not Scryfall-verified),
  // show candidates side-by-side so the user picks instead of hoping:
  // rules-text matches first, then close art matches, then autocomplete.
  useEffect(() => {
    setLowConfCandidates([]);
    if (processingState !== 'complete' || !extractedData) return undefined;
    const needsCands = (extractedData.confidence || 0) < 70 || extractedData.nameResolved === false;
    if (!needsCands) return undefined;

    const extras = [
      ...(extractedData.textMatches || []),
      ...(extractedData.imageMatches || [])
        .filter((m) => m.confidence < 90)
        .slice(0, 2)
        .map((m) => ({ name: m.cardName, set: `matched by art (~${m.confidence}%)`, img: null, source: 'art' })),
    ];

    const query = extractedData.originalOcrName || extractedData.name;
    let cancelled = false;
    (async () => {
      setLoadingCandidates(true);
      let cands = [];
      if (query && query.length >= 2) {
        try {
          let res = await axios.get(`${API_URL}/scryfall/autocomplete?q=${encodeURIComponent(query)}`);
          let names = (res.data || []).slice(0, 3);
          // Autocomplete matches word prefixes, so ONE mangled OCR token
          // returns nothing for the whole string ("Adventurous 21" -> [])
          // while dropping it finds the real card. Without this the picker
          // stays empty exactly when the name is worst.
          for (let n = query.split(/\s+/).length - 1; n >= 1 && names.length === 0; n--) {
            const q = query.split(/\s+/).slice(0, n).join(' ').replace(/[/|—&]+$/, '').trim();
            if (q.length < 2) continue;
            res = await axios.get(`${API_URL}/scryfall/autocomplete?q=${encodeURIComponent(q)}`);
            names = (res.data || []).slice(0, 3);
          }
          cands = await Promise.all(names.map(async (n) => {
            try {
              const r = await axios.get(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(n)}`, { timeout: 6000 });
              const d = r.data;
              return {
                name: d.name,
                set: d.set_name,
                img: (d.image_uris && (d.image_uris.small || d.image_uris.normal)) ||
                     (d.card_faces && d.card_faces[0].image_uris && d.card_faces[0].image_uris.small) || null,
              };
            } catch {
              return { name: n, set: '', img: null };
            }
          }));
        } catch {
          // Keep the editable-name flow; nothing extra to show
        }
      }
      const merged = [...extras, ...cands]
        .filter((c, i, arr) => arr.findIndex((x) => x.name === c.name) === i)
        .slice(0, 4);
      if (!cancelled && merged.length > 0) setLowConfCandidates(merged);
      if (!cancelled) setLoadingCandidates(false);
    })();
    return () => { cancelled = true; };
  }, [processingState, extractedData]);

  const fetchScryfallSuggestions = async (query) => {
    if (query.length < 2) return;
    setLoadingSuggestions(true);
    try {
      const response = await axios.get(`${API_URL}/scryfall/autocomplete?q=${encodeURIComponent(query)}`);
      setScryfallSuggestions(response.data.slice(0, 5));
    } catch (err) {
      console.error('Error fetching suggestions:', err);
      setScryfallSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const enumerateCameras = async () => {
    try {
      // Request permissions first to get device labels
      await navigator.mediaDevices.getUserMedia({ video: true })
        .then(tempStream => tempStream.getTracks().forEach(track => track.stop()));

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');

      setAvailableCameras(videoDevices);

      // Always show selection screen first (with upload option)
      // Just pre-select the first camera
      if (videoDevices.length >= 1) {
        setSelectedCamera(videoDevices[0].deviceId);
      }
    } catch (err) {
      console.error('Error enumerating cameras:', err);
      // Don't set error - still allow upload option even without camera
      console.log('Camera not available, upload still works');
    }
  };

  const initializeCamera = async (deviceId) => {
    try {
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setError('Camera not supported. Please use a modern browser with HTTPS or localhost.');
        return;
      }

      // Build constraints based on whether deviceId is provided
      const constraints = {
        video: deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } }
          : { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } }
      };

      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
      setError(null);

      // Turn the flash (torch) on while scanning: dim-room photos are the
      // #1 cause of failed card detection (dark frames lose their edges).
      // Best-effort — only phones expose a torch; desktop/no-torch cameras
      // are simply left alone. The torch dies with the track on stop.
      try {
        const track = mediaStream.getVideoTracks()[0];
        const caps = track.getCapabilities ? track.getCapabilities() : {};
        if (caps && caps.torch) {
          await track.applyConstraints({ advanced: [{ torch: true }] });
          torchTrackRef.current = track;
          console.log('Camera torch on');
        }
      } catch (e) {
        console.log('Torch not available:', e.message);
      }
    } catch (err) {
      console.error('Camera access error:', err);

      // Provide specific error messages based on error type
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setError('Camera permission denied. Please click "Allow" when prompted, or enable camera permissions in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError('No camera found. Please connect a camera and try again.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is already in use by another application. Please close other apps using the camera.');
      } else if (err.name === 'SecurityError') {
        setError('Camera access blocked due to security. Make sure you are accessing via HTTPS or localhost.');
      } else {
        setError(`Camera error: ${err.message || 'Unknown error occurred'}`);
      }
    }
  };

  const handleStartCamera = () => {
    if (!selectedCamera) {
      setError('Please select a camera first.');
      return;
    }
    setShowCameraSelection(false);
    setInputMode('camera');
    initializeCamera(selectedCamera);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    // Validate all files are images
    const invalidFiles = files.filter(f => !f.type.startsWith('image/'));
    if (invalidFiles.length > 0) {
      setError(`Some files are not images: ${invalidFiles.map(f => f.name).join(', ')}`);
      return;
    }

    // Read all files and store in queue
    const readPromises = files.map(file => {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve({ name: file.name, data: e.target.result });
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
        reader.readAsDataURL(file);
      });
    });

    Promise.all(readPromises)
      .then(images => {
        setImageQueue(images);
        setCurrentImageIndex(0);
        setShowCameraSelection(false);
        setInputMode('upload');
        // Crop mode with a smart default region (auto-detects the card)
        prepareCropping(images[0].data);
      })
      .catch(err => {
        setError(err.message || 'Failed to read one or more files.');
      });

    // Reset the input so the same files can be selected again
    event.target.value = '';
  };

  const handleNextImage = () => {
    const nextIndex = currentImageIndex + 1;
    if (nextIndex < imageQueue.length) {
      setCurrentImageIndex(nextIndex);
      setExtractedData(null);
      setEditableName('');
      setScryfallSuggestions([]);
      setOcrProgress(0);
      prepareCropping(imageQueue[nextIndex].data);
    }
  };

  const handleUseDataAndNext = () => {
    if (editableName || extractedData?.name) {
      // Queue mode is bulk: CollectionView appends to the scan batch instead
      // of filling the single-card form, and keeps the modal open.
      onCardExtracted({
        ...extractedData,
        name: editableName || extractedData?.name
      }, { batch: true, close: false });
    }
    handleNextImage();
  };

  const handleAddToBatch = () => {
    if (!editableName && !extractedData?.name) return;
    onCardExtracted({
      ...extractedData,
      name: editableName || extractedData?.name
    }, { batch: true, close: false });
    // Stay in the scanner for the next card (bulk scan loop)
    if (imageQueue.length > 1) handleNextImage();
    else retryCapture();
  };

  const captureImage = () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;

    if (!video || !canvas) {
      setError('Camera not ready. Please try again.');
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);

    const imageData = canvas.toDataURL('image/png');
    setCapturedImage(imageData);

    // Stop camera to save resources
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }

    // Crop mode with a smart default region (auto-detects the card)
    prepareCropping(imageData);
  };

  // Enter crop mode and pick a smart default name region: auto-detect the
  // card box and aim at its name bar (top ~4-16% of the card). Falls back
  // to the old top-of-image strip when no card is detected.
  const prepareCropping = (dataUrl) => {
    setCapturedImage(dataUrl);
    setProcessingState('cropping');
    setCardBounds(null);
    setCropRegion({ x: 5, y: 2, width: 70, height: 10 }); // fallback
    // Each new capture starts from a fresh, un-zoomed view (bulk-scan loop
    // skips retryCapture, so this is the only place it's guaranteed).
    setViewZoom(1);
    setViewPan({ tx: 0, ty: 0 });
    if (zoomInputRef.current) zoomInputRef.current.value = '1';
    const img = new Image();
    img.onload = () => {
      const bounds = detectCardBounds(img);
      setCardBounds(bounds);
      // Even when detection fails, aim the name strip at a card-shaped
      // box instead of a fixed sliver at the top of the frame.
      // The strip is ~2.5cm of real card tall (2%..30%): the name bar on
      // old frames sits low and a tight strip cut letters off (field report)
      const base = bounds || cardFallbackBounds(img);
      setCropRegion({
        x: Math.max(0, base.x + 1),
        y: base.y + 0.02 * base.height,
        width: Math.max(10, base.width - 2),
        height: 0.28 * base.height,
      });
    };
    img.src = dataUrl;
  };

  // Enhanced image preprocessing with sharpening and adaptive contrast
  const preprocessImage = (canvas) => {
    const ctx = canvas.getContext('2d');
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    const width = canvas.width;
    const height = canvas.height;

    // Step 1: Convert to grayscale
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }

    // Step 2: Calculate histogram for adaptive contrast
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) {
      histogram[Math.floor(data[i])]++;
    }

    // Step 3: Calculate cumulative distribution for histogram equalization
    const cdf = new Array(256).fill(0);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }

    const totalPixels = width * height;
    const cdfMin = cdf.find(v => v > 0);

    // Step 4: Apply histogram equalization (adaptive contrast)
    for (let i = 0; i < data.length; i += 4) {
      const oldValue = Math.floor(data[i]);
      const newValue = Math.round(((cdf[oldValue] - cdfMin) / (totalPixels - cdfMin)) * 255);
      data[i] = newValue;
      data[i + 1] = newValue;
      data[i + 2] = newValue;
    }

    ctx.putImageData(imageData, 0, 0);

    // Step 5: Apply unsharp mask (sharpening)
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = width;
    tempCanvas.height = height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(canvas, 0, 0);

    // Blur the image
    tempCtx.filter = 'blur(1px)';
    tempCtx.drawImage(tempCanvas, 0, 0);
    tempCtx.filter = 'none';

    const blurredData = tempCtx.getImageData(0, 0, width, height);
    const sharpData = ctx.getImageData(0, 0, width, height);

    // Unsharp mask: original + (original - blurred) * amount
    const amount = 0.5;
    for (let i = 0; i < sharpData.data.length; i += 4) {
      const diff = sharpData.data[i] - blurredData.data[i];
      const newValue = Math.max(0, Math.min(255, sharpData.data[i] + diff * amount));
      sharpData.data[i] = newValue;
      sharpData.data[i + 1] = newValue;
      sharpData.data[i + 2] = newValue;
    }

    ctx.putImageData(sharpData, 0, 0);

    // Step 6: Apply threshold for text (binarization)
    const finalData = ctx.getImageData(0, 0, width, height);
    const threshold = 128;
    for (let i = 0; i < finalData.data.length; i += 4) {
      const value = finalData.data[i] > threshold ? 255 : 0;
      finalData.data[i] = value;
      finalData.data[i + 1] = value;
      finalData.data[i + 2] = value;
    }

    ctx.putImageData(finalData, 0, 0);

    return canvas;
  };

  // Lazily create the shared Tesseract worker. No fixed whitelist/PSM here:
  // rules text needs punctuation and each call picks its own page-seg mode.
  const ensureWorker = async () => {
    if (!tesseractWorkerRef.current) {
      const worker = await createWorker('eng');
      await worker.setParameters({ preserve_interword_spaces: '1' });
      tesseractWorkerRef.current = worker;
    }
    return tesseractWorkerRef.current;
  };

  // One OCR attempt on a variant of the canvas: raw (usually best),
  // preprocessed (grayscale + equalize + sharpen + threshold), or inverted.
  const ocrAttempt = async (canvas, psm, variant) => {
    const worker = await ensureWorker();
    await worker.setParameters({ tessedit_pageseg_mode: psm });
    let target = canvas;
    if (variant === 'pre') {
      const c = document.createElement('canvas');
      c.width = canvas.width;
      c.height = canvas.height;
      c.getContext('2d').drawImage(canvas, 0, 0);
      preprocessImage(c);
      target = c;
    } else if (variant === 'inv') {
      target = invertCanvas(canvas);
    }
    return worker.recognize(target);
  };

  // Best-of attempts for a name-bar strip -> { cardName, confidence }.
  // Preprocessing can hurt on stylized name fonts (measured: raw read
  // "Simmon GF 1 0F" @12 vs preprocessed "Summon GE 00" @4), so try all
  // three and keep whichever Tesseract is most sure of.
  const ocrStrip = async (canvas) => {
    let best = null;
    for (const psm of ['7', '6']) {
      for (const variant of ['raw', 'pre', 'inv']) {
        try {
          const res = await ocrAttempt(canvas, psm, variant);
          const text = (res.data.text || '').trim().replace(/\s+/g, ' ');
          if (!text) continue;
          const confidence = res.data.confidence || 0;
          if (!best || confidence > best.confidence) {
            const cardName = text
              .replace(/[^a-zA-Z0-9\s,'\-.—&/]/g, ' ')
              .replace(/\s+/g, ' ')
              .trim();
            best = { cardName, confidence };
          }
        } catch (e) {
          // try the next variant
        }
      }
      if (best && best.confidence >= 60) break; // good enough
    }
    return best || { cardName: '', confidence: 0 };
  };

  // Best-of OCR block for a rectangular region -> tesseract-like result
  // ({ data: { text, confidence } }) with the most confident variant.
  const ocrBlock = async (canvas, psm) => {
    let best = null;
    for (const variant of ['raw', 'pre', 'inv']) {
      try {
        const res = await ocrAttempt(canvas, psm, variant);
        if (!best || (res.data.confidence || 0) > (best.data.confidence || 0)) best = res;
        if ((best.data.confidence || 0) >= 70) break; // raw measured 81-95 here
      } catch (e) {
        // try the next variant
      }
    }
    return best || { data: { text: '', confidence: 0 } };
  };

  const processCroppedRegion = async () => {
    if (!cropRegion || !capturedImage) return;

    setProcessingState('processing');
    setOcrProgress(0);

    try {
      const img = new Image();
      img.onload = async () => {
        try {
          // Best guess up front (detection box, else derived from the user's
          // strip) — the image-match hash below starts in parallel with the
          // strip loop, so it must crop before any strip has been read. The
          // refined bounds used for rules/art verification are computed after
          // the strip loop (a name bar found above the latched box wins).
          const initialBounds = cardBounds || boundsFromNameStrip(cropRegion, img);

          // Image match runs in parallel with the OCR strip loop below,
          // hashing only the detected card box (not the photo background)
          const cropData = cardCropForMatch(img, initialBounds);
          const imageMatchPromise = runImageMatch(cropData || capturedImage)
            .catch((e) => ({ matches: [], error: e.message }));

          // Selected region first, then fallback strips so a misaligned
          // region (e.g. photo with background above the card) still scans.
          // The above-the-box strips only run when the in-box strips found
          // nothing, keeping the happy path fast.
          const { primary, extended } = buildOcrStrips(cropRegion, cardBounds);
          let best = null;

          const scanStrips = async (strips, offset, span, phase) => {
            for (let i = 0; i < strips.length; i++) {
              setOcrProgress(15 + Math.round(((offset + i) / span) * 55));
              const stripCanvas = drawStrip(img, strips[i]);
              const strip = await ocrStrip(stripCanvas);
              if (!strip.cardName && strip.confidence < 25) continue; // pure noise
              // Most strips are background or art, so their "name" is garbage
              // ("Pe - a om", "ny gq"). Querying Scryfall for every one of
              // them burns the rate limit on lookups that cannot match, which
              // then 429s the strips that DO hold the name. Skip anything
              // without two real words, or that is mostly digits.
              const nameWords = strip.cardName.split(/\s+/).filter((w) => /^[A-Za-z][A-Za-z',.-]*$/.test(w) && w.length >= 3);
              if (nameWords.length < 2) continue;
              const match = await resolveName(strip.cardName);
              const candidate = {
                ...strip,
                resolved: match ? match.name : null,
                partial: !!(match && !match.exact),
                stripRect: strips[i],
                phase,
              };
              // Rank: proven (exact) match > plausible (partial) match > raw
              // OCR confidence. A partial match must not shadow an exact one.
              const rank = (c) => (c.resolved ? (c.partial ? 1 : 2) : 0);
              if (
                !best ||
                rank(candidate) > rank(best) ||
                (rank(candidate) === rank(best) && candidate.confidence > best.confidence)
              ) {
                best = candidate;
              }
              if (candidate.resolved && !candidate.partial && strip.confidence >= 55) break; // confident + matched
            }
          };

          const totalStrips = primary.length + extended.length;
          // A PARTIAL match is a guess off a mangled strip ("Adventurous 21"
          // -> "Adventurous Impulse"); only an EXACT match means we really read
          // the name bar. Gating on any match skipped the above-the-box phase,
          // so a dark card whose art box was mis-detected never got its real
          // name bar read and resolved to a wrong card that shares the prefix.
          const haveExact = () => !!best && best.resolved && !best.partial;
          await scanStrips(primary, 0, totalStrips, 'primary');
          if (!haveExact() && extended.length > 0) {
            await scanStrips(extended, primary.length, totalStrips, 'extended');
          }

          if (!best) best = { cardName: '', confidence: 0, resolved: null, partial: false };

          // A name bar found ABOVE the detected box means detection latched
          // onto the art rectangle (dark frame in dim light). Trust the strip
          // instead and re-derive the card box from it — with the latched box,
          // rules-text / type-line / art reads all came off the art region and
          // recovery could never work (field report: prepare/adventure card).
          const stripDerived =
            best.phase === 'extended' && best.stripRect
              ? boundsFromNameStrip(best.stripRect, img)
              : null;
          const effectiveBounds = stripDerived || cardBounds || boundsFromNameStrip(cropRegion, img);

          // Collector number from the card's bottom-left when we know the box
          const collectorNumber = await extractCollectorNumber(img, effectiveBounds);

          setOcrProgress(90);
          await processWithOCR(
            {
              cardName: best.cardName,
              matchedName: best.resolved || best.cardName,
              resolved: best.resolved,
              partial: best.partial,
              collectorNumber,
              confidence: best.confidence,
            },
            imageMatchPromise,
            img,
            effectiveBounds
          );
        } catch (err) {
          setError(`Processing failed: ${err.message}`);
          setProcessingState('cropping');
        }
      };
      img.src = capturedImage;
    } catch (err) {
      setError(`Processing failed: ${err.message}`);
      setProcessingState('cropping');
    }
  };

  const processWithOCR = async (ocrResult, imageMatchPromise, fullImg, bounds) => {
    try {
      // OCR already ran (with fallback strips); wait for image matching
      const imageMatchResult = await imageMatchPromise;

      setOcrProgress(95);

      let finalName = ocrResult.matchedName || ocrResult.cardName || '';
      let finalConfidence = ocrResult.confidence || 0;
      let matchSource = 'ocr';
      let nameResolved = !!ocrResult.resolved && !ocrResult.partial;

      // Image match is trustworthy only when it is CLOSE (distance <= 12 of
      // 128 bits; calibration: same card <= 5, any other card >= 27) and
      // UNAMBIGUOUS (well clear of the next different card), and only when
      // OCR could not resolve the name itself. v1 accepted anything at ~77%
      // and hijacked scans with confident garbage ("Elephant Grass").
      const imageMatches = imageMatchResult.matches || [];
      const bestImageMatch = imageMatches[0];
      if (bestImageMatch) {
        const runnerUp = imageMatches.find((m) => m.cardName !== bestImageMatch.cardName);
        const margin = runnerUp ? bestImageMatch.distance - runnerUp.distance : 99;
        const acceptImage =
          !nameResolved &&
          bestImageMatch.confidence >= 90 &&
          bestImageMatch.distance <= 12 &&
          margin >= 4;
        console.log('Image match result:', bestImageMatch, 'margin:', margin, 'accepted:', acceptImage);
        if (acceptImage) {
          finalName = bestImageMatch.cardName;
          finalConfidence = Math.max(finalConfidence, bestImageMatch.confidence);
          matchSource = 'image';
          nameResolved = true;
        }
      }

      // If still no name from either method, try Scryfall with whatever we have
      if (!finalName && ocrResult.cardName) {
        try {
          const response = await axios.get(`${API_URL}/scryfall/autocomplete?q=${encodeURIComponent(ocrResult.cardName)}`);
          if (response.data && response.data.length > 0) {
            finalName = response.data[0];
            matchSource = 'scryfall';
            nameResolved = true;
          }
        } catch (e) {
          console.log('Scryfall fallback failed');
        }
      }

      // Rules-text recovery (proven on a real tilted scan): when neither the
      // name bar nor art hashing resolved the card, read the rules box and
      // type line — standard fonts — and search Scryfall by oracle text.
      let textMatches = [];
      if (!nameResolved) {
        setOcrProgress(97);
        textMatches = await searchByCardText(fullImg, bounds);
        if (textMatches.length > 0) {
          finalName = textMatches[0].name;
          // Tied candidates = identical printed rules text (Kraken's Eye /
          // Crystal Rod); stay below the 70% candidates-panel threshold so
          // the picker shows instead of auto-accepting an arbitrary pick
          finalConfidence = Math.max(finalConfidence, textMatches[0].tied ? 65 : 78);
          matchSource = 'text';
          nameResolved = true;

          // Art-verify the shortlist against Scryfall's official scans
          // (fetched live, so this works for cards NOT in the collection).
          // Rules-text twins (Kraken's Eye / Crystal Rod) have different
          // art, so a confident art hit breaks the tie and confirms the
          // pick; same-card <= 5 bits, different cards >= 27 (128-bit sum).
          const artCrop = cardCropForMatch(fullImg, bounds);
          if (artCrop) {
            try {
              const artRes = await axios.post(
                `${API_URL}/image-match/candidates`,
                { imageData: artCrop, names: textMatches.map((t) => t.name) },
                { timeout: 30000 }
              );
              const art = (artRes.data.matches || []).filter((m) => m.distance < Infinity);
              const bestArt = art[0];
              const runnerArt = art.find((m) => m.name !== bestArt?.name);
              // Two accept tiers: <=24 matches the clean-photo calibration;
              // angled/low-res phone photos of the same card measure up to
              // ~40 (measured 38 on a real scan) — those need a decisive
              // margin over the runner-up instead
              const artAccept =
                bestArt &&
                (bestArt.distance <= 24 ||
                  (bestArt.distance <= 50 &&
                    (!runnerArt || bestArt.distance + 12 <= runnerArt.distance)));
              if (artAccept) {
                const winner = textMatches.find((t) => t.name === bestArt.name);
                if (winner) {
                  textMatches = [winner, ...textMatches.filter((t) => t.name !== winner.name)];
                }
                finalName = bestArt.name;
                finalConfidence = Math.max(finalConfidence, 85);
                matchSource = 'text+art';
              }
            } catch (e) {
              console.log('Art verification unavailable:', e.message);
            }
          }
        }
      }

      setExtractedData({
        name: finalName,
        originalOcrName: ocrResult.cardName || '',
        collectorNumber: ocrResult.collectorNumber,
        confidence: finalConfidence,
        matchSource,
        nameResolved,
        textMatches,
        imageMatches: imageMatchResult.matches || []
      });
      setEditableName(finalName);

      setOcrProgress(100);
      setProcessingState('complete');
    } catch (error) {
      console.error('Processing error:', error);
      setError(`Processing failed: ${error.message || error.toString()}`);
      setProcessingState('cropping');
    }
  };

      // "Search by card text": OCR the rules box AND the type line, then run
  // type-constrained Scryfall oracle-text searches. The rules font is always
  // standard even when the name line is stylized, and t:terms collapse
  // hundreds of phrase matches to a handful — measured on a real scan:
  // "discard a card" went 600+ results -> 10 with t:enchantment t:creature,
  // and contiguous-phrase ranking put the real card #1 (verified: PASS).
  const searchByCardText = async (img, bounds) => {
    try {
      const base = bounds || cardFallbackBounds(img);

      // Rules box: 20%..78% of the card height
      const rulesCanvas = drawStrip(img, {
        x: base.x + 0.04 * base.width,
        y: base.y + 0.2 * base.height,
        width: 0.92 * base.width,
        height: 0.58 * base.height,
      });
      const rulesRes = await ocrBlock(rulesCanvas, '3');

      // Type line, measured on real card faces (488px Scryfall scans): normal
      // and old frames print it around 66%, but prepare/adventure frames
      // print it at ~58%, so a band anchored only at 0.66 lands in the rules
      // text on those. 0.55..0.68 covers every frame (verified: creature on
      // the prepare card, artifact on Sol Ring, instant on Lightning Bolt) and
      // is thin enough to never reach the rules box. Read both bands and
      // prefer the one that looks like a real type line (has the "—" separator);
      // the adventure box's "Sorcery" label otherwise slips a wrong t: term
      // into the search and kills every query. PSM 11 is the fallback that
      // actually catches short type lines like "Artifact" off artifact frames.
      const typeBands = [
        { y: 0.55, height: 0.13 },
        { y: 0.66, height: 0.12 },
      ];
      const typeReads = [];
      for (const band of typeBands) {
        const canvas = drawStrip(img, {
          x: base.x + 0.05 * base.width,
          y: base.y + band.y * base.height,
          width: 0.9 * base.width,
          height: band.height * base.height,
        });
        // PSM 7 reads the type line cleanly on most frames but returns
        // non-empty garbage on some (Sol Ring: "\\ Arfiact"), so ocrBlock's
        // best-of-variant result can never be "empty" for the fallbacks to
        // trigger on. Collect every PSM and let the term scan below pick the
        // read that actually yielded type words.
        for (const psm of ['7', '6', '11']) {
          const text = ((await ocrBlock(canvas, psm)).data.text || '').trim();
          if (text) typeReads.push(text);
        }
      }
      const typeTermsOf = (t) => [
        ...new Set(
          t
            .toLowerCase()
            .replace(/[^a-z\s—-]/g, ' ')
            .split(/\s+/)
            .filter((w) => TYPE_VOCAB.includes(w))
        ),
      ];
      // Prefer a read that carries the "—" type-line separator; else the read
      // with the most type words. The adventure box's own "Sorcery" label sits
      // in the rules box below the line, so a stray t: term from it would
      // poison every query.
      const dashedType = typeReads.find(
        (t) => (t.includes('—') || t.includes('–') || t.includes('--')) && typeTermsOf(t).length > 0
      );
      let typeTerms = typeTermsOf(dashedType || typeReads[0] || '');
      for (const t of typeReads) {
        const terms = typeTermsOf(t);
        if (terms.length > typeTerms.length) typeTerms = terms;
      }
      typeTerms = typeTerms.slice(0, 2);

      // Keep short words: oracle phrases are contiguous ("You may discard a
      // card...") and dropping "may/if/do" broke every window (measured)
      const words = (rulesRes.data.text || '')
        .replace(/[^A-Za-z',\s-]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 1);
      if (words.length < 5) return [];

      const distinct = words.filter((w) => w.length >= 4 && !STOP_WORDS.has(w.toLowerCase()));
      if (distinct.length < 2) return [];

      // 3-word phrase windows containing a distinctive word; short exact
      // phrases survive a dropped OCR word far better than long ones
      const phrases = [];
      for (let i = 0; i + 2 < words.length; i++) {
        const trio = words.slice(i, i + 3);
        if (trio.some((x) => x.length >= 4 && !STOP_WORDS.has(x.toLowerCase()))) {
          phrases.push(trio.join(' '));
        }
      }
      if (phrases.length === 0) return [];
      const stride = Math.max(1, Math.ceil(phrases.length / 6));
      const windows = phrases.filter((_, i) => i % stride === 0).slice(0, 6);

      const runQuery = async (q) => {
        await new Promise((r) => setTimeout(r, 150)); // Scryfall rate limit
        try {
          const res = await axios.get(`https://api.scryfall.com/cards/search?q=${encodeURIComponent(q)}`, {
            timeout: 6000,
          });
          return (res.data && res.data.data) || [];
        } catch (e) {
          return []; // 404 = no results
        }
      };

      // Modern oracle rewrites old printed wording ("plays" -> "casts",
      // "comes into play" -> "enters the battlefield"). Without this,
      // pre-8th-edition cards can't match their own printed text: a
      // Kraken's Eye scan returned "Ambiguity" in the field because
      // o:"plays a blue" finds nothing while Ambiguity kept "plays".
      const toCastWording = (s) =>
        s.toLowerCase().replace(/\bplays\b/g, 'casts').replace(/\bplay\b/g, 'cast');
      // Match both sides in one normalized space so hits count regardless
      // of which era's wording Scryfall stores
      const normWording = (s) =>
        s.toLowerCase().replace(/\bcasts\b/g, 'plays').replace(/\bcast\b/g, 'play');
      // Query ORs the window with its cast-wording variant (both spellings
      // of the same printed line)
      const windowQuery = (w, prefix) => {
        const alt = toCastWording(w);
        const clauses = alt === w.toLowerCase() ? `o:"${w}"` : `(o:"${w}" or o:"${alt}")`;
        return `game:paper ${prefix}${clauses}`;
      };

      const pool = new Map();
      // Evidence weight per window: a window matching 175 cards ("you may
      // gain") proves far less than one matching 3. IDF weighting stops
      // generic phrase noise from picking arbitrary winners between scans.
      const windowCount = new Map();

      // Verification signals beyond the phrase text itself: the detected
      // type-line words and (best-effort) the printed mana value. Type
      // words rarely misread; mana symbols rarely OCR cleanly, so a
      // letter-based mana read only ever adds bonus, never penalty.
      let manaValue = null;
      let costDigitOnly = false;
      try {
        const costCanvas = drawStrip(img, {
          x: base.x + 0.55 * base.width,
          y: base.y + 0.005 * base.height,
          width: 0.44 * base.width,
          height: 0.13 * base.height,
        });
        const costText = (await ocrBlock(costCanvas, '7')).data.text || '';
        const compact = costText.replace(/\s+/g, '');
        if (compact.length > 0 && compact.length <= 8 && /^[0-9wubrgWUBRG]+$/.test(compact)) {
          const digits = [...compact].filter((c) => c >= '0' && c <= '9');
          const symbols = [...compact].filter((c) => 'wubrgWUBRG'.includes(c));
          const total = digits.reduce((s, d) => s + parseInt(d, 10), 0) + symbols.length;
          if (total > 0) {
            manaValue = total;
            costDigitOnly = symbols.length === 0;
          }
        }
      } catch (e) {
        // mana verification is best-effort
      }

      const verifyAdjust = (card) => {
        let adj = 0;
        for (const t of typeTerms) {
          if ((card.type_line || '').toLowerCase().includes(t)) adj += 0.4;
        }
        if (manaValue != null && typeof card.cmc === 'number') {
          const diff = Math.abs(card.cmc - manaValue);
          if (diff === 0) adj += 0.6;
          else if (diff >= 2 && costDigitOnly) adj -= 0.6;
        }
        return adj;
      };

      const ingest = (data) => {
        for (const card of data) {
          const oracle = normWording(
            `${card.oracle_text || ''} ${(card.card_faces || []).map((f) => f.oracle_text || '').join(' ')} ${card.name}`
          );
          const hits = phrases.filter((p) => oracle.includes(normWording(p))).length;
          const score = phrases.reduce(
            (sum, p) =>
              sum +
              (oracle.includes(normWording(p))
                ? 1 / Math.sqrt(Math.max(1, windowCount.get(p) || 1))
                : 0),
            0
          ) + verifyAdjust(card);
          const prev = pool.get(card.name);
          if (!prev || score > prev.score) pool.set(card.name, { hits, score, card });
        }
      };

      // Type-constrained first; plain phrases only when that found nothing
      let anyTypeResults = false;
      const typePrefix = typeTerms.map((t) => `t:${t}`).join(' ') + ' ';
      if (typeTerms.length >= 1) {
        for (const w of windows.slice(0, 4)) {
          const data = await runQuery(windowQuery(w, typePrefix));
          windowCount.set(w, data.length);
          if (data.length > 0) anyTypeResults = true;
          ingest(data);
        }
      }
      if (!anyTypeResults) {
        windowCount.clear();
        for (const w of windows) {
          const data = await runQuery(windowQuery(w, ''));
          windowCount.set(w, data.length);
          ingest(data);
        }
      }

      const minHits = typeTerms.length >= 1 && anyTypeResults ? 1 : 2;
      const ranked = [...pool.values()]
        .filter((x) => x.hits >= minHits)
        .sort((a, b) => b.score - a.score || b.hits - a.hits)
        .slice(0, 3);
      // A tie at the top means genuinely identical rules text (e.g.
      // Kraken's Eye vs Crystal Rod); flag it so the caller shows the
      // candidate picker instead of auto-picking an arbitrary one
      const tied = ranked.length > 1 && ranked[0].score - ranked[1].score < 0.05;
      return ranked.map((x, i) => ({
        name: x.card.name,
        set: typeTerms.length >= 1 ? `matched by card text (t:${typeTerms.join(' t:')})` : 'matched by card text',
        img:
          (x.card.image_uris && (x.card.image_uris.small || x.card.image_uris.normal)) ||
          (x.card.card_faces && x.card.card_faces[0].image_uris && x.card.card_faces[0].image_uris.small) ||
          null,
        source: 'text',
        tied: i === 0 && tied,
      }));
    } catch (e) {
      console.log('Rules-text search failed:', e.message);
      return [];
    }
  };

  // Fuzzy-match OCR text against Scryfall; null when nothing plausible.
  // Returns { name, exact }: exact=false means the hit came from a shortened
  // or half query (plausible, not proven) — the caller keeps it as the name
  // but lets rules-text / art recovery still confirm or override it.
  const resolveName = async (cardName) => {
    if (!cardName || cardName.length < 3) return null;
    const fetchTop = async (query) => {
      // A scan fires one lookup per candidate strip, and most strips are OCR
      // noise, so a single scan can burst well past Scryfall's rate limit.
      // On 429 back off and retry instead of silently returning null — which
      // reads as "no match" and demotes a card we could have resolved.
      for (let attempt = 0; ; attempt++) {
        try {
          const response = await axios.get(`${API_URL}/scryfall/autocomplete?q=${encodeURIComponent(query)}`);
          return (response.data || [])[0] || null;
        } catch (e) {
          const status = e.response && e.response.status;
          if (status === 429 && attempt < 2) {
            await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
            continue;
          }
          console.log('Scryfall lookup failed, using raw OCR result');
          return null;
        }
      }
    };
    // Require the match to start with the same first letters so noise
    // from a bad region can't hijack the result
    const plausible = (top, query) =>
      !!top && top.toLowerCase().includes(query.toLowerCase().substring(0, 3));

    let top = await fetchTop(cardName);
    if (plausible(top, cardName)) return { name: top, exact: true };

    // Autocomplete matches on word prefixes, so ONE mangled trailing token
    // returns nothing for the whole string ("Adventurous 21" -> no hits,
    // while "Adventurous" -> the real card). Retry with successively fewer
    // trailing words — OCR routinely garbles the last word of a name.
    const words = cardName.split(/\s+/);
    for (let n = words.length - 1; n >= Math.max(1, words.length - 3); n--) {
      const q = words.slice(0, n).join(' ').replace(/[/|—&]+$/, '').trim();
      if (q.length < 3) continue;
      top = await fetchTop(q);
      if (plausible(top, q)) return { name: top, exact: false };
    }

    // The name bar leads with the set-symbol glyph, which OCR reads as junk
    // ("Ul Adventurous Eater"). Prefix matching then fails on the whole string
    // even though the card name is intact, so retry from each later word start.
    // The match must still be a prefix of that suffix, and it is only a guess,
    // so it is never marked exact — rules-text / art recovery still confirm.
    for (let start = 1; start <= Math.min(3, words.length - 1); start++) {
      const q = words.slice(start).join(' ').replace(/^[/|—&]+/, '').trim();
      if (q.length < 3) continue;
      top = await fetchTop(q);
      if (top && top.toLowerCase().startsWith(q.toLowerCase().substring(0, 3))) {
        return { name: top, exact: false };
      }
    }

    // Split / room / prepare layouts print TWO names on one bar
    // ("Fire // Ice", "Murky Attic | Smoky Studio"); the whole string rarely
    // fuzzy-matches, so try each half — preferring the combined
    // "A // B" name when Scryfall offers one for that half.
    if (/[/|—]/.test(cardName)) {
      for (const part of cardName.split(/[/|—]/)) {
        const half = part.trim();
        if (half.length < 3) continue;
        // Stricter than the full-name guard: a 3-letter half that merely
        // APPEARS inside another name is common noise ("lce" -> "Ulcerate")
        const hit = await fetchTop(half);
        if (hit && hit.toLowerCase().startsWith(half.toLowerCase().substring(0, 3))) {
          if (hit.includes('//')) return { name: hit, exact: true };
          try {
            const r = await axios.get(
              `https://api.scryfall.com/cards/search?q=${encodeURIComponent(`!"${hit}"`)}`,
              { timeout: 6000 }
            );
            const combined = ((r.data && r.data.data) || []).find(
              (c) => c.name.includes('//') && c.name.toLowerCase().startsWith(half.toLowerCase().substring(0, 3))
            );
            if (combined) return { name: combined.name, exact: true };
          } catch (e) {
            // 404 = no combined card for this half; the single-half name stands
          }
          return { name: hit, exact: false };
        }
      }
    }
    return null;
  };

  // Collector number: bottom-left of the detected card box, else of the frame
  const extractCollectorNumber = async (img, bounds) => {
    const worker = tesseractWorkerRef.current;
    if (!worker) return null;
    const fullCanvas = document.createElement('canvas');
    fullCanvas.width = img.width;
    fullCanvas.height = img.height;
    fullCanvas.getContext('2d').drawImage(img, 0, 0);
    const region = bounds
      ? {
          left: Math.floor((img.width * bounds.x) / 100),
          top: Math.floor((img.height * (bounds.y + 0.9 * bounds.height)) / 100),
          width: Math.floor((img.width * 0.3 * bounds.width) / 100),
          height: Math.floor((img.height * 0.08 * bounds.height) / 100),
        }
      : {
          left: Math.floor(img.width * 0.05),
          top: Math.floor(img.height * 0.88),
          width: Math.floor(img.width * 0.25),
          height: Math.floor(img.height * 0.08),
        };
    try {
      const collectorResult = await worker.recognize(fullCanvas, { rectangle: region });
      const collectorMatch = collectorResult.data.text.match(/(\d+)\/(\d+)/);
      return collectorMatch ? collectorMatch[1] : null;
    } catch (e) {
      console.log('Could not extract collector number');
      return null;
    }
  };

  // Run image matching against cached card images
  const runImageMatch = async (imageData) => {
    try {
      const response = await axios.post(`${API_URL}/image-match`, {
        imageData
      }, {
        timeout: 10000 // 10 second timeout
      });
      console.log('Image match response:', response.data);
      return response.data;
    } catch (error) {
      console.log('Image matching unavailable:', error.message);
      return { matches: [], error: error.message };
    }
  };

  // Convert a viewport-relative point (px within the wrapper) to full-image
  // %, accounting for the view zoom/pan transform. This is the bridge that
  // lets pinch-zoom change only the display while cropRegion stays correct.
  const viewportToImagePct = (clientX, clientY, rect) => {
    const vx = clientX - rect.left;
    const vy = clientY - rect.top;
    const ix = (vx - viewPan.tx) / viewZoom;
    const iy = (vy - viewPan.ty) / viewZoom;
    return { x: (ix / rect.width) * 100, y: (iy / rect.height) * 100 };
  };

  const beginBox = (clientX, clientY, rect) => {
    const p = viewportToImagePct(clientX, clientY, rect);
    setDragStart(p);
    setIsDragging(true);
  };

  const updateBox = (clientX, clientY, rect) => {
    if (!isDragging || !dragStart) return;
    const p = viewportToImagePct(clientX, clientY, rect);
    const newRegion = {
      x: Math.min(dragStart.x, p.x),
      y: Math.min(dragStart.y, p.y),
      width: Math.abs(p.x - dragStart.x),
      height: Math.abs(p.y - dragStart.y),
    };
    // Clamp values
    newRegion.x = Math.max(0, Math.min(100 - newRegion.width, newRegion.x));
    newRegion.y = Math.max(0, Math.min(100 - newRegion.height, newRegion.y));
    newRegion.width = Math.min(100 - newRegion.x, newRegion.width);
    newRegion.height = Math.min(100 - newRegion.y, newRegion.height);
    setCropRegion(newRegion);
  };

  const handleCropMouseDown = (e) => beginBox(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  const handleCropMouseMove = (e) => updateBox(e.clientX, e.clientY, e.currentTarget.getBoundingClientRect());
  const handleCropMouseUp = () => { setIsDragging(false); setDragStart(null); };

  // --- Touch: 1 finger pans (when zoomed), 2 fingers pinch-zoom --------
  const handleTouchStart = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    if (e.touches.length === 2) {
      e.preventDefault();
      setIsDragging(false);
      setDragStart(null);
      const [t0, t1] = e.touches;
      pinchRef.current = {
        startDist: Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY),
        startZoom: viewZoom,
        startPan: { ...viewPan },
        startMid: {
          x: (t0.clientX + t1.clientX) / 2 - rect.left,
          y: (t0.clientY + t1.clientY) / 2 - rect.top,
        },
      };
    } else if (e.touches.length === 1) {
      if (viewZoom > 1) {
        // Zoomed in: pan instead of drawing a box (draw stays on desktop).
        e.preventDefault();
        setIsDragging(false);
        pinchRef.current = {
          panOnly: true,
          startMid: { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top },
          startPan: { ...viewPan },
        };
      } else {
        beginBox(e.touches[0].clientX, e.touches[0].clientY, rect);
      }
    }
  };

  const handleTouchMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pin = pinchRef.current;
    if (e.touches.length === 2 && pin && !pin.panOnly) {
      e.preventDefault();
      const [t0, t1] = e.touches;
      const dist = Math.hypot(t1.clientX - t0.clientX, t1.clientY - t0.clientY);
      if (pin.startDist > 0) applyZoom((pin.startZoom * dist) / pin.startDist, pin.startMid);
    } else if (e.touches.length === 1 && pin && pin.panOnly) {
      e.preventDefault();
      const nx = e.touches[0].clientX - rect.left - pin.startMid.x;
      const ny = e.touches[0].clientY - rect.top - pin.startMid.y;
      setViewPan(clampPan(pin.startPan.tx + nx, pin.startPan.ty + ny, viewZoom));
    } else if (e.touches.length === 1 && isDragging) {
      e.preventDefault();
      updateBox(e.touches[0].clientX, e.touches[0].clientY, rect);
    }
  };

  const handleTouchEnd = (e) => {
    if (e.touches.length < 2 && pinchRef.current && !pinchRef.current.panOnly) pinchRef.current = null;
    if (e.touches.length === 0) { setIsDragging(false); setDragStart(null); }
  };

  const retryCapture = () => {
    setCapturedImage(null);
    setExtractedData(null);
    setOcrProgress(0);
    setError(null);
    setProcessingState('idle');
    setShowCameraSelection(true);
    setInputMode('selection');
    setImageQueue([]);
    setCurrentImageIndex(0);
    setEditableName('');
    setScryfallSuggestions([]);
    setCropRegion(null);
    setViewZoom(1);
    setViewPan({ tx: 0, ty: 0 });
    if (zoomInputRef.current) zoomInputRef.current.value = '1';
  };

  const handleUseData = () => {
    if (editableName || extractedData?.name) {
      // A multi-image queue means bulk scan — batch it and show the review
      // table; a single scan keeps the confirm-step form flow (Q4).
      const bulk = imageQueue.length > 1;
      onCardExtracted({
        ...extractedData,
        name: editableName || extractedData?.name
      }, { batch: bulk, close: true });
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setEditableName(suggestion);
    setScryfallSuggestions([]);
  };

  const handleClose = () => {
    // Cleanup
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
    }
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-0 sm:p-4">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute -top-2 -right-2 z-10 bg-red-600 hover:bg-red-700 text-white rounded-full p-2 transition"
          title="Close"
        >
          <X size={24} />
        </button>

        {/* Hidden file input for upload */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileUpload}
          accept="image/*"
          multiple
          className="hidden"
        />
        <canvas ref={cropCanvasRef} className="hidden" />

        {/* Camera/Upload Selection */}
        {showCameraSelection && !error && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-8">
            <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
              <Camera size={28} /> Scan Card
            </h2>

            {/* Upload Option - Always available */}
            <div className="mb-6">
              <button
                onClick={handleUploadClick}
                className="w-full px-6 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition text-lg"
              >
                <Upload size={24} /> Upload Image(s)
              </button>
              <p className="text-white/60 text-sm text-center mt-2">
                Select one or more card images from your device
              </p>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex-1 h-px bg-white/30"></div>
              <span className="text-white/60 text-sm">or</span>
              <div className="flex-1 h-px bg-white/30"></div>
            </div>

            {/* Camera Option */}
            {availableCameras.length === 0 ? (
              <p className="text-white/80 text-center py-4">Loading cameras...</p>
            ) : (
              <>
                <select
                  value={selectedCamera}
                  onChange={(e) => setSelectedCamera(e.target.value)}
                  className="w-full px-4 py-3 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400 mb-4"
                >
                  {availableCameras.map((camera) => (
                    <option key={camera.deviceId} value={camera.deviceId} className="text-black">
                      {camera.label || `Camera ${availableCameras.indexOf(camera) + 1}`}
                    </option>
                  ))}
                </select>

                <button
                  onClick={handleStartCamera}
                  className="w-full px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition text-lg"
                >
                  <Camera size={24} /> Use Camera
                </button>
              </>
            )}
          </div>
        )}

        {/* Camera Feed (Idle state) */}
        {processingState === 'idle' && !error && inputMode === 'camera' && (
          <div className="relative">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg"
            />
            <canvas ref={canvasRef} className="hidden" />

            {/* Guide overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              {/* Card-shaped guide (MTG cards are 63x88mm): height-anchored so
                  the preview box matches the real card proportions, which gets
                  the card bigger in frame for OCR */}
              <div className="border-4 border-purple-500/50 rounded-lg h-3/5 aspect-[63/88] flex items-center justify-center relative">
                <div className="absolute top-2 left-0 right-0 bg-black/70 text-white px-4 py-2 rounded-lg text-xs mx-4">
                  <div className="font-bold mb-1">Tips for best results:</div>
                  <div>• Hold card flat & steady</div>
                  <div>• Ensure good lighting, avoid glare</div>
                  <div>• Center card name in top area</div>
                </div>
              </div>
            </div>

            {/* Capture button */}
            <button
              onClick={captureImage}
              className="mt-4 w-full px-6 py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition text-lg"
            >
              <Camera size={24} /> Capture Card
            </button>
          </div>
        )}

        {/* Cropping State - Select region for card name */}
        {processingState === 'cropping' && capturedImage && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            <div className="mb-4">
              <h3 className="text-white font-bold text-lg flex items-center gap-2">
                <Crop size={20} /> Select Card Name Region
              </h3>
              <p className="text-white/60 text-sm">
                {cardBounds
                  ? 'Card detected — drag to fine-tune the name region'
                  : 'Card not detected — drag to select the area containing the card name'}
              </p>
            </div>

            {/* Queue progress indicator */}
            {imageQueue.length > 1 && (
              <div className="mb-4 flex items-center justify-center gap-2 bg-white/5 p-3 rounded-lg">
                <span className="text-white font-medium">
                  Image {currentImageIndex + 1} of {imageQueue.length}
                </span>
              </div>
            )}

            {/* Zoom controls */}
            <div className="flex items-center gap-3 mb-2">
              {(() => {
                const mid = { x: (imgWrapRef.current?.clientWidth || 0) / 2, y: (imgWrapRef.current?.clientHeight || 0) / 2 };
                return (
                  <>
                    <button
                      type="button"
                      onClick={() => applyZoom(viewZoom / 1.5, mid)}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold"
                      aria-label="Zoom out"
                    >−</button>
                    <input
                      ref={zoomInputRef}
                      type="range"
                      min="1"
                      max={String(MAX_ZOOM)}
                      step="0.1"
                      defaultValue="1"
                      onChange={(e) => applyZoom(Number(e.target.value), mid)}
                      className="flex-1 accent-green-500"
                      aria-label="Zoom level"
                    />
                    <button
                      type="button"
                      onClick={() => applyZoom(viewZoom * 1.5, mid)}
                      className="px-3 py-1 bg-white/10 hover:bg-white/20 text-white rounded-lg font-bold"
                      aria-label="Zoom in"
                    >+</button>
                  </>
                );
              })()}
            </div>
            <p className="text-white/50 text-xs mb-2">
              Pinch to zoom · drag to draw the name box · one finger pans when zoomed
            </p>

            {/* Image with crop overlay */}
            <div
              ref={imgWrapRef}
              className="relative cursor-crosshair select-none mb-4 overflow-hidden rounded-lg touch-none"
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
              onMouseLeave={handleCropMouseUp}
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
              onWheel={(e) => {
                if (!e.ctrlKey && Math.abs(e.deltaY) < 2) return;
                e.preventDefault();
                const rect = e.currentTarget.getBoundingClientRect();
                applyZoom(viewZoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15), { x: e.clientX - rect.left, y: e.clientY - rect.top });
              }}
            >
              <img
                src={capturedImage}
                alt="Card to scan"
                className="w-full rounded-lg"
                draggable={false}
                style={{
                  transformOrigin: '0 0',
                  transform: `translate(${viewPan.tx}px, ${viewPan.ty}px) scale(${viewZoom})`,
                }}
              />

              {/* Crop region overlay */}
              {cropRegion && (
                <>
                  {/* Darkened areas outside crop */}
                  <div className="absolute inset-0 pointer-events-none">
                    {/* Top */}
                    <div
                      className="absolute bg-black/60"
                      style={{
                        top: 0,
                        left: 0,
                        right: 0,
                        height: `${cropRegion.y}%`
                      }}
                    />
                    {/* Bottom */}
                    <div
                      className="absolute bg-black/60"
                      style={{
                        top: `${cropRegion.y + cropRegion.height}%`,
                        left: 0,
                        right: 0,
                        bottom: 0
                      }}
                    />
                    {/* Left */}
                    <div
                      className="absolute bg-black/60"
                      style={{
                        top: `${cropRegion.y}%`,
                        left: 0,
                        width: `${cropRegion.x}%`,
                        height: `${cropRegion.height}%`
                      }}
                    />
                    {/* Right */}
                    <div
                      className="absolute bg-black/60"
                      style={{
                        top: `${cropRegion.y}%`,
                        left: `${cropRegion.x + cropRegion.width}%`,
                        right: 0,
                        height: `${cropRegion.height}%`
                      }}
                    />
                  </div>

                  {/* Auto-detected card outline (helps position the name region) */}
                  {cardBounds && (
                    <div
                      className="absolute border-2 border-dashed border-amber-400/70 pointer-events-none"
                      style={{
                        left: `${cardBounds.x}%`,
                        top: `${cardBounds.y}%`,
                        width: `${cardBounds.width}%`,
                        height: `${cardBounds.height}%`
                      }}
                    />
                  )}

                  {/* Crop border */}
                  <div
                    className="absolute border-2 border-green-500 pointer-events-none"
                    style={{
                      left: `${cropRegion.x}%`,
                      top: `${cropRegion.y}%`,
                      width: `${cropRegion.width}%`,
                      height: `${cropRegion.height}%`
                    }}
                  >
                    <div className="absolute -top-6 left-0 bg-green-600 text-white text-xs px-2 py-1 rounded">
                      Card Name
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-2">
              <button
                onClick={processCroppedRegion}
                className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold flex items-center justify-center gap-2 transition"
              >
                <Search size={18} /> Scan Selected Area
              </button>
              <button
                onClick={retryCapture}
                className="px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Processing state */}
        {processingState === 'processing' && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            {/* Queue progress indicator */}
            {imageQueue.length > 1 && (
              <div className="mb-4 flex items-center justify-center gap-2 bg-white/5 p-3 rounded-lg">
                <span className="text-white font-medium">
                  Processing image {currentImageIndex + 1} of {imageQueue.length}
                </span>
              </div>
            )}
            <div className="flex justify-center mb-4">
              <img
                src={capturedImage}
                alt="Captured card"
                className="max-h-48 w-auto rounded-lg object-contain"
              />
            </div>
            <div className="text-center">
              <div className="text-white text-xl mb-2">Processing... {ocrProgress}%</div>
              <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-purple-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${ocrProgress}%` }}
                />
              </div>
              <p className="text-white/60 text-sm mt-4">
                {ocrProgress < 30 ? 'Preprocessing image...' :
                 ocrProgress < 50 ? 'Initializing OCR...' :
                 ocrProgress < 80 ? 'Extracting text...' :
                 ocrProgress < 95 ? 'Matching with Scryfall...' :
                 'Finishing up...'}
              </p>
            </div>
          </div>
        )}

        {/* Complete state */}
        {processingState === 'complete' && extractedData && (
          <div className="bg-white/10 backdrop-blur-md rounded-lg p-6">
            {/* Queue progress indicator */}
            {imageQueue.length > 1 && (
              <div className="mb-4 flex items-center justify-between bg-white/5 p-3 rounded-lg">
                <span className="text-white font-medium">
                  Image {currentImageIndex + 1} of {imageQueue.length}
                </span>
                <div className="flex gap-1">
                  {imageQueue.map((_, idx) => (
                    <div
                      key={idx}
                      className={`w-2 h-2 rounded-full ${
                        idx < currentImageIndex ? 'bg-green-500' :
                        idx === currentImageIndex ? 'bg-purple-500' :
                        'bg-white/30'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-4 mb-4">
              <div className="w-1/3 flex-shrink-0">
                <img
                  src={capturedImage}
                  alt="Captured card"
                  className="w-full max-h-48 rounded-lg object-contain"
                />
              </div>
              <div className="flex-1 bg-white/5 p-4 rounded-lg">
                <h3 className="text-white font-bold text-lg mb-3">Extracted Data</h3>

                <div className="space-y-3">
                  {/* Editable Card Name */}
                  <div>
                    <p className="text-white/60 text-sm mb-1">Card Name (editable):</p>
                    <div className="relative">
                      <input
                        type="text"
                        value={editableName}
                        onChange={(e) => setEditableName(e.target.value)}
                        className="w-full px-3 py-2 bg-white/20 border border-white/30 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                        placeholder="Enter card name..."
                      />
                      {loadingSuggestions && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                        </div>
                      )}
                    </div>

                    {/* Scryfall Suggestions Dropdown */}
                    {scryfallSuggestions.length > 0 && (
                      <div className="mt-1 bg-gray-800 border border-white/20 rounded-lg overflow-hidden">
                        {scryfallSuggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSuggestionClick(suggestion)}
                            className="w-full px-3 py-2 text-left text-white hover:bg-purple-600/50 transition text-sm flex items-center gap-2"
                          >
                            <Check size={14} className="text-green-400" />
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Original OCR result if different */}
                  {extractedData.originalOcrName && extractedData.originalOcrName !== editableName && (
                    <div>
                      <p className="text-white/40 text-xs">
                        Original OCR: "{extractedData.originalOcrName}"
                      </p>
                    </div>
                  )}

                  {extractedData.collectorNumber && (
                    <div>
                      <p className="text-white/60 text-sm">Collector Number:</p>
                      <p className="text-white font-semibold">{extractedData.collectorNumber}</p>
                    </div>
                  )}

                  <div>
                    <p className="text-white/60 text-sm">Confidence:</p>
                    <div className="flex items-center gap-2">
                      <p className={`font-semibold ${extractedData.confidence > 70 ? 'text-green-400' : extractedData.confidence > 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                        {Math.round(extractedData.confidence)}%
                      </p>
                      {extractedData.matchSource && (
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          extractedData.matchSource === 'image' ? 'bg-blue-600/50 text-blue-200' :
                          extractedData.matchSource === 'text+art' ? 'bg-teal-600/50 text-teal-200' :
                          extractedData.matchSource === 'scryfall' ? 'bg-purple-600/50 text-purple-200' :
                          extractedData.matchSource === 'text' ? 'bg-emerald-600/50 text-emerald-200' :
                          'bg-gray-600/50 text-gray-200'
                        }`}>
                          {extractedData.matchSource === 'image' ? '📷 Image Match' :
                           extractedData.matchSource === 'text+art' ? '📖🎨 Text + Art' :
                           extractedData.matchSource === 'scryfall' ? '🔍 Scryfall' :
                           extractedData.matchSource === 'text' ? '📖 Card Text' :
                           '📝 OCR'}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Show image matches if available */}
                  {extractedData.imageMatches && extractedData.imageMatches.length > 0 &&
                   extractedData.matchSource !== 'image' && (
                    <div>
                      <p className="text-white/60 text-sm">Image matches:</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {extractedData.imageMatches.slice(0, 3).map((match, idx) => (
                          <button
                            key={idx}
                            onClick={() => {
                              setEditableName(match.cardName);
                              setScryfallSuggestions([]);
                            }}
                            className="text-xs px-2 py-1 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 rounded transition"
                          >
                            {match.cardName} ({match.confidence}%)
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Q5: below 70% confidence, stop guessing — explicit picker */}
            {loadingCandidates && lowConfCandidates.length === 0 && (
              <div className="mb-4 flex items-center gap-2 text-white/60 text-sm">
                <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                Loading likely matches…
              </div>
            )}
            {lowConfCandidates.length > 0 && (
              <div className="mb-4 bg-yellow-500/10 border border-yellow-500/40 rounded-lg p-3">
                <p className="text-yellow-200 text-sm font-semibold mb-2">
                  {extractedData.nameResolved === false && (extractedData.confidence || 0) >= 70
                    ? "Couldn't verify the name — pick the correct card:"
                    : `Low confidence (${Math.round(extractedData.confidence)}%) — pick the correct card:`}
                </p>
                <div className="flex gap-2">
                  {lowConfCandidates.map(c => (
                    <button
                      key={c.name}
                      onClick={() => { setEditableName(c.name); setScryfallSuggestions([]); }}
                      className={`flex-1 rounded-lg overflow-hidden border-2 transition bg-black/40 ${
                        editableName === c.name ? 'border-green-400' : 'border-transparent hover:border-purple-400'
                      }`}
                    >
                      {c.img ? (
                        <img src={c.img} alt={c.name} className="w-full h-24 object-cover" />
                      ) : (
                        <div className="w-full h-24 flex items-center justify-center text-white/40 text-xs">
                          No image
                        </div>
                      )}
                      <div className="px-1 py-1 text-left">
                        <p className="text-white text-xs font-semibold leading-tight truncate">{c.name}</p>
                        {c.set && <p className="text-white/50 text-[10px] leading-tight truncate">{c.set}</p>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Q6: surface image-match capability instead of silently OCR-only */}
            {matchStatus && (!matchStatus.available || matchStatus.isBuilding || !matchStatus.indexedImages) && (
              <div className="mb-3 text-xs text-white/50 flex items-center gap-1.5">
                📷{' '}
                {!matchStatus.available
                  ? 'Image matching unavailable — recognizing by text (OCR)'
                  : matchStatus.isBuilding
                    ? `Image matching index building (${matchStatus.indexedImages} done) — recognizing by text meanwhile`
                    : 'Image matching index empty — recognizing by text; it builds automatically on first use'}
              </div>
            )}

            {/* Action buttons - different layout for queue vs single */}
            {imageQueue.length > 1 && currentImageIndex < imageQueue.length - 1 ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleUseDataAndNext}
                    disabled={!editableName}
                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
                  >
                    Use & Next Card
                  </button>
                  <button
                    onClick={handleNextImage}
                    className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition"
                  >
                    Skip
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleUseData}
                    disabled={!editableName}
                    className="flex-1 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
                  >
                    Use & Close
                  </button>
                  <button
                    onClick={retryCapture}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                  >
                    Start Over
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <button
                    onClick={handleUseData}
                    disabled={!editableName}
                    className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
                  >
                    Use This Data
                  </button>
                  <button
                    onClick={handleAddToBatch}
                    disabled={!editableName}
                    className="flex-1 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
                    title="Add to the scan batch and keep scanning — review all before saving"
                  >
                    Add to Batch
                  </button>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setProcessingState('cropping')}
                    className="flex-1 px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition"
                  >
                    Re-crop
                  </button>
                  <button
                    onClick={retryCapture}
                    className="flex-1 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                  >
                    {imageQueue.length > 1 ? 'Start Over' : 'Retry'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center">
            <div className="bg-red-600/20 border border-red-600 rounded-lg p-6 mb-4">
              <p className="text-red-200 text-lg font-semibold mb-2">Error</p>
              <p className="text-red-100">{error}</p>
            </div>
            <button
              onClick={retryCapture}
              className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Tips */}
        {processingState === 'idle' && !error && (inputMode === 'camera' || inputMode === 'selection') && (
          <div className="mt-4 bg-white/5 backdrop-blur-md rounded-lg p-4">
            <h4 className="text-white font-semibold text-sm mb-2">Tips for Best Results:</h4>
            <ul className="text-white/70 text-xs space-y-1">
              <li>• Use clear, well-lit photos of cards</li>
              <li>• Ensure card name at top is readable</li>
              <li>• Avoid glare and shadows</li>
              <li>• One card per image works best</li>
              <li>• The card is auto-detected; drag to fine-tune the name region after upload</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraModal;
