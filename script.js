// @ts-check

document.addEventListener('DOMContentLoaded', () => {
  const maxSize = 5000;
  const defaultSizeOnInvalid = 300;

  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('main-canvas'));
  const fileInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-file'));
  const widthInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-width'));
  const heightInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-height'));
  const saveButton = /** @type {HTMLButtonElement} */ (document.getElementById('save'));

  const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

  const img = new Image();
  let fileName = 'img';

  function aspectRatio() {
    const ratio = img.width / img.height;
    return isNaN(ratio) ? 1 : ratio;
  }

  function rerender() {
    const width = widthInput.value.length === 0 ? defaultSizeOnInvalid : Number(widthInput.value);
    const height = heightInput.value.length === 0 ? defaultSizeOnInvalid : Number(heightInput.value);

    canvas.width = width;
    canvas.height = height;
    context.drawImage(img, 0, 0, width, height);
  }

  function loadImage() {
    const file = fileInput.files?.[0];
    if (!file) return;

    img.src = URL.createObjectURL(file);
    fileName = file.name;
  }
  loadImage();

  fileInput.addEventListener('change', loadImage);

  img.addEventListener('load', () => {
    widthInput.value = '' + img.width;
    heightInput.value = '' + img.height;
    rerender();
  });

  saveButton.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = canvas.toDataURL();
    link.download = fileName;
    link.click();
  });

  /**
   * @param {HTMLInputElement} element 
   * @param {boolean} isWidth 
   * @param {HTMLInputElement} otherElement 
   */
  function applySizeInput(element, isWidth, otherElement) {
    const str = element.value.replaceAll(/[^\d]/g, '');
    let dimension = str.length === 0 ? defaultSizeOnInvalid : Math.min(maxSize, Number(str));

    let otherDimension = isWidth ? dimension * aspectRatio() : dimension / aspectRatio();
    if (otherDimension > maxSize) {
      otherDimension = maxSize;
      dimension = isWidth ? otherDimension / aspectRatio() : otherDimension * aspectRatio();
    }

    element.value = str.length === 0 ? '' : '' + dimension;
    otherElement.value = '' + otherDimension;
  }

  widthInput.addEventListener('input', () => {
    applySizeInput(widthInput, true, heightInput);
    rerender();
  });

  heightInput.addEventListener('input', () => {
    applySizeInput(heightInput, false, widthInput);
    rerender();
  });
});