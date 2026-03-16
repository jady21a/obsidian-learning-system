/**
 * Set multiple CSS properties safely (Obsidian eslint: prefer `setCssProps` over direct style mutation).
 *
 * - Uses `style.setProperty` under the hood to support kebab-case properties like `pointer-events`.
 * - Pass `null`/`undefined` to remove a property.
 */
export function setCssProps(
  el: HTMLElement,
  props: Record<string, string | number | null | undefined>
): void {
  for (const [prop, value] of Object.entries(props)) {
    if (value === null || value === undefined) {
      el.style.removeProperty(prop);
      continue;
    }
    el.style.setProperty(prop, String(value));
  }
}


