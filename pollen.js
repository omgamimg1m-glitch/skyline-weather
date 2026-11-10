/* Pollen bands and grouping.
 *
 * Kept separate from index.html so the thresholds are unit-testable without a
 * browser and so the "which level is this number" decision lives in one place
 * instead of being buried in a renderer.
 *
 * Two things drive the design:
 *
 *   1. Each type is measured on its OWN scale. Birch in the tens and grass in
 *      the single digits can both mean "high", because the two are counted
 *      differently. A single shared scale would mislabel half of the six types.
 *
 *   2. The bands are ranges in grains per cubic metre, so the number on screen
 *      means something. They follow the ranges public pollen-count services
 *      publish, which is what people already recognise.
 *
 * A level is never the only signal: every caller renders an icon and a word
 * alongside the colour, so the meaning survives greyscale and screen readers.
 */
(function (root) {
  "use strict";

  var TYPES = {
    alder_pollen:   { label: "Alder",   group: "trees" },
    birch_pollen:   { label: "Birch",   group: "trees" },
    olive_pollen:   { label: "Olive",   group: "trees" },
    grass_pollen:   { label: "Grass",   group: "grass" },
    mugwort_pollen: { label: "Mugwort", group: "weeds" },
    ragweed_pollen: { label: "Ragweed", group: "weeds" }
  };

  var GROUP_LABEL = { trees: "Trees", grass: "Grass", weeds: "Weeds" };

  /* [upper bound (exclusive), level] */
  var BANDS = {
    trees: [[10, "low"], [50, "moderate"], [200, "high"], [Infinity, "very high"]],
    grass: [[5, "low"], [20, "moderate"], [100, "high"], [Infinity, "very high"]],
    weeds: [[5, "low"], [20, "moderate"], [50, "high"], [Infinity, "very high"]]
  };

  var META = {
    "low":       { rank: 0, icon: "🟢", text: "Low" },
    "moderate":  { rank: 1, icon: "🟡", text: "Moderate" },
    "high":      { rank: 2, icon: "🟠", text: "High" },
    "very high": { rank: 3, icon: "🔴", text: "Very high" }
  };

  var ORDER = ["low", "moderate", "high", "very high"];

  /* Which level does this concentration fall in, for this group? */
  function band(group, value) {
    if (value == null || !isFinite(value)) return null;
    var scale = BANDS[group] || BANDS.weeds;
    for (var i = 0; i < scale.length; i++) {
      if (value < scale[i][0]) return scale[i][1];
    }
    return "very high";
  }

  /* The worst of several levels — one high group is what a person notices, so
     averaging would hide a spike behind quiet neighbours. */
  function worst(levels) {
    var out = "low";
    for (var i = 0; i < levels.length; i++) {
      var l = levels[i];
      if (l && META[l] && META[l].rank > META[out].rank) out = l;
    }
    return out;
  }

  /* CSS class helper — "very high" must become "very-high", and getting this
     wrong silently drops the colour. */
  function cls(level) {
    return "pol-" + String(level || "low").replace(/\s+/g, "-");
  }

  var api = {
    TYPES: TYPES,
    GROUP_LABEL: GROUP_LABEL,
    BANDS: BANDS,
    META: META,
    ORDER: ORDER,
    band: band,
    worst: worst,
    cls: cls
  };

  if (typeof module === "object" && module.exports) module.exports = api;  /* node tests */
  root.Pollen = api;                                                      /* browser */
})(typeof window !== "undefined" ? window : globalThis);
