# LiveAudioVisualizer Component

## Overview

The `LiveAudioVisualizer` is a React component designed for real-time audio visualization. It converts MediaRecorder audio streams into dynamic visual effects.

![LiveAudioVisualizer Example](livevisualizergif)

## Usage Example

```javascript
import React, { useState } from 'react';
import { LiveAudioVisualizer } from 'react-audio-visualize';

const Visualizer = () => {
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder>();

  // Set media recorder somewhere in code

  return (
    <div>
      {mediaRecorder && (
        <LiveAudioVisualizer
          mediaRecorder={mediaRecorder}
          width={200}
          height={75}
        />
      )}
    </div>
  )
}
```

## Props

| Property | Description | Default | Optional |
|----------|-------------|---------|----------|
| `mediaRecorder` | Media recorder whose stream needs to be visualized | N/A | No |
| `width` | Width of the visualizer | 100% | Yes |
| `height` | Height of the visualizer | 100% | Yes |
| `barWidth` | Width of each individual bar in the visualization | 2 | Yes |
| `gap` | Gap between each bar in the visualization | 1 | Yes |
| `backgroundColor` | Background color for the visualization | transparent | Yes |
| `barColor` | Color for the bars that have not yet been played | "rgb(160, 198, 255)" | Yes |
| `fftSize` | An unsigned integer, representing the window size of the FFT, given in number of samples. [More details](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize) | 1024 | Yes |
| `maxDecibels` | A double, representing the maximum decibel value for scaling the FFT analysis data. [More details](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/maxDecibels) | -10 | Yes |
| `minDecibels` | A double, representing the minimum decibel value for scaling the FFT analysis data, where 0 dB is the loudest possible sound. [More details](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/minDecibels) | -90 | Yes |
| `smoothingTimeConstant` | A double within the range 0 to 1 (0 meaning no time averaging). [More details](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/smoothingTimeConstant) | 0.4 | Yes |

## Key Features

- **Real-time Audio Visualization**: Converts audio streams into dynamic visual effects
- **Highly Customizable**: Supports multiple visualization parameter adjustments
- **React Integration**: Fully compatible with the React ecosystem
- **Performance Optimized**: Uses FFT analysis to provide smooth visualization experience

## Important Notes

- Ensure that `mediaRecorder` is properly initialized and recording has started
- It's recommended to check browser support for MediaRecorder API before use
- Adjust FFT-related parameters as needed to achieve optimal visual effects

## Related Resources

- [MDN - MediaRecorder API](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
- [MDN - AnalyserNode](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode)
- [react-audio-visualize Documentation](https://github.com/alexk111/react-audio-visualize)

## Installation

```bash
npm install react-audio-visualize
```

## Browser Compatibility

This component requires browsers that support:
- MediaRecorder API
- Web Audio API
- Canvas API

Most modern browsers (Chrome 47+, Firefox 25+, Safari 14+) support these features.

## Performance Considerations

- The `fftSize` property directly affects performance. Lower values provide better performance but less frequency resolution
- Consider using `requestAnimationFrame` for smooth animations when integrating with other components
- Monitor memory usage in long-running applications, especially with high `fftSize` values