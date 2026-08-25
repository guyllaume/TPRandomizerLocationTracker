import type { RegionDefinition } from "../types/tracker";

// Prototype-only data. Replace this module when the complete TP Randomizer
// entrance dataset is available; saved runs intentionally do not embed it.
export const regions: RegionDefinition[] = [
  {
    id: "kakariko-village",
    name: "Kakariko Village",
    entrances: [
      { id: "kakariko-graveyard", name: "Graveyard", type: "overworld" },
      { id: "kakariko-death-mountain", name: "Death Mountain Trail", type: "overworld" },
      { id: "kakariko-malo-mart", name: "Malo Mart", type: "interior" },
      { id: "kakariko-barnes", name: "Barnes Bomb Shop", type: "interior" },
      { id: "kakariko-inn", name: "Elde Inn", type: "interior" },
    ],
  },
  {
    id: "hyrule-field",
    name: "Hyrule Field",
    entrances: [
      { id: "field-kakariko-gorge", name: "Kakariko Gorge", type: "overworld" },
      { id: "field-castle-town", name: "Castle Town Gate", type: "overworld" },
      { id: "field-bridge-eldin", name: "Bridge of Eldin", type: "overworld" },
      { id: "field-lantern-cavern", name: "Lantern Cavern", type: "cave" },
      { id: "field-south-grotto", name: "South Field Grotto", type: "grotto" },
    ],
  },
  {
    id: "castle-town",
    name: "Castle Town",
    entrances: [
      { id: "castle-town-south-road", name: "South Road", type: "overworld" },
      { id: "castle-town-east-road", name: "East Road", type: "overworld" },
      { id: "castle-town-west-road", name: "West Road", type: "overworld" },
      { id: "castle-town-telma", name: "Telma's Bar", type: "interior" },
      { id: "castle-town-agitha", name: "Agitha's Castle", type: "interior" },
    ],
  },
  {
    id: "lake-hylia",
    name: "Lake Hylia",
    entrances: [
      { id: "lake-upper-zora-river", name: "Upper Zora's River", type: "overworld" },
      { id: "lake-lanayru-spring", name: "Lanayru Spring", type: "interior" },
      { id: "lake-cannon", name: "Fyer's Cannon", type: "interior" },
      { id: "lake-spirit-cave", name: "Spirit Cave", type: "cave" },
      { id: "lake-bed-temple", name: "Lakebed Temple", type: "dungeon" },
    ],
  },
  {
    id: "faron-woods",
    name: "Faron Woods",
    entrances: [
      { id: "faron-south-woods", name: "South Faron Woods", type: "overworld" },
      { id: "faron-sacred-grove", name: "Sacred Grove", type: "overworld" },
      { id: "faron-coro-shop", name: "Coro's Shop", type: "interior" },
      { id: "faron-mist-cave", name: "Mist Cave", type: "cave" },
      { id: "faron-forest-temple", name: "Forest Temple", type: "dungeon" },
    ],
  },
  {
    id: "snowpeak",
    name: "Snowpeak",
    entrances: [
      { id: "snowpeak-trail", name: "Snowpeak Trail", type: "overworld" },
      { id: "snowpeak-cave", name: "Mountain Cave", type: "cave" },
      { id: "snowpeak-howling-stone", name: "Howling Stone Ledge", type: "one-way" },
      { id: "snowpeak-ruins", name: "Snowpeak Ruins", type: "dungeon" },
    ],
  },
];
