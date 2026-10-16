const getHashCode = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

export const generateAvatarColor = (name: string) => {
  const hash = getHashCode(name);
  const hue = hash % 360;
  const saturation = 80;
  const lightness = 90;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};

export const generateInitialsColor = (name: string) => {
  const hash = getHashCode(name);
  const hue = hash % 360;
  const saturation = 80;
  const lightness = 20;

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
};
