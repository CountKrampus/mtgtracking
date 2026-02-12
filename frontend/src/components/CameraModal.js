import React, { useState, useRef, useEffect } from 'react';
import { createWorker } from 'tesseract.js';
import { X, Camera, Upload, Crop, Search, Check } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

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

  // New states for improvements
  const [editableName, setEditableName] = useState('');
  const [scryfallSuggestions, setScryfallSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [cropRegion, setCropRegion] = useState(null); // {x, y, width, height}
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const tesseractWorkerRef = useRef(null);
  const fileInputRef = useRef(null);
  const cropCanvasRef = useRef(null);

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
      // Enumerate cameras
      enumerateCameras();
    }

    return () => {
      // Cleanup on unmount
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (tesseractWorkerRef.current) {
        tesseractWorkerRef.current.terminate();
        tesseractWorkerRef.current = null;
      }
    };
  }, [isOpen]);

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
        // Go to cropping mode instead of directly processing
        setCapturedImage(images[0].data);
        setProcessingState('cropping');
        // Set default crop region (top portion for card name)
        setCropRegion({ x: 5, y: 2, width: 70, height: 10 }); // percentages
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
      setCapturedImage(imageQueue[nextIndex].data);
      setProcessingState('cropping');
      setCropRegion({ x: 5, y: 2, width: 70, height: 10 });
    }
  };

  const handleUseDataAndNext = () => {
    if (editableName || extractedData?.name) {
      onCardExtracted({
        ...extractedData,
        name: editableName || extractedData?.name
      });
    }
    handleNextImage();
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

    // Go to cropping mode
    setProcessingState('cropping');
    setCropRegion({ x: 5, y: 2, width: 70, height: 10 }); // Default crop region
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

  const processCroppedRegion = async () => {
    if (!cropRegion || !capturedImage) return;

    setProcessingState('processing');
    setOcrProgress(0);

    try {
      // Create image from captured data
      const img = new Image();
      img.onload = async () => {
        // Create canvas with cropped region
        const cropX = (cropRegion.x / 100) * img.width;
        const cropY = (cropRegion.y / 100) * img.height;
        const cropW = (cropRegion.width / 100) * img.width;
        const cropH = (cropRegion.height / 100) * img.height;

        const croppedCanvas = document.createElement('canvas');
        croppedCanvas.width = cropW;
        croppedCanvas.height = cropH;
        const ctx = croppedCanvas.getContext('2d');
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        // Preprocess the cropped region
        setOcrProgress(10);
        preprocessImage(croppedCanvas);
        setOcrProgress(20);

        // Process with OCR
        await processWithOCR(croppedCanvas, img);
      };
      img.src = capturedImage;
    } catch (err) {
      setError(`Processing failed: ${err.message}`);
      setProcessingState('cropping');
    }
  };

  const processWithOCR = async (croppedCanvas, fullImage) => {
    try {
      // Run OCR and image matching in parallel
      const ocrPromise = runOCR(croppedCanvas, fullImage);
      const imageMatchPromise = runImageMatch(capturedImage);

      // Wait for both to complete
      const [ocrResult, imageMatchResult] = await Promise.all([
        ocrPromise.catch(e => ({ error: e.message, confidence: 0 })),
        imageMatchPromise.catch(e => ({ matches: [], error: e.message }))
      ]);

      setOcrProgress(95);

      // Combine results - prefer image match if OCR confidence is low
      let finalName = ocrResult.matchedName || ocrResult.cardName || '';
      let finalConfidence = ocrResult.confidence || 0;
      let matchSource = 'ocr';

      // Check if image match found a better result
      if (imageMatchResult.matches && imageMatchResult.matches.length > 0) {
        const bestImageMatch = imageMatchResult.matches[0];
        console.log('Image match result:', bestImageMatch);

        // Use image match if:
        // 1. OCR confidence is low (<60%) and image match confidence is good (>70%)
        // 2. Image match confidence is very high (>85%)
        // 3. OCR produced no result
        if ((finalConfidence < 60 && bestImageMatch.confidence > 70) ||
            bestImageMatch.confidence > 85 ||
            !finalName) {
          finalName = bestImageMatch.cardName;
          finalConfidence = Math.max(finalConfidence, bestImageMatch.confidence);
          matchSource = 'image';
          console.log('Using image match result:', finalName);
        }
      }

      // If still no name from either method, try Scryfall with whatever we have
      if (!finalName && ocrResult.cardName) {
        try {
          const response = await axios.get(`${API_URL}/scryfall/autocomplete?q=${encodeURIComponent(ocrResult.cardName)}`);
          if (response.data && response.data.length > 0) {
            finalName = response.data[0];
            matchSource = 'scryfall';
          }
        } catch (e) {
          console.log('Scryfall fallback failed');
        }
      }

      setExtractedData({
        name: finalName,
        originalOcrName: ocrResult.cardName || '',
        collectorNumber: ocrResult.collectorNumber,
        confidence: finalConfidence,
        matchSource,
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

  // Run OCR on the cropped region
  const runOCR = async (croppedCanvas, fullImage) => {
    // Initialize Tesseract worker if not exists
    if (!tesseractWorkerRef.current) {
      const worker = await createWorker('eng');
      await worker.setParameters({
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 -—\',./&',
        preserve_interword_spaces: '1',
        tessedit_pageseg_mode: '7', // Single line of text
      });
      tesseractWorkerRef.current = worker;
      setOcrProgress(40);
    } else {
      setOcrProgress(40);
    }

    const worker = tesseractWorkerRef.current;

    // OCR on cropped region (card name)
    setOcrProgress(50);
    const nameResult = await worker.recognize(croppedCanvas);
    setOcrProgress(70);

    // Also try to get collector number from full image
    let collectorNumber = null;
    if (fullImage) {
      const fullCanvas = document.createElement('canvas');
      fullCanvas.width = fullImage.width;
      fullCanvas.height = fullImage.height;
      const fullCtx = fullCanvas.getContext('2d');
      fullCtx.drawImage(fullImage, 0, 0);

      const collectorRegion = {
        left: Math.floor(fullImage.width * 0.05),
        top: Math.floor(fullImage.height * 0.88),
        width: Math.floor(fullImage.width * 0.25),
        height: Math.floor(fullImage.height * 0.08)
      };

      try {
        const collectorResult = await worker.recognize(fullCanvas, { rectangle: collectorRegion });
        const collectorMatch = collectorResult.data.text.match(/(\d+)\/(\d+)/);
        collectorNumber = collectorMatch ? collectorMatch[1] : null;
      } catch (e) {
        console.log('Could not extract collector number');
      }
    }
    setOcrProgress(80);

    // Parse and clean results
    let cardName = nameResult.data.text
      .trim()
      .replace(/[^a-zA-Z0-9\s,'\-—&]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    console.log('OCR Results:', {
      rawName: nameResult.data.text,
      cleanedName: cardName,
      collectorNumber,
      confidence: nameResult.data.confidence
    });

    // Try to fuzzy match with Scryfall to correct OCR errors
    let matchedName = cardName;
    if (cardName.length >= 2) {
      try {
        const response = await axios.get(`${API_URL}/scryfall/autocomplete?q=${encodeURIComponent(cardName)}`);
        if (response.data && response.data.length > 0) {
          const topMatch = response.data[0];
          if (nameResult.data.confidence < 80 ||
              topMatch.toLowerCase().includes(cardName.toLowerCase().substring(0, 3))) {
            matchedName = topMatch;
            console.log('Scryfall fuzzy match:', cardName, '->', matchedName);
          }
        }
      } catch (e) {
        console.log('Scryfall lookup failed, using raw OCR result');
      }
    }

    return {
      cardName,
      matchedName,
      collectorNumber,
      confidence: nameResult.data.confidence
    };
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

  const handleCropMouseDown = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    setDragStart({ x, y });
    setIsDragging(true);
  };

  const handleCropMouseMove = (e) => {
    if (!isDragging || !dragStart) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newRegion = {
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      width: Math.abs(x - dragStart.x),
      height: Math.abs(y - dragStart.y)
    };

    // Clamp values
    newRegion.x = Math.max(0, Math.min(100 - newRegion.width, newRegion.x));
    newRegion.y = Math.max(0, Math.min(100 - newRegion.height, newRegion.y));
    newRegion.width = Math.min(100 - newRegion.x, newRegion.width);
    newRegion.height = Math.min(100 - newRegion.y, newRegion.height);

    setCropRegion(newRegion);
  };

  const handleCropMouseUp = () => {
    setIsDragging(false);
    setDragStart(null);
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
  };

  const handleUseData = () => {
    if (editableName || extractedData?.name) {
      onCardExtracted({
        ...extractedData,
        name: editableName || extractedData?.name
      });
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
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4">
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
              <div className="border-4 border-purple-500/50 rounded-lg w-4/5 h-3/4 flex items-center justify-center relative">
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
                Drag to select the area containing the card name, or use the default selection
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

            {/* Image with crop overlay */}
            <div
              className="relative cursor-crosshair select-none mb-4"
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
              onMouseLeave={handleCropMouseUp}
            >
              <img
                src={capturedImage}
                alt="Card to scan"
                className="w-full rounded-lg"
                draggable={false}
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
                          extractedData.matchSource === 'scryfall' ? 'bg-purple-600/50 text-purple-200' :
                          'bg-gray-600/50 text-gray-200'
                        }`}>
                          {extractedData.matchSource === 'image' ? '📷 Image Match' :
                           extractedData.matchSource === 'scryfall' ? '🔍 Scryfall' :
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
              <div className="flex gap-2">
                <button
                  onClick={handleUseData}
                  disabled={!editableName}
                  className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition"
                >
                  Use This Data
                </button>
                <button
                  onClick={() => setProcessingState('cropping')}
                  className="px-6 py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-semibold transition"
                >
                  Re-crop
                </button>
                <button
                  onClick={retryCapture}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition"
                >
                  {imageQueue.length > 1 ? 'Start Over' : 'Retry'}
                </button>
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
              <li>• You can manually select the name region after upload</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default CameraModal;
