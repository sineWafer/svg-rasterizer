// @ts-check

document.addEventListener('DOMContentLoaded', () => {
  const MAX_IMAGE_SIZE = 5000;
  const DEFAULT_IMAGE_SIZE = 300;

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
  let imageLoadedInitial = false;

  function aspectRatio() {
    const ratio = img.height / img.width;
    return isNaN(ratio) ? 1 : ratio;
  }

  /**
   * @param {number} dimension 
   */
  function clampImageDimension(dimension) {
    return Math.max(1, Math.min(MAX_IMAGE_SIZE, dimension));
  }

  function rerender() {
    /**
     * @param {HTMLInputElement} input 
     */
    function parseDimension(input) {
      return clampImageDimension(input.value.length === 0 ? DEFAULT_IMAGE_SIZE : Number(input.value));
    }

    const width = parseDimension(widthInput);
    const height = parseDimension(heightInput);

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

  async function loadImageAndRerender() {
    const file = fileInput.files?.[0];
    if (!file) return;

    img.src = URL.createObjectURL(file);
    fileName = file.name;

    rerender();
  }

  fileInput.addEventListener('change', loadImageAndRerender);

  img.addEventListener('load', () => {
    if (imageLoadedInitial) {
      widthInput.value = String(img.width);
      heightInput.value = String(img.height);
    }
    
    rerender();
    imageLoadedInitial = true;
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

    let dimension = str.length === 0 ? DEFAULT_IMAGE_SIZE : Math.floor(Number(str));
    if (dimension > MAX_IMAGE_SIZE) {
      dimension = MAX_IMAGE_SIZE;
      str = String(dimension);
    }

    if (lockAspectInput.checked || otherSizeInput.value.length === 0) {
      let otherDimension = Math.floor(isWidth ? dimension * aspectRatio() : dimension / aspectRatio());
      if (otherDimension > MAX_IMAGE_SIZE) {
        otherDimension = MAX_IMAGE_SIZE;
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

  sandboxIFrame.addEventListener('load', loadImageAndRerender);
});