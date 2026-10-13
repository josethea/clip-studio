export function exportEncodingOptions(settings={}) {
  switch (settings.exportQuality) {
    case 'balanced':
      return {imageFormat:'jpeg',jpegQuality:90,crf:18,x264Preset:'medium',pixelFormat:'yuv420p'};
    case 'maximum':
      return {imageFormat:'png',crf:14,x264Preset:'fast',pixelFormat:'yuv420p'};
    default:
      return {imageFormat:'png',crf:14,x264Preset:'medium',pixelFormat:'yuv420p'};
  }
}
