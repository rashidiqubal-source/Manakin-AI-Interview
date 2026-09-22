import { inferenceService } from './src/ml/services/inferenceService';
import jpeg from 'jpeg-js';

async function testBackendYOLO26Detection() {
  console.log('1. Initializing YOLO26 models and service...');
  await inferenceService.initialize();

  console.log('2. Health check:', inferenceService.getHealth());

  // Create a synthetic 320x240 test frame
  const width = 320;
  const height = 240;
  const rawData = Buffer.alloc(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      if (x >= 100 && x <= 220 && y >= 60 && y <= 180) {
        rawData[idx] = 230;     // R
        rawData[idx + 1] = 180; // G
        rawData[idx + 2] = 140; // B
        rawData[idx + 3] = 255; // A
      } else {
        rawData[idx] = 40;
        rawData[idx + 1] = 40;
        rawData[idx + 2] = 40;
        rawData[idx + 3] = 255;
      }
    }
  }

  const jpegBuffer = jpeg.encode({ data: rawData, width, height }, 70);
  const base64Image = `data:image/jpeg;base64,${jpegBuffer.data.toString('base64')}`;

  console.log('3. Running YOLO26 detection on test frame...');
  const result = await inferenceService.runDetection(base64Image, { runFace: true, runObject: true });
  console.log('4. YOLO26 Inference Result:', JSON.stringify(result, null, 2));

  await inferenceService.shutdown();
  console.log('5. YOLO26 Test completed successfully.');
  process.exit(0);
}

testBackendYOLO26Detection().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
