// Plantilla base (00 al 36). Se usa solo como punto de partida al crear
// una lotería; cada lotería puede tener sus propios números y animalitos.
// Los números son texto: "00" y "0" son valores distintos.
export const DEFAULT_ANIMALS = [
  ['00', 'Delfín'],
  ['1', 'Carnero'],
  ['2', 'Toro'],
  ['3', 'Ciempiés'],
  ['4', 'Alacrán'],
  ['5', 'León'],
  ['6', 'Rana'],
  ['7', 'Perico'],
  ['8', 'Ratón'],
  ['9', 'Águila'],
  ['10', 'Tigre'],
  ['11', 'Gato'],
  ['12', 'Caballo'],
  ['13', 'Mono'],
  ['14', 'Paloma'],
  ['15', 'Zorro'],
  ['16', 'Oso'],
  ['17', 'Pavo'],
  ['18', 'Burro'],
  ['19', 'Chivo'],
  ['20', 'Cochino'],
  ['21', 'Gallo'],
  ['22', 'Camello'],
  ['23', 'Cebra'],
  ['24', 'Iguana'],
  ['25', 'Gallina'],
  ['26', 'Vaca'],
  ['27', 'Perro'],
  ['28', 'Zamuro'],
  ['29', 'Elefante'],
  ['30', 'Caimán'],
  ['31', 'Lapa'],
  ['32', 'Ardilla'],
  ['33', 'Pescado'],
  ['34', 'Venado'],
  ['35', 'Jirafa'],
  ['36', 'Culebra'],
];

export function defaultAnimalRows() {
  return DEFAULT_ANIMALS.map(([number, animal]) => ({ number, animal }));
}
