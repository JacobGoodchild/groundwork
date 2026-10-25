// The list shown on the "Other projects" page.
// To add a project, add an entry to the right group's `items`.
// `label` is optional and shows as a small tag next to the title.

export const PROJECT_GROUPS = [
  {
    heading: 'Papers',
    type: 'Preprint (Zenodo)',
    note: 'These preprints were produced with extensive use of AI tools under my direction, as stated in each paper. They have not been peer reviewed.',
    items: [
      {
        title: 'Exact localization of Grover quantum walks on crystal lattices: transfer currents, a universal bound, and uniform-spanning-tree degree laws',
        description: 'Exact results for how much of a quantum walker stays trapped at its starting point on crystal lattices.',
        url: 'https://zenodo.org/records/23010606',
      },
      {
        title: 'Exact height-one probabilities of three-dimensional Abelian sandpiles, spanning-tree entropies of the snub-square and Cairo lattices, and elementary resistor-network reductions',
        description: 'Exact formulas for sandpile models, spanning trees and resistor networks on lattices.',
        url: 'https://zenodo.org/records/23010883',
      },
      {
        title: 'Universal small-spin formulas for the shadow area, the capture cross-section and the spin-down of Kerr-like rotating black holes',
        description: 'Formulas for how a small amount of spin changes the shadow, particle capture and spin-down of a whole family of rotating black holes.',
        url: 'https://zenodo.org/records/23136697',
      },
      {
        title: 'Exact results for Kerr black holes: shadow areas and perimeters, capture of slow particles, and escape from near extremal horizons',
        description: 'Exact formulas for the size of a spinning black hole’s shadow, how it captures slow particles, and how light escapes from near its horizon.',
        url: 'https://zenodo.org/records/23136851',
      },
    ],
  },
  {
    heading: 'Libraries',
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
    items: [
      {
        title: 'Apex Ring',
        description: 'A 3D hypercar racing game in the browser.',
        type: 'Browser game (itch.io)',
        url: 'https://jacobgoodchild.itch.io/apex-ring',
      },
      {
        title: 'Air Violin',
        description: 'Play a violin in the air using a webcam.',
        type: 'Web app',
        url: 'https://jacobgoodchild.github.io/air-violin/',
      },
      {
        title: 'Desk Piano',
        description: 'Play piano by tapping a printed paper keyboard, using a webcam and microphone.',
        type: 'Web app',
        label: 'Early Access – Still Under Construction',
        url: 'https://jacobgoodchild.github.io/desk-piano/',
      },
      {
        title: 'Home Roads',
        description: 'Drive a hypercar around real roads in Overton and Whitchurch, built from map data.',
        type: 'Browser game',
        label: 'Early Access – Still Under Construction',
        url: 'https://jacobgoodchild.github.io/home-roads',
      },
    ],
  },
  {
    heading: 'Tools',
    items: [
      {
        title: 'mathrun',
        description: 'A dashboard for maths search programs running on my own computer.',
        type: 'Web dashboard',
        url: 'https://jacobgoodchild.github.io/mathrun/',
      },
    ],
  },
];
