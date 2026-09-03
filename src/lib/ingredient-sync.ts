/**
 * Reine Helfer für die Synchronisation von Zutaten-Namen in den Text-Arrays
 * `products.ingredients` und `products.removable`.
 * Die Arrays sind keine Fremdschlüssel – Umbenennen/Löschen muss daher die
 * gespeicherten Namen aktiv mitpflegen. Diese Funktionen sind offline testbar.
 */

/** Ersetzt exakte Vorkommen von `oldName` durch `newName` und entfernt Duplikate. */
export function renameInList(list: string[], oldName: string, newName: string): string[] {
  const out: string[] = [];
  for (const value of list) {
    const next = value === oldName ? newName : value;
    if (!out.includes(next)) out.push(next);
  }
  return out;
}

/** Entfernt alle exakten Vorkommen von `name`. */
export function removeFromList(list: string[], name: string): string[] {
  return list.filter((value) => value !== name);
}

/** Wendet ein Rename auf beide Arrays eines Produkts an. */
export function renameInProduct<T extends { ingredients: string[]; removable: string[] }>(
  product: T,
  oldName: string,
  newName: string,
): T {
  return {
    ...product,
    ingredients: renameInList(product.ingredients, oldName, newName),
    removable: renameInList(product.removable, oldName, newName),
  };
}

/** Entfernt eine Zutat aus beiden Arrays eines Produkts. */
export function removeFromProduct<T extends { ingredients: string[]; removable: string[] }>(
  product: T,
  name: string,
): T {
  return {
    ...product,
    ingredients: removeFromList(product.ingredients, name),
    removable: removeFromList(product.removable, name),
  };
}
