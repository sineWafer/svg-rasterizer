// @ts-check

document.addEventListener('DOMContentLoaded', () => {
  const maxSize = 5000;
  const defaultSizeOnInvalid = 300;

  const canvas = /** @type {HTMLCanvasElement} */ (document.getElementById('main-canvas'));
  const fileInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-file'));
  const widthInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-width'));
  const heightInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-height'));
  const lockAspectInput = /** @type {HTMLInputElement} */ (document.getElementById('setting-lock-aspect'));
  const saveButton = /** @type {HTMLButtonElement} */ (document.getElementById('save'));

  const context = /** @type {CanvasRenderingContext2D} */ (canvas.getContext('2d'));

  const img = new Image();
  let lastUsedSizeInput = widthInput;
  let fileName = 'img';

  function aspectRatio() {
    const ratio = img.height / img.width;
    return isNaN(ratio) ? 1 : ratio;
  }

  function rerender() {
    const width = Math.max(1, widthInput.value.length === 0 ? defaultSizeOnInvalid : Number(widthInput.value));
    const height = Math.max(1, heightInput.value.length === 0 ? defaultSizeOnInvalid : Number(heightInput.value));

    canvas.width = width;
    canvas.height = height;
    context.drawImage(img, 0, 0, width, height);

    const disableInputs = img.src.length === 0;
    widthInput.disabled = disableInputs;
    heightInput.disabled = disableInputs;
    lockAspectInput.disabled = disableInputs;
    saveButton.disabled = disableInputs;
    if (disableInputs) {
      widthInput.value = '';
      heightInput.value = '';
      lockAspectInput.checked = true;
    }
  }
  rerender();

  function loadImage() {
    const file = fileInput.files?.[0];
    if (!file) return;

    img.src = URL.createObjectURL(file);
    fileName = file.name;
  }
  loadImage();

  fileInput.addEventListener('change', loadImage);

  img.addEventListener('load', () => {
    widthInput.value = String(img.width);
    heightInput.value = String(img.height);
    rerender();
  });

  saveButton.addEventListener('click', () => {
    const link = document.createElement('a');
    link.href = canvas.toDataURL();
    link.download = fileName;
    link.click();
  });

  /**
   * @param {HTMLInputElement?} sizeInput 
   * @param {boolean} allowEmpty 
   */
  function applySizeInputChange(sizeInput = null, allowEmpty = true) {
    sizeInput ??= lastUsedSizeInput;
    lastUsedSizeInput = sizeInput;
    const isWidth = sizeInput === widthInput;
    const otherSizeInput = isWidth ? heightInput : widthInput;

    let str = sizeInput.value.replaceAll(/[^\d.]/g, '');
    const slices = str.split('.');
    str = slices.slice(0, 2).join('.') + slices.slice(2).join();

    let dimension = str.length === 0 ? defaultSizeOnInvalid : Math.floor(Number(str));
    if (dimension > maxSize) {
      dimension = maxSize;
      str = String(dimension);
    }

    if (lockAspectInput.checked || otherSizeInput.value.length === 0) {
      let otherDimension = Math.floor(isWidth ? dimension * aspectRatio() : dimension / aspectRatio());
      if (otherDimension > maxSize) {
        otherDimension = maxSize;
        dimension = Math.floor(isWidth ? otherDimension / aspectRatio() : otherDimension * aspectRatio());
        str = String(dimension);
      }
  
      otherSizeInput.value = String(otherDimension);
    }

    sizeInput.value = (str.length !== 0 || !allowEmpty) ? String(dimension) : str;

    rerender();
  }

  widthInput.addEventListener('input', () => applySizeInputChange(widthInput));
  widthInput.addEventListener('focusout', () => {
    if (widthInput.value.length === 0) {
      applySizeInputChange(widthInput, false);
    }
  });

  heightInput.addEventListener('input', () => applySizeInputChange(heightInput));
  heightInput.addEventListener('focusout', () => {
    if (heightInput.value.length === 0) {
      applySizeInputChange(heightInput, false);
    }
  });

  lockAspectInput.addEventListener('change', () => applySizeInputChange());
});