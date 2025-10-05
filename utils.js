/* js/utils.js
   Utility functions for Tile Inventory App
   - Unit conversion between Box / Piece / SFT
   - boxesNeededForSft: calculates boxes required (rounded up)
   - convertUnits: convert numeric quantity between units using piecesPerBox and sftPerBox
   - formatCurrency
   - normalizeUnitName
   - Save as: tile-inventory-app/js/utils.js
*/

(() => {
  // Safe numeric parse
  function toNumber(v, fallback = 0) {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  }

  // Normalize unit names to one of: 'box', 'piece', 'sft'
  function normalizeUnitName(unit) {
    if (!unit) return 'piece';
    const u = String(unit).trim().toLowerCase();
    if (u === 'box' || u === 'boxes') return 'box';
    if (u === 'piece' || u === 'pieces' || u === 'pc' || u === 'pcs') return 'piece';
    if (u === 'sft' || u === 's.f.t' || u === 'sqft' || u === 'squarefeet' || u === 'square feet') return 'sft';
    return u;
  }

  // Round helper with fixed decimals (default 3)
  function roundTo(v, decimals = 3) {
    const p = Math.pow(10, decimals);
    return Math.round((toNumber(v) + Number.EPSILON) * p) / p;
  }

  // Calculate how many boxes are needed to cover requiredSft given sftPerBox
  // returns integer boxes (rounded up)
  function boxesNeededForSft(requiredSft, sftPerBox) {
    requiredSft = toNumber(requiredSft, 0);
    sftPerBox = toNumber(sftPerBox, 0);
    if (sftPerBox <= 0) return 0;
    return Math.ceil(requiredSft / sftPerBox);
  }

  /**
   * convertUnits(quantity, fromUnit, toUnit, piecesPerBox, sftPerBox)
   *
   * - quantity: numeric
   * - fromUnit/toUnit: 'box'|'piece'|'sft' (case-insensitive)
   * - piecesPerBox: number of pieces in one box (required for conversions involving pieces)
   * - sftPerBox: square feet covered by one box (required for conversions involving sft)
   *
   * Returns a number (rounded to 3 decimals). If conversion not possible due to missing data, returns NaN.
   */
  function convertUnits(quantity, fromUnit, toUnit, piecesPerBox = 0, sftPerBox = 0) {
    const q = toNumber(quantity, 0);
    const from = normalizeUnitName(fromUnit);
    const to = normalizeUnitName(toUnit);

    // trivial
    if (from === to) return roundTo(q);

    // Convert everything via base unit 'box'
    // Convert fromUnit -> boxes
    let boxes = null;
    if (from === 'box') {
      boxes = q;
    } else if (from === 'piece') {
      if (toNumber(piecesPerBox) <= 0) return NaN;
      boxes = q / toNumber(piecesPerBox);
    } else if (from === 'sft') {
      if (toNumber(sftPerBox) <= 0) return NaN;
      boxes = q / toNumber(sftPerBox);
    } else {
      // unknown from unit -> try treat as pieces
      if (toNumber(piecesPerBox) <= 0) return NaN;
      boxes = q / toNumber(piecesPerBox);
    }

    // Now convert boxes -> toUnit
    if (to === 'box') {
      return roundTo(boxes);
    } else if (to === 'piece') {
      if (toNumber(piecesPerBox) <= 0) return NaN;
      return roundTo(boxes * toNumber(piecesPerBox));
    } else if (to === 'sft') {
      if (toNumber(sftPerBox) <= 0) return NaN;
      return roundTo(boxes * toNumber(sftPerBox));
    } else {
      return NaN;
    }
  }

  /**
   * computeBoxesPiecesSftFromRequiredSft(requiredSft, sftPerBox, piecesPerBox)
   * - returns an object { boxesNeeded, leftoverSft, equivalentPieces, boxesRoundedUp }
   */
  function computeBoxesPiecesSftFromRequiredSft(requiredSft, sftPerBox, piecesPerBox) {
    requiredSft = toNumber(requiredSft, 0);
    sftPerBox = toNumber(sftPerBox, 0);
    piecesPerBox = toNumber(piecesPerBox, 0);

    if (sftPerBox <= 0) return { boxesNeeded: 0, leftoverSft: requiredSft, equivalentPieces: 0, boxesRoundedUp: 0 };

    const exactBoxes = requiredSft / sftPerBox;
    const boxesRoundedUp = Math.ceil(exactBoxes);
    const boxesNeeded = exactBoxes;
    const leftoverSft = roundTo((boxesRoundedUp * sftPerBox) - requiredSft);
    const equivalentPieces = piecesPerBox > 0 ? (boxesRoundedUp * piecesPerBox) : 0;

    return {
      boxesNeeded: roundTo(boxesNeeded, 4),
      boxesRoundedUp,
      leftoverSft,
      equivalentPieces
    };
  }

  // helper for formatting currency (simple)
  function formatCurrency(amount, currency = '₹') {
    const n = toNumber(amount, 0);
    // Use Intl if available for nicer formatting
    try {
      return (new Intl.NumberFormat(undefined, { style: 'currency', currency: 'INR', maximumFractionDigits: 2 })).format(n);
    } catch (e) {
      // fallback
      return `${currency}${n.toFixed(2)}`;
    }
  }

  // expose API
  window.tiaUtils = {
    toNumber,
    normalizeUnitName,
    roundTo,
    boxesNeededForSft,
    convertUnits,
    computeBoxesPiecesSftFromRequiredSft,
    formatCurrency
  };

})();
