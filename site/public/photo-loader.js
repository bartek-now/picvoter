// Decode off-screen, then commit the image and crop together. New requests win.
export function createPhotoLoader(createImage = () => new Image()) {
  let latest = 0;
  return {
    cancel() { latest++; },
    async load({ src, prepare, onReady, onError }) {
      const request = ++latest;
      const image = createImage();
      prepare(image);
      image.decoding = 'async';
      image.src = src;
      try {
        await image.decode();
        if (request !== latest) return false;
        onReady(image);
        return true;
      } catch (error) {
        if (request === latest) onError?.(error);
        return false;
      }
    },
  };
}
