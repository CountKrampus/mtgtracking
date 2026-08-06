import { useState } from 'react';
import QRCode from 'qrcode';

// Shared QR-label generation/preview/print-labels state, used independently
// by both CollectionView and SettingsView (each gets its own instance).
export default function useQRLabels() {
  const [qrDataUrls, setQrDataUrls] = useState({});
  const [showQRPreview, setShowQRPreview] = useState(false);
  const [qrPreviewLocation, setQRPreviewLocation] = useState(null);
  const [showPrintLabels, setShowPrintLabels] = useState(false);

  const generateQR = async (locationName) => {
    const url = `${window.location.origin}?location=${encodeURIComponent(locationName)}`;
    try {
      return await QRCode.toDataURL(url, { width: 150, margin: 1 });
    } catch (err) {
      console.error('QR generation failed:', err);
      return null;
    }
  };

  return {
    qrDataUrls, setQrDataUrls,
    generateQR,
    showQRPreview, setShowQRPreview,
    qrPreviewLocation, setQRPreviewLocation,
    showPrintLabels, setShowPrintLabels,
  };
}
