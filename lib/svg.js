// @ts-check

// @ts-ignore
var lib = lib ?? {};
// @ts-ignore
lib.svg = lib.svg ?? {};

{
  const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

  const svgDefaultsContainer = /** @type {SVGSVGElement} */ (document.createElementNS(SVG_NAMESPACE, 'svg'));
  document.addEventListener('DOMContentLoaded', () => {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.opacity = '0';
    container.appendChild(svgDefaultsContainer);
    document.body.appendChild(container);
  });

  /** @type {{ [tagName: string]: CSSStyleDeclaration | undefined }} */
  let svgElementsDefaultComputedStyleCache = {};

  /**
   * @param {string} tagName 
   */
  function getSvgDefaultStyles(tagName) {
    tagName = tagName.toLowerCase();

    let styles = svgElementsDefaultComputedStyleCache[tagName];
    if (styles !== undefined) return styles;

    const element = document.createElementNS(SVG_NAMESPACE, tagName);
    svgDefaultsContainer.appendChild(element);
    styles = window.getComputedStyle(element);
    svgElementsDefaultComputedStyleCache[tagName] = styles;
    return styles;
  }

  /**
   * All tag names of all element types that drive SVG SMIL animation.
   */
  const svgAnimationElementTagNames = [
    'animate',
    'animateTransform',
    'animateMotion',
    'set',
  ];
  const animationElementsSelector = svgAnimationElementTagNames.join(',');

  /**
   * Filters for parsing computed values to attribute values. Returning a nullish value means the filter does not apply.
   * Only one filter is applied to the same attribute value.
   * 
   * @type {((attributeValue: string) => string | null | undefined)[]}
   * */
  const attributeValueFilters = [
    // Remove px from lengths
    v => /^(-?\d+(?:\.\d+)?)px$/.exec(v)?.[1],

    // Remove enclosing path("") from path values
    v => /^path\(\"([^"]*)\"\)$/.exec(v)?.[1],

    // FUTURE: etc
  ];

  /**
   * Takes the current computed style values from the specified SVG and applies them as attributes. This effectively
   * freezes the animation in place once the influence from animation elements is removed.
   * 
   * @param {SVGSVGElement} svg 
   */
  lib.svg.applyAnimation = (svg, skipAnimationElements = true) => {
    const svgWindow = svg.ownerDocument.defaultView;
    if (svgWindow === null) return;

    for (const element of (/** @type {NodeListOf<SVGElement>} */ (svg.querySelectorAll('*')))) {
      if (skipAnimationElements && svgAnimationElementTagNames.includes(element.tagName.toLowerCase())) {
        continue;
      }

      const computedStyle = svgWindow.getComputedStyle(element);
      const defaults = getSvgDefaultStyles(element.tagName);

      for (let i = 0; i < computedStyle.length; ++i) {
        const attributeName = computedStyle[i];
        // FUTURE: May want to filter all non-SVG attributes here https://developer.mozilla.org/docs/Web/SVG/Reference/Attribute
        if (attributeName.startsWith('-')) continue;
        let attributeValue = computedStyle.getPropertyValue(attributeName);
        if (attributeValue === defaults.getPropertyValue(attributeName)) continue;

        for (const filter of attributeValueFilters) {
          const filteredValue = filter(attributeValue);
          if (filteredValue == null) continue;
          attributeValue = filteredValue;
          break;
        }

        try {
          // This produces a warning for the fill attribute on Firefox. Still works though.
          element.setAttribute(attributeName, attributeValue);
        } catch (e) {
          console.log(`Error setting attribute '${attributeName}' value '${attributeValue}':`);
          console.log(e);
        }
      }
    }
  };

  /**
   * Gets all elements that drive SVG SMIL animation.
   * 
   * @param {SVGSVGElement} svg 
   * @returns {NodeListOf<SVGElement>} 
   */
  lib.svg.getAllAnimationElements = (svg) => {
    return svg.querySelectorAll(animationElementsSelector);
  };
}