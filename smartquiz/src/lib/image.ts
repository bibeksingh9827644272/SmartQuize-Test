const AVATAR_SIZE = 512;
const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_DATA_URL_LENGTH = 580_000;

function loadImage(source: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('That image could not be read. Try a JPG or PNG.'));
    image.src = source;
  });
}

export async function createAvatarDataUrl(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('Choose a JPG, PNG, WEBP or GIF image.');
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error('Choose an image under 8 MB.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    if (!image.naturalWidth || !image.naturalHeight) {
      throw new Error('That image has no visible pixels.');
    }
    const canvas = document.createElement('canvas');
    canvas.width = AVATAR_SIZE;
    canvas.height = AVATAR_SIZE;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('This browser could not prepare the image.');

    const scale = Math.max(
      AVATAR_SIZE / image.naturalWidth,
      AVATAR_SIZE / image.naturalHeight,
    );
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const left = (AVATAR_SIZE - width) / 2;
    const top = (AVATAR_SIZE - height) * 0.35;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = 'high';
    context.drawImage(image, left, top, width, height);

    let dataUrl = canvas.toDataURL('image/jpeg', 0.86);
    if (dataUrl.length > MAX_DATA_URL_LENGTH) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    }
    return dataUrl;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
