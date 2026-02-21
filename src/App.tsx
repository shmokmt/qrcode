import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Flash,
  FormControl,
  Heading,
  Select,
  Text,
  Textarea
} from '@primer/react';
import jsQR from 'jsqr';
import QRCode from 'qrcode';

type ErrorLevel = 'L' | 'M' | 'Q' | 'H';
type DecodeStatus = 'untested' | 'success' | 'failed';

type QrOptions = {
  errorLevel: ErrorLevel;
};

type MaskOptions = {
  sizePercent: number;
  centerXPercent: number;
  centerYPercent: number;
  opacityPercent: number;
};

const defaultOptions: QrOptions = {
  errorLevel: 'M'
};

const defaultMaskOptions: MaskOptions = {
  sizePercent: 18,
  centerXPercent: 50,
  centerYPercent: 50,
  opacityPercent: 100
};

type PermalinkState = {
  text: string;
  options: QrOptions;
  maskOptions: MaskOptions;
};

const errorLevels: ErrorLevel[] = ['L', 'M', 'Q', 'H'];

async function makeQrDataUrl(text: string, options: QrOptions): Promise<string> {
  return QRCode.toDataURL(text, {
    width: 320,
    margin: 2,
    errorCorrectionLevel: options.errorLevel,
    color: {
      dark: '#111111',
      light: '#ffffff'
    }
  });
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fixedMaskRgba(alpha: number): string {
  return `rgba(113, 75, 75, ${clamp(alpha, 0, 1)})`;
}

function getDecodeMessage(status: DecodeStatus): string {
  switch (status) {
    case 'success':
      return '✅ Readable';
    case 'failed':
      return '❌ Unreable';
    default:
      return '';
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image'));
    image.src = src;
  });
}

async function applyMaskAndTest(
  sourceDataUrl: string,
  text: string,
  maskOptions: MaskOptions
): Promise<{ maskedDataUrl: string; decodeStatus: DecodeStatus }> {
  const image = await loadImage(sourceDataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas context is unavailable');
  }

  context.drawImage(image, 0, 0);

  if (maskOptions.sizePercent > 0) {
    const side = Math.max(1, Math.round((Math.min(canvas.width, canvas.height) * maskOptions.sizePercent) / 100));
    const centerX = (canvas.width * maskOptions.centerXPercent) / 100;
    const centerY = (canvas.height * maskOptions.centerYPercent) / 100;
    const x = clamp(Math.round(centerX - side / 2), 0, canvas.width - side);
    const y = clamp(Math.round(centerY - side / 2), 0, canvas.height - side);

    context.fillStyle = fixedMaskRgba(maskOptions.opacityPercent / 100);
    context.fillRect(x, y, side, side);
  }

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const decoded = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: 'attemptBoth'
  });

  const normalizedText = text.trim();
  const decodedText = decoded?.data ?? '';

  let decodeStatus: DecodeStatus = 'failed';
  if (!normalizedText) {
    decodeStatus = 'untested';
  } else if (decodedText === normalizedText) {
    decodeStatus = 'success';
  }

  return {
    maskedDataUrl: canvas.toDataURL('image/png'),
    decodeStatus
  };
}

function parseNumber(value: string | null, fallback: number, min: number, max: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return clamp(Math.round(parsed), min, max);
}

function parseErrorLevel(value: string | null, fallback: ErrorLevel): ErrorLevel {
  if (value && errorLevels.includes(value as ErrorLevel)) {
    return value as ErrorLevel;
  }
  return fallback;
}

function parsePermalinkState(): PermalinkState {
  if (typeof window === 'undefined') {
    return {
      text: 'https://example.com',
      options: defaultOptions,
      maskOptions: defaultMaskOptions
    };
  }

  const params = new URLSearchParams(window.location.search);
  const textParam = params.get('t');

  const options: QrOptions = {
    errorLevel: parseErrorLevel(params.get('e'), defaultOptions.errorLevel)
  };

  const maskOptions: MaskOptions = {
    sizePercent: parseNumber(params.get('ms'), defaultMaskOptions.sizePercent, 0, 45),
    centerXPercent: parseNumber(params.get('mx'), defaultMaskOptions.centerXPercent, 0, 100),
    centerYPercent: parseNumber(params.get('my'), defaultMaskOptions.centerYPercent, 0, 100),
    opacityPercent: parseNumber(params.get('mo'), defaultMaskOptions.opacityPercent, 10, 100)
  };

  return {
    text: textParam ?? 'https://example.com',
    options,
    maskOptions
  };
}

function createPermalink(text: string, options: QrOptions, maskOptions: MaskOptions): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const params = new URLSearchParams();
  params.set('t', text);
  params.set('e', options.errorLevel);
  params.set('ms', String(maskOptions.sizePercent));
  params.set('mx', String(maskOptions.centerXPercent));
  params.set('my', String(maskOptions.centerYPercent));
  params.set('mo', String(maskOptions.opacityPercent));

  const query = params.toString();
  return query ? `?${query}` : window.location.pathname;
}

export default function App() {
  const initialState = useMemo(() => parsePermalinkState(), []);
  const [text, setText] = useState(initialState.text);
  const [options, setOptions] = useState<QrOptions>(initialState.options);
  const [maskOptions, setMaskOptions] = useState<MaskOptions>(initialState.maskOptions);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [maskedDataUrl, setMaskedDataUrl] = useState('');
  const [decodeStatus, setDecodeStatus] = useState<DecodeStatus>('untested');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const nextPermalink = createPermalink(text, options, maskOptions);
    window.history.replaceState(null, '', nextPermalink);
  }, [maskOptions, options, text]);

  useEffect(() => {
    const normalizedText = text.trim();
    if (!normalizedText) {
      setErrorMessage('Please enter text to generate a QR code.');
      setQrDataUrl('');
      setMaskedDataUrl('');
      setDecodeStatus('untested');
      return;
    }

    let active = true;
    setErrorMessage('');

    void makeQrDataUrl(normalizedText, options)
      .then((dataUrl) => {
        if (!active) {
          return;
        }
        setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setErrorMessage('Failed to generate QR code. Please check your inputs.');
        setQrDataUrl('');
        setMaskedDataUrl('');
        setDecodeStatus('failed');
      });

    return () => {
      active = false;
    };
  }, [options, text]);

  useEffect(() => {
    if (!qrDataUrl) {
      return;
    }

    let active = true;
    void applyMaskAndTest(qrDataUrl, text, maskOptions)
      .then((result) => {
        if (!active) {
          return;
        }
        setMaskedDataUrl(result.maskedDataUrl);
        setDecodeStatus(result.decodeStatus);
      })
      .catch(() => {
        if (!active) {
          return;
        }
        setDecodeStatus('failed');
      });

    return () => {
      active = false;
    };
  }, [maskOptions, qrDataUrl, text]);

  const currentPreview = maskedDataUrl || qrDataUrl;

  return (
    <main className="page">
      <section className="card controls">
        <Heading as="h1">QR Error Correction Tester</Heading>

        <form>
          <FormControl>
            <FormControl.Label>Text</FormControl.Label>
            <Textarea
              value={text}
              rows={4}
              placeholder="Enter any text"
              onChange={(event) => setText(event.target.value)}
              style={{
                borderColor: '#24292f',
                boxShadow: 'inset 0 0 0 1px #24292f'
              }}
            />
          </FormControl>

          <div className="grid">
            <FormControl>
              <FormControl.Label>Error Correction</FormControl.Label>
              <Select
                className="gh-select"
                value={options.errorLevel}
                onChange={(event) =>
                  setOptions((prev) => ({
                    ...prev,
                    errorLevel: event.target.value as ErrorLevel
                  }))
                }
              >
                <option value="L">L (7%)</option>
                <option value="M">M (15%)</option>
                <option value="Q">Q (25%)</option>
                <option value="H">H (30%)</option>
              </Select>
            </FormControl>

          </div>

          <Heading as="h2" className="subheading">
            Mask Demo
          </Heading>

          <div className="grid mask-grid">
            <FormControl>
              <FormControl.Label>Mask Size ({maskOptions.sizePercent}%)</FormControl.Label>
              <input
                type="range"
                min={0}
                max={45}
                step={1}
                value={maskOptions.sizePercent}
                onChange={(event) =>
                  setMaskOptions((prev) => ({
                    ...prev,
                    sizePercent: Number(event.target.value)
                  }))
                }
              />
            </FormControl>

            <FormControl>
              <FormControl.Label>Mask X ({maskOptions.centerXPercent}%)</FormControl.Label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={maskOptions.centerXPercent}
                onChange={(event) =>
                  setMaskOptions((prev) => ({
                    ...prev,
                    centerXPercent: Number(event.target.value)
                  }))
                }
              />
            </FormControl>

            <FormControl>
              <FormControl.Label>Mask Y ({maskOptions.centerYPercent}%)</FormControl.Label>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={maskOptions.centerYPercent}
                onChange={(event) =>
                  setMaskOptions((prev) => ({
                    ...prev,
                    centerYPercent: Number(event.target.value)
                  }))
                }
              />
            </FormControl>

            <FormControl>
              <FormControl.Label>Mask Opacity ({maskOptions.opacityPercent}%)</FormControl.Label>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={maskOptions.opacityPercent}
                onChange={(event) =>
                  setMaskOptions((prev) => ({
                    ...prev,
                    opacityPercent: Number(event.target.value)
                  }))
                }
              />
            </FormControl>

          </div>

          <div className="actions">
            <Button
              type="button"
              variant="default"
              className="gh-like-button"
              onClick={() => {
                setOptions(defaultOptions);
                setMaskOptions(defaultMaskOptions);
              }}
            >
              Reset Options
            </Button>
          </div>

        </form>

        {errorMessage && <Flash variant="danger">{errorMessage}</Flash>}
      </section>

      <section className="card preview">
        <Heading as="h2">Preview</Heading>
        {currentPreview ? <img src={currentPreview} alt="Generated QR code with optional mask" /> : <Text as="p" className="placeholder">No QR code yet.</Text>}

        {decodeStatus !== 'untested' && (
          <Text as="p" className={`decode ${decodeStatus}`}>
            {getDecodeMessage(decodeStatus)}
          </Text>
        )}
      </section>
    </main>
  );
}
