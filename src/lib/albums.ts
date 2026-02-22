export interface Album {
  id: string;
  title: string;
  cover: string;
  photos: { src: string; alt: string }[];
}

// Use lh3.googleusercontent.com for embeddable Google Drive images
const gd = (id: string) => `https://lh3.googleusercontent.com/d/${id}=s1600`;

export const albums: Album[] = [
  {
    id: "gestante",
    title: "Gestante",
    cover: gd("1bK-Z6n08Ai-V5n3D6kzCxpgJgWrn1p1-"),
    photos: [
      { src: gd("1k4CSSi-DGbKRrhiY2UjvFFmWMnoSN_Yl"), alt: "Gestante 1" },
      { src: gd("1tOiA8--OiUV5UbFKXrlZlm3JkA1z2-R3"), alt: "Gestante 2" },
      { src: gd("1bK-Z6n08Ai-V5n3D6kzCxpgJgWrn1p1-"), alt: "Gestante 3" },
      { src: gd("1pjtIapbrPYwYlBvejo5W04gszM6Y_Tvh"), alt: "Gestante 4" },
      { src: gd("1YVktYN2q4R5J2-yaZsYK0uKng5CHoMCq"), alt: "Gestante 5" },
      { src: gd("1YIK9wxtoipy1mbZXr5mDU8mnNgWOux9j"), alt: "Gestante 6" },
      { src: gd("1dJoocoZaTYBQCg0QonJh3KeYt0c-nSkl"), alt: "Gestante 7" },
      { src: gd("1WCrWwD9BpRZx7R26nnQNX232qxh7IJzj"), alt: "Gestante 8" },
    ],
  },
  {
    id: "moda-praia",
    title: "Moda Praia",
    cover: gd("1i8h3lw5_PqtOLJ4x19SZW9D888ErH0lZ"),
    photos: [
      { src: gd("1i8h3lw5_PqtOLJ4x19SZW9D888ErH0lZ"), alt: "Moda Praia 1" },
      { src: gd("1ez2cDWaUU_mngOywf1fGPJeHbcmmJLaI"), alt: "Moda Praia 2" },
    ],
  },
  {
    id: "new-born",
    title: "New Born",
    cover: gd("19kdPbZwSvq4Bd-yNuhyetBNAb0_57sco"),
    photos: [
      { src: gd("19kdPbZwSvq4Bd-yNuhyetBNAb0_57sco"), alt: "New Born 1" },
      { src: gd("12r4PIIeAGmThjzVgp-4KOmnyUpPwgSGL"), alt: "New Born 2" },
      { src: gd("1ZW381BekZE8YFnvjyKa5SL-Hyj7qFXjZ"), alt: "New Born 3" },
      { src: gd("18hH7PPITmjAEm_O8iKMQ_mekufZ0aIm3"), alt: "New Born 4" },
    ],
  },
];
