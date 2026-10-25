// The list shown on the "Other projects" page.
// `column` puts a group on the left or right on wide screens.
// Optional per item: `description`, `type` (overrides the group's), `label`
// (small tag next to the title) and `image` (path relative to this folder).

export const PROJECT_GROUPS = [
  {
    heading: 'Papers',
    column: 'left',
    type: 'Preprint · Zenodo',
    note: 'These preprints were produced with extensive use of AI tools under my direction, as stated in each paper. They have not been peer reviewed.',
    items: [
      {
        title: 'Exact localization of Grover quantum walks on crystal lattices: transfer currents, a universal bound, and uniform-spanning-tree degree laws',
        url: 'https://zenodo.org/records/23010606',
      },
      {
        title: 'Exact height-one probabilities of three-dimensional Abelian sandpiles, spanning-tree entropies of the snub-square and Cairo lattices, and elementary resistor-network reductions',
        url: 'https://zenodo.org/records/23010883',
      },
      {
        title: 'Universal small-spin formulas for the shadow area, the capture cross-section and the spin-down of Kerr-like rotating black holes',
        url: 'https://zenodo.org/records/23136697',
      },
      {
        title: 'Exact results for Kerr black holes: shadow areas and perimeters, capture of slow particles, and escape from near extremal horizons',
        url: 'https://zenodo.org/records/23136851',
      },
    ],
  },
  {
    heading: 'Libraries',
    column: 'left',
    type: 'NuGet package for .NET',
    items: [
      {
        title: 'TorchSharpVisual',
        description: 'Draws colour-coded architecture diagrams of TorchSharp neural network models.',
        url: 'https://www.nuget.org/packages/TorchSharpVisual',
      },
      {
        title: 'TorchSharpSummary',
        description: 'Prints a layer-by-layer summary of a TorchSharp model: shapes, parameter counts, memory and operation estimates.',
        url: 'https://www.nuget.org/packages/TorchSharpSummary',
      },
    ],
  },
  {
    heading: 'Games and interactive projects',
    column: 'right',
    items: [
      {
        title: 'Apex Ring',
        description: 'A 3D hypercar racing game in the browser.',
        type: 'Browser game · itch.io',
        image: 'images/apex-ring.jpg',
        imageAlt: 'A teal hypercar on a rainy mountain track, with the Apex Ring title.',
        url: 'https://jacobgoodchild.itch.io/apex-ring',
      },
      {
        title: 'Desk Piano',
        description: 'Play piano by tapping a printed paper keyboard, using a webcam and microphone.',
        type: 'Web app',
        label: 'Early Access – Still Under Construction',
        url: 'https://jacobgoodchild.github.io/desk-piano/',
      },
      {
        title: 'Air Violin',
        description: 'Play a violin in the air using a webcam.',
        type: 'Web app',
        url: 'https://jacobgoodchild.github.io/air-violin/',
      },
    ],
  },
];
